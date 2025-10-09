from enum import Enum
from typing import List, Optional
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models.project_base import ProjectBase, Task

router = APIRouter()


class TaskStatus(str, Enum):
    TODO = "TODO"
    DOING = "DOING"
    DONE = "DONE"


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, description="タスクのタイトル")
    description: Optional[str] = Field(None, description="タスクの詳細な説明")
    detail: Optional[str] = Field(None, description="追加の詳細情報")
    priority: Optional[str] = Field(None, description="優先度 (例: Must, Should, Could)")
    due_at: Optional[datetime] = Field(None, description="タスクの期日")
    node_id: Optional[str] = Field(None, max_length=20, description="React Flow ノードID")
    category: Optional[str] = Field(None, max_length=50, description="カテゴリ名")
    start_time: Optional[str] = Field(None, max_length=10, description="開始時刻 (例: 09:00)")
    estimated_hours: Optional[float] = Field(None, ge=0, description="推定工数")
    assignee: Optional[str] = Field(None, max_length=50, description="担当者")
    position_x: Optional[int] = Field(None, description="キャンバスX座標")
    position_y: Optional[int] = Field(None, description="キャンバスY座標")
    depends_on_task_id: Optional[uuid.UUID] = Field(None, description="依存元タスクID")
    source_doc_id: Optional[uuid.UUID] = Field(None, description="参照ドキュメントID")
    function_id: Optional[uuid.UUID] = Field(None, description="関連機能ID")

    model_config = ConfigDict(use_enum_values=True)


class TaskCreate(TaskBase):
    project_id: uuid.UUID = Field(..., description="タスクが属するプロジェクトID")
    status: TaskStatus = Field(default=TaskStatus.TODO, description="タスクのステータス")
    completed: bool = Field(default=False, description="完了フラグ")


class TaskPut(BaseModel):
    title: str = Field(..., min_length=1, description="タスクのタイトル")
    project_id: uuid.UUID = Field(..., description="タスクが属するプロジェクトID")
    description: Optional[str] = Field(None, description="タスクの詳細な説明")
    detail: Optional[str] = Field(None, description="追加の詳細情報")
    priority: Optional[str] = Field(None, description="優先度")
    status: Optional[TaskStatus] = Field(None, description="タスクのステータス")
    due_at: Optional[datetime] = Field(None, description="タスクの期日")
    node_id: Optional[str] = Field(None, max_length=20, description="React Flow ノードID")
    category: Optional[str] = Field(None, max_length=50, description="カテゴリ名")
    start_time: Optional[str] = Field(None, max_length=10, description="開始時刻")
    estimated_hours: Optional[float] = Field(None, ge=0, description="推定工数")
    assignee: Optional[str] = Field(None, max_length=50, description="担当者")
    completed: Optional[bool] = Field(None, description="完了フラグ")
    position_x: Optional[int] = Field(None, description="キャンバスX座標")
    position_y: Optional[int] = Field(None, description="キャンバスY座標")
    depends_on_task_id: Optional[uuid.UUID] = Field(None, description="依存元タスクID")
    source_doc_id: Optional[uuid.UUID] = Field(None, description="参照ドキュメントID")
    function_id: Optional[uuid.UUID] = Field(None, description="関連機能ID")

    model_config = ConfigDict(use_enum_values=True)


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, description="タスクのタイトル")
    description: Optional[str] = Field(None, description="タスクの詳細な説明")
    detail: Optional[str] = Field(None, description="追加の詳細情報")
    priority: Optional[str] = Field(None, description="優先度")
    status: Optional[TaskStatus] = Field(None, description="タスクのステータス")
    due_at: Optional[datetime] = Field(None, description="タスクの期日")
    node_id: Optional[str] = Field(None, max_length=20, description="React Flow ノードID")
    category: Optional[str] = Field(None, max_length=50, description="カテゴリ名")
    start_time: Optional[str] = Field(None, max_length=10, description="開始時刻")
    estimated_hours: Optional[float] = Field(None, ge=0, description="推定工数")
    assignee: Optional[str] = Field(None, max_length=50, description="担当者")
    completed: Optional[bool] = Field(None, description="完了フラグ")
    position_x: Optional[int] = Field(None, description="キャンバスX座標")
    position_y: Optional[int] = Field(None, description="キャンバスY座標")
    depends_on_task_id: Optional[uuid.UUID] = Field(None, description="依存元タスクID")
    source_doc_id: Optional[uuid.UUID] = Field(None, description="参照ドキュメントID")
    function_id: Optional[uuid.UUID] = Field(None, description="関連機能ID")
    project_id: Optional[uuid.UUID] = Field(None, description="タスクが属するプロジェクトID")

    model_config = ConfigDict(use_enum_values=True)


class TaskActionResponse(BaseModel):
    task_id: uuid.UUID
    message: str


class TaskRead(TaskBase):
    task_id: uuid.UUID
    project_id: uuid.UUID
    status: TaskStatus
    completed: bool

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


def _ensure_project_exists(db: Session, project_id: uuid.UUID) -> None:
    exists = (
        db.query(ProjectBase.project_id)
        .filter(ProjectBase.project_id == project_id)
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail=f"Project with id {project_id} not found")


def _ensure_dependency_exists(db: Session, task_id: Optional[uuid.UUID]) -> None:
    if task_id is None:
        return
    exists = db.query(Task.task_id).filter(Task.task_id == task_id).first()
    if not exists:
        raise HTTPException(status_code=404, detail=f"Dependency task with id {task_id} not found")


def _get_task_or_404(db: Session, task_id: uuid.UUID) -> Task:
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/task", response_model=TaskActionResponse, status_code=status.HTTP_201_CREATED, summary="タスクの新規作成")
def create_task(task: TaskCreate, db: Session = Depends(get_db)) -> TaskActionResponse:
    _ensure_project_exists(db, task.project_id)
    if task.depends_on_task_id:
        _ensure_dependency_exists(db, task.depends_on_task_id)

    task_data = task.model_dump()
    db_task = Task(**task_data)

    try:
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create task due to data integrity error") from exc

    return TaskActionResponse(task_id=db_task.task_id, message="Task created successfully")


@router.get("/tasks", response_model=List[TaskRead], summary="全タスク取得")
def list_tasks(db: Session = Depends(get_db)) -> List[TaskRead]:
    tasks = db.query(Task).all()
    return tasks


@router.get("/task/{task_id}", response_model=TaskRead, summary="単一タスクの取得")
def get_task(task_id: uuid.UUID, db: Session = Depends(get_db)) -> TaskRead:
    task = _get_task_or_404(db, task_id)
    return task


@router.get("/task/project/{project_id}", response_model=List[TaskRead], summary="プロジェクトの全タスクを取得")
def get_tasks_for_project(project_id: uuid.UUID, db: Session = Depends(get_db)) -> List[TaskRead]:
    _ensure_project_exists(db, project_id)
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    return tasks


@router.put("/task/{task_id}", response_model=TaskActionResponse, summary="タスクの更新")
def replace_task(task_id: uuid.UUID, task_payload: TaskPut, db: Session = Depends(get_db)) -> TaskActionResponse:
    db_task = _get_task_or_404(db, task_id)
    _ensure_project_exists(db, task_payload.project_id)
    if task_payload.depends_on_task_id == task_id:
        raise HTTPException(status_code=400, detail="A task cannot depend on itself")
    _ensure_dependency_exists(db, task_payload.depends_on_task_id)

    update_data = task_payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)

    try:
        db.commit()
        db.refresh(db_task)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update task due to data integrity error") from exc

    return TaskActionResponse(task_id=db_task.task_id, message="Task updated successfully")


@router.patch("/task/{task_id}", response_model=TaskActionResponse, summary="タスクの部分更新")
def update_task(task_id: uuid.UUID, task_update: TaskUpdate, db: Session = Depends(get_db)) -> TaskActionResponse:
    db_task = _get_task_or_404(db, task_id)

    update_data = task_update.model_dump(exclude_unset=True)

    project_id = update_data.get("project_id")
    if project_id is not None:
        _ensure_project_exists(db, project_id)

    depends_on_task_id = update_data.get("depends_on_task_id")
    if depends_on_task_id == task_id:
        raise HTTPException(status_code=400, detail="A task cannot depend on itself")
    if depends_on_task_id is not None:
        _ensure_dependency_exists(db, depends_on_task_id)

    for key, value in update_data.items():
        setattr(db_task, key, value)

    try:
        db.commit()
        db.refresh(db_task)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update task due to data integrity error") from exc

    return TaskActionResponse(task_id=db_task.task_id, message="Task partially updated successfully")


@router.delete("/task/{task_id}", response_model=TaskActionResponse, summary="タスクの削除")
def delete_task(task_id: uuid.UUID, db: Session = Depends(get_db)) -> TaskActionResponse:
    db_task = _get_task_or_404(db, task_id)

    db.delete(db_task)
    db.commit()

    return TaskActionResponse(task_id=task_id, message="Task deleted successfully")
