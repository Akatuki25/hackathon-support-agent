"""
State definitions for FunctionStructuring workflow using LangGraph StateGraph.

This module defines TypedDict states for Plan-and-Execute pattern.
"""

from typing import TypedDict, List, Dict, Optional, Any
from services.function_structuring_schemas import (
    ExtractedFunction,
    StructuredFunction,
    FunctionDependency,
    ExtractionPlan,
    ValidationResult,
    CoverageAnalysis
)


class FocusAreaState(TypedDict, total=False):
    """
    focus_area別の処理状態

    各focus_area（例: "認証", "データ管理", "UI/UX"）ごとに
    独立した抽出・構造化を並列実行する。
    """
    focus_area: str
    extracted_functions: List[Dict]  # ExtractedFunction.model_dump()のリスト
    structured_functions: List[Dict]  # StructuredFunction.model_dump()のリスト
    dependencies: List[Dict]          # FunctionDependency.model_dump()のリスト
    processing_time: float            # 処理時間（秒）


class GlobalState(TypedDict, total=False):
    """
    グローバル状態（全ノードで共有）

    Plan-and-Executeパターンのメイン状態。
    各ノードはこの状態を読み取り、更新する。
    """
    # ========================================
    # 入力データ
    # ========================================
    project_id: str
    function_doc: str           # 必須: 機能要件書
    specification: Optional[str]  # オプション: 要件定義書
    framework_doc: Optional[str]  # オプション: 技術スタック情報
    relevant_qas: List[Dict]      # 関連Q&A
    constraints: Dict             # プロジェクト制約（期間、人数など）
    technology: Dict              # 技術制約（フロント、バックエンドなど）

    # ========================================
    # Context Cache
    # ========================================
    cache_name: Optional[str]     # Google GenAI Context Cache名
    cache_created: bool           # キャッシュ作成済みフラグ

    # ========================================
    # 計画フェーズ
    # ========================================
    plan: Optional[Dict]          # ExtractionPlan.model_dump()
    focus_areas: List[str]        # 抽出対象領域のリスト（例: ["認証", "データ", "UI"]）

    # ========================================
    # 並列抽出フェーズ
    # ========================================
    area_states: Dict[str, FocusAreaState]  # focus_area → FocusAreaState

    # ========================================
    # マージフェーズ
    # ========================================
    all_functions: List[Dict]     # StructuredFunction.model_dump()のリスト（全focus_area統合後）
    all_dependencies: List[Dict]  # FunctionDependency.model_dump()のリスト

    # ========================================
    # 最終バリデーション
    # ========================================
    final_validation: Optional[Dict]  # 最終判定結果

    # ========================================
    # DB永続化
    # ========================================
    db_saved: bool                # DB保存済みフラグ
    saved_function_ids: List[str] # 保存された機能のID一覧

    # ========================================
    # カバレッジ分析
    # ========================================
    coverage_analysis: Optional[Dict]  # CoverageAnalysis.model_dump()
    coverage_rate: float              # カバレッジ率（0.0-1.0）
    completion_status: str            # "complete" | "continue" | "replan"

    # ========================================
    # エラー・リトライ
    # ========================================
    iteration_count: int          # 現在の反復回数
    max_iterations: int           # 最大反復回数（デフォルト3）
    retry_count: int              # リトライ回数
    errors: List[str]             # エラーメッセージのリスト

    # ========================================
    # メタデータ
    # ========================================
    workflow_start_time: float    # ワークフロー開始時刻（Unix timestamp）
    workflow_end_time: Optional[float]  # ワークフロー終了時刻
    total_tokens: int             # 総消費トークン数
    total_cost: float             # 総コスト（USD）


class SubGraphState(TypedDict, total=False):
    """
    SubGraph用の状態（focus_area別の処理）

    parallel_extraction_node内でfocus_areaごとに
    SubGraphを作成し、並列実行する。
    """
    # 入力（親グラフから継承）
    focus_area: str
    function_doc: str
    specification: Optional[str]
    constraints: Dict
    cache_name: Optional[str]

    # 処理結果
    extracted_functions: List[Dict]    # extract_map_reduce_nodeの出力
    categorized_functions: List[Dict]  # categorize_nodeの出力（並列）
    prioritized_functions: List[Dict]  # assign_priority_nodeの出力（並列）
    dependencies: List[Dict]           # analyze_dependencies_nodeの出力（並列）

    # バリデーション結果（並列実行）
    extraction_validation: Optional[Dict]
    categorization_validation: Optional[Dict]
    priority_validation: Optional[Dict]
    dependency_validation: Optional[Dict]

    # 最終統合結果
    structured_functions: List[Dict]   # 構造化済み機能（カテゴリ・優先度・依存関係確定）

    # エラー
    errors: List[str]


# ========================================
# ヘルパー関数
# ========================================

def create_initial_state(
    project_id: str,
    function_doc: str,
    specification: Optional[str] = None,
    framework_doc: Optional[str] = None,
    relevant_qas: Optional[List[Dict]] = None,
    constraints: Optional[Dict] = None,
    technology: Optional[Dict] = None,
    max_iterations: int = 3
) -> GlobalState:
    """
    初期状態を作成

    Args:
        project_id: プロジェクトID
        function_doc: 機能要件書（必須）
        specification: 要件定義書（オプション）
        framework_doc: 技術スタック情報（オプション）
        relevant_qas: 関連Q&A（オプション）
        constraints: プロジェクト制約（オプション）
        technology: 技術制約（オプション）
        max_iterations: 最大反復回数

    Returns:
        GlobalState初期値
    """
    return GlobalState(
        # 入力
        project_id=project_id,
        function_doc=function_doc,
        specification=specification,
        framework_doc=framework_doc,
        relevant_qas=relevant_qas or [],
        constraints=constraints or {},
        technology=technology or {},

        # Cache
        cache_name=None,
        cache_created=False,

        # 計画
        plan=None,
        focus_areas=[],

        # 並列抽出
        area_states={},

        # マージ
        all_functions=[],
        all_dependencies=[],

        # バリデーション
        final_validation=None,

        # DB永続化
        db_saved=False,
        saved_function_ids=[],

        # カバレッジ
        coverage_analysis=None,
        coverage_rate=0.0,
        completion_status="continue",

        # エラー・リトライ
        iteration_count=0,
        max_iterations=max_iterations,
        retry_count=0,
        errors=[],

        # メタデータ
        workflow_start_time=0.0,
        workflow_end_time=None,
        total_tokens=0,
        total_cost=0.0
    )


def create_focus_area_state(focus_area: str) -> FocusAreaState:
    """
    focus_area用の初期状態を作成

    Args:
        focus_area: 領域名（例: "認証"）

    Returns:
        FocusAreaState初期値
    """
    return FocusAreaState(
        focus_area=focus_area,
        extracted_functions=[],
        structured_functions=[],
        validation_results=[],
        processing_time=0.0
    )
