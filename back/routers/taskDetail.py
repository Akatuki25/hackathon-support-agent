from fastapi import APIRouter, responses, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from database import get_db
from services.taskDetail_service import TaskDetailService, TaskItem, TechnologyReference, EnhancedTaskDetail

import time
from models.project_base import ProjectDocument
router = APIRouter()

# Enhanced request models
class TaskDetailRequest(BaseModel):
    tasks: List[TaskItem]
    specification: str

class EnhancedTaskDetailRequest(BaseModel):
    """拡張タスク詳細生成リクエスト"""
    tasks: List[TaskItem]
    specification: str
    framework_doc: Optional[str] = None
    directory_info: Optional[str] = None
    function_doc: Optional[str] = None

class ProjectDocumentTaskRequest(BaseModel):
    """ProjectDocumentからタスク詳細生成するリクエスト"""
    project_id: str
    tasks: List[TaskItem]

class TechnologyReferenceResponse(BaseModel):
    """技術参照レスポンス"""
    name: str
    official_url: str
    documentation_url: str
    tutorial_url: str
    why_needed: str
    key_concepts: List[str]

class EnhancedTaskDetailResponse(BaseModel):
    """拡張タスク詳細レスポンス"""
    task_name: str
    priority: str
    content: str
    detail: str
    technologies_used: List[TechnologyReferenceResponse]
    learning_resources: List[str]
    dependency_explanation: str
    educational_notes: str

class EnhancedTaskBatchResponse(BaseModel):
    """拡張タスクバッチレスポンス"""
    tasks: List[EnhancedTaskDetailResponse]
    total_processed: int
    generation_time_seconds: float
    technologies_found: List[str]

# Backward compatibility endpoint
@router.post("/")
async def generate_task_details(request: TaskDetailRequest, db: Session = Depends(get_db)):
    """
    各タスクを並列に LLM 呼び出しして detail を生成 (従来版)
    """
    service = TaskDetailService(db=db)
    # Pydantic モデルを dict 変換
    task_dicts = [t.model_dump() for t in request.tasks]
    specification = request.specification

    try:
        # スレッド数はマシン性能とレート制限に合わせて調整
        detailed = await run_in_threadpool(service.generate_task_details_parallel, task_dicts, specification, 2, 3)
        return responses.JSONResponse(content={"tasks": detailed})
    except Exception as e:
        # router レベルでも念のためキャッチ
        raise HTTPException(status_code=500, detail=f"タスク詳細生成中にエラーが発生しました: {e}")

@router.post("/enhanced", response_model=EnhancedTaskBatchResponse)
async def generate_enhanced_task_details(request: EnhancedTaskDetailRequest, db: Session = Depends(get_db)):
    """
    拡張タスク詳細生成：AI検索とRAG処理を使用して教育的なタスク詳細を生成
    """
    import time
    start_time = time.time()

    service = TaskDetailService(db)
    task_dicts = [t.model_dump() for t in request.tasks]

    # 仕様書の拡張（追加情報があれば結合）
    extended_specification = request.specification
    if request.framework_doc:
        extended_specification += f"\n\n## 技術選定情報\n{request.framework_doc}"
    if request.directory_info:
        extended_specification += f"\n\n## ディレクトリ構造\n{request.directory_info}"
    if request.function_doc:
        extended_specification += f"\n\n## 機能仕様\n{request.function_doc}"

    try:
        # 拡張詳細生成（検索とRAG処理含む）
        enhanced_results = await run_in_threadpool(
            service.generate_task_details_batch,
            extended_specification,
            task_dicts
        )

        # レスポンス変換
        response_tasks = []
        all_technologies = set()

        for result in enhanced_results:
            # 技術情報の処理
            tech_responses = []
            for tech in result.get('technologies_used', []):
                tech_responses.append(TechnologyReferenceResponse(
                    name=tech['name'],
                    official_url=tech['official_url'],
                    documentation_url=tech['documentation_url'],
                    tutorial_url=tech['tutorial_url'],
                    why_needed=tech['why_needed'],
                    key_concepts=tech['key_concepts']
                ))
                all_technologies.add(tech['name'])

            response_tasks.append(EnhancedTaskDetailResponse(
                task_name=result['task_name'],
                priority=result['priority'],
                content=result['content'],
                detail=result['detail'],
                technologies_used=tech_responses,
                learning_resources=result['learning_resources'],
                dependency_explanation=result['dependency_explanation'],
                educational_notes=result['educational_notes']
            ))

        generation_time = time.time() - start_time

        return EnhancedTaskBatchResponse(
            tasks=response_tasks,
            total_processed=len(response_tasks),
            generation_time_seconds=round(generation_time, 2),
            technologies_found=list(all_technologies)
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"拡張タスク詳細生成中にエラーが発生しました: {str(e)}"
        )

@router.post("/from-project-document", response_model=EnhancedTaskBatchResponse)
async def generate_task_details_from_project_document(
    request: ProjectDocumentTaskRequest,
    db: Session = Depends(get_db)
):
    """
    ProjectDocumentからタスク詳細を生成
    """

    start_time = time.time()
    service = TaskDetailService(db)

    try:
        # ProjectDocumentを取得
        project_doc = db.query(ProjectDocument).filter(
            ProjectDocument.project_id == request.project_id
        ).first()

        if not project_doc:
            raise HTTPException(
                status_code=404,
                detail=f"プロジェクト {request.project_id} のドキュメントが見つかりません"
            )

        # ProjectDocumentから統合仕様書を作成
        integrated_specification = f"""
        # プロジェクト仕様書
        {project_doc.specification or ""}
        ## 機能仕様
        {project_doc.function_doc or ""}
        ## 技術選定・フレームワーク情報
        {project_doc.frame_work_doc or ""}
        ## ディレクトリ構造
        {project_doc.directory_info or ""}
        """.strip()

        task_dicts = [t.model_dump() for t in request.tasks]

        # 拡張詳細生成
        enhanced_results = await run_in_threadpool(
            service.generate_task_details_batch,
            integrated_specification,
            task_dicts
        )

        # レスポンス変換
        response_tasks = []
        all_technologies = set()

        for result in enhanced_results:
            tech_responses = []
            for tech in result.get('technologies_used', []):
                tech_responses.append(TechnologyReferenceResponse(**tech))
                all_technologies.add(tech['name'])

            response_tasks.append(EnhancedTaskDetailResponse(
                task_name=result['task_name'],
                priority=result['priority'],
                content=result['content'],
                detail=result['detail'],
                technologies_used=tech_responses,
                learning_resources=result['learning_resources'],
                dependency_explanation=result['dependency_explanation'],
                educational_notes=result['educational_notes']
            ))

        generation_time = time.time() - start_time

        return EnhancedTaskBatchResponse(
            tasks=response_tasks,
            total_processed=len(response_tasks),
            generation_time_seconds=round(generation_time, 2),
            technologies_found=list(all_technologies)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"ProjectDocumentからのタスク詳細生成中にエラーが発生しました: {str(e)}"
        )

@router.get("/health")
async def health_check():
    """
    ヘルスチェックエンドポイント
    """
    return {"status": "healthy", "service": "enhanced_task_detail_service"}

@router.get("/technologies")
async def get_supported_technologies():
    """
    サポートされている技術一覧を取得
    """
    return {
        "supported_technologies": [
            "React", "Vue.js", "Next.js", "Angular", "Node.js", "Express",
            "FastAPI", "Django", "Flask", "PostgreSQL", "MySQL", "MongoDB",
            "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Vercel", "Netlify",
            "TypeScript", "JavaScript", "Python", "Java", "Go", "Rust",
            "Redis", "Elasticsearch", "GraphQL", "REST API", "WebSocket",
            "Jest", "Cypress", "pytest", "JUnit", "Selenium"
        ],
        "categories": {
            "frontend": ["React", "Vue.js", "Next.js", "Angular"],
            "backend": ["Node.js", "Express", "FastAPI", "Django", "Flask"],
            "database": ["PostgreSQL", "MySQL", "MongoDB", "Redis"],
            "cloud": ["AWS", "Azure", "GCP", "Vercel", "Netlify"],
            "devops": ["Docker", "Kubernetes"],
            "testing": ["Jest", "Cypress", "pytest", "JUnit", "Selenium"]
        }
    }