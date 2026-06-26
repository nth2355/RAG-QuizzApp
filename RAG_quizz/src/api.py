from contextlib import asynccontextmanager
from pydantic import BaseModel, Field
import gc
import torch
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
from .store import list_documents, get_embedding_model, get_qdrant_client

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

# TẢI TRƯỚC VÀ DỌN DẸP BỘ NHỚ KHI TẮT
@asynccontextmanager
async def lifespan(app: FastAPI):
    #KHỞI ĐỘNG SERVER: NẠP MODEL VÀO BỘ NHỚ
    print("\n" + "="*50)
    print(" LOG: Đang khởi tạo hệ thống và nạp Model Embedding Local...")
    print("="*50)
    try:
        # Tải mô hình Embedding lên bộ nhớ (RAM/VRAM) ngay từ đầu
        get_embedding_model()
        print(" LOG: Tải thành công Embedding Model.")
        
        # Kết nối sẵn sàng tới cơ sở dữ liệu Qdrant
        get_qdrant_client()
        print(" LOG: Kết nối Vector DB sẵn sàng.")
        
    except Exception as e:
        print(f" KHÔNG THỂ TẢI MODEL KHI KHỞI CHẠY: {e}")
        
    print("="*50)
    print(" LOG: Hệ thống RAG đã sẵn sàng tiếp nhận Request từ Frontend!")
    print("="*50 + "\n")
    
    # Server dừng lại ở đây và chạy liên tục để nhận request
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