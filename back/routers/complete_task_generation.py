"""
完全なタスク生成API
全エージェント処理を一括実行
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from database import get_db
from services.integrated_task_service import IntegratedTaskService


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