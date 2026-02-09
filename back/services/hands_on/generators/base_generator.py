"""
ジェネレータ基底クラス

LLMを使用したコンテンツ生成の共通パターンを提供。
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, AsyncGenerator, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage

from ..context import AgentContext
from ..types import SessionState


class BaseGenerator(ABC):
    """
    ジェネレータ基底クラス

    LLMストリーミングの共通パターンを提供。

    サブクラスでの実装例:
        class PlanGenerator(BaseGenerator):
            async def generate(self, session, context):
                prompt = self.build_prompt(session, context)
                async for chunk in self.stream_llm(context, prompt):
                    yield chunk
    """

    @abstractmethod
    async def generate(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[str, None]:
        """
        コンテンツを生成

        Args:
            session: 現在のセッション状態
            context: エージェントコンテキスト

        Yields:
            生成されたコンテンツのチャンク
        """
        pass

    async def stream_llm(
        self,
        context: AgentContext,
        messages: List[BaseMessage]
    ) -> AsyncGenerator[str, None]:
        """
        LLMからストリーミングでレスポンスを取得

        Args:
            context: エージェントコンテキスト
            messages: LLMに送信するメッセージリスト

        Yields:
            レスポンスのチャンク
        """
        async for chunk in context.llm.astream(messages):
            if chunk.content:
                yield chunk.content

    def build_messages(
        self,
        system_prompt: str,
        user_prompt: str
    ) -> List[BaseMessage]:
        """
        システムプロンプトとユーザープロンプトからメッセージリストを構築

        Args:
            system_prompt: システムプロンプト
            user_prompt: ユーザープロンプト

        Returns:
            メッセージリスト
        """
        return [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]

    def format_tech_choices(
        self,
        user_choices: Dict[str, Any],
        context: AgentContext
    ) -> str:
        """
        ユーザーの技術選択を文字列にフォーマット

        Args:
            user_choices: ユーザー選択辞書
            context: エージェントコンテキスト

        Returns:
            フォーマットされた選択テキスト
        """
        if not user_choices:
            return ""

        choices_text = ""
        for choice_id, choice_data in user_choices.items():
            if "domain_key" in choice_data and "stack_key" in choice_data:
                # 新形式: DBプリセットからの選択
                if context.tech_service:
                    domain = context.tech_service.get_domain_by_key(
                        choice_data["domain_key"]
                    )
                    domain_name = domain.name if domain else choice_data["domain_key"]
                else:
                    domain_name = choice_data["domain_key"]
                choices_text += f"- {domain_name}: {choice_data['stack_key']}\n"
            else:
                # 従来形式（後方互換）
                choices_text += f"- 選択: {choice_data.get('selected', 'なし')}\n"

        return choices_text

    def format_decided_tech(
        self,
        decided_domains: Dict[str, str],
        context: AgentContext
    ) -> str:
        """
        プロジェクトで決定済みの技術を文字列にフォーマット

        Args:
            decided_domains: 決定済みドメイン辞書
            context: エージェントコンテキスト

        Returns:
            フォーマットされた技術テキスト
        """
        if not decided_domains:
            return ""

        section = "\n## プロジェクトで決定済みの技術（必ず使用すること）\n"
        for domain_key, stack_key in decided_domains.items():
            if context.tech_service:
                domain = context.tech_service.get_domain_by_key(domain_key)
                domain_name = domain.name if domain else domain_key
            else:
                domain_name = domain_key
            section += f"- {domain_name}: {stack_key}\n"

        return section

    def format_dependency_summary(
        self,
        session: SessionState
    ) -> str:
        """
        依存タスクの実装サマリーをフォーマット

        Args:
            session: セッション状態

        Returns:
            依存タスクサマリーテキスト
        """
        if not session.predecessor_tasks:
            return ""

        completed_deps = [
            dep for dep in session.predecessor_tasks
            if dep.hands_on_status == "completed" and dep.implementation_summary
        ]

        if not completed_deps:
            return ""

        summary = "\n## 直接依存タスクで実装済みの内容（必ず利用すること）\n"
        for dep in completed_deps:
            summary += f"\n### {dep.title}\n{dep.implementation_summary}\n"

        return summary

    def format_project_overview(
        self,
        session: SessionState
    ) -> str:
        """
        プロジェクト実装概要をフォーマット

        Args:
            session: セッション状態

        Returns:
            プロジェクト概要テキスト
        """
        if not session.project_implementation_overview:
            return ""

        return f"""
## プロジェクト内で実装済みの機能（重複実装を避けること）
以下の機能は既に他のタスクで実装済みです。再実装せず、既存のものを利用してください。

{session.project_implementation_overview}
"""

    def format_mock_instruction(
        self,
        session: SessionState
    ) -> str:
        """
        モック実装モードの指示をフォーマット

        Args:
            session: セッション状態

        Returns:
            モック指示テキスト
        """
        if session.dependency_decision != "mock":
            return ""

        incomplete_deps = [
            dep for dep in session.predecessor_tasks
            if dep.hands_on_status != "completed"
        ]

        if not incomplete_deps:
            return ""

        dep_titles = ", ".join([dep.title for dep in incomplete_deps])
        return f"""
## モック実装について
依存タスク「{dep_titles}」が未完了のため、モック実装で進めます。
- 依存タスクとの接続部分はインターフェースを明確に定義
- モックデータやスタブ関数を使用
- 後で結合しやすいように設計
"""

    def format_successor_tasks(
        self,
        session: SessionState
    ) -> str:
        """
        後続タスク情報をフォーマット

        Args:
            session: セッション状態

        Returns:
            後続タスクテキスト
        """
        if not session.successor_tasks:
            return ""

        text = "\n## このタスクの後に実装予定のタスク（これらはこのタスクのスコープ外）\n"
        for st in session.successor_tasks:
            desc = st.description[:100] if st.description else "なし"
            text += f"- {st.title}: {desc}\n"

        return text
