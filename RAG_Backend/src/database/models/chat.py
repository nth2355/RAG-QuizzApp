from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from .base import BaseModel


class ChatHistory(BaseModel):
    __tablename__ = "chat_history"

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

    question = Column(
        Text,
        nullable=False
    )

    answer = Column(
        Text,
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="chats"
    )

    document = relationship(
        "Document",
        back_populates="chats"
    )