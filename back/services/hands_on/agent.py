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
from services.tech import TechSelectionService

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
        while True:
            handler = self.phase_registry.get(session.phase)

            if handler is None:
                # 未実装フェーズの場合はエラーを返して終了
                yield self.events.error(f"Unknown phase: {session.phase.value}")
                break

            # フェーズの処理を実行
            async for event in handler.execute(session, context):
                yield event

                # 進捗保存イベント時にDB保存
                if event.get("type") == "progress_saved":
                    await self.save_progress(session, "generating")

                # ユーザー待ちイベントの場合はDB保存して一旦返す
                if event.get("type") in [
                    "choice_required",
                    "user_input_required",
                    "step_choice_required",
                    "step_confirmation_required",
                    "dependency_decision_required",
                    "redirect_to_task",
                ]:
                    await self.save_progress(session, "waiting_input")
                    return

                # 完了イベントの場合はループを抜ける
                if event.get("type") == "done":
                    return

    async def handle_user_response(
        self,
        session: SessionState,
        response_type: str,
        choice_id: Optional[str] = None,
        selected: Optional[str] = None,
        user_input: Optional[str] = None,
        user_note: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        ユーザー応答を処理

        Args:
            session: 現在のセッション
            response_type: 応答タイプ
            choice_id: 選択肢ID
            selected: 選択された値
            user_input: ユーザー入力
            user_note: ユーザーメモ

        Yields:
            SSEイベント辞書
        """
        context = self._create_context()
        handler = self.phase_registry.get(session.phase)

        if handler is None:
            yield self.events.error(f"Unknown phase: {session.phase.value}")
            return

        # ユーザー応答イベントを通知
        yield self.events.user_response(
            response_type=response_type,
            choice_id=choice_id,
            selected=selected,
            user_input=user_input,
            user_note=user_note
        )

        # ハンドラにユーザー応答を委譲
        async for event in handler.handle_response(
            session, context, response_type,
            choice_id=choice_id,
            selected=selected,
            user_input=user_input,
            user_note=user_note
        ):
            yield event

        # 応答処理後に進捗を保存
        await self.save_progress(session, "generating")

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
            state: 保存状態 ("generating", "waiting_input", "completed")

        Returns:
            TaskHandsOnレコード
        """
        from datetime import datetime

        # 既存のTaskHandsOnを取得または作成
        hands_on = self.db.query(TaskHandsOn).filter(
            TaskHandsOn.task_id == self.task.task_id
        ).first()

        if not hands_on:
            hands_on = TaskHandsOn(
                task_id=self.task.task_id,
                generation_state=state,
                generation_mode="interactive",
                session_id=session.session_id,
                generation_model=self.config.get("model", "gemini-2.0-flash"),
            )
            self.db.add(hands_on)

        # 生成済みコンテンツを各カラムに保存
        hands_on.overview = session.generated_content.get("overview", "")
        hands_on.implementation_steps = session.generated_content.get("implementation", "")
        hands_on.verification = session.generated_content.get("verification", "")
        hands_on.technical_context = session.generated_content.get("context", "")

        # 状態を更新
        hands_on.generation_state = state
        hands_on.session_id = session.session_id

        # pending_stateを保存（セッション復帰用）
        hands_on.pending_state = build_pending_state(session)

        # user_interactionsに詳細情報を保存
        hands_on.user_interactions = build_user_interactions(session)

        hands_on.updated_at = datetime.now()

        self.db.commit()
        self.db.refresh(hands_on)

        return hands_on


# 後方互換性のためのエイリアス
InteractiveHandsOnAgent = HandsOnAgent
