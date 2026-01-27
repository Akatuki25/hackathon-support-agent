"""
OVERVIEWフェーズハンドラ

タスクの概要を生成するフェーズ。
"""

from typing import Dict, Any, AsyncGenerator

from langchain_core.messages import HumanMessage, SystemMessage

from ..types import GenerationPhase, SessionState
from ..context import AgentContext
from .base_phase import BasePhase
from .registry import register_phase


@register_phase(GenerationPhase.OVERVIEW)
class OverviewPhase(BasePhase):
    """
    OVERVIEWフェーズ: タスクの概要を生成

    処理内容:
    1. 概要が未生成の場合のみ生成
    2. LLMでストリーミング生成
    3. TECH_CHECKフェーズへ遷移
    """

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.OVERVIEW

    async def execute(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """OVERVIEWフェーズを実行"""

        # 概要が未生成の場合のみ生成
        if not session.generated_content.get("overview"):
            # セクション開始
            yield context.events.section_start("overview")

            # LLMでストリーミング生成
            async for chunk in self._stream_overview(context):
                yield context.events.chunk(chunk)
                session.generated_content["overview"] = (
                    session.generated_content.get("overview", "") + chunk
                )

            # セクション完了
            yield context.events.section_complete("overview")

            # 進捗保存イベント
            yield context.events.progress_saved("overview")

        # 次のフェーズへ遷移
        self.transition_to(session, GenerationPhase.TECH_CHECK)

    async def _stream_overview(
        self,
        context: AgentContext
    ) -> AsyncGenerator[str, None]:
        """概要をストリーミング生成"""
        task = context.task

        prompt = f"""
以下のタスクの概要を説明してください。
このタスクで何を実装するか、なぜ必要かを簡潔に説明してください。

## タスク情報
- タイトル: {task.title}
- 説明: {task.description or 'なし'}
- カテゴリ: {task.category or '未分類'}
- 優先度: {task.priority or 'Must'}

## プロジェクト情報
- 技術スタック: {', '.join(context.tech_stack)}
- フレームワーク: {context.framework}

## 出力形式
Markdown形式で、200-300文字程度で説明してください。

**重要な書式ルール:**
- 段落間には必ず空行を入れる
- 見出し（##, ###）の前後には空行を入れる
- 箇条書きの前後には空行を入れる
"""

        async for chunk in context.llm.astream([
            SystemMessage(content="あなたは開発ガイドを作成するエキスパートです。"),
            HumanMessage(content=prompt)
        ]):
            if chunk.content:
                yield chunk.content
