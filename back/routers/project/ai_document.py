# -*- coding: utf-8 -*-
"""
AIDocument CRUD API
AI generated categorized documents management
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel, field_validator, ConfigDict
from database import get_db
from models.project_base import AIDocument

router = APIRouter()


# ========================================
# Pydantic Models
# ========================================

class AIDocumentCreate(BaseModel):
    """AIDocument creation model"""
    project_id: uuid.UUID
    environment: Optional[str] = None
    front_end: Optional[str] = None
    back_end: Optional[str] = None
    database: Optional[str] = None
    deployment: Optional[str] = None
    ai_design: Optional[str] = None
    slide: Optional[str] = None

    @field_validator('project_id', mode='before')
    @classmethod
    def validate_project_id(cls, v):
        if isinstance(v, str):
            try:
                return uuid.UUID(v)
            except ValueError:
                raise ValueError('Invalid UUID format')
        return v

    model_config = ConfigDict(
        json_encoders = {
            uuid.UUID: str
        }
    )


class AIDocumentUpdate(BaseModel):
    """AIDocument update model (all fields required)"""
    environment: Optional[str] = None
    front_end: Optional[str] = None
    back_end: Optional[str] = None
    database: Optional[str] = None
    deployment: Optional[str] = None
    ai_design: Optional[str] = None
    slide: Optional[str] = None


class AIDocumentPatch(BaseModel):
    """AIDocument partial update model (all fields optional)"""
    environment: Optional[str] = None
    front_end: Optional[str] = None
    back_end: Optional[str] = None
    database: Optional[str] = None
    deployment: Optional[str] = None
    ai_design: Optional[str] = None
    slide: Optional[str] = None

    class Config:
        extra = "forbid"


class AIDocumentResponse(BaseModel):
    """AIDocument response model"""
    ai_doc_id: uuid.UUID
    project_id: uuid.UUID
    environment: Optional[str] = None
    front_end: Optional[str] = None
    back_end: Optional[str] = None
    database: Optional[str] = None
    deployment: Optional[str] = None
    ai_design: Optional[str] = None
    slide: Optional[str] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders = {
            uuid.UUID: str
        }
    )


class MessageResponse(BaseModel):
    """Message response model"""
    message: str
    ai_doc_id: Optional[uuid.UUID] = None
    project_id: Optional[uuid.UUID] = None

    model_config = ConfigDict(
        json_encoders = {
            uuid.UUID: str
        }
    )


# ========================================
# CRUD Endpoints
# ========================================

@router.post("/ai_document", response_model=MessageResponse, summary="Create AIDocument")
async def create_ai_document(
    document: AIDocumentCreate,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Create a new AIDocument

    - **project_id**: Project ID (required)
    - **environment**: Environment setup summary
    - **front_end**: Frontend AI-generated document
    - **back_end**: Backend AI-generated document
    - **database**: Database AI-generated document
    - **deployment**: Deployment AI-generated document
    - **ai_design**: AI design AI-generated document
    - **slide**: Slide creation summary
    """
    # Check if AIDocument already exists
    existing = db.query(AIDocument).filter(
        AIDocument.project_id == document.project_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"AIDocument already exists for project_id: {document.project_id}"
        )

    db_document = AIDocument(
        project_id=document.project_id,
        environment=document.environment,
        front_end=document.front_end,
        back_end=document.back_end,
        database=document.database,
        deployment=document.deployment,
        ai_design=document.ai_design,
        slide=document.slide
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    return MessageResponse(
        message="AIDocument created successfully",
        ai_doc_id=db_document.ai_doc_id,
        project_id=db_document.project_id
    )


@router.get("/ai_document/{project_id}", response_model=AIDocumentResponse, summary="Get AIDocument by project_id")
async def get_ai_document_by_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> AIDocumentResponse:
    """
    Get AIDocument by project_id
    """
    db_document = db.query(AIDocument).filter(
        AIDocument.project_id == project_id
    ).first()

    if db_document is None:
        raise HTTPException(
            status_code=404,
            detail=f"AIDocument not found for project_id: {project_id}"
        )

    return AIDocumentResponse.model_validate(db_document)


@router.get("/ai_document/id/{ai_doc_id}", response_model=AIDocumentResponse, summary="Get AIDocument by ai_doc_id")
async def get_ai_document_by_id(
    ai_doc_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> AIDocumentResponse:
    """
    Get AIDocument by ai_doc_id
    """
    db_document = db.query(AIDocument).filter(
        AIDocument.ai_doc_id == ai_doc_id
    ).first()

    if db_document is None:
        raise HTTPException(
            status_code=404,
            detail=f"AIDocument not found for ai_doc_id: {ai_doc_id}"
        )

    return AIDocumentResponse.model_validate(db_document)


@router.put("/ai_document/{project_id}", response_model=MessageResponse, summary="Update AIDocument by project_id")
async def update_ai_document_by_project(
    project_id: uuid.UUID,
    document: AIDocumentUpdate,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Update AIDocument by project_id (full update)
    """
    db_document = db.query(AIDocument).filter(
        AIDocument.project_id == project_id
    ).first()

    if db_document is None:
        raise HTTPException(
            status_code=404,
            detail=f"AIDocument not found for project_id: {project_id}"
        )

    # Update all fields
    db_document.environment = document.environment
    db_document.front_end = document.front_end
    db_document.back_end = document.back_end
    db_document.database = document.database
    db_document.deployment = document.deployment
    db_document.ai_design = document.ai_design
    db_document.slide = document.slide

    db.commit()
    db.refresh(db_document)

    return MessageResponse(
        message="AIDocument updated successfully",
        ai_doc_id=db_document.ai_doc_id,
        project_id=db_document.project_id
    )


@router.put("/ai_document/id/{ai_doc_id}", response_model=MessageResponse, summary="Update AIDocument by ai_doc_id")
async def update_ai_document_by_id(
    ai_doc_id: uuid.UUID,
    document: AIDocumentUpdate,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Update AIDocument by ai_doc_id (full update)
    """
    db_document = db.query(AIDocument).filter(
        AIDocument.ai_doc_id == ai_doc_id
    ).first()

    if db_document is None:
        raise HTTPException(
            status_code=404,
            detail=f"AIDocument not found for ai_doc_id: {ai_doc_id}"
        )

    # Update all fields
    db_document.environment = document.environment
    db_document.front_end = document.front_end
    db_document.back_end = document.back_end
    db_document.database = document.database
    db_document.deployment = document.deployment
    db_document.ai_design = document.ai_design
    db_document.slide = document.slide

    db.commit()
    db.refresh(db_document)

    return MessageResponse(
        message="AIDocument updated successfully",
        ai_doc_id=db_document.ai_doc_id,
        project_id=db_document.project_id
    )


@router.patch("/ai_document/{project_id}", response_model=MessageResponse, summary="Partial update AIDocument by project_id")
async def patch_ai_document_by_project(
    project_id: uuid.UUID,
    document: AIDocumentPatch,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Partial update AIDocument by project_id

    Only provided fields will be updated
    """
    db_document = db.query(AIDocument).filter(
        AIDocument.project_id == project_id
    ).first()

    if db_document is None:
        raise HTTPException(
            status_code=404,
            detail=f"AIDocument not found for project_id: {project_id}"
        )

    # Update only provided fields
    update_data = document.model_dump(exclude_unset=True)
    allowed_fields = {
        "environment", "front_end", "back_end", "database",
        "deployment", "ai_design", "slide"
    }

    for key, value in update_data.items():
        if key in allowed_fields:
            setattr(db_document, key, value)

    db.commit()
    db.refresh(db_document)

    return MessageResponse(
        message="AIDocument partially updated successfully",
        ai_doc_id=db_document.ai_doc_id,
        project_id=db_document.project_id
    )


@router.patch("/ai_document/id/{ai_doc_id}", response_model=MessageResponse, summary="Partial update AIDocument by ai_doc_id")
async def patch_ai_document_by_id(
    ai_doc_id: uuid.UUID,
    document: AIDocumentPatch,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Partial update AIDocument by ai_doc_id

    Only provided fields will be updated
    """
    db_document = db.query(AIDocument).filter(
        AIDocument.ai_doc_id == ai_doc_id
    ).first()

    if db_document is None:
        raise HTTPException(
            status_code=404,
            detail=f"AIDocument not found for ai_doc_id: {ai_doc_id}"
        )

    # Update only provided fields
    update_data = document.model_dump(exclude_unset=True)
    allowed_fields = {
        "environment", "front_end", "back_end", "database",
        "deployment", "ai_design", "slide"
    }

    for key, value in update_data.items():
        if key in allowed_fields:
            setattr(db_document, key, value)

    db.commit()
    db.refresh(db_document)

    return MessageResponse(
        message="AIDocument partially updated successfully",
        ai_doc_id=db_document.ai_doc_id,
        project_id=db_document.project_id
    )


@router.delete("/ai_document/{project_id}", response_model=MessageResponse, summary="Delete AIDocument by project_id")
async def delete_ai_document_by_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Delete AIDocument by project_id
    """
    db_document = db.query(AIDocument).filter(
        AIDocument.project_id == project_id
    ).first()

    if db_document is None:
        raise HTTPException(
            status_code=404,
            detail=f"AIDocument not found for project_id: {project_id}"
        )

    ai_doc_id = db_document.ai_doc_id

    db.delete(db_document)
    db.commit()

    return MessageResponse(
        message="AIDocument deleted successfully",
        ai_doc_id=ai_doc_id,
        project_id=project_id
    )


@router.delete("/ai_document/id/{ai_doc_id}", response_model=MessageResponse, summary="Delete AIDocument by ai_doc_id")
async def delete_ai_document_by_id(
    ai_doc_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Delete AIDocument by ai_doc_id
    """
    db_document = db.query(AIDocument).filter(
        AIDocument.ai_doc_id == ai_doc_id
    ).first()

    if db_document is None:
        raise HTTPException(
            status_code=404,
            detail=f"AIDocument not found for ai_doc_id: {ai_doc_id}"
        )

    project_id = db_document.project_id

    db.delete(db_document)
    db.commit()

    return MessageResponse(
        message="AIDocument deleted successfully",
        ai_doc_id=ai_doc_id,
        project_id=project_id
    )
