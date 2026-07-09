from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from .base import BaseModel


class SummaryHistory(BaseModel):
    __tablename__ = "summary_history"

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

    summary = Column(
        Text,
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="summaries"
    )

    document = relationship(
        "Document",
        back_populates="summaries"
    )