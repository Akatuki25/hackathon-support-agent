from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.chat import ChatHansonService
from uuid import UUID

router = APIRouter()


class ChatHansonRequest(BaseModel):
    project_id: str          # プロジェクトID
    user_question: str       # ユーザーからの質問
    chat_history: str = ""   # チャット履歴（オプション）
    return_plan: bool = False  # 計画も返すかどうか（オプション）


@router.post("/")
def chat_with_hanson(request: ChatHansonRequest, db: Session = Depends(get_db)):
    """
    ハッカソン開発支援チャットAPI

    Planning + Execute の2ステップでユーザーの質問に回答します。
    プロジェクトの仕様書、機能要件、フレームワーク、ディレクトリ構成を
    自動的に取得して、コンテキストとして活用します。

    Args:
        request: ChatHansonRequest
            - project_id: プロジェクトID
            - user_question: ユーザーからの質問
            - chat_history: チャット履歴（省略可）
            - return_plan: 計画も返すかどうか（省略可、デフォルト: False）

    Returns:
        JSONResponse
            - answer: AI生成の回答
            - plan: 回答計画（return_plan=Trueの場合のみ）
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
        service = ChatHansonService(db=db)

        # チャット実行
        result = service.chat(
            project_id=request.project_id,
            user_question=request.user_question,
            chat_history=request.chat_history,
            return_plan=request.return_plan
        )

        return JSONResponse(content=result, media_type="application/json")

    except ValueError as e:
        # プロジェクトが見つからない場合
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        # その他のエラー
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/plan")
def plan_only(request: ChatHansonRequest, db: Session = Depends(get_db)):
    """
    Planning stepのみを実行するAPI

    回答計画だけを取得したい場合に使用します。

    Args:
        request: ChatHansonRequest
            - project_id: プロジェクトID
            - user_question: ユーザーからの質問
            - chat_history: チャット履歴（省略可）

    Returns:
        JSONResponse
            - plan: 回答計画
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
        service = ChatHansonService(db=db)

        # プロジェクトコンテキストの取得
        project_context = service.get_project_context(request.project_id)
        if not project_context:
            raise HTTPException(
                status_code=404,
                detail=f"Project context not found for project_id: {request.project_id}"
            )

        # Planning実行
        plan = service.plan(
            user_question=request.user_question,
            project_context=project_context,
            chat_history=request.chat_history
        )

        return JSONResponse(content={"plan": plan}, media_type="application/json")

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
