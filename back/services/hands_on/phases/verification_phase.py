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
    1. 完了イベントを送信
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
        yield context.events.complete()
