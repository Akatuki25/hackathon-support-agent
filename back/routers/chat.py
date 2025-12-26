"""
ページコンテキスト対応チャットAPI

各ページで異なる役割を持つチャット機能を提供する。
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from uuid import UUID
import os
import tomllib
import logging

from database import get_db
from services.chat import ChatRouter, ChatMessage, ChatAction
from services.base_service import BaseService

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatMessageRequest(BaseModel):
    """チャットメッセージのリクエスト形式"""

    role: str
    content: str


class ChatRequest(BaseModel):
    """チャットリクエスト"""

    project_id: str
    page_context: str  # "hackQA", "kanban", etc.
    message: str
    history: List[ChatMessageRequest] = []
    page_specific_context: Optional[Dict[str, Any]] = None  # ページ固有の追加情報


class ChatActionResponse(BaseModel):
    """アクションレスポンス"""

    action_type: str
    label: str
    payload: Dict[str, Any]
    requires_confirm: bool


class ReferenceUrlResponse(BaseModel):
    """参照URL情報"""

    title: str
    url: str
    snippet: str = ""
    source: str = "grounding_chunk"


class ChatResponseModel(BaseModel):
    """チャットレスポンス"""

    message: str
    suggested_actions: List[ChatActionResponse]
    context_used: List[str]
    reference_urls: List[ReferenceUrlResponse] = []  # 検索で参照したURL


def _load_chat_prompts() -> Dict[str, Dict[str, str]]:
    """チャット用プロンプトを読み込む"""
    prompts_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "services",
        "chat",
        "prompts",
        "chat_prompts.toml",
    )
    try:
        with open(prompts_path, "rb") as f:
            return tomllib.load(f)
    except FileNotFoundError:
        logger.error(f"Chat prompts file not found: {prompts_path}")
        raise
    except Exception as e:
        logger.exception(f"Failed to load chat prompts: {e}")
        raise


def _get_llm(db: Session):
    """LLMインスタンスを取得（BaseServiceから借用）"""
    base_service = BaseService(db)
    return base_service.llm_flash


@router.post("/message", response_model=ChatResponseModel)
async def send_message(request: ChatRequest, db: Session = Depends(get_db)):
    """
    ページコンテキスト対応チャットAPI

    指定されたページに適したハンドラでチャットを処理します。

    Args:
        request: ChatRequest
            - project_id: プロジェクトID
            - page_context: ページ識別子（hackQA, kanban, etc.）
            - message: ユーザーメッセージ
            - history: チャット履歴
            - page_specific_context: ページ固有の追加情報

    Returns:
        ChatResponseModel
            - message: AIの応答
            - suggested_actions: 提案アクション
            - context_used: 使用したコンテキスト
    """
    try:
        # UUIDフォーマットの検証
        try:
            UUID(request.project_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid project_id format. Must be a valid UUID.",
            )

        # ハンドラが登録されているか確認
        if not ChatRouter.is_registered(request.page_context):
            available = ChatRouter.list_contexts()
            raise HTTPException(
                status_code=400,
                detail=f"Unknown page_context: '{request.page_context}'. "
                f"Available contexts: {available}",
            )

        # プロンプトとLLMを取得
        prompts = _load_chat_prompts()
        llm = _get_llm(db)

        # ハンドラを取得
        handler = ChatRouter.get_handler(
            page_context=request.page_context,
            project_id=request.project_id,
            db=db,
            llm=llm,
            prompts=prompts,
        )

        # ページ固有コンテキストを設定
        if request.page_specific_context:
            handler.set_page_specific_context(request.page_specific_context)

        # チャット履歴を変換
        history = [
            ChatMessage(role=msg.role, content=msg.content) for msg in request.history
        ]

        # チャット実行
        response = await handler.chat(
            user_message=request.message,
            history=history,
        )

        return ChatResponseModel(
            message=response.message,
            suggested_actions=[
                ChatActionResponse(
                    action_type=action.action_type,
                    label=action.label,
                    payload=action.payload,
                    requires_confirm=action.requires_confirm,
                )
                for action in response.suggested_actions
            ],
            context_used=response.context_used,
            reference_urls=[
                ReferenceUrlResponse(
                    title=url.title,
                    url=url.url,
                    snippet=url.snippet,
                    source=url.source,
                )
                for url in response.reference_urls
            ],
        )

    except HTTPException:
        raise

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        logger.exception(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/message/stream")
async def send_message_stream(request: ChatRequest, db: Session = Depends(get_db)):
    """
    ストリーミング対応チャットAPI (Server-Sent Events)

    リアルタイムでレスポンスを返します。

    イベント形式:
    - data: {"type": "chunk", "content": "..."} - テキストチャンク
    - data: {"type": "done", "actions": [...]} - 完了時（アクション情報付き）
    - data: {"type": "error", "message": "..."} - エラー時
    """
    try:
        # UUIDフォーマットの検証
        try:
            UUID(request.project_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid project_id format. Must be a valid UUID.",
            )

        # ハンドラが登録されているか確認
        if not ChatRouter.is_registered(request.page_context):
            available = ChatRouter.list_contexts()
            raise HTTPException(
                status_code=400,
                detail=f"Unknown page_context: '{request.page_context}'. "
                f"Available contexts: {available}",
            )

        # プロンプトとLLMを取得
        prompts = _load_chat_prompts()
        llm = _get_llm(db)

        # ハンドラを取得
        handler = ChatRouter.get_handler(
            page_context=request.page_context,
            project_id=request.project_id,
            db=db,
            llm=llm,
            prompts=prompts,
        )

        # ページ固有コンテキストを設定
        if request.page_specific_context:
            handler.set_page_specific_context(request.page_specific_context)

        # チャット履歴を変換
        history = [
            ChatMessage(role=msg.role, content=msg.content) for msg in request.history
        ]

        # ストリーミングレスポンスを返す
        return StreamingResponse(
            handler.chat_stream(
                user_message=request.message,
                history=history,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # nginx用
            },
        )

    except HTTPException:
        raise

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        logger.exception(f"Chat stream error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/contexts")
async def list_available_contexts():
    """
    利用可能なページコンテキスト一覧を取得

    Returns:
        - contexts: 登録済みページコンテキスト
        - actions_by_context: ページごとの利用可能アクション
    """
    return {
        "contexts": ChatRouter.list_contexts(),
        "actions_by_context": ChatRouter.get_all_page_actions(),
    }


@router.get("/actions/{page_context}")
async def get_page_actions(page_context: str):
    """
    指定ページで利用可能なアクションを取得

    Args:
        page_context: ページ識別子

    Returns:
        - page_context: ページ識別子
        - actions: 利用可能なアクションタイプ
    """
    actions = ChatRouter.get_all_page_actions().get(page_context, [])
    return {
        "page_context": page_context,
        "actions": actions,
    }
