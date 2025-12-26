"""
チャット機能の基盤モジュール

ページごとに異なる役割を持つチャットハンドラを提供する。
Google Search Grounding による検索機能付き（Geminiが自動判断）
"""

from .base_handler import (
    BaseChatHandler,
    ChatMessage,
    ChatAction,
    ChatResponse,
    ReferenceUrl,
)
from .chat_router import ChatRouter
from .actions import ActionType, PAGE_ACTIONS

__all__ = [
    "BaseChatHandler",
    "ChatMessage",
    "ChatAction",
    "ChatResponse",
    "ReferenceUrl",
    "ChatRouter",
    "ActionType",
    "PAGE_ACTIONS",
]
