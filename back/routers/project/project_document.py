from fastapi import APIRouter, Depends, HTTPException
from datetime import date

from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from database import SessionLocal
from models.project_base import ProjectDocument

router = APIRouter()

class ProjectDocumentType(BaseModel):
    project_id: uuid.UUID
    specification_doc : str
    frame_work_doc: str
    directory_info : str

class CreateProjectDocumentResponse(BaseModel):
    project_id: uuid.UUID
    message: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        

@router.post("/project_document", summary="プロジェクトドキュメント作成")
async def create_project_document(document: ProjectDocumentType, db: Session = Depends(get_db))->CreateProjectDocumentResponse:
    db_document = ProjectDocument(
        project_id=document.project_id,
        specification_doc=document.specification_doc,
        frame_work_doc=document.frame_work_doc,
        directory_info=document.directory_info
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return {"project_id": document.project_id, "message": "プロジェクトドキュメントが作成されました"}

@router.get("/project_document/{project_id}", summary="プロジェクトドキュメント取得")
async def get_project_document(project_id: uuid.UUID, db: Session = Depends(get_db)):
    # project_idに基づいて最新のドキュメントを取得する
    db_document = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()
    if db_document is None:
        raise HTTPException(status_code=404, detail="Project document not found")
    return db_document

@router.put("/project_document/{project_id}", summary="プロジェクトドキュメント更新")
async def update_project_document(project_id: uuid.UUID, document: ProjectDocumentType, db: Session = Depends(get_db)):
    db_document = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()
    if db_document is None:
        raise HTTPException(status_code=404, detail="Project document not found")
    
    # 更新処理
    db_document.specification_doc = document.specification_doc
    db_document.frame_work_doc = document.frame_work_doc
    db_document.directory_info = document.directory_info
    db.commit()
    db.refresh(db_document)
    return {"project_id": project_id, "message": "プロジェクトドキュメントが更新されました"}

@router.delete("/project_document/{project_id}", summary="プロジェクトドキュメント削除")
async def delete_project_document(project_id: uuid.UUID, db: Session = Depends(get_db)):
    db_document = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()
    if db_document is None:
        raise HTTPException(status_code=404, detail="Project document not found")
    
    db.delete(db_document)
    db.commit()
    return {"project_id": project_id, "message": "プロジェクトドキュメントが削除されました"}