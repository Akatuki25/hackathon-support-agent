"""
タスク品質評価API
2軸品質評価によるタスク改善システム
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
from database import get_db
from services.task_quality_evaluation_service import TaskQualityEvaluationService


router = APIRouter()


class TaskQualityEvaluationRequest(BaseModel):
    """タスク品質評価リクエスト"""
    project_id: str


class TaskQualityEvaluationResponse(BaseModel):
    """タスク品質評価レスポンス"""
    success: bool
    message: str
    project_id: str
    overall_score: float
    is_acceptable: bool
    layer_evaluation: Dict[str, Any]
    domain_evaluation: Dict[str, Any]
    consolidated_issues: list
    total_issues: int
    critical_issues: int
    evaluation_time: Optional[float] = None
    error: Optional[str] = None


class TaskQualityImprovementRequest(BaseModel):
    """タスク品質改善リクエスト"""
    project_id: str
    max_iterations: Optional[int] = 3


class TaskQualityImprovementResponse(BaseModel):
    """タスク品質改善レスポンス"""
    success: bool
    message: str
    project_id: str
    is_acceptable: bool
    total_iterations: int
    final_issue_count: int
    critical_issues_remaining: int
    modifications_applied: int
    suggested_new_tasks: list
    processing_time: Optional[float] = None
    error: Optional[str] = None


@router.post("/evaluate", response_model=TaskQualityEvaluationResponse)
async def evaluate_task_quality(
    request: TaskQualityEvaluationRequest,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのタスク品質を2軸で評価する
    
    技術層内整合性とドメイン完結性の2軸で並列評価を実行し、
    品質問題を特定・分類する
    """
    try:
        import time
        start_time = time.time()
        
        service = TaskQualityEvaluationService(db)
        result = await service.evaluate_task_quality(request.project_id)
        
        processing_time = time.time() - start_time
        
        return TaskQualityEvaluationResponse(
            success=True,
            message=f"Task quality evaluation completed for project {request.project_id}",
            project_id=result["project_id"],
            overall_score=result["overall_score"],
            is_acceptable=result["is_acceptable"],
            layer_evaluation=result["layer_evaluation"],
            domain_evaluation=result["domain_evaluation"],
            consolidated_issues=result["consolidated_issues"],
            total_issues=result["total_issues"],
            critical_issues=result["critical_issues"],
            evaluation_time=processing_time
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error during task quality evaluation: {str(e)}"
        )


@router.post("/improve", response_model=TaskQualityImprovementResponse)
async def improve_task_quality(
    request: TaskQualityImprovementRequest,
    db: Session = Depends(get_db)
):
    """
    タスク品質をLangGraphワークフローで改善する
    
    反復的な品質評価と修正を実行し、受け入れ可能な品質レベルまで
    タスクを改善する
    """
    try:
        import time
        start_time = time.time()
        
        service = TaskQualityEvaluationService(db)
        
        # max_iterationsを初期状態に設定
        if hasattr(service, '_set_max_iterations'):
            service._set_max_iterations(request.max_iterations)
        
        result = await service.run_quality_improvement_workflow(request.project_id)
        
        processing_time = time.time() - start_time
        
        return TaskQualityImprovementResponse(
            success=True,
            message=f"Task quality improvement completed for project {request.project_id}",
            project_id=result["project_id"],
            is_acceptable=result["is_acceptable"],
            total_iterations=result["total_iterations"],
            final_issue_count=result["final_issue_count"],
            critical_issues_remaining=result["critical_issues_remaining"],
            modifications_applied=result["modifications_applied"],
            suggested_new_tasks=result["suggested_new_tasks"],
            processing_time=processing_time
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error during task quality improvement: {str(e)}"
        )


@router.get("/status/{project_id}")
async def get_task_quality_status(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのタスク品質評価状況を確認
    """
    try:
        from models.project_base import Task, StructuredFunction
        
        # タスク数を取得
        tasks_count = db.query(Task).filter_by(project_id=project_id).count()
        
        # 機能数を取得
        functions_count = db.query(StructuredFunction).filter_by(project_id=project_id).count()
        
        # カテゴリ別タスク数を取得
        task_categories = {}
        if tasks_count > 0:
            tasks = db.query(Task).filter_by(project_id=project_id).all()
            for task in tasks:
                category = task.category or "未分類"
                task_categories[category] = task_categories.get(category, 0) + 1
        
        # 機能別タスク数を取得
        function_tasks = {}
        if tasks_count > 0:
            tasks = db.query(Task).filter_by(project_id=project_id).all()
            for task in tasks:
                function_id = task.function_id
                if function_id:
                    function_tasks[str(function_id)] = function_tasks.get(str(function_id), 0) + 1
        
        return {
            "project_id": project_id,
            "total_tasks": tasks_count,
            "total_functions": functions_count,
            "task_categories": task_categories,
            "function_task_distribution": function_tasks,
            "has_sufficient_data": tasks_count > 0 and functions_count > 0,
            "average_tasks_per_function": round(tasks_count / functions_count, 2) if functions_count > 0 else 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/issues/{project_id}")
async def get_quality_issues_preview(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    品質評価プレビュー（簡易評価）
    
    軽量な品質チェックを実行し、主要な問題を特定する
    """
    try:
        service = TaskQualityEvaluationService(db)
        
        # 簡易評価（ワークフローなし）
        result = await service.evaluate_task_quality(project_id)
        
        # 問題の要約
        issues_summary = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": []
        }
        
        for issue in result["consolidated_issues"]:
            severity = issue.get("severity", "low")
            if severity in issues_summary:
                issues_summary[severity].append({
                    "type": issue.get("type"),
                    "description": issue.get("description"),
                    "suggested_action": issue.get("suggested_action"),
                    "category": issue.get("category")
                })
        
        return {
            "project_id": project_id,
            "overall_score": result["overall_score"],
            "is_acceptable": result["is_acceptable"],
            "issues_summary": issues_summary,
            "layer_score": result["layer_evaluation"]["overall_score"],
            "domain_score": result["domain_evaluation"]["overall_score"],
            "total_issues": result["total_issues"],
            "improvement_needed": not result["is_acceptable"]
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cache/{project_id}")
async def clear_evaluation_cache(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    評価キャッシュをクリア（開発・デバッグ用）
    """
    try:
        # 実際の実装では評価結果キャッシュがあればクリア
        # 現在の実装では特にキャッシュはないため、ステータス確認のみ
        
        from models.project_base import Task, StructuredFunction
        
        tasks_count = db.query(Task).filter_by(project_id=project_id).count()
        functions_count = db.query(StructuredFunction).filter_by(project_id=project_id).count()
        
        return {
            "project_id": project_id,
            "cache_cleared": True,
            "message": f"Cache cleared for project {project_id}",
            "current_tasks": tasks_count,
            "current_functions": functions_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))