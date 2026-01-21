import uuid
from datetime import date, datetime
from sqlalchemy import (
    Column, String, Integer, Text, Date, DateTime, ForeignKey, Enum,
    Boolean, JSON, Index, func, Float, UniqueConstraint, CheckConstraint
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
    # NEW: Structured Functions と紐づけ
    structured_functions = relationship(
        "StructuredFunction",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    # 仕様変更リクエストシステム
    change_requests = relationship(
        "ChangeRequest",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    document_chunks = relationship(
        "DocumentChunk",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    hands_on_jobs = relationship(
        "HandsOnGenerationJob",
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
    structured_functions = relationship("StructuredFunction", back_populates="source_doc")
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
    source_doc_id = Column(UUID(as_uuid=True), ForeignKey("projectDocument.doc_id", ondelete="SET NULL"), nullable=True)
    title        = Column(String, nullable=False)
    description  = Column(Text, nullable=True)
    detail       = Column(Text, nullable=True)  # 追加の詳細フィールド
    priority     = Column(String, nullable=True)  # Must/Should/Could などの優先度
    status       = Column(TaskStatusEnum, nullable=False, default="TODO")
    due_at       = Column(DateTime(timezone=True), nullable=True)
    
    # ReactFlow表示用の追加フィールド
    node_id      = Column(String(20), nullable=True)     # 'start', 'n1', 'n2'など
    category     = Column(String(50), nullable=True)     # '環境構築', 'DB設計'など  
    start_time   = Column(String(10), nullable=True)     # '09:00'形式
    estimated_hours = Column(Float, nullable=True)       # 2.5など
    assignee     = Column(String(50), nullable=True)     # 'エンジニア', 'デザイナー'など
    completed    = Column(Boolean, default=False, nullable=False)
    position_x   = Column(Integer, nullable=True)        # X座標
    position_y   = Column(Integer, nullable=True)        # Y座標
    function_id  = Column(UUID(as_uuid=True), nullable=True)  # 機能ID（StructuredFunctionとの関連）

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
    source_doc = relationship("ProjectDocument", back_populates="tasks")
    function_mappings = relationship("FunctionToTaskMapping", back_populates="task", cascade="all, delete-orphan")
    
    # 依存関係（新規）
    dependencies_from = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.source_task_id",
        back_populates="source_task",
        cascade="all, delete-orphan"
    )
    dependencies_to = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.target_task_id",
        back_populates="target_task",
        cascade="all, delete-orphan"
    )

    # Phase 3: ハンズオン（1:1）
    hands_on = relationship(
        "TaskHandsOn",
        back_populates="task",
        uselist=False,
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_task_due_at", "due_at"),
        Index("ix_task_project_status", "project_id", "status"),
        Index("ix_task_priority", "priority"),
        Index("ix_task_node_id", "node_id"),
        Index("ix_task_category", "category"),
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


# =========================
# NEW: Structured Functions
# =========================
class StructuredFunction(Base):
    __tablename__ = "structured_functions"
    
    function_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 基本情報（必須）
    function_code = Column(String(20), nullable=False)  # F001, F002
    function_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    
    # 分類（シンプル）
    category = Column(String(50))  # 'auth', 'data', 'logic', 'ui', 'api', 'deployment'
    
    # 優先度（既存Taskと統一）
    priority = Column(String(10))
    
    # 元ドキュメントとの関連
    source_doc_id = Column(UUID(as_uuid=True), ForeignKey("projectDocument.doc_id", ondelete="SET NULL"), nullable=True)
    
    # 抽出メタデータ
    extraction_confidence = Column(Float, default=0.8)
    order_index = Column(Integer)  # 元テキストでの出現順序
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    project = relationship("ProjectBase", back_populates="structured_functions")
    source_doc = relationship("ProjectDocument", back_populates="structured_functions")
    dependencies_from = relationship("FunctionDependency", foreign_keys="FunctionDependency.from_function_id", cascade="all, delete-orphan")
    dependencies_to = relationship("FunctionDependency", foreign_keys="FunctionDependency.to_function_id", cascade="all, delete-orphan")
    task_mappings = relationship("FunctionToTaskMapping", back_populates="function", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint("priority IN ('Must', 'Should', 'Could', 'Wont')"),
        CheckConstraint("category IN ('auth', 'data', 'logic', 'ui', 'api', 'deployment')"),
        UniqueConstraint('project_id', 'function_code'),
    )
    
    def __repr__(self):
        return f"<StructuredFunction(id={self.function_id}, code={self.function_code}, name={self.function_name})>"


class FunctionDependency(Base):
    __tablename__ = "function_dependencies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_function_id = Column(UUID(as_uuid=True), ForeignKey("structured_functions.function_id", ondelete="CASCADE"), nullable=False)
    to_function_id = Column(UUID(as_uuid=True), ForeignKey("structured_functions.function_id", ondelete="CASCADE"), nullable=False)
    dependency_type = Column(String(20), default='requires')
    
    __table_args__ = (
        UniqueConstraint('from_function_id', 'to_function_id'),
    )
    
    def __repr__(self):
        return f"<FunctionDependency(from={self.from_function_id}, to={self.to_function_id})>"


class FunctionToTaskMapping(Base):
    __tablename__ = "function_to_task_mapping"
    
    mapping_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    function_id = Column(UUID(as_uuid=True), ForeignKey("structured_functions.function_id", ondelete="CASCADE"), nullable=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("task.task_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    function = relationship("StructuredFunction", back_populates="task_mappings")
    task = relationship("Task", back_populates="function_mappings")
    
    __table_args__ = (
        UniqueConstraint('function_id', 'task_id'),
    )
    
    def __repr__(self):
        return f"<FunctionToTaskMapping(function_id={self.function_id}, task_id={self.task_id})>"


# =========================
# NEW: TaskDependency (ReactFlow Edge)
# =========================
class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    edge_id = Column(String(50), nullable=False)  # 'start-n1', 'n1-n2'など
    source_task_id = Column(UUID(as_uuid=True), ForeignKey("task.task_id", ondelete="CASCADE"), nullable=False)
    target_task_id = Column(UUID(as_uuid=True), ForeignKey("task.task_id", ondelete="CASCADE"), nullable=False)
    source_node_id = Column(String(20), nullable=False)  # 'start', 'n1'など
    target_node_id = Column(String(20), nullable=False)  # 'n1', 'n2'など
    is_animated = Column(Boolean, default=True, nullable=False)
    is_next_day = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    source_task = relationship("Task", foreign_keys=[source_task_id], back_populates="dependencies_from")
    target_task = relationship("Task", foreign_keys=[target_task_id], back_populates="dependencies_to")
    
    __table_args__ = (
        UniqueConstraint('source_task_id', 'target_task_id'),
        Index("ix_task_dependency_edge_id", "edge_id"),
    )
    
    def __repr__(self):
        return f"<TaskDependency(edge_id={self.edge_id}, source={self.source_node_id}, target={self.target_node_id})>"


# =========================
# Phase 3: Task Hands-On Generation
# =========================

class TaskHandsOn(Base):
    """タスク詳細ハンズオンテーブル（Phase 3）"""
    __tablename__ = "task_hands_on"

    # Primary Key
    hands_on_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Key (1:1 unique)
    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("task.task_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    # ========================================
    # ハンズオンセクション（すべてオプショナル）
    # 細粒度タスクに特化した最小限の構成
    # ========================================

    # 1. 概要（タスクの目的と達成目標）
    overview = Column(Text, nullable=True, comment="このタスクで何を実装するか、なぜ必要か")

    # 2. 前提条件（このタスクを始める前に必要なもの）
    prerequisites = Column(Text, nullable=True, comment="必要なパッケージ、事前に完了すべき依存タスク、環境設定")

    # 3. 実装対象ファイル
    target_files = Column(JSON, nullable=True, comment="作成・修正するファイルのリスト [{path, action, description}]")

    # 4. 実装手順（メインコンテンツ）
    implementation_steps = Column(Text, nullable=True, comment="ステップバイステップの実装手順（Markdown形式）")

    # 5. コード例
    code_examples = Column(JSON, nullable=True, comment="実際に動作するコード例 [{file, language, code, explanation}]")

    # 6. 動作確認
    verification = Column(Text, nullable=True, comment="実装後の動作確認方法・期待される結果")

    # 7. よくあるエラー
    common_errors = Column(JSON, nullable=True, comment="典型的なエラーと解決方法 [{error, cause, solution}]")

    # 8. 参考資料
    references = Column(JSON, nullable=True, comment="公式ドキュメント、記事などのURL [{title, url, type, relevance}]")

    # ========================================
    # 教育コンテンツ（実装に関連する周辺知識）
    # ========================================

    # 9. 技術的背景
    technical_context = Column(Text, nullable=True, comment="このタスクで使う技術・概念の簡潔な説明")

    # 10. 実装のポイント
    implementation_tips = Column(JSON, nullable=True, comment="ベストプラクティス、アンチパターン [{tip, reason, type}]")

    # ========================================
    # メタデータ・品質管理
    # ========================================

    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 生成バージョン
    generation_version = Column(String(20), default="1.0", nullable=False)

    # 生成に使用したモデル
    generation_model = Column(String(50), nullable=True, comment="使用AIモデル")

    # ユーザー編集フラグ
    is_user_edited = Column(Boolean, default=False, nullable=False)

    # 品質スコア（WebSearch検証後）
    quality_score = Column(Float, nullable=True, comment="0.0-1.0の品質スコア")

    # 情報鮮度（検索時の最新ドキュメント日付）
    information_freshness = Column(Date, nullable=True, comment="参照した情報の最新日付")

    # ========================================
    # Web検索メタデータ
    # ========================================

    # 検索クエリ履歴
    search_queries = Column(JSON, nullable=True, comment="実行した検索クエリのリスト")

    # 参照したURL
    referenced_urls = Column(JSON, nullable=True, comment="参照した公式ドキュメント・記事のURL")

    # 齟齬検証結果
    verification_result = Column(JSON, nullable=True, comment="情報齟齬検証の詳細結果")

    # ========================================
    # インタラクティブ生成用フィールド
    # ========================================

    # 生成モード: "batch"（一括生成）or "interactive"（対話型）
    generation_mode = Column(
        Enum("batch", "interactive", name="generation_mode_enum"),
        default="batch",
        nullable=False,
        comment="生成モード"
    )

    # 生成状態: "pending", "generating", "waiting_input", "completed"
    generation_state = Column(
        Enum("pending", "generating", "waiting_input", "completed", name="generation_state_enum"),
        default="pending",
        nullable=False,
        comment="生成状態"
    )

    # ユーザーの選択・入力履歴
    user_interactions = Column(
        JSON,
        nullable=True,
        comment="ユーザーの選択・入力履歴 [{type, choice_id, selected, user_note}]"
    )

    # セッションID（インタラクティブ生成時）
    session_id = Column(
        String(50),
        nullable=True,
        index=True,
        comment="インタラクティブ生成セッションID"
    )

    # 実装済みリソースサマリー（タスク完了時に生成）
    # 他のタスクが重複実装を避けるための参照用
    implementation_resources = Column(
        JSON,
        nullable=True,
        comment="実装済みリソース {apis: [], components: [], services: [], summary: str}"
    )

    # ========================================
    # リレーション
    # ========================================

    task = relationship("Task", back_populates="hands_on", uselist=False)

    # ========================================
    # インデックス
    # ========================================

    __table_args__ = (
        Index("ix_hands_on_task_id", "task_id"),
        Index("ix_hands_on_generated_at", "generated_at"),
        Index("ix_hands_on_quality_score", "quality_score"),
    )

    def __repr__(self):
        return f"<TaskHandsOn(task_id={self.task_id}, quality={self.quality_score})>"

    def to_markdown(self) -> str:
        """セクションを結合してMarkdown全文を生成"""
        sections = []

        if self.overview:
            sections.append(f"# 概要\n\n{self.overview}")

        if self.prerequisites:
            sections.append(f"## 前提条件\n\n{self.prerequisites}")

        if self.target_files:
            sections.append(f"## 実装対象ファイル\n\n{self._format_target_files()}")

        if self.implementation_steps:
            sections.append(f"## 実装手順\n\n{self.implementation_steps}")

        if self.code_examples:
            sections.append(f"## コード例\n\n{self._format_code_examples()}")

        if self.verification:
            sections.append(f"## 動作確認\n\n{self.verification}")

        if self.common_errors:
            sections.append(f"## よくあるエラー\n\n{self._format_common_errors()}")

        if self.technical_context:
            sections.append(f"## 技術的背景\n\n{self.technical_context}")

        if self.implementation_tips:
            sections.append(f"## 実装のポイント\n\n{self._format_implementation_tips()}")

        if self.references:
            sections.append(f"## 参考資料\n\n{self._format_references()}")

        return "\n\n---\n\n".join(sections)

    def _format_target_files(self) -> str:
        """実装対象ファイルをMarkdown形式で整形"""
        if not self.target_files:
            return ""

        lines = []
        for file_info in self.target_files:
            action_emoji = "📝" if file_info["action"] == "modify" else "✨"
            lines.append(f"- {action_emoji} `{file_info['path']}` ({file_info['action']})")
            if file_info.get('description'):
                lines.append(f"  - {file_info['description']}")

        return "\n".join(lines)

    def _format_code_examples(self) -> str:
        """コード例をMarkdown形式で整形"""
        if not self.code_examples:
            return ""

        lines = []
        for example in self.code_examples:
            lines.append(f"### {example.get('file', 'コード例')}\n")
            if example.get('explanation'):
                lines.append(f"{example['explanation']}\n")
            lines.append(f"```{example.get('language', 'python')}")
            lines.append(example['code'])
            lines.append("```\n")

        return "\n".join(lines)

    def _format_common_errors(self) -> str:
        """よくあるエラーをMarkdown形式で整形"""
        if not self.common_errors:
            return ""

        lines = []
        for i, error_info in enumerate(self.common_errors, 1):
            lines.append(f"### エラー {i}: {error_info['error']}\n")
            lines.append(f"**原因**: {error_info['cause']}\n")
            lines.append(f"**解決方法**:\n{error_info['solution']}\n")

        return "\n".join(lines)

    def _format_implementation_tips(self) -> str:
        """実装のポイントをMarkdown形式で整形"""
        if not self.implementation_tips:
            return ""

        lines = []
        for tip_info in self.implementation_tips:
            tip_type = tip_info.get('type', 'best_practice')
            emoji = "✅" if tip_type == "best_practice" else "⚠️"
            lines.append(f"{emoji} **{tip_info['tip']}**")
            lines.append(f"  - {tip_info['reason']}\n")

        return "\n".join(lines)

    def _format_references(self) -> str:
        """参考資料をMarkdown形式で整形"""
        if not self.references:
            return ""

        lines = []
        for ref in self.references:
            ref_type = ref.get('type', 'docs')
            type_emoji = "📚" if ref_type == "docs" else "📝"
            lines.append(f"- {type_emoji} [{ref['title']}]({ref['url']})")
            if ref.get('relevance'):
                lines.append(f"  - {ref['relevance']}")

        return "\n".join(lines)


class HandsOnGenerationJob(Base):
    """ハンズオン生成ジョブ管理テーブル"""
    __tablename__ = "hands_on_generation_job"

    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id"), nullable=False)

    # ジョブステータス
    status = Column(
        Enum("queued", "processing", "completed", "failed", "cancelled", name="job_status_enum"),
        default="queued",
        nullable=False
    )

    # 進捗情報
    total_tasks = Column(Integer, nullable=False, default=0)
    completed_tasks = Column(Integer, default=0, nullable=False)
    failed_tasks = Column(Integer, default=0, nullable=False)

    # 現在処理中のタスク
    current_processing = Column(JSON, nullable=True, comment="現在処理中のタスクIDリスト")

    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # エラー情報
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True)

    # 設定
    config = Column(JSON, nullable=True, comment="生成設定（並列数、モデル等）")

    # Relationships
    project = relationship("ProjectBase", back_populates="hands_on_jobs")

    __table_args__ = (
        Index("ix_hands_on_job_project_id", "project_id"),
        Index("ix_hands_on_job_status", "status"),
        Index("ix_hands_on_job_created_at", "created_at"),
    )

    def __repr__(self):
        return f"<HandsOnGenerationJob(job_id={self.job_id}, status={self.status}, progress={self.completed_tasks}/{self.total_tasks})>"


# =========================
# 仕様変更リクエストシステム
# =========================

ChangeRequestStatusEnum = Enum(
    "PROPOSING", "APPROVED", "APPLIED", "CANCELLED",
    name="change_request_status_enum"
)


class ChangeRequest(Base):
    """
    仕様変更リクエスト

    ユーザーの変更要望を受け付け、影響分析と変更案を管理する。
    対話ループにより、承認されるまで修正を繰り返すことができる。
    """
    __tablename__ = "change_request"

    request_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projectBase.project_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # ユーザーの元の要望
    description = Column(Text, nullable=False)

    # ステータス: PROPOSING / APPROVED / APPLIED / CANCELLED
    status = Column(ChangeRequestStatusEnum, default="PROPOSING", nullable=False)

    # 現在の提案（JSON）
    # {
    #   "approach": "変更アプローチの概要",
    #   "specification": {"updated": bool, "content": "全文"},
    #   "function_doc": {"updated": bool, "content": "全文"},
    #   "functions": {"keep": [], "discard": [], "add": [], "modify": []},
    #   "tasks": {"discard": [], "add": [], "modify": []},
    #   "hands_on_to_regenerate": []
    # }
    proposal = Column(JSON, nullable=True)

    # 対話履歴（JSON配列）- UIチャット表示用
    # [
    #   {"role": "user", "content": "...", "timestamp": "..."},
    #   {"role": "assistant", "type": "proposal", "summary": "...", "timestamp": "..."}
    # ]
    conversation = Column(JSON, default=list, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    project = relationship("ProjectBase", back_populates="change_requests")

    __table_args__ = (
        Index("ix_change_request_project_status", "project_id", "status"),
        Index("ix_change_request_created_at", "created_at"),
    )

    def __repr__(self):
        return f"<ChangeRequest(id={self.request_id}, project_id={self.project_id}, status={self.status})>"

    def add_user_message(self, content: str) -> None:
        """ユーザーメッセージを対話履歴に追加"""
        from datetime import datetime
        if self.conversation is None:
            self.conversation = []
        self.conversation = self.conversation + [{
            "role": "user",
            "content": content,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }]

    def add_proposal_message(self, summary: str) -> None:
        """提案メッセージを対話履歴に追加"""
        from datetime import datetime
        if self.conversation is None:
            self.conversation = []
        self.conversation = self.conversation + [{
            "role": "assistant",
            "type": "proposal",
            "summary": summary,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }]


class DocumentChunk(Base):
    """
    ドキュメントチャンク（semantic検索用）

    仕様書・機能要件書を小さなチャンクに分割して保存。
    ベクトル検索により関連部分のみをLLMコンテキストに含める。
    """
    __tablename__ = "document_chunk"

    chunk_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projectBase.project_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # チャンク情報
    document_type = Column(String(30), nullable=False)  # SPECIFICATION / FUNCTION_DOC
    section_id = Column(String(100), nullable=False)  # セクション識別子（重複排除用）

    # コンテンツ
    chunk_content = Column(Text, nullable=False)   # 検索用（小さいチャンク）
    parent_content = Column(Text, nullable=False)  # コンテキスト用（セクション全体）

    # ベクトル埋め込み（pgvectorを使う場合はVector型に変更）
    # 現時点ではFLOAT配列として定義
    embedding = Column(JSON, nullable=True)  # [float, float, ...]

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    project = relationship("ProjectBase", back_populates="document_chunks")

    __table_args__ = (
        UniqueConstraint('project_id', 'document_type', 'section_id'),
        Index("ix_document_chunk_project_type", "project_id", "document_type"),
    )

    def __repr__(self):
        return f"<DocumentChunk(id={self.chunk_id}, type={self.document_type}, section={self.section_id})>"
