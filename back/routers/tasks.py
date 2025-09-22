from fastapi import APIRouter, responses, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.tasks_service import TasksService

router = APIRouter()

class TasksRequest(BaseModel):
    specification: str
    directory: str
    framework: str

@router.post("/")
def generate_tasks(request: TasksRequest, db: Session = Depends(get_db)):
    """
    仕様書、ディレクトリ構成、フレームワーク情報（全てstring）を受け取り、
    アプリ制作に必要な全タスクを、タスク名、優先度（Must, Should, Could）、
    具体的な内容を含むリストとして返すAPI。
    """
    service = TasksService(db=db)
    tasks = service.generate_tasks(request.specification, request.directory, request.framework)
    return responses.JSONResponse(content={"tasks": tasks}, media_type="application/json")