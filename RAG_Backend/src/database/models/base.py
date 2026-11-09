from datetime import datetime

from sqlalchemy import Column, DateTime, Integer
from src.database.connection import Base


class TimestampMixin:
    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )


class BaseModel(Base, TimestampMixin):
    __abstract__ = True
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )
