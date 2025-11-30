from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.function_chat_service import FunctionChatService
from uuid import UUID

router = APIRouter()


class FunctionChatRequest(BaseModel):
    project_id: str          # プロジェクトID
    user_question: str       # ユーザーからの質問
    chat_history: str = ""   # チャット履歴（オプション）


@router.post("/")
def chat_about_function(request: FunctionChatRequest, db: Session = Depends(get_db)):
    """
    機能要件に関する質問に回答するAPI

    機能要件の内容について、なぜその機能が必要なのか、
    優先度がなぜそのように決定されたかを説明します。

    Args:
        request: FunctionChatRequest
            - project_id: プロジェクトID
            - user_question: ユーザーからの質問
            - chat_history: チャット履歴（省略可）

    Returns:
        JSONResponse
            - answer: AI生成の回答
    """
    try:
        # UUIDフォーマットの検証
        try:
            UUID(request.project_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid project_id format. Must be a valid UUID."
            )

        # サービスの初期化
        service = FunctionChatService(db=db)

        # チャット実行
        result = service.chat(
            project_id=request.project_id,
            user_question=request.user_question,
            chat_history=request.chat_history
        )

        return JSONResponse(content=result, media_type="application/json")

    except ValueError as e:
        # プロジェクトが見つからない場合
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        # その他のエラー
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
