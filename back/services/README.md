# AI Services 実装ドキュメント

このディレクトリには、ハッカソンサポートエージェントのAI機能を実装したサービスが含まれています。

## 目次

1. [使用AIモデル概要](#使用aiモデル概要)
2. [サービス一覧](#サービス一覧)
3. [ワークフロー概要](#ワークフロー概要)

---

## 使用AIモデル概要

すべてのサービスは主に **Google Gemini モデル** をLangChain経由で使用しています：

| モデル名 | 変数名 | 用途 |
|---------|--------|------|
| gemini-2.5-flash | `llm_pro` | 複雑なタスク（要約、構造化、分類） |
| gemini-2.5-flash | `llm_flash` | 高速処理（推薦、チャット、ドキュメント生成） |
| gemini-2.5-flash | `llm_flash_thinking` | 推論タスク（Q&A生成、MVP判定） |
| gemini-2.5-flash-lite | `llm_lite` | 軽量モデル（利用は稀） |
| gemini-2.0-flash-exp | - | ハンズオン生成（直接API呼び出し） |
| gemini-2.0-flash-001 | - | Context Caching API使用 |

---

## サービス一覧

### 1. Question Service (question_service.py)

**目的:** プロジェクトアイデアからQ&Aペアを生成し、要件を洗練させる

**AIモデル:** Google Gemini Flash Thinking (`gemini-2.5-flash`)

**主要機能:**
- Pydantic構造化出力による信頼性の高いQ&A生成
- 重要度スコア付きの質問生成（1-5スケール）
- 回答例付きAI生成質問
- `follows_qa_id`による連続Q&A対応
- 非同期処理（async/await）

**入力:**
- `idea_prompt` (str): ユーザーのプロジェクトアイデア
- `project_id` (optional): プロジェクト識別子

**出力:**
```python
{
  "qa_id": str,
  "question": str,
  "answer": str,
  "importance": int,
  "is_ai": bool,
  "source_doc_id": str,
  "project_id": str,
  "follows_qa_id": str
}
```

---

### 2. Summary Service (summary_service.py)

**目的:** Q&A回答から包括的な仕様書を生成し、フィードバックと差分更新を提供

**AIモデル:**
- Google Gemini Pro (`gemini-2.5-flash`) - 仕様書生成
- Google Gemini Flash Thinking (`gemini-2.5-flash`) - 仕様書評価
- Google GenAI Context Caching API - 効率的な差分更新

**主要機能:**
- Q&Aリストからの初期仕様書生成
- コンテキストキャッシングによる差分更新（変更分のみ処理）
- 差分比較による手動編集検出
- 構造化フィードバックによる仕様書品質評価
- 不足情報検出と自動Q&A生成
- キャッシュ失敗時のフォールバック機構

**入力:**
- `question_answer` (List[Union[dict, BaseModel]]): Q&Aペア
- `project_id` (str): プロジェクト識別子

**出力:**
- 仕様書ドキュメント (str)
- フィードバック:
  - 評価サマリー
  - 強みリスト
  - 不足情報項目
  - 改善提案

---

### 3. Framework Service (framework_service.py)

**目的:** プロジェクト仕様に基づき技術スタック（フロントエンド、バックエンド、データベース、デプロイ）を推薦・評価

**AIモデル:** Google Gemini Flash (`gemini-2.5-flash`)

**主要機能:**
- 固定候補からのフレームワーク優先度生成
  - フロントエンド: React, Vue, Next.js, Astro
  - バックエンド: FastAPI, Flask, Rails, Gin
- 優先度と理由付きの技術推薦
- フレームワーク選択の評価と検証
- Web/iOS/Android向けの技術オプションカタログ
- 技術要件ドキュメント生成

**入力:**
- `specification` (str): プロジェクト仕様書
- `function_doc` (str, optional): 機能ドキュメント
- `platform` (str): ターゲットプラットフォーム（web/ios/android）
- `selected_technologies` (List[str], optional): ユーザー選択技術

**出力:**
```python
{
  "frontend": [
    {
      "name": str,
      "priority": int (1-10),
      "reason": str
    }
  ],
  "backend": [...],
  "risk_assessment": str,
  "alternatives": [str]
}
```

---

### 4. Function Structuring Workflow (function_structuring_workflow.py)

**目的:** LangGraphベースの複雑なワークフローで、プロジェクト機能を依存関係とともに抽出・分類・構造化

**AIモデル:**
- Google Gemini Pro (`gemini-2.5-flash`) - 抽出、分類、優先度付け、依存関係分析
- Google GenAI Context Caching API (`gemini-2.0-flash-001`) - フォーカス領域間での効率的な機能抽出

**主要機能:**
- 6ノードLangGraph StateGraphワークフロー
  - planning → cache creation → parallel extraction → merge → parallel structuring → persistence
- 仕様書、機能ドキュメント、フレームワーク、制約のコンテキストキャッシング
- フォーカス領域の並列処理（例：「データ・モデル」「API・バックエンド」「UI・画面」）
- 厳格な粒度ルールでの機能抽出（合計15-25機能、領域ごと5-8機能）
- Pydanticスキーマによる構造化出力で信頼性確保
- asyncio.gatherを使った並列分類・優先度付け・依存関係分析
- MoSCoW優先度付け（Must/Should/Could/Wont）
- カテゴリマッピング（auth, data, logic, ui, api, deployment）
- 依存関係分析（requires/blocks/relates）
- バリデーションと重複排除
- 自動クリーンアップ付きのデータベース永続化

**入力:**
- `project_id` (str): プロジェクト識別子
- `function_doc` (str): 機能要件ドキュメント
- `specification` (str, optional): 要件仕様
- `framework_doc` (str, optional): 技術スタック情報
- `constraints` (Dict, optional): プロジェクト制約（タイトル、アイデア、日程、チームサイズ）
- `technology` (Dict, optional): 技術制約

**出力:**
```python
{
  "success": bool,
  "functions": [
    {
      "function_name": str,
      "description": str,
      "category": str,
      "priority": str
    }
  ],
  "dependencies": [
    {
      "from_function": str,
      "to_function": str,
      "dependency_type": str
    }
  ],
  "function_ids": [str],
  "metadata": {
    "time": float,
    "tokens": int,
    "cost": float
  }
}
```

---

### 5. Task Generation Service (task_generation_service.py)

**目的:** 構造化機能から最適な粒度で具体的な実装タスクを生成

**AIモデル:** Google Gemini Pro (`gemini-2.5-flash`)

**主要機能:**
- LLMによるドメインベースバッチング（インテリジェントな機能グルーピング）
- asyncio.gatherによる並列バッチ処理
- 自動リトライ付きPydanticバリデーション（最大3回）
- タスク統合ルール（機能あたり2-3タスク、合計30-50タスク）
- レイヤー認識タスク生成（データレイヤー、APIレイヤー、UIレイヤー）
- 見積時間計算
- カテゴリベースタスク分類（DB設計、バックエンド、フロントエンド、認証、統合）

**入力:**
- `project_id` (str): プロジェクト識別子
- DBからのプロジェクトコンテキスト: specification, framework_doc, function_doc, tech_stack

**出力:**
```python
[
  {
    "function_id": str,
    "function_name": str,
    "task_name": str,
    "task_description": str,
    "category": str,
    "priority": str,
    "estimated_hours": float,
    "reason": str
  }
]
```

---

### 6. Task Hands-On Generator (task_hands_on_generator.py)

**目的:** ハッカソン初心者向けの個別タスク実装ガイド（チュートリアル）を作成

**AIモデル:** Google Gemini (`gemini-2.0-flash-exp`, temperature=0.4, max_output_tokens=16000)

**主要機能:**
- 包括的なハンズオンドキュメント生成
- 初心者向け教育コンテンツ
- Pydanticスキーマ `TaskHandsOnOutput` による構造化出力
- 含まれる内容:
  - 概要、前提条件、技術的背景
  - 実装対象ファイル
  - 実装手順
  - コード例
  - テストガイドライン
  - よくあるエラー
  - 実装のポイント
- 技術選択の「なぜ」を説明
- よくあるエラー防止ガイダンス
- ベストプラクティスと落とし穴警告
- セキュリティとパフォーマンスのヒント

**入力:**
- `task_info` (Dict): タスク詳細（タイトル、カテゴリ、説明、優先度、見積時間、プロジェクトコンテキスト）
- `collected_info_text` (str): 依存タスクとプロジェクトコンテキストから収集した情報

**出力:**
- `TaskHandsOnOutput` Pydanticモデル（詳細実装ガイドセクション含む）

---

### 7. Task Detail Service (taskDetail_service.py)

**目的:** 自動JSON修復機能付きでタスクの詳細説明をバッチ生成

**AIモデル:** Google Gemini Flash (`gemini-2.5-flash`)

**主要機能:**
- バッチ処理（デフォルトbatch_size=3）
- ThreadPoolExecutorによる並列実行（max_workers=5）
- `json_repair`ライブラリによる自動JSON修復
- レート制限（呼び出し間隔0.5秒）
- フォールバックエラーハンドリング

**入力:**
- `specification` (str): プロジェクト仕様書
- `tasks` (List[Dict]): 拡張対象タスクリスト

**出力:**
- `List[Dict]`: 詳細説明を含む`detail`フィールド付きタスク

---

### 8. Task Chat Service (taskChat_service.py)

**目的:** コンテキスト認識によるタスク実装の会話型AIアシスタンス

**AIモデル:** Google Gemini Flash (`gemini-2.5-flash`)

**主要機能:**
- コンテキスト認識チャット応答
- 仕様書、ディレクトリ構造、チャット履歴、フレームワーク、タスク詳細を考慮
- リアルタイム開発サポート
- シンプルなプロンプトベースアーキテクチャ

**入力:**
- `specification` (str): プロジェクト仕様書
- `directory_structure` (str): プロジェクトディレクトリレイアウト
- `chat_history` (str): 過去の会話
- `user_question` (str): 現在のユーザークエリ
- `framework` (str): 使用中の技術フレームワーク
- `taskDetail` (str): 現在のタスク詳細

**出力:**
- コンテキストに応じたアシスタンス応答（str）

---

### 9. AI Document Service (ai_document_service.py)

**目的:** フレームワーク選択ドキュメントからカテゴリ別包括的技術ドキュメントを生成

**AIモデル:** Google Gemini Flash (`gemini-2.5-flash`)

**主要機能:**
- 複数カテゴリのドキュメント生成
  - environment（環境構築）
  - front_end（フロントエンド）
  - back_end（バックエンド）
  - database（データベース）
  - deployment（デプロイ）
  - ai_design（AI設計）
- 自動リトライ付き構造化出力パース（最大2回）
- JSONパース失敗時の個別カテゴリ生成フォールバック
- JSONエスケープ処理付きMarkdown形式出力
- AIDocumentテーブルへのデータベース永続化

**入力:**
- `project_id` (str): プロジェクト識別子
- DBから取得: `frame_work_doc`, `function_doc`, `specification`

**出力:**
```python
{
  "environment": str,      # セットアップ手順
  "front_end": str,        # フロントエンド技術詳細
  "back_end": str,         # バックエンドAPI設計
  "database": str,         # スキーマとマイグレーション戦略
  "deployment": str,       # CI/CDとホスティング
  "ai_design": str         # システムアーキテクチャ概要
}
```

---

### 10. MVP Judge Service (mvp_judge_service.py)

**目的:** プロジェクトアイデアがMVPとして実現可能かを評価し、必要に応じてフォローアップ質問を生成

**AIモデル:** Google Gemini Flash Thinking (`gemini-2.5-flash`)

**主要機能:**
- 構造化MVP実現可能性評価
- スコアリングシステム（0-100、合格閾値75）
- 信頼度評価（0.0-1.0、閾値0.70）
- 信頼度が低い場合の自動Q&A生成による明確化
- 生成された質問のデータベース永続化
- スコアと信頼度に基づく意思決定ルーティング

**入力:**
- `requirements_text` (str): プロジェクト要件/アイデア説明
- `project_id` (str): プロジェクト識別子

**出力:**
```python
{
  "mvp_feasible": bool,        # 実現可能性判定
  "score_0_100": int,          # 総合スコア
  "confidence": float,         # 信頼度レベル
  "qa": [                      # 明確化のためのフォローアップ質問
    {
      "question": str,
      "answer": str,
      "importance": int
    }
  ]
}

# ルーティング決定
{
  "action": bool,              # True=続行、False=ユーザーに質問
  "judge": Dict,               # 判定詳細
  "qa": List[Dict]             # ユーザーへの質問（action=Falseの場合）
}
```

---

## ワークフロー概要

```
ユーザー入力
    ↓
[1] Question Service
    - アイデアからQ&A生成
    ↓
[2] MVP Judge Service
    - 実現可能性評価
    - 追加質問生成
    ↓
[3] Summary Service
    - Q&Aから仕様書生成
    - フィードバックと差分更新
    ↓
[4] Framework Service
    - 技術スタック推薦
    - フレームワーク評価
    ↓
[5] AI Document Service
    - カテゴリ別技術ドキュメント生成
    ↓
[6] Function Structuring Workflow
    - 機能抽出と構造化
    - 依存関係分析
    ↓
[7] Task Generation Service
    - 実装タスク生成
    - 粒度最適化
    ↓
[8] Task Detail Service
    - タスク詳細説明追加
    ↓
[9] Task Hands-On Generator
    - タスク実装ガイド作成
    ↓
[10] Task Chat Service
    - 開発中のリアルタイムサポート
```

---

## アーキテクチャの特徴

### 1. 非同期処理
すべてのサービスは`async/await`パターンを採用し、ノンブロッキング実行を実現

### 2. 構造化出力
Pydanticモデルを使用した検証済み構造化出力により、信頼性を確保

### 3. コンテキストキャッシング
Google GenAI Context Caching APIを活用し、繰り返し呼び出しを効率化

### 4. 並列処理
`asyncio.gather`と`ThreadPoolExecutor`による並列処理でパフォーマンス最適化

### 5. エラーハンドリング
自動リトライ、JSON修復、フォールバック機構による堅牢性

### 6. LangGraphワークフロー
複雑な多段階処理をStateGraphで管理し、可視化と保守性を向上

---

## 依存ライブラリ

- **LangChain**: LLM抽象化とワークフロー管理
- **Google Generative AI**: Geminiモデルへのアクセス
- **LangGraph**: 複雑なワークフロー構築
- **Pydantic**: データ検証と構造化出力
- **json_repair**: 壊れたJSON修復
- **asyncio**: 非同期処理
- **concurrent.futures**: スレッドプール並列処理

---

## 開発時の注意点

1. **レート制限**: Google APIのレート制限に注意（適切な遅延を実装済み）
2. **トークン制限**: 各モデルの入出力トークン制限を考慮
3. **コスト管理**: Context Cachingを活用してコスト削減
4. **エラーハンドリング**: 必ず適切なtry-exceptとフォールバック実装
5. **バリデーション**: Pydanticモデルで入出力を常に検証
6. **ログ**: 重要な処理とエラーは必ずログ出力

---

## 今後の拡張予定

- [ ] OpenAI/Anthropic Claudeモデルの完全サポート
- [ ] ストリーミング応答対応
- [ ] より詳細なメトリクス収集
- [ ] A/Bテストフレームワーク
- [ ] プロンプトバージョニング管理
