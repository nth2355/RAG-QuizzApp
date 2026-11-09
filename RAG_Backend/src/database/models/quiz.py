from sqlalchemy import Column, ForeignKey, Integer, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .base import BaseModel


class QuizHistory(BaseModel):
    __tablename__ = "quiz_history"

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

    quiz_data = Column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False
    )

    score = Column(
        Integer,
        nullable=True
    )

    owner = relationship(
        "User",
        back_populates="quizzes"
    )

    document = relationship(
        "Document",
        back_populates="quizzes"
    )
