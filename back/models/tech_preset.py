"""
技術選定プリセットモデル

技術領域（TechDomain）と技術スタック（TechStack）を管理するマスタテーブル。
LLMが勝手に技術を決定しないよう、選択肢をDBで管理するためのモデル。
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean, JSON, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base


class TechDomain(Base):
    """
    技術領域（意思決定ポイント）

    例: ORM、マイグレーション、認証方式など
    """
    __tablename__ = "tech_domains"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="領域キー（orm_python, auth_method等）"
    )
    name = Column(
        String(100),
        nullable=False,
        comment="表示名（ORMライブラリ等）"
    )
    description = Column(
        Text,
        nullable=True,
        comment="領域の説明（1-2文）"
    )
    decision_prompt = Column(
        Text,
        nullable=False,
        comment="技術選定時の質問文"
    )
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="有効フラグ"
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        nullable=False,
        comment="作成日時"
    )

    # Relations
    stacks = relationship(
        "TechStack",
        back_populates="domain",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<TechDomain(key={self.key}, name={self.name})>"


class TechStack(Base):
    """
    技術スタック（具体的な技術）

    例: SQLAlchemy, JWT, Alembicなど
    """
    __tablename__ = "tech_stacks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tech_domains.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="所属領域ID"
    )
    key = Column(
        String(50),
        nullable=False,
        comment="スタックキー（sqlalchemy, jwt等）"
    )
    label = Column(
        String(100),
        nullable=False,
        comment="表示名（SQLAlchemy等）"
    )
    ecosystem = Column(
        String(50),
        nullable=True,
        index=True,
        comment="エコシステム（python, next.js等、NULL=全共通）"
    )
    summary = Column(
        Text,
        nullable=False,
        comment="特徴・思想（1-2文）"
    )
    pros = Column(
        JSON,
        nullable=False,
        default=list,
        comment="メリット配列"
    )
    cons = Column(
        JSON,
        nullable=False,
        default=list,
        comment="デメリット配列"
    )
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="有効フラグ"
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        nullable=False,
        comment="作成日時"
    )

    # Relations
    domain = relationship("TechDomain", back_populates="stacks")

    # Constraints
    __table_args__ = (
        UniqueConstraint("domain_id", "key", name="uq_tech_stack_domain_key"),
        Index("ix_tech_stack_domain_ecosystem", "domain_id", "ecosystem"),
    )

    def __repr__(self):
        return f"<TechStack(key={self.key}, label={self.label})>"
