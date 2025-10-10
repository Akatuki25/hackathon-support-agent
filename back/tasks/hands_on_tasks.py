"""
hands_on_tasks.py: ハンズオン生成のCeleryタスク

Phase 3: バックグラウンドでのタスクハンズオン生成
"""

from celery import group, chain
from celery_app import celery_app
from database import SessionLocal
from models.project_base import Task, HandsOnGenerationJob, TaskHandsOn
from services.task_hands_on_agent import TaskHandsOnAgent
from services.task_hands_on_service import TaskHandsOnService
from typing import Dict
from datetime import datetime
from uuid import UUID


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def generate_single_task_hands_on(
    self,
    task_id: str,
    project_context: Dict,
    config: Dict = None
):
    """
    単一タスクのハンズオン生成（Celeryタスク）

    Args:
        task_id: タスクID
        project_context: プロジェクトコンテキスト
        config: 生成設定

    Returns:
        Dict: 生成結果
    """
    db = SessionLocal()

    try:
        # タスク取得
        task = db.query(Task).filter_by(task_id=UUID(task_id)).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        print(f"[Celery] ハンズオン生成開始: {task.title}")

        # TaskHandsOnAgent起動
        agent = TaskHandsOnAgent(db, task, project_context, config or {})
        hands_on = agent.generate_hands_on()

        # DB保存
        db.add(hands_on)
        db.commit()

        print(f"[Celery] ハンズオン生成完了: {task.title} (品質: {hands_on.quality_score:.2f})")

        return {
            "task_id": task_id,
            "status": "completed",
            "quality_score": hands_on.quality_score,
            "completed_at": datetime.now().isoformat()
        }

    except Exception as e:
        db.rollback()
        print(f"[Celery] エラー: {task.title if task else task_id} - {str(e)}")

        # WebSearchタイムアウト等でリトライ
        if "timeout" in str(e).lower() or "network" in str(e).lower():
            raise self.retry(exc=e, countdown=60)  # 60秒後にリトライ
        else:
            raise  # その他のエラーは即失敗

    finally:
        db.close()


@celery_app.task
def generate_all_hands_on(job_id: str, project_id: str, config: Dict = None):
    """
    プロジェクト全体のハンズオン生成（メインCeleryタスク）

    Args:
        job_id: HandsOnGenerationJob ID
        project_id: プロジェクトID
        config: 生成設定
    """
    db = SessionLocal()

    try:
        print(f"[Celery] プロジェクト全体のハンズオン生成開始: {project_id}")

        # ジョブレコード取得・更新
        job = db.query(HandsOnGenerationJob).filter_by(job_id=UUID(job_id)).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job.status = "processing"
        job.started_at = datetime.now()
        db.commit()

        # タスク取得
        tasks = db.query(Task).filter_by(project_id=UUID(project_id)).all()
        job.total_tasks = len(tasks)
        db.commit()

        # 依存関係解析・優先度ソート
        service = TaskHandsOnService(db)
        sorted_task_dicts = service._sort_tasks_by_dependency_priority(tasks)

        # プロジェクトコンテキスト構築
        project_context = service._build_project_context(UUID(project_id))

        # バッチ処理
        batch_size = config.get("batch_size", 5) if config else 5
        batches = service._create_dependency_batches(sorted_task_dicts, batch_size)

        print(f"[Celery] バッチ数: {len(batches)}, バッチサイズ: {batch_size}")

        for batch in batches:
            print(f"[Celery] バッチ {batch['batch_id']} 処理開始 ({len(batch['tasks'])} タスク)")

            # 現在処理中のタスクIDを記録
            job.current_processing = [t["task_id"] for t in batch["tasks"]]
            db.commit()

            if batch["has_dependencies"]:
                # 依存関係あり → chain で順次実行
                task_chain = chain([
                    generate_single_task_hands_on.s(
                        t["task_id"],
                        project_context,
                        config
                    )
                    for t in batch["tasks"]
                ])
                task_chain.apply_async()
            else:
                # 依存関係なし → group で並列実行
                task_group = group([
                    generate_single_task_hands_on.s(
                        t["task_id"],
                        project_context,
                        config
                    )
                    for t in batch["tasks"]
                ])
                task_group.apply_async()

            # バッチ完了待機（簡易実装：ポーリング）
            import time
            while True:
                completed_count = db.query(TaskHandsOn).join(Task).filter(
                    Task.task_id.in_([UUID(t["task_id"]) for t in batch["tasks"]])
                ).count()

                if completed_count >= len(batch["tasks"]):
                    break

                time.sleep(2)  # 2秒ごとにチェック

            # 進捗更新
            total_completed = db.query(TaskHandsOn).join(Task).filter(
                Task.project_id == UUID(project_id)
            ).count()

            job.completed_tasks = total_completed
            job.current_processing = []
            db.commit()

            print(f"[Celery] バッチ {batch['batch_id']} 完了 ({total_completed}/{job.total_tasks})")

        # 完了
        job.status = "completed"
        job.completed_at = datetime.now()
        db.commit()

        print(f"[Celery] プロジェクト全体のハンズオン生成完了: {project_id}")

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
        print(f"[Celery] プロジェクト全体のハンズオン生成失敗: {str(e)}")
        raise

    finally:
        db.close()
