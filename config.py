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
    llm_provider: Literal["hf_local", "gemini", "vllm"] = "hf_local"
    
    #Tham số độ sáng tạo của model(0.0: Cực kì chính xác, 0.1->0.3 RAG hay dùng)
    llm_temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    
    
    
    
    hf_model: str = "/mnt/pretrained_fm/Qwen_Qwen3-4B-Instruct-2507"  
    # Đường dẫn tới model LLM local (HuggingFace)
    # → quyết định “bộ não” dùng để sinh câu trả lời

    hf_device: int = 1  
    # Thiết bị chạy model
    # -1 = CPU, 0 = GPU0, 1 = GPU1
    # → chọn đúng GPU để tăng tốc inference

    hf_max_new_tokens: int = Field(default=2048, ge=1)  
    # Số token tối đa model được phép sinh ra
    # ≥ 1 để tránh giá trị vô nghĩa
    # → càng lớn: câu trả lời càng dài nhưng chậm hơn
    
    
    gemini_model: str = "gemini-2.5-flash"  
    # Tên model Gemini sẽ dùng
    # → "flash" = nhanh, rẻ, phù hợp RAG (trả lời nhanh)
    # → có thể đổi sang model mạnh hơn nếu cần chất lượng cao

    google_api_key: str | None = Field(default=None, validation_alias="GOOGLE_API_KEY")  
    # API key để gọi Gemini
    # None = mặc định chưa có (phải cung cấp từ môi trường)
    # validation_alias="GOOGLE_API_KEY" → map với biến môi trường GOOGLE_API_KEY
    # → ví dụ: export GOOGLE_API_KEY=xxxx
    
    
    
    
    vllm_api_base: str = "http://localhost:8001/v1"  
    # Địa chỉ API của server vLLM
    # → "localhost:8001" = server đang chạy trên máy bạn, port 8001
    # → "/v1" = endpoint chuẩn kiểu OpenAI API
    # → dùng để gửi request generate text tới model

    vllm_api_key: str = "EMPTY"  
    # API key để authenticate (nếu server yêu cầu)
    # → "EMPTY" thường dùng khi chạy local và không bật auth
    # → nếu deploy thật, nên thay bằng key bảo mật
    
    
    
    
    
    summarize_batch_size: int = Field(default=10, ge=1)  
    # Số chunk xử lý cùng lúc khi tóm tắt (batch size)
    # ≥ 1 để đảm bảo hợp lệ
    # → càng lớn: nhanh hơn (do batch), nhưng tốn RAM/VRAM hơn

    summarize_retrieval_k: int = Field(default=12, ge=1, le=128)  
    # Số chunk được lấy ra để PHỤC VỤ bước tóm tắt
    # (trước khi tạo câu trả lời cuối)
    # → càng lớn: tóm tắt đầy đủ hơn, nhưng dễ nhiễu + chậm

    generation_retrieval_k: int = Field(default=16, ge=1, le=128)  
    # Số chunk được lấy ra để TẠO câu trả lời cuối cùng
    # (sau khi đã xử lý/tóm tắt)
    # → quyết định lượng thông tin model dùng để trả lời
    
    
    
    
    
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