"""
テストデータ作成スクリプト
Phase 3: ハンズオン生成のテスト用
"""

from database import SessionLocal
from models.project_base import ProjectBase, Task, TaskDependency, ProjectDocument
import uuid
from datetime import datetime, timedelta

db = SessionLocal()

try:
    # プロジェクト作成
    project_id = uuid.uuid4()
    project = ProjectBase(
        project_id=project_id,
        title="テストプロジェクト：タスク管理アプリ",
        idea="シンプルなタスク管理アプリケーションを作成する",
        start_date=datetime.now().date(),
        end_date=datetime.now() + timedelta(days=7)
    )
    db.add(project)
    db.commit()
    print(f"✅ プロジェクト作成: {project.title} (ID: {project_id})")

    # プロジェクトドキュメント作成
    spec_doc = ProjectDocument(
        doc_id=uuid.uuid4(),
        project_id=project_id,
        specification="Next.js 15とFastAPIを使用したタスク管理アプリケーション。ユーザー認証、タスクCRUD、リアルタイム更新機能を実装する。",
        function_doc="タスク管理の主要機能を実装",
        frame_work_doc="フロントエンド: Next.js 15, React 19, TypeScript\nバックエンド: FastAPI, SQLAlchemy, PostgreSQL\n認証: NextAuth.js",
        directory_info="/src, /api, /components",
        created_at=datetime.now()
    )
    db.add(spec_doc)
    db.commit()
    print("✅ プロジェクトドキュメント作成")

    # タスク作成
    task1_id = uuid.uuid4()
    task1 = Task(
        task_id=task1_id,
        project_id=project_id,
        title="データベーススキーマ設計",
        description="タスク管理に必要なデータベーステーブルを設計する",
        category="Backend",
        priority="Must",
        estimated_hours=4
    )
    db.add(task1)

    task2_id = uuid.uuid4()
    task2 = Task(
        task_id=task2_id,
        project_id=project_id,
        title="FastAPI CRUD API実装",
        description="タスクのCRUD操作を行うAPIエンドポイントを実装する",
        category="Backend",
        priority="Must",
        estimated_hours=6
    )
    db.add(task2)

    task3_id = uuid.uuid4()
    task3 = Task(
        task_id=task3_id,
        project_id=project_id,
        title="Next.js認証機能実装",
        description="NextAuth.jsを使用してユーザー認証を実装する",
        category="Frontend",
        priority="Must",
        estimated_hours=8
    )
    db.add(task3)

    db.commit()
    print(f"✅ タスク作成: 3件")

    # タスク依存関係作成（task2 は task1 に依存）
    dep = TaskDependency(
        id=uuid.uuid4(),
        edge_id=f"task1-task2",
        source_task_id=task1_id,
        target_task_id=task2_id,
        source_node_id="n1",
        target_node_id="n2",
        is_animated=True,
        is_next_day=False
    )
    db.add(dep)
    db.commit()
    print("✅ タスク依存関係作成")

    print(f"\n=== テストデータ作成完了 ===")
    print(f"プロジェクトID: {project_id}")
    print(f"タスク1 ID: {task1_id}")
    print(f"タスク2 ID: {task2_id}")
    print(f"タスク3 ID: {task3_id}")

except Exception as e:
    db.rollback()
    print(f"❌ エラー: {e}")
    raise
finally:
    db.close()
