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
    *args,
    **kwargs
):
    """
    単一タスクのハンズオン生成（Celeryタスク）

    Args:
        chain使用時: 前のタスクの結果, task_id, project_context, config
        通常呼び出し: task_id, project_context, config

    Returns:
        Dict: 生成結果
    """
    # 引数の解析（chainで前のタスクの結果が渡される場合に対応）
    if len(args) == 4 and isinstance(args[0], dict) and "task_id" in args[0]:
        # chainで前のタスクの結果が渡された場合
        previous_result, task_id, project_context, config = args
    elif len(args) >= 3:
        # 通常呼び出し
        task_id, project_context, config = args[0], args[1], args[2] if len(args) > 2 else None
        previous_result = None
    else:
        raise ValueError(f"Invalid arguments: args={args}, kwargs={kwargs}")

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
        error_msg = str(e)
        print(f"[Celery] エラー: {task.title if task else task_id} - {error_msg}")

        # パースエラーの場合は即座に再試行（最大3回）
        if "parse failed" in error_msg.lower() and self.request.retries < self.max_retries:
            print(f"[Celery] パースエラー検出 - 再生成 (試行 {self.request.retries + 1}/{self.max_retries})")
            raise self.retry(exc=e, countdown=5)

        # ネットワークエラーは待機してリトライ
        if "timeout" in error_msg.lower() or "network" in error_msg.lower():
            raise self.retry(exc=e, countdown=60)

        # その他のエラーは即失敗
        raise

    finally:
        db.close()


@celery_app.task
def update_batch_progress(results, job_id, project_id, batch_id, total_tasks):
    """
    バッチ完了時のコールバック（進捗更新）

    Args:
        results: groupまたはchainの結果リスト
        job_id: ジョブID（str）
        project_id: プロジェクトID（str）
        batch_id: バッチID（int）
        total_tasks: プロジェクト全体のタスク数（int）
    """
    db = SessionLocal()
    try:
        job = db.query(HandsOnGenerationJob).filter_by(job_id=UUID(job_id)).first()
        if not job:
            return results  # chord では結果を次に渡す必要がある

        # 進捗更新
        total_completed = db.query(TaskHandsOn).join(Task).filter(
            Task.project_id == UUID(project_id)
        ).count()

        job.completed_tasks = total_completed
        job.current_processing = []
        db.commit()

        print(f"[Celery] バッチ {batch_id} 完了 ({total_completed}/{total_tasks})")

        return results  # 次のタスクに結果を渡す

    finally:
        db.close()


@celery_app.task
def finalize_generation_job(previous_results, job_id):
    """
    ジョブ全体の完了処理

    Args:
        previous_results: 前のタスクからの結果（chain経由）
        job_id: ジョブID（str）
    """
    db = SessionLocal()
    try:
        job = db.query(HandsOnGenerationJob).filter_by(job_id=UUID(job_id)).first()
        if not job:
            return

        job.status = "completed"
        job.completed_at = datetime.now()
        db.commit()

        print(f"[Celery] プロジェクト全体のハンズオン生成完了: {job.project_id}")

    finally:
        db.close()


@celery_app.task
def generate_all_hands_on(job_id: str, project_id: str, config: Dict = None):
    """
    プロジェクト全体のハンズオン生成（メインCeleryタスク）

    Celeryのchord機能を使い、ビジーウェイトを排除
    各バッチをchordで管理し、完了時にコールバックで進捗更新

    Args:
        job_id: HandsOnGenerationJob ID
        project_id: プロジェクトID
        config: 生成設定
    """
    from celery import chord

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

        # 全バッチをchordで連結（各バッチ完了時にコールバック）
        # シグネチャとして保持し、最後に一度だけ実行する
        batch_chord_signatures = []

        for batch in batches:
            print(f"[Celery] バッチ {batch['batch_id']} 準備 ({len(batch['tasks'])} タスク)")

            # 現在処理中のタスクIDを記録
            job.current_processing = [t["task_id"] for t in batch["tasks"]]
            db.commit()

            # タスクグループ作成
            task_signatures = [
                generate_single_task_hands_on.s(
                    t["task_id"],
                    project_context,
                    config
                )
                for t in batch["tasks"]
            ]

            if batch["has_dependencies"]:
                # 依存関係あり → chain で順次実行
                batch_workflow = chain(*task_signatures)
            else:
                # 依存関係なし → group で並列実行
                batch_workflow = group(*task_signatures)

            # バッチ完了時のコールバックシグネチャを作成（まだ実行しない）
            batch_chord_sig = chord(batch_workflow)(
                update_batch_progress.s(
                    job_id=job_id,
                    project_id=project_id,
                    batch_id=batch["batch_id"],
                    total_tasks=len(tasks)
                )
            )

            batch_chord_signatures.append(batch_chord_sig)

        # 全バッチ完了時の最終コールバック
        # すべてのバッチchordを並列実行し、全完了後にfinalizeを呼ぶ
        if batch_chord_signatures:
            # すべてのバッチchordをgroupで並列実行 → 全完了後にfinalize
            final_workflow = chord(group(*batch_chord_signatures))(
                finalize_generation_job.s(job_id)
            )
            final_workflow.apply_async()
        else:
            # タスクがない場合は即座に完了
            finalize_generation_job.apply_async(args=[None, job_id])

        print(f"[Celery] 全バッチワークフロー起動完了")

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
        print(f"[Celery] プロジェクト全体のハンズオン生成失敗: {str(e)}")
        raise

    finally:
        db.close()
