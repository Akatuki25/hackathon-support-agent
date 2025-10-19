# Phase Management Implementation Plan

## 概要

プロジェクトのフェーズ管理機能を実装し、タブを閉じても進行状況を復旧できるようにする。
フェーズ情報をデータベースに保存し、LLMジョブ成功時に自動的に次のフェーズへ遷移する仕組みを構築する。

## 現在の問題点

1. **URLルーティングベース**: フェーズ管理がURLに依存しているため、タブを閉じると進行状況が失われる
2. **状態の永続化なし**: データベースにフェーズ状態がないため、途中から再開できない
3. **手動遷移のみ**: LLMジョブの成功後に自動的に次のフェーズへ遷移する仕組みがない

## 解決策

データベースにフェーズ情報を追加し、各AIサービスのジョブ成功時に自動的にフェーズを更新する。

---

## 1. フェーズ定義

### 1.1 フェーズ一覧

正しいページ遷移順序：
```
/hackSetUp
  → /hackSetUp/[ProjectId]/hackQA
  → /hackSetUp/[ProjectId]/setUpSummary
  → /hackSetUp/[ProjectId]/selectFramework
  → /hackSetUp/[ProjectId]/functionSummary
  → /hackSetUp/[ProjectId]/functionStructuring
  → /[userName]/[projectId]/kanban
```

| フェーズ名 | 説明 | 対応するページ | LLMジョブ |
|-----------|------|---------------|----------|
| `initial` | プロジェクト作成直後 | `/hackSetUp` | - |
| `qa_editing` | Q&A編集中 | `/hackSetUp/[ProjectId]/hackQA` | POST /api/question/{projectId} で生成 |
| `summary_review` | 要約レビュー中 | `/hackSetUp/[ProjectId]/setUpSummary` | POST /api/summary/ で生成 |
| `framework_selection` | フレームワーク選択中 | `/hackSetUp/[ProjectId]/selectFramework` | - |
| `function_review` | 機能レビュー中 | `/hackSetUp/[ProjectId]/functionSummary` | - |
| `function_structuring` | 機能構造化中 | `/hackSetUp/[ProjectId]/functionStructuring` | POST /api/function_structuring/structure |
| `task_management` | タスク管理（完了） | `/[userName]/[projectId]/kanban` | POST /api/complete_task_generation/generate_complete |

### 1.2 フェーズ遷移図

```
initial (プロジェクト作成ページ)
  ↓
  ↓ ユーザーがプロジェクト情報を入力して送信
  ↓ POST /api/project/ (プロジェクト作成)
  ↓ POST /api/question/{projectId} (Q&A生成)
  ↓
qa_editing (Q&A編集ページ)
  ↓
  ↓ ユーザーがQ&Aを編集・確認後、「次へ」ボタン
  ↓ POST /api/summary/ (要約生成)
  ↓
summary_review (要約レビューページ)
  ↓
  ↓ ユーザーが要約を確認・編集後、「次へ」ボタン
  ↓
framework_selection (フレームワーク選択ページ)
  ↓
  ↓ ユーザーが技術スタックを選択 (AI推薦 or 手動選択)
  ↓ 選択完了後、「次へ」ボタン
  ↓
function_review (機能レビューページ)
  ↓
  ↓ ユーザーが機能要件を確認・編集後、「次へ」ボタン
  ↓
function_structuring (機能構造化ページ)
  ↓
  ↓ ページ読み込み時に自動実行
  ↓ POST /api/function_structuring/structure (機能構造化)
  ↓ 機能構造化完了後、「タスク生成」ボタン
  ↓ POST /api/complete_task_generation/generate_complete (タスク生成)
  ↓
task_management (タスク管理ページ - カンバンボード)
```

**重要な遷移タイミング:**
- `initial` → `qa_editing`: Q&A生成API成功時に自動遷移
- `qa_editing` → `summary_review`: 要約生成API成功時に自動遷移
- `summary_review` → `framework_selection`: ユーザーの手動遷移
- `framework_selection` → `function_review`: ユーザーの手動遷移
- `function_review` → `function_structuring`: ユーザーの手動遷移
- `function_structuring` → `task_management`: 機能構造化API成功後、タスク生成API成功時に自動遷移

---

## 2. データベーススキーマ変更

### 2.1 ProjectBase テーブルへの追加カラム

**ファイル**: `/back/models/project_base.py`

```python
from sqlalchemy import Enum

# Enum定義
ProjectPhaseEnum = Enum(
    "initial",               # プロジェクト作成直後
    "qa_editing",            # Q&A編集中
    "summary_review",        # 要約レビュー中
    "framework_selection",   # フレームワーク選択中
    "function_structuring",  # 機能構造化中
    "function_review",       # 機能レビュー中
    "task_management",       # タスク管理（完了）
    name="project_phase_enum"
)

# ProjectBaseクラスに追加
class ProjectBase(Base):
    __tablename__ = "projectBase"

    # 既存のカラム
    project_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    idea = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(DateTime, nullable=False)

    # 新規追加: フェーズ管理
    current_phase = Column(
        ProjectPhaseEnum,
        nullable=False,
        default="initial",
        index=True,
        comment="現在のプロジェクトフェーズ"
    )
    phase_updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="フェーズ最終更新日時"
    )
    phase_history = Column(
        JSON,
        nullable=True,
        comment="フェーズ遷移履歴 [{phase: string, timestamp: string}]"
    )

    # ... 既存のリレーション
```

### 2.2 マイグレーションスクリプト

**ファイル**: `/back/migrations/add_phase_to_project.py`

```python
"""
既存のProjectBaseテーブルにフェーズ管理カラムを追加するマイグレーション
"""

from sqlalchemy import create_engine, text
from database import DATABASE_URL
import json
from datetime import datetime

def upgrade():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # 1. Enumタイプを作成
        conn.execute(text("""
            CREATE TYPE project_phase_enum AS ENUM (
                'initial',
                'qa_editing',
                'summary_review',
                'framework_selection',
                'function_structuring',
                'function_review',
                'task_management'
            );
        """))

        # 2. カラムを追加
        conn.execute(text("""
            ALTER TABLE "projectBase"
            ADD COLUMN current_phase project_phase_enum NOT NULL DEFAULT 'initial',
            ADD COLUMN phase_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN phase_history JSON;
        """))

        # 3. インデックス作成
        conn.execute(text("""
            CREATE INDEX ix_project_base_current_phase
            ON "projectBase"(current_phase);
        """))

        # 4. 既存データのフェーズを推測して設定
        conn.execute(text("""
            UPDATE "projectBase" p
            SET current_phase = CASE
                -- タスクがあれば task_management
                WHEN EXISTS (
                    SELECT 1 FROM task t WHERE t.project_id = p.project_id
                ) THEN 'task_management'::project_phase_enum

                -- 構造化された機能があれば function_review
                WHEN EXISTS (
                    SELECT 1 FROM structured_functions sf WHERE sf.project_id = p.project_id
                ) THEN 'function_review'::project_phase_enum

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
            phase_history = '[]'::json;
        """))

        conn.commit()
        print("✅ Migration completed successfully")

def downgrade():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # カラムを削除
        conn.execute(text("""
            ALTER TABLE "projectBase"
            DROP COLUMN current_phase,
            DROP COLUMN phase_updated_at,
            DROP COLUMN phase_history;
        """))

        # Enumタイプを削除
        conn.execute(text("DROP TYPE project_phase_enum;"))

        conn.commit()
        print("✅ Rollback completed successfully")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
```

---

## 3. バックエンドAPI実装

### 3.1 フェーズ更新ユーティリティ関数

**ファイル**: `/back/utils/phase_manager.py` (新規作成)

```python
"""
プロジェクトフェーズ管理ユーティリティ
"""

from sqlalchemy.orm import Session
from models.project_base import ProjectBase
from datetime import datetime
import json
from typing import Optional

class PhaseManager:
    """プロジェクトフェーズを管理するクラス"""

    @staticmethod
    def update_phase(
        db: Session,
        project_id: str,
        new_phase: str,
        add_to_history: bool = True
    ) -> ProjectBase:
        """
        プロジェクトのフェーズを更新

        Args:
            db: データベースセッション
            project_id: プロジェクトID
            new_phase: 新しいフェーズ名
            add_to_history: 履歴に追加するか

        Returns:
            更新されたProjectBaseオブジェクト
        """
        project = db.query(ProjectBase).filter(
            ProjectBase.project_id == project_id
        ).first()

        if not project:
            raise ValueError(f"Project {project_id} not found")

        # 履歴に追加
        if add_to_history:
            history = project.phase_history or []
            if isinstance(history, str):
                history = json.loads(history)

            history.append({
                "from_phase": project.current_phase,
                "to_phase": new_phase,
                "timestamp": datetime.now().isoformat()
            })
            project.phase_history = history

        # フェーズ更新
        project.current_phase = new_phase
        project.phase_updated_at = datetime.now()

        db.commit()
        db.refresh(project)

        return project

    @staticmethod
    def get_current_phase(db: Session, project_id: str) -> Optional[str]:
        """現在のフェーズを取得"""
        project = db.query(ProjectBase).filter(
            ProjectBase.project_id == project_id
        ).first()

        return project.current_phase if project else None
```

### 3.2 フェーズ管理API

**ファイル**: `/back/routers/project/project_phase.py` (新規作成)

```python
"""
プロジェクトフェーズ管理API
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.project_base import ProjectBase
from utils.phase_manager import PhaseManager
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/project", tags=["project_phase"])

class PhaseUpdateRequest(BaseModel):
    phase: str

class PhaseResponse(BaseModel):
    project_id: str
    current_phase: str
    phase_updated_at: str
    phase_history: Optional[list] = None

@router.get("/{project_id}/phase", response_model=PhaseResponse)
def get_project_phase(project_id: str, db: Session = Depends(get_db)):
    """プロジェクトの現在のフェーズを取得"""
    project = db.query(ProjectBase).filter(
        ProjectBase.project_id == project_id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return PhaseResponse(
        project_id=str(project.project_id),
        current_phase=project.current_phase,
        phase_updated_at=project.phase_updated_at.isoformat(),
        phase_history=project.phase_history
    )

@router.patch("/{project_id}/phase", response_model=PhaseResponse)
def update_project_phase(
    project_id: str,
    request: PhaseUpdateRequest,
    db: Session = Depends(get_db)
):
    """プロジェクトのフェーズを手動更新"""
    try:
        project = PhaseManager.update_phase(
            db=db,
            project_id=project_id,
            new_phase=request.phase,
            add_to_history=True
        )

        return PhaseResponse(
            project_id=str(project.project_id),
            current_phase=project.current_phase,
            phase_updated_at=project.phase_updated_at.isoformat(),
            phase_history=project.phase_history
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

### 3.3 既存AIルーターへのフェーズ更新追加

#### 3.3.1 Q&A生成ルーター

**ファイル**: `/back/routers/qanda.py`

```python
# 既存のインポートに追加
from utils.phase_manager import PhaseManager

# 既存のエンドポイント修正例
@router.post("/{project_id}")
async def generate_questions(
    project_id: str,
    request: QuestionRequest,
    db: Session = Depends(get_db)
):
    """Q&A生成"""
    try:
        # Q&A生成処理（既存のロジック）
        qa_list = await QuestionService.generate_question(
            project_id=project_id,
            prompt=request.Prompt,
            db=db
        )

        # ✅ フェーズ更新: qa_editing へ
        PhaseManager.update_phase(
            db=db,
            project_id=project_id,
            new_phase="qa_editing"
        )

        return {"QA": qa_list}
    except Exception as e:
        # エラー時はフェーズを更新しない
        raise HTTPException(status_code=500, detail=str(e))
```

#### 3.3.2 要約生成ルーター

**ファイル**: `/back/routers/summary.py`

```python
from utils.phase_manager import PhaseManager

@router.post("/")
async def generate_summary(
    request: SummaryRequest,
    db: Session = Depends(get_db)
):
    """要約生成"""
    try:
        # 要約生成処理（既存のロジック）
        summary = await SummaryService.generate_summary(
            project_id=request.project_id,
            db=db
        )

        # ✅ フェーズ更新: summary_review へ
        PhaseManager.update_phase(
            db=db,
            project_id=request.project_id,
            new_phase="summary_review"
        )

        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### 3.3.3 フレームワーク推薦ルーター

**ファイル**: `/back/routers/framework.py`

```python
from utils.phase_manager import PhaseManager

@router.post("/recommendations")
async def get_framework_recommendations(
    request: FrameworkRequest,
    db: Session = Depends(get_db)
):
    """フレームワーク推薦"""
    try:
        recommendations = await FrameworkService.generate_framework_recommendations(
            specification=request.specification,
            function_doc=request.function_doc,
            db=db
        )

        # ✅ フェーズ更新: function_structuring へ
        if request.project_id:
            PhaseManager.update_phase(
                db=db,
                project_id=request.project_id,
                new_phase="function_structuring"
            )

        return recommendations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### 3.3.4 機能構造化ルーター

**ファイル**: `/back/routers/function_structuring.py`

```python
from utils.phase_manager import PhaseManager

@router.post("/structure")
async def structure_functions(
    request: FunctionStructuringRequest,
    db: Session = Depends(get_db)
):
    """機能構造化"""
    try:
        result = await FunctionStructuringAgent.process_project(
            project_id=request.project_id,
            db=db
        )

        # ✅ フェーズ更新: function_review へ
        PhaseManager.update_phase(
            db=db,
            project_id=request.project_id,
            new_phase="function_review"
        )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### 3.3.5 タスク生成ルーター

**ファイル**: `/back/routers/complete_task_generation.py`

```python
from utils.phase_manager import PhaseManager

@router.post("/generate_complete")
async def generate_complete_task_set(
    request: CompleteTaskGenerationRequest,
    db: Session = Depends(get_db)
):
    """完全なタスクセット生成"""
    try:
        result = await IntegratedTaskService.generate_complete_task_set(
            project_id=request.project_id,
            db=db
        )

        # ✅ フェーズ更新: task_management へ
        PhaseManager.update_phase(
            db=db,
            project_id=request.project_id,
            new_phase="task_management"
        )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 3.4 app.py へのルーター登録

**ファイル**: `/back/app.py`

```python
# 既存のインポートに追加
from routers.project import project_phase

# ルーター登録
app.include_router(project_phase.router)
```

---

## 4. フロントエンド実装

### 4.1 フェーズ管理サービス

**ファイル**: `/front/src/libs/service/phaseService.ts` (新規作成)

```typescript
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export interface PhaseResponse {
  project_id: string;
  current_phase: string;
  phase_updated_at: string;
  phase_history?: Array<{
    from_phase: string;
    to_phase: string;
    timestamp: string;
  }>;
}

/**
 * プロジェクトの現在のフェーズを取得
 */
export const getProjectPhase = async (projectId: string): Promise<PhaseResponse> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/project/${projectId}/phase`
  );
  return response.data;
};

/**
 * プロジェクトのフェーズを手動更新
 */
export const updateProjectPhase = async (
  projectId: string,
  phase: string
): Promise<PhaseResponse> => {
  const response = await axios.patch(
    `${API_BASE_URL}/api/project/${projectId}/phase`,
    { phase }
  );
  return response.data;
};

/**
 * フェーズに対応するページパスを取得
 */
export const getPagePathForPhase = (
  phase: string,
  projectId: string,
  userName?: string
): string => {
  const phaseToPath: Record<string, string> = {
    initial: "/hackSetUp",
    qa_editing: `/hackSetUp/${projectId}/hackQA`,
    summary_review: `/hackSetUp/${projectId}/setUpSummary`,
    framework_selection: `/hackSetUp/${projectId}/selectFramework`,
    function_review: `/hackSetUp/${projectId}/functionSummary`,
    function_structuring: `/hackSetUp/${projectId}/functionStructuring`,
    task_management: userName
      ? `/${userName}/${projectId}/kanban`
      : `/hackSetUp/${projectId}/functionStructuring`,
  };

  return phaseToPath[phase] || "/hackSetUp";
};
```

### 4.2 フェーズ復旧Hook

**ファイル**: `/front/src/hooks/usePhaseRecovery.ts` (新規作成)

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProjectPhase, getPagePathForPhase } from "@/libs/service/phaseService";

interface UsePhaseRecoveryOptions {
  projectId: string;
  currentPath: string;
  userName?: string;
  autoRedirect?: boolean;
}

export const usePhaseRecovery = ({
  projectId,
  currentPath,
  userName,
  autoRedirect = true,
}: UsePhaseRecoveryOptions) => {
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    const checkPhase = async () => {
      try {
        const phaseData = await getProjectPhase(projectId);
        setCurrentPhase(phaseData.current_phase);

        // 現在のフェーズに対応するパスを取得
        const expectedPath = getPagePathForPhase(
          phaseData.current_phase,
          projectId,
          userName
        );

        // 現在のパスと期待されるパスが異なる場合、リダイレクトフラグを立てる
        if (autoRedirect && currentPath !== expectedPath) {
          setShouldRedirect(true);
          router.push(expectedPath);
        }
      } catch (error) {
        console.error("Failed to fetch project phase:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      checkPhase();
    }
  }, [projectId, currentPath, userName, autoRedirect, router]);

  return {
    currentPhase,
    isLoading,
    shouldRedirect,
  };
};
```

### 4.3 プログレスインジケーターコンポーネント

**ファイル**: `/front/src/components/PhaseProgress.tsx` (新規作成)

```typescript
"use client";

import React from "react";

interface PhaseProgressProps {
  currentPhase: string;
}

const PHASE_STEPS = [
  { key: "initial", label: "プロジェクト作成" },
  { key: "qa_editing", label: "Q&A編集" },
  { key: "summary_review", label: "要約確認" },
  { key: "framework_selection", label: "技術選定" },
  { key: "function_review", label: "機能確認" },
  { key: "function_structuring", label: "機能構造化" },
  { key: "task_management", label: "タスク管理" },
];

export const PhaseProgress: React.FC<PhaseProgressProps> = ({ currentPhase }) => {
  // 現在のステップインデックスを取得
  const currentStepIndex = PHASE_STEPS.findIndex((step) =>
    currentPhase.includes(step.key)
  );

  return (
    <div className="w-full px-4 py-6">
      <div className="flex items-center justify-between">
        {PHASE_STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <React.Fragment key={step.key}>
              {/* ステップ */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-blue-500 text-white"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>
                <p
                  className={`mt-2 text-sm ${
                    isCurrent ? "font-bold text-blue-600" : "text-gray-600"
                  }`}
                >
                  {step.label}
                </p>
              </div>

              {/* コネクター */}
              {index < PHASE_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    isCompleted ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
```

### 4.4 ページでの使用例

**ファイル**: `/front/src/app/hackSetUp/[ProjectId]/hackQA/page.tsx`

```typescript
"use client";

import { useParams, usePathname } from "next/navigation";
import { usePhaseRecovery } from "@/hooks/usePhaseRecovery";
import { PhaseProgress } from "@/components/PhaseProgress";

export default function HackQAPage() {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.ProjectId as string;

  // フェーズ復旧機能
  const { currentPhase, isLoading, shouldRedirect } = usePhaseRecovery({
    projectId,
    currentPath: pathname,
    autoRedirect: true,
  });

  if (isLoading) {
    return <div>Loading phase information...</div>;
  }

  if (shouldRedirect) {
    return <div>Redirecting to the correct phase...</div>;
  }

  return (
    <div>
      {/* プログレスインジケーター */}
      {currentPhase && <PhaseProgress currentPhase={currentPhase} />}

      {/* 既存のQ&AページUI */}
      <h1>Q&A Page</h1>
      {/* ... */}
    </div>
  );
}
```

---

## 5. 実装手順

### Step 1: データベーススキーマ変更
1. `/back/models/project_base.py` にフェーズ関連カラムを追加
2. マイグレーションスクリプト作成・実行
3. `create_tables.py` の更新（開発環境）

### Step 2: バックエンドユーティリティ作成
1. `/back/utils/phase_manager.py` を作成
2. PhaseManager クラスの実装

### Step 3: API実装
1. `/back/routers/project/project_phase.py` を作成
2. 各AIルーター（qanda.py, summary.py等）にフェーズ更新ロジックを追加
3. `/back/app.py` にルーター登録

### Step 4: フロントエンド実装
1. `/front/src/libs/service/phaseService.ts` を作成
2. `/front/src/hooks/usePhaseRecovery.ts` を作成
3. `/front/src/components/PhaseProgress.tsx` を作成
4. 各ページに `usePhaseRecovery` フックを追加

### Step 5: テスト
1. 新規プロジェクト作成フローのテスト
2. タブを閉じて再度開いた時の復旧テスト
3. 各フェーズ遷移の動作確認
4. 既存プロジェクトのマイグレーション確認

---

## 6. 想定されるエッジケース

### 6.1 複数タブで同時編集
- **問題**: 複数タブで同じプロジェクトを編集した場合、フェーズが競合する可能性
- **対策**: フェーズ更新時にタイムスタンプをチェックし、最新の状態を優先

### 6.2 LLMジョブの失敗
- **問題**: LLMジョブが失敗した場合、フェーズが中途半端な状態になる
- **対策**: エラー時はフェーズを更新せず、エラー状態を別途管理

### 6.3 手動でURLを変更した場合
- **問題**: ユーザーが手動でURLを変更し、フェーズと不一致になる
- **対策**: `usePhaseRecovery` フックが自動的に正しいページへリダイレクト

### 6.4 マイグレーション時の既存データ
- **問題**: 既存プロジェクトのフェーズが不明確
- **対策**: マイグレーションスクリプトでデータの状態からフェーズを推測

---

## 7. 今後の拡張案

### 7.1 フェーズロック機能
- 特定のフェーズで編集をロックし、前のフェーズに戻れないようにする

### 7.2 フェーズスキップ機能
- 上級ユーザー向けに特定のフェーズをスキップできる機能

### 7.3 フェーズ分析ダッシュボード
- プロジェクトがどのフェーズで停滞しているかを可視化

### 7.4 自動保存機能
- 各フェーズでの編集内容を自動的にDBに保存

---

## 8. 参考資料

### 関連ファイル
- **モデル**: `/workspaces/hackathon_support_agent/back/models/project_base.py:37`
- **AIルーター**: `/workspaces/hackathon_support_agent/back/routers/`
- **フロントエンドページ**: `/workspaces/hackathon_support_agent/front/src/app/hackSetUp/`

### フロー図の詳細
現在のワークフローについては、Exploreエージェントが生成した詳細なフロー図を参照してください。

---

## 9. チェックリスト

- [ ] ProjectBaseにフェーズカラムを追加
- [ ] マイグレーションスクリプト作成・実行
- [ ] PhaseManagerユーティリティ作成
- [ ] プロジェクトフェーズAPIエンドポイント実装
- [ ] 各AIルーターにフェーズ更新ロジック追加
- [ ] フロントエンドphaseService作成
- [ ] usePhaseRecoveryフック作成
- [ ] PhaseProgressコンポーネント作成
- [ ] 各ページにフェーズ復旧機能を追加
- [ ] 新規プロジェクトフローのテスト
- [ ] タブ復旧機能のテスト
- [ ] 既存プロジェクトのマイグレーションテスト

---

**作成日**: 2025-10-18
**最終更新**: 2025-10-18
