"""
タスク品質評価サービス
2軸並列評価による品質改善システム
"""
import json
import uuid
import asyncio
from typing import List, Dict, Any, Optional, TypedDict
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from langgraph.graph import StateGraph, START, END
from langchain.prompts import ChatPromptTemplate

from .base_service import BaseService
from models.project_base import Task, StructuredFunction


# ======================
# データ型定義
# ======================

class QualityIssue(BaseModel):
    """品質問題"""
    issue_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "missing_task", "duplicate_task", "vague_description", etc.
    severity: str  # "critical", "high", "medium", "low"
    description: str
    suggested_action: str
    task_id: Optional[str] = None
    task_ids: Optional[List[str]] = None  # 複数タスクに関わる問題
    function_id: Optional[str] = None
    category: Optional[str] = None


class TaskModification(BaseModel):
    """タスク修正内容"""
    modification_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "add_task", "remove_task", "modify_task", "merge_tasks"
    task_id: Optional[str] = None
    task_ids: Optional[List[str]] = None
    new_task_data: Optional[Dict[str, Any]] = None
    modification_reason: str
    applied_at: str


class QualityEvaluationResult(BaseModel):
    """品質評価結果"""
    evaluator_type: str  # "layer" or "domain"
    overall_score: float  # 0-1
    issues: List[QualityIssue]
    is_acceptable: bool
    evaluation_time: float


class TwoAxisQualityState(TypedDict):
    """2軸評価ワークフローの状態"""
    # 入力データ
    original_tasks: List[Dict[str, Any]]
    current_tasks: List[Dict[str, Any]]
    functions: List[Dict[str, Any]]
    project_id: str
    
    # Phase 1: 並列評価結果
    layer_issues: List[Dict[str, Any]]
    domain_issues: List[Dict[str, Any]]
    evaluation_completed: bool
    
    # Phase 2: 統合結果
    all_issues: List[Dict[str, Any]]
    consolidated_issues: List[Dict[str, Any]]
    high_priority_issues: List[Dict[str, Any]]
    medium_priority_issues: List[Dict[str, Any]]
    
    # Phase 3: 修正履歴
    modifications_applied: List[Dict[str, Any]]
    high_priority_fixes_done: bool
    medium_priority_fixes_done: bool
    
    # Phase 4: 再評価制御
    iteration_count: int
    max_iterations: int
    re_evaluation_needed: bool
    is_acceptable: bool


# ======================
# 評価サービス
# ======================

class LayerConsistencyEvaluator(BaseService):
    """技術層内整合性評価"""
    
    def __init__(self, db: Session):
        super().__init__(db)
    
    def group_by_tech_layer(self, tasks: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """タスクを技術層別にグループ化"""
        layers = {}
        for task in tasks:
            category = task.get("category", "未分類")
            if category not in layers:
                layers[category] = []
            layers[category].append(task)
        return layers
    
    async def evaluate_layer_consistency(self, tasks: List[Dict[str, Any]]) -> QualityEvaluationResult:
        """技術層の整合性を評価"""
        import time
        start_time = time.time()
        
        layers = self.group_by_tech_layer(tasks)
        issues = []
        
        # DB層の整合性チェック
        if "DB設計" in layers:
            db_issues = await self.check_db_layer_issues(layers["DB設計"])
            issues.extend(db_issues)
        
        # API層の整合性チェック  
        if "バックエンド" in layers:
            api_issues = await self.check_api_layer_issues(layers["バックエンド"])
            issues.extend(api_issues)
            
        # FE層の整合性チェック
        if "フロントエンド" in layers:
            fe_issues = await self.check_frontend_layer_issues(layers["フロントエンド"])
            issues.extend(fe_issues)
        
        # 層間の基本的な整合性チェック
        cross_layer_issues = await self.check_cross_layer_basic_consistency(layers)
        issues.extend(cross_layer_issues)
        
        # スコア計算
        total_tasks = len(tasks)
        critical_issues = [i for i in issues if i.severity == "critical"]
        score = max(0.0, 1.0 - (len(critical_issues) * 0.3 + len(issues) * 0.1))
        
        return QualityEvaluationResult(
            evaluator_type="layer",
            overall_score=score,
            issues=issues,
            is_acceptable=len(critical_issues) == 0 and score >= 0.7,
            evaluation_time=time.time() - start_time
        )
    
    async def check_db_layer_issues(self, db_tasks: List[Dict[str, Any]]) -> List[QualityIssue]:
        """DB層の問題をチェック"""
        issues = []
        
        # テーブル作成タスクの存在チェック
        table_tasks = [t for t in db_tasks if "テーブル" in t.get("title", "")]
        
        if not table_tasks:
            issues.append(QualityIssue(
                type="missing_essential_task",
                severity="critical",
                description="DB設計カテゴリにテーブル作成タスクが不足",
                suggested_action="必要なテーブル作成タスクを追加",
                category="DB設計"
            ))
        
        # マイグレーション関連タスクのチェック
        migration_tasks = [t for t in db_tasks if "マイグレーション" in t.get("title", "") or "migration" in t.get("title", "").lower()]
        
        if table_tasks and not migration_tasks:
            issues.append(QualityIssue(
                type="missing_related_task",
                severity="high", 
                description="テーブル作成タスクがあるがマイグレーションタスクが不足",
                suggested_action="マイグレーション実行タスクを追加",
                category="DB設計"
            ))
        
        return issues
    
    async def check_api_layer_issues(self, api_tasks: List[Dict[str, Any]]) -> List[QualityIssue]:
        """API層の問題をチェック"""
        issues = []
        
        # 認証ミドルウェアの存在チェック
        auth_middleware = [t for t in api_tasks if "認証" in t.get("title", "") and ("ミドルウェア" in t.get("title", "") or "middleware" in t.get("title", "").lower())]
        protected_apis = [t for t in api_tasks if "API" in t.get("title", "") and "認証" not in t.get("title", "")]
        
        if protected_apis and not auth_middleware:
            issues.append(QualityIssue(
                type="missing_security_task",
                severity="critical",
                description="保護されたAPIがあるが認証ミドルウェアが不足",
                suggested_action="JWT認証ミドルウェア実装タスクを追加",
                category="バックエンド"
            ))
        
        # バリデーション関連タスクのチェック
        validation_tasks = [t for t in api_tasks if "バリデーション" in t.get("title", "") or "validation" in t.get("title", "").lower()]
        
        if len(api_tasks) > 3 and not validation_tasks:
            issues.append(QualityIssue(
                type="missing_quality_task",
                severity="medium",
                description="API実装タスクが多いがバリデーション処理が不足",
                suggested_action="入力バリデーション実装タスクを追加",
                category="バックエンド"
            ))
        
        return issues
    
    async def check_frontend_layer_issues(self, fe_tasks: List[Dict[str, Any]]) -> List[QualityIssue]:
        """フロントエンド層の問題をチェック"""
        issues = []
        
        # 共通コンポーネントの存在チェック
        common_components = [t for t in fe_tasks if "共通" in t.get("title", "") or "コンポーネント" in t.get("title", "")]
        individual_screens = [t for t in fe_tasks if "画面" in t.get("title", "") or "ページ" in t.get("title", "")]
        
        if len(individual_screens) > 2 and not common_components:
            issues.append(QualityIssue(
                type="missing_reusability_task",
                severity="high",
                description="個別画面が多いが共通コンポーネントが不足",
                suggested_action="共通ヘッダー・ナビゲーションコンポーネント作成タスクを追加",
                category="フロントエンド"
            ))
        
        # 状態管理関連タスクのチェック
        auth_screens = [t for t in fe_tasks if "ログイン" in t.get("title", "") or "認証" in t.get("title", "")]
        state_management = [t for t in fe_tasks if "状態" in t.get("title", "") or "store" in t.get("title", "").lower()]
        
        if auth_screens and not state_management:
            issues.append(QualityIssue(
                type="missing_architecture_task",
                severity="high",
                description="認証画面があるが状態管理が不足",
                suggested_action="認証状態管理（Zustand/Redux）実装タスクを追加",
                category="フロントエンド"
            ))
        
        return issues
    
    async def check_cross_layer_basic_consistency(self, layers: Dict[str, List[Dict[str, Any]]]) -> List[QualityIssue]:
        """層間の基本的な整合性をチェック"""
        issues = []
        
        has_frontend = "フロントエンド" in layers and len(layers["フロントエンド"]) > 0
        has_backend = "バックエンド" in layers and len(layers["バックエンド"]) > 0  
        has_db = "DB設計" in layers and len(layers["DB設計"]) > 0
        
        # フロントエンドがあるのにバックエンドがない
        if has_frontend and not has_backend:
            issues.append(QualityIssue(
                type="missing_essential_layer",
                severity="critical",
                description="フロントエンドタスクがあるのにバックエンドタスクが不足",
                suggested_action="対応するAPI実装タスクを追加",
                category="バックエンド"
            ))
        
        # バックエンドがあるのにDBがない（データが必要な場合）
        if has_backend and not has_db:
            # データ系のAPIがある場合のみチェック
            data_apis = [
                t for t in layers.get("バックエンド", [])
                if any(keyword in t.get("title", "").lower() for keyword in ["crud", "データ", "登録", "取得", "更新", "削除"])
            ]
            
            if data_apis:
                issues.append(QualityIssue(
                    type="missing_essential_layer",
                    severity="critical", 
                    description="データ操作APIがあるのにDB設計タスクが不足",
                    suggested_action="必要なテーブル設計タスクを追加",
                    category="DB設計"
                ))
        
        return issues


class DomainCompletenessEvaluator(BaseService):
    """ドメイン完結性評価"""
    
    def __init__(self, db: Session):
        super().__init__(db)
    
    def group_by_function_id(self, tasks: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """タスクを機能ID別にグループ化"""
        domains = {}
        for task in tasks:
            function_id = task.get("function_id")
            if function_id:
                if function_id not in domains:
                    domains[function_id] = []
                domains[function_id].append(task)
        return domains
    
    def get_function_by_id(self, functions: List[Dict[str, Any]], function_id: str) -> Optional[Dict[str, Any]]:
        """機能IDから機能情報を取得"""
        for func in functions:
            if func.get("function_id") == function_id:
                return func
        return None
    
    async def evaluate_domain_completeness(self, tasks: List[Dict[str, Any]], functions: List[Dict[str, Any]]) -> QualityEvaluationResult:
        """ドメインの完結性を評価"""
        import time
        start_time = time.time()
        
        domains = self.group_by_function_id(tasks)
        issues = []
        
        for function_id, domain_tasks in domains.items():
            function = self.get_function_by_id(functions, function_id)
            if function:
                domain_issues = await self.check_domain_completeness(domain_tasks, function)
                issues.extend(domain_issues)
        
        # 機能に属さないタスクのチェック
        orphan_tasks = [t for t in tasks if not t.get("function_id")]
        if orphan_tasks:
            orphan_issues = await self.check_orphan_tasks(orphan_tasks)
            issues.extend(orphan_issues)
        
        # スコア計算
        total_functions = len(functions)
        functions_with_issues = len(set(i.function_id for i in issues if i.function_id))
        score = max(0.0, 1.0 - (functions_with_issues / total_functions if total_functions > 0 else 0))
        
        return QualityEvaluationResult(
            evaluator_type="domain",
            overall_score=score,
            issues=issues,
            is_acceptable=len([i for i in issues if i.severity == "critical"]) == 0 and score >= 0.7,
            evaluation_time=time.time() - start_time
        )
    
    async def check_domain_completeness(self, domain_tasks: List[Dict[str, Any]], function: Dict[str, Any]) -> List[QualityIssue]:
        """特定ドメインの完結性をチェック"""
        issues = []
        
        function_id = function.get("function_id")
        function_name = function.get("function_name", "")
        function_category = function.get("category", "")
        
        # 必要な技術層を判定
        required_layers = self.determine_required_layers(function)
        existing_layers = set(task.get("category", "") for task in domain_tasks)
        
        # 不足している層をチェック
        missing_layers = required_layers - existing_layers
        for layer in missing_layers:
            issues.append(QualityIssue(
                type="missing_layer_in_domain",
                severity="high",
                description=f"{function_name}に{layer}タスクが不足",
                suggested_action=f"{function_name}の{layer}実装タスクを追加",
                function_id=function_id,
                category=layer
            ))
        
        # タスク数による完結性チェック
        if len(domain_tasks) == 1:
            issues.append(QualityIssue(
                type="insufficient_task_breakdown",
                severity="medium",
                description=f"{function_name}のタスク分解が不十分（1タスクのみ）",
                suggested_action="より詳細なタスクに分解",
                function_id=function_id
            ))
        
        return issues
    
    def determine_required_layers(self, function: Dict[str, Any]) -> set:
        """機能に必要な技術層を判定"""
        function_category = function.get("category", "")
        function_name = function.get("function_name", "")
        
        required = set()
        
        # カテゴリベースの判定
        if function_category == "auth":
            required = {"DB設計", "バックエンド", "フロントエンド"}
        elif function_category == "data":
            required = {"DB設計", "バックエンド", "フロントエンド"}
        elif function_category == "ui":
            required = {"フロントエンド"}
        elif function_category == "api":
            required = {"バックエンド"}
        else:
            # 機能名から推測
            if any(keyword in function_name for keyword in ["登録", "管理", "CRUD", "データ"]):
                required = {"DB設計", "バックエンド", "フロントエンド"}
            elif any(keyword in function_name for keyword in ["画面", "表示", "UI"]):
                required = {"フロントエンド"}
            else:
                required = {"バックエンド"}  # デフォルト
        
        return required
    
    async def check_orphan_tasks(self, orphan_tasks: List[Dict[str, Any]]) -> List[QualityIssue]:
        """機能に属さないタスクをチェック"""
        issues = []
        
        for task in orphan_tasks:
            task_title = task.get("title", "")
            
            # インフラ系タスクは問題なし
            if any(keyword in task_title for keyword in ["環境", "設定", "デプロイ", "プレゼン"]):
                continue
            
            # それ以外は機能への紐付けが必要
            issues.append(QualityIssue(
                type="orphan_task", 
                severity="medium",
                description=f"タスク「{task_title}」が機能に紐付いていない",
                suggested_action="適切な機能に紐付けるか、インフラ系タスクとして分類",
                task_id=task.get("task_id")
            ))
        
        return issues


# ======================
# 統合評価サービス  
# ======================

class TaskQualityEvaluationService(BaseService):
    """2軸品質評価メインサービス"""
    
    def __init__(self, db: Session):
        super().__init__(db)
        self.layer_evaluator = LayerConsistencyEvaluator(db)
        self.domain_evaluator = DomainCompletenessEvaluator(db)
    
    async def evaluate_tasks_in_memory(self, tasks: List[Dict[str, Any]], functions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        メモリ上のタスクを評価（DB読み込みなし）
        統合サービスから呼ばれる
        """
        # 2軸並列評価
        layer_result, domain_result = await asyncio.gather(
            self.layer_evaluator.evaluate_layer_consistency(tasks),
            self.domain_evaluator.evaluate_domain_completeness(tasks, functions)
        )
        
        # 結果統合
        all_issues = layer_result.issues + domain_result.issues
        consolidated_issues = self.consolidate_duplicate_issues(all_issues)
        
        # 総合スコア計算
        overall_score = (layer_result.overall_score + domain_result.overall_score) / 2
        
        return {
            "overall_score": overall_score,
            "layer_evaluation": layer_result.dict(),
            "domain_evaluation": domain_result.dict(),
            "consolidated_issues": [issue.dict() for issue in consolidated_issues],
            "total_issues": len(consolidated_issues),
            "critical_issues": len([i for i in consolidated_issues if i.severity == "critical"]),
            "is_acceptable": overall_score >= 0.7 and len([i for i in consolidated_issues if i.severity == "critical"]) == 0,
            "suggested_improvements": self._generate_improvement_tasks(consolidated_issues)
        }
    
    def _generate_improvement_tasks(self, issues: List[QualityIssue]) -> List[Dict[str, Any]]:
        """品質問題から改善タスクを生成"""
        improvement_tasks = []
        
        for issue in issues:
            if issue.severity in ["critical", "high"]:
                improvement_tasks.append({
                    "title": issue.suggested_action,
                    "description": f"品質改善: {issue.description}",
                    "category": issue.category or "その他",
                    "priority": "Must" if issue.severity == "critical" else "Should",
                    "estimated_hours": 2.0,
                    "function_id": issue.function_id,
                    "is_quality_improvement": True
                })
        
        return improvement_tasks
    
    def tasks_to_dict_list(self, tasks: List[Task]) -> List[Dict[str, Any]]:
        """TaskオブジェクトをDict形式に変換"""
        return [
            {
                "task_id": str(task.task_id),
                "project_id": str(task.project_id),
                "title": task.title,
                "description": task.description,
                "category": task.category,
                "priority": task.priority,
                "function_id": str(task.function_id) if task.function_id else None,
                "node_id": task.node_id,
                "estimated_hours": task.estimated_hours,
                "assignee": task.assignee,
                "completed": task.completed
            }
            for task in tasks
        ]
    
    def functions_to_dict_list(self, functions: List[StructuredFunction]) -> List[Dict[str, Any]]:
        """StructuredFunctionオブジェクトをDict形式に変換"""
        return [
            {
                "function_id": str(func.function_id),
                "function_code": func.function_code,
                "function_name": func.function_name,
                "description": func.description,
                "category": func.category,
                "priority": func.priority
            }
            for func in functions
        ]
    
    
    def consolidate_duplicate_issues(self, issues: List[QualityIssue]) -> List[QualityIssue]:
        """重複する問題を統合"""
        consolidated = []
        seen_descriptions = set()
        
        for issue in issues:
            # 説明文の類似性で重複判定（簡易版）
            if issue.description not in seen_descriptions:
                consolidated.append(issue)
                seen_descriptions.add(issue.description)
        
        return consolidated

    
    async def create_quality_workflow(self) -> StateGraph:
        """品質評価ワークフローを作成"""
        
        # ワークフロー定義
        workflow = StateGraph(TwoAxisQualityState)
        
        # ノード追加
        workflow.add_node("parallel_evaluation", self._parallel_evaluation_node)
        workflow.add_node("consolidate_issues", self._consolidate_issues_node)
        workflow.add_node("prioritize_issues", self._prioritize_issues_node)
        workflow.add_node("apply_high_priority_fixes", self._apply_high_priority_fixes_node)
        workflow.add_node("apply_medium_priority_fixes", self._apply_medium_priority_fixes_node)
        workflow.add_node("check_re_evaluation", self._check_re_evaluation_node)
        
        # エッジ定義
        workflow.add_edge(START, "parallel_evaluation")
        workflow.add_edge("parallel_evaluation", "consolidate_issues")
        workflow.add_edge("consolidate_issues", "prioritize_issues")
        workflow.add_edge("prioritize_issues", "apply_high_priority_fixes")
        workflow.add_edge("apply_high_priority_fixes", "apply_medium_priority_fixes")
        workflow.add_edge("apply_medium_priority_fixes", "check_re_evaluation")
        
        # 条件付きエッジ
        workflow.add_conditional_edges(
            "check_re_evaluation",
            self._should_re_evaluate,
            {
                "re_evaluate": "parallel_evaluation",
                "end": END
            }
        )
        
        return workflow.compile()
    
    async def _parallel_evaluation_node(self, state: TwoAxisQualityState) -> TwoAxisQualityState:
        """並列評価ノード"""
        print(f"並列評価開始 - プロジェクト: {state['project_id']}")
        
        # 2軸並列評価
        layer_result, domain_result = await asyncio.gather(
            self.layer_evaluator.evaluate_layer_consistency(state["current_tasks"]),
            self.domain_evaluator.evaluate_domain_completeness(state["current_tasks"], state["functions"])
        )
        
        # 結果を状態に反映
        state["layer_issues"] = [issue.dict() for issue in layer_result.issues]
        state["domain_issues"] = [issue.dict() for issue in domain_result.issues]
        state["evaluation_completed"] = True
        
        print(f"並列評価完了 - Layer問題数: {len(layer_result.issues)}, Domain問題数: {len(domain_result.issues)}")
        
        return state
    
    async def _consolidate_issues_node(self, state: TwoAxisQualityState) -> TwoAxisQualityState:
        """問題統合ノード"""
        print("問題統合開始")
        
        # 2軸の問題を統合
        all_issues_dicts = state["layer_issues"] + state["domain_issues"]
        all_issues = [QualityIssue(**issue_dict) for issue_dict in all_issues_dicts]
        
        # 重複排除
        consolidated = self.consolidate_duplicate_issues(all_issues)
        
        state["all_issues"] = all_issues_dicts
        state["consolidated_issues"] = [issue.dict() for issue in consolidated]
        
        print(f"問題統合完了 - 統合前: {len(all_issues)}, 統合後: {len(consolidated)}")
        
        return state
    
    async def _prioritize_issues_node(self, state: TwoAxisQualityState) -> TwoAxisQualityState:
        """問題優先度付けノード"""
        print("問題優先度付け開始")
        
        consolidated_issues = [QualityIssue(**issue_dict) for issue_dict in state["consolidated_issues"]]
        
        # 重要度別に分類
        high_priority = [i for i in consolidated_issues if i.severity in ["critical", "high"]]
        medium_priority = [i for i in consolidated_issues if i.severity == "medium"]
        
        state["high_priority_issues"] = [issue.dict() for issue in high_priority]
        state["medium_priority_issues"] = [issue.dict() for issue in medium_priority]
        
        print(f"優先度付け完了 - 高優先度: {len(high_priority)}, 中優先度: {len(medium_priority)}")
        
        return state
    
    async def _apply_high_priority_fixes_node(self, state: TwoAxisQualityState) -> TwoAxisQualityState:
        """高優先度問題修正ノード"""
        print("高優先度問題修正開始")
        
        high_priority_issues = [QualityIssue(**issue_dict) for issue_dict in state["high_priority_issues"]]
        
        if high_priority_issues:
            # 修正を適用（実際の実装では個別の修正ロジックを呼び出し）
            modifications = await self._generate_task_modifications(high_priority_issues)
            
            # 修正履歴に追加
            if "modifications_applied" not in state:
                state["modifications_applied"] = []
            
            state["modifications_applied"].extend([mod.dict() for mod in modifications])
            
            print(f"高優先度修正完了 - 修正数: {len(modifications)}")
        else:
            print("高優先度問題なし")
        
        state["high_priority_fixes_done"] = True
        return state
    
    async def _apply_medium_priority_fixes_node(self, state: TwoAxisQualityState) -> TwoAxisQualityState:
        """中優先度問題修正ノード"""
        print("中優先度問題修正開始")
        
        medium_priority_issues = [QualityIssue(**issue_dict) for issue_dict in state["medium_priority_issues"]]
        
        if medium_priority_issues:
            # 中優先度は選択的に修正（時間制限等を考慮）
            selected_issues = medium_priority_issues[:3]  # 最大3件まで
            modifications = await self._generate_task_modifications(selected_issues)
            
            # 修正履歴に追加
            if "modifications_applied" not in state:
                state["modifications_applied"] = []
            
            state["modifications_applied"].extend([mod.dict() for mod in modifications])
            
            print(f"中優先度修正完了 - 修正数: {len(modifications)}")
        else:
            print("中優先度問題なし")
        
        state["medium_priority_fixes_done"] = True
        return state
    
    async def _check_re_evaluation_node(self, state: TwoAxisQualityState) -> TwoAxisQualityState:
        """再評価判定ノード"""
        print("再評価判定開始")
        
        # イテレーション回数を増加
        state["iteration_count"] = state.get("iteration_count", 0) + 1
        max_iterations = state.get("max_iterations", 3)
        
        # 修正が適用されたかチェック
        has_modifications = len(state.get("modifications_applied", [])) > 0
        
        # 再評価の必要性を判定
        needs_re_eval = (
            has_modifications and 
            state["iteration_count"] < max_iterations and
            len(state.get("high_priority_issues", [])) > 0
        )
        
        state["re_evaluation_needed"] = needs_re_eval
        
        if needs_re_eval:
            print(f"再評価実行 - イテレーション {state['iteration_count']}/{max_iterations}")
            # 修正を現在のタスクに反映（簡易版）
            state["current_tasks"] = self._apply_modifications_to_tasks(
                state["current_tasks"], 
                state.get("modifications_applied", [])
            )
        else:
            # 最終的な受け入れ判定
            critical_count = len([i for i in state.get("consolidated_issues", []) if i.get("severity") == "critical"])
            state["is_acceptable"] = critical_count == 0
            print(f"評価完了 - 受け入れ可能: {state['is_acceptable']}")
        
        return state
    
    def _should_re_evaluate(self, state: TwoAxisQualityState) -> str:
        """再評価条件判定"""
        return "re_evaluate" if state.get("re_evaluation_needed", False) else "end"
    
    async def _generate_task_modifications(self, issues: List[QualityIssue]) -> List[TaskModification]:
        """問題から修正案を生成"""
        modifications = []
        
        for issue in issues:
            modification = TaskModification(
                type="add_task",  # 簡易版では追加のみ対応
                modification_reason=f"解決: {issue.description}",
                applied_at=str(issue.issue_id),
                new_task_data={
                    "title": f"修正タスク: {issue.suggested_action}",
                    "description": issue.suggested_action,
                    "category": issue.category or "その他",
                    "priority": "高" if issue.severity in ["critical", "high"] else "中",
                    "function_id": issue.function_id
                }
            )
            modifications.append(modification)
        
        return modifications
    
    
    def _apply_modifications_to_tasks(self, current_tasks: List[Dict[str, Any]], modifications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """修正を現在のタスクに適用"""
        updated_tasks = current_tasks.copy()
        
        for mod_dict in modifications:
            mod = TaskModification(**mod_dict)
            if mod.type == "add_task" and mod.new_task_data:
                # 新しいタスクを追加
                new_task = mod.new_task_data.copy()
                new_task["task_id"] = f"generated_{mod.modification_id}"
                updated_tasks.append(new_task)
        
        return updated_tasks
    
