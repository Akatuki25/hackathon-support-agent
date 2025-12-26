from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from database import get_db
from models.project_base import TaskAssignment

router = APIRouter()

class TaskAssignmentType(BaseModel):
    task_id: uuid.UUID
    project_member_id: uuid.UUID
    role: Optional[str] = None

class TaskAssignmentPatch(BaseModel):
    task_id: Optional[uuid.UUID] = None
    project_member_id: Optional[uuid.UUID] = None
    role: Optional[str] = None

@router.post("/task_assignment", summary="タスク割り当て作成")
async def create_task_assignment(task_assignment: TaskAssignmentType, db: Session = Depends(get_db)):
    db_task_assignment = TaskAssignment(
        task_assignment_id=uuid.uuid4(),
        task_id=task_assignment.task_id,
        project_member_id=task_assignment.project_member_id,
        role=task_assignment.role
    )
    db.add(db_task_assignment)
    db.commit()
    db.refresh(db_task_assignment)
    return {"task_assignment_id": db_task_assignment.task_assignment_id, "message": "タスク割り当てが作成されました"}

@router.get("/task_assignment/{task_assignment_id}", summary="タスク割り当て取得")
async def get_task_assignment(task_assignment_id: uuid.UUID, db: Session = Depends(get_db)):
    db_task_assignment = db.query(TaskAssignment).filter(TaskAssignment.task_assignment_id == task_assignment_id).first()
    if db_task_assignment is None:
        raise HTTPException(status_code=404, detail="Task assignment not found")
    return db_task_assignment

@router.get("/task_assignment/task/{task_id}", summary="タスクIDからタスク割り当て取得")
async def get_task_assignments_by_task_id(task_id: uuid.UUID, db: Session = Depends(get_db)):
    db_task_assignments = db.query(TaskAssignment).filter(TaskAssignment.task_id == task_id).all()
    # 割り当てがない場合は空リストを返す（404ではなく）
    return db_task_assignments

@router.get("/task_assignment/project_member/{project_member_id}", summary="プロジェクトメンバーIDからタスク割り当て取得")
async def get_task_assignments_by_project_member_id(project_member_id: uuid.UUID, db: Session = Depends(get_db)):
    db_task_assignments = db.query(TaskAssignment).filter(TaskAssignment.project_member_id == project_member_id).all()
    # 割り当てがない場合は空リストを返す（404ではなく）
    return db_task_assignments

@router.put("/task_assignment/{task_assignment_id}", summary="タスク割り当て更新")
async def update_task_assignment(task_assignment_id: uuid.UUID, task_assignment: TaskAssignmentType, db: Session = Depends(get_db)):
    db_task_assignment = db.query(TaskAssignment).filter(TaskAssignment.task_assignment_id == task_assignment_id).first()
    if db_task_assignment is None:
        raise HTTPException(status_code=404, detail="Task assignment not found")
    
    db_task_assignment.task_id = task_assignment.task_id
    db_task_assignment.project_member_id = task_assignment.project_member_id
    db_task_assignment.role = task_assignment.role
    db.commit()
    db.refresh(db_task_assignment)
    return {"task_assignment_id": task_assignment_id, "message": "タスク割り当てが更新されました"}

@router.delete("/task_assignment/{task_assignment_id}", summary="タスク割り当て削除")
async def delete_task_assignment(task_assignment_id: uuid.UUID, db: Session = Depends(get_db)):
    db_task_assignment = db.query(TaskAssignment).filter(TaskAssignment.task_assignment_id == task_assignment_id).first()
    if db_task_assignment is None:
        raise HTTPException(status_code=404, detail="Task assignment not found")
    
    db.delete(db_task_assignment)
    db.commit()
    return {"task_assignment_id": task_assignment_id, "message": "タスク割り当てが削除されました"}

@router.get("/task_assignments", summary="全タスク割り当て取得")
async def list_task_assignments(db: Session = Depends(get_db)):
    task_assignments = db.query(TaskAssignment).all()
    return task_assignments

@router.patch("/task_assignment/{task_assignment_id}", summary="タスク割り当て部分更新")
async def patch_task_assignment(task_assignment_id: uuid.UUID, task_assignment: TaskAssignmentPatch, db: Session = Depends(get_db)):
    db_task_assignment = db.query(TaskAssignment).filter(TaskAssignment.task_assignment_id == task_assignment_id).first()
    if db_task_assignment is None:
        raise HTTPException(status_code=404, detail="Task assignment not found")
    
    update_data = task_assignment.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task_assignment, key, value)
    
    db.commit()
    db.refresh(db_task_assignment)
    return {"message": "Task assignment partially updated successfully"}
