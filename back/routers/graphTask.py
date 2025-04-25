from fastapi import APIRouter, responses, HTTPException
from pydantic import BaseModel
from typing import List
from services.graphTask_service import GraphTaskService
import json

router = APIRouter()

class GraphTaskRequest(BaseModel):
    task_info: List[str]

@router.post("/")
def generate_task_graph(request: GraphTaskRequest):
    """
    DBに保存されている形式のタスク情報 (task_info) を入力として受け取り、
    各文字列から task_id, task_name, content を抽出し、タスク間の依存関係を返すAPI。

    DB保存形式の例:
    {
        "task_info": [
            "{\"task_id\":0,\"task_name\":\"プロジェクト設計\",\"priority\":\"Must\",\"content\":\"アプリケーション全体の設計を行う。...\",\"detail\":\"...\"}",
            "{\"task_id\":1,\"task_name\":\"データモデル定義 (TODO)\",\"priority\":\"Must\",\"content\":\"backend/app/models/todo.py に Todo モデルを定義する。...\",\"detail\":\"...\"}",
            ...
        ]
    }

    出力例:
    {
      "edges": [
        {"parent": 5, "child": 3},
        {"parent": 5, "child": 4},
        {"parent": 4, "child": 1},
        {"parent": 1, "child": 2},
        {"parent": 3, "child": 6}
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
            raise HTTPException(status_code=400, detail=f"必要なキーが見つかりません: {str(e)}")
        parsed_tasks.append(parsed_task)

    edges = GraphTaskService().generate_task_graph(parsed_tasks)
    return responses.JSONResponse(content={"edges": edges}, media_type="application/json")
