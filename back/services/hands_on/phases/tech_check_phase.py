"""
TECH_CHECKフェーズハンドラ

技術選定判断と選択肢提示を処理。
"""

import json
import uuid
from typing import Dict, Any, AsyncGenerator, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

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
    2. LLMで技術選定が必要か判断
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

        # LLMで技術選定チェック
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
        """
        技術選定が必要かどうかを判断し、必要なら選択肢も生成

        Returns:
            選択が必要な場合:
            {
                "needs_choice": True,
                "question": "何を選定するか",
                "options": [{"id": "...", "label": "...", "description": "...", "pros": [...], "cons": [...]}]
            }
            既に決まっている場合:
            {
                "needs_choice": False,
                "decided": "PostgreSQL",
                "reason": "タスク説明で指定済み"
            }
        """
        task = context.task

        if force_choice:
            # 強制的に選択肢を出す
            prompt = f"""
以下のタスクで技術選定の選択肢を提示してください。

## タスク情報
- タイトル: {task.title}
- 説明: {task.description or 'なし'}

## プロジェクト情報
- 技術スタック: {', '.join(context.tech_stack)}
- フレームワーク: {context.framework}

## 出力形式（JSON）
{{
  "needs_choice": true,
  "question": "何を選定するか",
  "options": [
    {{"id": "option1", "label": "選択肢名", "description": "説明", "pros": ["メリット"], "cons": ["デメリット"]}}
  ]
}}
"""
        else:
            prompt = f"""
以下のタスクを実装するにあたり、技術選定が必要かどうか判断してください。

## タスク情報
- タイトル: {task.title}
- 説明: {task.description or 'なし'}

## プロジェクト情報
- 技術スタック: {', '.join(context.tech_stack)}
- フレームワーク: {context.framework}

## プロジェクト内で既に決定済みの技術
{session.project_implementation_overview or 'なし'}

## 判断基準
- タスク説明で既に技術が明記されている場合（例: PostgreSQL、REST API等） → 選択不要
- プロジェクトで既に決定済みの場合 → 選択不要
- 複数の選択肢があり得て、ユーザーに確認すべき場合のみ → 選択必要

## 出力形式（JSON）
選択が必要な場合:
{{
  "needs_choice": true,
  "question": "何を選定するか",
  "options": [
    {{"id": "option1", "label": "選択肢名", "description": "説明", "pros": ["メリット"], "cons": ["デメリット"]}}
  ]
}}

既に決まっている場合:
{{
  "needs_choice": false,
  "decided": "決定済みの技術名",
  "reason": "判断理由"
}}
"""

        try:
            response = await context.llm.ainvoke([
                SystemMessage(content="技術選定を判断するアシスタントです。JSON形式で回答してください。"),
                HumanMessage(content=prompt)
            ])

            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            return json.loads(content.strip())
        except Exception:
            return {"needs_choice": False, "decided": None, "reason": "判断できませんでした"}


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

        session.user_choices[choice_id] = {
            "selected": selected,
            "user_note": user_note
        }

        session.pending_choice = None
        self.transition_to(session, GenerationPhase.IMPLEMENTATION_PLANNING)

        yield context.events.chunk(f"\n✅ **選択完了**: {selected}\n\n")


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
            if "auto_decided" in session.user_choices:
                del session.user_choices["auto_decided"]
            session.generated_content["force_choice"] = "true"
            self.transition_to(session, GenerationPhase.TECH_CHECK)
        else:
            # OKなら実装計画へ
            session.pending_input = None
            self.transition_to(session, GenerationPhase.IMPLEMENTATION_PLANNING)
            yield context.events.chunk("\n✅ 確認完了\n\n")
