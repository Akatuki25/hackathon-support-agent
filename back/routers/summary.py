from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.summary_service import SummaryService
import uuid

router = APIRouter()


@router.post("/")
def generate_summary_document(project_id:uuid.UUID, db: Session = Depends(get_db)):
    """
    yume_answer.Answer = [{"Question":"...","Answer":"..."}, ...]
    """
    summary_service = SummaryService(db=db)
    # Q&Aリストを取得
    answer_list = summary_service.main(project_id=project_id)
    
    return answer_list
