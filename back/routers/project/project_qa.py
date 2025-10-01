from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from typing import Optional, List
from database import SessionLocal
from models.project_base import QA

router = APIRouter()

# Pydantic Models
class QAType(BaseModel):
    project_id: uuid.UUID
    question: str
    answer: Optional[str] = None
    is_ai: bool = False
    source_doc_id: Optional[uuid.UUID] = None
    follows_qa_id: Optional[uuid.UUID] = None
    importance: int = 0

class QAPatch(BaseModel):
    project_id: Optional[uuid.UUID] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    is_ai: Optional[bool] = None
    source_doc_id: Optional[uuid.UUID] = None
    follows_qa_id: Optional[uuid.UUID] = None
    importance: Optional[int] = None

from database import get_db

@router.post("/qa", summary="QA作成")
async def create_qa(qa: QAType, db: Session = Depends(get_db)):
    db_qa = QA(
        qa_id=uuid.uuid4(),
        project_id=qa.project_id,
        question=qa.question,
        answer=qa.answer,
        is_ai=qa.is_ai,
        source_doc_id=qa.source_doc_id,
        follows_qa_id=qa.follows_qa_id,
        importance=qa.importance
    )
    db.add(db_qa)
    db.commit()
    db.refresh(db_qa)
    return {"qa_id": db_qa.qa_id, "message": "QAが作成されました"}

@router.get("/qa/{qa_id}", summary="QA取得")
async def get_qa(qa_id: uuid.UUID, db: Session = Depends(get_db)):
    db_qa = db.query(QA).filter(QA.qa_id == qa_id).first()
    if db_qa is None:
        raise HTTPException(status_code=404, detail="QA not found")
    return db_qa

@router.put("/qa/{qa_id}", summary="QA更新")
async def update_qa(qa_id: uuid.UUID, qa: QAType, db: Session = Depends(get_db)):
    db_qa = db.query(QA).filter(QA.qa_id == qa_id).first()
    if db_qa is None:
        raise HTTPException(status_code=404, detail="QA not found")

    db_qa.project_id = qa.project_id
    db_qa.question = qa.question
    db_qa.answer = qa.answer
    db_qa.is_ai = qa.is_ai
    db_qa.source_doc_id = qa.source_doc_id
    db_qa.follows_qa_id = qa.follows_qa_id
    db_qa.importance = qa.importance

    db.commit()
    db.refresh(db_qa)
    return {"qa_id": qa_id, "message": "QAが更新されました"}

@router.patch("/qa/{qa_id}", summary="QA部分更新")
async def patch_qa(qa_id: uuid.UUID, qa: QAPatch, db: Session = Depends(get_db)):
    db_qa = db.query(QA).filter(QA.qa_id == qa_id).first()
    if db_qa is None:
        raise HTTPException(status_code=404, detail="QA not found")

    update_data = qa.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_qa, key, value)

    db.commit()
    db.refresh(db_qa)
    return {"message": "QA partially updated successfully"}

@router.delete("/qa/{qa_id}", summary="QA削除")
async def delete_qa(qa_id: uuid.UUID, db: Session = Depends(get_db)):
    db_qa = db.query(QA).filter(QA.qa_id == qa_id).first()
    if db_qa is None:
        raise HTTPException(status_code=404, detail="QA not found")

    db.delete(db_qa)
    db.commit()
    return {"qa_id": qa_id, "message": "QAが削除されました"}

@router.get("/qas", summary="QAリスト取得")
async def list_qas(project_id: Optional[uuid.UUID] = None, db: Session = Depends(get_db)):
    query = db.query(QA)
    if project_id:
        query = query.filter(QA.project_id == project_id)
    qas = query.all()
    return qas



