from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AliasChoices, Field
from typing import Literal
from pydantic import model_validator
from functools import lru_cache
BACKEND_DIR = Path(__file__).resolve().parents[1]

class Settings(BaseSettings):
    #Cấu hình cách load config
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env", BACKEND_DIR / ".env.local"),   # Đọc biến môi trường từ file .env
        env_prefix="RAG_", # Chỉ lấy các biến có prefix RAG_
        extra="ignore"     # Bỏ qua các biến dư không khai báo trong class
    )
    #Đường dẫn dữ liệu
    data_dir: Path = BACKEND_DIR / "data"
    # Thư mục chứa dữ liệu gốc (PDF, TXT, docs...) để ingest vào hệ RAG
    storage_dir: Path = BACKEND_DIR / "storage/qdrant"
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

    summarize_batch_size: int = Field(default=12, ge=1)
    summarize_retrieval_k: int = Field(default=8, ge=1, le=128)
    generation_retrieval_k: int = Field(default=6, ge=1, le=128)


    quiz_default_count: int = Field(default=8, ge=1, le=50, validation_alias=AliasChoices("RAG_QUIZ_DEFAULT_COUNT", "RAG_QUIZZ_DEFAULT_COUNT"))
    flash_card_default_count: int = Field(default=15, ge=1, le=100)
    max_upload_bytes: int = Field(default=25 * 1024 * 1024, ge=1024)
    max_context_chars: int = Field(default=48000, ge=4000)
    database_url: str = Field(default="sqlite:///" + (BACKEND_DIR / "storage/rag.db").as_posix(), validation_alias=AliasChoices("RAG_DATABASE_URL", "DATABASE_URL"))
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    preload_models: bool = False
    api_url: str = "http://localhost:8000"
    # Cấu hình Re-ranker
    reranker_model: str="BAAI/bge-reranker-large"
    rerank_top_k: int = Field(default=5, ge=1, le=20)

    # Cấu hình JWT — đọc từ biến môi trường JWT_SECRET_KEY (không có tiền tố RAG_)
    jwt_secret_key: str = Field(
        validation_alias=AliasChoices("JWT_SECRET_KEY", "RAG_JWT_SECRET_KEY")
    )

# Kiểm tra cấu hình bằng model_validator
    @model_validator(mode="after")
    def validate_config(self) -> "Settings":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        if self.hf_device < -1:
            raise ValueError("hf_device must be -1 for CPU or >= 0 for CUDA.")
        if self.llm_provider == "gemini" and not self.google_api_key:
            raise ValueError("GOOGLE_API_KEY is required when llm_provider='gemini'.")
        if not self.jwt_secret_key:
            raise ValueError("JWT_SECRET_KEY must not be empty.")
        return self

@lru_cache(maxsize=1)
def get_settings()->Settings:
    return Settings()
settings = get_settings()
