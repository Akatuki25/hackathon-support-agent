from fastapi import APIRouter, responses, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.environment_service import EnvironmentService

router = APIRouter()

class EnvironmentRequest(BaseModel):
    specification: str
    directory: str
    framework: str

@router.post("/")
def generate_environment_hands_on(request: EnvironmentRequest, db: Session = Depends(get_db)):
    """
    仕様書、ディレクトリ構成、フレームワーク情報を受け取り、環境構築ハンズオンの説明を生成するAPI。
    出力は以下の4つのMarkdown文字列を含むJSON:
      - overall: 全体のハンズオン説明
      - devcontainer: .devcontainer の使い方と具体的な設定内容
      - frontend: フロントエンドの初期環境構築手順
      - backend: バックエンドの初期環境構築手順
    """
    service = EnvironmentService(db=db)
    result = service.generate_hands_on(request.specification, request.directory, request.framework)
    return responses.JSONResponse(content=result, media_type="application/json")