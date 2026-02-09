"""
VERIFICATIONフェーズハンドラ

動作確認手順の生成と完了処理。
"""

from typing import Dict, Any, AsyncGenerator

from langchain_core.messages import HumanMessage, SystemMessage

from ..types import GenerationPhase, SessionState
from ..context import AgentContext
from .base_phase import BasePhase
from .registry import register_phase


@register_phase(GenerationPhase.VERIFICATION)
class VerificationPhase(BasePhase):
    """
    VERIFICATIONフェーズ: 動作確認

    処理内容:
    1. 動作確認手順を生成
    2. COMPLETEフェーズへ遷移
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.VERIFICATION

    async def execute(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """VERIFICATIONフェーズを実行"""

        # 動作確認が未生成の場合のみ生成
        if not session.generated_content.get("verification"):
            yield context.events.section_start("verification")

            async for chunk in self._stream_verification(session, context):
                yield context.events.chunk(chunk)
                session.generated_content["verification"] = (
                    session.generated_content.get("verification", "") + chunk
                )

            yield context.events.section_complete("verification")
            yield context.events.progress_saved("verification")

        # 完了へ遷移
        self.transition_to(session, GenerationPhase.COMPLETE)

    async def _stream_verification(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[str, None]:
        """動作確認手順をストリーミング生成"""
        task = context.task

        # 実装したステップのサマリー
        steps_summary = ""
        for step in session.implementation_steps:
            steps_summary += f"- ステップ{step.step_number}: {step.title}\n"

        prompt = f"""
以下のタスクの動作確認手順を説明してください。

## タスク情報
- タイトル: {task.title}
- 説明: {task.description or 'なし'}

## 実装したステップ
{steps_summary}

## プロジェクト情報
- 技術スタック: {', '.join(context.tech_stack)}
- フレームワーク: {context.framework}

## 出力形式
Markdown形式で以下を含めてください：

### 動作確認

#### 確認項目
- 確認すべき項目のリスト

#### 確認手順
1. 具体的な確認手順

#### 期待される結果
- 正常に動作した場合の結果

**重要な書式ルール:**
- 各セクションの間には必ず空行を入れる
- 見出し（###, ####）の前後には空行を入れる
- コードブロックの前後には空行を入れる
"""

        async for chunk in context.llm.astream([
            SystemMessage(content="あなたは開発ガイドを作成するエキスパートです。"),
            HumanMessage(content=prompt)
        ]):
            if chunk.content:
                yield chunk.content


@register_phase(GenerationPhase.COMPLETE)
class CompletePhase(BasePhase):
    """
    COMPLETEフェーズ: 完了

    処理内容:
    1. 実装リソースを生成
    2. DBに最終保存
    3. 完了イベントを送信
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.COMPLETE

    async def execute(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """COMPLETEフェーズを実行"""
        # 実装リソースを生成（タスク完了時）
        implementation_resources = await self._generate_implementation_resources(session, context)

        # DBに最終保存
        from models.project_base import TaskHandsOn
        from ..state import (
            serialize_steps,
            serialize_decisions,
            build_user_interactions,
        )

        hands_on = context.db.query(TaskHandsOn).filter(
            TaskHandsOn.task_id == context.task.task_id
        ).first()

        if hands_on:
            # 生成済みコンテンツを各カラムに保存
            hands_on.overview = session.generated_content.get("overview", "")
            hands_on.implementation_steps = session.generated_content.get("implementation", "")
            hands_on.verification = session.generated_content.get("verification", "")
            hands_on.technical_context = session.generated_content.get("context", "")

            # 状態を完了に更新
            hands_on.generation_state = "completed"
            hands_on.pending_state = None  # 完了時はpending_stateクリア

            # user_interactionsに詳細情報を保存
            hands_on.user_interactions = build_user_interactions(session)

            # 実装リソースを保存
            if implementation_resources:
                hands_on.implementation_resources = implementation_resources

            context.db.commit()
            context.db.refresh(hands_on)

        # 完了イベント送信
        hands_on_id = str(hands_on.hands_on_id) if hands_on else ""
        yield context.events.done(hands_on_id, session.session_id)

    async def _generate_implementation_resources(
        self,
        session: SessionState,
        context: AgentContext
    ) -> dict:
        """
        タスク完了時に実装済みリソースをJSON形式で抽出

        Returns:
            {
                "apis": ["POST /api/chat", ...],
                "components": ["ChatComponent", ...],
                "services": ["GeminiService", ...],
                "files": ["src/app/api/chat/route.ts", ...],
                "tech_decisions": ["REST APIを使用", ...],
                "summary": "〇〇機能を実装"
            }
        """
        task = context.task
        overview = session.generated_content.get("overview", "")
        implementation = session.generated_content.get("implementation", "")

        # ステップ内容を取得
        steps_text = ""
        for step in session.implementation_steps:
            if step.content:
                steps_text += f"\n### {step.title}\n{step.content[:500]}\n"

        # ユーザーの技術選択を取得
        choices_text = ""
        if session.user_choices:
            choices_text = "\n## 技術選択\n"
            for choice_id, choice_data in session.user_choices.items():
                selected = choice_data.get("selected", "")
                if selected:
                    choices_text += f"- {selected}\n"

        prompt = f"""
以下の完了したタスクから、実装されたリソースと技術決定をJSON形式で抽出してください。

## タスク情報
- タイトル: {task.title}
- 説明: {task.description or 'なし'}

## 概要
{overview[:500]}

## 実装内容
{implementation[:1500]}

## ステップ
{steps_text[:1500]}
{choices_text}
## 出力形式（JSON）
{{
  "apis": ["POST /api/xxx", "GET /api/yyy"],
  "components": ["XxxComponent"],
  "services": ["XxxService"],
  "files": ["src/xxx/yyy.ts"],
  "tech_decisions": ["REST APIを使用", "TypeScriptを採用"],
  "summary": "〇〇機能を実装"
}}

**注意:**
- 存在しないものは空配列[]にする
- ファイルパスは主要なもののみ（最大5つ）
- summaryは20文字以内
"""

        try:
            import json
            response = await context.llm.ainvoke([
                SystemMessage(content="実装内容からリソースを抽出するアシスタントです。JSON形式で回答してください。"),
                HumanMessage(content=prompt)
            ])

            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            return json.loads(content.strip())
        except Exception:
            return {
                "apis": [],
                "components": [],
                "services": [],
                "files": [],
                "tech_decisions": [],
                "summary": task.title[:20] if task.title else ""
            }
