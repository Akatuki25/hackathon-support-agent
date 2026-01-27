"""
IMPLEMENTATIONフェーズハンドラ

実装計画生成とステップ実行を処理。
"""

import asyncio
import uuid
from typing import Dict, Any, AsyncGenerator, List

from ..types import (
    GenerationPhase,
    SessionState,
    ImplementationStep,
    InputPrompt,
    ChoiceOption,
    ChoiceRequest,
)
from ..context import AgentContext
from ..utils import chunk_text
from ..generators import PlanGenerator, StepGenerator
from .base_phase import BasePhase, WaitingPhase
from .registry import register_phase


@register_phase(GenerationPhase.IMPLEMENTATION_PLANNING)
class ImplementationPlanningPhase(BasePhase):
    """
    IMPLEMENTATION_PLANNINGフェーズ: 実装計画生成

    処理内容:
    1. LLMで実装ステップを計画
    2. ステップ一覧を表示
    3. IMPLEMENTATION_STEPフェーズへ遷移
    """

    def __init__(self):
        self.plan_generator = PlanGenerator()

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.IMPLEMENTATION_PLANNING

    async def execute(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """IMPLEMENTATION_PLANNINGフェーズを実行"""

        yield context.events.section_start("planning")
        yield context.events.chunk("\n\n### 実装計画\n\nMVPアプローチで段階的に実装していきます。\n\n")

        # ステップを計画
        session.implementation_steps = await self.plan_generator.generate_plan(
            session=session,
            context=context,
            user_choices=session.user_choices,
            decided_domains=context.decided_domains
        )

        # ステップ一覧を表示
        steps_overview = ""
        for step in session.implementation_steps:
            steps_overview += f"**ステップ{step.step_number}**: {step.title}\n"
            steps_overview += f"  - {step.description}\n\n"

        for chunk in chunk_text(steps_overview):
            yield context.events.chunk(chunk)
            await asyncio.sleep(0.02)

        yield context.events.section_complete("planning")
        yield context.events.progress_saved("planning")

        session.current_step_index = 0
        self.transition_to(session, GenerationPhase.IMPLEMENTATION_STEP)


@register_phase(GenerationPhase.IMPLEMENTATION_STEP)
class ImplementationStepPhase(BasePhase):
    """
    IMPLEMENTATION_STEPフェーズ: ステップ実行

    処理内容:
    1. 現在のステップの要件をチェック
    2. 技術選定が必要なら選択肢提示
    3. ステップ内容を生成
    4. ステップ完了確認
    5. 全ステップ完了ならVERIFICATIONへ
    """

    def __init__(self):
        self.step_generator = StepGenerator()

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.IMPLEMENTATION_STEP

    async def execute(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """IMPLEMENTATION_STEPフェーズを実行"""

        if session.current_step_index >= len(session.implementation_steps):
            # 全ステップ完了
            self.transition_to(session, GenerationPhase.VERIFICATION)
            return

        current_step = session.implementation_steps[session.current_step_index]
        previous_steps = session.implementation_steps[:session.current_step_index]

        yield context.events.step_start(
            step_number=current_step.step_number,
            step_title=current_step.title,
            total_steps=len(session.implementation_steps)
        )

        # ステップ要件チェック（技術選定など）
        requirements = await self._check_step_requirements(current_step, session, context)

        if requirements and requirements.get("tech_selection_needed"):
            # ステップ内技術選定が必要
            choice_id = f"step_{current_step.step_number}_choice_{uuid.uuid4().hex[:8]}"
            options = requirements.get("tech_selection_options", [])

            session.pending_choice = ChoiceRequest(
                choice_id=choice_id,
                question=requirements.get("tech_selection_question", "技術を選択してください"),
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
                skip_allowed=False
            )
            self.transition_to(session, GenerationPhase.WAITING_STEP_CHOICE)

            yield context.events.step_choice_required(
                step_number=current_step.step_number,
                choice_id=choice_id,
                question=requirements.get("tech_selection_question"),
                options=options,
                allow_custom=True
            )
            return

        # ステップ内容を生成
        async for event in self._generate_step(current_step, session, context, previous_steps):
            yield event

    async def _check_step_requirements(
        self,
        step: ImplementationStep,
        session: SessionState,
        context: AgentContext
    ) -> Dict[str, Any]:
        """ステップ要件をチェック"""
        # 既にこのステップの選択が完了していればスキップ
        if step.step_number in session.step_choices:
            return {}

        # DBプリセットからの技術選定チェック
        if context.tech_service:
            result = context.tech_service.check_step_tech_selection(
                task_category=context.task.category,
                step_title=step.title,
                step_description=step.description,
                ecosystem=context.ecosystem,
                decided_domains=context.decided_domains
            )
            if result.get("needs_selection"):
                return {
                    "tech_selection_needed": True,
                    "tech_selection_question": result.get("question"),
                    "tech_selection_options": result.get("options", [])
                }

        return {}

    async def _generate_step(
        self,
        step: ImplementationStep,
        session: SessionState,
        context: AgentContext,
        previous_steps: List[ImplementationStep]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """ステップ内容を生成"""
        yield context.events.section_start(f"step_{step.step_number}")

        content = ""
        async for chunk in self.step_generator.generate_step_content(
            step=step,
            session=session,
            context=context,
            user_choices=session.user_choices,
            decided_domains=context.decided_domains,
            previous_steps=previous_steps,
            decisions=session.decisions
        ):
            yield context.events.chunk(chunk)
            content += chunk

        step.content = content
        yield context.events.section_complete(f"step_{step.step_number}")

        # ステップ完了確認
        session.pending_input = InputPrompt(
            prompt_id=f"step_{step.step_number}_complete",
            question=f"ステップ{step.step_number}は完了しましたか？",
            options=["完了", "質問がある", "問題が発生した"]
        )
        self.transition_to(session, GenerationPhase.WAITING_STEP_COMPLETE)

        yield context.events.step_confirmation_required(session.pending_input)


@register_phase(GenerationPhase.WAITING_STEP_CHOICE)
class WaitingStepChoicePhase(WaitingPhase):
    """
    WAITING_STEP_CHOICEフェーズ: ステップ内技術選定待ち
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.WAITING_STEP_CHOICE

    async def handle_response(
        self,
        session: SessionState,
        context: AgentContext,
        response_type: str,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """ステップ内技術選択を処理"""
        current_step = session.implementation_steps[session.current_step_index]
        selected = kwargs.get("selected", "")
        domain_key = kwargs.get("domain_key")
        stack_key = kwargs.get("stack_key")

        # ステップ選択を記録
        if domain_key and stack_key:
            session.step_choices[current_step.step_number] = {
                "domain_key": domain_key,
                "stack_key": stack_key
            }
        else:
            session.step_choices[current_step.step_number] = {
                "selected": selected
            }

        session.pending_choice = None
        self.transition_to(session, GenerationPhase.IMPLEMENTATION_STEP)

        yield context.events.chunk(f"\n✅ **選択完了**: {selected or stack_key}\n\n")


@register_phase(GenerationPhase.WAITING_STEP_COMPLETE)
class WaitingStepCompletePhase(WaitingPhase):
    """
    WAITING_STEP_COMPLETEフェーズ: ステップ完了確認待ち
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.WAITING_STEP_COMPLETE

    async def handle_response(
        self,
        session: SessionState,
        context: AgentContext,
        response_type: str,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """ステップ完了応答を処理"""
        user_input = kwargs.get("user_input", "")
        current_step = session.implementation_steps[session.current_step_index]

        if "完了" in user_input:
            # ステップ完了
            current_step.is_completed = True
            current_step.user_feedback = "completed"
            session.current_step_index += 1

            yield context.events.step_complete(current_step.step_number)

            if session.current_step_index >= len(session.implementation_steps):
                self.transition_to(session, GenerationPhase.VERIFICATION)
            else:
                self.transition_to(session, GenerationPhase.IMPLEMENTATION_STEP)

        elif "質問" in user_input:
            # 質問対応
            session.pending_input = InputPrompt(
                prompt_id=f"step_{current_step.step_number}_question",
                question="質問を入力してください",
                placeholder="質問内容を入力..."
            )
            yield context.events.user_input_required(session.pending_input)

        else:
            # 問題発生
            session.pending_input = InputPrompt(
                prompt_id=f"step_{current_step.step_number}_issue",
                question="発生した問題を教えてください",
                placeholder="問題の詳細を入力..."
            )
            yield context.events.user_input_required(session.pending_input)
