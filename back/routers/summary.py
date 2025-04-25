from fastapi import APIRouter
from pydantic import BaseModel
from services.summary_service import SummaryService

router = APIRouter()
summary_service = SummaryService()

class YumeQA(BaseModel):
    Question: str
    Answer: str

class YumeAnswer(BaseModel):
    Answer: list[YumeQA]


@router.post("/")
def generate_summary_document(yume_answer: YumeAnswer):
    """
    yume_answer.Answer = [{"Question":"...","Answer":"..."}, ...]
    """
    # Q&Aリストを取得
    answer_list = yume_answer.Answer  
    # サマリー生成
    summary_text = summary_service.generate_summary_docment(answer_list)
    # レスポンスを返す
    return {"summary": summary_text}
