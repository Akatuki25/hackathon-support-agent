from fastapi import APIRouter, HTTPException, responses, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.environment_service import EnvironmentService

router = APIRouter()

class EnvironmentRequest(BaseModel):
    specification: str
    directory: str
    framework: str

class GenerateEnvironmentFromProjectRequest(BaseModel):
    project_id: str

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

@router.post("/generate-from-project")
def generate_environment_from_project(request: GenerateEnvironmentFromProjectRequest, db: Session = Depends(get_db)):
    """
    プロジェクトIDを受け取り、ProjectDocumentから情報を取得して、
    環境構築ハンズオン資料を生成し、Envテーブルに保存するAPI。

    処理フロー:
    1. プロジェクトの存在確認
    2. ProjectDocumentから仕様書、ディレクトリ、フレームワーク情報を取得
    3. EnvironmentServiceで環境構築資料を生成
    4. Envレコードを作成/更新して保存
    5. 生成された資料を返す

    Args:
        request: project_id を含むリクエストボディ

    Returns:
        dict: 生成結果
            - success: 成功フラグ
            - env_id: 環境レコードID
            - project_id: プロジェクトID
            - hands_on: 生成された環境構築資料（overall, devcontainer, frontend, backend）
    """
    try:
        service = EnvironmentService(db=db)
        result = service.generate_and_save_environment(request.project_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}")
def get_environment_hands_on(project_id: str, db: Session = Depends(get_db)):
    """
    プロジェクトIDを受け取り、保存されている環境構築ハンズオン資料を取得するAPI。

    Args:
        project_id: プロジェクトID（パスパラメータ）

    Returns:
        dict: 環境構築資料
            - env_id: 環境レコードID
            - project_id: プロジェクトID
            - hands_on: 環境構築ハンズオン資料（overall, devcontainer, frontend, backend）
            - created_at: 作成日時
            - updated_at: 更新日時
    """
    try:
        service = EnvironmentService(db=db)
        result = service.get_environment_by_project(project_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))