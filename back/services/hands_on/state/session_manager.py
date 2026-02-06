"""
セッション管理

インメモリセッションストアの管理とDB復元機能を提供。
"""

import uuid
from typing import Dict, Optional, TYPE_CHECKING

from ..types import (
    GenerationPhase,
    SessionState,
    ImplementationStep,
    Decision,
    ChoiceRequest,
    ChoiceOption,
    InputPrompt,
)

if TYPE_CHECKING:
    from models.project_base import TaskHandsOn


class SessionManager:
    """
    セッション管理クラス

    インメモリセッションストアを管理し、
    DBからのセッション復元機能を提供。
    """

    def __init__(self):
        self._store: Dict[str, SessionState] = {}

    def get(self, session_id: str) -> Optional[SessionState]:
        """セッションを取得"""
        return self._store.get(session_id)

    def create(
        self,
        task_id: str,
        initial_phase: GenerationPhase = GenerationPhase.DEPENDENCY_CHECK
    ) -> SessionState:
        """
        新しいセッションを作成（同じtask_idの古いセッションは削除）

        Args:
            task_id: タスクID
            initial_phase: 初期フェーズ

        Returns:
            新しいSessionState
        """
        # 同じtask_idの古いセッションを削除
        sessions_to_delete = [
            sid for sid, s in self._store.items()
            if s.task_id == task_id
        ]
        for sid in sessions_to_delete:
            del self._store[sid]

        session = SessionState(
            session_id=str(uuid.uuid4()),
            task_id=task_id,
            phase=initial_phase
        )
        self._store[session.session_id] = session
        return session

    def delete(self, session_id: str) -> bool:
        """セッションを削除"""
        if session_id in self._store:
            del self._store[session_id]
            return True
        return False

    def restore_from_db(
        self,
        hands_on: 'TaskHandsOn',
        task_id: str
    ) -> Optional[SessionState]:
        """
        DBからセッション状態を復元

        Args:
            hands_on: TaskHandsOnレコード
            task_id: タスクID

        Returns:
            復元されたSessionState、または復元不可の場合None
        """
        if not hands_on or not hands_on.user_interactions:
            return None

        interactions = hands_on.user_interactions
        phase_str = interactions.get("phase", "CONTEXT")

        # フェーズを復元
        try:
            phase = GenerationPhase(phase_str)
        except ValueError:
            phase = GenerationPhase.CONTEXT

        # 実装ステップを復元
        steps_data = interactions.get("steps", [])
        implementation_steps = [
            ImplementationStep(
                step_number=s["step_number"],
                title=s["title"],
                description=s["description"],
                content=s.get("content", ""),
                is_completed=s.get("is_completed", False),
                user_feedback=s.get("user_feedback")
            )
            for s in steps_data
        ]

        # 決定事項を復元
        decisions_data = interactions.get("decisions", [])
        decisions = [
            Decision(
                step_number=d["step_number"],
                description=d["description"],
                reason=d.get("reason", "")
            )
            for d in decisions_data
        ]

        # 保留中の入力プロンプトと選択肢を復元
        pending_input = None
        pending_choice = None

        # 新しいpending_stateフィールドから復元（優先）
        if hands_on.pending_state:
            pending_type = hands_on.pending_state.get("type")
            state_data = hands_on.pending_state.get("state", {})

            if pending_type == "choice" and "choice" in state_data:
                choice_data = state_data["choice"]
                pending_choice = ChoiceRequest(
                    choice_id=choice_data.get("choice_id", ""),
                    question=choice_data.get("question", ""),
                    options=[
                        ChoiceOption(
                            id=opt.get("id", ""),
                            label=opt.get("label", ""),
                            description=opt.get("description", ""),
                            pros=opt.get("pros", []),
                            cons=opt.get("cons", [])
                        )
                        for opt in choice_data.get("options", [])
                    ],
                    allow_custom=choice_data.get("allow_custom", True),
                    skip_allowed=choice_data.get("skip_allowed", False),
                    research_hint=choice_data.get("research_hint")
                )
            elif pending_type in ("input", "step_confirmation") and "input" in state_data:
                input_data = state_data["input"]
                pending_input = InputPrompt(
                    prompt_id=input_data.get("prompt_id", ""),
                    question=input_data.get("question", ""),
                    placeholder=input_data.get("placeholder"),
                    options=input_data.get("options")
                )
        else:
            # フォールバック: user_interactionsから復元
            pending_choice_data = interactions.get("pending_choice")
            if pending_choice_data:
                pending_choice = ChoiceRequest(
                    choice_id=pending_choice_data.get("choice_id", ""),
                    question=pending_choice_data.get("question", ""),
                    options=[
                        ChoiceOption(
                            id=opt.get("id", ""),
                            label=opt.get("label", ""),
                            description=opt.get("description", ""),
                            pros=opt.get("pros", []),
                            cons=opt.get("cons", [])
                        )
                        for opt in pending_choice_data.get("options", [])
                    ],
                    allow_custom=pending_choice_data.get("allow_custom", True),
                    skip_allowed=pending_choice_data.get("skip_allowed", False),
                    research_hint=pending_choice_data.get("research_hint")
                )

            pending_input_data = interactions.get("pending_input")
            if pending_input_data:
                pending_input = InputPrompt(
                    prompt_id=pending_input_data.get("prompt_id", ""),
                    question=pending_input_data.get("question", ""),
                    placeholder=pending_input_data.get("placeholder"),
                    options=pending_input_data.get("options")
                )

        # user_choicesを復元
        choices_data = interactions.get("choices", [])
        user_choices = {}
        for choice in choices_data:
            choice_id = choice.get("choice_id")
            if choice_id:
                # 新形式（domain_key/stack_key）と旧形式（selected）の両方に対応
                if "domain_key" in choice and "stack_key" in choice:
                    user_choices[choice_id] = {
                        "domain_key": choice.get("domain_key"),
                        "stack_key": choice.get("stack_key")
                    }
                else:
                    user_choices[choice_id] = {
                        "selected": choice.get("selected"),
                        "user_note": choice.get("user_note")
                    }

        # 生成済みコンテンツを復元
        generated_content = {
            "overview": hands_on.overview or "",
            "implementation": hands_on.implementation_steps or "",
            "verification": hands_on.verification or "",
            "context": hands_on.technical_context or ""
        }

        # ステップごとの技術選択を復元（キーをintに変換）
        step_choices_data = interactions.get("step_choices", {})
        step_choices = {
            int(k): v for k, v in step_choices_data.items()
        }

        # セッション作成
        session = SessionState(
            session_id=hands_on.session_id or str(uuid.uuid4()),
            task_id=task_id,
            phase=phase,
            generated_content=generated_content,
            user_choices=user_choices,
            user_inputs=interactions.get("inputs", {}),
            pending_choice=pending_choice,
            pending_input=pending_input,
            implementation_steps=implementation_steps,
            current_step_index=interactions.get("current_step", 0),
            step_choices=step_choices,
            decisions=decisions,
            pending_decision=interactions.get("pending_decision"),
            project_implementation_overview=interactions.get("project_implementation_overview", "")
        )

        # セッションストアに登録
        self._store[session.session_id] = session

        return session

    def clear_all(self) -> None:
        """全セッションを削除（テスト用）"""
        self._store.clear()

    @property
    def count(self) -> int:
        """セッション数を取得"""
        return len(self._store)


# グローバルインスタンス（後方互換性のため）
_default_manager = SessionManager()


def get_session(session_id: str) -> Optional[SessionState]:
    """セッションを取得（後方互換性関数）"""
    return _default_manager.get(session_id)


def create_session(
    task_id: str,
    initial_phase: GenerationPhase = GenerationPhase.DEPENDENCY_CHECK
) -> SessionState:
    """新しいセッションを作成（後方互換性関数）"""
    return _default_manager.create(task_id, initial_phase)


def delete_session(session_id: str) -> bool:
    """セッションを削除（後方互換性関数）"""
    return _default_manager.delete(session_id)


def restore_session_from_db(hands_on: 'TaskHandsOn', task_id: str) -> Optional[SessionState]:
    """DBからセッション状態を復元（後方互換性関数）"""
    return _default_manager.restore_from_db(hands_on, task_id)
