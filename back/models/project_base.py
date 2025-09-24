import uuid
from datetime import date, datetime
from sqlalchemy import (
    Column, String, Integer, Text, Date, DateTime, ForeignKey, Enum,
    Boolean, JSON, Index, func, Float
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base

# =====================================================================
# 既存：Member / ProjectBase / ProjectMember / ProjectDocument（最小差分）
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
    start_date = Column(DateTime,  nullable=False)
    end_date   = Column(DateTime, nullable=False)
    num_people = Column(Integer, nullable=False)

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


# =========================
# NEW: Task / TaskAssignment
# =========================
TaskStatusEnum = Enum("TODO", "DOING", "DONE", name="task_status_enum")
PriorityEnum   = Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="priority_enum")

class Task(Base):
    __tablename__ = "task"

    task_id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id", ondelete="CASCADE"),
                          nullable=False, index=True)
    title        = Column(String, nullable=False)
    description  = Column(Text, nullable=True)
    detail       = Column(Text, nullable=True)  # Enhanced: Stores comprehensive task information as JSON
    status       = Column(TaskStatusEnum, nullable=False, default="TODO")
    priority     = Column(PriorityEnum,   nullable=False, default="MEDIUM")

    # Enhanced: Timeline and scheduling fields
    planned_start_date = Column(DateTime(timezone=True), nullable=True)  # 計画開始日
    planned_end_date   = Column(DateTime(timezone=True), nullable=True)  # 計画終了日
    actual_start_date  = Column(DateTime(timezone=True), nullable=True)  # 実際の開始日
    actual_end_date    = Column(DateTime(timezone=True), nullable=True)  # 実際の終了日
    due_at             = Column(DateTime(timezone=True), nullable=True)  # 期限

    # Enhanced: Task ordering and dependencies
    topological_order  = Column(Integer, nullable=True, index=True)  # トポロジカルソート順序
    execution_phase    = Column(String, nullable=True, index=True)   # 実行フェーズ (setup/development/testing/deployment)
    parallel_group_id  = Column(String, nullable=True, index=True)   # 並列実行グループID
    critical_path      = Column(Boolean, default=False, nullable=False, index=True)  # クリティカルパス上のタスクか

    # Enhanced: Additional fields for comprehensive task management
    category     = Column(String, nullable=True)  # frontend/backend/database/devops/testing/documentation
    estimated_hours = Column(Integer, nullable=True)  # Realistic time estimate
    complexity_level = Column(Integer, nullable=True)  # 1-5 scale
    business_value_score = Column(Integer, nullable=True)  # 1-10 scale
    technical_risk_score = Column(Integer, nullable=True)  # 1-10 scale
    implementation_difficulty = Column(Integer, nullable=True)  # 1-10 scale
    user_impact_score = Column(Integer, nullable=True)  # 1-10 scale
    dependency_weight = Column(Integer, nullable=True)  # 1-10 scale
    moscow_priority = Column(String, nullable=True)  # Must/Should/Could/Won't
    mvp_critical = Column(Boolean, default=False, nullable=False)  # Is this critical for MVP?

    # Enhanced: Progress tracking
    progress_percentage = Column(Integer, default=0, nullable=False)  # 進捗率 (0-100)
    blocking_reason     = Column(Text, nullable=True)  # ブロッキング理由
    completion_criteria = Column(Text, nullable=True)  # 完了基準

    # Enhanced: Educational and reference information
    learning_resources  = Column(JSON, nullable=True)  # 学習リソースJSON
    technology_stack    = Column(JSON, nullable=True)  # 使用技術スタックJSON
    reference_links     = Column(JSON, nullable=True)  # 参考リンクJSON

    # Enhanced: Metadata fields
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # どのドキュメントから生まれたタスクか（任意）
    source_doc_id = Column(UUID(as_uuid=True), ForeignKey("projectDocument.doc_id", ondelete="SET NULL"),
                           nullable=True)
    source_doc = relationship("ProjectDocument", back_populates="tasks")

    # 割当（M:N）
    assignees = relationship(
        "TaskAssignment",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    project = relationship("ProjectBase", back_populates="tasks")

    # Enhanced: Multiple dependency relationships
    dependencies = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.dependent_task_id",
        back_populates="dependent_task",
        cascade="all, delete-orphan",
    )

    dependents = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.prerequisite_task_id",
        back_populates="prerequisite_task",
        cascade="all, delete-orphan",
    )

    # __table_args__ = (
    #     Index("ix_task_due_at", "due_at"),
    #     Index("ix_task_project_status", "project_id", "status"),
    #     Index("ix_task_priority", "priority"),
    #     Index("ix_task_category", "category"),
    #     Index("ix_task_moscow_priority", "moscow_priority"),
    #     Index("ix_task_mvp_critical", "mvp_critical"),
    #     Index("ix_task_complexity", "complexity_level"),
    #     Index("ix_task_business_value", "business_value_score"),
    #     Index("ix_task_topological_order", "project_id", "topological_order"),
    #     Index("ix_task_execution_phase", "project_id", "execution_phase"),
    #     Index("ix_task_parallel_group", "project_id", "parallel_group_id"),
    #     Index("ix_task_critical_path", "project_id", "critical_path"),
    #     Index("ix_task_timeline", "planned_start_date", "planned_end_date"),
    #     Index("ix_task_progress", "progress_percentage"),
    # )

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
# NEW: TaskDependency (複雑な依存関係管理)
# =========================
DependencyTypeEnum = Enum("FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "START_TO_FINISH", name="dependency_type_enum")

class TaskDependency(Base):
    __tablename__ = "taskDependency"

    dependency_id       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id          = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    prerequisite_task_id = Column(UUID(as_uuid=True), ForeignKey("task.task_id", ondelete="CASCADE"),
                                  nullable=False, index=True)
    dependent_task_id   = Column(UUID(as_uuid=True), ForeignKey("task.task_id", ondelete="CASCADE"),
                                 nullable=False, index=True)

    # Enhanced: Dependency properties
    dependency_type     = Column(DependencyTypeEnum, nullable=False, default="FINISH_TO_START")
    lag_time_hours     = Column(Integer, default=0, nullable=False)  # 遅延時間（時間単位）
    dependency_strength = Column(Integer, default=5, nullable=False)  # 依存関係の強さ (1-10)
    is_critical        = Column(Boolean, default=False, nullable=False)  # クリティカルパス上の依存関係か
    notes              = Column(Text, nullable=True)  # 依存関係の説明

    # Enhanced: AI analysis results
    ai_confidence      = Column(Float, nullable=True)  # AI分析の信頼度 (0.0-1.0)
    auto_detected      = Column(Boolean, default=False, nullable=False)  # AI自動検出か手動設定か
    violation_risk     = Column(Integer, nullable=True)  # 依存関係違反リスク (1-10)

    # Metadata
    created_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at         = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    prerequisite_task = relationship(
        "Task",
        foreign_keys=[prerequisite_task_id],
        back_populates="dependents"
    )
    dependent_task = relationship(
        "Task",
        foreign_keys=[dependent_task_id],
        back_populates="dependencies"
    )

    __table_args__ = (
        # 同じタスク間の重複依存関係を防ぐ
        Index("ux_task_dependency_unique", "prerequisite_task_id", "dependent_task_id", "dependency_type", unique=True),
        Index("ix_dependency_project", "project_id"),
        Index("ix_dependency_critical", "is_critical"),
        Index("ix_dependency_strength", "dependency_strength"),
        Index("ix_dependency_type", "dependency_type"),
    )

    def __repr__(self):
        return f"<TaskDependency(prerequisite={self.prerequisite_task_id}, dependent={self.dependent_task_id})>"


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