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
        env_prefix="RAG_", # Chỉ lấy các biến có prefix RAG_
        extra="ignore"     # Bỏ qua các biến dư không khai báo trong class
    )

    #Đường dẫn dữ liệu
    data_dir: Path = Path("data")  
    # Thư mục chứa dữ liệu gốc (PDF, TXT, docs...) để ingest vào hệ RAG

    storage_dir: Path = Path("storage/qdrant")  

    qdrant_collection: str = "rag_chunks"  


    chunk_size: int = Field(default=1000, ge=100)  

    chunk_overlap: int = Field(default=150, ge=0)  
    top_k: int = Field(default=5, ge=1, le=64)  

    

    embedding_model: str = "GreenNode/GreenNode-Embedding-Large-VN-Mixed-V1"
    llm_provider: Literal["hf_local", "gemini", "vllm"] = "gemini"
    llm_temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    
    
    hf_model: str = "/mnt/pretrained_fm/Qwen_Qwen3-4B-Instruct-2507"  
    hf_device: int = -1

    hf_max_new_tokens: int = Field(default=2048, ge=1)  
    
    gemini_model: str = "gemini-2.5-flash"  
    google_api_key: str | None = None
    
    
    vllm_api_base: str = "http://localhost:8001/v1"  
    vllm_api_key: str = "EMPTY"  

    
    summarize_batch_size: int = Field(default=1000, ge=1)  

    summarize_retrieval_k: int = Field(default=8, ge=1, le=128)  

    generation_retrieval_k: int = Field(default=6, ge=1, le=128)  

    
    quizz_default_count: int = Field(default=8, ge=1, le=50)
    flash_card_default_count: int = Field(default=15, ge=1, le=100)
    api_url: str = "http://localhost:8000"
    
    # Cấu hình Re-ranker
    reranker_model: str="BAAI/bge-reranker-large"
    rerank_top_k: int = Field(default=5, ge=1, le=20)
    
    
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