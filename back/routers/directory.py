from fastapi import APIRouter, responses
from pydantic import BaseModel
from services.directory_service import DirectoryService

router = APIRouter()

# リクエストボディのモデル
class DirectoryRequest(BaseModel):
    framework: str      # 使用するフレームワーク情報
    specification: str  # 編集後の仕様書のテキスト
    
@router.post("/")
def create_directory_structure(request: DirectoryRequest):
    """
    仕様書とフレームワーク情報を受け取り、プロジェクトに適応したディレクトリ構成を
    テキスト（コードブロック形式）で返すAPI
    """
    service = DirectoryService()
    directory_structure = service.generate_directory_structure(request.specification, request.framework)
    return responses.JSONResponse(content={"directory_structure": directory_structure}, media_type="application/json")
