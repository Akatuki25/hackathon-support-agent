from fastapi import APIRouter, responses, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
from database import get_db
from services.durationTask_service import DurationTaskService
import json

router = APIRouter()

class DurationTaskRequest(BaseModel):
    duration: str
    task_info: List[str]

@router.post("/")
def generate_task_durations(request: DurationTaskRequest, db: Session = Depends(get_db)):
    """
    DBに保存されている形式のタスク情報 (task_info) と全体のプロジェクト期間 (duration) を入力として受け取り、
    各タスクの作業期間（開始日、終了日）を算出して返すAPI。
    """
    parsed_tasks = []
    for task_str in request.task_info:
        try:
            task_obj = json.loads(task_str)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail=f"無効なJSON文字列: {task_str}")

        try:
            parsed_task = {
                "task_id": task_obj["task_id"],
                "task_name": task_obj["task_name"],
                "content": task_obj["content"]
            }
        except KeyError as e:
            raise HTTPException(status_code=400, detail=f"必要なキーが存在しません: {str(e)}")
        parsed_tasks.append(parsed_task)

    service = DurationTaskService(db=db)
    durations = service.generate_task_durations(request.duration, parsed_tasks)
    return responses.JSONResponse(content={"durations": durations}, media_type="application/json")