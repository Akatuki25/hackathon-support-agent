"""
チャットアクションの定義

各ページで利用可能なアクションタイプと、ページごとのマッピングを管理。
"""

from enum import Enum
from typing import Dict, List


class ActionType(str, Enum):
    """チャットが提案できるアクションのタイプ"""

    # hackQA用: Q&A回答支援
    SUGGEST_ANSWER = "suggest_answer"  # 回答候補を提示
    ADD_QUESTION = "add_question"  # 追加質問を生成

    # summaryQA用: 仕様書レビュー支援
    REPLACE_SECTION = "replace_section"  # セクション置換提案
    REGENERATE_QUESTIONS = "regenerate_questions"  # 追加質問を再生成

    # functionStructuring用: 機能設計支援
    EXPLAIN_FUNCTION = "explain_function"  # 機能の意図説明
    SUGGEST_PRIORITY = "suggest_priority"  # 優先度変更提案
    ADD_FUNCTION = "add_function"  # 機能追加提案

    # selectFramework用: 技術選定支援
    COMPARE_TECH = "compare_tech"  # 技術比較表示
    RECOMMEND_TECH = "recommend_tech"  # 技術推薦

    # kanban用: タスク分担支援
    SUGGEST_ASSIGNEE = "suggest_assignee"  # 担当者提案
    SHOW_WORKLOAD = "show_workload"  # 負荷分析表示

    # taskDetail用: 実装支援
    ADJUST_HANDS_ON = "adjust_hands_on"  # ハンズオン内容をユーザーレベルに調整


# ページごとの利用可能アクション
PAGE_ACTIONS: Dict[str, List[ActionType]] = {
    "hackQA": [
        ActionType.SUGGEST_ANSWER,
        ActionType.ADD_QUESTION,
    ],
    "summaryQA": [
        ActionType.REGENERATE_QUESTIONS,  # 追加質問を再生成
    ],
    "functionSummary": [
        ActionType.REGENERATE_QUESTIONS,  # 追加質問を再生成
    ],
    "functionStructuring": [
        ActionType.EXPLAIN_FUNCTION,
        ActionType.SUGGEST_PRIORITY,
        ActionType.ADD_FUNCTION,
    ],
    "selectFramework": [
        # アクションなし - UIでAI推薦機能が既にある
    ],
    "kanban": [
        # アクションなし - UIでドラッグ＆ドロップで割り当て可能
    ],
    "taskDetail": [
        ActionType.ADJUST_HANDS_ON,
    ],
}


def get_available_actions(page_context: str) -> List[ActionType]:
    """
    指定されたページで利用可能なアクションタイプを取得

    Args:
        page_context: ページ識別子

    Returns:
        利用可能なアクションタイプのリスト
    """
    return PAGE_ACTIONS.get(page_context, [])


def is_valid_action(page_context: str, action_type: str) -> bool:
    """
    指定されたアクションがそのページで有効かチェック

    Args:
        page_context: ページ識別子
        action_type: アクションタイプ

    Returns:
        有効な場合True
    """
    available = get_available_actions(page_context)
    try:
        action = ActionType(action_type)
        return action in available
    except ValueError:
        return False
