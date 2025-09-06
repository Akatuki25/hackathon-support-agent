from fastapi import APIRouter, Depends, HTTPException
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from database import SessionLocal
from models.project_base import ProjectMember

router = APIRouter()



class ProjectMemberType(BaseModel):
    project_id: uuid.UUID
    member_id: uuid.UUID
    member_name:str

class ProjectMemberPatch(BaseModel):
    project_id: Optional[uuid.UUID] = None
    member_id: Optional[uuid.UUID] = None
    member_name: Optional[str] = None

# DBセッション取得用 dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
@router.post("/project_member", summary="プロジェクトメンバー作成")
async def create_project_member(project_member: ProjectMemberType, db: Session = Depends(get_db)):
    project_member_id = str(uuid.uuid4())
    db_project_member = ProjectMember(
        project_member_id=project_member_id,
        project_id=project_member.project_id,
        member_id=project_member.member_id,
        member_name=project_member.member_name
    )
    db.add(db_project_member)
    db.commit()
    db.refresh(db_project_member)
    return {"project_member_id": project_member_id, "message": "プロジェクトメンバーが作成されました"}

@router.get("/project_member/{project_member_id}", summary="プロジェクトメンバー取得")
async def get_project_member(project_member_id: uuid.UUID, db: Session = Depends(get_db)):
    db_project_member = db.query(ProjectMember).filter(ProjectMember.project_member_id == project_member_id).first()
    if db_project_member is None:
        raise HTTPException(status_code=404, detail="Project member not found")
    return db_project_member

# プロジェクトIDからプロジェクトメンバーを取得する
@router.get("/project_member/project/{project_id}", summary="プロジェクトIDからプロジェクトメンバー取得")
async def get_project_members_by_project_id(project_id: uuid.UUID, db: Session = Depends(get_db)):
    db_project_members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    if not db_project_members:
        raise HTTPException(status_code=404, detail="Project members not found")
    return db_project_members

@router.put("/project_member/{project_member_id}", summary="プロジェクトメンバー更新")
async def update_project_member(project_member_id: uuid.UUID, project_member: ProjectMemberType, db: Session = Depends(get_db)):
    db_project_member = db.query(ProjectMember).filter(ProjectMember.project_member_id == project_member_id).first()
    if db_project_member is None:
        raise HTTPException(status_code=404, detail="Project member not found")
    
    # 更新処理
    db_project_member.member_name = project_member.member_name
    db.commit()
    db.refresh(db_project_member)
    return {"message": "プロジェクトメンバーが更新されました"}

@router.delete("/project_member/{project_member_id}", summary="プロジェクトメンバー削除")
async def delete_project_member(project_member_id: uuid.UUID, db: Session = Depends(get_db)):
    db_project_member = db.query(ProjectMember).filter(ProjectMember.project_member_id == project_member_id).first()
    if db_project_member is None:
        raise HTTPException(status_code=404, detail="Project member not found")
    
    db.delete(db_project_member)
    db.commit()
    
    return {"message": "プロジェクトメンバーが削除されました"}

@router.patch("/project_member/{project_member_id}", summary="プロジェクトメンバー部分更新")
async def patch_project_member(project_member_id: uuid.UUID, project_member: ProjectMemberPatch, db: Session = Depends(get_db)):
    db_project_member = db.query(ProjectMember).filter(ProjectMember.project_member_id == project_member_id).first()
    if db_project_member is None:
        raise HTTPException(status_code=404, detail="Project member not found")
    
    update_data = project_member.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_project_member, key, value)
    
    db.commit()
    db.refresh(db_project_member)
    return {"message": "Project member partially updated successfully"}