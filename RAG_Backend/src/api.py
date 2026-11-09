from contextlib import asynccontextmanager
from typing import Literal
from .config import settings
from pydantic import BaseModel, Field
import gc
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from .filters import MetadataFilter
from .indexing import save_and_ingest_pdf
from .rag import answer
from .indexing import delete_document
from .learning import summarize_learning, generate_quiz, generate_flashcards
from .schemas import (
    RagAnswer,
    Summary,
    DocumentInfo,
    UploadResponse,
    QuizSet,
    FlashcardSet
)
from .store import get_embedding_model, get_qdrant_client, get_reranker
from src.database.connection import engine, Base, get_db
from src.auth.dependencies import get_current_user
from src.database.models import User, Document, ChatHistory, QuizHistory, FlashcardHistory, SummaryHistory
from sqlalchemy.orm import Session
from src.auth_api import router as auth_router

class AskRequest(BaseModel):
    question: str = Field(min_length=1)
    k: int | None = Field(default=None, ge=1, le=64)
    filters: MetadataFilter | None = None
class SummarizeRequest(BaseModel):
    length: Literal["short", "medium", "long"] = "medium"
    focus: str = Field(default="Tổng quan", max_length=200)
    instructions: str = Field(default="", max_length=2000)
    document: str | None = None
    query: str | None = None
    filters: MetadataFilter | None = None
    k: int | None = Field(default=None, ge=1, le=64)

class QuizzRequest(BaseModel):
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    document: str | None = None
    query: str | None = None
    filters: MetadataFilter | None = None
    count: int | None = Field(default=None, ge=1, le=50)
    k: int | None = Field(default=None, ge=1, le=64)
class FlashcardsRequest(BaseModel):
    document: str | None = None
    query: str | None = None
    filters: MetadataFilter | None = None
    count: int | None = Field(default=None, ge=1, le=50)
    k: int | None = Field(default=None, ge=1, le=64)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    get_qdrant_client()
    if settings.preload_models:
        get_embedding_model()
        get_reranker()
    try:
        yield
    finally:
        get_qdrant_client().close()
        get_qdrant_client.cache_clear()
        from .store import get_vector_store
        get_vector_store.cache_clear()
        engine.dispose()
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

# KHỞI TẠO FASTAPI APP VỚI LIFESPAN
app = FastAPI(
    title="RAG Learning API",
    description="Generate Q&A, summarize, quizzes and flashcards over indexed PDFs",
    version="0.1.0",
    lifespan=lifespan
)

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def enforce_user_filters(req_filters: MetadataFilter | None, document: str | None, current_user_id: int, db: Session) -> MetadataFilter:
    f = req_filters.model_copy(deep=True) if req_filters else MetadataFilter()
    query = db.query(Document).filter(Document.user_id == current_user_id, Document.status.in_(["ready", "indexed"]))
    doc_name = document or f.filename
    if doc_name and doc_name != "Tất cả tài liệu":
        matches = query.filter(Document.original_filename == doc_name).all()
        if not matches:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu sẵn sàng của bạn.")
        if len(matches) > 1:
            raise HTTPException(status_code=409, detail="Tên tài liệu bị trùng. Hãy đổi tên hoặc xóa bản trùng.")
        allowed = [str(matches[0].id)]
    else:
        documents = query.all()
        allowed = [str(d.id) for d in documents]
        if f.filenames:
            allowed = [str(d.id) for d in documents if d.original_filename in f.filenames]
    requested = [f.document_id] if f.document_id else f.document_ids
    if requested:
        allowed = [doc_id for doc_id in allowed if doc_id in requested]
    f.filename = f.filenames = None
    f.document_id = allowed[0] if len(allowed) == 1 else ("none" if not allowed else None)
    f.document_ids = allowed if len(allowed) > 1 else None
    return f

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/documents", response_model=list[DocumentInfo])
def documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    from .config import settings
    return [
        DocumentInfo(
            document_id=str(d.id),
            filename=d.original_filename,
            source=d.stored_filename,
            status=d.status,
            created_at=d.created_at.isoformat() + "Z" if d.created_at else None,
            size_bytes=(settings.data_dir / d.stored_filename).stat().st_size if (settings.data_dir / d.stored_filename).exists() else None
        )
        for d in docs
    ]

@app.post("/upload", response_model=UploadResponse)
def upload(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = file.file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="PDF vượt giới hạn dung lượng cho phép.")
    return save_and_ingest_pdf(file.filename or "", content, user_id=current_user.id, db=db)

@app.post("/ask", response_model=RagAnswer)
def ask_endpoint(
    req: AskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        req.filters = enforce_user_filters(req.filters, None, current_user.id, db)

        res = answer(
            question=req.question,
            k=req.k,
            filters=req.filters,
        )

        # Save to ChatHistory
        resolved_doc_id = None
        if req.filters and req.filters.document_id:
            try:
                resolved_doc_id = int(req.filters.document_id)
            except ValueError:
                pass

        chat_log = ChatHistory(
            user_id=current_user.id,
            document_id=resolved_doc_id,
            question=req.question,
            answer=res.answer
        )
        db.add(chat_log)
        db.commit()

        return res

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )

@app.post("/summarize", response_model=Summary)
def summarize_endpoint(
    req: SummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        req.filters = enforce_user_filters(req.filters, req.document, current_user.id, db)

        res = summarize_learning(
            document=None,
            query=req.query,
            filters=req.filters,
            k=req.k,
            length=req.length,
            focus=req.focus,
            instructions=req.instructions,
        )

        resolved_doc_id = None
        if req.filters and req.filters.document_id:
            try:
                resolved_doc_id = int(req.filters.document_id)
            except ValueError:
                pass

        summary_log = SummaryHistory(
            user_id=current_user.id,
            document_id=resolved_doc_id,
            summary=res.summary
        )
        db.add(summary_log)
        db.commit()

        return res

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        print("SUMMARY ERROR:", e)
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )

@app.post("/quiz", response_model=QuizSet)
def quiz_endpoint(
    req: QuizzRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        req.filters = enforce_user_filters(req.filters, req.document, current_user.id, db)

        res = generate_quiz(
            document=None,
            query=req.query,
            filters=req.filters,
            count=req.count,
            k=req.k,
            difficulty=req.difficulty,
        )

        resolved_doc_id = None
        if req.filters and req.filters.document_id:
            try:
                resolved_doc_id = int(req.filters.document_id)
            except ValueError:
                pass

        items_data = [item.model_dump() for item in res.items]

        quiz_log = QuizHistory(
            user_id=current_user.id,
            document_id=resolved_doc_id,
            quiz_data={"items": items_data},
            score=None
        )
        db.add(quiz_log)
        db.commit()
        db.refresh(quiz_log)

        res.id = quiz_log.id
        return res
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        print("QUIZ ERROR:", str(e))
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )

@app.post("/flashcards", response_model=FlashcardSet)
def flashcards_endpoint(
    req: FlashcardsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        req.filters = enforce_user_filters(req.filters, req.document, current_user.id, db)

        res = generate_flashcards(
            document=None,
            query=req.query,
            filters=req.filters,
            count=req.count,
            k=req.k,
        )

        resolved_doc_id = None
        if req.filters and req.filters.document_id:
            try:
                resolved_doc_id = int(req.filters.document_id)
            except ValueError:
                pass

        cards_data = [card.model_dump() for card in res.cards]

        fc_log = FlashcardHistory(
            user_id=current_user.id,
            document_id=resolved_doc_id,
            flashcards_data={"cards": cards_data}
        )
        db.add(fc_log)
        db.commit()
        db.refresh(fc_log)

        res.id = fc_log.id
        return res

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )

@app.delete("/documents/{filename}")
def delete_document_endpoint(
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        res = delete_document(filename, user_id=current_user.id, db=db)
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Không thể xóa tài liệu. Có thể thử lại.") from e

@app.delete("/document-ids/{document_id}")
def delete_document_by_id(document_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return delete_document("", user_id=current_user.id, db=db, document_id=document_id)

class ScoreSubmit(BaseModel):
    answers: list[int | None] = Field(max_length=50)

@app.post("/quiz/{quiz_id}/score")
def submit_quiz_score(quiz_id: int, payload: ScoreSubmit, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(QuizHistory).filter(QuizHistory.id == quiz_id, QuizHistory.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài quiz của bạn.")
    items = quiz.quiz_data.get("items", [])
    if len(payload.answers) != len(items):
        raise HTTPException(status_code=422, detail="Số câu trả lời không khớp bài quiz.")
    for answer, item in zip(payload.answers, items):
        if answer is not None and not 0 <= answer < len(item["options"]):
            raise HTTPException(status_code=422, detail="Lựa chọn đáp án không hợp lệ.")
    score = sum(a == item["correct_index"] for a, item in zip(payload.answers, items))
    data = dict(quiz.quiz_data)
    data.setdefault("completed_at", datetime.utcnow().isoformat() + "Z")
    data["answers"] = payload.answers
    quiz.quiz_data = data
    quiz.score = score
    db.commit()
    return {"status": "success", "score": score}

@app.post("/flashcards/{set_id}/complete")
def complete_flashcards(set_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(FlashcardHistory).filter(FlashcardHistory.id == set_id, FlashcardHistory.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ flashcard của bạn.")
    data = dict(session.flashcards_data)
    data.setdefault("completed_at", datetime.utcnow().isoformat() + "Z")
    session.flashcards_data = data
    db.commit()
    return {"status": "success"}

from datetime import datetime, timedelta, timezone

@app.get("/stats")
def get_dashboard_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vn = timezone(timedelta(hours=7))
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    doc_map = {d.id: d.original_filename for d in docs}
    chats = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).all()
    summaries = db.query(SummaryHistory).filter(SummaryHistory.user_id == current_user.id).all()
    quizzes = db.query(QuizHistory).filter(QuizHistory.user_id == current_user.id, QuizHistory.score.isnot(None)).all()
    flashcards = db.query(FlashcardHistory).filter(FlashcardHistory.user_id == current_user.id).all()
    events = []
    def timestamp(value):
        if isinstance(value, str):
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    def add(kind, row, detail, when=None, amount=1):
        event = {
            "id": f"{kind}-{row.id}", "type": kind,
            "timestamp": timestamp(when or row.created_at).isoformat().replace("+00:00", "Z"),
            "detail": detail, "docName": doc_map.get(getattr(row, "document_id", row.id if kind == "upload" else None)),
        }
        events.append((event, amount))
    for d in docs:
        add("upload", d, f"Upload tài liệu: {d.original_filename}")
    for c in chats:
        add("chat", c, f"Chat với AI: {c.question[:40]}")
    for row in summaries:
        add("summarize", row, "Tóm tắt tài liệu")
    for q in quizzes:
        count = len(q.quiz_data.get("items", []))
        add("quiz_complete", q, f"Hoàn thành quiz — {q.score}/{count} câu đúng", q.quiz_data.get("completed_at"))
    total_flashcards = 0
    for f in flashcards:
        data = f.flashcards_data
        if not data.get("completed_at"):
            continue
        count = len(data.get("cards", []))
        total_flashcards += count
        add("flashcard_session", f, f"Ôn {count} flashcard", data["completed_at"], count)
    today = datetime.now(vn).date()
    labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    chart = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        entry = {"day": labels[day.weekday()], "questions": 0, "quizzes": 0, "flashcards": 0}
        for event, amount in events:
            key = {"chat": "questions", "quiz_complete": "quizzes", "flashcard_session": "flashcards"}.get(event["type"])
            if key and timestamp(event["timestamp"]).astimezone(vn).date() == day:
                entry[key] += amount
        chart.append(entry)
    recent = sorted((event for event, _ in events), key=lambda e: e["timestamp"], reverse=True)[:30]
    return {"totalQuestions": len(chats), "totalQuizzes": len(quizzes), "totalFlashcards": total_flashcards, "recentActivity": recent, "chartData": chart}
