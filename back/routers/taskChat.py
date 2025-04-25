from fastapi import APIRouter, responses
from pydantic import BaseModel
from services.taskChat_service import taskChatService

router = APIRouter()

# リクエストボディのモデル
class ChatBotRequest(BaseModel):
    specification: str         # 仕様書
    directory_structure: str     # ディレクトリ構造
    chat_history: str            # チャット履歴
    user_question: str           # 新たなユーザーからのチャットでの質問内容
    framework: str               # 使用しているフレームワーク
    taskDetail: str              # タスク詳細

@router.post("/")
def get_chatbot_response(request: ChatBotRequest):
    """
    仕様書、ディレクトリ構造、チャット履歴、新たなユーザーからの質問内容、
    使用しているフレームワーク情報を受け取り、回答をテキスト形式で返すAPI
    """
    service = taskChatService()
    answer = service.generate_response(
        specification=request.specification,
        directory_structure=request.directory_structure,
        chat_history=request.chat_history,
        user_question=request.user_question,
        framework=request.framework,
        taskDetail=request.taskDetail
    )
    return responses.JSONResponse(content={"response": answer}, media_type="application/json")
