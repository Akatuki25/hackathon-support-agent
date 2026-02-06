"""
永続化ヘルパー

セッション状態のシリアライズ/デシリアライズを提供。
DB操作自体は呼び出し側で行う（InteractiveHandsOnAgent._save_progress）。
"""

from typing import Dict, List, Any, Optional
from datetime import datetime

from ..types import (
    SessionState,
    GenerationPhase,
    ImplementationStep,
    Decision,
    ChoiceRequest,
    InputPrompt,
)


def serialize_steps(steps: List[ImplementationStep]) -> List[Dict[str, Any]]:
    """実装ステップをJSON用に変換"""
    return [
        {
            "step_number": s.step_number,
            "title": s.title,
            "description": s.description,
            "content": s.content,
            "is_completed": s.is_completed,
            "user_feedback": s.user_feedback
        }
        for s in steps
    ]


def serialize_decisions(decisions: List[Decision]) -> List[Dict[str, Any]]:
    """決定事項をJSON用に変換"""
    return [
        {
            "step_number": d.step_number,
            "description": d.description,
            "reason": d.reason
        }
        for d in decisions
    ]


def serialize_pending_input(pending_input: Optional[InputPrompt]) -> Optional[Dict[str, Any]]:
    """保留中の入力プロンプトをJSON用に変換"""
    if not pending_input:
        return None
    return {
        "prompt_id": pending_input.prompt_id,
        "question": pending_input.question,
        "placeholder": pending_input.placeholder,
        "options": pending_input.options
    }


def serialize_pending_choice(pending_choice: Optional[ChoiceRequest]) -> Optional[Dict[str, Any]]:
    """保留中の選択肢をJSON用に変換"""
    if not pending_choice:
        return None
    return {
        "choice_id": pending_choice.choice_id,
        "question": pending_choice.question,
        "options": [
            {
                "id": opt.id,
                "label": opt.label,
                "description": opt.description,
                "pros": opt.pros,
                "cons": opt.cons
            }
            for opt in pending_choice.options
        ],
        "allow_custom": pending_choice.allow_custom,
        "skip_allowed": pending_choice.skip_allowed,
        "research_hint": pending_choice.research_hint
    }


def build_pending_state(session: SessionState) -> Optional[Dict[str, Any]]:
    """
    確認待ち状態をpending_stateフィールド用に構築

    セッション復帰時に正確に状態を復元するため。
    """
    if session.pending_choice:
        return {
            "type": "choice",
            "state": {"choice": serialize_pending_choice(session.pending_choice)},
            "entered_at": datetime.now().isoformat(),
            "phase": session.phase.value
        }
    elif session.pending_input:
        # ステップ完了確認か通常の入力かを判定
        pending_type = (
            "step_confirmation"
            if session.phase == GenerationPhase.WAITING_STEP_COMPLETE
            else "input"
        )
        return {
            "type": pending_type,
            "state": {"input": serialize_pending_input(session.pending_input)},
            "entered_at": datetime.now().isoformat(),
            "phase": session.phase.value
        }
    return None


def build_user_interactions(session: SessionState) -> Dict[str, Any]:
    """
    user_interactionsフィールド用のデータを構築

    Args:
        session: セッション状態

    Returns:
        user_interactions用の辞書
    """
    # ユーザーインタラクション履歴
    interactions = [
        {"type": "choice", "choice_id": k, **v}
        for k, v in session.user_choices.items()
    ]

    # ステップごとの技術選択をJSON化（キーをstrに変換）
    step_choices_data = {
        str(k): v for k, v in session.step_choices.items()
    }

    return {
        "choices": interactions,
        "inputs": session.user_inputs,
        "steps": serialize_steps(session.implementation_steps),
        "current_step": session.current_step_index,
        "phase": session.phase.value,
        "decisions": serialize_decisions(session.decisions),
        "pending_decision": session.pending_decision,
        "pending_input": serialize_pending_input(session.pending_input),
        "pending_choice": serialize_pending_choice(session.pending_choice),
        "step_choices": step_choices_data,
        "project_implementation_overview": session.project_implementation_overview
    }
