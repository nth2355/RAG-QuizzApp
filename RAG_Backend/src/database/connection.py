from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from src.config import settings

DATABASE_URL = settings.database_url
settings.storage_dir.parent.mkdir(parents=True, exist_ok=True)
is_sqlite = DATABASE_URL.startswith("sqlite:")
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    **({"connect_args": {"check_same_thread": False, "timeout": 30}} if is_sqlite else {"pool_size": 10, "max_overflow": 20}),
)
if is_sqlite:
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
