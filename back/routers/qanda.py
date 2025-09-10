from fastapi import APIRouter, responses, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.question_service import QuestionService
import uuid
from typing import List, Optional

router = APIRouter()

# Pydantic Models
class IdeaPrompt(BaseModel):
    Prompt: str

class QABase(BaseModel):
    question: str
    answer: str
    importance: int
    is_ai: bool
    source_doc_id: Optional[uuid.UUID] = None
    follows_qa_id: Optional[uuid.UUID] = None
    project_id: uuid.UUID

    class Config:
        orm_mode = True

class QAResult(BaseModel):
    QA: List[QABase]

class QuestionResponse(BaseModel):
    result: QAResult


@router.post("/{project_id}", response_model=QuestionResponse)
def generate_question(idea_prompt: IdeaPrompt, project_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    idea_prompt.Prompt を受け取り、Q&Aを返す。
    """
    qanda_service = QuestionService(db=db)
    question = qanda_service.generate_question(idea_prompt.Prompt, project_id=project_id)
    qanda_service.save_question(question["result"])
    return question

@router.post("/save_questions", summary="質問の保存")
def save_questions(questions: QAResult, db: Session = Depends(get_db)):
    qanda_service = QuestionService(db=db)
    qanda_service.save_question(questions.result)
    return {"message": "Questions saved successfully"}