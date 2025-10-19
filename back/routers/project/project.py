from fastapi import APIRouter, Depends, HTTPException
from datetime import date,datetime
from typing import Optional

from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from database import SessionLocal
from models.project_base import ProjectBase, ProjectMember

router = APIRouter()
    
class ProjectBaseType(BaseModel):
    title:str
    idea: str
    start_date: date
    end_date: datetime

class ProjectPatch(BaseModel):
    title: Optional[str] = None
    idea: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[datetime] = None

from database import get_db
        
@router.post("/project", summary="プロジェクト作成")
async def create_project(project: ProjectBaseType, db: Session = Depends(get_db)):
    project_id = str(uuid.uuid4())
    db_project = ProjectBase(
        title=project.title,
        project_id=project_id,
        idea=project.idea,
        start_date=project.start_date,
        end_date=project.end_date,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return {"project_id": project_id, "message": "プロジェクトが作成されました"}

# プロジェクトIDからプロジェクトを取得
@router.get("/project/{project_id}", summary="プロジェクト取得")
async def get_project(project_id: uuid.UUID, db: Session = Depends(get_db)):
    db_project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project
@router.put("/project/{project_id}", summary="プロジェクト更新")
async def update_project(project_id: str, project: ProjectBaseType, db: Session = Depends(get_db)):
    db_project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 更新処理
    db_project.title = project.title
    db_project.idea = project.idea
    db_project.start_date = project.start_date
    db_project.end_date = project.end_date
    db.commit()
    db.refresh(db_project)
    return {"message": "プロジェクトが更新されました"}

@router.delete("/project/{project_id}", summary="プロジェクト削除")
async def delete_project(project_id: uuid.UUID, db: Session = Depends(get_db)):
    db_project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(db_project)
    db.commit()
    
    return {"message": "プロジェクトが削除されました"}

@router.get("/projectsAll", summary="全プロジェクト取得（フェーズ情報含む）")
async def get_all_projects(db: Session = Depends(get_db)):
    db_projects = db.query(ProjectBase).all()
    if not db_projects:
        raise HTTPException(status_code=404, detail="No projects found")

    # フェーズ情報を含めた結果を返す
    result = []
    for project in db_projects:
        result.append({
            "project_id": str(project.project_id),
            "title": project.title,
            "idea": project.idea,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "end_date": project.end_date.isoformat() if project.end_date else None,
            "current_phase": project.current_phase,
            "phase_updated_at": project.phase_updated_at.isoformat() if project.phase_updated_at else None,
            "phase_progress_percentage": _calculate_phase_progress(project.current_phase)
        })

    return result

def _calculate_phase_progress(phase: str) -> int:
    """フェーズから進行率を計算"""
    phase_order = {
        "initial": 0,
        "qa_editing": 14,
        "summary_review": 28,
        "function_review": 42,
        "framework_selection": 57,
        "function_structuring": 71,
        "task_management": 100
    }
    return phase_order.get(phase, 0)

@router.get("/projects/member/{member_id}", summary="メンバーが参加しているプロジェクト一覧")
async def get_projects_by_member(member_id: uuid.UUID, db: Session = Depends(get_db)):
    """指定されたメンバーが参加しているプロジェクトを取得"""
    # ProjectMemberテーブルから該当するproject_idを取得
    project_members = db.query(ProjectMember).filter(
        ProjectMember.member_id == member_id
    ).all()

    project_ids = [pm.project_id for pm in project_members]

    if not project_ids:
        return []

    # プロジェクト情報を取得
    projects = db.query(ProjectBase).filter(
        ProjectBase.project_id.in_(project_ids)
    ).all()

    result = []
    for project in projects:
        result.append({
            "project_id": str(project.project_id),
            "title": project.title,
            "idea": project.idea,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "end_date": project.end_date.isoformat() if project.end_date else None,
            "current_phase": project.current_phase,
            "phase_updated_at": project.phase_updated_at.isoformat() if project.phase_updated_at else None,
            "phase_progress_percentage": _calculate_phase_progress(project.current_phase)
        })

    return result

@router.patch("/project/{project_id}", summary="プロジェクト部分更新")
async def patch_project(project_id: str, project: ProjectPatch, db: Session = Depends(get_db)):
    db_project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = project.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_project, key, value)
    
    db.commit()
    db.refresh(db_project)
    return {"message": "Project partially updated successfully"}
