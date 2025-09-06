from fastapi import APIRouter, responses, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.question_service import QuestionService

router = APIRouter()

# Pydantic Models
class IdeaPrompt(BaseModel):
    Prompt: str

# Service instance is now created per-request inside the endpoint

@router.post("/")
def generate_question(idea_prompt: IdeaPrompt, db: Session = Depends(get_db)):
    """
    idea_prompt.Prompt を受け取り、Q&Aを返す。
    """
    # Instantiate service with db session
    qanda_service = QuestionService(db=db)
    question = qanda_service.generate_question(idea_prompt.Prompt)
    # JSON形式
    return responses.JSONResponse(content=question, media_type="application/json")