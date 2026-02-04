"""
アイデア発想サポートAPI

チャット形式でアイデア発想をサポートするエンドポイント。
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List
import logging

from database import get_db
from services.chat.idea_support_service import IdeaSupportService, ChatMessage, FinalizedIdea
from utils.streaming_json import sse_event


router = APIRouter()
logger = logging.getLogger(__name__)


class ChatMessageRequest(BaseModel):
    """チャットメッセージのリクエスト形式"""
    role: str
    content: str


class ChatRequest(BaseModel):
    """チャットリクエスト"""
    message: str
    chat_history: List[ChatMessageRequest] = []


class FinalizeRequest(BaseModel):
    """アイデア確定リクエスト"""
    chat_history: List[ChatMessageRequest]


class FinalizeResponse(BaseModel):
    """アイデア確定レスポンス"""
    title: str
    idea: str


async def _stream_generator(service: IdeaSupportService, message: str, chat_history: List[ChatMessage]):
    """
    SSEストリーミングジェネレーター

    イベント形式:
    - event: chunk -> {"content": "..."} テキストチャンク
    - event: proposal -> {"title": "...", "description": "..."} アイデア提案
    - event: done -> {"ok": true} 完了
    - event: error -> {"message": "..."} エラー
    """
    full_response = ""

    try:
        async for chunk in service.chat_stream(message, chat_history):
            # 応答を蓄積
            full_response += chunk

            # SSE形式でチャンクを送信
            yield sse_event("chunk", {"content": chunk})

        # ストリーミング完了後、提案を抽出
        if full_response:
            proposal = await service.extract_proposal(full_response)
            if proposal and proposal.has_proposal:
                # 提案イベントを送信
                yield sse_event("proposal", {
                    "title": proposal.title,
                    "description": proposal.description,
                })

        # 完了イベントを送信
        yield sse_event("done", {"ok": True})

    except Exception as e:
        logger.exception(f"Streaming error: {e}")
        yield sse_event("error", {"message": str(e)})


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    """
    アイデア発想サポートチャット（ストリーミング）

    Server-Sent Eventsでリアルタイムに応答を返します。

    イベント形式:
    - `event: chunk` -> `{"content": "..."}` テキストチャンク
    - `event: proposal` -> `{"title": "...", "description": "..."}` アイデア提案
    - `event: done` -> `{"ok": true}` 完了
    - `event: error` -> `{"message": "..."}` エラー
    """
    try:
        service = IdeaSupportService(db)

        # リクエストのチャット履歴を変換
        chat_history = [
            ChatMessage(role=msg.role, content=msg.content)
            for msg in request.chat_history
        ]

        return StreamingResponse(
            _stream_generator(service, request.message, chat_history),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        logger.exception(f"Chat stream error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/finalize", response_model=FinalizeResponse)
async def finalize_idea(request: FinalizeRequest, db: Session = Depends(get_db)):
    """
    チャット履歴からアイデアを確定

    対話の中で見つかったアイデアをタイトルと詳細説明として抽出します。

    Returns:
        - title: プロジェクトタイトル
        - idea: アイデアの詳細説明
    """
    try:
        service = IdeaSupportService(db)

        # リクエストのチャット履歴を変換
        chat_history = [
            ChatMessage(role=msg.role, content=msg.content)
            for msg in request.chat_history
        ]

        if not chat_history:
            raise HTTPException(
                status_code=400,
                detail="チャット履歴が空です。まずAIと対話してください。"
            )

        result = await service.finalize_idea(chat_history)

        return FinalizeResponse(
            title=result.title,
            idea=result.idea,
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(f"Finalize error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
