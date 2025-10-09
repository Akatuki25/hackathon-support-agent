from database import engine, Base
from models.project_base import (
    MemberBase,
    ProjectBase,
    ProjectDocument,
    ProjectMember,
    Task,
    TaskAssignment,
    TaskDependency,
    QA,
    AIDocument,
    Env,
    StructuredFunction,
    FunctionDependency,
    FunctionToTaskMapping,
)

def reset_db():
    # 既存のテーブルをすべて削除
    Base.metadata.drop_all(bind=engine)
    # テーブルを再作成
    Base.metadata.create_all(bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    reset_db()
    print("テーブルのリセット完了")
    init_db()
    print("テーブル作成完了")
