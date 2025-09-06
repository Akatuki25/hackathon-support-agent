from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from database import SessionLocal
from models.project_base import Env

router = APIRouter()

class EnvType(BaseModel):
    project_id: uuid.UUID
    front: Optional[str] = None
    backend: Optional[str] = None
    devcontainer: Optional[str] = None
    database: Optional[str] = None
    deploy: Optional[str] = None

class EnvPatch(BaseModel):
    project_id: Optional[uuid.UUID] = None
    front: Optional[str] = None
    backend: Optional[str] = None
    devcontainer: Optional[str] = None
    database: Optional[str] = None
    deploy: Optional[str] = None

# DBセッション取得用 dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/env", summary="環境情報作成")
async def create_env(env: EnvType, db: Session = Depends(get_db)):
    db_env = Env(
        env_id=uuid.uuid4(),
        project_id=env.project_id,
        front=env.front,
        backend=env.backend,
        devcontainer=env.devcontainer,
        database=env.database,
        deploy=env.deploy
    )
    db.add(db_env)
    db.commit()
    db.refresh(db_env)
    return {"env_id": db_env.env_id, "message": "環境情報が作成されました"}

@router.get("/env/{env_id}", summary="環境情報取得")
async def get_env(env_id: uuid.UUID, db: Session = Depends(get_db)):
    db_env = db.query(Env).filter(Env.env_id == env_id).first()
    if db_env is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    return db_env

@router.get("/env/project/{project_id}", summary="プロジェクトIDから環境情報取得")
async def get_envs_by_project_id(project_id: uuid.UUID, db: Session = Depends(get_db)):
    db_envs = db.query(Env).filter(Env.project_id == project_id).all()
    if not db_envs:
        raise HTTPException(status_code=404, detail="Environments not found for this project")
    return db_envs

@router.put("/env/{env_id}", summary="環境情報更新")
async def update_env(env_id: uuid.UUID, env: EnvType, db: Session = Depends(get_db)):
    db_env = db.query(Env).filter(Env.env_id == env_id).first()
    if db_env is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    db_env.project_id = env.project_id
    db_env.front = env.front
    db_env.backend = env.backend
    db_env.devcontainer = env.devcontainer
    db_env.database = env.database
    db_env.deploy = env.deploy
    db.commit()
    db.refresh(db_env)
    return {"env_id": env_id, "message": "環境情報が更新されました"}

@router.delete("/env/{env_id}", summary="環境情報削除")
async def delete_env(env_id: uuid.UUID, db: Session = Depends(get_db)):
    db_env = db.query(Env).filter(Env.env_id == env_id).first()
    if db_env is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    db.delete(db_env)
    db.commit()
    return {"env_id": env_id, "message": "環境情報が削除されました"}

@router.get("/envs", summary="全環境情報取得")
async def list_envs(db: Session = Depends(get_db)):
    envs = db.query(Env).all()
    return envs

@router.patch("/env/{env_id}", summary="環境情報部分更新")
async def patch_env(env_id: uuid.UUID, env: EnvPatch, db: Session = Depends(get_db)):
    db_env = db.query(Env).filter(Env.env_id == env_id).first()
    if db_env is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    update_data = env.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_env, key, value)
    
    db.commit()
    db.refresh(db_env)
    return {"message": "Environment partially updated successfully"}