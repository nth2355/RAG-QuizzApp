from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File, HTTPException
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
    UploadResponse    
)
from .store import list_documents

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

app = FastAPI(
    title="RAG Learning API",
    description="Generate Q&A, summarize, quizzes and flashcards over indexed PDFs",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/documents", response_model=list[DocumentInfo])
def documents():
    return list_documents()

@app.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)):
    content = await file.read()
    return save_and_ingest_pdf(file.filename or "", content)

@app.post("/ask")
def ask_endpoint(req: AskRequest):
    try:
        return answer(
            question=req.question,
            k=req.k,
            filters=req.filters,
        )

    except RuntimeError as e:
        raise HTTPException(
            status_code=429,
            detail=str(e)
        )

@app.post("/summarize")
def summarize_endpoint(req: SummarizeRequest):
    try:
        return summarize_learning(
            document=req.document,
            query=req.query,
            filters=req.filters,
            k=req.k,
        )

    except RuntimeError as e:
        print("SUMMARY ERROR:", e)
        raise HTTPException(
            
            status_code=429,
            detail=str(e)
        )

@app.post("/quiz")
def quiz_endpoint(req: QuizzRequest):
    try:
        return generate_quiz(
            document=req.document,
            query=req.query,
            filters=req.filters,
            count=req.count,
            k=req.k,
        )
    except RuntimeError as e:
        print("QUIZ ERROR:", str(e))
        raise HTTPException(
            status_code=429,
            detail=str(e)
        )

@app.post("/flashcards")
def flashcards_endpoint(req: FlashcardsRequest):
    try:
        return generate_flashcards(
            document=req.document,
            query=req.query,
            filters=req.filters,
            count=req.count,
            k=req.k,
        )

    except RuntimeError as e:
        raise HTTPException(
            status_code=429,
            detail=str(e)
        )
    
@app.delete("/documents/{filename}")
def delete_document_endpoint(filename: str):
    try:
        res = delete_document(filename)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))