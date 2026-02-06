from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.project import SummaryService, MVPJudgeService
from typing import Union, List
from models.project_base import ProjectDocument
import uuid

router = APIRouter()

class ProjectIdRequest(BaseModel):
    project_id: Union[str, uuid.UUID]

class SummaryRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    summary: str

class QAAnswer(BaseModel):
    qa_id: Union[str, uuid.UUID]
    answer: str

class QAUpdateRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    qa_answers: List[QAAnswer]

@router.post("/")
async def generate_summary(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    Q&Aリストから要約を生成・保存し、評価を実行する
    非同期版に最適化
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id_str = request.project_id
        else:
            project_id_str = str(request.project_id)

        result = await summary_service.generate_summary(project_id=project_id_str)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/generate-with-feedback")
async def generate_summary_with_feedback(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    Q&Aリストから要約を生成・保存し、確信度フィードバックも同時に返す
    非同期版に最適化
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id_str = request.project_id
        else:
            project_id_str = str(request.project_id)

        result = await summary_service.generate_summary_with_feedback(project_id_str)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/stream/{project_id}", summary="仕様書のストリーミング生成 (SSE)")
async def stream_summary_with_feedback(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    仕様書をServer-Sent Events形式でストリーミング生成する。

    テキストチャンクが生成されるたびにSSEイベントとして送信されるため、
    クライアントは最初のトークンが生成された瞬間からUIに表示可能。

    ## SSEイベント形式:
    - `event: start` - ストリーム開始 `{"ok": true, "project_id": "..."}`
    - `event: chunk` - テキストチャンク `{"text": "..."}`
    - `event: spec_done` - 仕様書完了 `{"doc_id": "...", "summary": "..."}`
    - `event: feedback` - フィードバック `{summary, strengths, missing_info, suggestions}`
    - `event: done` - 完了 `{"ok": true}`
    - `event: error` - エラー `{"message": "..."}`

    ## クライアント実装例 (JavaScript):
    ```javascript
    const response = await fetch('/api/summary/stream/{project_id}', {method: 'POST'});
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
    service = SummaryService(db=db)

    return StreamingResponse(
        service.stream_summary_with_feedback(str(project_id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx buffering無効化
        },
    )

@router.post("/save")
def save_summary(request: SummaryRequest, db: Session = Depends(get_db)):
    """
    指定された要約をプロジェクトドキュメントに保存する
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id = uuid.UUID(request.project_id)
        else:
            project_id = request.project_id
            
        project_doc = summary_service.save_summary_to_project_document(project_id, request.summary)
        return {
            "message": "Summary saved successfully",
            "doc_id": str(project_doc.doc_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save summary: {str(e)}")

@router.post("/evaluate")
async def evaluate_summary(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    既存の要約を評価する
    """
    project_id = request.project_id
    document = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()
    judge_service = MVPJudgeService(db=db)
    if not document or not document.specification:
        raise HTTPException(status_code=404, detail="No summary found for the given project_id")

    result = await judge_service.main(requirements_text=document.specification, project_id=project_id)

    # フロントエンドが期待する形式にレスポンスを変換
    return {
        "mvp_feasible": result["judge"]["mvp_feasible"],
        "score_0_100": result["judge"]["score_0_100"],
        "confidence": result["judge"]["confidence"],
        "qa": result["qa"]
    }

@router.post("/update-qa-and-regenerate")
def update_qa_and_regenerate(request: QAUpdateRequest, db: Session = Depends(get_db)):
    """
    Q&Aの回答を更新し、要約を再生成・保存して再評価する
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id = uuid.UUID(request.project_id)
        else:
            project_id = request.project_id
            
        # QAUpdateをdictのリストに変換
        qa_updates = [
            {
                "qa_id": qa_answer.qa_id,
                "answer": qa_answer.answer
            }
            for qa_answer in request.qa_answers
        ]
        
        result = summary_service.update_qa_answers_and_regenerate(project_id, qa_updates)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/confidence-feedback")
async def get_confidence_feedback(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    仕様書とQ&Aから確信度フィードバックを生成する
    非同期版に最適化
    """
    summary_service = SummaryService(db=db)
    try:
        if isinstance(request.project_id, str):
            project_id_str = request.project_id
        else:
            project_id_str = str(request.project_id)

        # プロジェクトIDの検証
        try:
            uuid.UUID(project_id_str)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid project_id format: {project_id_str}")

        result = await summary_service.generate_confidence_feedback(project_id_str)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        import traceback
        error_detail = f"Internal server error: {str(e)}\nTraceback: {traceback.format_exc()}"
        print(error_detail)  # サーバーログに出力
        raise HTTPException(status_code=500, detail=str(e))

