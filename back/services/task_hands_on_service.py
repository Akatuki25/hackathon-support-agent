"""
TaskHandsOnService: タスクハンズオン管理サービス

インタラクティブモード移行後の簡略化版
- 一括生成機能は廃止（interactive_hands_on_agent.py に移行）
- CRUD操作のみをサポート
"""

from typing import Dict, Optional
from sqlalchemy.orm import Session
from uuid import UUID

from models.project_base import (
    Task,
    TaskHandsOn,
)


class TaskHandsOnService:
    """
    タスクハンズオン管理サービス（CRUD操作のみ）

    インタラクティブ生成は interactive_hands_on_agent.py で行う
    """

    def __init__(self, db: Session):
        self.db = db

    def get_task_hands_on(self, task_id: UUID) -> Optional[Dict]:
        """
        タスクのハンズオンを取得

        Args:
            task_id: タスクID

        Returns:
            ハンズオン辞書（存在しない場合はhas_hands_on=False）
        """
        task = self.db.query(Task).filter_by(task_id=task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        hands_on = self.db.query(TaskHandsOn).filter_by(task_id=task_id).first()

        if not hands_on:
            return {
                "task_id": str(task.task_id),
                "task_title": task.title,
                "has_hands_on": False,
                "hands_on": None,
                "metadata": None
            }

        return {
            "task_id": str(task.task_id),
            "task_title": task.title,
            "has_hands_on": True,
            "hands_on": {
                "hands_on_id": str(hands_on.hands_on_id),
                "overview": hands_on.overview,
                "prerequisites": hands_on.prerequisites,
                "target_files": hands_on.target_files,
                "implementation_steps": hands_on.implementation_steps,
                "code_examples": hands_on.code_examples,
                "verification": hands_on.verification,
                "common_errors": hands_on.common_errors,
                "references": hands_on.references,
                "technical_context": hands_on.technical_context,
                "implementation_tips": hands_on.implementation_tips,
            },
            "metadata": {
                "generated_at": hands_on.generated_at.isoformat() if hands_on.generated_at else None,
                "quality_score": hands_on.quality_score,
                "generation_model": hands_on.generation_model,
                "information_freshness": hands_on.information_freshness.isoformat() if hands_on.information_freshness else None,
                "search_queries": hands_on.search_queries,
                "referenced_urls": hands_on.referenced_urls,
            }
        }

    def delete_project_hands_on(self, project_id: UUID) -> int:
        """
        プロジェクトの全ハンズオンを削除

        Args:
            project_id: プロジェクトID

        Returns:
            削除件数
        """
        # プロジェクトのタスクIDを取得
        task_ids = [
            task.task_id
            for task in self.db.query(Task).filter_by(project_id=project_id).all()
        ]

        if not task_ids:
            return 0

        # ハンズオンを削除
        deleted_count = (
            self.db.query(TaskHandsOn)
            .filter(TaskHandsOn.task_id.in_(task_ids))
            .delete(synchronize_session=False)
        )

        self.db.commit()

        return deleted_count
