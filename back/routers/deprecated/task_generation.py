"""
タスク生成API
機能構造からタスクを生成するエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
from database import get_db
from services.task_generation_service import TaskGenerationService


router = APIRouter()


class TaskGenerationRequest(BaseModel):
    """タスク生成リクエスト"""
    project_id: str
    batch_size: Optional[int] = 5  # バッチサイズ（デフォルト5）


class TaskGenerationResponse(BaseModel):
    """タスク生成レスポンス"""
    success: bool
    message: str
    project_id: str
    total_functions: int
    total_batches: int
    total_tasks_generated: int
    processing_time: float
    saved_task_ids: list
    quality_evaluation_applied: bool = False
    additional_task_ids: list = []
    total_final_tasks: int
    quality_score: Optional[float] = None
    quality_acceptable: Optional[bool] = None
    error: Optional[str] = None


@router.post("/generate", response_model=TaskGenerationResponse)
async def generate_tasks_from_functions(
    request: TaskGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    機能構造からタスクを生成する
    
    バッチ処理で効率的にタスクを生成し、DBに保存する
    """
    try:
        # 新しい統合サービスを使用
        from services.task import IntegratedTaskService
        service = IntegratedTaskService(db)
        
        # 統合タスク生成処理
        result = await service.generate_complete_task_set(request.project_id)
        
        return TaskGenerationResponse(
            success=result["success"],
            message=f"Successfully generated {result['total_tasks']} tasks with {result['total_dependencies']} dependencies",
            project_id=result["project_id"],
            total_functions=1,  # 統合サービスでは機能数は別途取得が必要
            total_batches=1,    # バッチの概念は統合サービスでは抽象化
            total_tasks_generated=result["total_tasks"] - result.get("improvement_tasks_added", 0),
            processing_time=result["processing_time"],
            saved_task_ids=result["saved_task_ids"],
            quality_evaluation_applied=True,
            additional_task_ids=result["saved_task_ids"][-result.get("improvement_tasks_added", 0):] if result.get("improvement_tasks_added", 0) > 0 else [],
            total_final_tasks=result["total_tasks"],
            quality_score=result.get("quality_score", 1.0),
            quality_acceptable=result.get("quality_acceptable", True)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error during task generation: {str(e)}"
        )


@router.get("/status/{project_id}")
async def get_task_generation_status(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのタスク生成状況を確認
    """
    try:
        from models.project_base import Task, StructuredFunction
        
        # 機能数を取得
        functions_count = db.query(StructuredFunction).filter_by(project_id=project_id).count()
        
        # 生成済みタスク数を取得
        tasks_count = db.query(Task).filter_by(project_id=project_id).count()
        
        # 機能別タスク数を取得
        function_tasks = db.query(Task.function_id).filter_by(project_id=project_id).distinct().count()
        
        return {
            "project_id": project_id,
            "total_functions": functions_count,
            "total_tasks": tasks_count,
            "functions_with_tasks": function_tasks,
            "average_tasks_per_function": round(tasks_count / functions_count, 2) if functions_count > 0 else 0,
            "has_tasks": tasks_count > 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{project_id}")
async def get_generated_tasks(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    生成されたタスクの一覧を取得
    """
    try:
        from models.project_base import Task
        
        tasks = db.query(Task).filter_by(project_id=project_id).all()
        
        task_list = []
        for task in tasks:
            task_list.append({
                "task_id": str(task.task_id),
                "node_id": task.node_id,
                "title": task.title,
                "description": task.description,
                "category": task.category,
                "priority": task.priority,
                "estimated_hours": task.estimated_hours,
                "assignee": task.assignee,
                "completed": task.completed,
                "function_id": task.function_id,
                "status": task.status.value if task.status else "TODO"
            })
        
        return {
            "project_id": project_id,
            "total_tasks": len(task_list),
            "tasks": task_list,
            "categories": list(set(task.get("category") for task in task_list if task.get("category"))),
            "priorities": list(set(task.get("priority") for task in task_list if task.get("priority")))
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{project_id}")
async def clear_generated_tasks(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    生成されたタスクをクリア（デバッグ用）
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


@router.post("/batch-test")
async def test_batch_processing(
    db: Session = Depends(get_db)
):
    """
    バッチ処理のテスト用エンドポイント
    """
    try:
        # テスト用の機能データ
        from services.task_generation_service import FunctionBatch
        
        test_functions = [
            FunctionBatch(
                function_id="F001",
                function_code="F001",
                function_name="ユーザー認証",
                description="ユーザーのログイン・ログアウト機能",
                category="auth",
                priority="Must"
            ),
            FunctionBatch(
                function_id="F002", 
                function_code="F002",
                function_name="プロジェクト管理",
                description="プロジェクトのCRUD操作",
                category="data",
                priority="Must"
            )
        ]
        
        service = TaskGenerationService(db)
        project_context = {
            "project_title": "テストプロジェクト",
            "tech_stack": "Next.js, FastAPI, PostgreSQL",
            "framework_info": "標準的なWebアプリケーション"
        }
        
        # バッチ処理をテスト
        result = await service._process_batch(
            test_functions, 
            project_context,
            batch_id="test_batch"
        )
        
        return {
            "test_result": result.dict(),
            "message": "Batch processing test completed successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")