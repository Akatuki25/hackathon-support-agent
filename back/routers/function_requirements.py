from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from services.function import FunctionService
from typing import Union, List, Dict, Any, Optional
import uuid

router = APIRouter()


class ProjectIdRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    confidence_threshold: Optional[float] = Field(default=0.7, description="Confidence threshold for QA generation")


class RequirementsSaveRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    requirements: List[Dict[str, Any]]


class QASaveRequest(BaseModel):
    questions: List[Dict[str, Any]]


@router.post("/generate")
def generate_functional_requirements(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    プロジェクトIDから機能要件を生成し、確信度が低い項目についてはQAを生成する

    Args:
        project_id: プロジェクトID
        confidence_threshold: QA生成の閾値（デフォルト: 0.7）

    Returns:
        機能要件のリストと明確化質問
    """
    function_service = FunctionService(db=db)

    try:
        # project_idをUUIDに変換
        if isinstance(request.project_id, str):
            project_id = request.project_id  # サービス内で変換処理
        else:
            project_id = str(request.project_id)

        result = function_service.generate_functional_requirements(
            project_id=project_id,
            confidence_threshold=request.confidence_threshold
        )

        return {
            "message": "Functional requirements generated successfully",
            "requirements": result["requirements"],
            "overall_confidence": result["overall_confidence"],
            "clarification_questions": result["clarification_questions"],
            "low_confidence_count": result["low_confidence_count"]
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/save-requirements")
def save_functional_requirements(request: RequirementsSaveRequest, db: Session = Depends(get_db)):
    """
    生成された機能要件をプロジェクトドキュメントに保存する

    Args:
        project_id: プロジェクトID
        requirements: 機能要件のリスト

    Returns:
        保存完了メッセージ
    """
    function_service = FunctionService(db=db)

    try:
        # project_idをUUIDに変換
        if isinstance(request.project_id, str):
            project_id = request.project_id
        else:
            project_id = str(request.project_id)

        project_doc = function_service.save_functional_requirements_to_document(
            project_id=project_id,
            requirements=request.requirements
        )

        return {
            "message": "Functional requirements saved successfully",
            "doc_id": str(project_doc.doc_id),
            "requirements_count": len(request.requirements)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save functional requirements: {str(e)}")


@router.post("/save-questions")
def save_clarification_questions(request: QASaveRequest, db: Session = Depends(get_db)):
    """
    明確化質問をDBに保存する

    Args:
        questions: 質問のリスト

    Returns:
        保存完了メッセージ
    """
    function_service = FunctionService(db=db)

    try:
        result = function_service.save_clarification_questions(request.questions)

        return {
            "message": result["message"],
            "questions_count": len(request.questions)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save clarification questions: {str(e)}")


@router.post("/generate-and-save")
def generate_and_save_all(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    機能要件生成から保存まで一括で実行し、必要に応じてQAも保存する

    Args:
        project_id: プロジェクトID
        confidence_threshold: QA生成の閾値

    Returns:
        実行結果の詳細
    """
    function_service = FunctionService(db=db)

    try:
        # project_idをUUIDに変換
        if isinstance(request.project_id, str):
            project_id = request.project_id
        else:
            project_id = str(request.project_id)

        # 1. 機能要件生成
        generation_result = function_service.generate_functional_requirements(
            project_id=project_id,
            confidence_threshold=request.confidence_threshold
        )

        # 2. 機能要件をドキュメントに保存
        project_doc = function_service.save_functional_requirements_to_document(
            project_id=project_id,
            requirements=generation_result["requirements"]
        )

        # 3. 明確化質問がある場合は保存
        qa_result = None
        if generation_result["clarification_questions"]:
            qa_result = function_service.save_clarification_questions(
                generation_result["clarification_questions"]
            )

        return {
            "message": "Functional requirements generation and saving completed successfully",
            "doc_id": str(project_doc.doc_id),
            "requirements": generation_result["requirements"],
            "requirements_count": len(generation_result["requirements"]),
            "overall_confidence": generation_result["overall_confidence"],
            "low_confidence_count": generation_result["low_confidence_count"],
            "clarification_questions": generation_result["clarification_questions"],
            "questions_saved": len(generation_result["clarification_questions"]) if generation_result["clarification_questions"] else 0,
            "qa_save_result": qa_result
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/regenerate")
def regenerate_functional_requirements(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    既存のプロジェクトの機能要件を再生成する

    Args:
        project_id: プロジェクトID
        confidence_threshold: QA生成の閾値

    Returns:
        再生成された機能要件と明確化質問
    """
    function_service = FunctionService(db=db)

    try:
        # project_idをUUIDに変換
        if isinstance(request.project_id, str):
            project_id = request.project_id
        else:
            project_id = str(request.project_id)

        # 機能要件を再生成
        result = function_service.generate_functional_requirements(
            project_id=project_id,
            confidence_threshold=request.confidence_threshold
        )

        # 自動的に保存する
        function_service.save_functional_requirements_to_document(
            project_id=project_id,
            requirements=result["requirements"]
        )

        # 明確化質問がある場合は保存
        if result["clarification_questions"]:
            function_service.save_clarification_questions(
                result["clarification_questions"]
            )

        return {
            "message": "Functional requirements regenerated successfully",
            "requirements": result["requirements"],
            "overall_confidence": result["overall_confidence"],
            "clarification_questions": result["clarification_questions"],
            "low_confidence_count": result["low_confidence_count"]
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/requirements/{project_id}")
def get_functional_requirements(project_id: str, db: Session = Depends(get_db)):
    """
    プロジェクトIDに基づいて保存済みの機能要件を取得する

    Args:
        project_id: プロジェクトID

    Returns:
        保存済みの機能要件ドキュメント
    """
    from models.project_base import ProjectDocument

    try:
        # project_idをUUIDに変換
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id

        project_doc = db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc:
            raise HTTPException(status_code=404, detail="Project document not found")

        return {
            "doc_id": str(project_doc.doc_id),
            "project_id": str(project_doc.project_id),
            "function_doc": project_doc.function_doc,
            "has_requirements": bool(project_doc.function_doc and project_doc.function_doc.strip())
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project_id format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/confidence-feedback")
def get_confidence_feedback(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    機能要件書とQ&Aから確信度フィードバックを生成する
    """
    function_service = FunctionService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id_str = request.project_id
        else:
            project_id_str = str(request.project_id)

        result = function_service.generate_confidence_feedback(project_id_str)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/stream/{project_id}", summary="機能要件のストリーミング生成 (SSE)")
async def stream_functional_requirements(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    機能要件をServer-Sent Events形式でストリーミング生成する。

    テキストチャンクが生成されるたびにSSEイベントとして送信されるため、
    クライアントは最初のトークンが生成された瞬間からUIに表示可能。

    ## SSEイベント形式:
    - `event: start` - ストリーム開始 `{"ok": true, "project_id": "..."}`
    - `event: chunk` - テキストチャンク `{"text": "..."}`
    - `event: doc_done` - 機能要件書完了 `{"doc_id": "...", "function_doc": "..."}`
    - `event: questions` - 追加質問 `{"questions": [...]}`
    - `event: done` - 完了 `{"ok": true}`
    - `event: error` - エラー `{"message": "..."}`

    ## クライアント実装例 (JavaScript):
    ```javascript
    const response = await fetch('/api/function_requirements/stream/{project_id}', {method: 'POST'});
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        // SSEイベントをパースして処理
    }
    ```
    """
    service = FunctionService(db=db)

    return StreamingResponse(
        service.stream_functional_requirements(str(project_id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx buffering無効化
        },
    )