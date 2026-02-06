from fastapi import APIRouter, responses, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.tech import FrameworkService
from typing import List, Optional

router = APIRouter()

# Pydantic モデル: 仕様書テキストを受け取る
class Document(BaseModel):
    framework : str
    specification: str

# 新しいPydanticモデル群
class FrameworkRecommendationRequest(BaseModel):
    specification: str
    function_doc: Optional[str] = ""

class FrameworkSelectionRequest(BaseModel):
    project_id: str
    selected_platform: str
    selected_technologies: List[str]
    reasoning: Optional[str] = None

class FrameworkEvaluationRequest(BaseModel):
    specification: str
    selected_technologies: List[str]
    platform: str

class GenerateDocumentRequest(BaseModel):
    project_id: str
    specification: str
    selected_technologies: List[str]

@router.post("/")
def generate_framework_priority(document: Document, db: Session = Depends(get_db)):
    """
    仕様書のテキストを受け取り、固定のフロントエンドおよびバックエンド候補の
    優先順位と理由を JSON 形式で返すAPI。
    """
    framework_service = FrameworkService(db=db)
    result = framework_service.generate_framework_priority(document.specification)
    return responses.JSONResponse(content=result, media_type="application/json")

@router.post("/recommendations")
def get_framework_recommendations(request: FrameworkRecommendationRequest, db: Session = Depends(get_db)):
    """
    仕様書と機能ドキュメントに基づいて推薦技術の名前、優先度、理由を返すAPI。
    """
    try:
        framework_service = FrameworkService(db=db)
        result = framework_service.generate_framework_recommendations(
            request.specification,
            request.function_doc
        )
        return responses.JSONResponse(content=result, media_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"推薦生成中にエラーが発生しました: {str(e)}")



@router.get("/technology-options/{platform}")
def get_technology_options(platform: str, db: Session = Depends(get_db)):
    """
    プラットフォーム別の技術オプションを取得するAPI。
    """
    try:
        framework_service = FrameworkService(db=db)
        result = framework_service.get_technology_options(platform)
        return responses.JSONResponse(content=result, media_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"技術オプション取得中にエラーが発生しました: {str(e)}")

@router.get("/selection/{project_id}")
def get_framework_selection(project_id: str, db: Session = Depends(get_db)):
    """
    保存されたフレームワーク選択情報を取得するAPI。
    """
    try:
        # ここでDBから取得処理を実装
        return responses.JSONResponse(content={
            "selected_platform": "web",
            "selected_technologies": ["React", "FastAPI"],
            "framework_document": "# 技術スタック\n\nReact + FastAPIを使用",
            "reasoning": "開発効率と学習コストを考慮"
        }, media_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"選択情報取得中にエラーが発生しました: {str(e)}")

@router.post("/generate-document")
def generate_framework_document_new(request: GenerateDocumentRequest, db: Session = Depends(get_db)):
    """
    選択された技術スタックに基づいてフレームワーク技術要件定義書を生成するAPI。
    """
    try:
        framework_service = FrameworkService(db=db)
        technologies_text = ", ".join(request.selected_technologies)
        result = framework_service.generate_framework_document(
            request.specification,
            technologies_text
        )
        return responses.JSONResponse(content={
            "message": "技術要件定義書が生成されました",
            "doc_id": request.project_id,
            "framework_document": result
        }, media_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ドキュメント生成中にエラーが発生しました: {str(e)}")

@router.post("/evaluate-choice")
def evaluate_framework_choice(request: FrameworkEvaluationRequest, db: Session = Depends(get_db)):
    """
    選択されたフレームワークの妥当性を評価するAPI。
    """
    try:
        framework_service = FrameworkService(db=db)
        result = framework_service.evaluate_framework_choice(
            request.specification,
            request.selected_technologies,
            request.platform
        )
        return responses.JSONResponse(content=result, media_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"評価中にエラーが発生しました: {str(e)}")

@router.post("/document")
def generate_framework_document(document: Document, db: Session = Depends(get_db)):
    """
    仕様書のテキストと選択されたフレームワークを受け取り、
    そのフレームワークに沿った技術要件書を生成するAPI。
    """
    framework_service = FrameworkService(db=db)
    result = framework_service.generate_framework_document(document.specification, document.framework)
    return responses.JSONResponse(content=result, media_type="application/json")
