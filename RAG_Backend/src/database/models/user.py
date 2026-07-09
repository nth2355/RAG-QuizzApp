from sqlalchemy import Column, String, Integer
from sqlalchemy.orm import relationship
from src.database.connection import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    full_name = Column(
        String,
        nullable=False
    )

    hashed_password = Column(
        String,
        nullable=False
    )

    role = Column(
        String,
        default="student",
        nullable=False
    )

    documents = relationship(
        "Document",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    chats = relationship(
        "ChatHistory",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    quizzes = relationship(
        "QuizHistory",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    flashcards = relationship(
        "FlashcardHistory",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    summaries = relationship(
        "SummaryHistory",
        back_populates="owner",
        cascade="all, delete-orphan"
    )