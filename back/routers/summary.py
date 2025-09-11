from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.summary_service import SummaryService
from typing import Union, List
import uuid

router = APIRouter()

class ProjectIdRequest(BaseModel):
    project_id: Union[str, uuid.UUID]

class SummaryRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    summary: str

class QAAnswer(BaseModel):
    qa_id: Union[str, uuid.UUID]
    answer: str

class QAUpdateRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    qa_answers: List[QAAnswer]

@router.post("/")
def generate_summary_and_evaluate(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    Q&Aリストから要約を生成・保存し、評価を実行する
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id = uuid.UUID(request.project_id)
        else:
            project_id = request.project_id
            
        result = summary_service.generate_summary_and_evaluate(project_id=project_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/save")
def save_summary(request: SummaryRequest, db: Session = Depends(get_db)):
    """
    指定された要約をプロジェクトドキュメントに保存する
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id = uuid.UUID(request.project_id)
        else:
            project_id = request.project_id
            
        project_doc = summary_service.save_summary_to_project_document(project_id, request.summary)
        return {
            "message": "Summary saved successfully",
            "project_id": str(project_id),
            "doc_id": str(project_doc.doc_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save summary: {str(e)}")

@router.post("/evaluate")
def evaluate_summary(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    既存の要約を評価する（要約の生成・保存は行わない）
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id = uuid.UUID(request.project_id)
        else:
            project_id = request.project_id
            
        result = summary_service.evaluate_project_summary(project_id=project_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/update-qa-and-regenerate")
def update_qa_and_regenerate(request: QAUpdateRequest, db: Session = Depends(get_db)):
    """
    Q&Aの回答を更新し、要約を再生成・保存して再評価する
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id = uuid.UUID(request.project_id)
        else:
            project_id = request.project_id
            
        # QAUpdateをdictのリストに変換
        qa_updates = [
            {
                "qa_id": qa_answer.qa_id,
                "answer": qa_answer.answer
            }
            for qa_answer in request.qa_answers
        ]
        
        result = summary_service.update_qa_answers_and_regenerate(project_id, qa_updates)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
