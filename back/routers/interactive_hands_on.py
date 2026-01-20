"""
interactive_hands_on.py: インタラクティブハンズオン生成 API

SSEストリーミングで段階的にハンズオンを生成し、
必要に応じて選択肢を提示する対話型エンドポイント。
"""

import json
import asyncio
from typing import Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models.project_base import Task, ProjectBase, ProjectDocument, TaskHandsOn
from services.interactive_hands_on_agent import (
    InteractiveHandsOnAgent,
    SessionState,
    GenerationPhase,
    InputPrompt,
    get_session,
    create_session,
    delete_session,
    restore_session_from_db,
)
from services.task_hands_on_service import TaskHandsOnService


router = APIRouter(prefix="/api/interactive-hands-on", tags=["InteractiveHandsOn"])


# =====================================================
# リクエスト/レスポンスモデル
# =====================================================

class StartSessionRequest(BaseModel):
    """セッション開始リクエスト"""
    config: Optional[Dict[str, Any]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "config": {
                    "model": "gemini-2.0-flash"
                }
            }
        }


class StartSessionResponse(BaseModel):
    """セッション開始レスポンス"""
    success: bool
    session_id: str
    task_id: str
    task_title: str
    message: str


class UserResponseRequest(BaseModel):
    """ユーザー応答リクエスト"""
    response_type: str  # "choice" | "input" | "skip"
    choice_id: Optional[str] = None
    selected: Optional[str] = None
    user_input: Optional[str] = None
    user_note: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "response_type": "choice",
                "choice_id": "choice_map_library_abc123",
                "selected": "mapbox",
                "user_note": "スタイリングしやすそうだから"
            }
        }


class SessionStatusResponse(BaseModel):
    """セッション状態レスポンス"""
    success: bool
    session_id: str
    task_id: str
    phase: str
    has_pending_choice: bool
    has_pending_input: bool
    generated_sections: list[str]
    user_choices: Dict[str, Any]


# =====================================================
# ヘルパー関数
# =====================================================

def _build_project_context(db: Session, project_id: UUID) -> Dict:
    """プロジェクトコンテキストを構築"""
    project = db.query(ProjectBase).filter(
        ProjectBase.project_id == project_id
    ).first()

    if not project:
        return {}

    document = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id
    ).first()

    # 技術スタックを抽出（フレームワーク情報から）
    tech_stack = []
    if document and document.frame_work_doc:
        # 簡易的な技術スタック抽出
        keywords = ["Next.js", "React", "Vue", "Angular", "FastAPI", "Django",
                   "Express", "PostgreSQL", "MySQL", "MongoDB", "Redis",
                   "Tailwind", "TypeScript", "Python", "Node.js"]
        for keyword in keywords:
            if keyword.lower() in document.frame_work_doc.lower():
                tech_stack.append(keyword)

    return {
        "project_id": str(project.project_id),
        "title": project.title,
        "idea": project.idea,
        "tech_stack": tech_stack[:10],  # 最大10個
        "framework": document.frame_work_doc[:2000] if document and document.frame_work_doc else "",
        "directory_info": document.directory_info[:2000] if document and document.directory_info else "",
        "specification": document.specification[:2000] if document and document.specification else "",
    }


async def _sse_generator(agent: InteractiveHandsOnAgent, session: SessionState):
    """SSEイベントジェネレーター"""
    try:
        async for event in agent.generate_stream(session):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"


async def _sse_response_generator(
    agent: InteractiveHandsOnAgent,
    session: SessionState,
    response_type: str,
    choice_id: Optional[str] = None,
    selected: Optional[str] = None,
    user_input: Optional[str] = None,
    user_note: Optional[str] = None
):
    """ユーザー応答後のSSEイベントジェネレーター"""
    try:
        async for event in agent.handle_user_response(
            session,
            response_type,
            choice_id,
            selected,
            user_input,
            user_note
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"


# =====================================================
# エンドポイント
# =====================================================

@router.post("/{task_id}/start")
async def start_interactive_session(
    task_id: str,
    request: StartSessionRequest = None,
    db: Session = Depends(get_db)
):
    """
    インタラクティブセッション開始

    タスクに対してインタラクティブハンズオン生成セッションを開始し、
    SSEストリームを返す。

    Returns:
        SSE stream
    """
    try:
        task_uuid = UUID(task_id)

        # タスク取得
        task = db.query(Task).filter(Task.task_id == task_uuid).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # 既存のハンズオンデータを削除（新規開始なので完全リセット）
        existing_hands_on = db.query(TaskHandsOn).filter(
            TaskHandsOn.task_id == task_uuid
        ).first()
        if existing_hands_on:
            db.delete(existing_hands_on)
            db.commit()

        # プロジェクトコンテキスト構築
        project_context = _build_project_context(db, task.project_id)

        # セッション作成（同じtask_idの古いメモリセッションも削除される）
        session = create_session(task_id)

        # エージェント作成
        config = request.config if request else {}
        agent = InteractiveHandsOnAgent(
            db=db,
            task=task,
            project_context=project_context,
            config=config
        )

        # SSEストリーミングレスポンス
        return StreamingResponse(
            _sse_generator(agent, session),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Session-Id": session.session_id,
                "Access-Control-Expose-Headers": "X-Session-Id"
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/respond")
async def respond_to_session(
    session_id: str,
    request: UserResponseRequest,
    db: Session = Depends(get_db)
):
    """
    ユーザー応答を送信

    選択肢への回答やユーザー入力を送信し、生成を継続する。

    Returns:
        SSE stream
    """
    try:
        # セッション取得
        session = get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # タスク取得
        task = db.query(Task).filter(
            Task.task_id == UUID(session.task_id)
        ).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # プロジェクトコンテキスト構築
        project_context = _build_project_context(db, task.project_id)

        # エージェント作成
        agent = InteractiveHandsOnAgent(
            db=db,
            task=task,
            project_context=project_context,
            config={}
        )

        # SSEストリーミングレスポンス
        return StreamingResponse(
            _sse_response_generator(
                agent,
                session,
                request.response_type,
                request.choice_id,
                request.selected,
                request.user_input,
                request.user_note
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/status", response_model=SessionStatusResponse)
async def get_session_status(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    セッション状態取得

    現在のセッションの状態を取得する。
    """
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionStatusResponse(
        success=True,
        session_id=session.session_id,
        task_id=session.task_id,
        phase=session.phase.value,
        has_pending_choice=session.pending_choice is not None,
        has_pending_input=session.pending_input is not None,
        generated_sections=list(session.generated_content.keys()),
        user_choices=session.user_choices
    )


@router.delete("/session/{session_id}")
async def delete_interactive_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    セッション削除

    インタラクティブセッションを削除する。
    """
    if delete_session(session_id):
        return {"success": True, "message": "Session deleted"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")


@router.get("/{task_id}/check")
async def check_hands_on_exists(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    ハンズオン存在チェック

    タスクに対してハンズオンが既に生成されているかチェックする。
    進捗情報（フェーズ、完了ステップ数、保留中の入力など）も返す。
    """
    try:
        task_uuid = UUID(task_id)

        hands_on = db.query(TaskHandsOn).filter(
            TaskHandsOn.task_id == task_uuid
        ).first()

        if hands_on:
            # 進捗情報を取得
            interactions = hands_on.user_interactions or {}
            steps_data = interactions.get("steps", [])
            completed_steps = sum(1 for s in steps_data if s.get("is_completed", False))
            total_steps = len(steps_data)

            # 保留中の入力があるかどうか
            pending_input = interactions.get("pending_input")
            has_pending_input = pending_input is not None

            # フェーズ
            phase = interactions.get("phase", "context")

            return {
                "exists": True,
                "hands_on_id": str(hands_on.hands_on_id),
                "generated_at": hands_on.generated_at.isoformat() if hands_on.generated_at else None,
                "quality_score": hands_on.quality_score,
                "generation_state": hands_on.generation_state,
                "can_resume": hands_on.generation_state not in ["completed", None],
                "progress": {
                    "phase": phase,
                    "completed_steps": completed_steps,
                    "total_steps": total_steps,
                    "has_pending_input": has_pending_input,
                    "pending_input": pending_input
                }
            }
        else:
            return {
                "exists": False,
                "hands_on_id": None,
                "generated_at": None,
                "quality_score": None,
                "generation_state": None,
                "can_resume": False,
                "progress": None
            }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID")


@router.get("/{task_id}/content")
async def get_hands_on_content(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    完了済みハンズオンの内容を取得
    """
    try:
        task_uuid = UUID(task_id)

        hands_on = db.query(TaskHandsOn).filter(
            TaskHandsOn.task_id == task_uuid
        ).first()

        if not hands_on:
            raise HTTPException(status_code=404, detail="Hands-on not found")

        interactions = hands_on.user_interactions or {}
        steps_data = interactions.get("steps", [])
        decisions_data = interactions.get("decisions", [])

        return {
            "success": True,
            "hands_on_id": str(hands_on.hands_on_id),
            "generation_state": hands_on.generation_state,
            "context": hands_on.technical_context or "",
            "overview": hands_on.overview or "",
            "steps": steps_data,
            "decisions": decisions_data,
            "verification": hands_on.verification or "",
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID")


@router.post("/{task_id}/resume")
async def resume_interactive_session(
    task_id: str,
    request: StartSessionRequest = None,
    db: Session = Depends(get_db)
):
    """
    インタラクティブセッション再開

    DBに保存された進捗からセッションを再開する。
    保留中の入力プロンプトがあれば、それを含むSSEイベントを送信する。

    Returns:
        SSE stream
    """
    try:
        task_uuid = UUID(task_id)

        # タスク取得
        task = db.query(Task).filter(Task.task_id == task_uuid).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # 既存のハンズオンを取得
        hands_on = db.query(TaskHandsOn).filter(
            TaskHandsOn.task_id == task_uuid
        ).first()

        if not hands_on:
            raise HTTPException(status_code=404, detail="No existing progress found")

        # セッションを復元
        session = restore_session_from_db(hands_on, task_id)
        if not session:
            raise HTTPException(status_code=400, detail="Failed to restore session")

        # プロジェクトコンテキスト構築
        project_context = _build_project_context(db, task.project_id)

        # エージェント作成
        config = request.config if request else {}
        agent = InteractiveHandsOnAgent(
            db=db,
            task=task,
            project_context=project_context,
            config=config
        )

        # 復元されたセッション情報を含むSSEジェネレーター
        async def _sse_resume_generator():
            # まず復元された状態を送信
            yield f"data: {json.dumps({'type': 'session_restored', 'session_id': session.session_id, 'phase': session.phase.value}, ensure_ascii=False)}\n\n"

            # 生成済みコンテンツがあれば送信（context）
            if session.generated_content.get("context"):
                yield f"data: {json.dumps({'type': 'restored_content', 'section': 'context', 'content': session.generated_content['context']}, ensure_ascii=False)}\n\n"

            # 生成済みコンテンツがあれば送信（overview）
            if session.generated_content.get("overview"):
                yield f"data: {json.dumps({'type': 'restored_content', 'section': 'overview', 'content': session.generated_content['overview']}, ensure_ascii=False)}\n\n"

            # ユーザーの選択履歴を送信
            if session.user_choices:
                for choice_id, choice_data in session.user_choices.items():
                    yield f"data: {json.dumps({'type': 'restored_user_response', 'response_type': 'choice', 'display_text': choice_data.get('selected', '')}, ensure_ascii=False)}\n\n"

            # 各ステップの完全なコンテンツを送信
            if session.implementation_steps:
                # まずステップ一覧（メタ情報）を送信
                steps_info = [
                    {
                        "step_number": s.step_number,
                        "title": s.title,
                        "description": s.description,
                        "is_completed": s.is_completed,
                    }
                    for s in session.implementation_steps
                ]
                yield f"data: {json.dumps({'type': 'restored_steps', 'steps': steps_info, 'current_step': session.current_step_index}, ensure_ascii=False)}\n\n"

                # 各完了ステップの完全なコンテンツを送信
                for step in session.implementation_steps:
                    if step.content:
                        yield f"data: {json.dumps({'type': 'restored_content', 'section': f'step_{step.step_number}', 'content': step.content}, ensure_ascii=False)}\n\n"
                        # ステップ完了していればユーザー応答も復元
                        if step.is_completed and step.user_feedback:
                            feedback_text = "できた" if step.user_feedback == "completed" else ("スキップ" if step.user_feedback == "skipped" else step.user_feedback)
                            yield f"data: {json.dumps({'type': 'restored_user_response', 'response_type': 'step_confirmation', 'display_text': feedback_text}, ensure_ascii=False)}\n\n"

            # 決定事項を送信
            if session.decisions:
                decisions_info = [
                    {"step_number": d.step_number, "description": d.description}
                    for d in session.decisions
                ]
                yield f"data: {json.dumps({'type': 'restored_decisions', 'decisions': decisions_info}, ensure_ascii=False)}\n\n"

            # 保留中の入力プロンプトがあれば送信（復元されたものをそのまま使う）
            if session.pending_input:
                if session.pending_input.options:
                    # ステップ確認系（ボタン選択）
                    yield f"data: {json.dumps({'type': 'step_confirmation_required', 'prompt': {'prompt_id': session.pending_input.prompt_id, 'question': session.pending_input.question, 'options': session.pending_input.options}}, ensure_ascii=False)}\n\n"
                else:
                    # テキスト入力
                    yield f"data: {json.dumps({'type': 'user_input_required', 'prompt': {'prompt_id': session.pending_input.prompt_id, 'question': session.pending_input.question, 'placeholder': session.pending_input.placeholder}}, ensure_ascii=False)}\n\n"
            elif session.pending_choice:
                # 保留中の選択肢があれば送信
                yield f"data: {json.dumps({'type': 'choice_required', 'choice': {'choice_id': session.pending_choice.choice_id, 'question': session.pending_choice.question, 'options': [{'id': opt.id, 'label': opt.label, 'description': opt.description, 'pros': opt.pros, 'cons': opt.cons} for opt in session.pending_choice.options], 'allow_custom': session.pending_choice.allow_custom, 'skip_allowed': session.pending_choice.skip_allowed, 'research_hint': session.pending_choice.research_hint}}, ensure_ascii=False)}\n\n"
            # 保留中のものがなければ何もしない（完了済みか異常状態）

        # SSEストリーミングレスポンス
        return StreamingResponse(
            _sse_resume_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Session-Id": session.session_id,
                "Access-Control-Expose-Headers": "X-Session-Id"
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
