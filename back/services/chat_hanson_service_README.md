# ChatHansonService - ハッカソン開発支援チャットサービス

## 概要

`ChatHansonService`は、プロジェクトの仕様書、機能要件、フレームワーク、ディレクトリ構成を自動的に取得し、ユーザーの質問に対してPlanning + Executeの2ステップで回答を生成するAI支援サービスです。

## 特徴

- **シンプルな構成**: Planning と Execute の2ステップのみ
- **自動コンテキスト取得**: `project_id`から必要な情報を自動取得
- **柔軟な利用**: 計画のみ、または計画+実行の両方を取得可能

## アーキテクチャ

### 1. Planning Step
ユーザーの質問に対する回答計画を立てます。

- 質問の理解
- 関連情報の特定
- 回答の構成
- 補足すべき点の洗い出し

### 2. Execute Step
Planning stepで作成した計画に基づいて、実際の回答を生成します。

- プロジェクト仕様に沿った具体的なアドバイス
- ディレクトリ構成に合わせたコード例
- ベストプラクティスの提示

## API エンドポイント

### 1. メインチャットエンドポイント
**POST** `/api/chatHanson/`

Planning + Execute の両方を実行して回答を生成します。

**リクエストボディ:**
```json
{
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "user_question": "認証機能をどのように実装すればよいですか？",
  "chat_history": "前回の会話内容...",
  "return_plan": false
}
```

**レスポンス:**
```json
{
  "answer": "認証機能の実装について...",
  "plan": "1. 質問の理解: ..." // return_plan=trueの場合のみ
}
```

### 2. Planning のみのエンドポイント
**POST** `/api/chatHanson/plan`

回答計画のみを取得します。

**リクエストボディ:**
```json
{
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "user_question": "認証機能をどのように実装すればよいですか？",
  "chat_history": ""
}
```

**レスポンス:**
```json
{
  "plan": "1. 質問の理解: ユーザーは認証機能の実装方法を知りたい\n2. 関連情報の特定: ..."
}
```

## サービスの使用例

### Python コードでの使用

```python
from services.chat_hanson_service import ChatHansonService
from database import get_db

# データベースセッションの取得
db = next(get_db())

# サービスの初期化
service = ChatHansonService(db=db)

# チャットの実行
result = service.chat(
    project_id="123e4567-e89b-12d3-a456-426614174000",
    user_question="認証機能の実装方法を教えてください",
    chat_history="",
    return_plan=True
)

print("回答:", result["answer"])
print("計画:", result["plan"])
```

### cURL での使用

```bash
curl -X POST "http://localhost:8000/api/chatHanson/" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "user_question": "認証機能をどのように実装すればよいですか？",
    "chat_history": "",
    "return_plan": false
  }'
```

## データフロー

```
1. ユーザーからのリクエスト (project_id + user_question)
   ↓
2. ProjectDocument から情報を取得
   - specification (仕様書)
   - function_doc (機能要件定義書)
   - frame_work_doc (フレームワーク)
   - directory_info (ディレクトリ構成)
   ↓
3. Planning Step
   - プロジェクト情報を元に回答計画を作成
   ↓
4. Execute Step
   - 計画に基づいて詳細な回答を生成
   ↓
5. レスポンス返却
```

## プロンプト設定

プロンプトは `back/services/prompts.toml` の `[chat_hanson_service]` セクションに定義されています。

- `plan`: Planning step用のプロンプト
- `execute`: Execute step用のプロンプト

## エラーハンドリング

- **400 Bad Request**: project_idのフォーマットが不正な場合
- **404 Not Found**: 指定されたproject_idのプロジェクトが存在しない場合
- **500 Internal Server Error**: サーバー内部エラー

## 今後の拡張案

- チャット履歴の自動保存機能
- ストリーミングレスポンス対応
- マルチモーダル対応（画像、図表の生成）
- ユーザーフィードバックの収集と学習

## 関連ファイル

- サービス実装: `back/services/chat_hanson_service.py`
- ルーター: `back/routers/chatHanson.py`
- プロンプト定義: `back/services/prompts.toml`
- データモデル: `back/models/project_base.py`
