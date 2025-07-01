from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from database import SessionLocal
from models.project_base import ProjectMember

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        

class ProjectMemberType(BaseModel):
    project_member_id :str 
    project_id: uuid.UUID
    member_id : uuid.UUID
    menber_name : str
    

class CreateProjectMemberResponse(BaseModel):
    member_id: uuid.UUID
    message: str
    
@router.post("/project_member", summary="プロジェクトメンバー作成")
async def create_project_member(member: ProjectMemberType, db: Session = Depends(get_db)) -> CreateProjectMemberResponse:
    db_member = ProjectMember(
        member_id=member.member_id,
        member_name=member.member_name,
        member_skill=member.member_skill,
        github_name=member.github_name
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return {"member_id": member.member_id, "message": "プロジェクトメンバーが作成されました"}

@router.get("/project_member/{project_id}", summary="プロジェクトメンバー取得")
async def get_project_member(project_id: uuid.UUID, db: Session = Depends(get_db)):
    db_members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    if not db_members:
        raise HTTPException(status_code=404, detail="Project members not found")
    return db_members

@router.put("/project_member/{project_member_id}", summary="プロジェクトメンバー更新")
async def update_project_member(project_member_id: str, member: ProjectMemberType, db: Session = Depends(get_db)):
    db_member = db.query(ProjectMember).filter(ProjectMember.project_member_id == project_member_id).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Project member not found")
    
    # 更新処理
    db_member.member_name = member.menber_name
    db_member.member_skill = member.member_skill
    db_member.github_name = member.github_name
    db.commit()
    db.refresh(db_member)
    return {"project_member_id": project_member_id, "message": "プロジェクトメンバーが更新されました"}

@router.delete("/project_member/{project_member_id}", summary="プロジェクトメンバー削除")
async def delete_project_member(project_member_id: str, db: Session = Depends(get_db)):
    db_member = db.query(ProjectMember).filter(ProjectMember.project_member_id == project_member_id).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Project member not found")
    
    db.delete(db_member)
    db.commit()
    return {"project_member_id": project_member_id, "message": "プロジェクトメンバーが削除されました"}