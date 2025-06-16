from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from database import SessionLocal
from models.project_base import ProjectBase, MemberBase, ProjectMember

router = APIRouter()


class MemberType(BaseModel):
    member_name: str
    member_skill: str
    github_name: str

# DBセッション取得用 dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
@router.post("/member", summary="プロジェクト作成")
async def create_member(member: MemberType, db: Session = Depends(get_db)):
    member_id = str(uuid.uuid4())
    db_member = MemberBase(
        member_id=member_id,
        member_name=member.member_name,
        member_skill=member.member_skill,
        github_name=member.github_name
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return {"member_id": member_id, "message": "メンバーが作成されました"}

# usernameからメンバーを取得
@router.get("/member/{github_name}", summary="メンバー取得")
async def get_member(github_name: str, db: Session = Depends(get_db)):
    db_member = db.query(MemberBase).filter(MemberBase.github_name == github_name).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return db_member

@router.put("/member/{github_name}", summary="メンバー更新")
async def update_member(github_name: str, member: MemberType, db: Session = Depends(get_db)):
    db_member = db.query(MemberBase).filter(MemberBase.github_name == github_name).first()
    if db_member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # 更新処理
    db_member.member_name = member.member_name
    db_member.member_skill = member.member_skill
    db.commit()
    db.refresh(db_member)
    return {"message": "Member updated successfully"}


@router.delete("/member/{github_name}", summary="メンバー削除")
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