"""
CONTEXTフェーズハンドラ

タスクの位置づけ（依存関係、前後タスク）を説明するフェーズ。
"""

import asyncio
from typing import Dict, Any, AsyncGenerator, List

from ..types import GenerationPhase, SessionState
from ..context import AgentContext
from ..utils import chunk_text
from .base_phase import BasePhase
from .registry import register_phase


@register_phase(GenerationPhase.CONTEXT)
class ContextPhase(BasePhase):
    """
    CONTEXTフェーズ: タスクの位置づけを説明

    処理内容:
    1. タスクの位置づけ情報を取得
    2. コンテキスト情報イベントを送信
    3. コンテキストテキストをストリーミング出力
    4. OVERVIEWフェーズへ遷移
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.CONTEXT

    async def execute(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """CONTEXTフェーズを実行"""

        # タスクの位置づけ情報を取得
        position = self._get_task_position(context)

        # コンテキスト情報イベント
        yield context.events.context(
            position=position["position_description"],
            dependencies=[t["title"] for t in position["previous_tasks"]],
            dependents=[t["title"] for t in position["next_tasks"]]
        )

        # セクション開始
        yield context.events.section_start("context")

        # コンテキストテキストを生成・ストリーミング
        context_text = self._build_context_text(context, position)
        for chunk in chunk_text(context_text):
            yield context.events.chunk(chunk)
            await asyncio.sleep(0.02)

        # セッションに保存
        session.generated_content["context"] = context_text

        # セクション完了
        yield context.events.section_complete("context")

        # 次のフェーズへ遷移
        self.transition_to(session, GenerationPhase.OVERVIEW)

        # 進捗保存イベント（実際の保存は呼び出し側で行う）
        yield context.events.progress_saved("context")

    def _get_task_position(self, context: AgentContext) -> Dict[str, Any]:
        """
        タスクの全体における位置づけを取得

        Note: 将来的にはこのロジックをユーティリティに移動
        """
        from models.project_base import TaskDependency, Task

        task = context.task
        db = context.db

        dependencies_from = db.query(TaskDependency).filter(
            TaskDependency.target_task_id == task.task_id
        ).all()

        dependencies_to = db.query(TaskDependency).filter(
            TaskDependency.source_task_id == task.task_id
        ).all()

        prev_tasks = []
        for dep in dependencies_from:
            source_task = db.query(Task).filter(
                Task.task_id == dep.source_task_id
            ).first()
            if source_task:
                prev_tasks.append({
                    "task_id": str(source_task.task_id),
                    "title": source_task.title,
                    "category": source_task.category
                })

        next_tasks = []
        for dep in dependencies_to:
            target_task = db.query(Task).filter(
                Task.task_id == dep.target_task_id
            ).first()
            if target_task:
                next_tasks.append({
                    "task_id": str(target_task.task_id),
                    "title": target_task.title,
                    "category": target_task.category
                })

        position_desc = self._build_position_description(task, prev_tasks, next_tasks)

        return {
            "previous_tasks": prev_tasks,
            "next_tasks": next_tasks,
            "position_description": position_desc
        }

    def _build_position_description(
        self,
        task: Any,
        prev_tasks: List[Dict],
        next_tasks: List[Dict]
    ) -> str:
        """タスクの位置づけ説明を生成"""
        if not prev_tasks and not next_tasks:
            return "このタスクは独立したタスクです。"

        parts = []

        if prev_tasks:
            prev_titles = ", ".join([t["title"] for t in prev_tasks[:3]])
            parts.append(f"前提タスク: {prev_titles}")

        if next_tasks:
            next_titles = ", ".join([t["title"] for t in next_tasks[:3]])
            parts.append(f"後続タスク: {next_titles}")

        return "。".join(parts) + "。"

    def _build_context_text(
        self,
        context: AgentContext,
        position: Dict[str, Any]
    ) -> str:
        """コンテキスト説明テキストを構築"""
        task = context.task

        parts = [f"## {task.title}\n\n"]

        if task.description:
            parts.append(f"{task.description}\n\n")

        parts.append(f"### タスクの位置づけ\n\n")
        parts.append(f"{position['position_description']}\n\n")

        if position["previous_tasks"]:
            parts.append("**前提となるタスク:**\n\n")
            for t in position["previous_tasks"][:3]:
                parts.append(f"- {t['title']}\n")
            parts.append("\n")

        if position["next_tasks"]:
            parts.append("**このタスク完了後に実装できるタスク:**\n\n")
            for t in position["next_tasks"][:3]:
                parts.append(f"- {t['title']}\n")
            parts.append("\n")

        return "".join(parts)
