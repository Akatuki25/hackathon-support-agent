# タスクハンズオン生成システム 実装計画書

**作成日**: 2025-10-09
**目的**: 実用的・教育的な高品質ハンズオンを非同期生成するシステムの設計・実装計画

---

## 🎯 システム目標

### ビジネス目標
1. **実用性**: 初心者でも実装できる具体的なハンズオン資料
2. **正確性**: Web検索による最新情報の取得と齟齬の検証
3. **教育性**: 周辺知識の提供と段階的な学習支援
4. **UX最適化**: 非同期生成による待ち時間の削減

### 技術目標
- タスク依存関係に基づく優先度付き生成
- WebSearch統合型ReActエージェント
- 情報齟齬検証機構
- バックグラウンド非同期処理

---

## 🏗️ システムアーキテクチャ

### 既存システムとの統合方針

**Phase 2アーキテクチャパターンを踏襲**:
- ✅ サービス層の分離: `services/` ディレクトリに `task_hands_on_service.py` を配置
- ✅ ルーター層: `routers/task_hands_on.py` でAPIエンドポイント提供
- ✅ 統合パターン: `IntegratedTaskService` と同様の統合サービス設計
- ✅ 非同期処理: FastAPI BackgroundTasks を使用（Celeryは将来的な拡張オプション）
- ✅ DB設計: 別テーブル分離（ProjectDocument パターン踏襲）

### 全体フロー（既存システム統合版）

```
1. プロジェクト作成
   ↓
2. アイデアからQ&A生成 (/api/question)
   ↓
3. Q&Aから要約・仕様書生成 (/api/summary)
   ↓
4. 機能要件生成 (/api/function_requirements)
   ↓
5. 機能構造化 (/api/function_structuring) ← ReActエージェント
   ↓ [StructuredFunction + FunctionDependency テーブル]
   ↓
6. ✅ 完全タスク生成 (/api/complete_task_generation/generate_complete)
   │  ├─ タスク生成 (TaskGenerationService)
   │  ├─ 品質評価 (TaskQualityEvaluationService)
   │  ├─ 品質改善 (LangGraphワークフロー)
   │  ├─ 依存関係生成 (TaskDependencyService)
   │  └─ ReactFlow座標計算 (TaskPositionService)
   ↓ [Task + TaskDependency テーブル]
   ↓
7. 🆕 タスクハンズオン生成 (/api/task_hands_on/generate_all) ← **Phase 3: 新規実装**
   │
   │  【即座にレスポンス返却】
   │  {
   │    "success": true,
   │    "job_id": "uuid",
   │    "status": "processing",
   │    "total_tasks": 20
   │  }
   │  ↓
   │  ┌──────────────────────────────────────┐
   │  │  バックグラウンドジョブ起動          │
   │  │  (FastAPI BackgroundTasks)           │
   │  └──────────────────────────────────────┘
   │  ↓
   │  TaskHandsOnService (統合サービス)
   │  │
   │  ├─ Step 1: 依存関係解析・優先度ソート
   │  │   (TaskDependencyService 再利用)
   │  │
   │  ├─ Step 2: バッチ処理でハンズオン生成
   │  │   ├─ TaskHandsOnAgent (ReActエージェント)
   │  │   │   ├─ WebSearch (Tavily API)
   │  │   │   ├─ ドキュメント取得
   │  │   │   ├─ コード例生成
   │  │   │   └─ 情報齟齬検証
   │  │   │
   │  │   └─ バッチサイズ: 3-5タスク並列
   │  │
   │  └─ Step 3: TaskHandsOnテーブルに保存
   │      └─ HandsOnGenerationJob ステータス更新
   ↓
GET /api/task_hands_on/status/{job_id}
  → {
      "job_id": "uuid",
      "status": "processing",
      "progress": {
        "total": 20,
        "completed": 8,
        "failed": 1,
        "in_progress": 3
      },
      "current_tasks": [...]
    }
   ↓
GET /api/task/{task_id}/hands_on
  → {
      "has_hands_on": true,
      "hands_on": {...},
      "metadata": {...}
    }
   ↓
FE: リアルタイムポーリングで完了したタスクのハンズオンを表示
```

---

## 📊 データベース設計

### 設計方針：細粒度タスクに最適化

**タスクの粒度**: 2-4時間程度の細かいタスク（例: "データモデル定義", "ユーザー認証API実装"）

**セクション構成の最適化**:
- ❌ 削除: `deployment`（タスク単体でデプロイまで行わない）、`security_notes`（個別タスクには広すぎる）
- ✅ 追加: `prerequisites`（依存タスク・パッケージの明示）、`target_files`（実装対象ファイルの明確化）、`code_examples`（実際に動作するコード）、`technical_context`（簡潔な技術背景）、`implementation_tips`（ベストプラクティス）
- 🎯 焦点: 実装手順とコード例を中心に、実用的かつ教育的なコンテンツ

### 1. TaskHandsOnテーブル（新規作成）

```python
class TaskHandsOn(Base):
    """タスク詳細ハンズオンテーブル"""
    __tablename__ = "task_hands_on"

    # Primary Key
    hands_on_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Key (1:1 unique)
    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("task.task_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    # ========================================
    # ハンズオンセクション（すべてオプショナル）
    # 細粒度タスクに特化した最小限の構成
    # ========================================

    # 1. 概要（タスクの目的と達成目標）
    overview = Column(Text, nullable=True, comment="このタスクで何を実装するか、なぜ必要か")

    # 2. 前提条件（このタスクを始める前に必要なもの）
    prerequisites = Column(Text, nullable=True, comment="必要なパッケージ、事前に完了すべき依存タスク、環境設定")

    # 3. 実装対象ファイル
    target_files = Column(JSON, nullable=True, comment="作成・修正するファイルのリスト [{path, action, description}]")

    # 4. 実装手順（メインコンテンツ）
    implementation_steps = Column(Text, nullable=True, comment="ステップバイステップの実装手順（Markdown形式）")

    # 5. コード例
    code_examples = Column(JSON, nullable=True, comment="実際に動作するコード例 [{file, language, code, explanation}]")

    # 6. 動作確認
    verification = Column(Text, nullable=True, comment="実装後の動作確認方法・期待される結果")

    # 7. よくあるエラー
    common_errors = Column(JSON, nullable=True, comment="典型的なエラーと解決方法 [{error, cause, solution}]")

    # 8. 参考資料
    references = Column(JSON, nullable=True, comment="公式ドキュメント、記事などのURL [{title, url, type, relevance}]")

    # ========================================
    # 教育コンテンツ（実装に関連する周辺知識）
    # ========================================

    # 9. 技術的背景
    technical_context = Column(Text, nullable=True, comment="このタスクで使う技術・概念の簡潔な説明")

    # 10. 実装のポイント
    implementation_tips = Column(JSON, nullable=True, comment="ベストプラクティス、アンチパターン [{tip, reason}]")

    # ========================================
    # メタデータ・品質管理
    # ========================================

    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 生成バージョン
    generation_version = Column(String(20), default="1.0", nullable=False)

    # 生成に使用したモデル
    generation_model = Column(String(50), nullable=True, comment="使用AIモデル")

    # ユーザー編集フラグ
    is_user_edited = Column(Boolean, default=False, nullable=False)

    # 品質スコア（WebSearch検証後）
    quality_score = Column(Float, nullable=True, comment="0.0-1.0の品質スコア")

    # 情報鮮度（検索時の最新ドキュメント日付）
    information_freshness = Column(Date, nullable=True, comment="参照した情報の最新日付")

    # ========================================
    # Web検索メタデータ
    # ========================================

    # 検索クエリ履歴
    search_queries = Column(JSON, nullable=True, comment="実行した検索クエリのリスト")

    # 参照したURL
    referenced_urls = Column(JSON, nullable=True, comment="参照した公式ドキュメント・記事のURL")

    # 齟齬検証結果
    verification_result = Column(JSON, nullable=True, comment="情報齟齬検証の詳細結果")

    # ========================================
    # リレーション
    # ========================================

    task = relationship("Task", back_populates="hands_on", uselist=False)

    # ========================================
    # インデックス
    # ========================================

    __table_args__ = (
        Index("ix_task_hands_on_task_id", "task_id"),
        Index("ix_task_hands_on_generated_at", "generated_at"),
        Index("ix_task_hands_on_quality_score", "quality_score"),
    )

    def __repr__(self):
        return f"<TaskHandsOn(task_id={self.task_id}, quality={self.quality_score})>"

    def to_markdown(self) -> str:
        """セクションを結合してMarkdown全文を生成"""
        sections = []

        if self.overview:
            sections.append(f"# 概要\n\n{self.overview}")

        if self.prerequisites:
            sections.append(f"## 前提条件\n\n{self.prerequisites}")

        if self.target_files:
            sections.append(f"## 実装対象ファイル\n\n{self._format_target_files()}")

        if self.implementation_steps:
            sections.append(f"## 実装手順\n\n{self.implementation_steps}")

        if self.code_examples:
            sections.append(f"## コード例\n\n{self._format_code_examples()}")

        if self.verification:
            sections.append(f"## 動作確認\n\n{self.verification}")

        if self.common_errors:
            sections.append(f"## よくあるエラー\n\n{self._format_common_errors()}")

        if self.technical_context:
            sections.append(f"## 技術的背景\n\n{self.technical_context}")

        if self.implementation_tips:
            sections.append(f"## 実装のポイント\n\n{self._format_implementation_tips()}")

        if self.references:
            sections.append(f"## 参考資料\n\n{self._format_references()}")

        return "\n\n---\n\n".join(sections)

    def _format_target_files(self) -> str:
        """実装対象ファイルをMarkdown形式で整形"""
        if not self.target_files:
            return ""

        lines = []
        for file_info in self.target_files:
            action_emoji = "📝" if file_info["action"] == "modify" else "✨"
            lines.append(f"- {action_emoji} `{file_info['path']}` ({file_info['action']})")
            if file_info.get('description'):
                lines.append(f"  - {file_info['description']}")

        return "\n".join(lines)

    def _format_code_examples(self) -> str:
        """コード例をMarkdown形式で整形"""
        if not self.code_examples:
            return ""

        lines = []
        for example in self.code_examples:
            lines.append(f"### {example.get('file', 'コード例')}\n")
            if example.get('explanation'):
                lines.append(f"{example['explanation']}\n")
            lines.append(f"```{example.get('language', 'python')}")
            lines.append(example['code'])
            lines.append("```\n")

        return "\n".join(lines)

    def _format_common_errors(self) -> str:
        """よくあるエラーをMarkdown形式で整形"""
        if not self.common_errors:
            return ""

        lines = []
        for i, error_info in enumerate(self.common_errors, 1):
            lines.append(f"### エラー {i}: {error_info['error']}\n")
            lines.append(f"**原因**: {error_info['cause']}\n")
            lines.append(f"**解決方法**:\n{error_info['solution']}\n")

        return "\n".join(lines)

    def _format_implementation_tips(self) -> str:
        """実装のポイントをMarkdown形式で整形"""
        if not self.implementation_tips:
            return ""

        lines = []
        for tip_info in self.implementation_tips:
            tip_type = tip_info.get('type', 'best_practice')
            emoji = "✅" if tip_type == "best_practice" else "⚠️"
            lines.append(f"{emoji} **{tip_info['tip']}**")
            lines.append(f"  - {tip_info['reason']}\n")

        return "\n".join(lines)

    def _format_references(self) -> str:
        """参考資料をMarkdown形式で整形"""
        if not self.references:
            return ""

        lines = []
        for ref in self.references:
            ref_type = ref.get('type', 'docs')
            type_emoji = "📚" if ref_type == "docs" else "📝"
            lines.append(f"- {type_emoji} [{ref['title']}]({ref['url']})")
            if ref.get('relevance'):
                lines.append(f"  - {ref['relevance']}")

        return "\n".join(lines)
```

### 2. HandsOnGenerationJobテーブル（ジョブ管理）

```python
class HandsOnGenerationJob(Base):
    """ハンズオン生成ジョブ管理テーブル"""
    __tablename__ = "hands_on_generation_job"

    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id"), nullable=False)

    # ジョブステータス
    status = Column(
        Enum("queued", "processing", "completed", "failed", "cancelled", name="job_status_enum"),
        default="queued",
        nullable=False
    )

    # 進捗情報
    total_tasks = Column(Integer, nullable=False)
    completed_tasks = Column(Integer, default=0, nullable=False)
    failed_tasks = Column(Integer, default=0, nullable=False)

    # 現在処理中のタスク
    current_processing = Column(JSON, nullable=True, comment="現在処理中のタスクIDリスト")

    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # エラー情報
    error_message = Column(Text, nullable=True)
    error_details = Column(JSON, nullable=True)

    # 設定
    config = Column(JSON, nullable=True, comment="生成設定（並列数、モデル等）")

    __table_args__ = (
        Index("ix_hands_on_job_project_id", "project_id"),
        Index("ix_hands_on_job_status", "status"),
        Index("ix_hands_on_job_created_at", "created_at"),
    )
```

---

## 🤖 TaskHandsOnAgent設計（ReAct + WebSearch）

### エージェント概要

```python
class TaskHandsOnAgent:
    """
    WebSearch統合型ReActエージェント
    タスク単位で高品質なハンズオンを生成
    """

    def __init__(self, db: Session, task: Task, project_context: Dict):
        self.db = db
        self.task = task
        self.project_context = project_context

        # LangChain ReActエージェント
        self.agent = self._build_react_agent()

        # ツール
        self.tools = [
            WebSearchTool(),           # Web検索
            DocumentFetchTool(),       # URL取得・パース
            CodeExampleGenerator(),    # コード例生成
            VerificationTool(),        # 情報齟齬検証
        ]

    def generate_hands_on(self) -> TaskHandsOn:
        """
        ハンズオン生成のメイン処理
        """
        # Step 1: 技術スタックとタスク内容の分析
        tech_analysis = self._analyze_technology_stack()

        # Step 2: Web検索で最新情報を収集
        search_results = self._gather_latest_information(tech_analysis)

        # Step 3: 周辺技術・関連情報の調査
        related_info = self._research_related_technologies(tech_analysis)

        # Step 4: 情報の齟齬検証
        verified_info = self._verify_information_consistency(
            search_results, related_info
        )

        # Step 5: セクション別ハンズオン生成
        hands_on_sections = self._generate_all_sections(verified_info)

        # Step 6: 品質評価
        quality_score = self._evaluate_quality(hands_on_sections)

        # Step 7: TaskHandsOnオブジェクト作成
        hands_on = TaskHandsOn(
            task_id=self.task.task_id,
            **hands_on_sections,
            quality_score=quality_score,
            generation_model="gemini-2.5-flash",
            search_queries=verified_info["queries"],
            referenced_urls=verified_info["urls"],
            verification_result=verified_info["verification"],
            information_freshness=verified_info["freshness"],
        )

        return hands_on
```

### ReActエージェントのツール定義

#### 1. WebSearchTool

```python
class WebSearchTool(BaseTool):
    """Web検索ツール（Google Search API / Tavily等）"""
    name = "web_search"
    description = """
    最新の技術ドキュメント、公式ガイド、ベストプラクティスを検索します。

    入力例:
    - "Next.js 15 authentication best practices"
    - "FastAPI JWT token implementation official docs"
    - "PostgreSQL connection pooling 2025"

    出力: 検索結果（タイトル、URL、スニペット）のリスト
    """

    def _run(self, query: str) -> List[Dict]:
        # Tavily API / Google Custom Search API を使用
        results = tavily_search(query, max_results=5)
        return [
            {
                "title": r["title"],
                "url": r["url"],
                "snippet": r["content"][:200],
                "published_date": r.get("published_date"),
            }
            for r in results
        ]
```

#### 2. DocumentFetchTool

```python
class DocumentFetchTool(BaseTool):
    """URLからドキュメントを取得してパース"""
    name = "fetch_document"
    description = """
    指定されたURLのドキュメントを取得し、Markdown形式で返します。

    入力: URL
    出力: Markdown形式のドキュメント内容
    """

    def _run(self, url: str) -> str:
        # BeautifulSoup / Readability でパース
        html = requests.get(url).text
        text = html_to_markdown(html)
        return text[:5000]  # 長すぎる場合は切り詰め
```

#### 3. VerificationTool

```python
class VerificationTool(BaseTool):
    """情報齟齬検証ツール"""
    name = "verify_information"
    description = """
    複数の情報源を比較し、齟齬や矛盾がないか検証します。

    入力: 検証したい情報（JSON形式）
    出力: 検証結果（齟齬の有無、信頼度スコア）
    """

    def _run(self, info: Dict) -> Dict:
        # LLMを使って複数ソースの整合性をチェック
        prompt = f"""
        以下の情報源を比較し、齟齬や矛盾がないか検証してください:

        Source 1: {info['source1']}
        Source 2: {info['source2']}
        Source 3: {info['source3']}

        検証項目:
        1. バージョン情報の整合性
        2. APIメソッドの一致
        3. 推奨パターンの矛盾
        4. 非推奨機能の警告

        出力形式:
        {{
          "consistency_score": 0.0-1.0,
          "conflicts": [{{issue, severity, recommendation}}],
          "verified_facts": [...],
          "warning_flags": [...]
        }}
        """
        return llm_verify(prompt)
```

---

### エージェントのReActループ

```python
def _generate_implementation_section(self, verified_info: Dict) -> str:
    """
    ReActループで実装手順セクションを生成

    Thought → Action → Observation を繰り返す
    """

    agent_prompt = f"""
    あなたはシニアエンジニアです。以下のタスクの実装手順を作成してください。

    タスク: {self.task.title}
    説明: {self.task.description}
    技術スタック: {self.project_context['tech_stack']}
    カテゴリ: {self.task.category}

    以下のツールを使って、最新かつ正確な情報を基に実装手順を作成してください:

    利用可能なツール:
    - web_search: 最新ドキュメント・ベストプラクティスを検索
    - fetch_document: 公式ドキュメントの詳細を取得
    - verify_information: 情報の齟齬を検証

    目標:
    1. 初心者でも理解できる段階的な手順
    2. 実際に動作するコード例
    3. 最新バージョンに対応した情報
    4. 周辺知識の補足説明
    5. トラブルシューティングの提示

    ReActループで思考と行動を記録しながら進めてください。
    """

    # LangChain ReActエージェント実行
    result = self.agent.run(agent_prompt)

    return result["implementation_section"]
```

**ReActループの例**:

```
Thought 1: まず、Next.js 15の認証の最新ベストプラクティスを調べる必要がある

Action 1: web_search("Next.js 15 authentication best practices 2025")

Observation 1:
- 公式ドキュメント: https://nextjs.org/docs/authentication
- Auth.js (NextAuth v5)が推奨されている
- App Routerでの実装パターンが更新されている

Thought 2: Auth.js v5の公式ドキュメントを詳しく確認する

Action 2: fetch_document("https://authjs.dev/getting-started/installation")

Observation 2:
- インストールコマンド: npm install next-auth@beta
- 設定ファイル: auth.ts の作成が必要
- ミドルウェアパターンが変更されている

Thought 3: プロジェクトの技術スタック（Next.js + PostgreSQL）に合わせた
         設定例を生成する必要がある。複数ソースの情報を検証する。

Action 3: verify_information({
  "source1": "公式ドキュメントの設定例",
  "source2": "コミュニティのベストプラクティス",
  "source3": "GitHub公式サンプル"
})

Observation 3:
- 整合性スコア: 0.92
- 検証済み事実: PostgreSQL Adapterの設定方法が一貫している
- 警告: 一部の記事でv4の古い設定が混在

Thought 4: 検証済みの情報を基に、ステップバイステップの実装手順を作成する

Final Answer: [実装手順のMarkdown]
```

---

## ⚙️ 非同期処理アーキテクチャ

### アーキテクチャ選定: Celery + Redis

**選定理由**: 詳細は `/ASYNC_ARCHITECTURE_COMPARISON.md` 参照

**要約**:
- ✅ 長時間処理（10-15分）に最適
- ✅ WebSearchリトライ等の信頼性要件を満たす
- ✅ Worker独立スケール、将来的な拡張性確保
- ✅ Flower による可視化・デバッグ

**総合評価**: Celery 21点 vs BackgroundTasks 8点

### 1. Celery基盤セットアップ

```python
# back/celery_app.py（新規作成）

from celery import Celery
import os

# Dockerコンテナ内を想定
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "hackathon_support_agent",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Tokyo",
    enable_utc=True,

    # タスク追跡
    task_track_started=True,
    task_track_started=True,

    # タイムアウト設定（単一タスク最大10分）
    task_time_limit=600,       # ハードリミット（10分）
    task_soft_time_limit=540,  # ソフトリミット（9分、警告）

    # リトライ設定
    task_acks_late=True,          # タスク完了後にACK
    task_reject_on_worker_lost=True,  # Worker停止時に再キュー
)
```

```dockerfile
# docker-compose.yml 追加

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  celery-worker:
    build: ./back
    command: celery -A celery_app worker --loglevel=info --concurrency=3
    depends_on:
      - redis
      - db
    env_file:
      - ./back/.env
    environment:
      - REDIS_URL=redis://redis:6379/0
      - DATABASE_URL=${DATABASE_URL}
    volumes:
      - ./back:/app

  flower:
    build: ./back
    command: celery -A celery_app flower --port=5555
    ports:
      - "5555:5555"
    depends_on:
      - redis
      - celery-worker
    environment:
      - REDIS_URL=redis://redis:6379/0

volumes:
  redis_data:
```

```txt
# back/requirements.txt 追加

celery[redis]==5.3.4
redis==5.0.1
flower==2.0.1
```

### 2. Celeryタスク実装

```python
# back/tasks/hands_on_tasks.py（新規作成）

from celery import group, chain
from celery_app import celery_app
from database import get_db_session
from models.project_base import Task, HandsOnGenerationJob, TaskHandsOn
from services.task_hands_on_agent import TaskHandsOnAgent
from typing import Dict
from datetime import datetime

@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def generate_single_task_hands_on(
    self,
    task_id: str,
    project_context: Dict,
    config: Dict = None
):
    """
    単一タスクのハンズオン生成（Celeryタスク）

    Args:
        task_id: タスクID
        project_context: プロジェクトコンテキスト（技術スタック、仕様など）
        config: 生成設定（WebSearch有効化、検証レベルなど）

    Returns:
        Dict: 生成結果
    """
    db = get_db_session()

    try:
        # タスク取得
        task = db.query(Task).filter_by(task_id=task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        print(f"[Celery] ハンズオン生成開始: {task.title}")

        # TaskHandsOnAgent起動
        agent = TaskHandsOnAgent(db, task, project_context, config)
        hands_on = agent.generate_hands_on()

        # DB保存
        db.add(hands_on)
        db.commit()

        print(f"[Celery] ハンズオン生成完了: {task.title} (品質: {hands_on.quality_score:.2f})")

        return {
            "task_id": task_id,
            "status": "completed",
            "quality_score": hands_on.quality_score,
            "completed_at": datetime.now().isoformat()
        }

    except Exception as e:
        db.rollback()
        print(f"[Celery] エラー: {task.title} - {str(e)}")

        # WebSearchタイムアウト等でリトライ
        if "timeout" in str(e).lower() or "network" in str(e).lower():
            raise self.retry(exc=e, countdown=60)  # 60秒後にリトライ
        else:
            raise  # その他のエラーは即失敗

    finally:
        db.close()


@celery_app.task
def generate_all_hands_on(job_id: str, project_id: str, config: Dict = None):
    """
    プロジェクト全体のハンズオン生成（メインCeleryタスク）

    Args:
        job_id: HandsOnGenerationJob ID
        project_id: プロジェクトID
        config: 生成設定
    """
    db = get_db_session()

    try:
        print(f"[Celery] プロジェクト全体のハンズオン生成開始: {project_id}")

        # ジョブレコード取得・更新
        job = db.query(HandsOnGenerationJob).filter_by(job_id=job_id).first()
        job.status = "processing"
        job.started_at = datetime.now()
        db.commit()

        # タスク取得
        from sqlalchemy.orm import joinedload
        tasks = db.query(Task).filter_by(project_id=project_id).all()
        job.total_tasks = len(tasks)
        db.commit()

        # 依存関係解析・優先度ソート（TaskDependencyService再利用）
        from services.task_hands_on_service import TaskHandsOnService
        service = TaskHandsOnService(db)
        sorted_task_dicts = service._sort_tasks_by_dependency_priority(tasks)

        # プロジェクトコンテキスト構築
        project_context = service._build_project_context(project_id)

        # Celery chain/group で依存関係を考慮して実行
        batch_size = config.get("batch_size", 5) if config else 5
        batches = service._create_dependency_batches(sorted_task_dicts, batch_size)

        for batch in batches:
            if batch["has_dependencies"]:
                # 依存関係あり → chain で順次実行
                task_chain = chain([
                    generate_single_task_hands_on.s(
                        t["task_id"],
                        project_context,
                        config
                    )
                    for t in batch["tasks"]
                ])
                task_chain.apply_async()
            else:
                # 依存関係なし → group で並列実行
                task_group = group([
                    generate_single_task_hands_on.s(
                        t["task_id"],
                        project_context,
                        config
                    )
                    for t in batch["tasks"]
                ])
                task_group.apply_async()

            # 進捗更新（非同期で実行中のタスクをカウント）
            completed_count = db.query(TaskHandsOn).join(Task).filter(
                Task.project_id == project_id
            ).count()

            job.completed_tasks = completed_count
            db.commit()

        # 完了待機（すべてのサブタスクが終わるまで）
        # ※実際にはCelery Resultを使って待機
        import time
        while True:
            completed_count = db.query(TaskHandsOn).join(Task).filter(
                Task.project_id == project_id
            ).count()

            job.completed_tasks = completed_count
            db.commit()

            if completed_count >= len(tasks):
                break

            time.sleep(5)  # 5秒ごとにポーリング

        # 完了
        job.status = "completed"
        job.completed_at = datetime.now()
        db.commit()

        print(f"[Celery] プロジェクト全体のハンズオン生成完了: {project_id}")

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
        print(f"[Celery] プロジェクト全体のハンズオン生成失敗: {str(e)}")
        raise

    finally:
        db.close()
```

### 3. API統合（Celeryタスク起動）

```python
# routers/task_hands_on.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from tasks.hands_on_tasks import generate_all_hands_on
from models.project_base import HandsOnGenerationJob
import uuid
from datetime import datetime

router = APIRouter()

@router.post("/generate_all")
async def start_hands_on_generation(
    request: HandsOnGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    プロジェクト全体のハンズオン生成開始

    Celeryタスクを起動して即座にレスポンス返却
    """

    # ジョブレコード作成
    job = HandsOnGenerationJob(
        job_id=uuid.uuid4(),
        project_id=request.project_id,
        status="queued",
        total_tasks=0,
        completed_tasks=0,
        created_at=datetime.now(),
        config=request.config
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Celeryタスク起動（非同期）
    generate_all_hands_on.apply_async(
        args=[str(job.job_id), request.project_id, request.config],
        task_id=str(job.job_id)  # ジョブIDをタスクIDとして使用
    )

    return {
        "success": True,
        "job_id": str(job.job_id),
        "project_id": request.project_id,
        "status": "queued",
        "message": "Hands-on generation started in background (Celery)"
    }
```

---

### 2. 依存関係を考慮した優先度付きソート

```python
def sort_tasks_by_dependency_and_priority(tasks: List[Task]) -> List[Dict]:
    """
    タスク依存関係と優先度を考慮してソート

    ルール:
    1. 依存関係がないタスクを優先
    2. 同じレベルではMust > Should > Could
    3. 依存先が完了していないタスクは待機
    """

    # タスク依存グラフ構築
    dependency_graph = build_dependency_graph(tasks)

    # トポロジカルソート（依存関係解決）
    sorted_by_dependency = topological_sort(dependency_graph)

    # 各レベル内で優先度ソート
    priority_map = {"Must": 0, "Should": 1, "Could": 2, "Wont": 3}

    result = []
    for level in sorted_by_dependency:
        sorted_level = sorted(
            level,
            key=lambda t: (priority_map[t.priority], t.estimated_hours)
        )
        result.extend(sorted_level)

    return [
        {
            "task_id": str(t.task_id),
            "title": t.title,
            "priority": t.priority,
            "dependency_level": get_dependency_level(t, dependency_graph),
            "depends_on": get_dependency_tasks(t, dependency_graph)
        }
        for t in result
    ]


def build_dependency_graph(tasks: List[Task]) -> Dict:
    """TaskDependencyテーブルからグラフを構築"""
    graph = {str(t.task_id): {"task": t, "depends_on": [], "dependents": []} for t in tasks}

    for task in tasks:
        for dep in task.dependencies_to:  # このタスクへの依存
            source_id = str(dep.source_task_id)
            target_id = str(dep.target_task_id)

            if source_id in graph and target_id in graph:
                graph[target_id]["depends_on"].append(source_id)
                graph[source_id]["dependents"].append(target_id)

    return graph


def topological_sort(graph: Dict) -> List[List[Task]]:
    """
    トポロジカルソートで依存レベルを分類

    戻り値: [[Level 0 tasks], [Level 1 tasks], ...]
    """
    levels = []
    in_degree = {tid: len(info["depends_on"]) for tid, info in graph.items()}

    while any(deg == 0 for deg in in_degree.values()):
        current_level = [
            graph[tid]["task"]
            for tid, deg in in_degree.items()
            if deg == 0 and tid in in_degree
        ]

        levels.append(current_level)

        # 次のレベルへ
        for tid in [str(t.task_id) for t in current_level]:
            in_degree.pop(tid)
            for dependent in graph[tid]["dependents"]:
                if dependent in in_degree:
                    in_degree[dependent] -= 1

    return levels
```

**実行例**:

```
Level 0（依存なし、並列実行可能）:
  - Task A (Must, 環境構築)
  - Task B (Must, DB設計)
  - Task C (Should, UI設計)

Level 1（Level 0完了後）:
  - Task D (Must, バックエンドAPI実装) ← depends on Task B
  - Task E (Should, フロントエンド実装) ← depends on Task C

Level 2（Level 1完了後）:
  - Task F (Could, 統合テスト) ← depends on Task D, E
```

---

## 📡 API設計（既存システムパターンに準拠）

### API構成

**ルーター**: `routers/task_hands_on.py`
**プレフィックス**: `/api/task_hands_on`
**タグ**: `["TaskHandsOn"]`

### 1. ハンズオン生成開始

```python
POST /api/task_hands_on/generate_all

# complete_task_generation.py のパターンを踏襲
# IntegratedTaskService と同様の統合処理

Request:
{
  "project_id": "uuid",
  "config": {
    "batch_size": 5,           # デフォルト: 5
    "enable_web_search": true, # デフォルト: true
    "verification_level": "medium"  # "low" | "medium" | "high"
  }
}

Response (即座に返却):
{
  "success": true,
  "job_id": "uuid",
  "project_id": "uuid",
  "status": "processing",
  "total_tasks": 20,
  "message": "Hands-on generation started in background"
}

# バックグラウンドで処理継続
# HandsOnGenerationJob テーブルでステータス管理
```

### 2. ジョブステータス確認

```python
GET /api/task_hands_on/status/{job_id}

# 既存の task_generation.py の status エンドポイントパターン踏襲

Response:
{
  "success": true,
  "job_id": "uuid",
  "project_id": "uuid",
  "status": "processing",  # "processing" | "completed" | "failed"
  "progress": {
    "total_tasks": 20,
    "completed": 8,
    "failed": 1,
    "processing": 3,
    "pending": 8
  },
  "current_processing": [
    {
      "task_id": "uuid",
      "task_title": "ユーザー認証API実装",
      "started_at": "2025-10-09T10:30:00Z"
    }
  ],
  "completed_tasks": [
    {
      "task_id": "uuid",
      "task_title": "環境構築",
      "quality_score": 0.92,
      "completed_at": "2025-10-09T10:25:00Z"
    }
  ],
  "error_message": null,
  "error_details": null
}
```

### 3. 個別タスクハンズオン取得

```python
GET /api/task_hands_on/{task_id}

# 既存の project_document.py パターン踏襲（別テーブル取得）

Response:
{
  "success": true,
  "task_id": "uuid",
  "task_title": "ユーザー認証API実装",
  "has_hands_on": true,
  "hands_on": {
    "hands_on_id": "uuid",
    "overview": "...",
    "prerequisites": "...",
    "target_files": [...],
    "implementation_steps": "...",
    "code_examples": [...],
    "verification": "...",
    "common_errors": [...],
    "references": [...],
    "technical_context": "...",
    "implementation_tips": [...]
  },
  "metadata": {
    "generated_at": "2025-10-09T10:25:00Z",
    "quality_score": 0.92,
    "generation_model": "gemini-2.5-flash",
    "information_freshness": "2025-10-05"
  }
}
```

### 4. プレビュー生成（開発・デバッグ用）

```python
POST /api/task_hands_on/preview

# complete_task_generation.py の preview パターン踏襲
# DB保存せずメモリ上で生成

Request:
{
  "task_id": "uuid",
  "config": {
    "enable_web_search": false,  # プレビューでは無効化可能
    "verification_level": "low"
  }
}

Response:
{
  "success": true,
  "hands_on": {...},
  "preview_mode": true,
  "message": "Preview generated (not saved to DB)"
}
```

### 5. ハンズオン削除（開発用）

```python
DELETE /api/task_hands_on/{project_id}

# complete_task_generation.py の clear パターン踏襲

Response:
{
  "success": true,
  "deleted_count": 20,
  "message": "All hands-on data cleared for project"
}
```

---

## 🧪 品質保証機構

### 1. 情報齟齬検証フロー

```python
class InformationVerifier:
    """情報齟齬検証エンジン"""

    def verify_hands_on_quality(self, hands_on_draft: Dict) -> Dict:
        """
        ハンズオン草案の品質検証

        検証項目:
        1. コード例の構文チェック
        2. バージョン整合性
        3. 複数ソースの情報一致
        4. 非推奨APIの警告
        5. セキュリティリスク
        """

        verification_result = {
            "overall_score": 0.0,
            "checks": []
        }

        # チェック1: コード例の構文検証
        code_check = self._verify_code_syntax(hands_on_draft["implementation"])
        verification_result["checks"].append(code_check)

        # チェック2: バージョン整合性
        version_check = self._verify_version_consistency(hands_on_draft)
        verification_result["checks"].append(version_check)

        # チェック3: 複数ソース比較
        source_check = self._cross_reference_sources(hands_on_draft["referenced_urls"])
        verification_result["checks"].append(source_check)

        # チェック4: 非推奨API検出
        deprecation_check = self._detect_deprecated_apis(hands_on_draft)
        verification_result["checks"].append(deprecation_check)

        # チェック5: セキュリティスキャン
        security_check = self._scan_security_issues(hands_on_draft)
        verification_result["checks"].append(security_check)

        # 総合スコア計算
        verification_result["overall_score"] = self._calculate_overall_score(
            verification_result["checks"]
        )

        return verification_result


    def _verify_code_syntax(self, implementation_text: str) -> Dict:
        """
        実装手順内のコード例を抽出して構文チェック
        """
        code_blocks = extract_code_blocks(implementation_text)
        results = []

        for block in code_blocks:
            lang = block["language"]  # python, javascript, etc.
            code = block["code"]

            try:
                # 言語別構文チェッカー
                if lang == "python":
                    compile(code, "<string>", "exec")
                elif lang in ["javascript", "typescript"]:
                    # Node.jsでチェック
                    check_js_syntax(code)

                results.append({"block": code[:100], "status": "valid"})

            except SyntaxError as e:
                results.append({
                    "block": code[:100],
                    "status": "invalid",
                    "error": str(e)
                })

        pass_rate = len([r for r in results if r["status"] == "valid"]) / len(results)

        return {
            "name": "Code Syntax Check",
            "score": pass_rate,
            "details": results
        }


    def _cross_reference_sources(self, referenced_urls: List[str]) -> Dict:
        """
        複数ソースの情報を比較して一貫性をチェック
        """
        # URLからドキュメント取得
        documents = [fetch_document(url) for url in referenced_urls]

        # LLMで一貫性チェック
        prompt = f"""
        以下の複数のドキュメントを比較し、矛盾や齟齬がないか分析してください:

        Document 1: {documents[0][:1000]}
        Document 2: {documents[1][:1000]}
        Document 3: {documents[2][:1000]}

        以下の観点で評価してください:
        1. 技術的な記述の一貫性
        2. バージョン情報の整合性
        3. 推奨パターンの一致
        4. 矛盾する記述の有無

        出力形式:
        {{
          "consistency_score": 0.0-1.0,
          "conflicts": [{{issue, severity}}],
          "consensus_points": [...]
        }}
        """

        result = llm_analyze(prompt)

        return {
            "name": "Cross-Reference Check",
            "score": result["consistency_score"],
            "details": result
        }
```

### 2. 品質スコア計算

```python
def _calculate_overall_score(checks: List[Dict]) -> float:
    """
    各チェック結果から総合品質スコアを計算

    重み付け:
    - Code Syntax: 25%
    - Version Consistency: 20%
    - Cross-Reference: 25%
    - Deprecation Check: 15%
    - Security Check: 15%
    """
    weights = {
        "Code Syntax Check": 0.25,
        "Version Consistency Check": 0.20,
        "Cross-Reference Check": 0.25,
        "Deprecation Check": 0.15,
        "Security Check": 0.15,
    }

    total_score = sum(
        check["score"] * weights.get(check["name"], 0.1)
        for check in checks
    )

    return round(total_score, 2)
```

---

## 📅 実装スケジュール（8週間）

### Week 1-2: 基盤実装
- [ ] TaskHandsOnテーブル作成・マイグレーション
- [ ] HandsOnGenerationJobテーブル作成
- [ ] Celeryセットアップ（Redis導入）
- [ ] WebSearchTool実装（Tavily API統合）
- [ ] DocumentFetchTool実装

### Week 3-4: エージェント実装
- [ ] TaskHandsOnAgent基本クラス
- [ ] ReActエージェント統合
- [ ] セクション別生成ロジック
- [ ] 情報齟齬検証ロジック
- [ ] 品質評価ロジック

### Week 5-6: 非同期処理・最適化
- [ ] 依存関係解析・優先度ソート
- [ ] Celeryタスク実装
- [ ] バッチ処理最適化
- [ ] エラーハンドリング・リトライ機構
- [ ] ジョブモニタリング

### Week 7: API・統合
- [ ] APIエンドポイント実装
- [ ] WebSocket通知（オプション）
- [ ] FE統合準備
- [ ] E2Eテスト

### Week 8: テスト・チューニング
- [ ] 品質評価の調整
- [ ] プロンプトチューニング
- [ ] パフォーマンステスト
- [ ] ドキュメント整備

---

## 🎯 成功指標（KPI）

### 品質指標
- [ ] ハンズオン生成成功率: **95%以上**
- [ ] 品質スコア平均: **0.85以上**
- [ ] 情報齟齬検出率: **90%以上**
- [ ] ユーザー満足度: **4.5/5.0以上**

### パフォーマンス指標
- [ ] 単一タスク生成時間: **平均2分以内**
- [ ] プロジェクト全体（20タスク）: **15分以内**
- [ ] WebSearch APIエラー率: **5%以下**
- [ ] Celeryタスク失敗率: **3%以下**

### UX指標
- [ ] バックグラウンド生成完了までの体感待ち時間: **ゼロ**（非同期）
- [ ] リアルタイム進捗通知の遅延: **1秒以内**
- [ ] 依存関係のあるタスクの優先生成率: **100%**

---

## 🔧 技術スタック

### バックエンド
- **FastAPI**: API実装
- **Celery**: バックグラウンドジョブ
- **Redis**: Celeryブローカー・結果バックエンド
- **LangChain**: ReActエージェント
- **Gemini 2.0 Flash**: LLM（高速・高品質）
- **Tavily API**: Web検索
- **BeautifulSoup / Readability**: HTMLパース

### データベース
- **PostgreSQL**: TaskHandsOn, HandsOnGenerationJob
- **Alembic**: マイグレーション

### モニタリング
- **Flower**: Celeryタスクモニタリング
- **Prometheus + Grafana**: メトリクス収集（オプション）

---

## ✅ 次のアクション

### 優先度1: 基盤構築（Week 1-2）

1. **DBスキーマ実装**
   - [x] `models/project_base.py` に `TaskHandsOn` テーブル追加
   - [x] `models/project_base.py` に `HandsOnGenerationJob` テーブル追加
   - [x] `create_tables.py` に新テーブルのインポート追加
   - [x] テーブル作成（devcontainer内で実行完了）
   - [x] `Task` モデルに `hands_on` リレーション追加
   - [x] redis バージョン競合修正（4.6.0に変更）

2. **Celery基盤セットアップ**
   - [x] `celery_app.py` 作成（設定ファイル）
   - [x] `.devcontainer/docker-compose.yml` に Redis, Celery Worker, Flower 追加
   - [x] `requirements.txt` に celery, redis, flower 追加
   - [x] devcontainer内で依存パッケージインストール完了
   - [x] devcontainer再起動・動作確認（Flower UI: http://localhost:5555）

3. **WebSearch統合**
   - [x] Tavily API キー取得（https://app.tavily.com/home から取得可能、月1000クレジット無料）
   - [x] `services/tools/web_search_tool.py` 実装
   - [x] `services/tools/document_fetch_tool.py` 実装
   - [x] WebSearch 疎通テスト（WebSearchTool・DocumentFetchTool動作確認済み）
   - [x] docker-compose.ymlにenv_file追加（.env環境変数を全サービスで使用可能）
   - [x] requirements.txtに依存追加（beautifulsoup4, html2text, requests）

### 優先度2: コアロジック実装（Week 3-4）

4. **TaskHandsOnAgent実装**
   - [x] `services/task_hands_on_agent.py` 作成
   - [x] ReActエージェント統合（LangChain）
   - [x] セクション別生成ロジック
   - [x] 品質評価ロジック（8項目チェック）
   - [x] WebSearch/DocumentFetchツール統合

5. **サービス層実装**
   - [x] `services/task_hands_on_service.py` 作成
   - [x] 依存関係解析・優先度ソート（トポロジカルソート）
   - [x] プロジェクトコンテキスト構築
   - [x] バッチ処理ロジック
   - [x] ジョブ管理機能（create_generation_job, get_job_status）
   - [x] ハンズオン取得・削除API

### 優先度3: 非同期処理統合（Week 5-6）

6. **Celeryタスク実装**
   - [x] `tasks/hands_on_tasks.py` 作成
   - [x] `generate_single_task_hands_on` タスク実装
   - [x] `generate_all_hands_on` タスク実装
   - [x] リトライ機構・エラーハンドリング（timeout/networkエラーで60秒後リトライ）
   - [x] バッチ処理統合（chain/group使用）

7. **API実装**
   - [x] `routers/task_hands_on.py` 作成
   - [x] `POST /api/task_hands_on/generate_all` 実装
   - [x] `GET /api/task_hands_on/status/{job_id}` 実装
   - [x] `GET /api/task_hands_on/{task_id}` 実装
   - [x] `POST /api/task_hands_on/preview` 実装（開発用）
   - [x] `DELETE /api/task_hands_on/{project_id}` 実装（開発用）
   - [x] `app.py` にルーター登録
   - [x] `celery_app.py` にタスクインポート追加
   - [x] Celeryワーカー動作確認（タスク登録成功）

### 優先度4: テスト・チューニング（Week 7-8）

8. **統合テスト**
   - [ ] E2Eフロー確認（タスク生成 → ハンズオン生成 → 取得）
   - [ ] 並列実行テスト（複数プロジェクト同時生成）
   - [ ] エラーケーステスト（WebSearch失敗、タイムアウトなど）

9. **パフォーマンスチューニング**
   - [ ] プロンプト最適化（品質向上）
   - [ ] バッチサイズ調整
   - [ ] Celery Worker 数の最適化
   - [ ] WebSearch キャッシュ導入検討

10. **ドキュメント整備**
    - [ ] API仕様書更新
    - [ ] 開発者ガイド作成
    - [ ] デプロイ手順書作成

---

## 📋 関連ドキュメント

- `/ASYNC_ARCHITECTURE_COMPARISON.md` - Celery vs BackgroundTasks 比較分析
- `/ARCHITECTURE_DESIGN_ANALYSIS.md` - 全体アーキテクチャ分析
- `/DB_DESIGN_COMPARISON_HANDS_ON.md` - DB設計比較（Task.detail vs TaskHandsOn）

---

**ドキュメント作成者**: Claude Code
**最終更新**: 2025-10-09
**ステータス**: 実装準備完了（Celery採用確定）
**アーキテクチャパターン**: Phase 2統合 + Celery非同期処理
