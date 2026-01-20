"""
TaskHandsOnService: タスクハンズオン生成の統合サービス

Phase 3: 依存関係解析、優先度ソート、バッチ処理を管理
"""

from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import UUID
import uuid
from datetime import datetime
import json

from models.project_base import (
    Task,
    TaskDependency,
    TaskHandsOn,
    HandsOnGenerationJob,
    ProjectBase,
    ProjectDocument
)
from services.task_hands_on_agent import TaskHandsOnAgent


class TaskHandsOnService:
    """
    タスクハンズオン生成の統合サービス

    Phase 2のIntegratedTaskServiceパターンを踏襲
    """

    def __init__(self, db: Session):
        self.db = db

    def create_generation_job(
        self,
        project_id: UUID,
        config: Optional[Dict] = None,
        target_task_ids: Optional[List[UUID]] = None
    ) -> HandsOnGenerationJob:
        """
        ハンズオン生成ジョブを作成

        Args:
            project_id: プロジェクトID
            config: 生成設定
            target_task_ids: 対象タスクIDリスト（指定時はそのタスクのみ再生成）

        Returns:
            HandsOnGenerationJob
        """
        # configを準備
        job_config = config.copy() if config else {}

        if target_task_ids:
            # 特定タスクのみ対象
            total_tasks = len(target_task_ids)
            # 既存のハンズオンを削除（再生成のため）
            self.db.query(TaskHandsOn).filter(
                TaskHandsOn.task_id.in_(target_task_ids)
            ).delete(synchronize_session=False)
            # configに対象タスクIDを保存
            job_config["target_task_ids"] = [str(tid) for tid in target_task_ids]
        else:
            # 全タスク対象
            total_tasks = self.db.query(Task).filter_by(project_id=project_id).count()

        # ジョブレコード作成
        job = HandsOnGenerationJob(
            job_id=uuid.uuid4(),
            project_id=project_id,
            status="queued",
            total_tasks=total_tasks,
            completed_tasks=0,
            failed_tasks=0,
            config=job_config,
            created_at=datetime.now()
        )

        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        return job

    def get_job_status(self, job_id: UUID) -> Dict:
        """
        ジョブのステータスを取得

        Args:
            job_id: ジョブID

        Returns:
            ジョブステータス辞書
        """
        job = self.db.query(HandsOnGenerationJob).filter_by(job_id=job_id).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # 完了済みタスクを取得
        completed_tasks = []
        if job.completed_tasks > 0:
            tasks_with_hands_on = (
                self.db.query(Task, TaskHandsOn)
                .join(TaskHandsOn, Task.task_id == TaskHandsOn.task_id)
                .filter(Task.project_id == job.project_id)
                .all()
            )

            for task, hands_on in tasks_with_hands_on:
                completed_tasks.append({
                    "task_id": str(task.task_id),
                    "task_title": task.title,
                    "quality_score": hands_on.quality_score,
                    "completed_at": hands_on.generated_at.isoformat() if hands_on.generated_at else None
                })

        # 処理中タスクを取得
        processing_tasks = []
        if job.current_processing:
            for task_id in job.current_processing:
                task = self.db.query(Task).filter_by(task_id=task_id).first()
                if task:
                    processing_tasks.append({
                        "task_id": str(task.task_id),
                        "task_title": task.title,
                    })

        return {
            "job_id": str(job.job_id),
            "project_id": str(job.project_id),
            "status": job.status,
            "progress": {
                "total_tasks": job.total_tasks,
                "completed": job.completed_tasks,
                "failed": job.failed_tasks,
                "processing": len(processing_tasks),
                "pending": job.total_tasks - job.completed_tasks - job.failed_tasks - len(processing_tasks)
            },
            "current_processing": processing_tasks,
            "completed_tasks": completed_tasks,
            "error_message": job.error_message,
            "error_details": job.error_details,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        }

    def get_task_hands_on(self, task_id: UUID) -> Optional[Dict]:
        """
        タスクのハンズオンを取得

        Args:
            task_id: タスクID

        Returns:
            ハンズオン辞書（存在しない場合はNone）
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

        # ハンズオンを削除
        deleted_count = (
            self.db.query(TaskHandsOn)
            .filter(TaskHandsOn.task_id.in_(task_ids))
            .delete(synchronize_session=False)
        )

        self.db.commit()

        return deleted_count

    def _build_project_context(self, project_id: UUID) -> Dict:
        """
        プロジェクトコンテキストを構築

        Args:
            project_id: プロジェクトID

        Returns:
            プロジェクトコンテキスト辞書
        """
        # プロジェクト情報取得
        project = self.db.query(ProjectBase).filter_by(project_id=project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # ドキュメント情報取得
        doc = (
            self.db.query(ProjectDocument)
            .filter_by(project_id=project_id)
            .first()
        )

        # 仕様書とフレームワーク情報
        specification = doc.specification if doc else ""
        framework_info = doc.frame_work_doc if doc else ""

        return {
            "project_id": str(project.project_id),
            "title": project.title,
            "idea": project.idea,
            "tech_stack": framework_info[:500] if framework_info else "不明",
            "specification": specification[:1000] if specification else "",
        }

    def _sort_tasks_by_dependency_priority(
        self,
        tasks: List[Task]
    ) -> List[Dict]:
        """
        タスクを依存関係と優先度でソート

        Args:
            tasks: タスクリスト

        Returns:
            ソート済みタスク辞書のリスト
        """
        # タスク依存グラフ構築
        dependency_graph = self._build_dependency_graph(tasks)

        # トポロジカルソート（依存関係解決）
        sorted_by_dependency = self._topological_sort(dependency_graph)

        # 各レベル内で優先度ソート
        priority_map = {"Must": 0, "Should": 1, "Could": 2, "Wont": 3}

        result = []
        for level_tasks in sorted_by_dependency:
            sorted_level = sorted(
                level_tasks,
                key=lambda t: (
                    priority_map.get(t.priority, 99),
                    t.estimated_hours or 0
                )
            )
            result.extend(sorted_level)

        # 辞書形式に変換
        return [
            {
                "task_id": str(task.task_id),
                "title": task.title,
                "priority": task.priority,
                "dependency_level": self._get_dependency_level(task, dependency_graph),
                "depends_on": self._get_dependency_tasks(task, dependency_graph)
            }
            for task in result
        ]

    def _build_dependency_graph(self, tasks: List[Task]) -> Dict:
        """
        TaskDependencyテーブルからグラフを構築

        Args:
            tasks: タスクリスト

        Returns:
            依存グラフ辞書
        """
        graph = {
            str(task.task_id): {
                "task": task,
                "depends_on": [],
                "dependents": []
            }
            for task in tasks
        }

        for task in tasks:
            # このタスクが依存している他のタスク（source -> target）
            dependencies_from = (
                self.db.query(TaskDependency)
                .filter_by(target_task_id=task.task_id)
                .all()
            )

            for dep in dependencies_from:
                source_id = str(dep.source_task_id)
                target_id = str(dep.target_task_id)

                if source_id in graph and target_id in graph:
                    graph[target_id]["depends_on"].append(source_id)
                    graph[source_id]["dependents"].append(target_id)

        return graph

    def _topological_sort(self, graph: Dict) -> List[List[Task]]:
        """
        トポロジカルソートで依存レベルを分類

        Args:
            graph: 依存グラフ

        Returns:
            レベル別タスクリスト [[Level 0], [Level 1], ...]
        """
        levels = []
        in_degree = {
            task_id: len(info["depends_on"])
            for task_id, info in graph.items()
        }

        while any(deg == 0 for deg in in_degree.values()):
            current_level = [
                graph[task_id]["task"]
                for task_id, deg in in_degree.items()
                if deg == 0 and task_id in in_degree
            ]

            if not current_level:
                break

            levels.append(current_level)

            # 次のレベルへ
            for task in current_level:
                task_id = str(task.task_id)
                in_degree.pop(task_id)

                for dependent_id in graph[task_id]["dependents"]:
                    if dependent_id in in_degree:
                        in_degree[dependent_id] -= 1

        return levels

    def _get_dependency_level(self, task: Task, graph: Dict) -> int:
        """タスクの依存レベルを取得"""
        task_id = str(task.task_id)
        if task_id not in graph:
            return 0

        if not graph[task_id]["depends_on"]:
            return 0

        # 依存先の最大レベル + 1
        max_level = 0
        for dep_id in graph[task_id]["depends_on"]:
            dep_task = graph[dep_id]["task"]
            dep_level = self._get_dependency_level(dep_task, graph)
            max_level = max(max_level, dep_level)

        return max_level + 1

    def _get_dependency_tasks(self, task: Task, graph: Dict) -> List[str]:
        """タスクが依存しているタスクIDのリストを取得"""
        task_id = str(task.task_id)
        if task_id not in graph:
            return []

        return graph[task_id]["depends_on"]

    def _create_dependency_batches(
        self,
        sorted_tasks: List[Dict],
        batch_size: int = 5
    ) -> List[Dict]:
        """
        依存関係を考慮したバッチを作成

        Args:
            sorted_tasks: ソート済みタスク辞書リスト
            batch_size: バッチサイズ

        Returns:
            バッチリスト
                [
                    {
                        "batch_id": 0,
                        "tasks": [...],
                        "has_dependencies": False  # 並列実行可能
                    },
                    ...
                ]
        """
        batches = []
        current_batch = []
        current_level = None

        for task_dict in sorted_tasks:
            level = task_dict["dependency_level"]

            # レベルが変わったら新しいバッチ
            if current_level is not None and level != current_level:
                batches.append({
                    "batch_id": len(batches),
                    "tasks": current_batch,
                    "has_dependencies": len(current_batch[0]["depends_on"]) > 0 if current_batch else False
                })
                current_batch = []

            current_batch.append(task_dict)
            current_level = level

            # バッチサイズに達したら区切る（同一レベル内のみ）
            if len(current_batch) >= batch_size:
                batches.append({
                    "batch_id": len(batches),
                    "tasks": current_batch,
                    "has_dependencies": len(current_batch[0]["depends_on"]) > 0 if current_batch else False
                })
                current_batch = []
                current_level = None

        # 残りのタスクを追加
        if current_batch:
            batches.append({
                "batch_id": len(batches),
                "tasks": current_batch,
                "has_dependencies": len(current_batch[0]["depends_on"]) > 0 if current_batch else False
            })

        return batches

    def generate_hands_on_sync(
        self,
        project_id: UUID,
        config: Optional[Dict] = None
    ) -> Dict:
        """
        ハンズオンを同期的に生成（テスト・プレビュー用）

        Args:
            project_id: プロジェクトID
            config: 生成設定

        Returns:
            生成結果
        """
        # タスク取得
        tasks = self.db.query(Task).filter_by(project_id=project_id).all()
        if not tasks:
            raise ValueError(f"No tasks found for project {project_id}")

        # プロジェクトコンテキスト構築
        project_context = self._build_project_context(project_id)

        # 依存関係ソート
        sorted_tasks = self._sort_tasks_by_dependency_priority(tasks)

        results = []

        for task_dict in sorted_tasks[:3]:  # テスト用に最初の3タスクのみ
            task_id = UUID(task_dict["task_id"])
            task = self.db.query(Task).filter_by(task_id=task_id).first()

            # エージェント実行
            agent = TaskHandsOnAgent(
                db=self.db,
                task=task,
                project_context=project_context,
                config=config or {}
            )

            hands_on = agent.generate_hands_on()

            # DB保存
            self.db.add(hands_on)
            self.db.commit()

            results.append({
                "task_id": str(task.task_id),
                "task_title": task.title,
                "quality_score": hands_on.quality_score,
                "status": "completed"
            })

        return {
            "project_id": str(project_id),
            "total_tasks": len(tasks),
            "generated_count": len(results),
            "results": results
        }
