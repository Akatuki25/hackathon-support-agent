"""
アイデア発想サポートサービス

ハッカソンのアイデアに困っているユーザーとチャット形式で対話し、
アイデアの「種」を見つけ出すサポートを行う。
"""

import logging
from typing import List, Optional, AsyncGenerator
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
from sqlalchemy.orm import Session

from ..core import BaseService


logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    """チャットメッセージ"""
    role: str  # "user" or "assistant"
    content: str


class FinalizedIdea(BaseModel):
    """確定したアイデア"""
    title: str
    idea: str


class IdeaProposal(BaseModel):
    """AIの応答から抽出されたアイデア提案"""
    has_proposal: bool = Field(
        description="応答に具体的なアイデア提案が含まれているかどうか"
    )
    title: Optional[str] = Field(
        default=None,
        description="提案されたアイデアのタイトル（提案がある場合）"
    )
    description: Optional[str] = Field(
        default=None,
        description="提案されたアイデアの説明（提案がある場合）"
    )


class IdeaSupportService(BaseService):
    """アイデア発想サポートサービス"""

    def __init__(self, db: Session):
        super().__init__(db)
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    async def chat_stream(
        self,
        message: str,
        chat_history: List[ChatMessage],
    ) -> AsyncGenerator[str, None]:
        """
        ユーザーメッセージに対してストリーミングで応答する

        Args:
            message: ユーザーからのメッセージ
            chat_history: これまでのチャット履歴

        Yields:
            応答テキストのチャンク
        """
        self.logger.info("Starting idea support chat stream")

        # プロンプトを取得
        system_prompt = self.get_prompt("idea_support_service", "chat_system")

        # チャット履歴をLangChain形式に変換
        messages = []
        for msg in chat_history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))

        # 新しいユーザーメッセージを追加
        messages.append(HumanMessage(content=message))

        # プロンプトテンプレート作成
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            *[(msg.type, msg.content) for msg in messages]
        ])

        # チェーン作成
        chain = prompt | self.llm_flash

        try:
            # ストリーミングで応答を生成
            async for chunk in chain.astream({}):
                text = getattr(chunk, "content", "") or ""
                if text:
                    yield text

            self.logger.info("Idea support chat stream completed")

        except Exception as e:
            self.logger.exception(f"Error in idea support chat stream: {e}")
            raise

    async def extract_proposal(self, ai_response: str) -> Optional[IdeaProposal]:
        """
        AIの応答から提案を抽出する（Structured Output使用）

        Args:
            ai_response: AIの応答テキスト

        Returns:
            提案が含まれていればIdeaProposal、なければNone
        """
        self.logger.info("Extracting proposal from AI response")

        # 提案抽出用のプロンプト
        extraction_prompt = ChatPromptTemplate.from_messages([
            ("system", """あなたはAIの応答を分析するエキスパートです。
以下のAI応答に、ユーザーへの具体的なアイデア提案が含まれているかを判定してください。

提案とは：
- ハッカソンで作れる具体的なプロジェクトアイデア
- タイトル案と説明がセットになっているもの
- 「こんなのどう？」「〜を作ってみない？」のような形で提示されているもの

提案ではないもの：
- 単なる質問
- ユーザーの意見を聞いているだけ
- まだ具体的なアイデアになっていない方向性の話"""),
            ("human", "以下のAI応答を分析してください:\n\n{response}")
        ])

        # 構造化出力でプロポーザルを抽出
        chain = extraction_prompt | self.llm_flash.with_structured_output(IdeaProposal)

        try:
            result = await chain.ainvoke({"response": ai_response})

            if result.has_proposal and result.title and result.description:
                self.logger.info(f"Proposal extracted: title='{result.title}'")
                return result
            else:
                self.logger.info("No proposal found in response")
                return None

        except Exception as e:
            self.logger.warning(f"Failed to extract proposal: {e}")
            return None

    async def finalize_idea(
        self,
        chat_history: List[ChatMessage],
    ) -> FinalizedIdea:
        """
        チャット履歴からアイデアを確定する

        Args:
            chat_history: これまでのチャット履歴

        Returns:
            確定したタイトルとアイデア
        """
        self.logger.info("Finalizing idea from chat history")

        # プロンプトを取得
        finalize_prompt = self.get_prompt("idea_support_service", "finalize_idea")

        # チャット履歴を文字列に変換
        history_text = "\n".join([
            f"{'ユーザー' if msg.role == 'user' else 'AI'}: {msg.content}"
            for msg in chat_history
        ])

        # プロンプトテンプレート作成
        prompt = ChatPromptTemplate.from_messages([
            ("system", finalize_prompt),
            ("human", "以下のチャット履歴からアイデアを抽出してください:\n\n{history}")
        ])

        # 構造化出力を使用
        chain = prompt | self.llm_flash.with_structured_output(FinalizedIdea)

        try:
            result = await chain.ainvoke({"history": history_text})
            self.logger.info(f"Finalized idea: title='{result.title}'")
            return result

        except Exception as e:
            self.logger.exception(f"Error finalizing idea: {e}")
            raise
