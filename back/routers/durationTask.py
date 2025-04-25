from fastapi import APIRouter, responses, HTTPException
from pydantic import BaseModel
from typing import List
from services.durationTask_service import DurationTaskService
import json

router = APIRouter()

class DurationTaskRequest(BaseModel):
    duration: str
    task_info: List[str]

@router.post("/")
def generate_task_durations(request: DurationTaskRequest):
    """
    DBに保存されている形式のタスク情報 (task_info) と全体のプロジェクト期間 (duration) を入力として受け取り、
    各タスクの作業期間（開始日、終了日）を算出して返すAPI。

    DB保存形式の例:
    {
        "duration": 10,
        "task_info": [
            "{\"task_id\":0,\"task_name\":\"プロジェクト設計\",\"priority\":\"Must\",\"content\":\"アプリケーション全体の設計を行う。...\",\"detail\":\"...\"}",
            "{\"task_id\":1,\"task_name\":\"データモデル定義 (TODO)\",\"priority\":\"Must\",\"content\":\"backend/app/models/todo.py に Todo モデルを定義する。...\",\"detail\":\"...\"}",
            ...
        ]
    }

    出力例:
    {
      "durations": [
        {"task_id": 0, "start": 1, "end": 5},
        {"task_id": 1, "start": 2, "end": 4},
        {"task_id": 2, "start": 3, "end": 6},
        ...
      ]
    }
    """
    parsed_tasks = []
    for task_str in request.task_info:
        try:
            task_obj = json.loads(task_str)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail=f"無効なJSON文字列: {task_str}")

        # 必要なフィールドのみ抽出
        try:
            parsed_task = {
                "task_id": task_obj["task_id"],
                "task_name": task_obj["task_name"],
                "content": task_obj["content"]
            }
        except KeyError as e:
            raise HTTPException(status_code=400, detail=f"必要なキーが存在しません: {str(e)}")
        parsed_tasks.append(parsed_task)

    durations = DurationTaskService().generate_task_durations(request.duration, parsed_tasks)
    return responses.JSONResponse(content={"durations": durations}, media_type="application/json")
