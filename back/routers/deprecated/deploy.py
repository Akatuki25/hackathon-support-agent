from fastapi import APIRouter, responses, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.deploy_service import DeployService

router = APIRouter()

# リクエストボディのモデル
class DeployRequest(BaseModel):
    framework: str      # 使用するフレームワーク情報
    specification: str  # 編集後の仕様書のテキスト
    
@router.post("/")
def create_directory_structure(request: DeployRequest, db: Session = Depends(get_db)):
    """
    仕様書とフレームワーク情報を受け取り、プロジェクトに適応したディレクトリ構成を
    テキスト（コードブロック形式）で返すAPI
    """
    service = DeployService(db=db)
    deploy_structure = service.generate_deploy_service(request.specification, request.framework)
    return responses.JSONResponse(content=deploy_structure, media_type="application/json")
