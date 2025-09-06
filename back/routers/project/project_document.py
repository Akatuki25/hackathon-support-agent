from fastapi import APIRouter, Depends, HTTPException
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from database import SessionLocal
from models.project_base import ProjectDocument
from database import get_db
router = APIRouter()

class ProjectDocumentType(BaseModel):
    project_id: uuid.UUID
    specification_doc : str
    specification : str
    frame_work_doc: str
    directory_info : str

class CreateProjectDocumentResponse(BaseModel):
    project_id: uuid.UUID
    message: str


@router.post("/project_document", summary="プロジェクトドキュメント作成")
async def create_project_document(document: ProjectDocumentType, db: Session = Depends(get_db))->CreateProjectDocumentResponse:
    db_document = ProjectDocument(
        project_id=document.project_id,
        specification_doc=document.specification_doc,
        specification=document.specification,
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
    db_document.specification = document.specification
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


# ==== 追加: PATCH ====

class ProjectDocumentPatch(BaseModel):
    # project_id はURLパスで受け取るため、PATCHボディでは受け付けない
    specification_doc: Optional[str] = None
    frame_work_doc: Optional[str] = None
    directory_info: Optional[str] = None
    specification: Optional[str] = None

    class Config:
        extra = "forbid"  # 予期しないキーを弾く

@router.patch("/project_document/{project_id}", summary="プロジェクトドキュメント部分更新")
async def patch_project_document(
    project_id: uuid.UUID,
    document: ProjectDocumentPatch,
    db: Session = Depends(get_db)
) -> CreateProjectDocumentResponse:
    db_document = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()
    if db_document is None:
        raise HTTPException(status_code=404, detail="Project document not found")

    # 送られてきたフィールドだけ更新
    update_data = document.model_dump(exclude_unset=True)
    # 念のため許可フィールドを限定
    allowed_fields = {"specification_doc", "frame_work_doc", "directory_info", "specification"}
    for key, value in update_data.items():
        if key in allowed_fields:
            setattr(db_document, key, value)
    db.commit()
    db.refresh(db_document)
    return {"project_id": project_id, "message": "プロジェクトドキュメントが部分更新されました"}


# doc_id (UUID) を使用したCRUD操作
@router.get("/project_document/id/{doc_id}", summary="プロジェクトドキュメントをIDで取得")
async def get_project_document_by_id(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    db_document = db.query(ProjectDocument).filter(ProjectDocument.doc_id == doc_id).first()
    if db_document is None:
        raise HTTPException(status_code=404, detail="Project document not found")
    return db_document

@router.put("/project_document/id/{doc_id}", summary="プロジェクトドキュメントをIDで更新")
async def update_project_document_by_id(doc_id: uuid.UUID, document: ProjectDocumentType, db: Session = Depends(get_db)):
    db_document = db.query(ProjectDocument).filter(ProjectDocument.doc_id == doc_id).first()
    if db_document is None:
        raise HTTPException(status_code=404, detail="Project document not found")
    
    db_document.project_id = document.project_id
    db_document.specification_doc = document.specification_doc
    db_document.specification = document.specification
    db_document.frame_work_doc = document.frame_work_doc
    db_document.directory_info = document.directory_info
    db.commit()
    db.refresh(db_document)
    return {"doc_id": doc_id, "message": "プロジェクトドキュメントが更新されました"}

@router.delete("/project_document/id/{doc_id}", summary="プロジェクトドキュメントをIDで削除")
async def delete_project_document_by_id(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    db_document = db.query(ProjectDocument).filter(ProjectDocument.doc_id == doc_id).first()
    if db_document is None:
        raise HTTPException(status_code=404, detail="Project document not found")
    
    db.delete(db_document)
    db.commit()
    return {"doc_id": doc_id, "message": "プロジェクトドキュメントが削除されました"}