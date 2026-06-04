from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Literal
from pydantic import model_validator
from functools import lru_cache

class Settings(BaseSettings):
    #Cấu hình cách load config
    model_config = SettingsConfigDict(
        env_file=".env",   # Đọc biến môi trường từ file .env
        env_prefix="RAG_", # Chỉ lấy các biến có prefix RAG_ (vd: RAG_TOP_K)
        extra="ignore"     # Bỏ qua các biến dư không khai báo trong class
    )

    #Đường dẫn dữ liệu
    data_dir: Path = Path("data")  
    # Thư mục chứa dữ liệu gốc (PDF, TXT, docs...) để ingest vào hệ RAG

    storage_dir: Path = Path("storage/qdrant")  
    # Nơi lưu vector database (embedding sau khi xử lý)

    qdrant_collection: str = "rag_chunks"  
    # Tên collection trong Qdrant

    
    
    
    # Tham số chia nhỏ dữ liệu (chunking)
    chunk_size: int = Field(default=1000, ge=100)  
    # Độ dài mỗi chunk (>=100), ảnh hưởng tới độ chi tiết và context

    chunk_overlap: int = Field(default=150, ge=0)  
    # Số ký tự overlap giữa các chunk (>=0), giúp giữ ngữ cảnh
    
    # Tham số truy xuất (retrieval)
    top_k: int = Field(default=5, ge=1, le=64)  
    # Số chunk liên quan nhất được lấy ra khi query (1–64)
    
    
    
    
    #Định nghĩa model Embedding
    embedding_mdel: str = "GreenNode/GreenNode-Embedding-Large-VN-Mixed-V1"
    
    #Định nghĩa công tắc chọn backend LLM (hugging face, gemini hoặc vllm. Nếu "chatgpt->lỗi")
    llm_provider: Literal["hf_local", "gemini", "vllm"] = "gemini"
    
    #Tham số độ sáng tạo của model(0.0: Cực kì chính xác, 0.1->0.3 RAG hay dùng)
    llm_temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    
    
    
    
    hf_model: str = "/mnt/pretrained_fm/Qwen_Qwen3-4B-Instruct-2507"  
    # Đường dẫn tới model LLM local (HuggingFace)
    # → quyết định “bộ não” dùng để sinh câu trả lời

    hf_device: int = -1
    # Thiết bị chạy model
    # -1 = CPU, 0 = GPU0, 1 = GPU1
    # → chọn đúng GPU để tăng tốc inference

    hf_max_new_tokens: int = Field(default=2048, ge=1)  
    # Số token tối đa model được phép sinh ra
    # ≥ 1 để tránh giá trị vô nghĩa
    # → càng lớn: câu trả lời càng dài nhưng chậm hơn
    
    
    gemini_model: str = "gemini-2.5-flash"  


    google_api_key: str | None = Field(default=None, validation_alias="GOOGLE_API_KEY")  
    
    
    
    
    vllm_api_base: str = "http://localhost:8001/v1"  


    vllm_api_key: str = "EMPTY"  

    
    summarize_batch_size: int = Field(default=10, ge=1)  

    summarize_retrieval_k: int = Field(default=8, ge=1, le=128)  

    generation_retrieval_k: int = Field(default=6, ge=1, le=128)  

    
    
    
    
    
    quizz_default_count: int = Field(default=8, ge=1, le=50)
    flash_card_default_count: int = Field(default=15, ge=1, le=100)
    api_url: str = "http://localhost:8000"
    
    
    
# Kiểm tra cấu hình bằng model_validator
@model_validator(mode="after")
def validate_config(self)->"Settings":
    if self.chunk_overlap >= self.chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size")
    if self.hf_device < -1:
        raise ValueError ("hf_device must be -1 for CPU or >= 0 for CUDA. ")
    if self.llm_provider == "gemini" and not self.google_api_key:
        raise ValueError ("GOOGLE_API_KEY is require when llm_provider ='gemini'.")
    return self

@lru_cache(maxsize=1)
def get_settings()->Settings:
    return Settings()

settings = get_settings()