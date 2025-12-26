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
    Google Search Grounding を使用して最新の環境構築情報を検索・参照します。

    出力は以下のフィールドを含むJSON:
      - overall: 全体のハンズオン説明
      - devcontainer: .devcontainer の使い方と具体的な設定内容
      - frontend: フロントエンドの初期環境構築手順
      - backend: バックエンドの初期環境構築手順
      - reference_urls: 参照した公式ドキュメントやガイドのURLリスト
    """
    service = EnvironmentService(db=db)
    result = service.generate_hands_on(
        request.specification,
        request.directory,
        request.framework,
        enable_search=True
    )
    return responses.JSONResponse(content=result, media_type="application/json")