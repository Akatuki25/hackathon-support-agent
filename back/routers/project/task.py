from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from database import get_db
from models.project_base import Task, TaskStatusEnum, PriorityEnum

router = APIRouter()

class TaskType(BaseModel):
    project_id: uuid.UUID
    title: str
    description: Optional[str] = None
    detail: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_at: Optional[datetime] = None
    depends_on_task_id: Optional[uuid.UUID] = None
    source_doc_id: Optional[uuid.UUID] = None
    
    class Config:
        use_enum_values = True

    def __init__(self, **data):
        super().__init__(**data)
        if self.status is not None:
            self.status = TaskStatusEnum(self.status)
        if self.priority is not None:
            self.priority = PriorityEnum(self.priority)

class TaskPatch(BaseModel):
    project_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    detail: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_at: Optional[datetime] = None
    depends_on_task_id: Optional[uuid.UUID] = None
    source_doc_id: Optional[uuid.UUID] = None

    class Config:
        use_enum_values = True

    def __init__(self, **data):
        super().__init__(**data)
        if self.status is not None:
            self.status = TaskStatusEnum(self.status)
        if self.priority is not None:
            self.priority = PriorityEnum(self.priority)


@router.post("/task", summary="タスク作成")
async def create_task(task: TaskType, db: Session = Depends(get_db)):
    db_task = Task(
        task_id=uuid.uuid4(),
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        detail=task.detail,
        status=task.status if task.status is not None else TaskStatusEnum.TODO,
        priority=task.priority if task.priority is not None else PriorityEnum.MEDIUM,
        due_at=task.due_at,
        depends_on_task_id=task.depends_on_task_id,
        source_doc_id=task.source_doc_id
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return {"task_id": db_task.task_id, "message": "タスクが作成されました"}

@router.get("/task/{task_id}", summary="タスク取得")
async def get_task(task_id: uuid.UUID, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.task_id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task

@router.get("/task/project/{project_id}", summary="プロジェクトIDからタスク取得")
async def get_tasks_by_project_id(project_id: uuid.UUID, db: Session = Depends(get_db)):
    db_tasks = db.query(Task).filter(Task.project_id == project_id).all()
    if not db_tasks:
        raise HTTPException(status_code=404, detail="Tasks not found for this project")
    return db_tasks

@router.put("/task/{task_id}", summary="タスク更新")
async def update_task(task_id: uuid.UUID, task: TaskType, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.task_id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db_task.project_id = task.project_id
    db_task.title = task.title
    db_task.description = task.description
    db_task.detail = task.detail
    db_task.status = task.status
    db_task.priority = task.priority
    db_task.due_at = task.due_at
    db_task.depends_on_task_id = task.depends_on_task_id
    db_task.source_doc_id = task.source_doc_id
    db.commit()
    db.refresh(db_task)
    return {"task_id": task_id, "message": "タスクが更新されました"}

@router.delete("/task/{task_id}", summary="タスク削除")
async def delete_task(task_id: uuid.UUID, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.task_id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    return {"task_id": task_id, "message": "タスクが削除されました"}

@router.get("/tasks", summary="全タスク取得")
async def list_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Task).all()
    return tasks

@router.patch("/task/{task_id}", summary="タスク部分更新")
async def patch_task(task_id: uuid.UUID, task: TaskPatch, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.task_id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "status" and value is not None:
            db_task.status = TaskStatusEnum(value)
        elif key == "priority" and value is not None:
            db_task.priority = PriorityEnum(value)
        else:
            setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return {"message": "Task partially updated successfully"}