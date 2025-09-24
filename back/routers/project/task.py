from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from database import get_db
from models.project_base import Task, TaskStatusEnum, PriorityEnum, TaskDependency

router = APIRouter()

# ========== Pydantic モデル ==========

class TaskCreate(BaseModel):
    project_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=255, description="タスクタイトル")
    description: Optional[str] = Field(None, description="タスク概要")
    detail: Optional[str] = Field(None, description="詳細実装指針")
    status: Optional[str] = Field("TODO", description="ステータス")
    priority: Optional[str] = Field("MEDIUM", description="優先度")

    # Timeline and scheduling fields
    planned_start_date: Optional[datetime] = Field(None, description="計画開始日")
    planned_end_date: Optional[datetime] = Field(None, description="計画終了日")
    actual_start_date: Optional[datetime] = Field(None, description="実際の開始日")
    actual_end_date: Optional[datetime] = Field(None, description="実際の終了日")
    due_at: Optional[datetime] = Field(None, description="期限")

    # Task ordering and dependencies
    topological_order: Optional[int] = Field(None, description="トポロジカルソート順序")
    execution_phase: Optional[str] = Field(None, description="実行フェーズ")
    parallel_group_id: Optional[str] = Field(None, description="並列実行グループID")
    critical_path: bool = Field(False, description="クリティカルパス上のタスクか")

    # Comprehensive task management fields
    category: Optional[str] = Field(None, description="カテゴリ")
    estimated_hours: Optional[int] = Field(None, ge=0, description="見積作業時間")
    complexity_level: Optional[int] = Field(None, ge=1, le=5, description="複雑度（1-5スケール）")
    business_value_score: Optional[int] = Field(None, ge=1, le=10, description="ビジネス価値（1-10スケール）")
    technical_risk_score: Optional[int] = Field(None, ge=1, le=10, description="技術リスク（1-10スケール）")
    implementation_difficulty: Optional[int] = Field(None, ge=1, le=10, description="実装難易度（1-10スケール）")
    user_impact_score: Optional[int] = Field(None, ge=1, le=10, description="ユーザー影響度（1-10スケール）")
    dependency_weight: Optional[int] = Field(None, ge=1, le=10, description="依存関係重み（1-10スケール）")
    moscow_priority: Optional[str] = Field(None, description="MoSCoW優先度")
    mvp_critical: bool = Field(False, description="MVP必須フラグ")

    # Progress tracking
    progress_percentage: int = Field(0, ge=0, le=100, description="進捗率（0-100）")
    blocking_reason: Optional[str] = Field(None, description="ブロッキング理由")
    completion_criteria: Optional[str] = Field(None, description="完了基準")

    # Educational and reference information
    learning_resources: Optional[List[str]] = Field(None, description="学習リソース")
    technology_stack: Optional[List[Dict[str, Any]]] = Field(None, description="使用技術スタック")
    reference_links: Optional[List[str]] = Field(None, description="参考リンク")

    # Relations
    source_doc_id: Optional[uuid.UUID] = Field(None, description="生成元ドキュメントID")

class TaskUpdate(TaskCreate):
    """タスク全体更新用（全フィールド更新）"""
    project_id: Optional[uuid.UUID] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)

class TaskPatch(BaseModel):
    """タスク部分更新用（任意フィールドのみ更新）"""
    # Basic fields
    project_id: Optional[uuid.UUID] = None
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    detail: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None

    # Timeline fields
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    due_at: Optional[datetime] = None

    # Task ordering fields
    topological_order: Optional[int] = None
    execution_phase: Optional[str] = None
    parallel_group_id: Optional[str] = None
    critical_path: Optional[bool] = None

    # Management fields
    category: Optional[str] = None
    estimated_hours: Optional[int] = Field(None, ge=0)
    complexity_level: Optional[int] = Field(None, ge=1, le=5)
    business_value_score: Optional[int] = Field(None, ge=1, le=10)
    technical_risk_score: Optional[int] = Field(None, ge=1, le=10)
    implementation_difficulty: Optional[int] = Field(None, ge=1, le=10)
    user_impact_score: Optional[int] = Field(None, ge=1, le=10)
    dependency_weight: Optional[int] = Field(None, ge=1, le=10)
    moscow_priority: Optional[str] = None
    mvp_critical: Optional[bool] = None

    # Progress fields
    progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    blocking_reason: Optional[str] = None
    completion_criteria: Optional[str] = None

    # Educational fields
    learning_resources: Optional[List[str]] = None
    technology_stack: Optional[List[Dict[str, Any]]] = None
    reference_links: Optional[List[str]] = None

    # Relations
    source_doc_id: Optional[uuid.UUID] = None

class TaskResponse(BaseModel):
    """タスクレスポンス用"""
    task_id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: Optional[str]
    detail: Optional[str]
    status: str
    priority: str

    # Timeline fields
    planned_start_date: Optional[datetime]
    planned_end_date: Optional[datetime]
    actual_start_date: Optional[datetime]
    actual_end_date: Optional[datetime]
    due_at: Optional[datetime]

    # Task ordering fields
    topological_order: Optional[int]
    execution_phase: Optional[str]
    parallel_group_id: Optional[str]
    critical_path: bool

    # Management fields
    category: Optional[str]
    estimated_hours: Optional[int]
    complexity_level: Optional[int]
    business_value_score: Optional[int]
    technical_risk_score: Optional[int]
    implementation_difficulty: Optional[int]
    user_impact_score: Optional[int]
    dependency_weight: Optional[int]
    moscow_priority: Optional[str]
    mvp_critical: bool

    # Progress fields
    progress_percentage: int
    blocking_reason: Optional[str]
    completion_criteria: Optional[str]

    # Educational fields
    learning_resources: Optional[List[str]]
    technology_stack: Optional[List[Dict[str, Any]]]
    reference_links: Optional[List[str]]

    # Metadata
    created_at: datetime
    updated_at: datetime
    source_doc_id: Optional[uuid.UUID]

    class Config:
        from_attributes = True

class TaskListResponse(BaseModel):
    """タスク一覧レスポンス用"""
    tasks: List[TaskResponse]
    total_count: int
    filtered_count: int


@router.post("/task", response_model=TaskResponse, summary="タスク作成", description="新しいタスクを作成")
async def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """
    新しいタスクを作成

    拡張Taskモデルの全フィールドに対応した包括的なタスク作成
    """
    try:
        # Enum値の変換
        status_value = TaskStatusEnum(task.status) if task.status else TaskStatusEnum.TODO
        priority_value = PriorityEnum(task.priority) if task.priority else PriorityEnum.MEDIUM

        db_task = Task(
            task_id=uuid.uuid4(),
            project_id=task.project_id,
            title=task.title,
            description=task.description,
            detail=task.detail,
            status=status_value,
            priority=priority_value,

            # Timeline fields
            planned_start_date=task.planned_start_date,
            planned_end_date=task.planned_end_date,
            actual_start_date=task.actual_start_date,
            actual_end_date=task.actual_end_date,
            due_at=task.due_at,

            # Task ordering fields
            topological_order=task.topological_order,
            execution_phase=task.execution_phase,
            parallel_group_id=task.parallel_group_id,
            critical_path=task.critical_path,

            # Management fields
            category=task.category,
            estimated_hours=task.estimated_hours,
            complexity_level=task.complexity_level,
            business_value_score=task.business_value_score,
            technical_risk_score=task.technical_risk_score,
            implementation_difficulty=task.implementation_difficulty,
            user_impact_score=task.user_impact_score,
            dependency_weight=task.dependency_weight,
            moscow_priority=task.moscow_priority,
            mvp_critical=task.mvp_critical,

            # Progress fields
            progress_percentage=task.progress_percentage,
            blocking_reason=task.blocking_reason,
            completion_criteria=task.completion_criteria,

            # Educational fields
            learning_resources=task.learning_resources,
            technology_stack=task.technology_stack,
            reference_links=task.reference_links,

            # Relations
            source_doc_id=task.source_doc_id
        )

        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        return db_task

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid enum value: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating task: {str(e)}")

@router.get("/task/{task_id}", response_model=TaskResponse, summary="タスク取得", description="IDでタスクを取得")
async def get_task(task_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    指定されたIDのタスクを取得

    - **task_id**: タスクID
    """
    db_task = db.query(Task).filter(Task.task_id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task

@router.get("/task/project/{project_id}", response_model=TaskListResponse, summary="プロジェクトタスク一覧取得", description="プロジェクトの全タスクを取得")
async def get_tasks_by_project_id(
    project_id: uuid.UUID,
    # フィルタリングオプション
    category: Optional[str] = Query(None, description="カテゴリでフィルタ"),
    status: Optional[str] = Query(None, description="ステータスでフィルタ"),
    priority: Optional[str] = Query(None, description="優先度でフィルタ"),
    moscow_priority: Optional[str] = Query(None, description="MoSCoW優先度でフィルタ"),
    mvp_critical: Optional[bool] = Query(None, description="MVP必須タスクのみ"),
    execution_phase: Optional[str] = Query(None, description="実行フェーズでフィルタ"),
    critical_path: Optional[bool] = Query(None, description="クリティカルパス上のタスクのみ"),
    # ソート・ページング
    sort_by: Optional[str] = Query("topological_order", description="ソート基準"),
    sort_desc: bool = Query(False, description="降順ソート"),
    skip: int = Query(0, ge=0, description="スキップ数"),
    limit: int = Query(100, ge=1, le=1000, description="取得上限"),
    db: Session = Depends(get_db)
):
    """
    プロジェクトの全タスクを取得（フィルタリング・ソート・ページング対応）

    - **project_id**: プロジェクトID
    - **category**: カテゴリフィルタ（frontend/backend/database/devops/testing/documentation）
    - **status**: ステータスフィルタ（TODO/DOING/DONE）
    - **priority**: 優先度フィルタ（LOW/MEDIUM/HIGH/CRITICAL）
    - **moscow_priority**: MoSCoW優先度フィルタ（Must/Should/Could/Won't）
    - **mvp_critical**: MVP必須フラグ
    - **execution_phase**: 実行フェーズ（setup/development/testing/deployment）
    - **critical_path**: クリティカルパス上のタスク
    - **sort_by**: ソート基準（デフォルト: topological_order）
    - **sort_desc**: 降順ソート
    """
    # ベースクエリ
    query = db.query(Task).filter(Task.project_id == project_id)

    # フィルタリング
    if category:
        query = query.filter(Task.category == category)
    if status:
        try:
            status_enum = TaskStatusEnum(status)
            query = query.filter(Task.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    if priority:
        try:
            priority_enum = PriorityEnum(priority)
            query = query.filter(Task.priority == priority_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {priority}")
    if moscow_priority:
        query = query.filter(Task.moscow_priority == moscow_priority)
    if mvp_critical is not None:
        query = query.filter(Task.mvp_critical == mvp_critical)
    if execution_phase:
        query = query.filter(Task.execution_phase == execution_phase)
    if critical_path is not None:
        query = query.filter(Task.critical_path == critical_path)

    # 全体数とフィルタ後数
    total_count = db.query(Task).filter(Task.project_id == project_id).count()
    filtered_count = query.count()

    # ソート
    sort_column = getattr(Task, sort_by, Task.topological_order)
    if sort_desc:
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column)

    # ページング
    tasks = query.offset(skip).limit(limit).all()

    return TaskListResponse(
        tasks=tasks,
        total_count=total_count,
        filtered_count=filtered_count
    )

@router.put("/task/{task_id}", response_model=TaskResponse, summary="タスク全体更新", description="タスクの全フィールドを更新")
async def update_task(task_id: uuid.UUID, task: TaskUpdate, db: Session = Depends(get_db)):
    """
    タスクの全体更新

    指定されたタスクのすべてのフィールドを更新します。
    """
    try:
        db_task = db.query(Task).filter(Task.task_id == task_id).first()
        if db_task is None:
            raise HTTPException(status_code=404, detail="Task not found")

        # 基本フィールド
        if task.project_id is not None:
            db_task.project_id = task.project_id
        if task.title is not None:
            db_task.title = task.title
        if task.description is not None:
            db_task.description = task.description
        if task.detail is not None:
            db_task.detail = task.detail
        if task.status is not None:
            db_task.status = TaskStatusEnum(task.status)
        if task.priority is not None:
            db_task.priority = PriorityEnum(task.priority)

        # Timeline fields
        if task.planned_start_date is not None:
            db_task.planned_start_date = task.planned_start_date
        if task.planned_end_date is not None:
            db_task.planned_end_date = task.planned_end_date
        if task.actual_start_date is not None:
            db_task.actual_start_date = task.actual_start_date
        if task.actual_end_date is not None:
            db_task.actual_end_date = task.actual_end_date
        if task.due_at is not None:
            db_task.due_at = task.due_at

        # Task ordering fields
        if task.topological_order is not None:
            db_task.topological_order = task.topological_order
        if task.execution_phase is not None:
            db_task.execution_phase = task.execution_phase
        if task.parallel_group_id is not None:
            db_task.parallel_group_id = task.parallel_group_id
        if task.critical_path is not None:
            db_task.critical_path = task.critical_path

        # Management fields
        if task.category is not None:
            db_task.category = task.category
        if task.estimated_hours is not None:
            db_task.estimated_hours = task.estimated_hours
        if task.complexity_level is not None:
            db_task.complexity_level = task.complexity_level
        if task.business_value_score is not None:
            db_task.business_value_score = task.business_value_score
        if task.technical_risk_score is not None:
            db_task.technical_risk_score = task.technical_risk_score
        if task.implementation_difficulty is not None:
            db_task.implementation_difficulty = task.implementation_difficulty
        if task.user_impact_score is not None:
            db_task.user_impact_score = task.user_impact_score
        if task.dependency_weight is not None:
            db_task.dependency_weight = task.dependency_weight
        if task.moscow_priority is not None:
            db_task.moscow_priority = task.moscow_priority
        if task.mvp_critical is not None:
            db_task.mvp_critical = task.mvp_critical

        # Progress fields
        if task.progress_percentage is not None:
            db_task.progress_percentage = task.progress_percentage
        if task.blocking_reason is not None:
            db_task.blocking_reason = task.blocking_reason
        if task.completion_criteria is not None:
            db_task.completion_criteria = task.completion_criteria

        # Educational fields
        if task.learning_resources is not None:
            db_task.learning_resources = task.learning_resources
        if task.technology_stack is not None:
            db_task.technology_stack = task.technology_stack
        if task.reference_links is not None:
            db_task.reference_links = task.reference_links

        # Relations
        if task.source_doc_id is not None:
            db_task.source_doc_id = task.source_doc_id

        db.commit()
        db.refresh(db_task)
        return db_task

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid enum value: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating task: {str(e)}")

@router.delete("/task/{task_id}", summary="タスク削除", description="指定されたタスクを削除")
async def delete_task(task_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    指定されたIDのタスクを削除

    - **task_id**: 削除するタスクのID

    **注意**: 削除したタスクは復元できません。
    依存関係があるタスクの削除には注意してください。
    """
    try:
        db_task = db.query(Task).filter(Task.task_id == task_id).first()
        if db_task is None:
            raise HTTPException(status_code=404, detail="Task not found")

        # 依存関係チェック（このタスクに依存する他のタスクがあるかチェック）
        dependent_tasks = db.query(TaskDependency).filter(
            TaskDependency.prerequisite_task_id == task_id
        ).count()

        if dependent_tasks > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete task: {dependent_tasks} other tasks depend on this task"
            )

        # このタスクの依存関係も削除
        db.query(TaskDependency).filter(
            TaskDependency.dependent_task_id == task_id
        ).delete()

        db.delete(db_task)
        db.commit()

        return {
            "task_id": task_id,
            "message": "タスクが正常に削除されました",
            "deleted_at": datetime.now(timezone.utc)
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting task: {str(e)}")

@router.get("/tasks", response_model=List[TaskResponse], summary="全タスク取得", description="システム内の全タスクを取得")
async def list_all_tasks(
    skip: int = Query(0, ge=0, description="スキップ数"),
    limit: int = Query(100, ge=1, le=1000, description="取得上限"),
    db: Session = Depends(get_db)
):
    """
    システム内の全タスクを取得（ページング対応）

    - **skip**: スキップ数
    - **limit**: 取得上限
    """
    tasks = db.query(Task).offset(skip).limit(limit).all()
    return tasks

# ========== 拡張機能エンドポイント ==========

class TaskDependencyResponse(BaseModel):
    """タスク依存関係レスポンス"""
    dependency_id: uuid.UUID
    project_id: uuid.UUID
    prerequisite_task_id: uuid.UUID
    dependent_task_id: uuid.UUID
    dependency_type: str
    lag_time_hours: int
    dependency_strength: int
    is_critical: bool
    notes: Optional[str]
    ai_confidence: Optional[float]
    auto_detected: bool
    violation_risk: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TaskStatistics(BaseModel):
    """プロジェクトタスク統計"""
    total_tasks: int
    tasks_by_status: Dict[str, int]
    tasks_by_priority: Dict[str, int]
    tasks_by_category: Dict[str, int]
    tasks_by_moscow: Dict[str, int]
    mvp_critical_count: int
    critical_path_count: int
    average_complexity: Optional[float]
    average_business_value: Optional[float]
    total_estimated_hours: Optional[int]
    completion_percentage: float

class TaskTimelineResponse(BaseModel):
    """タスクタイムライン情報"""
    task_id: uuid.UUID
    title: str
    topological_order: Optional[int]
    execution_phase: Optional[str]
    parallel_group_id: Optional[str]
    critical_path: bool
    planned_start_date: Optional[datetime]
    planned_end_date: Optional[datetime]
    estimated_hours: Optional[int]
    dependencies: List[uuid.UUID]

@router.get("/task/{task_id}/dependencies", response_model=List[TaskDependencyResponse],
           summary="タスク依存関係取得", description="指定タスクの依存関係を取得")
async def get_task_dependencies(
    task_id: uuid.UUID,
    dependency_type: Optional[str] = Query(None, description="依存関係タイプでフィルタ"),
    db: Session = Depends(get_db)
):
    """
    指定されたタスクの依存関係を取得

    - **task_id**: タスクID
    - **dependency_type**: 依存関係タイプ（FINISH_TO_START/START_TO_START/FINISH_TO_FINISH/START_TO_FINISH）
    """
    # このタスクが依存する先行タスク（prerequisite）
    query = db.query(TaskDependency).filter(
        TaskDependency.dependent_task_id == task_id
    )

    if dependency_type:
        query = query.filter(TaskDependency.dependency_type == dependency_type)

    dependencies = query.all()
    return dependencies

@router.get("/task/{task_id}/dependents", response_model=List[TaskDependencyResponse],
           summary="依存タスク取得", description="指定タスクに依存するタスクを取得")
async def get_task_dependents(
    task_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    指定されたタスクに依存する後続タスクを取得

    - **task_id**: タスクID
    """
    dependents = db.query(TaskDependency).filter(
        TaskDependency.prerequisite_task_id == task_id
    ).all()

    return dependents

@router.get("/project/{project_id}/tasks/statistics", response_model=TaskStatistics,
           summary="プロジェクトタスク統計", description="プロジェクトのタスク統計情報を取得")
async def get_project_task_statistics(
    project_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのタスク統計情報を取得

    - **project_id**: プロジェクトID
    """
    tasks = db.query(Task).filter(Task.project_id == project_id).all()

    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks found for this project")

    # 統計計算
    total_tasks = len(tasks)

    # ステータス別集計
    tasks_by_status = {}
    for status in TaskStatusEnum:
        tasks_by_status[status.value] = len([t for t in tasks if t.status == status])

    # 優先度別集計
    tasks_by_priority = {}
    for priority in PriorityEnum:
        tasks_by_priority[priority.value] = len([t for t in tasks if t.priority == priority])

    # カテゴリ別集計
    categories = set(t.category for t in tasks if t.category)
    tasks_by_category = {cat: len([t for t in tasks if t.category == cat]) for cat in categories}

    # MoSCoW別集計
    moscow_priorities = set(t.moscow_priority for t in tasks if t.moscow_priority)
    tasks_by_moscow = {mp: len([t for t in tasks if t.moscow_priority == mp]) for mp in moscow_priorities}

    # その他統計
    mvp_critical_count = len([t for t in tasks if t.mvp_critical])
    critical_path_count = len([t for t in tasks if t.critical_path])

    # 平均値計算
    complexity_values = [t.complexity_level for t in tasks if t.complexity_level is not None]
    average_complexity = sum(complexity_values) / len(complexity_values) if complexity_values else None

    business_value_values = [t.business_value_score for t in tasks if t.business_value_score is not None]
    average_business_value = sum(business_value_values) / len(business_value_values) if business_value_values else None

    estimated_hours_values = [t.estimated_hours for t in tasks if t.estimated_hours is not None]
    total_estimated_hours = sum(estimated_hours_values) if estimated_hours_values else None

    # 完了率計算
    progress_values = [t.progress_percentage for t in tasks]
    completion_percentage = sum(progress_values) / len(progress_values) if progress_values else 0.0

    return TaskStatistics(
        total_tasks=total_tasks,
        tasks_by_status=tasks_by_status,
        tasks_by_priority=tasks_by_priority,
        tasks_by_category=tasks_by_category,
        tasks_by_moscow=tasks_by_moscow,
        mvp_critical_count=mvp_critical_count,
        critical_path_count=critical_path_count,
        average_complexity=average_complexity,
        average_business_value=average_business_value,
        total_estimated_hours=total_estimated_hours,
        completion_percentage=completion_percentage
    )

@router.get("/project/{project_id}/tasks/timeline", response_model=List[TaskTimelineResponse],
           summary="プロジェクトタイムライン", description="プロジェクトのタスクタイムライン情報を取得")
async def get_project_timeline(
    project_id: uuid.UUID,
    execution_phase: Optional[str] = Query(None, description="実行フェーズでフィルタ"),
    critical_path_only: bool = Query(False, description="クリティカルパスのみ"),
    db: Session = Depends(get_db)
):
    """
    プロジェクトのタスクタイムライン情報を取得

    - **project_id**: プロジェクトID
    - **execution_phase**: 実行フェーズフィルタ
    - **critical_path_only**: クリティカルパスのみ表示
    """
    query = db.query(Task).filter(Task.project_id == project_id)

    if execution_phase:
        query = query.filter(Task.execution_phase == execution_phase)

    if critical_path_only:
        query = query.filter(Task.critical_path == True)

    tasks = query.order_by(Task.topological_order.asc().nulls_last()).all()

    # タイムライン情報を構築
    timeline_tasks = []
    for task in tasks:
        # このタスクの依存関係を取得
        dependencies = db.query(TaskDependency.prerequisite_task_id).filter(
            TaskDependency.dependent_task_id == task.task_id
        ).all()
        dependency_ids = [dep[0] for dep in dependencies]

        timeline_tasks.append(TaskTimelineResponse(
            task_id=task.task_id,
            title=task.title,
            topological_order=task.topological_order,
            execution_phase=task.execution_phase,
            parallel_group_id=task.parallel_group_id,
            critical_path=task.critical_path,
            planned_start_date=task.planned_start_date,
            planned_end_date=task.planned_end_date,
            estimated_hours=task.estimated_hours,
            dependencies=dependency_ids
        ))

    return timeline_tasks

@router.get("/project/{project_id}/tasks/critical-path", response_model=List[TaskResponse],
           summary="クリティカルパス取得", description="プロジェクトのクリティカルパス上のタスクを取得")
async def get_critical_path_tasks(
    project_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのクリティカルパス上のタスクを取得

    - **project_id**: プロジェクトID
    """
    critical_tasks = db.query(Task).filter(
        Task.project_id == project_id,
        Task.critical_path == True
    ).order_by(Task.topological_order.asc().nulls_last()).all()

    if not critical_tasks:
        raise HTTPException(status_code=404, detail="No critical path tasks found for this project")

    return critical_tasks

@router.get("/project/{project_id}/tasks/mvp", response_model=List[TaskResponse],
           summary="MVP必須タスク取得", description="プロジェクトのMVP必須タスクを取得")
async def get_mvp_critical_tasks(
    project_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのMVP必須タスクを取得

    - **project_id**: プロジェクトID
    """
    mvp_tasks = db.query(Task).filter(
        Task.project_id == project_id,
        Task.mvp_critical == True
    ).order_by(Task.topological_order.asc().nulls_last()).all()

    if not mvp_tasks:
        raise HTTPException(status_code=404, detail="No MVP critical tasks found for this project")

    return mvp_tasks

@router.get("/task/{task_id}/educational", summary="タスク教育情報取得", description="タスクの教育的リソース情報を取得")
async def get_task_educational_resources(
    task_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    タスクの教育的リソース情報を取得

    - **task_id**: タスクID
    """
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    educational_info = {
        "task_id": task.task_id,
        "title": task.title,
        "learning_resources": task.learning_resources or [],
        "technology_stack": task.technology_stack or [],
        "reference_links": task.reference_links or [],
        "completion_criteria": task.completion_criteria,
        "complexity_level": task.complexity_level,
        "implementation_difficulty": task.implementation_difficulty,
        "estimated_hours": task.estimated_hours
    }

    return educational_info

@router.patch("/task/{task_id}", response_model=TaskResponse, summary="タスク部分更新", description="指定されたフィールドのみ更新")
async def patch_task(task_id: uuid.UUID, task: TaskPatch, db: Session = Depends(get_db)):
    """
    タスクの部分更新

    指定されたフィールドのみを更新します。未設定のフィールドは現在の値を保持します。

    - **task_id**: 更新するタスクのID
    - 各フィールド: 更新したいフィールドのみ指定
    """
    try:
        db_task = db.query(Task).filter(Task.task_id == task_id).first()
        if db_task is None:
            raise HTTPException(status_code=404, detail="Task not found")

        # 更新データを取得（設定されたフィールドのみ）
        update_data = task.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        # フィールドごとの更新処理
        for key, value in update_data.items():
            if key == "status" and value is not None:
                try:
                    db_task.status = TaskStatusEnum(value)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid status: {value}")
            elif key == "priority" and value is not None:
                try:
                    db_task.priority = PriorityEnum(value)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid priority: {value}")
            else:
                setattr(db_task, key, value)

        # タイムスタンプを更新
        db_task.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(db_task)
        return db_task

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating task: {str(e)}")