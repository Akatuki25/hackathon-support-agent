"""
完全なタスク生成API
全エージェント処理を一括実行
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from database import get_db
from services.integrated_task_service import IntegratedTaskService
from tasks.task_generation_tasks import generate_complete_task_set_async
from models.project_base import TaskGenerationJob, Task
from uuid import UUID, uuid4
from datetime import datetime


router = APIRouter()


class CompleteTaskGenerationRequest(BaseModel):
    """完全タスク生成リクエスト"""
    project_id: str


class CompleteTaskGenerationResponse(BaseModel):
    """完全タスク生成レスポンス"""
    success: bool
    message: str
    project_id: str
    total_tasks: int
    total_dependencies: int
    saved_task_ids: List[str]
    saved_edge_ids: List[str]
    processing_time: float
    phases_completed: Dict[str, bool]
    error: Optional[str] = None


# ========================================
# 非同期タスク生成用のモデル
# ========================================

class AsyncTaskGenerationRequest(BaseModel):
    """非同期タスク生成リクエスト"""
    project_id: str


class AsyncTaskGenerationResponse(BaseModel):
    """非同期タスク生成レスポンス"""
    success: bool
    job_id: str
    project_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    """ジョブステータスレスポンス"""
    success: bool
    job_id: str
    project_id: str
    status: str
    progress: Dict[str, Any]
    total_tasks: int
    completed_phases: int
    total_phases: int
    error_message: Optional[str]
    created_at: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]


@router.post("/generate_complete", response_model=CompleteTaskGenerationResponse)
async def generate_complete_task_set(
    request: CompleteTaskGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    完全なタスクセットを生成する統合エンドポイント
    
    以下の処理を一括実行:
    1. 機能からタスク生成
    2. 品質評価・改善
    3. 依存関係生成
    4. ReactFlow座標計算
    5. DB一括保存
    
    全ての処理が完了するまでDBには何も保存されません。
    """
    try:
        service = IntegratedTaskService(db)
        result = await service.generate_complete_task_set(request.project_id)
        
        return CompleteTaskGenerationResponse(
            success=result["success"],
            message=f"Successfully generated complete task set with {result['total_tasks']} tasks and {result['total_dependencies']} dependencies",
            project_id=result["project_id"],
            total_tasks=result["total_tasks"],
            total_dependencies=result["total_dependencies"],
            saved_task_ids=result["saved_task_ids"],
            saved_edge_ids=result["saved_edge_ids"],
            processing_time=result["processing_time"],
            phases_completed=result["phases_completed"]
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error during complete task generation: {str(e)}"
        )


@router.get("/preview/{project_id}")
async def preview_task_generation(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    タスク生成のプレビュー（DB保存なし）
    
    生成されるタスクの概要を確認できます。
    """
    try:
        from models.project_base import StructuredFunction, ProjectBase
        
        # プロジェクト情報取得
        project = db.query(ProjectBase).filter_by(project_id=project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")
        
        # 機能情報取得
        functions = db.query(StructuredFunction).filter_by(project_id=project_id).all()
        if not functions:
            raise ValueError(f"No functions found for project {project_id}")
        
        # 推定タスク数を計算（簡易版）
        estimated_tasks = 0
        for func in functions:
            if func.priority == "Must":
                estimated_tasks += 3  # Must機能は平均3タスク
            elif func.priority == "Should":
                estimated_tasks += 2  # Should機能は平均2タスク
            else:
                estimated_tasks += 1  # その他は1タスク
        
        # カテゴリ分布を推定
        categories = set()
        for func in functions:
            if func.category in ["auth", "user"]:
                categories.update(["DB設計", "バックエンド", "フロントエンド"])
            elif func.category == "data":
                categories.update(["DB設計", "バックエンド"])
            elif func.category == "ui":
                categories.add("フロントエンド")
            else:
                categories.add("バックエンド")
        
        return {
            "project_id": project_id,
            "project_title": project.title,
            "total_functions": len(functions),
            "estimated_tasks": estimated_tasks,
            "estimated_categories": list(categories),
            "estimated_dependencies": estimated_tasks - 1,  # 簡易推定
            "ready_for_generation": True
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear/{project_id}")
async def clear_generated_tasks(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    生成されたタスクをクリア（開発・デバッグ用）
    """
    try:
        from models.project_base import Task, TaskDependency

        # 依存関係を先に削除
        db.query(TaskDependency).filter(
            TaskDependency.source_task_id.in_(
                db.query(Task.task_id).filter_by(project_id=project_id)
            )
        ).delete(synchronize_session=False)

        # タスクを削除
        deleted_count = db.query(Task).filter_by(project_id=project_id).delete()

        db.commit()

        return {
            "project_id": project_id,
            "deleted_tasks": deleted_count,
            "message": f"Cleared {deleted_count} tasks for project {project_id}"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# 非同期タスク生成エンドポイント
# ========================================

@router.post("/generate_async", response_model=AsyncTaskGenerationResponse)
async def generate_complete_task_set_async_endpoint(
    request: AsyncTaskGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    非同期でタスクセット生成を開始

    Celeryタスクを起動して即座にレスポンス返却

    重複実行防止:
    - 既存のジョブ(queued/processing/completed)をチェック
    - データベーストランザクションで排他制御
    """
    try:
        project_uuid = UUID(request.project_id)

        # 🔒 既存のジョブをチェック (処理中 or 完了済み)
        existing_job = (
            db.query(TaskGenerationJob)
            .filter(
                and_(
                    TaskGenerationJob.project_id == project_uuid,
                    TaskGenerationJob.status.in_(["queued", "processing", "completed"])
                )
            )
            .with_for_update(skip_locked=True)
            .first()
        )

        if existing_job:
            return AsyncTaskGenerationResponse(
                success=True,
                job_id=str(existing_job.job_id),
                project_id=request.project_id,
                status=existing_job.status,
                message=f"Task generation already {existing_job.status}"
            )

        # 🔒 タスクが既に存在するかチェック
        existing_tasks = db.query(Task).filter_by(project_id=project_uuid).first()
        if existing_tasks:
            return AsyncTaskGenerationResponse(
                success=True,
                job_id="already-completed",
                project_id=request.project_id,
                status="completed",
                message="Tasks already exist for this project"
            )

        # 🆕 新規ジョブ作成
        job = TaskGenerationJob(
            job_id=uuid4(),
            project_id=project_uuid,
            status="queued"
        )
        db.add(job)
        db.commit()

        # Celeryタスク起動（非同期）
        generate_complete_task_set_async.apply_async(
            args=[str(job.job_id), request.project_id],
            task_id=str(job.job_id)
        )

        return AsyncTaskGenerationResponse(
            success=True,
            job_id=str(job.job_id),
            project_id=request.project_id,
            status="queued",
            message="Task generation started in background"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/job_status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    db: Session = Depends(get_db)
):
    """
    ジョブステータス確認
    """
    try:
        job = db.query(TaskGenerationJob).filter_by(job_id=UUID(job_id)).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        return JobStatusResponse(
            success=True,
            job_id=str(job.job_id),
            project_id=str(job.project_id),
            status=job.status,
            progress={
                "percentage": (job.completed_phases / job.total_phases * 100) if job.total_phases > 0 else 0,
                "current_phase": job.completed_phases,
                "total_phases": job.total_phases
            },
            total_tasks=job.total_tasks,
            completed_phases=job.completed_phases,
            total_phases=job.total_phases,
            error_message=job.error_message,
            created_at=job.created_at.isoformat() if job.created_at else None,
            started_at=job.started_at.isoformat() if job.started_at else None,
            completed_at=job.completed_at.isoformat() if job.completed_at else None
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))