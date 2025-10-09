"""
AIドキュメント生成API
frame_work_docからAIドキュメントを生成するエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from services.ai_document_service import AIDocumentService


router = APIRouter()


class AIDocumentGenerationRequest(BaseModel):
    """AIドキュメント生成リクエスト"""
    project_id: str


class AIDocumentGenerationResponse(BaseModel):
    """AIドキュメント生成レスポンス"""
    success: bool
    message: str
    project_id: str
    ai_document: str


class AIDocumentGetResponse(BaseModel):
    """AIドキュメント取得レスポンス"""
    ai_doc_id: str
    project_id: str
    environment: Optional[str] = None
    front_end: Optional[str] = None
    back_end: Optional[str] = None
    database: Optional[str] = None
    deployment: Optional[str] = None
    ai_design: Optional[str] = None
    slide: Optional[str] = None


@router.post("/generate", response_model=AIDocumentGenerationResponse)
async def generate_ai_document(
    request: AIDocumentGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    frame_work_docからAIドキュメントを生成

    選択されたフレームワーク情報を基に、詳細な技術ドキュメントを
    AIで自動生成します。生成されたドキュメントはspecificationフィールドに
    追記されます。
    """
    try:
        service = AIDocumentService(db)
        result = await service.generate_ai_document_from_framework(request.project_id)

        # 生成されたドキュメントをJSON文字列に変換
        import json
        ai_document_str = json.dumps(result["generated_documents"], ensure_ascii=False, indent=2)

        return AIDocumentGenerationResponse(
            success=result["success"],
            message=result["message"],
            project_id=result["project_id"],
            ai_document=ai_document_str
        )

    except ValueError as e:
        import traceback
        print(f"ValueError in AI document generation: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        print(f"Exception in AI document generation: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during AI document generation: {str(e)}"
        )


@router.get("/document/{project_id}", response_model=AIDocumentGetResponse)
async def get_ai_document(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    生成済みAIドキュメントを取得
    """
    try:
        service = AIDocumentService(db)
        ai_document = service.get_ai_document(project_id)

        if ai_document is None:
            raise HTTPException(
                status_code=404,
                detail=f"AI document not found for project {project_id}"
            )

        return AIDocumentGetResponse(**ai_document)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{project_id}")
async def get_ai_document_status(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    AIドキュメント生成の状況を確認
    """
    try:
        from models.project_base import ProjectDocument
        import uuid

        project_uuid = uuid.UUID(project_id)
        project_doc = db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc:
            raise HTTPException(
                status_code=404,
                detail=f"Project document not found for project {project_id}"
            )

        has_framework_doc = bool(project_doc.frame_work_doc)
        has_ai_document = bool(project_doc.specification)

        return {
            "project_id": project_id,
            "has_framework_doc": has_framework_doc,
            "has_ai_document": has_ai_document,
            "framework_doc_length": len(project_doc.frame_work_doc) if project_doc.frame_work_doc else 0,
            "ai_document_length": len(project_doc.specification) if project_doc.specification else 0,
            "ready_for_generation": has_framework_doc,
            "generation_completed": has_ai_document
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
