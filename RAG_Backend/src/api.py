from contextlib import asynccontextmanager
from pydantic import BaseModel, Field
import gc
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from .filters import MetadataFilter, filters_to_dict
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
from .store import list_documents, get_embedding_model, get_qdrant_client, get_reranker
import time
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
    document: str | None = None
    query: str | None = None 
    filters: MetadataFilter | None = None
    k: int | None = Field(default=None, ge=1, le=64)

class QuizzRequest(BaseModel):
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

import gc
import torch
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "="*50)
    print(" LOG: Bắt đầu quá trình kích hoạt Hệ thống RAG...")
    print("="*50)
    
    #THEO DÕI KHỞI TẠO EMBEDDING ---
    start_time = time.time()
    print("[Bước 1/3] Đang nạp Embedding Model (GreenNode)...")
    try:
        get_embedding_model()
        print(f"    => THÀNH CÔNG! Thời gian nạp: {time.time() - start_time:.2f} giây.")
    except Exception as e:
        print(f"    LỖI nạp Embedding: {e}")

    #THEO DÕI KHỞI TẠO RE-RANKER ---
    start_time = time.time()
    print("[Bước 2/3] Đang nạp Re-ranker Model (BGE-Reranker)...")
    try:
        get_reranker()
        print(f"    => THÀNH CÔNG! Thời gian nạp: {time.time() - start_time:.2f} giây.")
    except Exception as e:
        print(f"    LỖI nạp Re-ranker: {e}")

    #THEO DÕI KẾT NỐI VECTOR DB ---
    start_time = time.time()
    print("[Bước 3/3] Đang kết nối tới Qdrant Vector DB...")
    try:
        get_qdrant_client()
        print(f"    => THÀNH CÔNG! Thời gian kết nối: {time.time() - start_time:.2f} giây.")
    except Exception as e:
        print(f"    LỖI kết nối Vector DB: {e}")
        
    print("="*50)
    print(" LOG: Toàn bộ mô hình đã nạp xong! Hệ thống sẵn sàng tiếp nhận Request.")
    print("="*50 + "\n")
    
    # Server dừng lại và chạy liên tục để nhận request
    yield

    #TẮT SERVER: GIẢI PHÓNG BỘ NHỚ (RAM/VRAM)
    print("\n" + "="*50)
    print(" LOG: Đang tiến hành đóng server và giải phóng bộ nhớ...")
    print("="*50)
    
    try:
        # 1. Xóa các biến toàn cục liên quan đến cache hoặc kết nối nếu cần
        # 2. Thu gom rác dữ liệu thừa trong RAM
        collected = gc.collect()
        print(f" LOG: Trình thu gom rác (GC) đã giải phóng {collected} objects trong RAM.")
        
        # 3. Giải phóng bộ nhớ VRAM của GPU
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
            print(" LOG: Đã xóa toàn bộ CUDA Cache trong VRAM GPU.")
            
    except Exception as e:
        print(f" LỖI KHI DỌN DẸP BỘ NHỚ: {e}")
        
    print("="*50)
    print(" LOG: Đã đóng Server RAG an toàn!")
    print("="*50 + "\n")

# KHỞI TẠO FASTAPI APP VỚI LIFESPAN 
app = FastAPI(
    title="RAG Learning API",
    description="Generate Q&A, summarize, quizzes and flashcards over indexed PDFs",
    version="0.1.0",
    lifespan=lifespan  
)

Base.metadata.create_all(bind=engine) 
app.include_router(auth_router) 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def enforce_user_filters(req_filters: MetadataFilter | None, document: str | None, current_user_id: int, db: Session) -> MetadataFilter:
    if req_filters is None:
        req_filters = MetadataFilter()
    
    # Check if a specific document is requested
    doc_name = document or (req_filters.filename if req_filters else None)
    
    if doc_name and doc_name != "Tất cả tài liệu":
        # Find this specific document for the user
        db_doc = db.query(Document).filter(
            Document.user_id == current_user_id,
            Document.original_filename == doc_name
        ).first()
        if not db_doc:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy tài liệu '{doc_name}'")
        
        # Clear original filename/filenames filter and target document_id
        req_filters.filename = None
        req_filters.filenames = None
        req_filters.document_id = str(db_doc.id)
        req_filters.document_ids = None
    else:
        # All documents: filter by user's document list
        user_docs = db.query(Document).filter(Document.user_id == current_user_id).all()
        if not user_docs:
            # Return a filter that will match nothing
            req_filters.document_id = "none"
            req_filters.document_ids = None
        else:
            req_filters.document_id = None
            req_filters.document_ids = [str(d.id) for d in user_docs]
            
    return req_filters

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
            size_bytes=(settings.data_dir / d.stored_filename).stat().st_size if (settings.data_dir / d.stored_filename).exists() else None
        )
        for d in docs
    ]

@app.post("/upload", response_model=UploadResponse)
async def upload(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = await file.read()
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

    except RuntimeError as e:
        raise HTTPException(
            status_code=429,
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

    except RuntimeError as e:
        print("SUMMARY ERROR:", e)
        raise HTTPException(
            status_code=429,
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
    except RuntimeError as e:
        print("QUIZ ERROR:", str(e))
        raise HTTPException(
            status_code=429,
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

    except RuntimeError as e:
        raise HTTPException(
            status_code=429,
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ScoreSubmit(BaseModel):
    score: int

@app.post("/quiz/{quiz_id}/score")
def submit_quiz_score(
    quiz_id: int,
    payload: ScoreSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quiz = db.query(QuizHistory).filter(
        QuizHistory.id == quiz_id,
        QuizHistory.user_id == current_user.id
    ).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi của bạn")
    quiz.score = payload.score
    db.commit()
    return {"status": "success", "message": f"Đã lưu kết quả bài quiz: {payload.score}"}

from datetime import datetime, timedelta

@app.get("/stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Counts
    total_questions = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).count()
    total_quizzes = db.query(QuizHistory).filter(
        QuizHistory.user_id == current_user.id,
        QuizHistory.score.isnot(None)
    ).count()
    
    total_flashcards = 0
    fcs = db.query(FlashcardHistory).filter(FlashcardHistory.user_id == current_user.id).all()
    for f in fcs:
        cards = f.flashcards_data.get("cards", []) if isinstance(f.flashcards_data, dict) else []
        total_flashcards += len(cards)

    # 2. Activity Feed
    recent_activity = []
    
    user_docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    doc_map = {d.id: d.original_filename for d in user_docs}

    # Query uploads
    for d in user_docs:
        recent_activity.append({
            "id": f"upload-{d.id}",
            "type": "upload",
            "timestamp": d.created_at.isoformat() + "Z" if hasattr(d, "created_at") and d.created_at else datetime.now().isoformat() + "Z",
            "detail": f"Upload tài liệu: {d.original_filename}",
            "docName": d.original_filename
        })
        
    # Query chats
    chats = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).order_by(ChatHistory.id.desc()).limit(20).all()
    for c in chats:
        doc_name = doc_map.get(c.document_id)
        recent_activity.append({
            "id": f"chat-{c.id}",
            "type": "chat",
            "timestamp": c.created_at.isoformat() + "Z" if c.created_at else datetime.now().isoformat() + "Z",
            "detail": f"Chat với AI: {c.question[:40]}...",
            "docName": doc_name
        })

    # Query summaries
    summaries = db.query(SummaryHistory).filter(SummaryHistory.user_id == current_user.id).order_by(SummaryHistory.id.desc()).limit(20).all()
    for s in summaries:
        doc_name = doc_map.get(s.document_id)
        recent_activity.append({
            "id": f"summary-{s.id}",
            "type": "summarize",
            "timestamp": s.created_at.isoformat() + "Z" if s.created_at else datetime.now().isoformat() + "Z",
            "detail": "Tóm tắt tài liệu",
            "docName": doc_name
        })

    # Query quizzes
    quizzes = db.query(QuizHistory).filter(
        QuizHistory.user_id == current_user.id,
        QuizHistory.score.isnot(None)
    ).order_by(QuizHistory.id.desc()).limit(20).all()
    for q in quizzes:
        doc_name = doc_map.get(q.document_id)
        total_items = len(q.quiz_data.get("items", [])) if isinstance(q.quiz_data, dict) else 0
        recent_activity.append({
            "id": f"quiz-{q.id}",
            "type": "quiz_complete",
            "timestamp": q.created_at.isoformat() + "Z" if q.created_at else datetime.now().isoformat() + "Z",
            "detail": f"Hoàn thành quiz — {q.score}/{total_items} câu đúng",
            "docName": doc_name
        })

    # Query flashcards
    flashcards = db.query(FlashcardHistory).filter(FlashcardHistory.user_id == current_user.id).order_by(FlashcardHistory.id.desc()).limit(20).all()
    for f in flashcards:
        doc_name = doc_map.get(f.document_id)
        cards_count = len(f.flashcards_data.get("cards", [])) if isinstance(f.flashcards_data, dict) else 0
        recent_activity.append({
            "id": f"fc-{f.id}",
            "type": "flashcard_session",
            "timestamp": f.created_at.isoformat() + "Z" if f.created_at else datetime.now().isoformat() + "Z",
            "detail": f"Ôn {cards_count} flashcard",
            "docName": doc_name
        })

    recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)
    recent_activity = recent_activity[:30]

    # 3. Chart Data for the last 7 days
    VN_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
    chart_data = []
    
    today_dt = datetime.now()
    for i in range(6, -1, -1):
        day_date = today_dt - timedelta(days=i)
        weekday_idx = (day_date.weekday() + 1) % 7
        day_label = VN_DAYS[weekday_idx]
        
        start_of_day = datetime(day_date.year, day_date.month, day_date.day, 0, 0, 0)
        end_of_day = datetime(day_date.year, day_date.month, day_date.day, 23, 59, 59)
        
        questions_count = db.query(ChatHistory).filter(
            ChatHistory.user_id == current_user.id,
            ChatHistory.created_at >= start_of_day,
            ChatHistory.created_at <= end_of_day
        ).count()
        
        quizzes_count = db.query(QuizHistory).filter(
            QuizHistory.user_id == current_user.id,
            QuizHistory.score.isnot(None),
            QuizHistory.created_at >= start_of_day,
            QuizHistory.created_at <= end_of_day
        ).count()
        
        flashcards_count = 0
        day_fcs = db.query(FlashcardHistory).filter(
            FlashcardHistory.user_id == current_user.id,
            FlashcardHistory.created_at >= start_of_day,
            FlashcardHistory.created_at <= end_of_day
        ).all()
        for f in day_fcs:
            cards = f.flashcards_data.get("cards", []) if isinstance(f.flashcards_data, dict) else []
            flashcards_count += len(cards)

        chart_data.append({
            "day": day_label,
            "questions": questions_count,
            "quizzes": quizzes_count,
            "flashcards": flashcards_count
        })

    return {
        "totalQuestions": total_questions,
        "totalQuizzes": total_quizzes,
        "totalFlashcards": total_flashcards,
        "recentActivity": recent_activity,
        "chartData": chart_data
    }