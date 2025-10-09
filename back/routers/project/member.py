from fastapi import APIRouter, Depends, HTTPException
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from database import get_db
from models.project_base import MemberBase

router = APIRouter()


class MemberType(BaseModel):
    member_name: str
    member_skill: str
    github_name: str
    email: Optional[str] = None

class MemberPatch(BaseModel):
    member_name: Optional[str] = None
    member_skill: Optional[str] = None
    github_name: Optional[str] = None
    email: Optional[str] = None
    


@router.post("/member", summary="プロジェクト作成")
async def create_member(member: MemberType, db: Session = Depends(get_db)):
    member_id = str(uuid.uuid4())
    db_member = MemberBase(
        member_id=member_id,
        member_name=member.member_name,
        member_skill=member.member_skill,
        github_name=member.github_name,
        email=member.email
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return {"member_id": member_id, "message": "メンバーが作成されました"}

# usernameからメンバーを取得
@router.get("/member/github/{github_name}", summary="メンバー取得")
async def get_member(github_name: str, db: Session = Depends(get_db)):
    db_member = db.query(MemberBase).filter(MemberBase.github_name == github_name).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return db_member

@router.put("/member/github/{github_name}", summary="メンバー更新")
async def update_member(github_name: str, member: MemberType, db: Session = Depends(get_db)):
    db_member = db.query(MemberBase).filter(MemberBase.github_name == github_name).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # 更新処理
    db_member.member_name = member.member_name
    db_member.member_skill = member.member_skill
    db_member.email = member.email
    db.commit()
    db.refresh(db_member)
    return {"message": "Member updated successfully"}


@router.delete("/member/github/{github_name}", summary="メンバー削除")
async def delete_member(github_name: str, db: Session = Depends(get_db)):
    db_member = db.query(MemberBase).filter(MemberBase.github_name == github_name).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    
    db.delete(db_member)
    db.commit()
    return {"message": "Member deleted successfully"}

@router.get("/members", summary="全メンバー一覧取得")
async def list_members(db: Session = Depends(get_db)):
    members = db.query(MemberBase).all()
    return [{"member_id": m.member_id, "member_name": m.member_name, "github_name": m.github_name} for m in members]


# member_id (UUID) を使用したCRUD操作
@router.get("/member/id/{member_id}", summary="メンバーをIDで取得")
async def get_member_by_id(member_id: uuid.UUID, db: Session = Depends(get_db)):
    db_member = db.query(MemberBase).filter(MemberBase.member_id == member_id).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return db_member

@router.put("/member/id/{member_id}", summary="メンバーをIDで更新")
async def update_member_by_id(member_id: uuid.UUID, member: MemberType, db: Session = Depends(get_db)):
    db_member = db.query(MemberBase).filter(MemberBase.member_id == member_id).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    
    db_member.member_name = member.member_name
    db_member.member_skill = member.member_skill
    db_member.github_name = member.github_name
    db_member.email = member.email
    db.commit()
    db.refresh(db_member)
    return {"message": "Member updated successfully"}

@router.delete("/member/id/{member_id}", summary="メンバーをIDで削除")
async def delete_member_by_id(member_id: uuid.UUID, db: Session = Depends(get_db)):
    db_member = db.query(MemberBase).filter(MemberBase.member_id == member_id).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    
    db.delete(db_member)
    db.commit()
    return {"message": "Member deleted successfully"}

@router.patch("/member/id/{member_id}", summary="メンバーをIDで部分更新")
async def patch_member_by_id(member_id: uuid.UUID, member: MemberPatch, db: Session = Depends(get_db)):
    db_member = db.query(MemberBase).filter(MemberBase.member_id == member_id).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    
    update_data = member.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_member, key, value)
    
    db.commit()
    db.refresh(db_member)
    return {"message": "Member partially updated successfully"}
