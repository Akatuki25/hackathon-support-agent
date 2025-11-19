"""
TaskHandsOnPlanner: タスクハンズオン生成のための情報収集計画を立てる

Phase 2: Plan-and-Execute パターンの Planner
"""

import os
from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from services.task_hands_on_schemas import InformationPlan


class TaskHandsOnPlanner:
    """タスクハンズオン生成のための情報収集計画を立てる"""

    def __init__(self):
        self.model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.3,
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )

    async def create_plan(self, task_info: Dict[str, Any]) -> InformationPlan:
        """
        タスク情報から情報収集計画を作成

        Args:
            task_info: タスク情報
                - title: タスクタイトル
                - category: カテゴリ
                - description: 説明
                - priority: 優先度
                - project_context: プロジェクトコンテキスト (フレームワークなど)

        Returns:
            InformationPlan: 情報収集計画
        """
        prompt = self._build_planning_prompt(task_info)

        # Gemini 2.0 Structured Output を使用 (非同期版)
        structured_llm = self.model.with_structured_output(InformationPlan)
        plan = await structured_llm.ainvoke(prompt)

        return plan

    def _build_planning_prompt(self, task_info: Dict[str, Any]) -> str:
        """プランニング用のプロンプトを構築"""

        title = task_info.get("title", "")
        category = task_info.get("category", "")
        description = task_info.get("description", "")
        priority = task_info.get("priority", "")
        project_context = task_info.get("project_context", {})

        # プロジェクトコンテキストの整形
        framework_info = project_context.get("framework", "")
        tech_stack = project_context.get("tech_stack", [])
        tech_stack_str = ", ".join(tech_stack) if tech_stack else "未指定"

        prompt = f"""あなたはハッカソンプロジェクトのタスク実装ガイド作成の計画を立てるエージェントです。

## タスク情報
- **タイトル**: {title}
- **カテゴリ**: {category}
- **説明**: {description}
- **優先度**: {priority}

## プロジェクトコンテキスト
- **フレームワーク**: {framework_info}
- **技術スタック**: {tech_stack_str}

## あなたの役割
このタスクの実装ガイド(ハンズオン)を作成するために、どの情報を収集すべきか計画を立ててください。

## 判断基準

### 1. 依存タスクの情報が必要か？ (needs_dependencies)
以下の場合は `true`:
- 他のタスクで実装されたコードを参照・拡張する必要がある
- データベースモデルや認証など、基盤機能に依存している
- 既存のAPIやサービスを利用する

以下の場合は `false`:
- 完全に独立した新規機能
- プロジェクト初期のセットアップタスク

### 2. 依存タスク検索キーワード (dependency_search_keywords)
`needs_dependencies` が `true` の場合、関連タスクを探すキーワードをリストアップ。
例: ["database", "authentication", "user model"]

### 3. ユースケース/仕様書が必要か？ (needs_use_case)
以下の場合は `true`:
- ビジネスロジックやユーザーフローの理解が必要
- UI/UX要件の確認が必要
- 全体の仕様との整合性確保が重要

以下の場合は `false`:
- 技術的なセットアップのみ
- 汎用的なユーティリティ実装

### 4. ユースケースカテゴリ (use_case_category)
`needs_use_case` が `true` の場合、仕様書から取得したい関連セクション。
例: "データベース設計", "API仕様", "認証フロー"

### 5. Web検索クエリ (web_search_queries)
技術的な実装方法を調べる必要がある場合のみ追加 (最大3つ)。
例: ["{framework_info} authentication best practices", "FastAPI CORS setup"]

以下の場合は不要:
- 基本的な実装のみ
- プロジェクト内の情報で十分

### 6. 公式ドキュメントURL (document_urls)
このタスクの実装に直接役立つ**具体的なドキュメントページのURL**を提供してください (最大3つ)。

⚠️ **重要**:
- ❌ ルートURL (例: https://fastapi.tiangolo.com/) は避ける
- ✅ 特定の機能・トピックのページ (例: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
- タスクで使用する技術・ライブラリに関連する具体的なページ
- チュートリアル、APIリファレンス、ベストプラクティスガイドなど

**例**:
- タスク「FastAPI JWT認証実装」 → ["https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/", "https://pyjwt.readthedocs.io/en/stable/usage.html"]
- タスク「Next.js App Router データフェッチ」 → ["https://nextjs.org/docs/app/building-your-application/data-fetching", "https://nextjs.org/docs/app/api-reference/functions/fetch"]
- タスク「PostgreSQL インデックス最適化」 → ["https://www.postgresql.org/docs/current/indexes-types.html", "https://www.postgresql.org/docs/current/sql-createindex.html"]

## 出力
上記の判断基準に基づいて、InformationPlan スキーマに従った計画を出力してください。
"""

        return prompt
