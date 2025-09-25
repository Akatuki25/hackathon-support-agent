from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models.project_base import ProjectDocument, Task, ProjectBase, TaskDependency
from services.enhanced_tasks_service import EnhancedTasksService, PipelineStage
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, date
import uuid
import json
import asyncio

router = APIRouter( tags=["Enhanced Tasks"])

# Request/Response Models
class TaskGenerationRequest(BaseModel):
    hackathon_mode: bool = Field(default=True, description="ハッカソンモード（MVP重視）")
    use_parallel_processing: bool = Field(default=True, description="並列処理を使用するか")
    use_full_workflow: bool = Field(default=True, description="完全なワークフローを使用するか（段階的DB保存・教育的詳細生成含む）")

class TaskGenerationResponse(BaseModel):
    success: bool
    message: str
    tasks_count: int
    dependencies_count: int
    critical_path_length: int
    confidence_score: Optional[float]
    priority_distribution: Dict[str, int]
    generation_metadata: Dict[str, Any]
    topological_order: Optional[List[str]] = None
    parallel_groups: Optional[List[List[str]]] = None
    educational_summary: Optional[Dict[str, Any]] = None

class TaskQualityAnalysisResponse(BaseModel):
    success: bool
    message: str
    task_distribution: Dict[str, Any]
    dependency_analysis: Dict[str, Any]
    quality_indicators: Dict[str, Any]
    recommendations: List[str]

class TaskListResponse(BaseModel):
    success: bool
    message: str
    tasks: List[Dict[str, Any]]
    total_count: int


class StageExecutionResponse(BaseModel):
    success: bool
    stage: str
    data: Dict[str, Any]


class GraphAnalysisResponse(BaseModel):
    success: bool
    stage: str
    dependency_analysis: Dict[str, Any]
    topological_order: Dict[str, Any]
    reactflow: Dict[str, Any]
    metadata: Dict[str, Any]


class LLMUsageResponse(BaseModel):
    success: bool
    project_id: str
    llm_usage: Dict[str, Any]

# Dependency
def get_enhanced_tasks_service(db: Session = Depends(get_db)) -> EnhancedTasksService:
    """Enhanced Tasks Service dependency"""
    return EnhancedTasksService(db)

@router.post(
    "/generate/{project_id}",
    response_model=TaskGenerationResponse,
    summary="プロジェクトの包括的タスク生成",
    description="プロジェクトドキュメントから包括的なタスク分解、優先度付け、依存関係分析を実行。プロジェクト期間とチームサイズは自動取得。"
)
async def generate_comprehensive_tasks(
    project_id: uuid.UUID,
    request: TaskGenerationRequest,
    service: EnhancedTasksService = Depends(get_enhanced_tasks_service),
    db: Session = Depends(get_db)
):
    """
    プロジェクトドキュメントから包括的なタスク生成を実行

    プロジェクト情報は全てデータベースのProjectBaseテーブルから自動取得されます：
    - プロジェクト期間: start_dateとend_dateから自動計算
    - チームサイズ: num_peopleから自動取得

    - **project_id**: プロジェクトID
    - **hackathon_mode**: ハッカソンモード（MVP重視）
    - **use_parallel_processing**: 並列処理を使用するか
    - **use_full_workflow**: 完全なワークフロー（段階的DB保存・教育的詳細生成）を使用するか

    **プロジェクト要件**:
    - ProjectBase.start_dateとend_dateが設定済みであること
    - ProjectBase.num_people（チームサイズ）が1以上の値であること
    - end_dateがstart_dateより後の日付であること
    - 関連するProjectDocumentが存在すること（specification, function_doc, frame_work_doc）
    """
    try:
        # プロジェクトの存在確認
        project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )

        # プロジェクト期間の計算
        if not project.start_date or not project.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project {project_id} must have both start_date and end_date set"
            )

        import logging
        from datetime import date, datetime, time

        s_val = project.start_date
        e_val = project.end_date

        # --- DIAGNOSTIC LOGGING ---
        logger = logging.getLogger(__name__)
        logger.error(f"DIAGNOSTIC: Initial start_val = {s_val}, type = {type(s_val)}")
        logger.error(f"DIAGNOSTIC: Initial end_val = {e_val}, type = {type(e_val)}")
        # --- END DIAGNOSTIC ---

        try:
            # Normalize both to datetime objects
            if type(s_val) is date:
                s_val = datetime.combine(s_val, time(13, 0))

            if type(e_val) is date:
                e_val = datetime.combine(e_val, time(13, 0))
            
            logger.error(f"DIAGNOSTIC: Normalized start_val = {s_val}, type = {type(s_val)}")
            logger.error(f"DIAGNOSTIC: Normalized end_val = {e_val}, type = {type(e_val)}")

            project_duration_days = (e_val - s_val).days

        except TypeError as te:
            logger.error(f"CAUGHT TypeError: {te}")
            logger.error(f"DIAGNOSTIC ON ERROR: Final start_val type = {type(s_val)}, Final end_val type = {type(e_val)}")
            raise te
        if project_duration_days <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project end_date must be after start_date. Current duration: {project_duration_days} days"
            )

        # チームサイズの取得
        team_size = project.num_people
        if not team_size or team_size <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project {project_id} must have a valid num_people (team size) greater than 0. Current: {team_size}"
            )

        # プロジェクトドキュメントの取得
        project_document = db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_id
        ).first()
        if not project_document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project document not found for project {project_id}"
            )

        # 包括的タスク生成の実行（完全ワークフローまたは従来版）
        if request.use_full_workflow:
            # 完全なワークフローを使用（非同期）
            generation_result = await service.generate_comprehensive_tasks_with_full_workflow(
                project_document=project_document,
                project_base=project,
                project_duration_days=project_duration_days,
                team_size=team_size,
                hackathon_mode=request.hackathon_mode,
                use_parallel_processing=request.use_parallel_processing
            )
        else:
            # 従来の同期版を使用
            generation_result = service.generate_comprehensive_tasks_from_document(
                project_document=project_document,
                project_duration_days=project_duration_days,
                team_size=team_size,
                hackathon_mode=request.hackathon_mode
            )

        # 完全ワークフローの場合はDBにすでに保存済み、従来版の場合のみ保存
        if not request.use_full_workflow:
            # データベースタスクオブジェクトに変換
            db_tasks = service.convert_to_database_tasks(
                task_generation_result=generation_result,
                project_id=project_id,
                source_doc_id=project_document.doc_id
            )

            # 既存タスクを削除（プロジェクトのタスクを再生成）
            db.query(Task).filter(Task.project_id == project_id).delete()

            # 新しいタスクをデータベースに保存
            for task in db_tasks:
                db.add(task)

            db.commit()
            tasks_count = len(db_tasks)
        else:
            # 完全ワークフローではタスクは既にDBに保存済み
            tasks_count = generation_result.get("metadata", {}).get("total_tasks", 0)

        # レスポンス生成
        priority_matrix = generation_result.get("priority_matrix", {})
        priority_distribution = {
            priority: len(tasks) for priority, tasks in priority_matrix.items()
        }

        # トポロジカル順序情報を取得
        topological_order = None
        parallel_groups = None
        if "topological_order" in generation_result:
            topo_result = generation_result["topological_order"]
            topological_order = [str(task_id) for task_id in topo_result.get("topological_order", [])]
            parallel_groups = [[str(task_id) for task_id in group] for group in topo_result.get("parallel_groups", [])]

        return TaskGenerationResponse(
            success=True,
            message=f"Successfully generated {tasks_count} tasks for project {project_id} (Duration: {project_duration_days} days from {project.start_date.strftime('%Y-%m-%d')} to {project.end_date.strftime('%Y-%m-%d')}, Team: {team_size} people)",
            tasks_count=tasks_count,
            dependencies_count=len(generation_result.get("dependency_graph", {}).get("edges", [])),
            critical_path_length=len(generation_result.get("topological_order", {}).get("critical_path", [])),
            confidence_score=generation_result.get("confidence_metrics", {}).get("overall_confidence"),
            priority_distribution=priority_distribution,
            generation_metadata={
                **generation_result.get("metadata", {}),
                "calculated_project_duration_days": project_duration_days,
                "calculated_team_size": team_size,
                "project_start_date": project.start_date.isoformat(),
                "project_end_date": project.end_date.isoformat()
            },
            topological_order=topological_order,
            parallel_groups=parallel_groups,
            educational_summary=generation_result.get("educational_summary")
        )

    except HTTPException:
        raise
    except Exception as e:
        service.logger.error(f"Error in comprehensive task generation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during task generation: {str(e)}"
        )


@router.post(
    "/generate/{project_id}/stage1",
    response_model=StageExecutionResponse,
    summary="Stage1: タスク分割",
)
async def execute_stage1(
    project_id: uuid.UUID,
    request: TaskGenerationRequest,
    service: EnhancedTasksService = Depends(get_enhanced_tasks_service),
):
    try:
        result = await service.run_stage1(
            project_id,
            hackathon_mode=request.hackathon_mode,
            use_parallel_processing=request.use_parallel_processing,
        )
        return StageExecutionResponse(
            success=True,
            stage=PipelineStage.TASK_DECOMPOSITION.value,
            data=result,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post(
    "/generate/{project_id}/stage2",
    response_model=StageExecutionResponse,
    summary="Stage2: ディレクトリ構成生成",
)
async def execute_stage2(
    project_id: uuid.UUID,
    request: TaskGenerationRequest,
    service: EnhancedTasksService = Depends(get_enhanced_tasks_service),
):
    try:
        result = await service.run_stage2(
            project_id,
            hackathon_mode=request.hackathon_mode,
            use_parallel_processing=request.use_parallel_processing,
        )
        return StageExecutionResponse(
            success=True,
            stage=PipelineStage.DIRECTORY_BLUEPRINT.value,
            data=result,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post(
    "/generate/{project_id}/stage3",
    response_model=StageExecutionResponse,
    summary="Stage3: 教育的タスク詳細生成",
)
async def execute_stage3(
    project_id: uuid.UUID,
    request: TaskGenerationRequest,
    service: EnhancedTasksService = Depends(get_enhanced_tasks_service),
):
    try:
        result = await service.run_stage3(
            project_id,
            hackathon_mode=request.hackathon_mode,
            use_parallel_processing=request.use_parallel_processing,
        )
        return StageExecutionResponse(
            success=True,
            stage=PipelineStage.EDUCATIONAL_RESOURCES.value,
            data=result,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post(
    "/generate/{project_id}/analysis",
    response_model=GraphAnalysisResponse,
    summary="Stage4: 依存関係分析とトポロジカルソート",
)
async def execute_graph_analysis(
    project_id: uuid.UUID,
    request: TaskGenerationRequest,
    service: EnhancedTasksService = Depends(get_enhanced_tasks_service),
):
    try:
        stage4_result = await service.run_stage4(
            project_id,
            hackathon_mode=request.hackathon_mode,
            use_parallel_processing=request.use_parallel_processing,
        )
        topology = service.serialize_topological_result(
            stage4_result.get("topological_order", {})
        )
        reactflow_payload = service.build_reactflow_payload(stage4_result)
        return GraphAnalysisResponse(
            success=True,
            stage=stage4_result.get("stage", PipelineStage.GRAPH_ANALYSIS.value),
            dependency_analysis=stage4_result.get("dependency_analysis", {}),
            topological_order=topology,
            reactflow=reactflow_payload,
            metadata={
                "graph_stats": topology.get("graph_stats", {}),
                "priority_distribution": stage4_result.get("priority_distribution", {}),
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post(
    "/generate/{project_id}/stage5",
    response_model=StageExecutionResponse,
    summary="Stage5: タイムライン生成",
)
async def execute_stage5(
    project_id: uuid.UUID,
    request: TaskGenerationRequest,
    service: EnhancedTasksService = Depends(get_enhanced_tasks_service),
):
    try:
        stage5_result = await service.run_stage5(
            project_id,
            hackathon_mode=request.hackathon_mode,
            use_parallel_processing=request.use_parallel_processing,
        )
        return StageExecutionResponse(
            success=True,
            stage=stage5_result.get("stage", PipelineStage.TIMELINE_AND_REACTFLOW.value),
            data=stage5_result,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get(
    "/generate/{project_id}/llm-usage",
    response_model=LLMUsageResponse,
    summary="LLM使用状況の取得",
)
async def get_llm_usage(
    project_id: uuid.UUID,
    service: EnhancedTasksService = Depends(get_enhanced_tasks_service),
):
    try:
        payload = service.get_stage_payload(project_id, PipelineStage.LLM_USAGE)
        usage_data = payload.get("llm_usage", {}) if payload else {}
        return LLMUsageResponse(
            success=True,
            project_id=str(project_id),
            llm_usage=usage_data,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

@router.get(
    "/analyze/{project_id}",
    response_model=TaskQualityAnalysisResponse,
    summary="タスク分解品質分析",
    description="生成されたタスクの品質分析と改善提案"
)
async def analyze_task_quality(
    project_id: uuid.UUID,
    service: EnhancedTasksService = Depends(get_enhanced_tasks_service),
    db: Session = Depends(get_db)
):
    """
    プロジェクトのタスク分解品質を分析

    - **project_id**: プロジェクトID
    """
    try:
        # プロジェクトの存在確認
        project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )

        # プロジェクトのタスクを取得
        tasks = db.query(Task).filter(Task.project_id == project_id).all()
        if not tasks:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No tasks found for project {project_id}"
            )

        # タスクデータを分析用フォーマットに変換
        tasks_data = []
        dependency_edges = []

        for task in tasks:
            task_dict = {
                "task_name": task.title,
                "category": task.category,
                "moscow_priority": task.moscow_priority,
                "complexity_level": task.complexity_level,
                "estimated_hours": task.estimated_hours,
                "business_value_score": task.business_value_score,
                "technical_risk_score": task.technical_risk_score,
                "implementation_difficulty": task.implementation_difficulty,
                "user_impact_score": task.user_impact_score,
                "dependency_weight": task.dependency_weight,
                "mvp_critical": task.mvp_critical
            }

            # detail から追加情報を取得
            if task.detail:
                try:
                    detail_data = json.loads(task.detail)
                    task_dict.update(detail_data)
                except json.JSONDecodeError:
                    pass

            tasks_data.append(task_dict)

            # 依存関係の構築
            if task.depends_on_task_id:
                dependency_edges.append({
                    "from_task_index": next((i for i, t in enumerate(tasks) if t.task_id == task.depends_on_task_id), None),
                    "to_task_index": tasks.index(task),
                    "dependency_type": "prerequisite",
                    "strength": task.dependency_weight or 5
                })

        # 分析用の結果構造を構築
        mock_generation_result = {
            "tasks": tasks_data,
            "dependency_graph": {
                "edges": dependency_edges,
                "critical_path": [],  # 簡略化
                "parallel_groups": [],
                "bottleneck_tasks": []
            },
            "confidence_metrics": {
                "overall_confidence": 0.8,  # デフォルト値
                "requirement_coverage_score": 0.85,
                "estimation_reliability_score": 0.75,
                "dependency_accuracy_score": 0.8,
                "improvement_suggestions": []
            }
        }

        # 品質分析の実行
        quality_analysis = service.analyze_task_breakdown_quality(mock_generation_result)

        return TaskQualityAnalysisResponse(
            success=True,
            message=f"Quality analysis completed for {len(tasks)} tasks",
            task_distribution=quality_analysis.get("task_distribution", {}),
            dependency_analysis=quality_analysis.get("dependency_analysis", {}),
            quality_indicators=quality_analysis.get("quality_indicators", {}),
            recommendations=quality_analysis.get("recommendations", [])
        )

    except HTTPException:
        raise
    except Exception as e:
        service.logger.error(f"Error in task quality analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during quality analysis: {str(e)}"
        )

@router.get(
    "/tasks/{project_id}",
    response_model=TaskListResponse,
    summary="プロジェクトタスク一覧取得",
    description="プロジェクトの全タスクを詳細情報と共に取得"
)
async def get_project_tasks(
    project_id: uuid.UUID,
    include_details: bool = True,
    category: Optional[str] = None,
    moscow_priority: Optional[str] = None,
    mvp_critical_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのタスク一覧を取得

    - **project_id**: プロジェクトID
    - **include_details**: 詳細情報を含めるか
    - **category**: カテゴリでフィルタ
    - **moscow_priority**: MoSCoW優先度でフィルタ
    - **mvp_critical_only**: MVP必須タスクのみ
    """
    try:
        # プロジェクトの存在確認
        project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )

        # クエリ構築
        query = db.query(Task).filter(Task.project_id == project_id)

        if category:
            query = query.filter(Task.category == category)
        if moscow_priority:
            query = query.filter(Task.moscow_priority == moscow_priority)
        if mvp_critical_only:
            query = query.filter(Task.mvp_critical == True)

        tasks = query.order_by(Task.created_at.desc()).all()

        # タスクデータの構築
        tasks_data = []
        for task in tasks:
            task_dict = {
                "task_id": str(task.task_id),
                "title": task.title,
                "description": task.description,
                "status": task.status,
                "priority": task.priority,
                "due_at": task.due_at.isoformat() if task.due_at else None,
                "category": task.category,
                "estimated_hours": task.estimated_hours,
                "complexity_level": task.complexity_level,
                "moscow_priority": task.moscow_priority,
                "mvp_critical": task.mvp_critical,
                "created_at": task.created_at.isoformat(),
                "updated_at": task.updated_at.isoformat()
            }

            if include_details:
                task_dict.update({
                    "business_value_score": task.business_value_score,
                    "technical_risk_score": task.technical_risk_score,
                    "implementation_difficulty": task.implementation_difficulty,
                    "user_impact_score": task.user_impact_score,
                    "dependency_weight": task.dependency_weight,
                    "depends_on_task_id": str(task.depends_on_task_id) if task.depends_on_task_id else None,
                    "source_doc_id": str(task.source_doc_id) if task.source_doc_id else None
                })

                # detail から追加情報を取得
                if task.detail:
                    try:
                        detail_data = json.loads(task.detail)
                        task_dict["detail"] = detail_data
                    except json.JSONDecodeError:
                        task_dict["detail"] = {"raw": task.detail}

            tasks_data.append(task_dict)

        return TaskListResponse(
            success=True,
            message=f"Retrieved {len(tasks_data)} tasks for project {project_id}",
            tasks=tasks_data,
            total_count=len(tasks_data)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during task retrieval: {str(e)}"
        )

@router.delete(
    "/tasks/{project_id}",
    summary="プロジェクトタスク全削除",
    description="プロジェクトの全タスクを削除（再生成前のクリーンアップ用）"
)
async def delete_project_tasks(
    project_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    プロジェクトの全タスクを削除

    - **project_id**: プロジェクトID
    """
    try:
        # プロジェクトの存在確認
        project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )

        # タスクの削除
        deleted_count = db.query(Task).filter(Task.project_id == project_id).delete()
        db.commit()

        return {
            "success": True,
            "message": f"Deleted {deleted_count} tasks for project {project_id}",
            "deleted_count": deleted_count
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during task deletion: {str(e)}"
        )

@router.get(
    "/dependencies/{project_id}",
    summary="プロジェクトタスク依存関係取得",
    description="プロジェクトのタスク依存関係とトポロジカル情報を取得"
)
async def get_project_task_dependencies(
    project_id: uuid.UUID,
    include_topological_info: bool = True,
    include_critical_path: bool = True,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのタスク依存関係を取得

    - **project_id**: プロジェクトID
    - **include_topological_info**: トポロジカル順序情報を含むか
    - **include_critical_path**: クリティカルパス情報を含むか
    """
    try:
        # プロジェクトの存在確認
        project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )

        # タスクと依存関係の取得
        tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.topological_order).all()
        dependencies = db.query(TaskDependency).filter(TaskDependency.project_id == project_id).all()

        # 依存関係情報の構築
        dependency_info = []
        for dep in dependencies:
            dependency_info.append({
                "dependency_id": str(dep.dependency_id),
                "prerequisite_task_id": str(dep.prerequisite_task_id),
                "dependent_task_id": str(dep.dependent_task_id),
                "dependency_type": dep.dependency_type,
                "dependency_strength": dep.dependency_strength,
                "lag_time_hours": dep.lag_time_hours,
                "is_critical": dep.is_critical,
                "auto_detected": dep.auto_detected,
                "ai_confidence": dep.ai_confidence,
                "notes": dep.notes
            })

        # トポロジカル情報の構築
        topological_info = {}
        if include_topological_info:
            topological_order = [str(task.task_id) for task in tasks if task.topological_order is not None]

            # 並列グループの特定
            parallel_groups = {}
            for task in tasks:
                if task.parallel_group_id:
                    group_id = task.parallel_group_id
                    if group_id not in parallel_groups:
                        parallel_groups[group_id] = []
                    parallel_groups[group_id].append(str(task.task_id))

            # 実行フェーズの特定
            execution_phases = {
                "setup": [str(task.task_id) for task in tasks if task.execution_phase == "setup"],
                "development": [str(task.task_id) for task in tasks if task.execution_phase == "development"],
                "testing": [str(task.task_id) for task in tasks if task.execution_phase == "testing"],
                "deployment": [str(task.task_id) for task in tasks if task.execution_phase == "deployment"]
            }

            topological_info = {
                "topological_order": topological_order,
                "parallel_groups": list(parallel_groups.values()),
                "execution_phases": execution_phases
            }

        # クリティカルパス情報
        critical_path_info = {}
        if include_critical_path:
            critical_path_tasks = [str(task.task_id) for task in tasks if task.critical_path]
            critical_dependencies = [
                str(dep.dependency_id) for dep in dependencies if dep.is_critical
            ]

            critical_path_info = {
                "critical_path_tasks": critical_path_tasks,
                "critical_dependencies": critical_dependencies,
                "estimated_total_hours": sum(task.estimated_hours or 0 for task in tasks if task.critical_path)
            }

        return {
            "success": True,
            "message": f"Retrieved dependency information for {len(tasks)} tasks",
            "project_id": str(project_id),
            "total_tasks": len(tasks),
            "total_dependencies": len(dependencies),
            "dependencies": dependency_info,
            "topological_info": topological_info if include_topological_info else None,
            "critical_path_info": critical_path_info if include_critical_path else None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during dependency retrieval: {str(e)}"
        )

@router.get(
    "/timeline/{project_id}",
    summary="プロジェクトタイムライン情報取得",
    description="プロジェクトのタイムラインと日程情報を取得"
)
async def get_project_timeline(
    project_id: uuid.UUID,
    include_task_details: bool = False,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのタイムライン情報を取得

    - **project_id**: プロジェクトID
    - **include_task_details**: タスク詳細情報を含むか
    """
    try:
        # プロジェクトの存在確認
        project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )

        # タスクの取得（タイムライン順）
        tasks = db.query(Task).filter(Task.project_id == project_id).order_by(
            Task.planned_start_date, Task.topological_order
        ).all()

        # タイムライン情報の構築
        timeline_info = []
        for task in tasks:
            task_timeline = {
                "task_id": str(task.task_id),
                "title": task.title,
                "topological_order": task.topological_order,
                "execution_phase": task.execution_phase,
                "parallel_group_id": task.parallel_group_id,
                "critical_path": task.critical_path,
                "planned_start_date": task.planned_start_date.isoformat() if task.planned_start_date else None,
                "planned_end_date": task.planned_end_date.isoformat() if task.planned_end_date else None,
                "actual_start_date": task.actual_start_date.isoformat() if task.actual_start_date else None,
                "actual_end_date": task.actual_end_date.isoformat() if task.actual_end_date else None,
                "estimated_hours": task.estimated_hours,
                "progress_percentage": task.progress_percentage,
                "status": task.status
            }

            if include_task_details:
                task_timeline.update({
                    "category": task.category,
                    "complexity_level": task.complexity_level,
                    "moscow_priority": task.moscow_priority,
                    "mvp_critical": task.mvp_critical,
                    "business_value_score": task.business_value_score,
                    "technical_risk_score": task.technical_risk_score,
                    "blocking_reason": task.blocking_reason
                })

            timeline_info.append(task_timeline)

        # プロジェクト全体のタイムライン統計
        project_stats = {
            "project_start_date": project.start_date.isoformat(),
            "project_end_date": project.end_date.isoformat(),
            "total_project_days": (project.end_date - project.start_date).days,
            "total_estimated_hours": sum(task.estimated_hours or 0 for task in tasks),
            "critical_path_hours": sum(task.estimated_hours or 0 for task in tasks if task.critical_path),
            "tasks_by_phase": {
                "setup": len([t for t in tasks if t.execution_phase == "setup"]),
                "development": len([t for t in tasks if t.execution_phase == "development"]),
                "testing": len([t for t in tasks if t.execution_phase == "testing"]),
                "deployment": len([t for t in tasks if t.execution_phase == "deployment"])
            },
            "progress_overview": {
                "not_started": len([t for t in tasks if t.progress_percentage == 0]),
                "in_progress": len([t for t in tasks if 0 < t.progress_percentage < 100]),
                "completed": len([t for t in tasks if t.progress_percentage == 100])
            }
        }

        return {
            "success": True,
            "message": f"Retrieved timeline for {len(tasks)} tasks",
            "project_id": str(project_id),
            "project_stats": project_stats,
            "timeline": timeline_info
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during timeline retrieval: {str(e)}"
        )

@router.get(
    "/educational/{project_id}",
    summary="プロジェクト教育的情報取得",
    description="プロジェクトのタスクの教育的情報とリソースを取得"
)
async def get_project_educational_info(
    project_id: uuid.UUID,
    task_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db)
):
    """
    プロジェクトの教育的情報を取得

    - **project_id**: プロジェクトID
    - **task_id**: 特定のタスクID（指定した場合そのタスクのみ）
    """
    try:
        # プロジェクトの存在確認
        project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )

        # タスクの取得
        if task_id:
            tasks = [db.query(Task).filter(Task.task_id == task_id, Task.project_id == project_id).first()]
            if not tasks[0]:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Task with ID {task_id} not found in project {project_id}"
                )
        else:
            tasks = db.query(Task).filter(Task.project_id == project_id).all()

        # 教育的情報の構築
        educational_info = []
        all_technologies = set()
        all_learning_resources = []

        for task in tasks:
            task_education = {
                "task_id": str(task.task_id),
                "title": task.title,
                "category": task.category,
                "complexity_level": task.complexity_level,
                "estimated_hours": task.estimated_hours,
                "detail": task.detail,
                "learning_resources": task.learning_resources or [],
                "technology_stack": task.technology_stack or [],
                "reference_links": task.reference_links or [],
                "completion_criteria": task.completion_criteria
            }

            # 技術とリソースを集約
            if task.technology_stack:
                for tech in task.technology_stack:
                    if isinstance(tech, dict):
                        all_technologies.add(tech.get("name", ""))
                    else:
                        all_technologies.add(str(tech))

            if task.learning_resources:
                all_learning_resources.extend(task.learning_resources)

            educational_info.append(task_education)

        # プロジェクト全体の教育的サマリー
        educational_summary = {
            "total_unique_technologies": len(all_technologies),
            "technologies_overview": list(all_technologies),
            "total_learning_resources": len(set(all_learning_resources)),
            "complexity_distribution": {
                str(level): len([t for t in tasks if t.complexity_level == level])
                for level in range(1, 6)
            },
            "recommended_learning_path": [
                "基礎環境構築から開始することをお勧めします",
                "MVP重要機能を優先的に学習してください",
                "並列実行可能なタスクで効率的にスキルアップしてください",
                "高複雑度タスクには十分な学習時間を確保してください"
            ]
        }

        return {
            "success": True,
            "message": f"Retrieved educational information for {len(tasks)} tasks",
            "project_id": str(project_id),
            "educational_summary": educational_summary,
            "tasks_educational_info": educational_info
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error during educational info retrieval: {str(e)}"
        )
        
        
        
