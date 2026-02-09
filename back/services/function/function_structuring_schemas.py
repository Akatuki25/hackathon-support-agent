"""
Pydantic models for function structuring workflow.

These models are used for:
1. LLM structured output (with_structured_output)
2. Type-safe data flow between nodes
3. Validation and serialization

IMPORTANT: These models must be compatible with the DB schema in models/project_base.py
- StructuredFunction table
- FunctionDependency table
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
from datetime import datetime
import uuid


# =====================================================================
# Enums (must match DB constraints)
# =====================================================================

class FunctionCategory(str, Enum):
    """
    機能カテゴリ

    DB制約: StructuredFunction.category CHECK IN ('auth', 'data', 'logic', 'ui', 'api', 'deployment')
    """
    AUTH = "auth"           # 認証、ログイン、権限管理
    DATA = "data"           # データベース操作、CRUD、データ永続化
    LOGIC = "logic"         # ビジネスロジック、計算処理、アルゴリズム
    UI = "ui"               # フロントエンド、画面、ユーザーインターフェース
    API = "api"             # 外部API連携、通信、データ取得
    DEPLOYMENT = "deployment"  # デプロイ設定、環境構築、インフラ


class FunctionPriority(str, Enum):
    """
    機能優先度

    DB制約: StructuredFunction.priority CHECK IN ('Must', 'Should', 'Could', 'Wont')
    注意: アポストロフィなし（"Won't"ではなく"Wont"）
    """
    MUST = "Must"       # MVP必須機能（最小限のユーザー価値を提供）
    SHOULD = "Should"   # 価値は高いが必須ではない
    COULD = "Could"     # あれば良い機能
    WONT = "Wont"       # 今回は実装しない（アポストロフィなし）


class DependencyType(str, Enum):
    """
    依存関係タイプ

    DB: FunctionDependency.dependency_type (default='requires')
    """
    REQUIRES = "requires"  # AがないとBは動作しない
    BLOCKS = "blocks"      # Aが完了しないとBは開始できない
    RELATES = "relates"    # AとBは関連するが独立して実装可能


# =====================================================================
# Function Extraction (Phase: extract_functions)
# =====================================================================

class ExtractedFunction(BaseModel):
    """
    抽出された機能（カテゴリ・優先度は未確定）

    このモデルは extract_functions の出力として使用される。
    """
    function_name: str = Field(
        description="機能名（20文字以内、具体的に）",
        min_length=1,
        max_length=200
    )
    description: str = Field(
        description="実装内容の詳細（50文字以上、API仕様・画面要素・ビジネスロジックを含む）",
        min_length=50
    )
    estimated_category: FunctionCategory = Field(
        description="推定カテゴリ（後続ノードで確定される）"
    )
    text_position: int = Field(
        description="テキスト内の出現位置（重複排除・順序保持用）",
        ge=0
    )

    class Config:
        use_enum_values = True  # Enumを文字列として出力


class FunctionExtractionOutput(BaseModel):
    """
    機能抽出の出力

    LLM structured output用のラッパー。
    """
    functions: List[ExtractedFunction] = Field(
        description="抽出された機能リスト（15-25個を目標）"
    )


# =====================================================================
# Function Structuring (Phase: structure_functions)
# =====================================================================

class StructuredFunction(BaseModel):
    """
    構造化された機能（カテゴリ・優先度・依存関係が確定）

    このモデルは以下のフェーズで使用される:
    - categorize_functions の出力
    - assign_priorities の出力
    - analyze_dependencies の出力
    - 最終的にDBに保存される

    DB対応: models/project_base.py の StructuredFunction テーブル
    """
    function_name: str = Field(
        description="機能名",
        max_length=200
    )
    description: str = Field(
        description="実装内容の詳細"
    )
    category: FunctionCategory = Field(
        description="確定カテゴリ"
    )
    priority: FunctionPriority = Field(
        description="優先度（Must/Should/Could/Wont）"
    )
    dependencies: List[str] = Field(
        default_factory=list,
        description="依存する機能名のリスト（後で function_id に解決される）"
    )
    confidence: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="抽出精度（extraction_confidence）"
    )
    text_position: Optional[int] = Field(
        default=None,
        description="元テキストでの出現順序（order_index）"
    )

    class Config:
        use_enum_values = True


class StructuredFunctionOutput(BaseModel):
    """
    機能構造化の出力

    LLM structured output用のラッパー。
    """
    functions: List[StructuredFunction] = Field(
        description="構造化された機能リスト"
    )


# =====================================================================
# Function Dependencies (Phase: analyze_dependencies)
# =====================================================================

class FunctionDependency(BaseModel):
    """
    機能間の依存関係

    DB対応: models/project_base.py の FunctionDependency テーブル
    """
    from_function: str = Field(
        description="依存元の機能名（後で from_function_id に解決される）"
    )
    to_function: str = Field(
        description="依存先の機能名（後で to_function_id に解決される）"
    )
    dependency_type: DependencyType = Field(
        default=DependencyType.REQUIRES,
        description="依存関係のタイプ"
    )
    reason: Optional[str] = Field(
        default=None,
        description="依存関係の理由（ログ・デバッグ用）"
    )

    class Config:
        use_enum_values = True


class DependencyAnalysisOutput(BaseModel):
    """
    依存関係分析の出力

    LLM structured output用のラッパー。
    """
    dependencies: List[FunctionDependency] = Field(
        description="機能間の依存関係リスト"
    )


# =====================================================================
# Validation Results (Phase: validate_*)
# =====================================================================

class ValidationResult(BaseModel):
    """
    バリデーション結果

    各バリデーションフェーズ（extraction, categorization, priorities, dependencies）の出力。
    """
    is_valid: bool = Field(
        description="バリデーション成功/失敗"
    )
    score: float = Field(
        ge=0.0,
        le=1.0,
        description="品質スコア（0.0-1.0）"
    )
    issues: List[str] = Field(
        default_factory=list,
        description="検出された問題のリスト"
    )
    suggestions: List[str] = Field(
        default_factory=list,
        description="改善提案のリスト"
    )
    needs_revision: bool = Field(
        default=False,
        description="修正が必要かどうか"
    )


# =====================================================================
# Planning (Phase: planning)
# =====================================================================

class ExtractionPlan(BaseModel):
    """
    機能抽出の計画

    planning ノードの出力として使用される。
    """
    focus_areas: List[str] = Field(
        description="抽出する領域のリスト（例: ['認証', 'データ管理', 'UI/UX']）",
        min_items=1,
        max_items=10
    )
    batch_size: int = Field(
        default=6,
        ge=1,
        le=10,
        description="1バッチあたりの機能数"
    )
    extraction_strategy: str = Field(
        default="map_reduce",
        description="抽出戦略（sequential/parallel/map_reduce）"
    )
    estimated_function_count: int = Field(
        ge=1,
        le=50,
        description="推定される総機能数"
    )


# =====================================================================
# Coverage Analysis (Phase: coverage)
# =====================================================================

class ValidationIssue(BaseModel):
    """バリデーション問題"""
    category: str = Field(description="問題カテゴリ (function_count/granularity/essentiality/dependency)")
    severity: str = Field(description="重要度 (critical/warning)")
    message: str = Field(description="問題の詳細")
    affected_functions: List[str] = Field(default_factory=list, description="影響を受ける機能名リスト")

class FunctionValidationResult(BaseModel):
    """
    機能構造化バリデーション結果

    validation ノードの出力として使用される。
    """
    status: str = Field(description="検証結果 (PASS/REJECT)")
    issues: List[ValidationIssue] = Field(
        default_factory=list,
        description="検出された問題のリスト"
    )
    retry_instruction: str = Field(
        default="",
        description="再抽出時の具体的指示（statusがREJECTの場合のみ）"
    )
    function_count: int = Field(description="抽出された総機能数")
    must_count: int = Field(description="Must優先度の機能数")
    avg_description_length: float = Field(description="description平均文字数")
    has_circular_dependency: bool = Field(description="循環依存の有無")

class CoverageAnalysis(BaseModel):
    """
    網羅性分析の結果（非推奨: ハッカソン向けには不要）

    analyze_coverage ノードの出力として使用される。
    """
    coverage_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="機能要件書のカバレッジ率（%）"
    )
    missing_areas: List[str] = Field(
        default_factory=list,
        description="不足している領域のリスト"
    )
    duplicate_functions: List[dict] = Field(
        default_factory=list,
        description="重複機能のリスト（function_id, function_name, duplicate_of, reason）"
    )
    completion_status: str = Field(
        description="完了ステータス（complete/continue/replan）"
    )
    iteration_count: int = Field(
        ge=1,
        description="現在の反復回数"
    )
    reason: str = Field(
        description="判定理由"
    )


# =====================================================================
# DB Insert Models (for database operations)
# =====================================================================

class StructuredFunctionDB(BaseModel):
    """
    DB保存用のモデル（StructuredFunction テーブル）

    注意: function_id, project_id, created_at はDB側で自動生成される。
    """
    function_code: str = Field(
        description="機能コード（F001, F002, ...）",
        max_length=20
    )
    function_name: str = Field(
        max_length=200
    )
    description: str
    category: str  # Enum値を文字列として保存
    priority: str  # Enum値を文字列として保存
    extraction_confidence: float = Field(default=0.8)
    order_index: int
    source_doc_id: Optional[uuid.UUID] = None

    class Config:
        # Pydantic v1互換のため
        orm_mode = True


class FunctionDependencyDB(BaseModel):
    """
    DB保存用のモデル（FunctionDependency テーブル）

    注意: id, created_at はDB側で自動生成される。
    """
    from_function_id: uuid.UUID
    to_function_id: uuid.UUID
    dependency_type: str = "requires"

    class Config:
        orm_mode = True


# =====================================================================
# Helper Functions (for conversion between models)
# =====================================================================

def extracted_to_structured(
    extracted: ExtractedFunction,
    category: FunctionCategory,
    priority: FunctionPriority,
    dependencies: List[str] = None
) -> StructuredFunction:
    """
    ExtractedFunction を StructuredFunction に変換

    Args:
        extracted: 抽出された機能
        category: 確定カテゴリ
        priority: 優先度
        dependencies: 依存関係リスト

    Returns:
        構造化された機能
    """
    return StructuredFunction(
        function_name=extracted.function_name,
        description=extracted.description,
        category=category,
        priority=priority,
        dependencies=dependencies or [],
        confidence=0.8,
        text_position=extracted.text_position
    )


def structured_to_db(
    structured: StructuredFunction,
    function_code: str,
    order_index: int,
    source_doc_id: Optional[uuid.UUID] = None
) -> StructuredFunctionDB:
    """
    StructuredFunction を StructuredFunctionDB に変換（DB保存用）

    Args:
        structured: 構造化された機能
        function_code: 機能コード（F001など）
        order_index: 順序インデックス
        source_doc_id: 元ドキュメントID（オプション）

    Returns:
        DB保存用のモデル
    """
    return StructuredFunctionDB(
        function_code=function_code,
        function_name=structured.function_name,
        description=structured.description,
        category=structured.category.value if isinstance(structured.category, Enum) else structured.category,
        priority=structured.priority.value if isinstance(structured.priority, Enum) else structured.priority,
        extraction_confidence=structured.confidence,
        order_index=order_index,
        source_doc_id=source_doc_id
    )


# =====================================================================
# Example Usage (for documentation)
# =====================================================================

if __name__ == "__main__":
    # Example: Extracted function
    extracted = ExtractedFunction(
        function_name="ユーザー登録API",
        description="メールアドレスとパスワードでユーザーを新規登録する。入力バリデーション（メール形式、パスワード8文字以上）、既存ユーザー重複チェック、bcryptによるパスワードハッシュ化を実装。POST /api/users エンドポイントとして公開。",
        estimated_category=FunctionCategory.AUTH,
        text_position=1
    )

    # Example: Structured function
    structured = StructuredFunction(
        function_name="ユーザー登録API",
        description=extracted.description,
        category=FunctionCategory.AUTH,
        priority=FunctionPriority.MUST,
        dependencies=[],
        confidence=0.9,
        text_position=1
    )

    # Example: Function dependency
    dependency = FunctionDependency(
        from_function="ログイン機能",
        to_function="ユーザー登録API",
        dependency_type=DependencyType.REQUIRES,
        reason="ユーザーアカウントが必要"
    )

    print("✅ All schemas are valid and compatible with DB constraints.")
