# バックエンド APIドキュメント

このドキュメントは、バックエンドAPIの仕様をまとめたものです。

## ディレクトリ構成サマリ (@back)

LLMと人間の両方が把握しやすいように、完全なパスリストと役割表を併記しています。

```text
.
├─ __pycache__
│  ├─ app.cpython-311.pyc
│  ├─ app.cpython-312.pyc
│  ├─ create_tables.cpython-312.pyc
│  ├─ database.cpython-311.pyc
│  └─ database.cpython-312.pyc
├─ memo
│  ├─ __pycache__
│  │  └─ memo.cpython-312.pyc
│  └─ memo.py
├─ models
│  ├─ __pycache__
│  │  ├─ project.cpython-311.pyc
│  │  ├─ project_base.cpython-311.pyc
│  │  ├─ project_base.cpython-312.pyc
│  │  └─ project_legacy.cpython-311.pyc
│  └─ project_base.py
├─ routers
│  ├─ project
│  ├─ __init__.py
│  ├─ base_service.py
│  ├─ deploy_service.py
│  ├─ directory_service.py
│  ├─ durationTask_service.py
│  ├─ environment_service.py
│  ├─ framework_service.py
│  ├─ function_service.py
│  ├─ graphTask_service.py
│  ├─ mvp_judge_service.py
│  ├─ prompts.toml
│  ├─ question_service.py
│  ├─ summary_service.py
│  ├─ taskChat_service.py
│  ├─ taskDetail_service.py
│  ├─ tasks_service.py
│  └─ technology_service.py
├─ .env.local
├─ .gitignore
├─ README.md
├─ app.log
├─ app.py
├─ create_tables.py
├─ database.py
├─ package-lock.json
└─ requirements.txt
```

### モジュール役割クイックリファレンス

| Path | 役割 |
| :--- | :--- |
| `app.py` | FastAPIアプリのエントリポイント。全ルーター登録とCORS設定を管理。 |
| `database.py` | SQLAlchemyエンジン・Session生成と`Base`メタデータを提供。 |
| `create_tables.py` | モデルからテーブルを作成するユーティリティスクリプト。 |
| `models/project_base.py` | プロジェクト管理に関わるSQLAlchemyモデル一式。 |
| `routers/` | 生成系APIとプロジェクト管理APIを公開するFastAPIルーター群。 |
| `routers/project/` | プロジェクト・メンバー・タスク等のCRUD用サブルーター。 |
| `services/` | 各種LLM呼び出しとプロンプト管理を行うサービス層。 |
| `services/base_service.py` | LLMクライアント初期化・プロンプト読み込み・共通ロギングの基底クラス。 |
| `services/prompts.toml` | サービス毎のテンプレートプロンプト定義。 |
| `memo/memo.py` | 簡易メモAPI。仕様検証用の補助モジュール。 |
| `.env.local` | LLM/APIキーやロギング設定を読み込む環境変数ファイル。 |
| `requirements.txt` | Python依存パッケージ。 |
| `package-lock.json` | Node依存（フロント連携やビルドツール用）のロックファイル。 |
| `app.log` | LLMサービス層のロギング出力。ローテーション設定は環境変数で制御。 |
| `README.md` | API仕様と本構造サマリ。 |

### 備考

- `__pycache__` 配下はPython実行時に生成されるバイトコードで、デプロイやレビューの対象外です。
- 生成AIの挙動やプロンプトを調整する場合は `services/prompts.toml` と各 `*_service.py` を併読すると意図が掴みやすくなります。
- ローカル実行時は `LOG_FILE` など環境変数を `.env.local` で制御し、開発者間でのキー共有には注意してください。


## 1. AI生成系API

LLMを利用して、アイデアや仕様書から具体的な成果物（タスク、ディレクトリ構成、各種ドキュメントなど）を生成するAPI群です。

| エンドポイント | メソッド | 説明 | 入力形式 (Body) | 出力形式 (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| `/qas/{project_id}` | `POST` | プロジェクトのアイデアを受け取り、想定Q&Aを生成・保存します。 | `{"Prompt": "string"}` | `{"result": {"QA": [{"question": "string", "answer": "string", ...}]}}` |
| `/summary` | `POST` | Q&Aのリストを受け取り、要約ドキュメントを生成します。 | `{"Answer": [{"Question": "string", "Answer": "string"}]}` | `{"summary": "string"}` |
| `/framework` | `POST` | 仕様書を受け取り、推奨フレームワークの優先順位を返します。 | `{"framework": "string", "specification": "string"}` | `{"frontend": [...], "backend": [...]}` |
| `/framework/document` | `POST` | 仕様書とフレームワークを受け取り、技術要件書を生成します。 | `{"framework": "string", "specification": "string"}` | `{"document": "string"}` |
| `/tasks` | `POST` | 仕様書、ディレクトリ構成、フレームワーク情報を受け取り、タスクリストを生成します。 | `{"specification": "string", "directory": "string", "framework": "string"}` | `{"tasks": [{"task_name": "string", "priority": "string", "content": "string"}]}` |
| `/taskDetail` | `POST` | タスクリストと仕様書を受け取り、各タスクの詳細を生成します。 | `{"tasks": [{"task_id": "string", ...}], "specification": "string"}` | `{"tasks": [{"task_id": "string", "detail": "string", ...}]}` |
| `/durationTask` | `POST` | タスクリストとプロジェクト期間を受け取り、各タスクの開始・終了日を算出します。 | `{"duration": "string", "task_info": ["json_string"]}` | `{"durations": [{"task_id": "string", "start_date": "string", "end_date": "string"}]}` |
| `/graphTask` | `POST` | タスクリストを受け取り、タスク間の依存関係を生成します。 | `{"task_info": ["json_string"]}` | `{"edges": [{"source": "string", "target": "string"}]}` |
| `/directory` | `POST` | 仕様書とフレームワークを受け取り、ディレクトリ構成案を生成します。 | `{"framework": "string", "specification": "string"}` | `{"directory_structure": "string"}` |
| `/environment` | `POST` | 仕様書、ディレクトリ構成、フレームワークを受け取り、環境構築手順を生成します。 | `{"specification": "string", "directory": "string", "framework": "string"}` | `{"overall": "string", "devcontainer": "string", ...}` |
| `/deploy` | `POST` | 仕様書とフレームワークを受け取り、デプロイ構成案を生成します。 | `{"framework": "string", "specification": "string"}` | `{"deploy_structure": "string"}` |
| `/taskChat` | `POST` | チャット履歴やタスク詳細などを受け取り、AIアシスタントの応答を生成します。 | `{"specification": "string", "directory_structure": "string", ...}` | `{"response": "string"}` |

---

## 2. プロジェクト管理系API

プロジェクトの基本的なデータ（プロジェクト自体、メンバー、ドキュメント、環境情報など）を管理するCRUD API群です。

### 2.1. プロジェクト (`/project`)

| エンドポイント | メソッド | 説明 | 入力形式 | 出力形式 (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| `/project` | `POST` | プロジェクトを新規作成 | **Body**: `ProjectBaseType` | `{"project_id": "uuid", "message": "string"}` |
| `/project/{id}` | `GET` | プロジェクトを取得 | **Path**: `id: uuid` | `ProjectBase` オブジェクト |
| `/project/{id}` | `PUT` | プロジェクトを更新 | **Path**: `id: uuid`, **Body**: `ProjectBaseType` | `{"message": "string"}` |
| `/project/{id}` | `PATCH` | プロジェクトを部分更新 | **Path**: `id: uuid`, **Body**: `ProjectPatch` | `{"message": "string"}` |
| `/project/{id}` | `DELETE` | プロジェクトを削除 | **Path**: `id: uuid` | `{"message": "string"}` |
| `/projectsAll` | `GET` | 全プロジェクトを取得 | - | `List[ProjectBase]` |

### 2.2. メンバー (`/member`)

| エンドポイント | メソッド | 説明 | 入力形式 | 出力形式 (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| `/member` | `POST` | メンバーを新規作成 | **Body**: `MemberType` | `{"member_id": "uuid", "message": "string"}` |
| `/member/id/{id}` | `GET` | IDでメンバーを取得 | **Path**: `id: uuid` | `MemberBase` オブジェクト |
| `/member/{github}` | `GET` | GitHub名でメンバーを取得 | **Path**: `github: str` | `MemberBase` オブジェクト |
| `/members` | `GET` | 全メンバーを取得 | - | `List[{"member_id": "uuid", ...}]` |
| `/member/id/{id}` | `PUT` | IDでメンバーを更新 | **Path**: `id: uuid`, **Body**: `MemberType` | `{"message": "string"}` |
| `/member/{github}` | `PUT` | GitHub名でメンバーを更新 | **Path**: `github: str`, **Body**: `MemberType` | `{"message": "string"}` |
| `/member/id/{id}` | `PATCH` | IDでメンバーを部分更新 | **Path**: `id: uuid`, **Body**: `MemberPatch` | `{"message": "string"}` |
| `/member/id/{id}` | `DELETE` | IDでメンバーを削除 | **Path**: `id: uuid` | `{"message": "string"}` |
| `/member/{github}` | `DELETE` | GitHub名でメンバーを削除 | **Path**: `github: str` | `{"message": "string"}` |

### 2.3. プロジェクトメンバー (`/project_member`)

| エンドポイント | メソッド | 説明 | 入力形式 | 出力形式 (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| `/project_member` | `POST` | プロジェクトにメンバーを割り当て | **Body**: `ProjectMemberType` | `{"project_member_id": "uuid", ...}` |
| `/project_member/{id}` | `GET` | 割当情報を取得 | **Path**: `id: uuid` | `ProjectMember` オブジェクト |
| `/project_member/project/{id}` | `GET` | プロジェクトIDでメンバーリストを取得 | **Path**: `id: uuid` | `List[ProjectMember]` |
| `/project_member/{id}` | `PUT` | 割当情報を更新 | **Path**: `id: uuid`, **Body**: `ProjectMemberType` | `{"message": "string"}` |
| `/project_member/{id}` | `PATCH` | 割当情報を部分更新 | **Path**: `id: uuid`, **Body**: `ProjectMemberPatch` | `{"message": "string"}` |
| `/project_member/{id}` | `DELETE` | 割当情報を削除 | **Path**: `id: uuid` | `{"message": "string"}` |

### 2.4. プロジェクトドキュメント (`/project_document`)

| エンドポイント | メソッド | 説明 | 入力形式 | 出力形式 (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| `/project_document` | `POST` | ドキュメントを作成 | **Body**: `ProjectDocumentType` | `{"project_id": "uuid", ...}` |
| `/project_document/{id}` | `GET` | プロジェクトIDでドキュメントを取得 | **Path**: `id: uuid` | `ProjectDocument` オブジェクト |
| `/project_document/id/{id}` | `GET` | ドキュメントIDでドキュメントを取得 | **Path**: `id: uuid` | `ProjectDocument` オブジェクト |
| `/project_document/{id}` | `PUT` | プロジェクトIDでドキュメントを更新 | **Path**: `id: uuid`, **Body**: `ProjectDocumentType` | `{"project_id": "uuid", ...}` |
| `/project_document/id/{id}` | `PUT` | ドキュメントIDでドキュメントを更新 | **Path**: `id: uuid`, **Body**: `ProjectDocumentType` | `{"doc_id": "uuid", ...}` |
| `/project_document/{id}` | `PATCH` | プロジェクトIDでドキュメントを部分更新 | **Path**: `id: uuid`, **Body**: `ProjectDocumentPatch` | `{"project_id": "uuid", ...}` |
| `/project_document/{id}` | `DELETE` | プロジェクトIDでドキュメントを削除 | **Path**: `id: uuid` | `{"project_id": "uuid", ...}` |
| `/project_document/id/{id}` | `DELETE` | ドキュメントIDでドキュメントを削除 | **Path**: `id: uuid` | `{"doc_id": "uuid", ...}` |

### 2.5. 環境情報 (`/env`)

| エンドポイント | メソッド | 説明 | 入力形式 | 出力形式 (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| `/env` | `POST` | 環境情報を作成 | **Body**: `EnvType` | `{"env_id": "uuid", ...}` |
| `/env/{id}` | `GET` | 環境情報を取得 | **Path**: `id: uuid` | `Env` オブジェクト |
| `/env/project/{id}` | `GET` | プロジェクトIDで環境情報を取得 | **Path**: `id: uuid` | `List[Env]` |
| `/envs` | `GET` | 全ての環境情報を取得 | - | `List[Env]` |
| `/env/{id}` | `PUT` | 環境情報を更新 | **Path**: `id: uuid`, **Body**: `EnvType` | `{"env_id": "uuid", ...}` |
| `/env/{id}` | `PATCH` | 環境情報を部分更新 | **Path**: `id: uuid`, **Body**: `EnvPatch` | `{"message": "string"}` |
| `/env/{id}` | `DELETE` | 環境情報を削除 | **Path**: `id: uuid` | `{"env_id": "uuid", ...}` |

---

## 3. タスク管理系API

タスクやその割り当てを管理するCRUD API群です。

### 3.1. タスク (`/task`)

| エンドポイント | メソッド | 説明 | 入力形式 | 出力形式 (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| `/task` | `POST` | タスクを作成 | **Body**: `TaskType` | `{"task_id": "uuid", ...}` |
| `/task/{id}` | `GET` | タスクを取得 | **Path**: `id: uuid` | `Task` オブジェクト |
| `/task/project/{id}` | `GET` | プロジェクトIDでタスクを取得 | **Path**: `id: uuid` | `List[Task]` |
| `/tasks` | `GET` | 全タスクを取得 | - | `List[Task]` |
| `/task/{id}` | `PUT` | タスクを更新 | **Path**: `id: uuid`, **Body**: `TaskType` | `{"task_id": "uuid", ...}` |
| `/task/{id}` | `PATCH` | タスクを部分更新 | **Path**: `id: uuid`, **Body**: `TaskPatch` | `{"message": "string"}` |
| `/task/{id}` | `DELETE` | タスクを削除 | **Path**: `id: uuid` | `{"task_id": "uuid", ...}` |

### 3.2. タスク割り当て (`/task_assignment`)

| エンドポイント | メソッド | 説明 | 入力形式 | 出力形式 (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| `/task_assignment` | `POST` | タスク割り当てを作成 | **Body**: `TaskAssignmentType` | `{"task_assignment_id": "uuid", ...}` |
| `/task_assignment/{id}` | `GET` | 割り当てを取得 | **Path**: `id: uuid` | `TaskAssignment` オブジェクト |
| `/task_assignment/task/{id}` | `GET` | タスクIDで割り当てを取得 | **Path**: `id: uuid` | `List[TaskAssignment]` |
| `/task_assignment/project_member/{id}` | `GET` | メンバーIDで割り当てを取得 | **Path**: `id: uuid` | `List[TaskAssignment]` |
| `/task_assignments` | `GET` | 全割り当てを取得 | - | `List[TaskAssignment]` |
| `/task_assignment/{id}` | `PUT` | 割り当てを更新 | **Path**: `id: uuid`, **Body**: `TaskAssignmentType` | `{"task_assignment_id": "uuid", ...}` |
| `/task_assignment/{id}` | `PATCH` | 割り当てを部分更新 | **Path**: `id: uuid`, **Body**: `TaskAssignmentPatch` | `{"message": "string"}` |
| `/task_assignment/{id}` | `DELETE` | 割り当てを削除 | **Path**: `id: uuid` | `{"task_assignment_id": "uuid", ...}` |

---

## 4. QA管理系API

プロジェクトに関するQ&Aを管理するCRUD API群です。

| エンドポイント | メソッド | 説明 | 入力形式 | 出力形式 (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| `/qa` | `POST` | QAを作成 | **Body**: `QAType` | `{"qa_id": "uuid", ...}` |
| `/qas` | `GET` | QAリストを取得 | **Query**: `project_id: Optional[uuid]` | `List[QA]` |
| `/qa/{id}` | `GET` | QAを取得 | **Path**: `id: uuid` | `QA` オブジェクト |
| `/qa/{id}` | `PUT` | QAを更新 | **Path**: `id: uuid`, **Body**: `QAType` | `{"qa_id": "uuid", ...}` |
| `/qa/{id}` | `PATCH` | QAを部分更新 | **Path**: `id: uuid`, **Body**: `QAPatch` | `{"message": "string"}` |
| `/qa/{id}` | `DELETE` | QAを削除 | **Path**: `id: uuid` | `{"qa_id": "uuid", ...}` |
