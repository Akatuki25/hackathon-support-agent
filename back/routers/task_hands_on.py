"""
task_hands_on.py: タスクハンズオン生成 API

Phase 3: ハンズオン生成・取得・管理のエンドポイント
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from typing import Optional, Dict, List
from uuid import UUID
from datetime import datetime

from database import get_db
from services.task_hands_on_service import TaskHandsOnService
from tasks.hands_on_tasks import generate_all_hands_on
from models.project_base import HandsOnGenerationJob, Task, TaskHandsOn


router = APIRouter(prefix="/api/task_hands_on", tags=["TaskHandsOn"])


# =====================================================
# リクエスト/レスポンスモデル
# =====================================================

class HandsOnGenerationRequest(BaseModel):
    """ハンズオン生成リクエスト"""
    project_id: str
    config: Optional[Dict] = None

    class Config:
        json_schema_extra = {
            "example": {
                "project_id": "123e4567-e89b-12d3-a456-426614174000",
                "config": {
                    "batch_size": 5,
                    "enable_web_search": True,
                    "verification_level": "medium",
                    "model": "gemini-2.0-flash-exp"
                }
            }
        }


class HandsOnGenerationResponse(BaseModel):
    """ハンズオン生成レスポンス"""
    success: bool
    job_id: str
    project_id: str
    status: str
    total_tasks: int
    message: str


class JobStatusResponse(BaseModel):
    """ジョブステータスレスポンス"""
    success: bool
    job_id: str
    project_id: str
    status: str
    progress: Dict
    current_processing: List[Dict]
    completed_tasks: List[Dict]
    error_message: Optional[str]
    error_details: Optional[Dict]
    created_at: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]


class TaskHandsOnResponse(BaseModel):
    """タスクハンズオン取得レスポンス"""
    success: bool
    task_id: str
    task_title: str
    has_hands_on: bool
    hands_on: Optional[Dict]
    metadata: Optional[Dict]
    message: Optional[str] = None


class DeleteHandsOnResponse(BaseModel):
    """ハンズオン削除レスポンス"""
    success: bool
    deleted_count: int
    message: str


# =====================================================
# エンドポイント
# =====================================================

@router.post("/generate_all", response_model=HandsOnGenerationResponse)
async def start_hands_on_generation(
    request: HandsOnGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    プロジェクト全体のハンズオン生成開始

    Celeryタスクを起動して即座にレスポンス返却

    重複実行防止:
    - 既存のジョブ(queued/processing/completed)をチェック
    - 既にハンズオンが存在する場合はスキップ
    - データベーストランザクションで排他制御
    """
    try:
        service = TaskHandsOnService(db)
        project_uuid = UUID(request.project_id)

        # 🔒 Step 1: 既存のジョブをチェック (処理中 or 完了済み)
        existing_job = (
            db.query(HandsOnGenerationJob)
            .filter(
                and_(
                    HandsOnGenerationJob.project_id == project_uuid,
                    HandsOnGenerationJob.status.in_(["queued", "processing", "completed"])
                )
            )
            .with_for_update(skip_locked=True)  # 排他制御 (他のトランザクションがロック中ならスキップ)
            .first()
        )

        if existing_job:
            return HandsOnGenerationResponse(
                success=True,
                job_id=str(existing_job.job_id),
                project_id=request.project_id,
                status=existing_job.status,
                total_tasks=existing_job.total_tasks,
                message=f"Hands-on generation already {existing_job.status}"
            )

        # 🔒 Step 2: 最初のタスクにハンズオンが既に存在するかチェック
        first_task = (
            db.query(Task)
            .filter_by(project_id=project_uuid)
            .order_by(Task.created_at)
            .first()
        )

        if first_task:
            existing_hands_on = (
                db.query(TaskHandsOn)
                .filter_by(task_id=first_task.task_id)
                .first()
            )

            if existing_hands_on:
                # 既にハンズオンが存在する
                return HandsOnGenerationResponse(
                    success=True,
                    job_id="already-completed",
                    project_id=request.project_id,
                    status="completed",
                    total_tasks=db.query(Task).filter_by(project_id=project_uuid).count(),
                    message="Hands-on already exists for this project"
                )

        # 🆕 新規ジョブ作成
        job = service.create_generation_job(
            project_id=project_uuid,
            config=request.config
        )

        # Celeryタスク起動（非同期）
        generate_all_hands_on.apply_async(
            args=[str(job.job_id), request.project_id, request.config],
            task_id=str(job.job_id)  # ジョブIDをタスクIDとして使用
        )

        return HandsOnGenerationResponse(
            success=True,
            job_id=str(job.job_id),
            project_id=request.project_id,
            status="processing",
            total_tasks=job.total_tasks,
            message="Hands-on generation started in background (Celery)"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    db: Session = Depends(get_db)
):
    """
    ジョブステータス確認
    """
    try:
        service = TaskHandsOnService(db)
        status = service.get_job_status(UUID(job_id))

        return JobStatusResponse(
            success=True,
            **status
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{task_id}", response_model=TaskHandsOnResponse)
async def get_task_hands_on(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    個別タスクハンズオン取得
    """
    try:
        service = TaskHandsOnService(db)
        hands_on = service.get_task_hands_on(UUID(task_id))

        return TaskHandsOnResponse(
            success=True,
            **hands_on
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}", response_model=DeleteHandsOnResponse)
async def delete_project_hands_on(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    プロジェクトの全ハンズオンを削除（開発用）
    """
    try:
        service = TaskHandsOnService(db)
        deleted_count = service.delete_project_hands_on(UUID(project_id))

        return DeleteHandsOnResponse(
            success=True,
            deleted_count=deleted_count,
            message=f"All hands-on data cleared for project ({deleted_count} items deleted)"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preview", response_model=Dict)
async def preview_hands_on_generation(
    request: HandsOnGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    プレビュー生成（開発・デバッグ用）

    最初の3タスクのみを同期的に生成してプレビュー
    """
    try:
        service = TaskHandsOnService(db)

        # 同期的に生成（テスト用）
        result = service.generate_hands_on_sync(
            project_id=UUID(request.project_id),
            config=request.config
        )

        return {
            "success": True,
            "preview_mode": True,
            "message": "Preview generated (first 3 tasks only)",
            **result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
