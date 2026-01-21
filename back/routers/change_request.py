"""
仕様変更リクエストAPIエンドポイント

POST /api/change/propose - 変更提案を作成
POST /api/change/{request_id}/revise - 修正要求を処理
POST /api/change/{request_id}/approve - 変更を承認・適用
POST /api/change/{request_id}/cancel - 変更をキャンセル
GET  /api/change/{request_id} - 変更リクエストを取得
"""

import logging
import traceback
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from services.change_request_service import ChangeRequestService

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/change", tags=["change-request"])


# =============================================================================
# リクエスト/レスポンススキーマ
# =============================================================================

class ProposeRequest(BaseModel):
    """変更提案リクエスト"""
    project_id: str = Field(description="プロジェクトID")
    description: str = Field(description="変更要望の説明")


class ReviseRequest(BaseModel):
    """修正要求リクエスト"""
    feedback: str = Field(description="修正内容")


class ImpactItem(BaseModel):
    """影響項目"""
    name: str
    reason: str


class DependencyChanges(BaseModel):
    """依存関係の変更"""
    add: list = Field(default_factory=list, description="追加する依存関係")
    remove: list = Field(default_factory=list, description="削除する依存関係")


class ImpactSummary(BaseModel):
    """影響サマリー"""
    tasks_to_discard: int = 0
    tasks_to_add: int = 0
    tasks_to_modify: int = 0
    dependencies_to_add: int = 0
    dependencies_to_remove: int = 0


class FunctionsChanges(BaseModel):
    """機能の変更"""
    keep: list = Field(default_factory=list)
    discard: list = Field(default_factory=list)
    add: list = Field(default_factory=list)
    modify: list = Field(default_factory=list)


class TasksChanges(BaseModel):
    """タスクの変更"""
    discard: list = Field(default_factory=list)
    add: list = Field(default_factory=list)
    modify: list = Field(default_factory=list)


class ProposalResponse(BaseModel):
    """提案レスポンス"""
    understood_intent: Optional[str] = None
    approach: str
    keep: list = Field(default_factory=list)
    discard: list = Field(default_factory=list)
    add: list = Field(default_factory=list)
    modify: list = Field(default_factory=list)
    functions: Optional[FunctionsChanges] = None
    tasks: Optional[TasksChanges] = None
    dependency_changes: Optional[DependencyChanges] = None
    impact: Optional[ImpactSummary] = None


class ConversationMessage(BaseModel):
    """対話メッセージ"""
    role: str
    content: Optional[str] = None
    type: Optional[str] = None
    summary: Optional[str] = None
    timestamp: str


class ChangeRequestResponse(BaseModel):
    """変更リクエストレスポンス"""
    request_id: str
    status: str
    proposal: Optional[ProposalResponse] = None
    conversation: list = Field(default_factory=list)


class ApprovalResponse(BaseModel):
    """承認レスポンス"""
    request_id: str
    status: str
    changes_applied: dict = Field(default_factory=dict)


class CancelResponse(BaseModel):
    """キャンセルレスポンス"""
    request_id: str
    status: str


class FullChangeRequest(BaseModel):
    """変更リクエスト詳細"""
    request_id: str
    project_id: str
    description: str
    status: str
    proposal: Optional[dict] = None
    conversation: list = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# =============================================================================
# エンドポイント
# =============================================================================

@router.post("/propose", response_model=ChangeRequestResponse)
async def propose_change(
    request: ProposeRequest,
    db: Session = Depends(get_db)
):
    """
    変更提案を作成する

    ユーザーの変更要望を分析し、最小スコープの変更提案を生成する。
    提案には機能・タスクの追加/変更/削除が含まれる。

    ## リクエスト
    - project_id: 対象プロジェクトのID
    - description: 変更要望（例: "LINE Botベースにしたい"）

    ## レスポンス
    - request_id: 変更リクエストID（以降の操作で使用）
    - status: "PROPOSING"
    - proposal: 変更提案の詳細
      - approach: 変更アプローチの概要
      - keep: 残す機能/タスク
      - discard: 破棄する機能/タスク
      - add: 追加する機能/タスク
      - modify: 変更する機能/タスク
    - conversation: 対話履歴
    """
    service = ChangeRequestService(db=db)

    try:
        result = await service.propose(
            project_id=request.project_id,
            description=request.description
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in propose: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{request_id}/revise", response_model=ChangeRequestResponse)
async def revise_change(
    request_id: str,
    request: ReviseRequest,
    db: Session = Depends(get_db)
):
    """
    修正要求を処理する

    ユーザーの修正要求を受けて、提案を更新する。
    差分ベースで更新されるため、既存の提案に修正が追加される。

    ## パスパラメータ
    - request_id: 変更リクエストID

    ## リクエスト
    - feedback: 修正内容（例: "通知機能もLINE Pushにしたい"）

    ## レスポンス
    - 更新された変更提案

    ## 使用例
    1. 初回提案で「フロントをLINE Bot化」が提案される
    2. ユーザーが「通知もLINE Pushにしたい」と修正要求
    3. 差分が追加され、通知機能もLINE Push対応に更新
    """
    service = ChangeRequestService(db=db)

    try:
        result = await service.revise(
            request_id=request_id,
            feedback=request.feedback
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{request_id}/approve", response_model=ApprovalResponse)
async def approve_change(
    request_id: str,
    db: Session = Depends(get_db)
):
    """
    変更を承認・適用する

    提案された変更をDBに適用する。
    この操作は不可逆であり、適用後はキャンセルできない。

    ## パスパラメータ
    - request_id: 変更リクエストID

    ## レスポンス
    - status: "APPLIED"
    - changes_applied: 適用された変更の詳細
      - specification_updated: 仕様書が更新されたか
      - function_doc_updated: 機能要件書が更新されたか
      - functions_added: 追加された機能
      - functions_deleted: 削除された機能
      - tasks_added: 追加されたタスク
      - tasks_deleted: 削除されたタスク
      - tasks_modified: 変更されたタスク
    """
    service = ChangeRequestService(db=db)

    try:
        result = await service.approve(request_id=request_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{request_id}/cancel", response_model=CancelResponse)
def cancel_change(
    request_id: str,
    db: Session = Depends(get_db)
):
    """
    変更をキャンセルする

    提案中の変更をキャンセルする。
    既に適用済み（APPLIED）の変更はキャンセルできない。

    ## パスパラメータ
    - request_id: 変更リクエストID

    ## レスポンス
    - status: "CANCELLED"
    """
    service = ChangeRequestService(db=db)

    try:
        result = service.cancel(request_id=request_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{request_id}", response_model=FullChangeRequest)
def get_change_request(
    request_id: str,
    db: Session = Depends(get_db)
):
    """
    変更リクエストを取得する

    ## パスパラメータ
    - request_id: 変更リクエストID

    ## レスポンス
    - 変更リクエストの全情報
    """
    service = ChangeRequestService(db=db)

    result = service.get_request(request_id=request_id)
    if not result:
        raise HTTPException(status_code=404, detail="ChangeRequest not found")

    return result
