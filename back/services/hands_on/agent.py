"""
InteractiveHandsOnAgent - メインオーケストレータ

フェーズベースのハンズオン生成を管理する薄いオーケストレータ。
各フェーズの処理はフェーズハンドラに委譲する。
"""

from typing import Dict, Any, AsyncGenerator, Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from langchain_google_genai import ChatGoogleGenerativeAI

from models.project_base import Task, TaskHandsOn
from services.tech_selection_service import TechSelectionService

from .types import (
    GenerationPhase,
    SessionState,
    ImplementationStep,
    Decision,
    DependencyTaskInfo,
)
from .context import AgentContext
from .events import EventBuilder
from .state import (
    SessionManager,
    default_manager,
    serialize_steps,
    serialize_decisions,
    build_pending_state,
    build_user_interactions,
)
from .phases import default_registry, BasePhase


class HandsOnAgent:
    """
    ハンズオン生成エージェント（新アーキテクチャ）

    フェーズハンドラパターンを使用し、各生成フェーズを独立したクラスで処理。

    Usage:
        agent = HandsOnAgent(task, db, project_context, dependency_context, config)
        async for event in agent.generate_stream():
            yield event
    """

    def __init__(
        self,
        db: Session,
        task: Task,
        project_context: Dict[str, Any],
        config: Optional[Dict[str, Any]] = None,
        dependency_context: Optional[Dict[str, Any]] = None,
    ):
        """
        エージェントを初期化

        Args:
            db: DBセッション
            task: 対象タスク
            project_context: プロジェクト情報
            config: 設定オプション
            dependency_context: 依存関係コンテキスト
        """
        self.db = db
        self.task = task
        self.project_context = project_context or {}
        self.config = config or {}
        self.dependency_context = dependency_context or {}

        # LLM初期化
        self.llm = ChatGoogleGenerativeAI(
            model=self.config.get("model", "gemini-2.0-flash"),
            temperature=0.7
        )

        # 技術選定サービス初期化
        self.tech_service = TechSelectionService(db)

        # 決定済みdomainをキャッシュ
        self.decided_domains = self.tech_service.get_decided_domains(
            task.project_id, task.task_id
        )

        # エコシステム特定
        self.ecosystem = self._detect_ecosystem()

        # フェーズレジストリとセッションマネージャー
        self.phase_registry = default_registry
        self.session_manager = default_manager

        # イベントビルダー
        self.events = EventBuilder

        # プロジェクト情報を展開
        self.tech_stack = self.project_context.get("tech_stack", [])
        self.framework = self.project_context.get("framework", "未設定")
        self.directory_info = self.project_context.get("directory_info", "")

    def _create_context(self) -> AgentContext:
        """フェーズハンドラに渡すコンテキストを作成"""
        return AgentContext(
            task=self.task,
            db=self.db,
            llm=self.llm,
            config=self.config,
            project_context=self.project_context,
            dependency_context=self.dependency_context,
            tech_service=self.tech_service,
            decided_domains=self.decided_domains,
            ecosystem=self.ecosystem,
        )

    def _detect_ecosystem(self) -> str:
        """エコシステムを検出"""
        tech_stack = self.project_context.get("tech_stack", [])
        framework = self.project_context.get("framework", "").lower()

        if "next.js" in framework or "react" in framework:
            return "next.js"
        if "fastapi" in framework or "python" in str(tech_stack).lower():
            return "python"
        if "express" in framework or "node" in str(tech_stack).lower():
            return "node.js"

        return "unknown"

    async def generate_stream(
        self,
        session: Optional[SessionState] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        ハンズオンコンテンツをストリーミング生成

        Args:
            session: 既存セッション（Noneの場合は新規作成）

        Yields:
            SSEイベント辞書
        """
        # セッションの取得または作成
        if session is None:
            session = self.session_manager.create(str(self.task.task_id))

        context = self._create_context()

        # メイン生成ループ
        while session.phase != GenerationPhase.COMPLETE:
            handler = self.phase_registry.get(session.phase)

            if handler is None:
                # 未実装フェーズの場合はエラーを返して終了
                yield self.events.error(f"Unknown phase: {session.phase.value}")
                break

            # フェーズの処理を実行
            async for event in handler.execute(session, context):
                yield event

                # ユーザー待ちイベントの場合は一旦返す
                if event.get("type") in [
                    "choice_required",
                    "user_input_required",
                    "step_choice_required",
                    "step_complete_required",
                    "dependency_decision_required",
                ]:
                    return

        # 完了イベント
        yield self.events.complete()

    async def handle_user_response(
        self,
        session: SessionState,
        response_type: str,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        ユーザー応答を処理

        Args:
            session: 現在のセッション
            response_type: 応答タイプ
            **kwargs: 応答データ

        Yields:
            SSEイベント辞書
        """
        context = self._create_context()
        handler = self.phase_registry.get(session.phase)

        if handler is None:
            yield self.events.error(f"Unknown phase: {session.phase.value}")
            return

        # ハンドラにユーザー応答を委譲
        async for event in handler.handle_response(session, context, response_type, **kwargs):
            yield event

        # 応答処理後、生成を継続
        async for event in self.generate_stream(session):
            yield event

    async def save_progress(
        self,
        session: SessionState,
        state: str = "generating"
    ) -> TaskHandsOn:
        """
        進捗をDBに保存

        Args:
            session: 現在のセッション
            state: 保存状態

        Returns:
            TaskHandsOnレコード
        """
        # 既存のTaskHandsOnを取得または作成
        hands_on = self.db.query(TaskHandsOn).filter(
            TaskHandsOn.task_id == self.task.task_id
        ).first()

        if not hands_on:
            hands_on = TaskHandsOn(
                task_id=self.task.task_id,
                state=state
            )
            self.db.add(hands_on)

        # セッション状態を保存
        hands_on.state = state
        hands_on.current_phase = session.phase.value
        hands_on.generated_content = session.generated_content
        hands_on.implementation_steps = serialize_steps(session.implementation_steps)
        hands_on.current_step = session.current_step_index
        hands_on.decisions = serialize_decisions(session.decisions)
        hands_on.user_choices = session.user_choices
        hands_on.step_choices = session.step_choices
        hands_on.pending_state = build_pending_state(session)
        hands_on.user_interactions = build_user_interactions(session)
        hands_on.dependency_decision = session.dependency_decision

        self.db.commit()
        self.db.refresh(hands_on)

        return hands_on


# 後方互換性のためのエイリアス
InteractiveHandsOnAgent = HandsOnAgent
