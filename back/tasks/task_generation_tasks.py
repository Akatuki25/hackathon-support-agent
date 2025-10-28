"""
task_generation_tasks.py: タスク生成のCeleryタスク

Phase 1: バックグラウンドでの完全タスク生成
"""
import asyncio
from celery_app import celery_app
from database import SessionLocal
from models.project_base import TaskGenerationJob
from services.integrated_task_service import IntegratedTaskService
from datetime import datetime
from uuid import UUID


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def generate_complete_task_set_async(self, job_id: str, project_id: str):
    """
    完全なタスクセットを非同期生成

    Args:
        job_id: TaskGenerationJob ID
        project_id: プロジェクトID

    Returns:
        Dict: 生成結果
    """
    db = SessionLocal()

    try:
        print(f"[Celery] タスク生成開始: project_id={project_id}")

        # ジョブレコード取得・更新
        job = db.query(TaskGenerationJob).filter_by(job_id=UUID(job_id)).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job.status = "processing"
        job.started_at = datetime.utcnow()
        db.commit()

        # タスク生成サービス実行（asyncio.run()で同期的に実行）
        service = IntegratedTaskService(db)
        result = asyncio.run(service.generate_complete_task_set(project_id))

        # ジョブ完了
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.total_tasks = result["total_tasks"]
        job.completed_phases = 5  # すべてのフェーズ完了
        db.commit()

        print(f"[Celery] タスク生成完了: {result['total_tasks']} tasks")

        return {
            "success": True,
            "job_id": job_id,
            "project_id": project_id,
            **result
        }

    except Exception as e:
        # エラー処理
        job.status = "failed"
        job.error_message = str(e)
        db.commit()

        print(f"[Celery] タスク生成失敗: {str(e)}")

        # リトライ可能なエラーの場合はリトライ
        if "timeout" in str(e).lower() or "network" in str(e).lower():
            raise self.retry(exc=e, countdown=60)

        raise

    finally:
        db.close()
