# 環境構築AIエージェントサービス 設計書

## 概要

`ProjectDocument`の`frame_work_doc`（フレームワーク情報）を入力として、AIが環境構築情報を自動生成し、`Env`テーブルに保存するサービスを設計する。

## 現状分析

### 既存リソース

| リソース | パス | 説明 |
|----------|------|------|
| `EnvironmentService` | `services/environment_service.py` | ハンズオン説明生成（DB保存なし） |
| `Env`モデル | `models/project_base.py` | 環境情報テーブル |
| `env` CRUD Router | `routers/project/env.py` | Env テーブルのCRUD API |
| `environment` Router | `routers/environment.py` | 環境構築ハンズオン生成API |

### データフロー（現状）

```
frame_work_doc (ProjectDocument)
    ↓ [手動で取得]
EnvironmentService.generate_hands_on()
    ↓ [JSONレスポンス]
フロントエンド表示のみ（DB保存なし）
```

### Envテーブル構造

```python
class Env(Base):
    env_id     = Column(UUID)           # PK
    project_id = Column(UUID)           # FK -> projectBase
    front      = Column(String)         # フロントエンド環境構築手順
    backend    = Column(String)         # バックエンド環境構築手順
    devcontainer = Column(String)       # devcontainer設定説明
    database   = Column(String)         # データベース環境構築手順
    deploy     = Column(String)         # デプロイ手順
    created_at = Column(DateTime)
```

---

## 処理フロー図

```
┌─────────────────────────────────────────────────────────────────┐
│                    フロントエンド                                │
│  POST /api/env_setup/generate { project_id: "xxx" }            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 env_setup_agent.py (Router)                     │
│  EnvSetupAgentService.generate_and_save_env(project_id)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              EnvSetupAgentService                               │
│                                                                 │
│  1. _get_framework_doc(project_id)                             │
│     └─> SELECT frame_work_doc FROM projectDocument              │
│         WHERE project_id = ?                                    │
│                                                                 │
│  2. _generate_env_setup(frame_work_doc)                        │
│     └─> LangChain + Gemini 2.5 Flash                           │
│         プロンプト: env_setup_agent_service.generate_env_setup  │
│         出力: { front, backend, devcontainer, database, deploy }│
│                                                                 │
│  3. _save_env(project_id, env_data)                            │
│     └─> INSERT/UPDATE INTO env                                  │
│         (project_id, front, backend, devcontainer, database,    │
│          deploy)                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Envテーブル                                 │
│  env_id | project_id | front | backend | devcontainer |         │
│         |            | database | deploy | created_at           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 実装ファイル一覧

| ファイル | 種類 | 説明 |
|----------|------|------|
| `back/services/env_setup_agent_service.py` | 新規作成 | メインサービスロジック |
| `back/routers/env_setup_agent.py` | 新規作成 | APIエンドポイント |
| `back/services/prompts.toml` | 追記 | `[env_setup_agent_service]`セクション追加 |
| `back/app.py` | 追記 | ルーター登録 |
| `front/src/libs/service/envSetupService.ts` | 新規作成 | フロントエンドAPI連携 |
| `front/src/types/modelTypes.ts` | 追記 | 型定義追加 |

---

## バックエンド実装

### 1. サービスクラス: `services/env_setup_agent_service.py`

```python
"""
環境構築AIエージェントサービス

frame_work_docからAIで環境構築情報を生成し、Envテーブルに保存する
"""

from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from sqlalchemy.orm import Session
from models.project_base import ProjectDocument, Env
from .base_service import BaseService
import uuid


class EnvSetupAgentService(BaseService):
    """
    frame_work_docからAIで環境構築情報を生成し、Envテーブルに保存するエージェント
    """

    def __init__(self, db: Session):
        super().__init__(db=db)

    def generate_and_save_env(self, project_id: str, force_regenerate: bool = False) -> dict:
        """
        メインエントリーポイント
        1. ProjectDocumentからframe_work_docを取得
        2. AIで環境構築情報を生成
        3. Envテーブルに保存
        4. 結果を返す

        Args:
            project_id: プロジェクトID
            force_regenerate: 既存データを削除して再生成するかどうか

        Returns:
            dict: 生成された環境構築情報とenv_id
        """
        self.logger.info(f"Starting env setup generation for project: {project_id}")

        # 1. frame_work_doc を取得
        frame_work_doc = self._get_framework_doc(project_id)
        if not frame_work_doc:
            raise ValueError(f"frame_work_doc not found for project: {project_id}. Please complete framework selection first.")

        # 2. 既存データの確認と処理
        if force_regenerate:
            self._delete_existing_env(project_id)

        # 3. AIで環境構築情報を生成
        env_data = self._generate_env_setup(frame_work_doc)

        # 4. Envテーブルに保存
        env = self._save_env(project_id, env_data)

        self.logger.info(f"Env setup generation completed for project: {project_id}, env_id: {env.env_id}")

        return {
            "env_id": str(env.env_id),
            "project_id": project_id,
            "front": env.front,
            "backend": env.backend,
            "devcontainer": env.devcontainer,
            "database": env.database,
            "deploy": env.deploy
        }

    def _get_framework_doc(self, project_id: str) -> str:
        """
        ProjectDocumentからframe_work_docを取得

        Args:
            project_id: プロジェクトID

        Returns:
            str: frame_work_doc の内容
        """
        self.logger.debug(f"Fetching frame_work_doc for project: {project_id}")

        doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == uuid.UUID(project_id)
        ).first()

        if not doc:
            self.logger.warning(f"ProjectDocument not found for project: {project_id}")
            return ""

        return doc.frame_work_doc or ""

    def _generate_env_setup(self, frame_work_doc: str) -> dict:
        """
        AIで環境構築情報を生成

        Args:
            frame_work_doc: フレームワーク情報

        Returns:
            dict: front, backend, devcontainer, database, deploy を含む辞書
        """
        self.logger.debug("Generating env setup with AI")

        response_schemas = [
            ResponseSchema(
                name="front",
                description="フロントエンド環境構築の詳細手順（Markdown形式）。Node.jsバージョン、パッケージマネージャー、依存関係インストール、開発サーバー起動、環境変数設定を含む。",
                type="string"
            ),
            ResponseSchema(
                name="backend",
                description="バックエンド環境構築の詳細手順（Markdown形式）。言語ランタイム、仮想環境作成、依存関係インストール、サーバー起動、環境変数設定を含む。",
                type="string"
            ),
            ResponseSchema(
                name="devcontainer",
                description=".devcontainer設定の説明と使い方（Markdown形式）。devcontainer.json設定、VS Code拡張機能、Docker設定、ポートフォワーディングを含む。",
                type="string"
            ),
            ResponseSchema(
                name="database",
                description="データベース環境構築手順（Markdown形式）。推奨DB、ローカル起動方法（Docker推奨）、マイグレーション、接続設定を含む。",
                type="string"
            ),
            ResponseSchema(
                name="deploy",
                description="デプロイ環境構築手順（Markdown形式）。推奨デプロイ先、CI/CD設定、本番環境変数管理、デプロイコマンドを含む。",
                type="string"
            )
        ]

        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("env_setup_agent_service", "generate_env_setup"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash | parser

        result = chain.invoke({
            "frame_work_doc": frame_work_doc
        })

        self.logger.debug("AI env setup generation completed")
        return result

    def _save_env(self, project_id: str, env_data: dict) -> Env:
        """
        Envテーブルに保存（既存があれば更新）

        Args:
            project_id: プロジェクトID
            env_data: 環境構築情報

        Returns:
            Env: 保存されたEnvオブジェクト
        """
        self.logger.debug(f"Saving env data for project: {project_id}")

        # 既存のEnvを検索
        existing_env = self.db.query(Env).filter(
            Env.project_id == uuid.UUID(project_id)
        ).first()

        if existing_env:
            # 更新
            existing_env.front = env_data.get("front", "")
            existing_env.backend = env_data.get("backend", "")
            existing_env.devcontainer = env_data.get("devcontainer", "")
            existing_env.database = env_data.get("database", "")
            existing_env.deploy = env_data.get("deploy", "")
            self.db.commit()
            self.db.refresh(existing_env)
            self.logger.info(f"Updated existing env: {existing_env.env_id}")
            return existing_env
        else:
            # 新規作成
            new_env = Env(
                env_id=uuid.uuid4(),
                project_id=uuid.UUID(project_id),
                front=env_data.get("front", ""),
                backend=env_data.get("backend", ""),
                devcontainer=env_data.get("devcontainer", ""),
                database=env_data.get("database", ""),
                deploy=env_data.get("deploy", "")
            )
            self.db.add(new_env)
            self.db.commit()
            self.db.refresh(new_env)
            self.logger.info(f"Created new env: {new_env.env_id}")
            return new_env

    def _delete_existing_env(self, project_id: str) -> None:
        """
        既存のEnvデータを削除

        Args:
            project_id: プロジェクトID
        """
        self.logger.debug(f"Deleting existing env for project: {project_id}")

        self.db.query(Env).filter(
            Env.project_id == uuid.UUID(project_id)
        ).delete()
        self.db.commit()

    def get_env_by_project(self, project_id: str) -> dict | None:
        """
        プロジェクトIDからEnvデータを取得

        Args:
            project_id: プロジェクトID

        Returns:
            dict | None: Envデータまたは None
        """
        env = self.db.query(Env).filter(
            Env.project_id == uuid.UUID(project_id)
        ).first()

        if not env:
            return None

        return {
            "env_id": str(env.env_id),
            "project_id": str(env.project_id),
            "front": env.front,
            "backend": env.backend,
            "devcontainer": env.devcontainer,
            "database": env.database,
            "deploy": env.deploy,
            "created_at": env.created_at.isoformat() if env.created_at else None
        }
```

---

### 2. APIルーター: `routers/env_setup_agent.py`

```python
"""
環境構築AIエージェント APIルーター
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid

from database import get_db
from services.env_setup_agent_service import EnvSetupAgentService

router = APIRouter()


# --- Request/Response Models ---

class EnvSetupRequest(BaseModel):
    project_id: str


class EnvSetupResponse(BaseModel):
    env_id: str
    project_id: str
    front: Optional[str] = None
    backend: Optional[str] = None
    devcontainer: Optional[str] = None
    database: Optional[str] = None
    deploy: Optional[str] = None
    message: str


class EnvGetResponse(BaseModel):
    env_id: str
    project_id: str
    front: Optional[str] = None
    backend: Optional[str] = None
    devcontainer: Optional[str] = None
    database: Optional[str] = None
    deploy: Optional[str] = None
    created_at: Optional[str] = None


# --- Endpoints ---

@router.post("/generate", response_model=EnvSetupResponse, summary="環境構築情報をAIで生成")
async def generate_env_setup(
    request: EnvSetupRequest,
    db: Session = Depends(get_db)
):
    """
    プロジェクトIDを受け取り、frame_work_docから環境構築情報を
    AIで生成してEnvテーブルに保存する

    - **project_id**: プロジェクトのUUID

    Returns:
        生成された環境構築情報（front, backend, devcontainer, database, deploy）
    """
    service = EnvSetupAgentService(db=db)

    try:
        result = service.generate_and_save_env(request.project_id)
        return EnvSetupResponse(
            env_id=result["env_id"],
            project_id=result["project_id"],
            front=result["front"],
            backend=result["backend"],
            devcontainer=result["devcontainer"],
            database=result["database"],
            deploy=result["deploy"],
            message="環境構築情報を生成・保存しました"
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成に失敗しました: {str(e)}")


@router.post("/regenerate/{project_id}", response_model=EnvSetupResponse, summary="環境構築情報を再生成")
async def regenerate_env_setup(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    既存の環境構築情報を削除して再生成する

    - **project_id**: プロジェクトのUUID（パスパラメータ）
    """
    service = EnvSetupAgentService(db=db)

    try:
        result = service.generate_and_save_env(project_id, force_regenerate=True)
        return EnvSetupResponse(
            env_id=result["env_id"],
            project_id=result["project_id"],
            front=result["front"],
            backend=result["backend"],
            devcontainer=result["devcontainer"],
            database=result["database"],
            deploy=result["deploy"],
            message="環境構築情報を再生成しました"
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"再生成に失敗しました: {str(e)}")


@router.get("/{project_id}", response_model=EnvGetResponse, summary="環境構築情報を取得")
async def get_env_setup(
    project_id: str,
    db: Session = Depends(get_db)
):
    """
    プロジェクトIDから環境構築情報を取得する

    - **project_id**: プロジェクトのUUID（パスパラメータ）
    """
    service = EnvSetupAgentService(db=db)

    result = service.get_env_by_project(project_id)

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"環境構築情報が見つかりません: project_id={project_id}"
        )

    return EnvGetResponse(**result)
```

---

### 3. プロンプト追加: `services/prompts.toml` に追記

```toml
[env_setup_agent_service]
generate_env_setup = """
あなたはハッカソンプロジェクトの環境構築エキスパートAIエージェントです。

以下のフレームワーク情報を分析し、プロジェクトの環境構築手順を生成してください。

## フレームワーク情報
{frame_work_doc}

## 出力要件
各項目について、以下の観点で詳細な環境構築手順をMarkdown形式で生成してください。
具体的なコマンド、設定ファイルの内容、注意点を含めてください。

### front（フロントエンド）
以下の内容を含めてください：
- 必要なNode.jsバージョン（推奨: LTS版）
- パッケージマネージャー（npm/yarn/pnpm）の推奨と理由
- 依存関係インストール手順（具体的なコマンド）
- 開発サーバー起動方法
- 環境変数設定（.env.localの例）
- よくあるトラブルシューティング

### backend（バックエンド）
以下の内容を含めてください：
- 言語ランタイムのバージョン（Python/Node.js/Go等）
- 仮想環境の作成方法（venv/poetry/pipenv等）
- 依存関係インストール手順（具体的なコマンド）
- サーバー起動方法（開発モード/本番モード）
- 環境変数設定（.envの例）
- APIドキュメント確認方法（Swagger等）

### devcontainer（.devcontainer設定）
以下の内容を含めてください：
- devcontainer.jsonの完全な設定例
- 必要なVS Code拡張機能リスト
- Dockerfileの設定（必要な場合）
- docker-compose.ymlの設定（必要な場合）
- ポートフォワーディング設定
- 起動時に実行するコマンド（postCreateCommand等）

### database（データベース）
以下の内容を含めてください：
- 推奨DBとそのバージョン
- Docker Composeでのローカル起動設定
- 接続文字列の例
- 初期マイグレーション手順
- シードデータ投入方法（あれば）
- GUIツールの推奨（pgAdmin, MySQL Workbench等）

### deploy（デプロイ）
以下の内容を含めてください：
- 推奨デプロイ先とその理由
- GitHub Actionsなど CI/CD設定例
- 本番環境変数の管理方法
- デプロイコマンド
- ドメイン設定方法
- 監視・ログ確認方法

{format_instructions}
"""
```

---

### 4. app.py への登録追加

```python
# app.py に以下を追加

# インポート追加
from routers import env_setup_agent

# ルーター登録追加
app.include_router(
    env_setup_agent.router,
    prefix="/api/env_setup",
    tags=["EnvSetupAgent"]
)
```

---

## フロントエンド実装

### 5. API連携サービス: `front/src/libs/service/envSetupService.ts`

```typescript
/**
 * 環境構築AIエージェント API連携サービス
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- 型定義 ---

export interface EnvSetupRequest {
  project_id: string;
}

export interface EnvSetupResponse {
  env_id: string;
  project_id: string;
  front: string | null;
  backend: string | null;
  devcontainer: string | null;
  database: string | null;
  deploy: string | null;
  message: string;
}

export interface EnvGetResponse {
  env_id: string;
  project_id: string;
  front: string | null;
  backend: string | null;
  devcontainer: string | null;
  database: string | null;
  deploy: string | null;
  created_at: string | null;
}

// --- API関数 ---

/**
 * 環境構築情報をAIで生成してDBに保存
 * @param projectId プロジェクトID
 * @returns 生成された環境構築情報
 */
export const generateEnvSetup = async (projectId: string): Promise<EnvSetupResponse> => {
  const response = await axios.post<EnvSetupResponse>(
    `${API_BASE_URL}/api/env_setup/generate`,
    { project_id: projectId },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * 環境構築情報を再生成（既存データを削除して再生成）
 * @param projectId プロジェクトID
 * @returns 再生成された環境構築情報
 */
export const regenerateEnvSetup = async (projectId: string): Promise<EnvSetupResponse> => {
  const response = await axios.post<EnvSetupResponse>(
    `${API_BASE_URL}/api/env_setup/regenerate/${projectId}`,
    {},
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * 環境構築情報を取得
 * @param projectId プロジェクトID
 * @returns 環境構築情報（存在しない場合は404エラー）
 */
export const getEnvSetup = async (projectId: string): Promise<EnvGetResponse> => {
  const response = await axios.get<EnvGetResponse>(
    `${API_BASE_URL}/api/env_setup/${projectId}`,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * 環境構築情報を取得（存在しない場合はnullを返す）
 * @param projectId プロジェクトID
 * @returns 環境構築情報またはnull
 */
export const getEnvSetupOrNull = async (projectId: string): Promise<EnvGetResponse | null> => {
  try {
    return await getEnvSetup(projectId);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * 環境構築情報を生成または取得
 * 既に存在する場合は取得、存在しない場合は生成
 * @param projectId プロジェクトID
 * @returns 環境構築情報
 */
export const getOrGenerateEnvSetup = async (projectId: string): Promise<EnvSetupResponse | EnvGetResponse> => {
  // まず既存データを確認
  const existing = await getEnvSetupOrNull(projectId);
  if (existing) {
    return existing;
  }

  // 存在しない場合は生成
  return await generateEnvSetup(projectId);
};
```

---

### 6. 型定義追加: `front/src/types/modelTypes.ts` に追記

```typescript
// --- EnvSetup Types (AI Generated) ---

export type EnvSetupRequest = {
  project_id: string;
};

export type EnvSetupResponse = {
  env_id: string;
  project_id: string;
  front: string | null;
  backend: string | null;
  devcontainer: string | null;
  database: string | null;
  deploy: string | null;
  message: string;
};

export type EnvGetResponse = {
  env_id: string;
  project_id: string;
  front: string | null;
  backend: string | null;
  devcontainer: string | null;
  database: string | null;
  deploy: string | null;
  created_at: string | null;
};
```

---

## 使用例（フロントエンド）

### Reactコンポーネントでの使用例

```tsx
'use client';

import { useState, useEffect } from 'react';
import {
  generateEnvSetup,
  getEnvSetupOrNull,
  regenerateEnvSetup,
  EnvGetResponse
} from '@/libs/service/envSetupService';
import ReactMarkdown from 'react-markdown';

interface EnvSetupPageProps {
  projectId: string;
}

export default function EnvSetupPage({ projectId }: EnvSetupPageProps) {
  const [envData, setEnvData] = useState<EnvGetResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'front' | 'backend' | 'devcontainer' | 'database' | 'deploy'>('front');

  // 初回読み込み
  useEffect(() => {
    const loadEnvSetup = async () => {
      setIsLoading(true);
      try {
        const data = await getEnvSetupOrNull(projectId);
        setEnvData(data);
      } catch (err) {
        setError('環境構築情報の取得に失敗しました');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEnvSetup();
  }, [projectId]);

  // 生成ハンドラー
  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateEnvSetup(projectId);
      setEnvData(result);
    } catch (err) {
      setError('環境構築情報の生成に失敗しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 再生成ハンドラー
  const handleRegenerate = async () => {
    if (!confirm('既存の環境構築情報を削除して再生成しますか？')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await regenerateEnvSetup(projectId);
      setEnvData(result);
    } catch (err) {
      setError('環境構築情報の再生成に失敗しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { key: 'front', label: 'フロントエンド' },
    { key: 'backend', label: 'バックエンド' },
    { key: 'devcontainer', label: 'DevContainer' },
    { key: 'database', label: 'データベース' },
    { key: 'deploy', label: 'デプロイ' },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">環境構築ガイド</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!envData ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">
            環境構築情報がまだ生成されていません
          </p>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? '生成中...' : 'AIで環境構築情報を生成'}
          </button>
        </div>
      ) : (
        <>
          {/* タブナビゲーション */}
          <div className="flex border-b mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* コンテンツ */}
          <div className="prose max-w-none">
            <ReactMarkdown>
              {envData[activeTab] || '情報がありません'}
            </ReactMarkdown>
          </div>

          {/* 再生成ボタン */}
          <div className="mt-8 pt-6 border-t">
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              {isLoading ? '再生成中...' : '環境構築情報を再生成'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## APIエンドポイント仕様

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| `POST` | `/api/env_setup/generate` | 環境構築情報を生成・保存 |
| `POST` | `/api/env_setup/regenerate/{project_id}` | 環境構築情報を再生成 |
| `GET` | `/api/env_setup/{project_id}` | 環境構築情報を取得 |

### リクエスト例

```bash
# 生成
curl -X POST http://localhost:8000/api/env_setup/generate \
  -H "Content-Type: application/json" \
  -d '{"project_id": "550e8400-e29b-41d4-a716-446655440000"}'

# 再生成
curl -X POST http://localhost:8000/api/env_setup/regenerate/550e8400-e29b-41d4-a716-446655440000

# 取得
curl http://localhost:8000/api/env_setup/550e8400-e29b-41d4-a716-446655440000
```

### レスポンス例

```json
{
  "env_id": "660e8400-e29b-41d4-a716-446655440001",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "front": "## フロントエンド環境構築\n\n### Node.js バージョン\n...",
  "backend": "## バックエンド環境構築\n\n### Python バージョン\n...",
  "devcontainer": "## DevContainer 設定\n\n### devcontainer.json\n...",
  "database": "## データベース環境構築\n\n### PostgreSQL\n...",
  "deploy": "## デプロイ設定\n\n### Vercel\n...",
  "message": "環境構築情報を生成・保存しました"
}
```

---

## エラーハンドリング

| HTTPステータス | エラーケース | レスポンス例 |
|----------------|--------------|--------------|
| 404 | project_idが存在しない | `{"detail": "frame_work_doc not found for project: xxx"}` |
| 404 | Envデータが存在しない | `{"detail": "環境構築情報が見つかりません: project_id=xxx"}` |
| 500 | AI生成失敗 | `{"detail": "生成に失敗しました: ..."}` |
| 500 | DB保存失敗 | `{"detail": "生成に失敗しました: ..."}` |

---

## 実装手順

### Phase 1: バックエンド実装
1. `services/env_setup_agent_service.py` を作成
2. `services/prompts.toml` にプロンプト追加
3. `routers/env_setup_agent.py` を作成
4. `app.py` にルーター登録
5. API動作確認（curl/Swagger）

### Phase 2: フロントエンド実装
1. `front/src/libs/service/envSetupService.ts` を作成
2. `front/src/types/modelTypes.ts` に型定義追加
3. 環境構築ページでのUI実装

### Phase 3: テスト・動作確認
1. 単体テスト作成
2. E2Eテスト
3. エラーケースの確認

---

## 補足: 既存サービスとの違い

| サービス | 用途 | DB保存 |
|----------|------|--------|
| `EnvironmentService` | ハンズオン説明生成（表示用） | なし |
| `EnvSetupAgentService`（新規） | 環境構築情報生成 + DB保存 | **あり** |

`EnvironmentService`は表示用の詳細説明を生成するのに対し、
`EnvSetupAgentService`は構造化された環境構築情報をDBに永続化することで、
後続のタスク生成やチャットボットでの参照を可能にする。
