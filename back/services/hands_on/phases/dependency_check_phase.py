"""
DEPENDENCY_CHECKフェーズハンドラ

依存タスクのチェックと対応方針決定を処理。
"""

import asyncio
from typing import Dict, Any, AsyncGenerator, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from ..types import (
    GenerationPhase,
    SessionState,
    DependencyTaskInfo,
    InputPrompt,
)
from ..context import AgentContext
from ..utils import chunk_text
from .base_phase import BasePhase, WaitingPhase
from .registry import register_phase


@register_phase(GenerationPhase.DEPENDENCY_CHECK)
class DependencyCheckPhase(BasePhase):
    """
    DEPENDENCY_CHECKフェーズ: 依存タスクのチェック

    処理内容:
    1. 依存タスク情報をセッションに設定
    2. 未完了の依存タスクがある場合はユーザーに確認
    3. 完了済みタスクのサマリーを生成
    4. CONTEXTフェーズへ遷移
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.DEPENDENCY_CHECK

    async def execute(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """DEPENDENCY_CHECKフェーズを実行"""
        dependency_context = context.dependency_context or {}

        if dependency_context:
            # 依存タスク情報をセッションに設定
            predecessor_tasks = dependency_context.get("predecessor_tasks", [])
            has_incomplete = dependency_context.get("has_incomplete_predecessors", False)

            # プロジェクト全体の実装概要をセッションに設定
            session.project_implementation_overview = dependency_context.get(
                "project_implementation_overview", ""
            )

            # 依存タスク情報をセッションに保存
            for pt in predecessor_tasks:
                session.predecessor_tasks.append(DependencyTaskInfo(
                    task_id=pt["task_id"],
                    title=pt["title"],
                    description=pt["description"],
                    hands_on_status=pt["hands_on_status"],
                    implementation_summary=None
                ))

            # 後続タスク情報をセッションに保存
            successor_tasks = dependency_context.get("successor_tasks", [])
            for st in successor_tasks:
                session.successor_tasks.append(DependencyTaskInfo(
                    task_id=st["task_id"],
                    title=st["title"],
                    description=st.get("description", ""),
                    hands_on_status="not_started",
                    implementation_summary=None
                ))

            # 未完了の依存タスクがある場合はユーザーに確認
            if has_incomplete:
                incomplete_tasks = [
                    pt for pt in predecessor_tasks
                    if pt["hands_on_status"] != "completed"
                ]
                task_list = "\n".join([f"- {pt['title']}" for pt in incomplete_tasks])

                yield context.events.section_start("dependency_check")

                warning_text = f"""⚠️ **未完了の依存タスクがあります**

このタスクは以下のタスクに依存していますが、まだ完了していません：

{task_list}

どのように進めますか？
"""
                for chunk in chunk_text(warning_text):
                    yield context.events.chunk(chunk)
                    await asyncio.sleep(0.02)

                yield context.events.section_complete("dependency_check")

                # ユーザーに選択を求める
                session.pending_input = InputPrompt(
                    prompt_id="dependency_decision",
                    question="依存タスクが未完了です。どのように進めますか？",
                    options=["そのまま進める", "モックで進める（後で結合）", "先に依存タスクを完了させる"]
                )
                self.transition_to(session, GenerationPhase.WAITING_DEPENDENCY_DECISION)

                yield context.events.step_confirmation_required(
                    prompt_id=session.pending_input.prompt_id,
                    question=session.pending_input.question,
                    options=session.pending_input.options
                )
                return

            # 完了済みの依存タスクのサマリーを生成
            completed_tasks = [
                pt for pt in predecessor_tasks
                if pt["hands_on_status"] == "completed" and pt.get("hands_on_content")
            ]
            if completed_tasks:
                yield context.events.section_start("dependency_summary")
                summary_text = "📋 **直接依存タスクの実装状況**\n\n"

                for pt in completed_tasks:
                    summary_text += f"**{pt['title']}** は完了済みです。\n"
                    impl_summary = await self._summarize_implementation(pt, context)
                    if impl_summary:
                        summary_text += f"{impl_summary}\n\n"
                        for dep_info in session.predecessor_tasks:
                            if dep_info.task_id == pt["task_id"]:
                                dep_info.implementation_summary = impl_summary
                                break

                for chunk in chunk_text(summary_text):
                    yield context.events.chunk(chunk)
                    await asyncio.sleep(0.02)

                yield context.events.section_complete("dependency_summary")
                session.generated_content["dependency_summary"] = summary_text

            # プロジェクト全体の実装概要を表示
            if session.project_implementation_overview:
                yield context.events.section_start("project_overview")
                project_text = "📦 **プロジェクト内の実装済み機能**\n\n"
                project_text += "以下の機能は既に他のタスクで実装済みです。重複して実装しないでください。\n\n"
                project_text += session.project_implementation_overview
                project_text += "\n"

                for chunk in chunk_text(project_text):
                    yield context.events.chunk(chunk)
                    await asyncio.sleep(0.02)

                yield context.events.section_complete("project_overview")
                session.generated_content["project_overview"] = project_text

        # CONTEXTフェーズへ遷移
        self.transition_to(session, GenerationPhase.CONTEXT)

    async def _summarize_implementation(
        self,
        task_info: Dict[str, Any],
        context: AgentContext
    ) -> Optional[str]:
        """依存タスクの実装内容をサマリー"""
        hands_on_content = task_info.get("hands_on_content", {})
        if not hands_on_content:
            return None

        implementation = hands_on_content.get("implementation_steps", "")
        if not implementation:
            return None

        prompt = f"""
以下の実装内容を50文字程度で要約してください。
何が実装されたか（モデル、API、UI等）を具体的に書いてください。

{implementation[:2000]}
"""
        try:
            response = await context.llm.ainvoke([
                SystemMessage(content="実装内容を簡潔に要約してください。"),
                HumanMessage(content=prompt)
            ])
            return response.content.strip()
        except Exception:
            return None


@register_phase(GenerationPhase.WAITING_DEPENDENCY_DECISION)
class WaitingDependencyDecisionPhase(WaitingPhase):
    """
    WAITING_DEPENDENCY_DECISIONフェーズ: 依存タスク対応方針待ち
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.WAITING_DEPENDENCY_DECISION

    async def handle_response(
        self,
        session: SessionState,
        context: AgentContext,
        response_type: str,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """ユーザーの依存タスク対応方針を処理"""
        user_input = kwargs.get("user_input", "")

        if "先に" in user_input or "完了" in user_input:
            # リダイレクト
            session.dependency_decision = "redirect"
            yield context.events.redirect_to_dependency()
            return

        if "モック" in user_input:
            session.dependency_decision = "mock"
        else:
            session.dependency_decision = "proceed"

        session.pending_input = None
        self.transition_to(session, GenerationPhase.CONTEXT)
