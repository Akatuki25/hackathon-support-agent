"""
プロジェクトフェーズ管理ユーティリティ

このモジュールは、プロジェクトのフェーズ（進行段階）を管理する機能を提供します。
各フェーズの遷移を記録し、プロジェクトの状態を追跡します。
"""

from sqlalchemy.orm import Session
from models.project_base import ProjectBase
from datetime import datetime
import json
from typing import Optional, List, Dict


class PhaseManager:
    """プロジェクトフェーズを管理するクラス"""

    # 有効なフェーズ一覧
    VALID_PHASES = [
        "initial",
        "qa_editing",
        "summary_review",
        "framework_selection",
        "function_review",
        "function_structuring",
        "task_management",
    ]

    @staticmethod
    def update_phase(
        db: Session,
        project_id: str,
        new_phase: str,
        add_to_history: bool = True
    ) -> ProjectBase:
        """
        プロジェクトのフェーズを更新

        Args:
            db: データベースセッション
            project_id: プロジェクトID
            new_phase: 新しいフェーズ名
            add_to_history: 履歴に追加するか

        Returns:
            更新されたProjectBaseオブジェクト

        Raises:
            ValueError: プロジェクトが見つからない、または無効なフェーズ名の場合
        """
        # フェーズの妥当性チェック
        if new_phase not in PhaseManager.VALID_PHASES:
            raise ValueError(
                f"Invalid phase: {new_phase}. Valid phases are: {PhaseManager.VALID_PHASES}"
            )

        # プロジェクトを取得
        project = db.query(ProjectBase).filter(
            ProjectBase.project_id == project_id
        ).first()

        if not project:
            raise ValueError(f"Project {project_id} not found")

        # 履歴に追加
        if add_to_history:
            history = project.phase_history or []
            if isinstance(history, str):
                history = json.loads(history)

            history.append({
                "from_phase": project.current_phase,
                "to_phase": new_phase,
                "timestamp": datetime.now().isoformat()
            })
            project.phase_history = history

        # フェーズ更新
        old_phase = project.current_phase
        project.current_phase = new_phase
        project.phase_updated_at = datetime.now()

        db.commit()
        db.refresh(project)

        print(f"✅ Phase updated: {old_phase} → {new_phase} (Project: {project_id})")

        return project

    @staticmethod
    def get_current_phase(db: Session, project_id: str) -> Optional[str]:
        """
        現在のフェーズを取得

        Args:
            db: データベースセッション
            project_id: プロジェクトID

        Returns:
            現在のフェーズ名、プロジェクトが見つからない場合はNone
        """
        project = db.query(ProjectBase).filter(
            ProjectBase.project_id == project_id
        ).first()

        return project.current_phase if project else None

    @staticmethod
    def get_phase_history(db: Session, project_id: str) -> List[Dict]:
        """
        フェーズ遷移履歴を取得

        Args:
            db: データベースセッション
            project_id: プロジェクトID

        Returns:
            フェーズ遷移履歴のリスト
        """
        project = db.query(ProjectBase).filter(
            ProjectBase.project_id == project_id
        ).first()

        if not project:
            return []

        history = project.phase_history or []
        if isinstance(history, str):
            history = json.loads(history)

        return history

    @staticmethod
    def can_transition_to(current_phase: str, target_phase: str) -> bool:
        """
        指定されたフェーズへの遷移が可能かチェック

        Args:
            current_phase: 現在のフェーズ
            target_phase: 遷移先のフェーズ

        Returns:
            遷移可能な場合True
        """
        try:
            current_index = PhaseManager.VALID_PHASES.index(current_phase)
            target_index = PhaseManager.VALID_PHASES.index(target_phase)
            # 前進のみ許可（後戻りは許可しない）
            return target_index >= current_index
        except ValueError:
            return False

    @staticmethod
    def get_next_phase(current_phase: str) -> Optional[str]:
        """
        次のフェーズを取得

        Args:
            current_phase: 現在のフェーズ

        Returns:
            次のフェーズ名、最終フェーズの場合はNone
        """
        try:
            current_index = PhaseManager.VALID_PHASES.index(current_phase)
            if current_index < len(PhaseManager.VALID_PHASES) - 1:
                return PhaseManager.VALID_PHASES[current_index + 1]
            return None
        except ValueError:
            return None
