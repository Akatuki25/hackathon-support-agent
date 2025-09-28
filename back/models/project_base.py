import uuid
from datetime import date, datetime
from sqlalchemy import (
    Column, String, Integer, Text, Date, DateTime, ForeignKey, Enum,
    Boolean, JSON, Index, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base

# =====================================================================
# 既存：Member / ProjectBase / ProjectMember
# =====================================================================

# ---------- Member -----------------------------------------------------------
class MemberBase(Base):
    __tablename__ = "member"

    member_id     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_name   = Column(String,  nullable=False)
    member_skill  = Column(String,  nullable=False)
    github_name   = Column(String,  nullable=False)
    # NEW: Stripe 顧客作成や通知に備えて（NULL可でOK）
    email         = Column(String,  nullable=True, index=True)

    projects = relationship(
        "ProjectMember",
        back_populates="member_base",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<Member(id={self.member_id}, name={self.member_name})>"


# ---------- Project ----------------------------------------------------------
class ProjectBase(Base):
    __tablename__ = "projectBase"

    project_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title      = Column(String, nullable=False)
    idea       = Column(String, nullable=False)
    start_date = Column(Date,  nullable=False)
    end_date   = Column(DateTime, nullable=False)

    # Relations
    document = relationship(
        "ProjectDocument",
        back_populates="project_base",
        uselist=False,
        cascade="all, delete-orphan",
    )
    members = relationship(
        "ProjectMember",
        back_populates="project_base",
        cascade="all, delete-orphan",
    )

    # NEW: ENV / TASK と紐づけ
    envs = relationship(
        "Env",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    tasks = relationship(
        "Task",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    # NEW: QA と紐づけ
    qas = relationship(
        "QA",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    def __repr__(self):
        return f"<Project(id={self.project_id}, title={self.title})>"


# ---------- Project–Member link ---------------------------------------------
class ProjectMember(Base):
    __tablename__ = "projectMember"

    project_member_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id        = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id"), nullable=False, index=True)
    member_id         = Column(UUID(as_uuid=True), ForeignKey("member.member_id"),      nullable=False, index=True)
    member_name       = Column(String, nullable=False)

    project_base = relationship("ProjectBase", back_populates="members")
    member_base  = relationship("MemberBase",  back_populates="projects")

    # NEW: タスク割当（中間テーブル経由）
    task_assignments = relationship(
        "TaskAssignment",
        back_populates="project_member",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        # 同じプロジェクトに同じMemberを二重追加しない
        Index("ux_project_member_unique", "project_id", "member_id", unique=True),
    )

    def __repr__(self):
        return f"<ProjectMember(id={self.project_member_id}, project_id={self.project_id})>"


# ---------- Project document -------------------------------------------------
class ProjectDocument(Base):
    __tablename__ = "projectDocument"

    doc_id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id", ondelete="CASCADE"), nullable=False, index=True)
    specification      = Column(Text, nullable=False) # 要件定義
    function_doc  = Column(Text, nullable=False) # 機能要件定義書
    frame_work_doc     = Column(Text, nullable=False) # フレームワーク
    directory_info     = Column(Text, nullable=False) # ディレクトリ構成

    project_base = relationship("ProjectBase", back_populates="document")
    # NEW: Referenced by Tasks and QAs
    tasks = relationship("Task", back_populates="source_doc")
    qas = relationship("QA", back_populates="source_doc")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self):
        return f"<ProjectDocument(id={self.doc_id}, project_id={self.project_id})>"


# =========================
# NEW: ENV（環境情報）
# =========================
class Env(Base):
    __tablename__ = "env"

    env_id     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id", ondelete="CASCADE"),
                        nullable=False, index=True)
    front        = Column(String, nullable=True)        # 例: Next.js/Tailwind
    backend      = Column(String, nullable=True)        # 例: FastAPI
    devcontainer = Column(String, nullable=True)        # 例: .devcontainer の説明やパス
    database     = Column(String, nullable=True)        # 例: PostgreSQL
    deploy       = Column(String, nullable=True)        # 例: Vercel/Fly.io
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("ProjectBase", back_populates="envs")

    def __repr__(self):
        return f"<Env(id={self.env_id}, project_id={self.project_id})>"


# ===================== 
#  DocumentのDecording 
# =====================

class AIDocument(Base):
    __tablename__ = "aiDocument"
    
    ai_doc_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id", ondelete="CASCADE"), nullable=False, index=True)
    environment = Column(Text, nullable=True)  # 環境構築サマリ
    front_end = Column(Text, nullable=True)  # フロントエンドのAI生成ドキュメント
    back_end = Column(Text, nullable=True)  # バックエンドのAI生成ドキュメント
    database = Column(Text, nullable=True)  # データベースのAI生成ドキュメント
    deployment = Column(Text, nullable=True)  # デプロイメントのAI生成ドキュメント
    ai_design = Column(Text, nullable=True)  # AI設計のAI生成ドキュメント
    slide = Column(Text, nullable=True)  # スライド資料作成サマリ

# =========================
# NEW: Task / TaskAssignment
# =========================
TaskStatusEnum = Enum("TODO", "DOING", "DONE", name="task_status_enum")

class Task(Base):
    __tablename__ = "task"

    task_id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id", ondelete="CASCADE"),
                          nullable=False, index=True)
    title        = Column(String, nullable=False)
    description  = Column(Text, nullable=True)
    detail       = Column(Text, nullable=True)  # 追加の詳細フィールド
    priority     = Column(String, nullable=True)  # Must/Should/Could などの優先度
    status       = Column(TaskStatusEnum, nullable=False, default="TODO")
    due_at       = Column(DateTime(timezone=True), nullable=True)

    # 自己参照依存
    depends_on_task_id = Column(UUID(as_uuid=True), ForeignKey("task.task_id", ondelete="SET NULL"),
                                nullable=True)
    depends_task = relationship("Task", remote_side="Task.task_id", uselist=False)

    # 割当（M:N）
    assignees = relationship(
        "TaskAssignment",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    project = relationship("ProjectBase", back_populates="tasks")

    __table_args__ = (
        Index("ix_task_due_at", "due_at"),
        Index("ix_task_project_status", "project_id", "status"),
        Index("ix_task_priority", "priority"),
    )

    def __repr__(self):
        return f"<Task(id={self.task_id}, project_id={self.project_id}, title={self.title})>"


class TaskAssignment(Base):
    __tablename__ = "taskAssignment"

    task_assignment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id            = Column(UUID(as_uuid=True), ForeignKey("task.task_id", ondelete="CASCADE"),
                                nullable=False, index=True)
    project_member_id  = Column(UUID(as_uuid=True), ForeignKey("projectMember.project_member_id", ondelete="CASCADE"),
                                nullable=False, index=True)
    assigned_at        = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    role               = Column(String, nullable=True)  # "owner" / "contrib" など

    task = relationship("Task", back_populates="assignees")
    project_member = relationship("ProjectMember", back_populates="task_assignments")

    __table_args__ = (
        # 同一タスクに同一ProjectMemberの二重割当を禁止
        Index("ux_task_member_unique", "task_id", "project_member_id", unique=True),
    )

    def __repr__(self):
        return f"<TaskAssignment(task_id={self.task_id}, project_member_id={self.project_member_id})>"


# =========================
# NEW: QA
# =========================
class QA(Base):
    __tablename__ = "qa"

    qa_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # About which project
    project_id = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id", ondelete="CASCADE"), nullable=False, index=True)

    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    is_ai = Column(Boolean, default=False, nullable=False)

    # Referenced from which document (optional)
    source_doc_id = Column(UUID(as_uuid=True), ForeignKey("projectDocument.doc_id", ondelete="SET NULL"), nullable=True)

    # Follow-up from which QA (optional)
    follows_qa_id = Column(UUID(as_uuid=True), ForeignKey("qa.qa_id", ondelete="SET NULL"), nullable=True)
    
    importance = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    project = relationship("ProjectBase", back_populates="qas")
    source_doc = relationship("ProjectDocument", back_populates="qas")

    parent_qa = relationship("QA", remote_side=[qa_id], back_populates="follow_ups", foreign_keys=[follows_qa_id])
    follow_ups = relationship("QA", back_populates="parent_qa")

    def __repr__(self):
        return f"<QA(id={self.qa_id}, project_id={self.project_id})>"
