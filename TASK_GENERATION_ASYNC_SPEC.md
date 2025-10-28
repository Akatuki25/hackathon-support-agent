# タスク生成の非同期化と環境構築ページ先行表示の実装仕様書

## 概要

プロジェクトページのフローを改善し、タスク生成を非同期バッチ処理として実行しながら、先に環境構築資料を表示することで、ユーザーがタスク生成完了を待つ間に作業を開始できるようにする。

## 現在のフロー

```
[userName]/[projectId]/page.tsx
  ↓
タスクを同期的に生成（数分かかる）
  ↓
タスクフローを表示
```

**問題点:**
- タスク生成が完了するまで画面が表示されない（ローディング画面のみ）
- 生成中にユーザーは何もできない
- タスク生成とハンズオン資料生成の順序が非効率

## 新しいフロー

```
[userName]/[projectId]/page.tsx
  ↓
タスクが存在しない？
  ↓ Yes
[userName]/[projectId]/env/page.tsx
  ├─ タスク生成ジョブを非同期で開始（バックグラウンド）
  ├─ 環境構築資料を生成・表示（先に表示）
  ├─ タスク生成完了を監視（ポーリング）
  └─ 完了時に通知 → グラフ/カンバンへ誘導
  ↓ No
タスクフローを表示
```

**メリット:**
- ユーザーは待ち時間中に環境構築資料を確認できる
- タスク生成が完了したら通知して次のステップに進める
- ページ遷移がスムーズになり、UXが向上

---

## 実装詳細

### Phase 1: バックエンド改修

#### 1.1 データベーススキーマ追加

**新規テーブル: `task_generation_job`**

タスク生成ジョブを管理するテーブルを追加（`models/project_base.py`に追加）

```python
class TaskGenerationJob(Base):
    """タスク生成ジョブ管理テーブル"""
    __tablename__ = "task_generation_job"

    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("project_base.project_id"), nullable=False)

    # ジョブステータス
    status = Column(String, nullable=False, default="queued")  # queued, processing, completed, failed

    # 進捗情報
    total_tasks = Column(Integer, default=0)
    completed_phases = Column(Integer, default=0)
    total_phases = Column(Integer, default=5)  # 生成、評価、依存関係、座標、保存

    # エラー情報
    error_message = Column(String, nullable=True)

    # タイムスタンプ
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # リレーション
    project = relationship("ProjectBase", back_populates="task_generation_jobs")
```

**マイグレーション作成:**

```bash
cd back
alembic revision --autogenerate -m "Add task_generation_job table"
alembic upgrade head
```

---

#### 1.2 Celeryタスク作成

**ファイル: `back/tasks/task_generation_tasks.py`**

```python
"""
task_generation_tasks.py: タスク生成のCeleryタスク

Phase 1: バックグラウンドでの完全タスク生成
"""

from celery_app import celery_app
from database import SessionLocal
from models.project_base import TaskGenerationJob
from services.integrated_task_service import IntegratedTaskService
from datetime import datetime
from uuid import UUID


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def generate_complete_task_set_async(self, job_id: str, project_id: str):
    """
    完全なタスクセットを非同期生成

    Args:
        job_id: TaskGenerationJob ID
        project_id: プロジェクトID

    Returns:
        Dict: 生成結果
    """
    db = SessionLocal()

    try:
        print(f"[Celery] タスク生成開始: project_id={project_id}")

        # ジョブレコード取得・更新
        job = db.query(TaskGenerationJob).filter_by(job_id=UUID(job_id)).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job.status = "processing"
        job.started_at = datetime.utcnow()
        db.commit()

        # タスク生成サービス実行
        service = IntegratedTaskService(db)
        result = await service.generate_complete_task_set(project_id)

        # ジョブ完了
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.total_tasks = result["total_tasks"]
        job.completed_phases = 5  # すべてのフェーズ完了
        db.commit()

        print(f"[Celery] タスク生成完了: {result['total_tasks']} tasks")

        return {
            "success": True,
            "job_id": job_id,
            "project_id": project_id,
            **result
        }

    except Exception as e:
        # エラー処理
        job.status = "failed"
        job.error_message = str(e)
        db.commit()

        print(f"[Celery] タスク生成失敗: {str(e)}")

        # リトライ可能なエラーの場合はリトライ
        if "timeout" in str(e).lower() or "network" in str(e).lower():
            raise self.retry(exc=e, countdown=60)

        raise

    finally:
        db.close()
```

**Celeryアプリ設定更新: `back/celery_app.py`**

```python
# タスク自動検出（tasksディレクトリ配下）
imports=[
    "tasks.hands_on_tasks",  # Phase 3: ハンズオン生成タスク
    "tasks.task_generation_tasks",  # Phase 1: タスク生成タスク（追加）
],
```

---

#### 1.3 APIエンドポイント更新

**ファイル: `back/routers/complete_task_generation.py`**

既存のAPIを以下のように拡張:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
from database import get_db
from tasks.task_generation_tasks import generate_complete_task_set_async
from models.project_base import TaskGenerationJob, Task
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy import and_

router = APIRouter()


# ========================================
# リクエスト/レスポンスモデル
# ========================================

class AsyncTaskGenerationRequest(BaseModel):
    """非同期タスク生成リクエスト"""
    project_id: str


class AsyncTaskGenerationResponse(BaseModel):
    """非同期タスク生成レスポンス"""
    success: bool
    job_id: str
    project_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    """ジョブステータスレスポンス"""
    success: bool
    job_id: str
    project_id: str
    status: str
    progress: Dict[str, Any]
    total_tasks: int
    completed_phases: int
    total_phases: int
    error_message: Optional[str]
    created_at: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]


# ========================================
# エンドポイント
# ========================================

@router.post("/generate_async", response_model=AsyncTaskGenerationResponse)
async def generate_complete_task_set_async_endpoint(
    request: AsyncTaskGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    非同期でタスクセット生成を開始

    Celeryタスクを起動して即座にレスポンス返却

    重複実行防止:
    - 既存のジョブ(queued/processing/completed)をチェック
    - データベーストランザクションで排他制御
    """
    try:
        project_uuid = UUID(request.project_id)

        # 🔒 既存のジョブをチェック (処理中 or 完了済み)
        existing_job = (
            db.query(TaskGenerationJob)
            .filter(
                and_(
                    TaskGenerationJob.project_id == project_uuid,
                    TaskGenerationJob.status.in_(["queued", "processing", "completed"])
                )
            )
            .with_for_update(skip_locked=True)
            .first()
        )

        if existing_job:
            return AsyncTaskGenerationResponse(
                success=True,
                job_id=str(existing_job.job_id),
                project_id=request.project_id,
                status=existing_job.status,
                message=f"Task generation already {existing_job.status}"
            )

        # 🔒 タスクが既に存在するかチェック
        existing_tasks = db.query(Task).filter_by(project_id=project_uuid).first()
        if existing_tasks:
            return AsyncTaskGenerationResponse(
                success=True,
                job_id="already-completed",
                project_id=request.project_id,
                status="completed",
                message="Tasks already exist for this project"
            )

        # 🆕 新規ジョブ作成
        job = TaskGenerationJob(
            job_id=uuid4(),
            project_id=project_uuid,
            status="queued"
        )
        db.add(job)
        db.commit()

        # Celeryタスク起動（非同期）
        generate_complete_task_set_async.apply_async(
            args=[str(job.job_id), request.project_id],
            task_id=str(job.job_id)
        )

        return AsyncTaskGenerationResponse(
            success=True,
            job_id=str(job.job_id),
            project_id=request.project_id,
            status="queued",
            message="Task generation started in background"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/job_status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    db: Session = Depends(get_db)
):
    """
    ジョブステータス確認
    """
    try:
        job = db.query(TaskGenerationJob).filter_by(job_id=UUID(job_id)).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        return JobStatusResponse(
            success=True,
            job_id=str(job.job_id),
            project_id=str(job.project_id),
            status=job.status,
            progress={
                "percentage": (job.completed_phases / job.total_phases * 100) if job.total_phases > 0 else 0,
                "current_phase": job.completed_phases,
                "total_phases": job.total_phases
            },
            total_tasks=job.total_tasks,
            completed_phases=job.completed_phases,
            total_phases=job.total_phases,
            error_message=job.error_message,
            created_at=job.created_at.isoformat() if job.created_at else None,
            started_at=job.started_at.isoformat() if job.started_at else None,
            completed_at=job.completed_at.isoformat() if job.completed_at else None
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 既存のエンドポイントはそのまま維持
@router.post("/generate_complete", ...)  # 既存の同期版（互換性のため残す）
@router.get("/preview/{project_id}", ...)  # 既存のプレビュー
@router.delete("/clear/{project_id}", ...)  # 既存のクリア
```

---

### Phase 2: フロントエンド改修

#### 2.1 新しいサービスの追加

**ファイル: `front/src/libs/service/taskGenerationJobService.ts`**

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * 非同期タスク生成リクエスト
 */
export interface AsyncTaskGenerationRequest {
  project_id: string;
}

/**
 * 非同期タスク生成レスポンス
 */
export interface AsyncTaskGenerationResponse {
  success: boolean;
  job_id: string;
  project_id: string;
  status: string;
  message: string;
}

/**
 * ジョブステータスレスポンス
 */
export interface JobStatusResponse {
  success: boolean;
  job_id: string;
  project_id: string;
  status: string;  // 'queued' | 'processing' | 'completed' | 'failed'
  progress: {
    percentage: number;
    current_phase: number;
    total_phases: number;
  };
  total_tasks: number;
  completed_phases: number;
  total_phases: number;
  error_message?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * 非同期タスク生成を開始
 */
export const startTaskGenerationAsync = async (
  projectId: string
): Promise<AsyncTaskGenerationResponse> => {
  const response = await axios.post<AsyncTaskGenerationResponse>(
    `${API_URL}/api/complete_task_generation/generate_async`,
    { project_id: projectId }
  );
  return response.data;
};

/**
 * ジョブステータスを取得
 */
export const getJobStatus = async (
  jobId: string
): Promise<JobStatusResponse> => {
  const response = await axios.get<JobStatusResponse>(
    `${API_URL}/api/complete_task_generation/job_status/${jobId}`
  );
  return response.data;
};

/**
 * ジョブ完了を待機（ポーリング）
 *
 * @param jobId ジョブID
 * @param onProgress 進捗更新コールバック
 * @param pollingInterval ポーリング間隔（ミリ秒）
 * @returns 完了時のジョブステータス
 */
export const waitForJobCompletion = async (
  jobId: string,
  onProgress?: (status: JobStatusResponse) => void,
  pollingInterval: number = 3000
): Promise<JobStatusResponse> => {
  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const status = await getJobStatus(jobId);

        // 進捗コールバック
        if (onProgress) {
          onProgress(status);
        }

        // 完了チェック
        if (status.status === 'completed') {
          resolve(status);
        } else if (status.status === 'failed') {
          reject(new Error(status.error_message || 'Task generation failed'));
        } else {
          // 継続してポーリング
          setTimeout(checkStatus, pollingInterval);
        }
      } catch (error) {
        reject(error);
      }
    };

    checkStatus();
  });
};
```

---

#### 2.2 page.tsx の改修

**ファイル: `front/src/app/[userName]/[projectId]/page.tsx`**

既存のロジックを修正し、タスクが存在しない場合は `/env` ページにリダイレクト:

```typescript
// 既存のコード...
import { useRouter } from 'next/navigation';

export default function TaskVisualizationPage() {
  const pathname = usePathname();
  const router = useRouter();
  const projectId = pathname?.split('/')[2];
  const userName = pathname?.split('/')[1];

  // ... 既存のstate ...

  const loadTaskData = async () => {
    if (!projectId) {
      setError('Project ID not found in URL');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch tasks
      const tasksResponse = await axios.get<BackendTask[]>(
        `${API_URL}/task/project/${projectId}`
      );

      // Fetch dependencies
      const dependenciesResponse = await axios.get<BackendTaskDependency[]>(
        `${API_URL}/api/task_dependencies/project/${projectId}`
      );

      const tasks = tasksResponse.data;
      const dependencies = dependenciesResponse.data;

      if (!tasks || tasks.length === 0) {
        // タスクが存在しない場合は環境構築ページにリダイレクト
        router.push(`/${userName}/${projectId}/env`);
        return;
      }

      // Transform and set data
      const transformedNodes = transformTasksToNodes(tasks);
      const transformedEdges = transformDependenciesToEdges(dependencies);

      setNodes(transformedNodes);
      setEdges(transformedEdges);
    } catch (err) {
      const error = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      if (error.response?.status === 404 || error.response?.data?.detail?.includes('not found')) {
        // タスクが存在しない場合は環境構築ページにリダイレクト
        router.push(`/${userName}/${projectId}/env`);
      } else {
        console.error('Error loading task data:', error);
        setError(
          `タスクデータの読み込みに失敗しました: ${error.response?.data?.detail || error.message}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // generateTasks 関数は削除（env ページで実行するため）

  // ... 残りのコードは既存のまま ...
}
```

---

#### 2.3 env/page.tsx の新規実装

**ファイル: `front/src/app/[userName]/[projectId]/env/page.tsx`**

```typescript
"use client";
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  startTaskGenerationAsync,
  waitForJobCompletion,
  JobStatusResponse
} from '@/libs/service/taskGenerationJobService';
import { useDarkMode } from '@/hooks/useDarkMode';
import { CheckCircle, Loader2, ArrowRight, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface EnvironmentHandsOn {
  overall: string;
  devcontainer: string;
  frontend: string;
  backend: string;
}

export default function EnvironmentSetupPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { darkMode } = useDarkMode();

  const projectId = pathname?.split('/')[2];
  const userName = pathname?.split('/')[1];

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [envData, setEnvData] = useState<EnvironmentHandsOn | null>(null);
  const [taskGenerationJobId, setTaskGenerationJobId] = useState<string | null>(null);
  const [taskGenerationStatus, setTaskGenerationStatus] = useState<JobStatusResponse | null>(null);
  const [showNotification, setShowNotification] = useState<boolean>(false);

  // 初期化処理
  useEffect(() => {
    if (projectId) {
      initializePage();
    }
  }, [projectId]);

  const initializePage = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. タスク生成ジョブを開始
      await startTaskGeneration();

      // 2. 環境構築資料を生成・取得
      await loadEnvironmentData();

      setLoading(false);
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      console.error('Error initializing page:', error);
      setError(
        `初期化に失敗しました: ${error.response?.data?.detail || error.message}`
      );
      setLoading(false);
    }
  };

  const startTaskGeneration = async () => {
    if (!projectId) return;

    try {
      console.log('タスク生成ジョブを開始...');
      const response = await startTaskGenerationAsync(projectId);

      setTaskGenerationJobId(response.job_id);
      console.log(`タスク生成ジョブ開始: ${response.job_id}`);

      // ジョブ完了を監視
      waitForJobCompletion(
        response.job_id,
        (status) => {
          setTaskGenerationStatus(status);
          console.log(`タスク生成進捗: ${status.progress.percentage}%`);
        },
        3000  // 3秒ごとにポーリング
      )
        .then((finalStatus) => {
          console.log('タスク生成完了!');
          setTaskGenerationStatus(finalStatus);
          setShowNotification(true);
        })
        .catch((err) => {
          console.error('タスク生成失敗:', err);
          setError(`タスク生成に失敗しました: ${err.message}`);
        });
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      console.error('Error starting task generation:', error);
      // エラーでもページは表示する（環境構築資料は見られる）
    }
  };

  const loadEnvironmentData = async () => {
    if (!projectId) return;

    try {
      console.log('環境構築資料を生成中...');
      const response = await axios.post<any>(
        `${API_URL}/api/environment/generate-from-project`,
        { project_id: projectId }
      );

      setEnvData(response.data.hands_on);
      console.log('環境構築資料生成完了');
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      console.error('Error loading environment data:', error);
      throw new Error(`環境構築資料の読み込みに失敗: ${error.response?.data?.detail || error.message}`);
    }
  };

  const navigateToTaskFlow = () => {
    if (userName && projectId) {
      router.push(`/${userName}/${projectId}`);
    }
  };

  const navigateToKanban = () => {
    if (userName && projectId) {
      router.push(`/${userName}/${projectId}/kanban`);
    }
  };

  // ローディング画面
  if (loading) {
    return (
      <main className={`min-h-screen ${
        darkMode
          ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900'
          : 'bg-gradient-to-br from-purple-50 via-white to-blue-50'
      } p-8`}>
        <div className="max-w-4xl mx-auto text-center">
          <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${
            darkMode ? 'text-cyan-400' : 'text-purple-600'
          }`} />
          <h2 className={`text-2xl font-bold mb-2 ${
            darkMode ? 'text-cyan-300' : 'text-purple-700'
          }`}>
            初期化中...
          </h2>
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
            タスク生成と環境構築資料を準備しています
          </p>
        </div>
      </main>
    );
  }

  // エラー画面
  if (error) {
    return (
      <main className={`min-h-screen ${
        darkMode
          ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900'
          : 'bg-gradient-to-br from-purple-50 via-white to-blue-50'
      } p-8`}>
        <div className="max-w-4xl mx-auto text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-red-600">エラー</h2>
          <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {error}
          </p>
          <button
            onClick={initializePage}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            再試行
          </button>
        </div>
      </main>
    );
  }

  // メイン画面
  return (
    <main className={`min-h-screen ${
      darkMode
        ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900'
        : 'bg-gradient-to-br from-purple-50 via-white to-blue-50'
    } p-8`}>
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className={`text-4xl font-bold mb-2 ${
            darkMode ? 'text-cyan-300' : 'text-purple-700'
          }`}>
            環境構築ガイド
          </h1>
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
            開発環境のセットアップ手順を確認してください
          </p>
        </div>

        {/* タスク生成ステータス */}
        <div className={`mb-8 p-6 rounded-lg ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-semibold ${
              darkMode ? 'text-cyan-300' : 'text-purple-700'
            }`}>
              タスク生成状況
            </h2>
            {taskGenerationStatus?.status === 'completed' && (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            {(taskGenerationStatus?.status === 'processing' || taskGenerationStatus?.status === 'queued') && (
              <Loader2 className={`w-6 h-6 animate-spin ${
                darkMode ? 'text-cyan-400' : 'text-purple-600'
              }`} />
            )}
          </div>

          {taskGenerationStatus && (
            <>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                    進捗: Phase {taskGenerationStatus.progress.current_phase} / {taskGenerationStatus.progress.total_phases}
                  </span>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                    {taskGenerationStatus.progress.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <div
                    className={`h-full transition-all duration-300 ${
                      darkMode
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500'
                        : 'bg-gradient-to-r from-purple-500 to-blue-500'
                    }`}
                    style={{ width: `${taskGenerationStatus.progress.percentage}%` }}
                  />
                </div>
              </div>

              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {taskGenerationStatus.status === 'completed'
                  ? `✅ タスク生成完了 (${taskGenerationStatus.total_tasks} タスク)`
                  : taskGenerationStatus.status === 'processing'
                  ? '⚙️ タスクを生成中...'
                  : '⏳ タスク生成を開始中...'}
              </p>
            </>
          )}
        </div>

        {/* 完了通知 */}
        {showNotification && taskGenerationStatus?.status === 'completed' && (
          <div className={`mb-8 p-6 rounded-lg border-2 ${
            darkMode
              ? 'bg-green-900/20 border-green-500'
              : 'bg-green-50 border-green-500'
          }`}>
            <div className="flex items-start gap-4">
              <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-2 ${
                  darkMode ? 'text-green-300' : 'text-green-700'
                }`}>
                  タスク生成が完了しました！
                </h3>
                <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {taskGenerationStatus.total_tasks} 個のタスクが生成されました。
                  タスクフローまたはカンバンボードで確認できます。
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={navigateToTaskFlow}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
                  >
                    タスクフローを表示
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={navigateToKanban}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-lg hover:from-cyan-700 hover:to-purple-700 transition-all"
                  >
                    カンバンボードを表示
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 環境構築資料 */}
        {envData && (
          <div className="space-y-6">
            {/* 全体説明 */}
            <section className={`p-6 rounded-lg ${
              darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <h2 className={`text-2xl font-bold mb-4 ${
                darkMode ? 'text-cyan-300' : 'text-purple-700'
              }`}>
                全体概要
              </h2>
              <div
                className={`prose ${darkMode ? 'prose-invert' : ''} max-w-none`}
                dangerouslySetInnerHTML={{ __html: envData.overall }}
              />
            </section>

            {/* DevContainer */}
            <section className={`p-6 rounded-lg ${
              darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <h2 className={`text-2xl font-bold mb-4 ${
                darkMode ? 'text-cyan-300' : 'text-purple-700'
              }`}>
                DevContainer セットアップ
              </h2>
              <div
                className={`prose ${darkMode ? 'prose-invert' : ''} max-w-none`}
                dangerouslySetInnerHTML={{ __html: envData.devcontainer }}
              />
            </section>

            {/* フロントエンド */}
            <section className={`p-6 rounded-lg ${
              darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <h2 className={`text-2xl font-bold mb-4 ${
                darkMode ? 'text-cyan-300' : 'text-purple-700'
              }`}>
                フロントエンド環境構築
              </h2>
              <div
                className={`prose ${darkMode ? 'prose-invert' : ''} max-w-none`}
                dangerouslySetInnerHTML={{ __html: envData.frontend }}
              />
            </section>

            {/* バックエンド */}
            <section className={`p-6 rounded-lg ${
              darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <h2 className={`text-2xl font-bold mb-4 ${
                darkMode ? 'text-cyan-300' : 'text-purple-700'
              }`}>
                バックエンド環境構築
              </h2>
              <div
                className={`prose ${darkMode ? 'prose-invert' : ''} max-w-none`}
                dangerouslySetInnerHTML={{ __html: envData.backend }}
              />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
```

---

## 実装手順のまとめ

### Step 1: データベースマイグレーション

```bash
cd back
# モデルに TaskGenerationJob を追加後
alembic revision --autogenerate -m "Add task_generation_job table"
alembic upgrade head
```

### Step 2: バックエンド実装

1. `back/tasks/task_generation_tasks.py` を作成
2. `back/celery_app.py` にインポート追加
3. `back/routers/complete_task_generation.py` に非同期エンドポイント追加
4. `back/models/project_base.py` に `TaskGenerationJob` モデル追加

### Step 3: フロントエンド実装

1. `front/src/libs/service/taskGenerationJobService.ts` を作成
2. `front/src/app/[userName]/[projectId]/page.tsx` を修正（リダイレクト追加）
3. `front/src/app/[userName]/[projectId]/env/page.tsx` を新規作成

### Step 4: Celeryワーカーの起動

```bash
cd back
celery -A celery_app worker --loglevel=info
```

### Step 5: 動作確認

1. プロジェクトページにアクセス
2. タスクが存在しない場合、`/env` ページに自動遷移
3. 環境構築資料が表示される
4. タスク生成進捗が表示される
5. タスク生成完了後、通知が表示される
6. タスクフロー/カンバンボードに遷移できる

---

## 注意事項

### Redis の設定

Celeryを使用するためにRedisが必要です。`docker-compose.yml`で設定されていることを確認してください。

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### 環境変数

`back/.env` に以下を追加:

```ini
REDIS_URL=redis://localhost:6379/0
```

### Celeryワーカーの管理

本番環境では、Celeryワーカーをsupervisorやsystemdで管理することを推奨します。

---

## テスト計画

### ユニットテスト

- [ ] `TaskGenerationJob` モデルのCRUDテスト
- [ ] `generate_complete_task_set_async` Celeryタスクのテスト
- [ ] ジョブステータスAPIのテスト

### 統合テスト

- [ ] タスク生成フロー全体のテスト（開始〜完了）
- [ ] エラーハンドリングのテスト（タイムアウト、リトライ）
- [ ] 重複実行防止のテスト

### E2Eテスト

- [ ] プロジェクトページからenv ページへの遷移
- [ ] env ページでのタスク生成と環境構築資料表示
- [ ] タスク完了後の通知とページ遷移

---

## 今後の拡張

### Phase 3: リアルタイム通知（WebSocket）

ポーリングの代わりにWebSocketを使用してリアルタイムで進捗を通知

### Phase 4: 進捗の詳細表示

各フェーズ（生成、評価、依存関係、座標計算、保存）の詳細な進捗を表示

### Phase 5: キャンセル機能

実行中のタスク生成をキャンセルできる機能を追加

---

## 参考資料

- **Celery Documentation**: https://docs.celeryproject.org/
- **FastAPI Background Tasks**: https://fastapi.tiangolo.com/tutorial/background-tasks/
- **Next.js App Router**: https://nextjs.org/docs/app
- **Redis**: https://redis.io/docs/

---

## まとめ

この仕様書に従って実装することで、以下が実現されます:

1. ✅ タスク生成が非同期で実行される
2. ✅ ユーザーは待ち時間中に環境構築資料を確認できる
3. ✅ タスク生成完了時に通知が表示される
4. ✅ スムーズにタスクフロー/カンバンボードに遷移できる

ユーザー体験が大幅に向上し、効率的なワークフローが実現されます。
