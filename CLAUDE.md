
# CLAUDE.md

このファイルは、このリポジトリでコードを扱う際に Claude Code（claude.ai/code）へ提供するガイドです。

## プロジェクト概要

このプロジェクトは、**ハッカソンサポートエージェント** アプリケーションです。  
チームがハッカソンのプロジェクトを計画・実行する際に役立つもので、**FastAPI バックエンド**と **Next.js フロントエンド**を備えたフルスタック構成となっています。  
AI によるプロジェクト計画支援、タスク生成、開発ワークフロー管理を提供します。

## アーキテクチャ

### バックエンド（`/back`）

-   **フレームワーク**: FastAPI + SQLAlchemy ORM
    
-   **データベース**: PostgreSQL
    
-   **AI連携**: Google Gemini API、LangChain、Anthropic Claude
    
-   **構成**:
    
    -   `app.py` : FastAPI メインアプリ（ルーター登録）
        
    -   `database.py` : DB接続・セッション管理
        
    -   `routers/` : 機能別のAPIエンドポイント群
        
    -   `routers/project/` : コアエンティティのCRUD処理
        
    -   その他 : Q&A、要約、タスク生成など AI サービス系ルーター
        

### フロントエンド（`/front`）

-   **フレームワーク**: Next.js 15 + React 19
    
-   **スタイリング**: Tailwind CSS
    
-   **認証**: NextAuth.js（GitHub OAuth対応）
    
-   **状態管理**: SWR
    
-   **UIコンポーネント**: BlockNote（リッチテキスト）、Lucide React（アイコン）
    
-   **開発ツール**: Storybook、Vitest（テスト）、Prettier（フォーマット）
    

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

## データベース設計

主要なエンティティ：

-   **MEMBER**: ユーザー管理（GitHub連携）
    
-   **PROJECT_BASE**: プロジェクト情報（タイトル、アイデア、期間、人数）

-   **PROJECT_MEMBER**: プロジェクトとメンバーの多対多関係

-   **PROJECT_DOCUMENT**: 仕様書・フレームワーク・ディレクトリ構造などの生成ドキュメント

-   **TASK**: タスク情報（依存関係・優先度・担当など）
    
-   **QA**: AI生成またはユーザーの Q&A
    
-   **ENV**: 開発環境設定情報
    

## APIアーキテクチャ

### AI連携サービス（`/api/`）

-   `/api/question` : アイデアからQ&A生成
    
-   `/api/summary` : Q&Aから仕様要約
    
-   `/api/framework` : 技術スタックの提案
    
-   `/api/get_object_and_tasks` : 仕様からタスク自動生成
    
-   `/api/directory` : ディレクトリ構造生成
    
-   `/api/environment` : 開発環境設定手順
    
-   `/api/taskDetail` : タスク詳細生成
    
-   `/api/taskChat` : 開発支援用AIチャット
    
-   `/api/graphTask` : タスク依存関係分析
    
-   `/api/durationTask` : 開発期間見積
    
-   `/api/deploy` : デプロイ設定
    

### データベース管理API

すべての主要エンティティに対して標準的な REST 形式の CRUD API を提供。  
詳細は `/back/README.md` を参照。

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
    

## 開発フロー

1.  **プロジェクト作成**: ユーザーがアイデア・チーム情報を入力
    
2.  **AIによるQ&A**: 要件を洗練する質問を自動生成
    
3.  **仕様書生成**: 完全なプロジェクト仕様書を自動作成
    
4.  **技術選定**: AIが適切な技術スタックを提案
    
5.  **タスク分解**: 依存関係付きの詳細タスクを生成
    
6.  **環境構築**: ステップごとの環境構築手順を提示
    
7.  **開発支援**: タスクチャットで継続的にAIがサポート
    

## ファイル構成の特徴

-   バックエンドは**機能単位のルーティング**を採用（DB操作とAIサービスを分離）
    
-   フロントエンドは**Next.js App Router**と**共置コンポーネント構成**
    
-   型やユーティリティはドメイン（project、task、memberなど）ごとに整理
    
-   Storybook のストーリーはコンポーネントと同じ階層で管理し、デザインシステムの一貫性を確保
    