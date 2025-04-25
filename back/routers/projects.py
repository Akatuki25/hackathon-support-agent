from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from pydantic import BaseModel
from database import SessionLocal
from models.project import Project

router = APIRouter()

# Pydanticモデル（入力用）
class ProjectCreate(BaseModel):
    idea: str
    duration: str
    num_people: int
    specification: str
    selected_framework: str
    directory_info: str
    menber_info: list  # 各メンバーの情報のリスト
    task_info: list  # 各タスクの情報のリスト
    envHanson: str # 環境構築ハンズオン

# Pydanticモデル（更新用）
class ProjectUpdate(BaseModel):
    idea: str = None
    duration: str = None
    num_people: int = None
    specification: str = None
    selected_framework: str = None
    directory_info: str = None
    menber_info: list = None
    task_info: list = None
    envHanson: str = None

# DBセッション取得用 dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/projects", summary="プロジェクト作成")
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    project_id = str(uuid.uuid4())
    db_project = Project(
        project_id=project_id,
        idea=project.idea,
        duration=project.duration,
        num_people=project.num_people,
        specification=project.specification,
        selected_framework=project.selected_framework,
        directory_info=project.directory_info,
        menber_info=project.menber_info,
        task_info=project.task_info,
        envHanson=project.envHanson,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return {"project_id": project_id, "message": "プロジェクトが作成されました"}

@router.get("/projects/{project_id}", summary="プロジェクト取得")
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    return {
        "project_id": project.project_id,
        "idea": project.idea,
        "duration": project.duration,
        "num_people": project.num_people,
        "specification": project.specification,
        "selected_framework": project.selected_framework,
        "directory_info": project.directory_info,
        "menber_info": project.menber_info,
        "task_info": project.task_info,
        "envHanson": project.envHanson,
    }

@router.get("/projects", summary="全プロジェクト一覧取得")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return [{"project_id": p.project_id, "idea": p.idea} for p in projects]

@router.put("/projects/{project_id}", summary="プロジェクト更新")
def update_project(project_id: str, project: ProjectUpdate, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.project_id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    update_data = project.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_project, key, value)
    db.commit()
    db.refresh(db_project)
    return {"message": "プロジェクトが更新されました"}

@router.delete("/projects/{project_id}", summary="プロジェクト削除")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.project_id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    db.delete(db_project)
    db.commit()
    return {"message": "プロジェクトが削除されました"}
