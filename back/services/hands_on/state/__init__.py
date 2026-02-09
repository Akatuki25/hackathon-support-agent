"""
状態管理モジュール

セッション管理と永続化ヘルパーを提供。
"""

from .session_manager import (
    SessionManager,
    _default_manager as default_manager,
    get_session,
    create_session,
    delete_session,
    restore_session_from_db,
)
from .persistence import (
    serialize_steps,
    serialize_decisions,
    serialize_pending_input,
    serialize_pending_choice,
    build_pending_state,
    build_user_interactions,
)

__all__ = [
    # Session Manager
    "SessionManager",
    "default_manager",
    "get_session",
    "create_session",
    "delete_session",
    "restore_session_from_db",
    # Persistence helpers
    "serialize_steps",
    "serialize_decisions",
    "serialize_pending_input",
    "serialize_pending_choice",
    "build_pending_state",
    "build_user_interactions",
]
