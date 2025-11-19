"""
Chat Hanson Router - Plan-and-Execute チャットAPI

プロジェクトのコンテキスト（仕様書、機能要件定義書、フレームワーク、ディレクトリ構造）を
自動取得し、ユーザーの質問に答えるインテリジェントなチャットAPI
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from services.chat_hanson_service import ChatHansonService
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


# =======================
# リクエスト・レスポンスモデル
# =======================

class ChatMessage(BaseModel):
    """チャットメッセージ"""
    role: str = Field(description="メッセージの送信者 (user/assistant)")
    content: str = Field(description="メッセージ内容")


class ChatHansonRequest(BaseModel):
    """チャットリクエスト"""
    project_id: str = Field(description="プロジェクトID (UUID)")
    user_question: str = Field(description="ユーザーの質問", min_length=1)
    chat_history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="過去の会話履歴（最大5件が考慮されます）"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "project_id": "550e8400-e29b-41d4-a716-446655440000",
                "user_question": "この仕様書に記載されている認証機能について教えてください",
                "chat_history": [
                    {
                        "role": "user",
                        "content": "プロジェクトの主な機能は何ですか？"
                    },
                    {
                        "role": "assistant",
                        "content": "このプロジェクトの主な機能は..."
                    }
                ]
            }
        }


class ChatHansonResponse(BaseModel):
    """チャットレスポンス"""
    success: bool = Field(description="処理成功フラグ")
    answer: str = Field(description="AIの回答")
    confidence: float = Field(description="回答の信頼度 (0.0-1.0)", ge=0.0, le=1.0)
    sources_used: List[str] = Field(description="使用した情報源のリスト")
    plan_steps: int = Field(description="実行された計画ステップ数")
    error: Optional[str] = Field(default=None, description="エラーメッセージ（エラー時のみ）")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "answer": "認証機能は、JWTトークンベースの認証を使用しています...",
                "confidence": 0.95,
                "sources_used": ["specification", "function_doc", "frame_work_doc"],
                "plan_steps": 3,
                "error": None
            }
        }


# =======================
# エンドポイント
# =======================

@router.post(
    "/chat",
    response_model=ChatHansonResponse,
    summary="Plan-and-Execute チャット",
    description="""
    プロジェクトのコンテキスト情報（仕様書、機能要件定義書、フレームワーク、ディレクトリ構造）を
    自動的に取得し、ユーザーの質問に対してインテリジェントに回答します。

    **動作フロー:**
    1. Planning: 質問を分析し、必要な情報源を特定
    2. Execute: 計画に基づいて回答を生成

    **特徴:**
    - プロジェクトIDから自動的にコンテキストを取得
    - 必要な情報源を自動判断
    - 信頼度スコア付き回答
    - 会話履歴を考慮（最大5件）
    """,
    tags=["Chat"]
)
def chat_with_project_context(
    request: ChatHansonRequest,
    db: Session = Depends(get_db)
):
    """
    プロジェクトコンテキストを活用したチャットエンドポイント

    Args:
        request: チャットリクエスト
        db: データベースセッション

    Returns:
        ChatHansonResponse: チャット結果

    Raises:
        HTTPException: エラー発生時
    """
    try:
        logger.info(f"[CHAT API] Received request for project_id: {request.project_id}")
        logger.info(f"[CHAT API] Question: {request.user_question}")

        # chat_historyをdict形式に変換
        chat_history = None
        if request.chat_history:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.chat_history
            ]

        # チャットサービスインスタンスを作成
        chat_service = ChatHansonService(db=db)

        # チャット実行
        result = chat_service.chat(
            project_id=request.project_id,
            user_question=request.user_question,
            chat_history=chat_history
        )

        # 成功時
        if result.get("success", False):
            logger.info("[CHAT API] Successfully generated response")
            return ChatHansonResponse(
                success=True,
                answer=result["answer"],
                confidence=result.get("confidence", 0.0),
                sources_used=result.get("sources_used", []),
                plan_steps=result.get("plan_steps", 0)
            )

        # サービスレベルでのエラー
        else:
            logger.error(f"[CHAT API] Service error: {result.get('error')}")
            return ChatHansonResponse(
                success=False,
                answer=result.get("answer", "エラーが発生しました"),
                confidence=0.0,
                sources_used=[],
                plan_steps=0,
                error=result.get("error")
            )

    except ValueError as e:
        logger.error(f"[CHAT API] Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"無効なリクエスト: {str(e)}"
        )

    except Exception as e:
        logger.error(f"[CHAT API] Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"サーバーエラーが発生しました: {str(e)}"
        )


@router.get(
    "/health",
    summary="ヘルスチェック",
    description="Chat Hanson APIの稼働状態を確認します",
    tags=["Health"]
)
def health_check():
    """
    ヘルスチェックエンドポイント

    Returns:
        dict: 稼働状態
    """
    return {
        "status": "healthy",
        "service": "chat_hanson",
        "version": "1.0.0"
    }
