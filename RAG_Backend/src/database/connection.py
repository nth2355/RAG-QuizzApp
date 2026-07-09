import os
from sqlalchemy import create_engine
from pathlib import Path
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()
print("Working directory:", Path.cwd())
print(".env exists:", Path(".env").exists())
print("DATABASE_URL:", os.getenv("DATABASE_URL"))

DATABASE_URL = os.getenv("DATABASE_URL")
print("=" * 50)
print("DATABASE_URL =", DATABASE_URL)
print("=" * 50)
engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20)
SessionLocal=sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()