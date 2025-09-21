from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.technology_service import TechnologyService
from typing import List, Optional

router = APIRouter()

class TechnologyDocumentRequest(BaseModel):
    selected_technologies: List[str]
    framework_doc: Optional[str] = ""

class InstallationGuideRequest(BaseModel):
    technology_name: str

class EnvironmentSetupRequest(BaseModel):
    selected_technologies: List[str]
    project_type: Optional[str] = "web"

@router.post("/document")
def generate_technology_document(request: TechnologyDocumentRequest, db: Session = Depends(get_db)):
    """
    選択された技術に基づいて、Docker環境でのインストール手順と
    公式ドキュメントへのリンクを含む技術ドキュメントを生成するAPI。
    """
    try:
        technology_service = TechnologyService(db=db)
        result = technology_service.generate_technology_document(
            request.selected_technologies,
            request.framework_doc
        )
        return JSONResponse(content={
            "message": "技術ドキュメントが生成されました",
            "technology_document": result
        }, media_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"技術ドキュメント生成中にエラーが発生しました: {str(e)}")

@router.post("/installation-guide")
def get_installation_guide(request: InstallationGuideRequest, db: Session = Depends(get_db)):
    """
    特定の技術のインストールガイドと公式ドキュメントリンクを取得するAPI。
    """
    try:
        technology_service = TechnologyService(db=db)
        result = technology_service.get_technology_installation_guide(request.technology_name)
        return JSONResponse(content=result, media_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"インストールガイド取得中にエラーが発生しました: {str(e)}")

@router.post("/environment-setup")
def generate_environment_setup(request: EnvironmentSetupRequest, db: Session = Depends(get_db)):
    """
    選択された技術スタックに基づいて、統合的な開発環境のセットアップガイドを生成するAPI。
    """
    try:
        technology_service = TechnologyService(db=db)
        result = technology_service.generate_development_environment_setup(
            request.selected_technologies,
            request.project_type
        )
        return JSONResponse(content={
            "message": "開発環境セットアップガイドが生成されました",
            "environment_setup": result
        }, media_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"環境セットアップガイド生成中にエラーが発生しました: {str(e)}")