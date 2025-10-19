from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.summary_service import SummaryService
from typing import Union, List
from models.project_base import ProjectDocument
import uuid
from services.mvp_judge_service import MVPJudgeService
from utils.phase_manager import PhaseManager
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
def generate_summary(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    Q&Aリストから要約を生成・保存し、評価を実行する
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id_str = request.project_id
        else:
            project_id_str = str(request.project_id)

        result = summary_service.generate_summary(project_id=project_id_str)

        # ✅ 要約生成成功後、フェーズを summary_review に更新
        try:
            PhaseManager.update_phase(
                db=db,
                project_id=project_id_str,
                new_phase="summary_review"
            )
        except Exception as e:
            print(f"⚠️  Failed to update phase: {e}")

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/generate-with-feedback")
def generate_summary_with_feedback(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    Q&Aリストから要約を生成・保存し、確信度フィードバックも同時に返す
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id_str = request.project_id
        else:
            project_id_str = str(request.project_id)

        result = summary_service.generate_summary_with_feedback(project_id_str)
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
            "doc_id": str(project_doc.doc_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save summary: {str(e)}")

@router.post("/evaluate")
def evaluate_summary(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    既存の要約を評価する
    """
    project_id = request.project_id
    document = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()
    judge_service = MVPJudgeService(db=db)
    if not document or not document.specification:
        raise HTTPException(status_code=404, detail="No summary found for the given project_id")

    result = judge_service.main(requirements_text=document.specification, project_id=project_id)

    # フロントエンドが期待する形式にレスポンスを変換
    return {
        "mvp_feasible": result["judge"]["mvp_feasible"],
        "score_0_100": result["judge"]["score_0_100"],
        "confidence": result["judge"]["confidence"],
        "qa": result["qa"]
    }

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

@router.post("/confidence-feedback")
def get_confidence_feedback(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    仕様書とQ&Aから確信度フィードバックを生成する
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id_str = request.project_id
        else:
            project_id_str = str(request.project_id)

        # プロジェクトIDの検証
        try:
            uuid.UUID(project_id_str)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid project_id format: {project_id_str}")

        result = summary_service.generate_confidence_feedback(project_id_str)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        import traceback
        error_detail = f"Internal server error: {str(e)}\nTraceback: {traceback.format_exc()}"
        print(error_detail)  # サーバーログに出力
        raise HTTPException(status_code=500, detail=str(e))

