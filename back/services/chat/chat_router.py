"""
チャットルーター

ページコンテキストに応じて適切なハンドラを選択・生成する。
"""

from typing import Dict, Type, List, Optional
from sqlalchemy.orm import Session

from .base_handler import BaseChatHandler
from .actions import PAGE_ACTIONS


class ChatRouter:
    """
    ページコンテキストに応じてハンドラを切り替えるルーター

    使用例:
        @ChatRouter.register("hackQA")
        class QAAdviceHandler(BaseChatHandler):
            ...

        handler = ChatRouter.get_handler("hackQA", project_id, db, llm, prompts)
    """

    _handlers: Dict[str, Type[BaseChatHandler]] = {}

    @classmethod
    def register(cls, page_context: str):
        """
        ハンドラ登録用デコレータ

        Args:
            page_context: ページ識別子

        Returns:
            デコレータ関数

        使用例:
            @ChatRouter.register("hackQA")
            class QAAdviceHandler(BaseChatHandler):
                ...
        """

        def decorator(handler_class: Type[BaseChatHandler]):
            if page_context in cls._handlers:
                raise ValueError(
                    f"Handler already registered for page_context: {page_context}"
                )
            cls._handlers[page_context] = handler_class
            return handler_class

        return decorator

    @classmethod
    def get_handler(
        cls,
        page_context: str,
        project_id: str,
        db: Session,
        llm,
        prompts: Dict[str, Dict[str, str]],
    ) -> BaseChatHandler:
        """
        ページに対応するハンドラを取得

        Args:
            page_context: ページ識別子
            project_id: プロジェクトID
            db: DBセッション
            llm: LangChain LLMインスタンス
            prompts: プロンプト辞書

        Returns:
            対応するハンドラのインスタンス

        Raises:
            ValueError: 未登録のpage_contextが指定された場合
        """
        handler_class = cls._handlers.get(page_context)
        if not handler_class:
            available = cls.list_contexts()
            raise ValueError(
                f"Unknown page_context: '{page_context}'. "
                f"Available contexts: {available}"
            )
        return handler_class(project_id, db, llm, prompts)

    @classmethod
    def list_contexts(cls) -> List[str]:
        """
        登録済みコンテキスト一覧を取得

        Returns:
            登録済みページコンテキストのリスト
        """
        return list(cls._handlers.keys())

    @classmethod
    def is_registered(cls, page_context: str) -> bool:
        """
        指定されたコンテキストが登録済みかチェック

        Args:
            page_context: ページ識別子

        Returns:
            登録済みの場合True
        """
        return page_context in cls._handlers

    @classmethod
    def get_all_page_actions(cls) -> Dict[str, List[str]]:
        """
        全ページのアクション一覧を取得

        Returns:
            ページ識別子をキー、アクションタイプのリストを値とする辞書
        """
        return {
            page: [action.value for action in actions]
            for page, actions in PAGE_ACTIONS.items()
        }

    @classmethod
    def unregister(cls, page_context: str) -> bool:
        """
        ハンドラの登録を解除（主にテスト用）

        Args:
            page_context: ページ識別子

        Returns:
            解除成功の場合True
        """
        if page_context in cls._handlers:
            del cls._handlers[page_context]
            return True
        return False

    @classmethod
    def clear_all(cls) -> None:
        """
        全てのハンドラ登録を解除（主にテスト用）
        """
        cls._handlers.clear()
