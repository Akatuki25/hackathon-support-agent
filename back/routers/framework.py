from fastapi import APIRouter, responses, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.framework_service import FrameworkService

router = APIRouter()

# Pydantic モデル: 仕様書テキストを受け取る
class Document(BaseModel):
    framework : str 
    specification: str

@router.post("/")
def generate_framework_priority(document: Document, db: Session = Depends(get_db)):
    """
    仕様書のテキストを受け取り、固定のフロントエンドおよびバックエンド候補の
    優先順位と理由を JSON 形式で返すAPI。
    """
    framework_service = FrameworkService(db=db)
    result = framework_service.generate_framework_priority(document.specification)
    return responses.JSONResponse(content=result, media_type="application/json")

@router.post("/document")
def generate_framework_document(document: Document, db: Session = Depends(get_db)):
    """
    仕様書のテキストと選択されたフレームワークを受け取り、
    そのフレームワークに沿った技術要件書を生成するAPI。
    """
    framework_service = FrameworkService(db=db)
    result = framework_service.generate_framework_document(document.specification, document.framework)
    return responses.JSONResponse(content=result, media_type="application/json")
