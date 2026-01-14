from fastapi import APIRouter, Depends, HTTPException
from datetime import date, datetime
from typing import Optional, List
from enum import IntEnum

from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel, field_validator, model_validator
from models.project_base import ProjectBase, ProjectMember, MemberBase, ProjectDocument, QA, Task, StructuredFunction


class ProjectStep(IntEnum):
    """プロジェクトの進捗ステップ（次に行くべきページ）"""
    HACK_QA = 1          # QA回答中 → hackQA
    SUMMARY_QA = 2       # 仕様書生成 → summaryQA
    FUNCTION_SUMMARY = 3 # 機能要件生成 → functionSummary
    SELECT_FRAMEWORK = 4 # 技術選定 → selectFramework
    FUNCTION_STRUCTURING = 5  # 機能構造化 → functionStructuring
    TASK_FLOW = 6        # 完了 → タスクフロー

router = APIRouter()
    
class ProjectBaseType(BaseModel):
    title: str
    idea: str
    start_date: date
    end_date: datetime
    creator_member_id: Optional[str] = None  # プロジェクト作成者のmember_id
    
    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('プロジェクトタイトルは必須です')
        return v.strip()
    
    @field_validator('idea')
    @classmethod
    def validate_idea(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('プロジェクトアイディアは必須です')
        return v.strip()
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v: datetime) -> datetime:
        now = datetime.now()
        if v <= now:
            raise ValueError('終了日時は現在より未来の日時を設定してください')
        return v
    
    @model_validator(mode='after')
    def validate_date_relationship(self):
        # start_dateとend_dateの関係性チェック
        start_datetime = datetime.combine(self.start_date, datetime.min.time())
        if self.end_date < start_datetime:
            raise ValueError('終了日時は開始日時より後である必要があります')
        return self

class ProjectPatch(BaseModel):
    title: Optional[str] = None
    idea: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[datetime] = None
    
    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (not v or not v.strip()):
            raise ValueError('プロジェクトタイトルは必須です')
        return v.strip() if v else v
    
    @field_validator('idea')
    @classmethod
    def validate_idea(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (not v or not v.strip()):
            raise ValueError('プロジェクトアイディアは必須です')
        return v.strip() if v else v
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None:
            now = datetime.now()
            if v <= now:
                raise ValueError('終了日時は現在より未来の日時を設定してください')
        return v

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
    
    # 作成者をプロジェクトメンバーとして登録（同一トランザクション）
    if project.creator_member_id:
        # メンバーの存在確認
        member = db.query(MemberBase).filter(
            MemberBase.member_id == project.creator_member_id
        ).first()
        
        if member:
            db_project_member = ProjectMember(
                project_member_id=uuid.uuid4(),
                project_id=project_id,
                member_id=member.member_id,
                member_name=member.member_name,
            )
            db.add(db_project_member)
    
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

@router.get("/projectsAll", summary="全プロジェクト取得")
async def get_all_projects(db: Session = Depends(get_db)):  
    db_projects = db.query(ProjectBase).all()
    if not db_projects:
        raise HTTPException(status_code=404, detail="No projects found")
    
    return db_projects

@router.patch("/project/{project_id}", summary="プロジェクト部分更新")
async def patch_project(project_id: str, project: ProjectPatch, db: Session = Depends(get_db)):
    db_project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = project.model_dump(exclude_unset=True)

    # 日付の関係性チェック（start_dateまたはend_dateが更新される場合）
    final_start_date = update_data.get('start_date', db_project.start_date)
    final_end_date = update_data.get('end_date', db_project.end_date)

    if final_end_date:
        # 終了日時が現在より未来かチェック
        now = datetime.now()
        if final_end_date <= now:
            raise HTTPException(
                status_code=400,
                detail='終了日時は現在より未来の日時を設定してください'
            )

        # 開始日と終了日の関係性チェック
        start_datetime = datetime.combine(
            final_start_date,
            datetime.min.time()
        )
        if final_end_date < start_datetime:
            raise HTTPException(
                status_code=400,
                detail='終了日時は開始日時より後である必要があります'
            )

    for key, value in update_data.items():
        setattr(db_project, key, value)

    db.commit()
    db.refresh(db_project)
    return {"message": "Project partially updated successfully"}


@router.get("/project/{project_id}/progress", summary="プロジェクト進捗取得")
async def get_project_progress(project_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    プロジェクトの現在の進捗ステップを取得。
    逆順で最大の進捗を判定し、次に行くべきステップを返す。
    """
    # プロジェクト存在確認
    db_project = db.query(ProjectBase).filter(ProjectBase.project_id == project_id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # 逆順で判定（最大の進捗を探す）

    # タスクがあるか
    has_tasks = db.query(Task).filter(Task.project_id == project_id).first() is not None
    if has_tasks:
        return {"step": ProjectStep.TASK_FLOW, "step_name": "task_flow"}

    # StructuredFunctionsがあるか
    has_functions = db.query(StructuredFunction).filter(StructuredFunction.project_id == project_id).first() is not None
    if has_functions:
        return {"step": ProjectStep.TASK_FLOW, "step_name": "task_flow"}

    # ProjectDocumentを取得
    doc = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()

    # frame_work_docがあるか
    if doc and doc.frame_work_doc and doc.frame_work_doc.strip():
        return {"step": ProjectStep.FUNCTION_STRUCTURING, "step_name": "function_structuring"}

    # function_docがあるか
    if doc and doc.function_doc and doc.function_doc.strip():
        return {"step": ProjectStep.SELECT_FRAMEWORK, "step_name": "select_framework"}

    # specificationがあるか
    if doc and doc.specification and doc.specification.strip():
        return {"step": ProjectStep.FUNCTION_SUMMARY, "step_name": "function_summary"}

    # QAがあるか（specificationなしでQAあり = 回答中）
    has_qa = db.query(QA).filter(QA.project_id == project_id).first() is not None
    if has_qa:
        return {"step": ProjectStep.SUMMARY_QA, "step_name": "summary_qa"}

    # 何もない場合はhackQA（QA生成/回答）
    return {"step": ProjectStep.HACK_QA, "step_name": "hack_qa"}
