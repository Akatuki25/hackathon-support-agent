"""
環境構築AIエージェント APIルーター
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from services.env_setup_agent_service import EnvSetupAgentService

router = APIRouter()


# --- Request/Response Models ---

class EnvSetupRequest(BaseModel):
    project_id: str


class EnvSetupResponse(BaseModel):
    env_id: str
    project_id: str
    front: Optional[str] = None
    backend: Optional[str] = None
    devcontainer: Optional[str] = None
    database: Optional[str] = None
    deploy: Optional[str] = None
    message: str


class EnvGetResponse(BaseModel):
    env_id: str
    project_id: str
    front: Optional[str] = None
    backend: Optional[str] = None
    devcontainer: Optional[str] = None
    database: Optional[str] = None
    deploy: Optional[str] = None
    created_at: Optional[str] = None


# --- Endpoints ---

@router.post("/generate", response_model=EnvSetupResponse, summary="環境構築情報をAIで生成")
async def generate_env_setup(
    request: EnvSetupRequest,
    db: Session = Depends(get_db)
):
    """
    プロジェクトIDを受け取り、frame_work_docから環境構築情報を
    AIで生成してEnvテーブルに保存する

    - **project_id**: プロジェクトのUUID

    Returns:
        生成された環境構築情報（front, backend, devcontainer, database, deploy）
    """
    service = EnvSetupAgentService(db=db)

    try:
        result = service.generate_and_save_env(request.project_id)
        return EnvSetupResponse(
            env_id=result["env_id"],
            project_id=result["project_id"],
            front=result["front"],
            backend=result["backend"],
            devcontainer=result["devcontainer"],
            database=result["database"],
            deploy=result["deploy"],
            message="環境構築情報を生成・保存しました"
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成に失敗しました: {str(e)}")


@router.post("/regenerate/{project_id}", response_model=EnvSetupResponse, summary="環境構築情報を再生成")
async def regenerate_env_setup(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    既存の環境構築情報を削除して再生成する

    - **project_id**: プロジェクトのUUID（パスパラメータ）
    """
    service = EnvSetupAgentService(db=db)

    try:
        result = service.generate_and_save_env(project_id, force_regenerate=True)
        return EnvSetupResponse(
            env_id=result["env_id"],
            project_id=result["project_id"],
            front=result["front"],
            backend=result["backend"],
            devcontainer=result["devcontainer"],
            database=result["database"],
            deploy=result["deploy"],
            message="環境構築情報を再生成しました"
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"再生成に失敗しました: {str(e)}")


@router.get("/{project_id}", response_model=EnvGetResponse, summary="環境構築情報を取得")
async def get_env_setup(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    プロジェクトIDから環境構築情報を取得する

    - **project_id**: プロジェクトのUUID（パスパラメータ）
    """
    service = EnvSetupAgentService(db=db)

    result = service.get_env_by_project(project_id)

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"環境構築情報が見つかりません: project_id={project_id}"
        )

    return EnvGetResponse(**result)
