"""
task_hands_on.py: タスクハンズオン管理 API

インタラクティブハンズオン移行後の簡略化版
- 一括生成機能は廃止（インタラクティブモードに統一）
- 個別取得・更新・削除のみをサポート
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict
from uuid import UUID

from database import get_db
from services.task_hands_on_service import TaskHandsOnService
from models.project_base import TaskHandsOn


router = APIRouter(prefix="/api/task_hands_on", tags=["TaskHandsOn"])


# =====================================================
# リクエスト/レスポンスモデル
# =====================================================

class TaskHandsOnResponse(BaseModel):
    """タスクハンズオン取得レスポンス"""
    success: bool
    task_id: str
    task_title: str
    has_hands_on: bool
    hands_on: Optional[Dict]
    metadata: Optional[Dict]
    message: Optional[str] = None


class DeleteHandsOnResponse(BaseModel):
    """ハンズオン削除レスポンス"""
    success: bool
    deleted_count: int
    message: str


class UpdateHandsOnRequest(BaseModel):
    """ハンズオン部分更新リクエスト"""
    field: str  # 更新対象フィールド名
    content: str  # 更新内容

    class Config:
        json_schema_extra = {
            "example": {
                "field": "implementation_steps",
                "content": "1. まず〇〇をインストール\n2. 次に..."
            }
        }


class UpdateHandsOnResponse(BaseModel):
    """ハンズオン更新レスポンス"""
    success: bool
    task_id: str
    updated_field: str
    message: str


# =====================================================
# エンドポイント
# =====================================================

@router.get("/{task_id}", response_model=TaskHandsOnResponse)
async def get_task_hands_on(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    個別タスクハンズオン取得
    """
    try:
        service = TaskHandsOnService(db)
        hands_on = service.get_task_hands_on(UUID(task_id))

        return TaskHandsOnResponse(
            success=True,
            **hands_on
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{task_id}", response_model=UpdateHandsOnResponse)
async def update_task_hands_on(
    task_id: str,
    request: UpdateHandsOnRequest,
    db: Session = Depends(get_db)
):
    """
    ハンズオンの特定フィールドを更新（AI補足用）

    許可されるフィールド:
    - implementation_steps: 実装手順
    - technical_context: 技術的背景
    - prerequisites: 前提条件
    """
    ALLOWED_FIELDS = {"implementation_steps", "technical_context", "prerequisites"}

    if request.field not in ALLOWED_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Field '{request.field}' is not allowed. Allowed: {ALLOWED_FIELDS}"
        )

    try:
        task_uuid = UUID(task_id)

        # ハンズオンを取得
        hands_on = db.query(TaskHandsOn).filter_by(task_id=task_uuid).first()
        if not hands_on:
            raise HTTPException(status_code=404, detail="Hands-on not found for this task")

        # フィールドを更新
        setattr(hands_on, request.field, request.content)
        hands_on.is_user_edited = True  # 編集フラグを立てる
        db.commit()

        return UpdateHandsOnResponse(
            success=True,
            task_id=task_id,
            updated_field=request.field,
            message=f"Field '{request.field}' updated successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}", response_model=DeleteHandsOnResponse)
async def delete_project_hands_on(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    プロジェクトの全ハンズオンを削除（開発用）
    """
    try:
        service = TaskHandsOnService(db)
        deleted_count = service.delete_project_hands_on(UUID(project_id))

        return DeleteHandsOnResponse(
            success=True,
            deleted_count=deleted_count,
            message=f"All hands-on data cleared for project ({deleted_count} items deleted)"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
