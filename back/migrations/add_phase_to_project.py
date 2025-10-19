"""
既存のProjectBaseテーブルにフェーズ管理カラムを追加するマイグレーション

使用方法:
    # アップグレード（カラム追加）
    python migrations/add_phase_to_project.py

    # ダウングレード（カラム削除）
    python migrations/add_phase_to_project.py downgrade
"""

from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# 環境変数読み込み
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")


def upgrade():
    """フェーズ管理カラムを追加"""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        print("📦 Starting migration: add_phase_to_project...")

        # 1. Enumタイプを作成
        print("1️⃣  Creating project_phase_enum type...")
        try:
            conn.execute(text("""
                CREATE TYPE project_phase_enum AS ENUM (
                    'initial',
                    'qa_editing',
                    'summary_review',
                    'framework_selection',
                    'function_review',
                    'function_structuring',
                    'task_management'
                );
            """))
            conn.commit()
            print("   ✅ Enum type created successfully")
        except Exception as e:
            if "already exists" in str(e):
                print("   ⚠️  Enum type already exists, skipping...")
                conn.rollback()
            else:
                raise e

        # 2. カラムを追加
        print("2️⃣  Adding phase management columns...")
        try:
            conn.execute(text("""
                ALTER TABLE "projectBase"
                ADD COLUMN IF NOT EXISTS current_phase project_phase_enum NOT NULL DEFAULT 'initial',
                ADD COLUMN IF NOT EXISTS phase_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS phase_history JSON;
            """))
            conn.commit()
            print("   ✅ Columns added successfully")
        except Exception as e:
            print(f"   ❌ Error adding columns: {e}")
            conn.rollback()
            raise e

        # 3. インデックス作成
        print("3️⃣  Creating index on current_phase...")
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_project_base_current_phase
                ON "projectBase"(current_phase);
            """))
            conn.commit()
            print("   ✅ Index created successfully")
        except Exception as e:
            print(f"   ❌ Error creating index: {e}")
            conn.rollback()
            raise e

        # 4. 既存データのフェーズを推測して設定
        print("4️⃣  Updating existing projects with inferred phases...")
        try:
            result = conn.execute(text("""
                UPDATE "projectBase" p
                SET
                    current_phase = CASE
                        -- タスクがあれば task_management
                        WHEN EXISTS (
                            SELECT 1 FROM task t WHERE t.project_id = p.project_id
                        ) THEN 'task_management'::project_phase_enum

                        -- 構造化された機能があれば function_structuring
                        WHEN EXISTS (
                            SELECT 1 FROM structured_functions sf WHERE sf.project_id = p.project_id
                        ) THEN 'function_structuring'::project_phase_enum

                        -- フレームワークドキュメントがあれば framework_selection
                        WHEN EXISTS (
                            SELECT 1 FROM "projectDocument" pd
                            WHERE pd.project_id = p.project_id
                            AND pd.frame_work_doc IS NOT NULL
                            AND pd.frame_work_doc != ''
                        ) THEN 'framework_selection'::project_phase_enum

                        -- 要約があれば summary_review
                        WHEN EXISTS (
                            SELECT 1 FROM "projectDocument" pd
                            WHERE pd.project_id = p.project_id
                            AND pd.specification IS NOT NULL
                            AND pd.specification != ''
                        ) THEN 'summary_review'::project_phase_enum

                        -- Q&Aがあれば qa_editing
                        WHEN EXISTS (
                            SELECT 1 FROM qa WHERE qa.project_id = p.project_id
                        ) THEN 'qa_editing'::project_phase_enum

                        -- それ以外は initial
                        ELSE 'initial'::project_phase_enum
                    END,
                    phase_history = '[]'::json
                WHERE current_phase IS NULL OR current_phase = 'initial';
            """))
            conn.commit()
            print(f"   ✅ Updated {result.rowcount} projects with inferred phases")
        except Exception as e:
            print(f"   ❌ Error updating existing data: {e}")
            conn.rollback()
            raise e

        print("🎉 Migration completed successfully!")


def downgrade():
    """フェーズ管理カラムを削除（ロールバック）"""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        print("🔄 Starting rollback: remove phase management columns...")

        # 1. インデックスを削除
        print("1️⃣  Dropping index...")
        try:
            conn.execute(text("""
                DROP INDEX IF EXISTS ix_project_base_current_phase;
            """))
            conn.commit()
            print("   ✅ Index dropped successfully")
        except Exception as e:
            print(f"   ❌ Error dropping index: {e}")
            conn.rollback()
            raise e

        # 2. カラムを削除
        print("2️⃣  Dropping columns...")
        try:
            conn.execute(text("""
                ALTER TABLE "projectBase"
                DROP COLUMN IF EXISTS current_phase,
                DROP COLUMN IF EXISTS phase_updated_at,
                DROP COLUMN IF EXISTS phase_history;
            """))
            conn.commit()
            print("   ✅ Columns dropped successfully")
        except Exception as e:
            print(f"   ❌ Error dropping columns: {e}")
            conn.rollback()
            raise e

        # 3. Enumタイプを削除
        print("3️⃣  Dropping project_phase_enum type...")
        try:
            conn.execute(text("DROP TYPE IF EXISTS project_phase_enum;"))
            conn.commit()
            print("   ✅ Enum type dropped successfully")
        except Exception as e:
            print(f"   ❌ Error dropping enum type: {e}")
            conn.rollback()
            raise e

        print("✅ Rollback completed successfully!")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
