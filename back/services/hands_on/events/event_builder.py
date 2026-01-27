"""
SSEイベント生成ヘルパー

既存のイベント形式を維持しながら、イベント生成を共通化。
"""

from typing import Dict, List, Any, Optional
from dataclasses import asdict

from ..types import ChoiceRequest, ChoiceOption, InputPrompt
from .event_types import EventType


class EventBuilder:
    """SSEイベントを生成するヘルパークラス"""

    # --- セクション ---

    @staticmethod
    def section_start(section: str) -> Dict[str, Any]:
        """セクション開始イベント"""
        return {"type": EventType.SECTION_START.value, "section": section}

    @staticmethod
    def section_complete(section: str) -> Dict[str, Any]:
        """セクション完了イベント"""
        return {"type": EventType.SECTION_COMPLETE.value, "section": section}

    # --- コンテンツ ---

    @staticmethod
    def chunk(content: str) -> Dict[str, Any]:
        """テキストチャンクイベント"""
        return {"type": EventType.CHUNK.value, "content": content}

    # --- コンテキスト ---

    @staticmethod
    def context(
        position: str,
        dependencies: List[str],
        dependents: List[str]
    ) -> Dict[str, Any]:
        """コンテキスト情報イベント"""
        return {
            "type": EventType.CONTEXT.value,
            "position": position,
            "dependencies": dependencies,
            "dependents": dependents
        }

    # --- 進捗 ---

    @staticmethod
    def progress_saved(phase: str) -> Dict[str, Any]:
        """進捗保存完了イベント"""
        return {"type": EventType.PROGRESS_SAVED.value, "phase": phase}

    # --- ユーザーインタラクション ---

    @staticmethod
    def choice_required(choice: ChoiceRequest) -> Dict[str, Any]:
        """選択肢提示イベント"""
        return {
            "type": EventType.CHOICE_REQUIRED.value,
            "choice": {
                "choice_id": choice.choice_id,
                "question": choice.question,
                "options": [
                    {
                        "id": opt.id,
                        "label": opt.label,
                        "description": opt.description,
                        "pros": opt.pros,
                        "cons": opt.cons
                    }
                    for opt in choice.options
                ],
                "allow_custom": choice.allow_custom,
                "skip_allowed": choice.skip_allowed
            }
        }

    @staticmethod
    def step_choice_required(
        step_number: int,
        choice_id: str,
        question: str,
        options: List[Dict[str, Any]],
        allow_custom: bool = True
    ) -> Dict[str, Any]:
        """ステップ内技術選定イベント"""
        return {
            "type": EventType.STEP_CHOICE_REQUIRED.value,
            "step_number": step_number,
            "choice": {
                "choice_id": choice_id,
                "question": question,
                "options": options,
                "allow_custom": allow_custom
            }
        }

    @staticmethod
    def user_input_required(prompt: InputPrompt) -> Dict[str, Any]:
        """ユーザー入力要求イベント"""
        return {
            "type": EventType.USER_INPUT_REQUIRED.value,
            "prompt": {
                "prompt_id": prompt.prompt_id,
                "question": prompt.question,
                "placeholder": prompt.placeholder,
                "options": prompt.options
            }
        }

    @staticmethod
    def step_confirmation_required(
        prompt: InputPrompt = None,
        *,
        prompt_id: str = None,
        question: str = None,
        options: List[str] = None
    ) -> Dict[str, Any]:
        """ステップ完了確認イベント"""
        if prompt:
            return {
                "type": EventType.STEP_CONFIRMATION_REQUIRED.value,
                "prompt": {
                    "prompt_id": prompt.prompt_id,
                    "question": prompt.question,
                    "options": prompt.options
                }
            }
        return {
            "type": EventType.STEP_CONFIRMATION_REQUIRED.value,
            "prompt": {
                "prompt_id": prompt_id,
                "question": question,
                "options": options
            }
        }

    @staticmethod
    def user_response(
        response_type: str,
        choice_id: Optional[str] = None,
        selected: Optional[str] = None,
        user_input: Optional[str] = None,
        user_note: Optional[str] = None
    ) -> Dict[str, Any]:
        """ユーザー応答イベント"""
        return {
            "type": EventType.USER_RESPONSE.value,
            "response_type": response_type,
            "choice_id": choice_id,
            "selected": selected,
            "user_input": user_input,
            "user_note": user_note
        }

    # --- ステップ ---

    @staticmethod
    def step_start(
        step_number: int,
        step_title: str,
        total_steps: int
    ) -> Dict[str, Any]:
        """ステップ開始イベント"""
        return {
            "type": EventType.STEP_START.value,
            "step_number": step_number,
            "step_title": step_title,
            "total_steps": total_steps
        }

    @staticmethod
    def step_complete(step_number: int) -> Dict[str, Any]:
        """ステップ完了イベント"""
        return {"type": EventType.STEP_COMPLETE.value, "step_number": step_number}

    # --- ナビゲーション ---

    @staticmethod
    def redirect_to_task(
        task_id: str,
        task_title: str,
        message: str
    ) -> Dict[str, Any]:
        """タスクリダイレクトイベント"""
        return {
            "type": EventType.REDIRECT_TO_TASK.value,
            "task_id": task_id,
            "task_title": task_title,
            "message": message
        }

    # --- 依存タスク ---

    @staticmethod
    def redirect_to_dependency() -> Dict[str, Any]:
        """依存タスクへリダイレクトイベント"""
        return {"type": "redirect_to_dependency"}

    @staticmethod
    def dependency_decision_required(
        prompt_id: str,
        question: str,
        options: List[str]
    ) -> Dict[str, Any]:
        """依存タスク対応方針選択イベント"""
        return {
            "type": "dependency_decision_required",
            "prompt": {
                "prompt_id": prompt_id,
                "question": question,
                "options": options
            }
        }

    # --- 完了・エラー ---

    @staticmethod
    def complete() -> Dict[str, Any]:
        """生成完了イベント（シンプル版）"""
        return {"type": EventType.DONE.value}

    @staticmethod
    def done(hands_on_id: str, session_id: str) -> Dict[str, Any]:
        """生成完了イベント"""
        return {
            "type": EventType.DONE.value,
            "hands_on_id": hands_on_id,
            "session_id": session_id
        }

    @staticmethod
    def error(message: str) -> Dict[str, Any]:
        """エラーイベント"""
        return {"type": EventType.ERROR.value, "message": message}
