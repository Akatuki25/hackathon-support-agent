from fastapi import APIRouter, responses, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
from database import get_db
from services.taskDetail_service import TaskDetailService, TaskItem

router = APIRouter()

# リクエスト用モデル
class TaskDetailRequest(BaseModel):
    tasks: List[TaskItem]
    specification: str

@router.post("/")
async def generate_task_details(request: TaskDetailRequest, db: Session = Depends(get_db)):
    """
    各タスクを並列に LLM 呼び出しして detail を生成。
    """
    service = TaskDetailService(db=db)
    # Pydantic モデルを dict 変換
    task_dicts = [t.model_dump() for t in request.tasks]
    specification = request.specification

    try:
        # スレッド数はマシン性能とレート制限に合わせて調整
        detailed = await run_in_threadpool(service.generate_task_details_parallel, task_dicts, specification, 3, 5)
        return responses.JSONResponse(content={"tasks": detailed})
    except Exception as e:
        # router レベルでも念のためキャッチ
        raise HTTPException(status_code=500, detail=f"タスク詳細生成中にエラーが発生しました: {e}")