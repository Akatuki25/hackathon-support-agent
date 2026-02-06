"""
SSEイベントタイプ定義
"""

from enum import Enum


class EventType(str, Enum):
    """SSEイベントタイプ"""
    # セクション
    SECTION_START = "section_start"
    SECTION_COMPLETE = "section_complete"

    # コンテンツ
    CHUNK = "chunk"

    # コンテキスト
    CONTEXT = "context"

    # 進捗
    PROGRESS_SAVED = "progress_saved"

    # ユーザーインタラクション
    CHOICE_REQUIRED = "choice_required"
    STEP_CHOICE_REQUIRED = "step_choice_required"
    USER_INPUT_REQUIRED = "user_input_required"
    STEP_CONFIRMATION_REQUIRED = "step_confirmation_required"
    USER_RESPONSE = "user_response"

    # ステップ
    STEP_START = "step_start"
    STEP_COMPLETE = "step_complete"

    # ナビゲーション
    REDIRECT_TO_TASK = "redirect_to_task"

    # 完了・エラー
    DONE = "done"
    ERROR = "error"
