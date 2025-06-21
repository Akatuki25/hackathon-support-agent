from fastapi import APIRouter, Depends, HTTPException
from datetime import date

from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from database import SessionLocal
from models.project_base import ProjectBase

router = APIRouter()
    
class ProjectBaseType(BaseModel):
    idea: str
    start_date: date
    end_date: date
    num_people: int

# DBセッション取得用 dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
@router.post("/project", summary="プロジェクト作成")
async def create_project(project: ProjectBaseType, db: Session = Depends(get_db)):
    project_id = str(uuid.uuid4())
    db_project = ProjectBase(
        project_id=project_id,
        idea=project.idea,
        start_date=project.start_date,
        end_date=project.end_date,
        num_people=project.num_people
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return {"project_id": project_id, "message": "プロジェクトが作成されました"}

# プロジェクトIDからプロジェクトを取得
@router.get("/project/{project_id}", summary="プロジェクト取得")
async def get_project(project_id: str, db: Session = Depends(get_db)):
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
    db_project.idea = project.idea
    db_project.duration = project.duration
    db_project.num_people = project.num_people
    db.commit()
    
    return {"message": "プロジェクトが更新されました"}

@router.delete("/project/{project_id}", summary="プロジェクト削除")
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    db_project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(db_project)
    db.commit()
    
    return {"message": "プロジェクトが削除されました"}