from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.summary_service import SummaryService

router = APIRouter()

class YumeQA(BaseModel):
    Question: str
    Answer: str

class YumeAnswer(BaseModel):
    Answer: list[YumeQA]


@router.post("/")
def generate_summary_document(yume_answer: YumeAnswer, db: Session = Depends(get_db)):
    """
    yume_answer.Answer = [{"Question":"...","Answer":"..."}, ...]
    """
    summary_service = SummaryService(db=db)
    # Q&Aリストを取得
    answer_list = yume_answer.Answer  
    # サマリー生成
    summary_text = summary_service.generate_summary_docment(answer_list)
    # レスポンスを返す
    return {"summary": summary_text}