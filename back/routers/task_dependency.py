"""
Task Dependency API Router
Provides endpoints for retrieving task dependencies
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from database import get_db
from models.project_base import TaskDependency, Task
import uuid


router = APIRouter()


class TaskDependencyResponse(BaseModel):
    """Task dependency response model"""
    id: str
    edge_id: str
    source_task_id: str
    target_task_id: str
    source_node_id: str
    target_node_id: str
    is_animated: bool
    is_next_day: bool

    class Config:
        from_attributes = True


@router.get("/project/{project_id}", response_model=List[TaskDependencyResponse])
async def get_task_dependencies_by_project(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    Get all task dependencies for a project

    This endpoint retrieves all task dependencies (edges) for tasks in a given project.
    Each dependency represents an edge in the ReactFlow graph.
    """
    try:
        # Validate project_id is a valid UUID
        try:
            uuid.UUID(project_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid project_id format")

        # Get all tasks for this project
        tasks = db.query(Task).filter_by(project_id=project_id).all()

        if not tasks:
            return []

        # Get all task IDs
        task_ids = [task.task_id for task in tasks]

        # Get all dependencies where both source and target are in this project
        dependencies = db.query(TaskDependency).filter(
            TaskDependency.source_task_id.in_(task_ids),
            TaskDependency.target_task_id.in_(task_ids)
        ).all()

        # Convert to response format
        return [
            TaskDependencyResponse(
                id=str(dep.id),
                edge_id=dep.edge_id,
                source_task_id=str(dep.source_task_id),
                target_task_id=str(dep.target_task_id),
                source_node_id=dep.source_node_id,
                target_node_id=dep.target_node_id,
                is_animated=dep.is_animated,
                is_next_day=dep.is_next_day
            )
            for dep in dependencies
        ]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving task dependencies: {str(e)}"
        )


@router.get("/{task_id}", response_model=List[TaskDependencyResponse])
async def get_task_dependencies(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    Get all dependencies for a specific task

    Returns both incoming and outgoing dependencies for the given task.
    """
    try:
        # Validate task_id is a valid UUID
        try:
            uuid.UUID(task_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid task_id format")

        # Get all dependencies involving this task
        dependencies = db.query(TaskDependency).filter(
            (TaskDependency.source_task_id == task_id) |
            (TaskDependency.target_task_id == task_id)
        ).all()

        # Convert to response format
        return [
            TaskDependencyResponse(
                id=str(dep.id),
                edge_id=dep.edge_id,
                source_task_id=str(dep.source_task_id),
                target_task_id=str(dep.target_task_id),
                source_node_id=dep.source_node_id,
                target_node_id=dep.target_node_id,
                is_animated=dep.is_animated,
                is_next_day=dep.is_next_day
            )
            for dep in dependencies
        ]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving task dependencies: {str(e)}"
        )
