from fastapi import APIRouter, responses, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.task_service import TaskService

router = APIRouter()

class TasksRequest(BaseModel):
    specification: str
    directory: str | None = None
    framework: str | None = None
    project_id: str | None = None


@router.post("/")
async def generate_tasks(request: TasksRequest, db: Session = Depends(get_db)):
    """技術要件定義書をReactFlowグラフに変換するAPI。"""

    service = TaskService(db=db)
    try:
        graph = await service.generate_reactflow_graph(
            project_id=request.project_id,
            requirement=request.specification,
            directory=request.directory,
            framework=request.framework,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return responses.JSONResponse(
        content=graph.model_dump(by_alias=True),
        media_type="application/json",
    )
