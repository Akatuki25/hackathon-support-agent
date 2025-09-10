# バックエンド APIドキュメント

このドキュメントは、バックエンドAPIの仕様をまとめたものです。

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
