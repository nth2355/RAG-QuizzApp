from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .base import BaseModel


class Document(BaseModel):
    __tablename__ = "documents"

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    original_filename = Column(
        String,
        nullable=False
    )

    stored_filename = Column(
        String,
        unique=True,
        nullable=False
    )

    status = Column(
        String,
        default="indexed",
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="documents"
    )

    chats = relationship(
        "ChatHistory",
        back_populates="document"
    )

    quizzes = relationship(
        "QuizHistory",
        back_populates="document"
    )

    flashcards = relationship(
        "FlashcardHistory",
        back_populates="document"
    )

    summaries = relationship(
        "SummaryHistory",
        back_populates="document"
    )