"""
TECH_CHECKフェーズハンドラ

技術選定判断と選択肢提示を処理。
"""

import uuid
from typing import Dict, Any, AsyncGenerator, List, Optional

from ..types import (
    GenerationPhase,
    SessionState,
    ChoiceOption,
    ChoiceRequest,
    InputPrompt,
)
from ..context import AgentContext
from .base_phase import BasePhase, WaitingPhase
from .registry import register_phase


@register_phase(GenerationPhase.TECH_CHECK)
class TechCheckPhase(BasePhase):
    """
    TECH_CHECKフェーズ: 技術選定判断

    処理内容:
    1. 既に選択済みならIMPLEMENTATION_PLANNINGへスキップ
    2. 技術選定が必要か判断
    3. 必要なら選択肢提示またはユーザー確認
    4. 不要ならIMPLEMENTATION_PLANNINGへ遷移
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.TECH_CHECK

    async def execute(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """TECH_CHECKフェーズを実行"""

        # 既に選択済みなら実装計画へ
        if session.user_choices:
            self.transition_to(session, GenerationPhase.IMPLEMENTATION_PLANNING)
            return

        # force_choiceフラグの確認
        force_choice = session.generated_content.get("force_choice") == "true"
        if force_choice:
            del session.generated_content["force_choice"]

        # 技術選定チェック
        tech_check = await self._check_tech_selection(session, context, force_choice)

        if tech_check.get("needs_choice"):
            # 選択肢を提示
            choice_id = f"choice_{uuid.uuid4().hex[:8]}"
            options = tech_check.get("options", [])

            session.pending_choice = ChoiceRequest(
                choice_id=choice_id,
                question=tech_check.get("question", "技術を選定しましょう"),
                options=[
                    ChoiceOption(
                        id=opt.get("id", f"opt_{i}"),
                        label=opt.get("label", ""),
                        description=opt.get("description", ""),
                        pros=opt.get("pros", []),
                        cons=opt.get("cons", [])
                    )
                    for i, opt in enumerate(options)
                ],
                allow_custom=True,
                skip_allowed=True
            )
            self.transition_to(session, GenerationPhase.CHOICE_REQUIRED)

            yield {
                "type": "choice_required",
                "choice": {
                    "choice_id": choice_id,
                    "question": tech_check.get("question"),
                    "options": options,
                    "allow_custom": True,
                    "skip_allowed": True
                }
            }
            return

        elif tech_check.get("decided"):
            # 既に決まっている場合は確認を求める
            decided = tech_check.get("decided")
            reason = tech_check.get("reason", "")

            yield context.events.chunk(f"\n\n**技術選定**: {decided}\n{reason}\n\n")

            session.pending_input = InputPrompt(
                prompt_id="confirm_auto_decided",
                question=f"{decided}で進めてよろしいですか？",
                options=["OK", "別の選択肢を検討"]
            )
            session.user_choices["auto_decided"] = {
                "selected": decided,
                "note": reason
            }
            self.transition_to(session, GenerationPhase.WAITING_CHOICE_CONFIRM)

            yield context.events.user_input_required(session.pending_input)
            return

        # 技術選定不要の場合は実装計画へ
        self.transition_to(session, GenerationPhase.IMPLEMENTATION_PLANNING)

    async def _check_tech_selection(
        self,
        session: SessionState,
        context: AgentContext,
        force_choice: bool = False
    ) -> Dict[str, Any]:
        """技術選定が必要か判断"""
        task = context.task

        # DBプリセットからの技術選定チェック
        if context.tech_service:
            ecosystem = context.ecosystem or self._detect_ecosystem(context)
            result = context.tech_service.check_tech_selection(
                task_category=task.category,
                ecosystem=ecosystem,
                decided_domains=context.decided_domains
            )

            if result.get("needs_selection"):
                domain = result.get("domain")
                options = result.get("options", [])

                # ドメインキーをセッションに記録
                session.current_domain_key = domain.domain_key if domain else None

                return {
                    "needs_choice": True,
                    "question": domain.question_template if domain else "技術を選定してください",
                    "options": [
                        {
                            "id": opt.stack_key,
                            "label": opt.display_name,
                            "description": opt.one_liner or "",
                            "pros": opt.pros or [],
                            "cons": opt.cons or []
                        }
                        for opt in options
                    ]
                }

        # force_choiceの場合はLLMで判断
        if force_choice:
            return await self._llm_tech_check(context)

        return {"needs_choice": False}

    def _detect_ecosystem(self, context: AgentContext) -> str:
        """エコシステムを検出"""
        tech_stack = context.tech_stack
        framework = context.framework.lower() if context.framework else ""

        if "next.js" in framework or "react" in framework:
            return "next.js"
        if "fastapi" in framework or "python" in str(tech_stack).lower():
            return "python"
        if "express" in framework or "node" in str(tech_stack).lower():
            return "node.js"

        return "unknown"

    async def _llm_tech_check(self, context: AgentContext) -> Dict[str, Any]:
        """LLMで技術選定をチェック（フォールバック）"""
        # LLMベースの判断（既存ロジックを簡略化）
        return {"needs_choice": False}


@register_phase(GenerationPhase.CHOICE_REQUIRED)
class ChoiceRequiredPhase(WaitingPhase):
    """
    CHOICE_REQUIREDフェーズ: 選択肢提示待ち
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.CHOICE_REQUIRED

    async def handle_response(
        self,
        session: SessionState,
        context: AgentContext,
        response_type: str,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """ユーザーの技術選択を処理"""
        choice_id = kwargs.get("choice_id", "")
        selected = kwargs.get("selected", "")
        user_note = kwargs.get("user_note", "")
        domain_key = kwargs.get("domain_key")
        stack_key = kwargs.get("stack_key")

        # 新形式（domain_key/stack_key）または旧形式で保存
        if domain_key and stack_key:
            session.user_choices[choice_id] = {
                "domain_key": domain_key,
                "stack_key": stack_key
            }
            # プロジェクト技術決定をDBに記録
            if context.tech_service:
                context.tech_service.record_project_decision(
                    project_id=context.task.project_id,
                    domain_key=domain_key,
                    stack_key=stack_key,
                    source_task_id=context.task.task_id
                )
        else:
            session.user_choices[choice_id] = {
                "selected": selected,
                "user_note": user_note
            }

        session.pending_choice = None
        session.current_domain_key = None
        self.transition_to(session, GenerationPhase.IMPLEMENTATION_PLANNING)

        yield context.events.chunk(f"\n✅ **選択完了**: {selected or stack_key}\n\n")


@register_phase(GenerationPhase.WAITING_CHOICE_CONFIRM)
class WaitingChoiceConfirmPhase(WaitingPhase):
    """
    WAITING_CHOICE_CONFIRMフェーズ: 決定済み技術の確認待ち
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.WAITING_CHOICE_CONFIRM

    async def handle_response(
        self,
        session: SessionState,
        context: AgentContext,
        response_type: str,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """ユーザーの確認応答を処理"""
        user_input = kwargs.get("user_input", "")

        if "別" in user_input or "検討" in user_input:
            # 別の選択肢を検討 → 強制的に選択肢表示
            del session.user_choices["auto_decided"]
            session.generated_content["force_choice"] = "true"
            self.transition_to(session, GenerationPhase.TECH_CHECK)
        else:
            # OKなら実装計画へ
            session.pending_input = None
            self.transition_to(session, GenerationPhase.IMPLEMENTATION_PLANNING)
            yield context.events.chunk("\n✅ 確認完了\n\n")
