from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .base import BaseModel


class FlashcardHistory(BaseModel):
    __tablename__ = "flashcard_history"

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True
    )

    flashcards_data = Column(
        JSONB,
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="flashcards"
    )

    document = relationship(
        "Document",
        back_populates="flashcards"
    )