"""
TaskHandsOn Generation Schemas: Pydantic models for Structured Output

Phase 2: Plan-and-Execute パターンで使用する型定義
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ============================================
# Phase 1: Planner Output Schema
# ============================================

class InformationPlan(BaseModel):
    """Planner が生成する情報収集計画"""

    needs_dependencies: bool = Field(
        description="依存タスクの情報が必要かどうか"
    )

    dependency_search_keywords: List[str] = Field(
        default_factory=list,
        description="依存タスク検索のキーワード (例: ['database', 'authentication'])"
    )

    needs_use_case: bool = Field(
        description="プロジェクトのユースケース/仕様書が必要かどうか"
    )

    use_case_category: Optional[str] = Field(
        default=None,
        description="仕様書から取得する関連カテゴリ (例: 'データベース設計', 'API仕様')"
    )

    web_search_queries: List[str] = Field(
        default_factory=list,
        max_length=3,
        description="Web検索が必要な場合のクエリ (最大3つ)"
    )

    document_urls: List[str] = Field(
        default_factory=list,
        max_length=3,
        description="タスクに直接役立つ具体的なドキュメントページURL (最大3つ、ルートURLではなく特定のページ)"
    )


# ============================================
# Phase 3: Generator Output Schema
# ============================================

class CodeExample(BaseModel):
    """コード例"""

    description: str = Field(
        description="このコード例の説明 (何をするコードか)"
    )

    file_path: str = Field(
        description="実装先のファイルパス (例: 'back/models/user.py')"
    )

    code: str = Field(
        description="実際のコード (コメント付き、そのままコピペできる形式)"
    )

    language: str = Field(
        default="python",
        description="プログラミング言語"
    )


class TargetFile(BaseModel):
    """実装対象ファイル"""

    path: str = Field(
        description="ファイルパス (例: 'back/routers/auth.py')"
    )

    action: str = Field(
        description="実施する操作 (例: '新規作成', '関数追加', '修正')"
    )

    reason: str = Field(
        description="このファイルを対象とする理由"
    )


# ImplementationStep は不要 - implementation_steps は Markdown 文字列として生成


class TestingGuideline(BaseModel):
    """テストガイドライン"""

    test_type: str = Field(
        description="テストの種類 (例: '単体テスト', '結合テスト', '動作確認')"
    )

    description: str = Field(
        description="テスト内容の説明"
    )

    test_code: Optional[str] = Field(
        default=None,
        description="テストコード例 (ある場合)"
    )

    verification_points: List[str] = Field(
        description="確認すべきポイント"
    )


class CommonError(BaseModel):
    """よくあるエラー"""

    error: str = Field(
        description="エラーメッセージまたはエラーの種類"
    )

    cause: str = Field(
        description="エラーが発生する原因"
    )

    solution: str = Field(
        description="解決方法 (具体的な手順)"
    )


class ImplementationTip(BaseModel):
    """実装のポイント"""

    type: str = Field(
        description="タイプ: 'best_practice' (ベストプラクティス), 'pitfall' (落とし穴), 'security' (セキュリティ), 'performance' (パフォーマンス)"
    )

    tip: str = Field(
        description="ポイントの内容"
    )

    reason: str = Field(
        description="なぜこれが重要か (初心者向けの説明)"
    )


class Reference(BaseModel):
    """参考資料"""

    title: str = Field(
        description="資料のタイトル (例: 'React 公式ドキュメント (日本語)')"
    )

    url: str = Field(
        description="資料のURL"
    )

    type: str = Field(
        description="資料の種類: 'official_doc' (公式ドキュメント), 'tutorial' (入門チュートリアル), 'reference' (リファレンス), 'example' (サンプルコード)"
    )

    description: str = Field(
        default="",
        description="この資料が役立つ理由や内容の説明"
    )


class TaskHandsOnOutput(BaseModel):
    """TaskHandsOn 生成の最終出力"""

    overview: str = Field(
        description="このタスクの概要説明 (2-3文、実装の目的と役割を明確に)"
    )

    prerequisites: str = Field(
        description="前提条件 (依存タスクや必要な環境設定など)"
    )

    technical_context: str = Field(
        description="""このタスクで使う技術・概念の簡潔な説明。
初心者がハッカソンで詰まらないように、以下を含める:
- 使用する技術やライブラリの役割
- なぜこの技術を使うのか
- 基本的な動作原理
- 関連する重要な概念"""
    )

    target_files: List[TargetFile] = Field(
        description="実装対象ファイルのリスト"
    )

    implementation_steps: str = Field(
        description="""実装手順のMarkdown形式テキスト。以下のフォーマットで記述:

## Step 1: タイトル
説明文...

実装するコード:
```python
# コード
```

コマンド:
```bash
command here
```

## Step 2: タイトル
..."""
    )

    code_examples: List[CodeExample] = Field(
        description="具体的なコード例 (重要な実装箇所、コメント付き)"
    )

    testing_guidelines: List[TestingGuideline] = Field(
        description="テスト方法とチェックポイント"
    )

    common_errors: List[CommonError] = Field(
        default_factory=list,
        description="""よくあるエラーと解決方法。
初心者がハッカソンで詰まりやすいポイントを含める:
- タイポや設定ミス
- 環境構築の問題
- ライブラリのバージョン問題
- 典型的なロジックエラー"""
    )

    implementation_tips: List[ImplementationTip] = Field(
        default_factory=list,
        description="""実装のポイント (ベストプラクティス、落とし穴、セキュリティ、パフォーマンス)。
初心者の学習になるように:
- ベストプラクティスとその理由
- 避けるべきアンチパターン
- セキュリティ上の注意点
- パフォーマンス最適化のヒント"""
    )

    references: List[Reference] = Field(
        default_factory=list,
        description="""参考資料 (公式ドキュメント、入門チュートリアル、リファレンス)。
日本語資料を優先:
- 公式ドキュメント (日本語版がある場合は必ず日本語版)
- Zenn, Qiita などの信頼性の高い日本語チュートリアル
- 技術の基礎から学べる入門記事
- GitHubのサンプルリポジトリ"""
    )

    estimated_time_minutes: int = Field(
        description="実装にかかる推定時間 (分)"
    )
