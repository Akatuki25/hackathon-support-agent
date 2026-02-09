from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from database import get_db
from services.project import QuestionService

router = APIRouter()  # 例: app.include_router(router, prefix="/api/question")

# ---------- Models ----------
class IdeaPrompt(BaseModel):
    Prompt: str

class QABase(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    # 必須
    question: str
    importance: int
    is_ai: bool
    project_id: uuid.UUID

    # 任意
    answer: Optional[str] = None
    source_doc_id: Optional[uuid.UUID] = None
    follows_qa_id: Optional[uuid.UUID] = None
    qa_id: Optional[uuid.UUID] = None
    created_at: Optional[str] = None

    # ""（空文字）が来たら None にする → UUID パースで 422 を防止
    @field_validator("source_doc_id", "follows_qa_id", "qa_id", mode="before")
    @classmethod
    def empty_str_to_none_uuid(cls, v):
        if v == "" or v is None:
            return None
        return v

class QAResult(BaseModel):
    QA: List[QABase]




@router.post("/save_questions", summary="質問の保存")
def save_questions(payload: QAResult, db: Session = Depends(get_db)):
    service = QuestionService(db=db)
    service.save_question(payload.QA)
    return {"message": "Questions saved successfully"}

# ---------- Routes ----------
@router.post("/{project_id}", response_model=QAResult)
async def generate_question(
    idea_prompt: IdeaPrompt,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    idea_prompt.Prompt を受け取り、{ QA: [...] } を返す
    非同期版に最適化
    """
    qanda_service = QuestionService(db=db)
    # <- ここでサービスの返却も { "QA": [...] } になるように統一する

    result = await qanda_service.generate_question(idea_prompt.Prompt, project_id=project_id)

    # サービスが list[QABase/Dict] を返すなら包む
    if isinstance(result, dict) and "QA" in result:
        return result

    return {"QA": result}


# ---------- Streaming Endpoint (SSE) ----------
@router.post("/stream/{project_id}", summary="質問のストリーミング生成 (SSE)")
async def stream_questions(
    idea_prompt: IdeaPrompt,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    質問をServer-Sent Events形式でストリーミング生成する。

    1件生成されるたびにSSEイベントとして送信されるため、
    クライアントは最初の質問が生成された瞬間からUIに表示可能。

    ## SSEイベント形式:
    - `event: start` - ストリーム開始 `{"ok": true, "project_id": "..."}`
    - `event: qa` - 質問データ `{"qa_id": "...", "question": "...", "answer": "...", ...}`
    - `event: done` - 完了 `{"count": n}`
    - `event: error` - エラー `{"message": "..."}`

    ## クライアント実装例 (JavaScript):
    ```javascript
    const eventSource = new EventSource('/api/question/stream/{project_id}');
    eventSource.addEventListener('qa', (e) => {
        const qa = JSON.parse(e.data);
        displayQuestion(qa);  // 1件ずつ表示
    });
    eventSource.addEventListener('done', (e) => {
        eventSource.close();
    });
    ```
    """
    service = QuestionService(db=db)

    return StreamingResponse(
        service.stream_questions(
            idea_prompt=idea_prompt.Prompt,
            project_id=str(project_id),
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx buffering無効化
        },
    )
