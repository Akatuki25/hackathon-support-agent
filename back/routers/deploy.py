from fastapi import APIRouter, responses
from pydantic import BaseModel
from services.deploy_service import DeployService

router = APIRouter()

# リクエストボディのモデル
class DeployRequest(BaseModel):
    framework: str      # 使用するフレームワーク情報
    specification: str  # 編集後の仕様書のテキスト
    
@router.post("/")
def create_directory_structure(request: DeployRequest):
    """
    仕様書とフレームワーク情報を受け取り、プロジェクトに適応したディレクトリ構成を
    テキスト（コードブロック形式）で返すAPI
    """
    service = DeployService()
    deploy_structure = service.generate_deploy_service(request.specification, request.framework)
    return responses.JSONResponse(content=deploy_structure, media_type="application/json")