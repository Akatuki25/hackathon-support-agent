"""
hands_on_tasks.py: ハンズオン生成のCeleryタスク

Phase 4: Plan-and-Execute パターンによる完全並列実行
- 依存関係順序は不要（エージェントがツールで動的取得）
- 全タスクを同時並列実行
- レイテンシ最小化
"""

from celery import group, chord
from celery_app import celery_app
from database import SessionLocal
from models.project_base import Task, HandsOnGenerationJob, TaskHandsOn
from services.task_hands_on_agent import TaskHandsOnAgent
from services.task_hands_on_service import TaskHandsOnService
from typing import Dict
from datetime import datetime
from uuid import UUID


@celery_app.task(bind=True, max_retries=3, retry_backoff=True, rate_limit='5/m')
def generate_single_task_hands_on(
    self,
    task_id: str,
    project_context: Dict,
    config: Dict = None
):
    """
    単一タスクのハンズオン生成（Celeryタスク）

    Plan-and-Execute パターン:
    - Planner: 情報収集計画 (1 LLM call)
    - Executor: 並列ツール実行 (0 LLM calls)
    - Generator: ハンズオン生成 (1 LLM call, Structured Output)

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

        # 重複生成防止チェック
        existing = db.query(TaskHandsOn).filter_by(task_id=UUID(task_id)).first()
        if existing:
            print(f"[Celery] ハンズオン既存: {task.title} (スキップ)")
            return {
                "task_id": task_id,
                "status": "skipped",
                "reason": "already_exists",
                "quality_score": existing.quality_score
            }

        print(f"[Celery] ハンズオン生成開始: {task.title}")

        # TaskHandsOnAgent起動（Plan-and-Execute）
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
        error_msg = str(e)
        print(f"[Celery] エラー: {task.title if task else task_id} - {error_msg}")

        # ネットワークエラーは待機してリトライ
        if "timeout" in error_msg.lower() or "network" in error_msg.lower():
            if self.request.retries < self.max_retries:
                print(f"[Celery] ネットワークエラー - リトライ ({self.request.retries + 1}/{self.max_retries})")
                raise self.retry(exc=e, countdown=60)

        # その他のエラーは再試行（最大3回）
        if self.request.retries < self.max_retries:
            print(f"[Celery] エラー - リトライ ({self.request.retries + 1}/{self.max_retries})")
            raise self.retry(exc=e, countdown=10)

        # 最大試行回数到達
        raise

    finally:
        db.close()


@celery_app.task
def finalize_generation_job(previous_results, job_id):
    """
    ジョブ全体の完了処理

    完了後はジョブレコードを削除（1プロジェクト1アクティブジョブを保証）

    Args:
        previous_results: 前のタスクからの結果（chord経由）
        job_id: ジョブID（str）
    """
    db = SessionLocal()
    try:
        job = db.query(HandsOnGenerationJob).filter_by(job_id=UUID(job_id)).first()
        if not job:
            print(f"[Celery] ⚠️ ジョブが見つかりません: {job_id}")
            return

        # 完了タスク数を更新
        total_completed = db.query(TaskHandsOn).join(Task).filter(
            Task.project_id == job.project_id
        ).count()

        print(f"[Celery] ✅ プロジェクト全体のハンズオン生成完了: {job.project_id}")
        print(f"[Celery]    完了タスク数: {total_completed}/{job.total_tasks}")

        # 🗑️ ジョブレコードを削除（完了後は履歴不要）
        # これにより次回の生成時に新しいジョブを作成可能になる
        db.delete(job)
        db.commit()

        print(f"[Celery] 🗑️ ジョブレコード削除完了: {job_id}")

    except Exception as e:
        print(f"[Celery] ❌ finalize エラー: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


@celery_app.task
def generate_all_hands_on(job_id: str, project_id: str, config: Dict = None):
    """
    プロジェクト全体のハンズオン生成（メインCeleryタスク）

    Plan-and-Execute パターンでは依存関係の順序は不要：
    - エージェントが動的にツール経由で依存タスク情報を取得
    - 全タスクを完全並列で実行可能
    - レイテンシ最小化

    Args:
        job_id: HandsOnGenerationJob ID
        project_id: プロジェクトID
        config: 生成設定
    """
    db = SessionLocal()

    try:
        print(f"\n[Celery] ========================================")
        print(f"[Celery] プロジェクト全体のハンズオン生成開始")
        print(f"[Celery] Project ID: {project_id}")
        print(f"[Celery] ========================================\n")

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

        if not tasks:
            print("[Celery] タスクが見つかりません")
            finalize_generation_job.apply_async(args=[None, job_id])
            return

        # プロジェクトコンテキスト構築
        service = TaskHandsOnService(db)
        project_context = service._build_project_context(UUID(project_id))

        print(f"[Celery] 🚀 全 {len(tasks)} タスクを完全並列で実行")
        print(f"[Celery]    Plan-and-Execute パターン採用")
        print(f"[Celery]    エージェントがツール経由で依存情報を動的取得\n")

        # 全タスクのシグネチャを作成（完全並列）
        task_signatures = [
            generate_single_task_hands_on.s(
                str(task.task_id),
                project_context,
                config
            )
            for task in tasks
        ]

        # 現在処理中のタスクIDを記録
        job.current_processing = [str(task.task_id) for task in tasks]
        db.commit()

        # 全タスクを並列実行し、完了後にfinalizeを呼ぶ
        workflow = chord(group(*task_signatures))(
            finalize_generation_job.s(job_id)
        )
        workflow.apply_async()

        print(f"[Celery] ✅ 完全並列ワークフロー起動完了 ({len(tasks)} タスク)\n")

    except Exception as e:
        print(f"[Celery] ❌ プロジェクト全体のハンズオン生成失敗: {str(e)}")

        # 失敗時もジョブレコードを削除（次回リトライ可能にする）
        if job:
            db.delete(job)
            db.commit()
            print(f"[Celery] 🗑️ 失敗ジョブレコード削除完了: {job_id}")

        raise

    finally:
        db.close()
