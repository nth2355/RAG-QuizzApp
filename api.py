from pydantic import BaseModel, Field
from fastapi import FastAPI, UploadFile, File 
from filters import MetadataFilter, filters_to_dict
from indexing import save_and_ingest_pdf
from rag import answer 


from learning import summarize_learning, generate_quiz, generate_flashcards 
from schemas import (
    RagAnswer, 
    Summary, 
    DocumentInfo,   
    UploadResponse    
)
from store import list_documents

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

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/documents", response_model=list[DocumentInfo])
def documents():
    # FastAPI và Pydantic v2 sẽ tự động ép danh sách dict từ list_documents() 
    # thành danh sách Object DocumentInfo để khớp response_model.
    return list_documents()

@app.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)):
    content = await file.read()
    return save_and_ingest_pdf(file.filename or "", content)

@app.post("/ask", response_model=RagAnswer)
def ask(req: AskRequest):
    return answer(req.question, k=req.k, filters=filters_to_dict(req.filters))

@app.post("/summarize", response_model=Summary)
def summarize_endpoint(req: SummarizeRequest):  
    # Đổi tên hàm thành summarize_endpoint để tránh trùng scope và gọi chính xác hàm từ learning.py
    return summarize_learning(
        document=req.document,
        query=req.query,
        filters=filters_to_dict(req.filters),
        k=req.k
    )

@app.post("/quiz")
def quiz_endpoint(req: QuizzRequest):
    return generate_quiz(
        document=req.document,
        query=req.query,
        filters=filters_to_dict(req.filters),
        count=req.count,
        k=req.k
    )

@app.post("/flashcards")
def flashcards_endpoint(req: FlashcardsRequest):
    return generate_flashcards(
        document=req.document,
        query=req.query,
        filters=filters_to_dict(req.filters),
        count=req.count,
        k=req.k
    )