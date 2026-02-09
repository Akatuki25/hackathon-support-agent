"""
IMPLEMENTATIONフェーズハンドラ

実装計画生成とステップ実行を処理。
"""

import asyncio
import json
import uuid
from typing import Dict, Any, AsyncGenerator, List

from langchain_core.messages import HumanMessage, SystemMessage

from ..types import (
    GenerationPhase,
    SessionState,
    ImplementationStep,
    InputPrompt,
    ChoiceOption,
    ChoiceRequest,
    StepRequirements,
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
    1. 現在のステップの要件をチェック（LLMで判断）
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

        # ステップ要件チェック（LLMで判断）
        requirements = await self._check_step_requirements(current_step, session, context)
        session.current_step_requirements = requirements

        # 目的を出力
        yield context.events.chunk(f"### ステップ{current_step.step_number}: {current_step.title}\n\n")
        yield context.events.chunk(f"**目的**: {requirements.objective}\n\n")

        # 前提概念があれば説明
        if requirements.prerequisite_concept:
            yield context.events.chunk(f"**{requirements.prerequisite_concept}とは**: {requirements.prerequisite_brief}\n\n")

        # 技術選定が必要な場合
        if requirements.tech_selection_needed and requirements.tech_selection_options:
            # このステップで既に選択済みでなければ選択肢を提示
            if current_step.step_number not in session.step_choices:
                # 選択肢を提示
                choice_id = f"step_{current_step.step_number}_tech"
                session.pending_choice = ChoiceRequest(
                    choice_id=choice_id,
                    question=requirements.tech_selection_question or "技術を選択してください",
                    options=[
                        ChoiceOption(
                            id=opt.get("id", f"opt_{i}"),
                            label=opt.get("name", ""),
                            description=opt.get("description", ""),
                            pros=[],
                            cons=[]
                        )
                        for i, opt in enumerate(requirements.tech_selection_options)
                    ],
                    allow_custom=True,
                    skip_allowed=False
                )
                self.transition_to(session, GenerationPhase.WAITING_STEP_CHOICE)

                yield context.events.step_choice_required(
                    step_number=current_step.step_number,
                    choice_id=choice_id,
                    question=requirements.tech_selection_question,
                    options=[
                        {"id": opt.get("id", f"opt_{i}"), "name": opt.get("name", ""), "description": opt.get("description", "")}
                        for i, opt in enumerate(requirements.tech_selection_options)
                    ],
                    allow_custom=True
                )
                return

        # 技術選定不要 or 選択済み → 実装内容を生成
        async for event in self._generate_step(current_step, session, context, previous_steps, requirements):
            yield event

    async def _check_step_requirements(
        self,
        step: ImplementationStep,
        session: SessionState,
        context: AgentContext
    ) -> StepRequirements:
        """
        ステップ内の要件をチェック（概念説明・技術選定が必要かを判断）

        1回のLLMリクエストで以下を取得：
        - objective: ステップの目的
        - prerequisite: 前提概念（必要な場合）
        - tech_selection: 技術選定（必要な場合）

        Returns:
            StepRequirements オブジェクト
        """
        task = context.task

        # 既にこのステップで選択済みの技術があれば含める
        step_choice_text = ""
        if step.step_number in session.step_choices:
            choice = session.step_choices[step.step_number]
            step_choice_text = f"\n## このステップで選択済みの技術\n- {choice.get('selected', '')}\n"

        # プロジェクトで決定済みの技術
        decided_tech_text = ""
        if session.project_implementation_overview:
            decided_tech_text = f"\n## プロジェクトで決定済みの技術\n{session.project_implementation_overview}\n"

        prompt = f"""
以下のステップを実装するにあたり、前提知識の説明と技術選定が必要かを判断してください。

## タスク情報
- タイトル: {task.title}
- 説明: {task.description or 'なし'}
- カテゴリ: {task.category or '未分類'}

## 現在のステップ
- ステップ{step.step_number}: {step.title}
- 説明: {step.description}

## プロジェクト情報
- 技術スタック: {', '.join(context.tech_stack)}
- フレームワーク: {context.framework}
{decided_tech_text}
{step_choice_text}

## 判断基準

### 前提概念（prerequisite）
- このステップで使う概念・用語で、初心者が知らない可能性があるものがあれば提示
- 概念名と簡潔な説明（1-2文）のみ
- 既知の基本概念（変数、関数など）は不要

### 技術選定（tech_selection）
- このステップで複数の選択肢がある技術決定が必要な場合のみ
- プロジェクトや前のステップで既に決まっている場合は不要
- 選択肢は代表的なもの2-4個、それぞれ名前と簡潔な説明

## 出力形式（JSON）
{{
  "objective": "このステップで何をするか（1文）",
  "prerequisite": {{
    "needed": true/false,
    "concept": "概念名（例: DBマイグレーション）",
    "brief": "簡潔な説明（1-2文）"
  }},
  "tech_selection": {{
    "needed": true/false,
    "question": "選定の質問（例: マイグレーションツールを選びましょう）",
    "options": [
      {{"id": "tool1", "name": "ツール名", "description": "簡潔な説明"}}
    ]
  }}
}}
"""

        try:
            response = await context.llm.ainvoke([
                SystemMessage(content="ハンズオンレクチャーのアシスタントです。初心者向けに必要な説明を判断してJSON形式で回答してください。"),
                HumanMessage(content=prompt)
            ])

            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content.strip())

            # StepRequirements オブジェクトを構築
            prereq = data.get("prerequisite", {})
            tech = data.get("tech_selection", {})

            return StepRequirements(
                objective=data.get("objective", step.description),
                prerequisite_concept=prereq.get("concept") if prereq.get("needed") else None,
                prerequisite_brief=prereq.get("brief") if prereq.get("needed") else None,
                tech_selection_needed=tech.get("needed", False),
                tech_selection_question=tech.get("question") if tech.get("needed") else None,
                tech_selection_options=tech.get("options", []) if tech.get("needed") else []
            )
        except Exception:
            # エラー時はデフォルト（選定不要）
            return StepRequirements(
                objective=step.description,
                tech_selection_needed=False
            )

    async def _generate_step(
        self,
        step: ImplementationStep,
        session: SessionState,
        context: AgentContext,
        previous_steps: List[ImplementationStep],
        requirements: StepRequirements
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """ステップ内容を生成"""
        section_name = f"step_{step.step_number}"
        yield context.events.section_start(section_name)

        # 選択済みの技術があれば表示
        step_content = f"### ステップ{step.step_number}: {step.title}\n\n"
        step_content += f"**目的**: {requirements.objective}\n\n"
        if requirements.prerequisite_concept:
            step_content += f"**{requirements.prerequisite_concept}とは**: {requirements.prerequisite_brief}\n\n"

        if step.step_number in session.step_choices:
            choice = session.step_choices[step.step_number]
            yield context.events.chunk(f"**選択した技術**: {choice.get('selected', '')}\n\n")
            step_content += f"**選択した技術**: {choice.get('selected', '')}\n\n"

        yield context.events.chunk("---\n\n")
        step_content += "---\n\n"

        # 実装手順を生成
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
            step_content += chunk

        step.content = step_content

        # 実装内容を累積
        session.generated_content["implementation"] = session.generated_content.get("implementation", "") + "\n\n" + step_content

        yield context.events.section_complete(section_name)
        yield context.events.step_complete(step.step_number)

        # ユーザー確認待ち状態を設定
        session.pending_input = InputPrompt(
            prompt_id=f"step_{step.step_number}_complete",
            question=f"ステップ{step.step_number}「{step.title}」は完了しましたか？",
            placeholder="できた / 質問がある",
            options=["できた", "質問がある", "スキップ"]
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

        # ステップ選択を記録
        session.step_choices[current_step.step_number] = {
            "selected": selected
        }

        session.pending_choice = None
        self.transition_to(session, GenerationPhase.IMPLEMENTATION_STEP)

        yield context.events.chunk(f"\n✅ **選択完了**: {selected}\n\n")


@register_phase(GenerationPhase.WAITING_STEP_COMPLETE)
class WaitingStepCompletePhase(WaitingPhase):
    """
    WAITING_STEP_COMPLETEフェーズ: ステップ完了確認待ち

    処理内容:
    1. 「できた」「完了」→ 次のステップへ
    2. 「スキップ」→ スキップして次へ
    3. 「質問がある」→ 質問入力を求める
    4. 「採用する」→ 変更提案を採用してステップ再生成
    5. 「採用しない」→ 現状のまま続行
    6. その他 → LLMで変更提案か質問かを分析して処理
    """

    def __init__(self):
        self.step_generator = StepGenerator()

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

        if user_input in ["できた", "完了", "done"]:
            # ステップ完了
            current_step.is_completed = True
            current_step.user_feedback = "completed"
            session.current_step_index += 1
            session.pending_input = None

            yield context.events.step_complete(current_step.step_number)

            if session.current_step_index >= len(session.implementation_steps):
                self.transition_to(session, GenerationPhase.VERIFICATION)
            else:
                self.transition_to(session, GenerationPhase.IMPLEMENTATION_STEP)

        elif user_input == "スキップ":
            # スキップ
            current_step.is_completed = True
            current_step.user_feedback = "skipped"
            session.current_step_index += 1
            session.pending_input = None
            self.transition_to(session, GenerationPhase.IMPLEMENTATION_STEP)

        elif user_input in ["質問がある", "まだ質問がある"]:
            # 質問入力を求める
            session.pending_input = InputPrompt(
                prompt_id=f"question_step_{current_step.step_number}",
                question=f"ステップ{current_step.step_number}「{current_step.title}」について質問してください",
                placeholder="わからないことや詰まっている点を入力..."
            )
            yield context.events.user_input_required(session.pending_input)

        elif user_input == "採用する" and session.pending_decision:
            # 変更提案を採用
            from ..types import Decision
            new_decision = Decision(
                step_number=current_step.step_number,
                description=session.pending_decision["proposal"],
                reason=session.pending_decision["reason"]
            )
            session.decisions.append(new_decision)
            yield context.events.chunk(f"\n\n✓ **決定事項として保存しました:** {session.pending_decision['proposal']}\n\n")
            session.pending_decision = None

            # 決定を反映してステップ内容を再生成
            yield context.events.chunk(f"---\n\n**決定を反映して、ステップ{current_step.step_number}の内容を更新します...**\n\n")
            yield context.events.section_start(f"step_{current_step.step_number}_updated")

            previous_steps = session.implementation_steps[:session.current_step_index]
            updated_content = ""
            async for chunk in self.step_generator.generate_step_content(
                step=current_step,
                session=session,
                context=context,
                user_choices=session.user_choices,
                decided_domains=context.decided_domains,
                previous_steps=previous_steps,
                decisions=session.decisions
            ):
                yield context.events.chunk(chunk)
                updated_content += chunk

            current_step.content = updated_content
            yield context.events.section_complete(f"step_{current_step.step_number}_updated")

            # 再度ステップ確認を求める
            session.pending_input = InputPrompt(
                prompt_id=f"step_{current_step.step_number}_complete",
                question=f"ステップ{current_step.step_number}「{current_step.title}」の更新内容を確認してください。完了しましたか？",
                options=["できた", "まだ質問がある", "スキップ"]
            )
            yield context.events.step_confirmation_required(session.pending_input)

        elif user_input == "採用しない" and session.pending_decision:
            # 変更提案を採用しない
            yield context.events.chunk("\n\n現状のまま進めます。\n\n")
            session.pending_decision = None

            # 再度ステップ確認を求める
            session.pending_input = InputPrompt(
                prompt_id=f"step_{current_step.step_number}_complete",
                question=f"ステップ{current_step.step_number}「{current_step.title}」は完了しましたか？",
                options=["できた", "まだ質問がある", "スキップ"]
            )
            yield context.events.step_confirmation_required(session.pending_input)

        else:
            # その他の入力は質問/提案として分析
            current_step.user_feedback = user_input

            # 変更提案かどうかを分析
            decision_proposal = await self._analyze_question_for_decision(user_input, current_step, context)

            if decision_proposal:
                # 変更提案が検出された → メリデメ分析してから採用確認
                session.pending_decision = decision_proposal
                yield context.events.section_start("proposal")
                yield context.events.chunk(f"\n\n**変更提案を検出しました:**\n\n")
                yield context.events.chunk(f"📝 **{decision_proposal['proposal']}**\n\n")

                # メリデメ分析をストリーミング
                yield context.events.chunk("---\n\n")
                async for chunk in self._stream_pros_cons_analysis(
                    decision_proposal['proposal'],
                    current_step,
                    context
                ):
                    yield context.events.chunk(chunk)

                yield context.events.chunk("\n\n---\n\n")
                yield context.events.section_complete("proposal")

                session.pending_input = InputPrompt(
                    prompt_id=f"decision_confirm_{current_step.step_number}",
                    question="この変更を採用しますか？",
                    options=["採用する", "採用しない"]
                )
                yield context.events.user_input_required(session.pending_input)
            else:
                # 単純な質問 → 回答をストリーミング
                yield context.events.section_start("answer")
                async for chunk in self._stream_answer_question(user_input, current_step, session.decisions, context):
                    yield context.events.chunk(chunk)
                yield context.events.section_complete("answer")

                # 再度ステップ確認を求める
                session.pending_input = InputPrompt(
                    prompt_id=f"step_{current_step.step_number}_complete",
                    question=f"質問に回答しました。ステップ{current_step.step_number}「{current_step.title}」は完了しましたか？",
                    options=["できた", "まだ質問がある", "スキップ"]
                )
                yield context.events.step_confirmation_required(session.pending_input)

    async def _analyze_question_for_decision(
        self,
        question: str,
        step: ImplementationStep,
        context: AgentContext
    ) -> dict:
        """
        質問を分析し、変更提案が含まれているか判断。
        含まれていれば提案内容を返す、なければNone。
        """
        prompt = f"""
ユーザーの入力を分析してください。

## ステップの内容
- ステップ{step.step_number}: {step.title}
- 内容: {step.content[:800] if step.content else step.description}

## ユーザーの入力
「{question}」

## 分析タスク
この入力が以下のどちらかを判断してください：

A) **変更提案・要望**: 技術選択、言語、ライブラリ、アプローチなどを変更したい意図がある
   例: 「TypeScriptの方がいい」「Reduxじゃなくてzustandを使いたい」「もっとシンプルにできない？」

B) **単純な質問**: 理解を深めるための質問、エラーの相談など
   例: 「これどういう意味？」「なぜこうするの？」「エラーが出た」

## 出力形式（JSON）
変更提案の場合:
{{"type": "decision", "proposal": "〇〇を使用する", "reason": "ユーザーが〇〇と言ったため"}}

単純な質問の場合:
{{"type": "question"}}
"""

        try:
            response = await context.llm.ainvoke([
                SystemMessage(content="JSON形式で回答してください。"),
                HumanMessage(content=prompt)
            ])

            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content.strip())

            if data.get("type") == "decision":
                return {
                    "proposal": data.get("proposal", ""),
                    "reason": data.get("reason", "")
                }
            return None
        except Exception:
            return None

    async def _stream_pros_cons_analysis(
        self,
        proposal: str,
        step: ImplementationStep,
        context: AgentContext
    ) -> AsyncGenerator[str, None]:
        """変更提案のメリット・デメリットをストリーミングで分析"""
        prompt = f"""
以下の変更提案について、メリットとデメリットを簡潔に分析してください。

## 変更提案
{proposal}

## 現在のステップ
- ステップ{step.step_number}: {step.title}
- 内容: {step.content[:500] if step.content else step.description}

## プロジェクト情報
- 技術スタック: {', '.join(context.tech_stack)}

## 出力形式
以下の形式で、簡潔に（全体で150-200文字程度）分析してください：

**メリット:**

✓ メリット1
✓ メリット2

**デメリット・注意点:**

△ 注意点1
△ 注意点2
"""

        async for chunk in context.llm.astream([
            SystemMessage(content="技術選定のアドバイザーとして、簡潔にメリデメを分析してください。"),
            HumanMessage(content=prompt)
        ]):
            if chunk.content:
                yield chunk.content

    async def _stream_answer_question(
        self,
        question: str,
        step: ImplementationStep,
        decisions: List,
        context: AgentContext
    ) -> AsyncGenerator[str, None]:
        """ステップに関する質問にストリーミングで回答"""
        # 既存の決定事項をコンテキストに含める
        decisions_context = ""
        if decisions:
            decisions_context = "\n## 採用済みの決定事項（これらを考慮して回答してください）\n"
            for d in decisions:
                decisions_context += f"- {d.description}\n"

        prompt = f"""
ユーザーからの質問に回答してください。

## 現在のステップ
- ステップ{step.step_number}: {step.title}
- 説明: {step.description}

## ステップの内容
{step.content[:1500] if step.content else '（コンテンツなし）'}
{decisions_context}

## ユーザーの質問
{question}

## 回答ルール
- わかりやすく丁寧に回答
- 具体的なコード例があれば含める
- 段落間には空行を入れる
- コードブロックの前後には空行を入れる
- 採用済みの決定事項がある場合は、それを考慮して回答してください
"""

        async for chunk in context.llm.astream([
            SystemMessage(content="あなたは丁寧な開発サポーターです。初心者にもわかりやすく説明してください。"),
            HumanMessage(content=prompt)
        ]):
            if chunk.content:
                yield chunk.content
