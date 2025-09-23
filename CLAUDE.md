
# CLAUDE.md

このファイルは、このリポジトリでコードを扱う際に Claude Code（claude.ai/code）へ提供するガイドです。

## プロジェクト概要

このプロジェクトは、**ハッカソンサポートエージェント** アプリケーションです。  
チームがハッカソンのプロジェクトを計画・実行する際に役立つもので、**FastAPI バックエンド**と **Next.js フロントエンド**を備えたフルスタック構成となっています。  
AI によるプロジェクト計画支援、タスク生成、開発ワークフロー管理を提供します。

## アーキテクチャ

### バックエンド（`/back`）

-   **フレームワーク**: FastAPI + SQLAlchemy ORM + Uvicorn ASGI

-   **データベース**: PostgreSQL + psycopg2-binary

-   **AI連携**: LangChain + Google Gemini API + OpenAI + Anthropic Claude

-   **認証・セキュリティ**: CORS対応、環境変数管理

### バックエンド詳細仕様

#### **アーキテクチャ構成**
```
/back/
├── app.py                    # FastAPI メインアプリケーション・ルーター統合
├── database.py               # PostgreSQL接続・SQLAlchemyセッション管理
├── create_tables.py          # データベーステーブル初期化スクリプト
├── routers/                  # 機能別APIルーター群
│   ├── project/             # コアエンティティCRUD操作
│   │   ├── project.py       # プロジェクト基本情報管理
│   │   ├── member.py        # メンバー管理
│   │   ├── project_document.py # プロジェクト文書管理
│   │   ├── env.py           # 開発環境設定
│   │   ├── task.py          # タスク管理
│   │   ├── task_assignment.py # タスク割り当て
│   │   ├── project_member.py # プロジェクトメンバー関連付け
│   │   └── project_qa.py    # Q&A管理
│   ├── question.py          # AI Q&A生成サービス
│   ├── summary.py           # AI要約生成サービス
│   ├── framework.py         # AI技術選定サービス
│   ├── get_object_and_tasks.py # AIタスク分解サービス
│   ├── directory.py         # AIディレクトリ構造生成
│   ├── environment.py       # AI環境構築手順生成
│   ├── taskDetail.py        # AIタスク詳細生成
│   ├── taskChat.py          # AI開発支援チャット
│   ├── graphTask.py         # AIタスク依存関係分析
│   ├── durationTask.py      # AI開発期間見積
│   ├── deploy.py            # AIデプロイ設定生成
│   ├── function_requirements.py # AI機能要件生成
│   └── technology.py        # AI技術サポート
├── services/                # AIサービス基盤
│   ├── base_service.py      # AI統合ベースクラス
│   └── prompt_manager.py    # プロンプト管理（TOML設定）
└── requirements.txt         # Python依存パッケージ
```

#### **AI統合アーキテクチャ**
-   **LangChain Framework** : AI統合・プロンプトエンジニアリング基盤
-   **Multi-LLM Support** : Google Gemini（メイン）+ OpenAI + Anthropic Claude
-   **Structured Output** : JSON Schema バリデーション・型安全性
-   **Prompt Management** : TOML形式での段階的プロンプト管理
-   **Service Layer Pattern** : `BaseService` 継承によるAI サービス統一化

#### **主要依存パッケージ詳細**
```python
# Web Framework
fastapi              # 高性能Webフレームワーク
uvicorn              # ASGI Webサーバー

# Database
sqlalchemy          # Python ORM
psycopg2-binary     # PostgreSQL接続ドライバー
alembic             # データベースマイグレーション

# AI Integration
langchain           # AI統合フレームワーク
langchain-google-genai # Google Gemini API連携
langchain_openai    # OpenAI API連携
langchain_anthropic # Anthropic Claude API連携

# Data Processing
pydantic           # データ検証・シリアライゼーション
python-multipart   # フォームデータ処理
python-dotenv      # 環境変数管理

# Utilities
uuid               # UUID生成・管理
datetime           # 日時処理
json               # JSON処理
toml               # 設定ファイル管理
```

#### **AI サービス設計パターン**
```python
class BaseService:
    """AI統合サービス基底クラス"""

    def __init__(self):
        self.gemini_llm = ChatGoogleGenerativeAI()
        self.openai_llm = ChatOpenAI()
        self.anthropic_llm = ChatAnthropic()

    def generate_with_structured_output(self, prompt, schema):
        """構造化出力でのAI生成"""
        pass

    def multi_llm_consensus(self, prompt):
        """複数LLMでの合意形成生成"""
        pass
```
        

### フロントエンド（`/front`）

-   **フレームワーク**: Next.js 15.3.1 + React 19.0.0（最新版）

-   **ビルドツール**: Turbopack（開発時高速化）

-   **スタイリング**: Tailwind CSS 4.1.4

-   **認証**: NextAuth.js 4.24.11（GitHub OAuth対応）

-   **状態管理**: SWR 2.3.6（サーバー状態） + React Hooks（ローカル状態）

-   **UIコンポーネント**: BlockNote 0.39.1（リッチテキスト）、Lucide React 0.503.0（アイコン）

-   **フォーム管理**: React Hook Form 7.60.0 + Zod 3.25.76（バリデーション）

-   **AI統合**: AI SDK 2.0系（Google/OpenAI/React対応）

-   **開発ツール**: Storybook、Vitest（テスト）、Prettier（フォーマット）

### フロントエンド詳細仕様

#### **ページ構造（App Router）**
```
/src/app/
├── page.tsx                           # ランディングページ
├── layout.tsx                         # ルートレイアウト
├── dashbordTest/                      # ダッシュボードテスト環境
├── member/                            # メンバー管理
├── project/[taskid]/                  # タスク詳細ページ
├── pojectRepository/                  # プロジェクト一覧・リポジトリ
└── hackSetUp/[ProjectId]/            # プロジェクト構築ワークフロー
    ├── hackQA/                       # AI Q&A生成ステップ
    ├── summaryQA/                    # Q&A要約・整理ステップ
    ├── functionSummary/              # 機能仕様書生成ステップ
    ├── selectFramework/              # 技術スタック選定ステップ
    ├── taskDivision/                 # タスク分解・計画ステップ
    ├── member/                       # メンバーアサイン管理
    ├── documentDashbord/             # ドキュメント管理ダッシュボード
    ├── technologyDoucment/           # 技術文書管理
    └── setUpSummary/                 # セットアップ要約・完了確認
```

#### **主要コンポーネント設計**
-   **SpecificationEditor** : 仕様書リッチテキスト編集（BlockNote）
-   **TechnologyEditor** : フレームワーク・技術選定インターフェース
-   **QASection** : Q&A管理・表示・編集コンポーネント
-   **TaskCard** : タスク表示・管理カード（優先度・依存関係対応）
-   **ConfidenceIndicator** : AI生成内容の信頼度可視化
-   **BaseEditor/Editor** : BlockNote ベースの汎用リッチテキストエディタ
-   **Session/Header** : NextAuth認証ヘッダー・ナビゲーション

#### **技術スタック詳細**
```json
{
  "framework": {
    "next": "15.3.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.2"
  },
  "ai_integration": {
    "@ai-sdk/google": "^2.0.15",
    "@ai-sdk/openai": "^2.0.32",
    "@ai-sdk/react": "^2.0.48",
    "ai": "^5.0.48"
  },
  "ui_components": {
    "@blocknote/react": "^0.39.1",
    "lucide-react": "^0.503.0",
    "tailwindcss": "^4.1.4"
  },
  "authentication": {
    "next-auth": "^4.24.11"
  },
  "forms_validation": {
    "react-hook-form": "^7.60.0",
    "@hookform/resolvers": "^5.1.1",
    "zod": "^3.25.76"
  },
  "data_fetching": {
    "swr": "^2.3.6",
    "axios": "^1.12.2"
  },
  "development_tools": {
    "@storybook/react": "^8.5.3",
    "vitest": "^2.1.8",
    "eslint": "^8.57.1",
    "prettier": "^3.4.1"
  }
}
```

#### **状態管理設計**
-   **SWR** : APIデータフェッチ・キャッシュ・リアルタイム更新
-   **React State** : ローカルUI状態（フォーム、モーダル、一時的状態）
-   **NextAuth Session** : 認証状態・ユーザー情報
-   **Context API** : グローバル設定・テーマ管理
    

## 開発用コマンド

### バックエンド

```bash
# 初回セットアップ
cd back
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python create_tables.py  # DBテーブル初期化

# 開発サーバー起動
cd back
source venv/bin/activate
python app.py  # http://localhost:8000
```

### フロントエンド

```bash
# 初回セットアップ
cd front
npm install

# 開発サーバー起動
npm run dev  # http://localhost:3000 (Turbopack)

# コード品質管理
npm run lint       # ESLint
npm run format     # Prettier
npm run build      # 本番ビルド
```

### テスト

```bash
# フロントエンドテスト
npm run test       # Vitest
npm run storybook  # コンポーネント開発用
```

## 環境変数の設定

### バックエンド（`/back/.env`）

```ini
DATABASE_URL="postgresql://hack_helper:hackathon@db/hackathon_support_agent"
GOOGLE_API_KEY="あなたのGoogle APIキー"
```

### フロントエンド（`/front/.env`）

```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_NEXT_API_URL=http://localhost:3000/api
GITHUB_ID="GitHubから取得したID"
GITHUB_SECRET="GitHubから取得したSecret"
NEXTAUTH_SECRET="自分でランダムに生成した文字列"
```

## データベース設計（PostgreSQL + SQLAlchemy）

### 主要エンティティスキーマ

#### **MemberBase（ユーザー管理）**
```sql
- member_id (UUID, PRIMARY KEY) : ユーザー一意識別子
- member_name (VARCHAR) : 表示名
- member_skill (TEXT) : スキル・専門分野情報
- github_name (VARCHAR) : GitHub ユーザー名
- email (VARCHAR) : メールアドレス
```

#### **ProjectBase（プロジェクト基本情報）**
```sql
- project_id (UUID, PRIMARY KEY) : プロジェクト一意識別子
- title (VARCHAR) : プロジェクトタイトル
- idea (TEXT) : プロジェクトアイデア・概要
- start_date (DATE) : 開始予定日
- end_date (DATE) : 終了予定日
- num_people (INTEGER) : 想定チーム人数
```

#### **ProjectMember（プロジェクト-メンバー関連）**
```sql
- project_member_id (UUID, PRIMARY KEY) : 関連一意識別子
- project_id (UUID, FOREIGN KEY) : プロジェクト参照
- member_id (UUID, FOREIGN KEY) : メンバー参照
- member_name (VARCHAR) : 関連時点でのメンバー名
```

#### **ProjectDocument（プロジェクト文書）**
```sql
- doc_id (UUID, PRIMARY KEY) : ドキュメント一意識別子
- project_id (UUID, FOREIGN KEY) : プロジェクト参照
- specification (TEXT) : AI生成仕様書
- function_doc (TEXT) : 機能仕様書
- frame_work_doc (TEXT) : 技術選定・フレームワーク情報
- directory_info (TEXT) : ディレクトリ構造情報
```

#### **Env（開発環境設定）**
```sql
- env_id (UUID, PRIMARY KEY) : 環境設定一意識別子
- project_id (UUID, FOREIGN KEY) : プロジェクト参照
- front (TEXT) : フロントエンド環境構築手順
- backend (TEXT) : バックエンド環境構築手順
- devcontainer (TEXT) : Dev Container設定
- database (TEXT) : データベース設定
- deploy (TEXT) : デプロイ設定
```

#### **Task（タスク管理）**
```sql
- task_id (UUID, PRIMARY KEY) : タスク一意識別子
- project_id (UUID, FOREIGN KEY) : プロジェクト参照
- title (VARCHAR) : タスクタイトル
- description (TEXT) : タスク概要
- detail (TEXT) : 詳細実装指針
- status (VARCHAR) : 進行状況（pending/in_progress/completed）
- priority (INTEGER) : 優先度
- due_at (DATETIME) : 期限
- depends_on_task_id (UUID, FOREIGN KEY) : 依存タスク参照
- source_doc_id (UUID, FOREIGN KEY) : 生成元ドキュメント参照
```

#### **TaskAssignment（タスク割り当て）**
```sql
- task_assignment_id (UUID, PRIMARY KEY) : 割り当て一意識別子
- task_id (UUID, FOREIGN KEY) : タスク参照
- project_member_id (UUID, FOREIGN KEY) : プロジェクトメンバー参照
- assigned_at (DATETIME) : 割り当て日時
- role (VARCHAR) : 担当役割
```

#### **QA（Q&A管理）**
```sql
- qa_id (UUID, PRIMARY KEY) : Q&A一意識別子
- project_id (UUID, FOREIGN KEY) : プロジェクト参照
- question (TEXT) : 質問内容
- answer (TEXT) : 回答内容
- is_ai (BOOLEAN) : AI生成フラグ
- source_doc_id (UUID, FOREIGN KEY) : 生成元ドキュメント参照
- follows_qa_id (UUID, FOREIGN KEY) : 関連Q&A参照
- importance (INTEGER) : 重要度
```
    

## APIアーキテクチャ

### AI連携サービス（`/api/`）

#### AI生成エンドポイント
-   **`POST /api/question/{project_id}`** : プロジェクトアイデアからQ&A自動生成
-   **`POST /api/summary`** : Q&A回答から仕様要約生成
-   **`POST /api/framework`** : 技術スタック推薦・選定支援
-   **`POST /api/get_object_and_tasks`** : 仕様書からタスク自動分解
-   **`POST /api/directory`** : プロジェクト構造・ディレクトリ設計
-   **`POST /api/environment`** : 開発環境構築手順生成
-   **`POST /api/taskDetail`** : タスク詳細仕様・実装指針生成
-   **`POST /api/taskChat`** : タスク特化型AI開発支援チャット
-   **`POST /api/graphTask`** : タスク依存関係グラフ分析
-   **`POST /api/durationTask`** : 開発期間・工数見積算出
-   **`POST /api/deploy`** : デプロイ設定・CI/CD構成生成
-   **`POST /api/function_requirements`** : 機能要件定義生成
-   **`POST /api/technology`** : 技術選定支援・ガイダンス

### データベース管理API（RESTful CRUD）

#### コアエンティティ管理
-   **`/project`** : プロジェクト基本情報管理
    - `POST` : 新規プロジェクト作成
    - `GET /{project_id}` : プロジェクト詳細取得
    - `PUT /{project_id}` : プロジェクト全体更新
    - `PATCH /{project_id}` : プロジェクト部分更新
    - `DELETE /{project_id}` : プロジェクト削除

-   **`/member`** : メンバー・ユーザー管理
    - `POST` : 新規メンバー登録
    - `GET /{member_id}` : メンバー情報取得
    - `PUT /{member_id}` : メンバー情報更新
    - `DELETE /{member_id}` : メンバー削除

-   **`/project_document`** : プロジェクト文書管理
    - `POST` : 仕様書・ドキュメント保存
    - `GET /{doc_id}` : ドキュメント取得
    - `PUT /{doc_id}` : ドキュメント更新

-   **`/env`** : 開発環境設定管理
    - `POST` : 環境設定保存
    - `GET /{env_id}` : 環境設定取得
    - `PUT /{env_id}` : 環境設定更新

-   **`/task`** : タスク管理
    - `POST` : 新規タスク作成
    - `GET /{task_id}` : タスク詳細取得
    - `PUT /{task_id}` : タスク更新
    - `DELETE /{task_id}` : タスク削除

-   **`/task_assignment`** : タスク割り当て管理
    - `POST` : タスク担当者アサイン
    - `GET /{assignment_id}` : アサイン情報取得
    - `DELETE /{assignment_id}` : アサイン解除

-   **`/project_member`** : プロジェクトメンバー関連付け
    - `POST` : メンバーをプロジェクトに追加
    - `GET /{project_member_id}` : メンバー関連付け取得
    - `DELETE /{project_member_id}` : メンバー関連付け削除

-   **`/project_qa`** : Q&A管理
    - `POST` : Q&A保存
    - `GET /{qa_id}` : Q&A取得
    - `PUT /{qa_id}` : Q&A更新
    - `DELETE /{qa_id}` : Q&A削除

## 主要依存パッケージ

### バックエンド

-   `fastapi` - Webフレームワーク
    
-   `sqlalchemy` - ORM
    
-   `langchain` - AI統合
    
-   `langchain-google-genai` - Google Gemini連携
    
-   `psycopg2-binary` - PostgreSQL接続
    

### フロントエンド

-   `@blocknote/react` - リッチテキストエディタ
    
-   `next-auth` - 認証
    
-   `swr` - データ取得とキャッシュ
    
-   `react-hook-form` + `zod` - フォーム管理・バリデーション
    
-   `axios` - HTTPクライアント
    

## AI駆動開発ワークフロー

### 1. **プロジェクト初期化フェーズ**
-   **入力**: プロジェクトアイデア、チーム人数、開発期間
-   **処理**: `/api/question/{project_id}` でAI質問生成
-   **出力**: プロジェクト要件明確化のためのQ&A

### 2. **要件定義・仕様策定フェーズ**
-   **入力**: ユーザー回答済みQ&A
-   **処理**: `/api/summary` → `/api/function_requirements` でAI仕様書生成
-   **出力**: 詳細プロジェクト仕様書・機能要件書

### 3. **技術選定・アーキテクチャ設計フェーズ**
-   **入力**: プロジェクト仕様書
-   **処理**: `/api/framework` → `/api/directory` でAI技術推薦
-   **出力**: 最適技術スタック・プロジェクト構造

### 4. **タスク分解・計画策定フェーズ**
-   **入力**: 仕様書・技術選定結果
-   **処理**: `/api/get_object_and_tasks` → `/api/graphTask` → `/api/durationTask`
-   **出力**: 依存関係付きタスクリスト・開発期間見積

### 5. **環境構築・セットアップフェーズ**
-   **入力**: 技術スタック・プロジェクト構造
-   **処理**: `/api/environment` → `/api/deploy`
-   **出力**: ステップごと環境構築手順・デプロイ設定

### 6. **開発実行・継続支援フェーズ**
-   **機能**: `/api/taskDetail` でタスク詳細生成
-   **機能**: `/api/taskChat` でタスク特化AI支援
-   **管理**: タスク進捗管理・メンバーアサイン

## 主要AI機能詳細

### **インテリジェント質問生成**
-   プロジェクトアイデアから要件を洗い出す質問を自動生成
-   重要度・依存関係を考慮した段階的質問設計
-   ユーザーの技術レベルに応じた質問難易度調整

### **仕様書自動生成**
-   Q&A から包括的プロジェクト仕様書を生成
-   機能要件・非機能要件の自動分類
-   ユーザーストーリー・受け入れ条件の生成

### **技術選定AI**
-   プロジェクト要件から最適技術スタックを推薦
-   チーム技術レベル・開発期間を考慮した提案
-   技術選択理由・学習コスト・将来性の解説

### **インテリジェントタスク分解**
-   仕様書から具体的開発タスクを自動生成
-   タスク間依存関係の自動検出・グラフ化
-   優先度・難易度・工数見積の自動算出

### **開発支援チャット**
-   タスク特化型AI支援（実装方針・デバッグ支援）
-   コード生成・レビュー・最適化提案
-   技術的問題解決・ベストプラクティス提案
    

## ファイル構成の特徴

-   バックエンドは**機能単位のルーティング**を採用（DB操作とAIサービスを分離）
    
-   フロントエンドは**Next.js App Router**と**共置コンポーネント構成**
    
-   型やユーティリティはドメイン（project、task、memberなど）ごとに整理
    
-   Storybook のストーリーはコンポーネントと同じ階層で管理し、デザインシステムの一貫性を確保
    