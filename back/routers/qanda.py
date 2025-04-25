from fastapi import APIRouter, responses
from pydantic import BaseModel
from services.question_service import QuestionService

router = APIRouter()

# Pydantic Models
class IdeaPrompt(BaseModel):
    Prompt: str

# Service Instance
qanda_service = QuestionService()


@router.post("/")
def generate_question(idea_prompt: IdeaPrompt):
    """
    idea_prompt.Prompt を受け取り、Q&Aを返す。
    """
    question = qanda_service.generate_question(idea_prompt.Prompt)
    # JSON形式
    return responses.JSONResponse(content=question, media_type="application/json")
