"""
プロジェクトフェーズ管理API

プロジェクトの進行状態（フェーズ）を取得・更新するためのAPIエンドポイント
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.project_base import ProjectBase
from utils.phase_manager import PhaseManager
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

router = APIRouter(prefix="/api/project", tags=["project_phase"])


class PhaseUpdateRequest(BaseModel):
    """フェーズ更新リクエスト"""
    phase: str


class PhaseHistoryItem(BaseModel):
    """フェーズ履歴アイテム"""
    from_phase: str
    to_phase: str
    timestamp: str


class PhaseResponse(BaseModel):
    """フェーズ情報レスポンス"""
    project_id: str
    current_phase: str
    phase_updated_at: str
    phase_history: Optional[List[Dict]] = None


@router.get("/{project_id}/phase", response_model=PhaseResponse)
def get_project_phase(project_id: str, db: Session = Depends(get_db)):
    """
    プロジェクトの現在のフェーズを取得

    Args:
        project_id: プロジェクトID
        db: データベースセッション

    Returns:
        PhaseResponse: フェーズ情報

    Raises:
        HTTPException: プロジェクトが見つからない場合
    """
    project = db.query(ProjectBase).filter(
        ProjectBase.project_id == project_id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return PhaseResponse(
        project_id=str(project.project_id),
        current_phase=project.current_phase,
        phase_updated_at=project.phase_updated_at.isoformat(),
        phase_history=project.phase_history
    )


@router.patch("/{project_id}/phase", response_model=PhaseResponse)
def update_project_phase(
    project_id: str,
    request: PhaseUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    プロジェクトのフェーズを手動更新

    Args:
        project_id: プロジェクトID
        request: フェーズ更新リクエスト
        db: データベースセッション

    Returns:
        PhaseResponse: 更新後のフェーズ情報

    Raises:
        HTTPException: プロジェクトが見つからない、または無効なフェーズ名の場合
    """
    try:
        project = PhaseManager.update_phase(
            db=db,
            project_id=project_id,
            new_phase=request.phase,
            add_to_history=True
        )

        return PhaseResponse(
            project_id=str(project.project_id),
            current_phase=project.current_phase,
            phase_updated_at=project.phase_updated_at.isoformat(),
            phase_history=project.phase_history
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{project_id}/phase/history", response_model=List[Dict])
def get_project_phase_history(project_id: str, db: Session = Depends(get_db)):
    """
    プロジェクトのフェーズ遷移履歴を取得

    Args:
        project_id: プロジェクトID
        db: データベースセッション

    Returns:
        List[Dict]: フェーズ遷移履歴

    Raises:
        HTTPException: プロジェクトが見つからない場合
    """
    history = PhaseManager.get_phase_history(db=db, project_id=project_id)

    if history is None:
        raise HTTPException(status_code=404, detail="Project not found")

    return history


@router.get("/{project_id}/phase/next")
def get_next_phase(project_id: str, db: Session = Depends(get_db)):
    """
    プロジェクトの次のフェーズを取得

    Args:
        project_id: プロジェクトID
        db: データベースセッション

    Returns:
        dict: 次のフェーズ情報

    Raises:
        HTTPException: プロジェクトが見つからない場合
    """
    current_phase = PhaseManager.get_current_phase(db=db, project_id=project_id)

    if current_phase is None:
        raise HTTPException(status_code=404, detail="Project not found")

    next_phase = PhaseManager.get_next_phase(current_phase)

    return {
        "current_phase": current_phase,
        "next_phase": next_phase,
        "is_final": next_phase is None
    }
