from fastapi import APIRouter, responses, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
from database import get_db
from services.graphTask_service import GraphTaskService
import json

router = APIRouter()

class GraphTaskRequest(BaseModel):
    task_info: List[str]

@router.post("/")
def generate_task_graph(request: GraphTaskRequest, db: Session = Depends(get_db)):
    """
    DBに保存されている形式のタスク情報 (task_info) を入力として受け取り、
    各文字列から task_id, task_name, content を抽出し、タスク間の依存関係を返すAPI。
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
            raise HTTPException(status_code=400, detail=f"必要なキーが見つかりません: {str(e)}")
        parsed_tasks.append(parsed_task)

    service = GraphTaskService(db=db)
    edges = service.generate_task_graph(parsed_tasks)
    return responses.JSONResponse(content={"edges": edges}, media_type="application/json")