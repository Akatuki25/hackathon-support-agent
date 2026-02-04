"""
完全なタスク生成パイプライン
機能からタスクを生成し、品質評価、依存関係、座標計算まで一括処理
"""
import json
import uuid
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from ..core import BaseService
from ..deprecated.task_generation_service import TaskGenerationService, GeneratedTask
from ..deprecated.task_quality_evaluation_service import TaskQualityEvaluationService
from models.project_base import (
    ProjectBase, StructuredFunction, Task, TaskDependency
)


class CompleteTask(BaseModel):
    """完全なタスク情報（DB保存前の最終形）"""
    # 基本情報
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    title: str
    description: str
    detail: str
    
    # タスク属性
    priority: str  # 'Must', 'Should', 'Could', 'Won't'
    status: str = "TODO"
    category: str  # 'DB設計', 'バックエンド', 'フロントエンド' など
    estimated_hours: float
    assignee: Optional[str] = None
    completed: bool = False
    
    # ReactFlow用
    node_id: str  # 'start', 'n1', 'n2'...
    position_x: int
    position_y: int
    
    # 関連情報
    function_id: Optional[str] = None
    
    # 依存関係（後で TaskDependency として保存）
    depends_on_node_ids: List[str] = []


class CompleteTaskSet(BaseModel):
    """完全なタスクセット（全エージェント処理後）"""
    tasks: List[CompleteTask]
    dependencies: List[Dict[str, Any]]  # edge情報
    quality_score: float
    total_processing_time: float


class CompleteTaskGenerationService(BaseService):
    """完全なタスク生成パイプラインサービス"""
    
    def __init__(self, db: Session):
        super().__init__(db)
        self.task_generator = TaskGenerationService(db)
        self.quality_evaluator = TaskQualityEvaluationService(db)
    
    async def generate_complete_task_set(self, project_id: str) -> Dict[str, Any]:
        """
        完全なタスクセットを生成する統合エンドポイント
        
        1. タスク生成（メモリ上）
        2. 品質評価・改善（メモリ上）
        3. 依存関係生成（メモリ上）
        4. 座標計算（メモリ上）
        5. 最終的にDBに一括保存
        """
        import time
        start_time = time.time()
        
        try:
            # Phase 1: タスク生成（メモリ上）
            print(f"Phase 1: タスク生成開始 - プロジェクト: {project_id}")
            generated_tasks = await self._generate_tasks_in_memory(project_id)
            print(f"  生成タスク数: {len(generated_tasks)}")
            
            # Phase 2: 品質評価・改善（メモリ上）
            print("Phase 2: 品質評価・改善開始")
            improved_tasks = await self._evaluate_and_improve_tasks(generated_tasks, project_id)
            print(f"  改善後タスク数: {len(improved_tasks)}")
            
            # Phase 3: 依存関係生成（メモリ上）
            print("Phase 3: 依存関係生成開始")
            tasks_with_dependencies = await self._generate_dependencies(improved_tasks, project_id)
            print(f"  依存関係生成完了")
            
            # Phase 4: 座標計算（メモリ上）
            print("Phase 4: 座標計算開始")
            complete_tasks, edges = await self._calculate_positions(tasks_with_dependencies)
            print(f"  座標計算完了 - ノード数: {len(complete_tasks)}, エッジ数: {len(edges)}")
            
            # Phase 5: DBに一括保存
            print("Phase 5: DB保存開始")
            saved_task_ids, saved_edge_ids = await self._save_complete_task_set(complete_tasks, edges)
            print(f"  DB保存完了 - タスク: {len(saved_task_ids)}, 依存関係: {len(saved_edge_ids)}")
            
            processing_time = time.time() - start_time
            
            return {
                "success": True,
                "project_id": project_id,
                "total_tasks": len(complete_tasks),
                "total_dependencies": len(edges),
                "saved_task_ids": saved_task_ids,
                "saved_edge_ids": saved_edge_ids,
                "processing_time": processing_time,
                "phases_completed": {
                    "generation": True,
                    "quality_improvement": True,
                    "dependency_generation": True,
                    "position_calculation": True,
                    "db_save": True
                }
            }
            
        except Exception as e:
            print(f"エラー発生: {str(e)}")
            raise ValueError(f"タスク生成パイプラインでエラー: {str(e)}")
    
    async def _generate_tasks_in_memory(self, project_id: str) -> List[Dict[str, Any]]:
        """メモリ上でタスクを生成（DB保存なし）"""
        # 既存のタスク生成ロジックを使用するが、DB保存はしない
        project_context = await self.task_generator._get_project_context(project_id)
        functions = self.task_generator._get_all_functions(project_id)
        
        if not functions:
            raise ValueError("No functions found for this project")
        
        batches = self.task_generator._create_batches(functions, self.task_generator.batch_size)
        all_tasks = []
        
        for i, batch in enumerate(batches):
            batch_result = await self.task_generator._process_batch(
                batch, project_context, batch_id=f"batch_{i+1}"
            )
            all_tasks.extend(batch_result.generated_tasks)
        
        # GeneratedTask を dict 形式に変換
        return [task.dict() for task in all_tasks]
    
    async def _evaluate_and_improve_tasks(self, tasks: List[Dict[str, Any]], project_id: str) -> List[Dict[str, Any]]:
        """タスクの品質評価と改善（メモリ上）"""
        # 簡易的な品質チェック
        improved_tasks = tasks.copy()
        
        # カテゴリごとにタスクをグループ化
        categories = {}
        for task in tasks:
            cat = task.get("category", "その他")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(task)
        
        # 不足している基本的なタスクを追加
        additional_tasks = []
        
        # DB設計があるならマイグレーションタスクも必要
        if "DB設計" in categories and not any("マイグレーション" in t.get("task_name", "") for t in tasks):
            additional_tasks.append({
                "function_id": None,
                "function_name": "インフラ",
                "task_name": "データベースマイグレーション実行",
                "task_description": "設計したDBスキーマに基づいてマイグレーションを実行",
                "category": "DB設計",
                "priority": "Must",
                "estimated_hours": 1.0,
                "reason": "品質改善により追加"
            })
        
        # バックエンドがあるならテストタスクも必要
        if "バックエンド" in categories and not any("テスト" in t.get("task_name", "") for t in tasks):
            additional_tasks.append({
                "function_id": None,
                "function_name": "品質保証",
                "task_name": "APIテスト実装",
                "task_description": "バックエンドAPIのユニットテストとインテグレーションテストを実装",
                "category": "バックエンド",
                "priority": "Should",
                "estimated_hours": 4.0,
                "reason": "品質改善により追加"
            })
        
        improved_tasks.extend(additional_tasks)
        return improved_tasks
    
    async def _generate_dependencies(self, tasks: List[Dict[str, Any]], project_id: str) -> List[Dict[str, Any]]:
        """タスク間の依存関係を生成（メモリ上）"""
        # node_id を割り当て
        for i, task in enumerate(tasks):
            if i == 0:
                task["node_id"] = "start"
            else:
                task["node_id"] = f"n{i}"
        
        # カテゴリと優先度に基づいて依存関係を決定
        category_order = ["DB設計", "バックエンド", "フロントエンド"]
        
        # カテゴリでグループ化
        by_category = {}
        for task in tasks:
            cat = task.get("category", "その他")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(task)
        
        # 依存関係を設定
        for task in tasks:
            task["depends_on_node_ids"] = []
            task_cat = task.get("category", "その他")
            
            # 現在のカテゴリより前のカテゴリのタスクに依存
            if task_cat in category_order:
                cat_idx = category_order.index(task_cat)
                if cat_idx > 0:
                    # 前のカテゴリの最後のタスクに依存
                    prev_cat = category_order[cat_idx - 1]
                    if prev_cat in by_category and by_category[prev_cat]:
                        last_task = by_category[prev_cat][-1]
                        task["depends_on_node_ids"].append(last_task["node_id"])
            
            # 同じカテゴリ内でも優先度による依存
            same_cat_tasks = [t for t in by_category.get(task_cat, []) if t["node_id"] != task["node_id"]]
            for other in same_cat_tasks:
                if other.get("priority") == "Must" and task.get("priority") != "Must":
                    if other["node_id"] not in task["depends_on_node_ids"]:
                        task["depends_on_node_ids"].append(other["node_id"])
                        break  # 1つだけ依存
        
        return tasks
    
    async def _calculate_positions(self, tasks: List[Dict[str, Any]]) -> Tuple[List[CompleteTask], List[Dict[str, Any]]]:
        """ReactFlow用の座標を計算（メモリ上）"""
        # カテゴリごとにレイヤー分け
        layers = {}
        for task in tasks:
            cat = task.get("category", "その他")
            if cat not in layers:
                layers[cat] = []
            layers[cat].append(task)
        
        # 座標計算
        x_spacing = 250
        y_spacing = 100
        complete_tasks = []
        
        layer_names = ["環境構築", "DB設計", "バックエンド", "フロントエンド", "統合", "デプロイ", "その他"]
        current_x = 0
        
        for layer_name in layer_names:
            if layer_name not in layers:
                continue
            
            layer_tasks = layers[layer_name]
            for i, task_data in enumerate(layer_tasks):
                complete_task = CompleteTask(
                    task_id=str(uuid.uuid4()),
                    project_id=tasks[0].get("project_id") or str(uuid.uuid4()),  # プロジェクトIDを設定
                    title=task_data.get("task_name", ""),
                    description=task_data.get("task_description", ""),
                    detail=task_data.get("reason", ""),
                    priority=task_data.get("priority", "Should"),
                    status="TODO",
                    category=task_data.get("category", "その他"),
                    estimated_hours=task_data.get("estimated_hours", 2.0),
                    assignee=self._determine_assignee(task_data.get("category", "")),
                    completed=False,
                    node_id=task_data.get("node_id", f"n{i}"),
                    position_x=current_x,
                    position_y=i * y_spacing,
                    function_id=task_data.get("function_id"),
                    depends_on_node_ids=task_data.get("depends_on_node_ids", [])
                )
                complete_tasks.append(complete_task)
            
            current_x += x_spacing
        
        # エッジ（依存関係）を生成
        edges = []
        for task in complete_tasks:
            for dep_node_id in task.depends_on_node_ids:
                # 依存先のタスクを探す
                dep_task = next((t for t in complete_tasks if t.node_id == dep_node_id), None)
                if dep_task:
                    edges.append({
                        "edge_id": f"{dep_task.node_id}-{task.node_id}",
                        "source_node_id": dep_task.node_id,
                        "target_node_id": task.node_id,
                        "source_task_id": dep_task.task_id,
                        "target_task_id": task.task_id,
                        "is_animated": True,
                        "is_next_day": False
                    })
        
        return complete_tasks, edges
    
    def _determine_assignee(self, category: str) -> str:
        """カテゴリに基づいて担当者を決定"""
        assignee_map = {
            "DB設計": "バックエンド担当",
            "バックエンド": "バックエンド担当",
            "フロントエンド": "フロントエンド担当",
            "統合": "フルスタック担当",
            "デプロイ": "DevOps担当",
            "環境構築": "全員"
        }
        return assignee_map.get(category, "エンジニア")
    
    async def _save_complete_task_set(
        self, 
        complete_tasks: List[CompleteTask], 
        edges: List[Dict[str, Any]]
    ) -> Tuple[List[str], List[str]]:
        """完全なタスクセットをDBに保存"""
        saved_task_ids = []
        saved_edge_ids = []
        
        try:
            # タスクを保存
            for task in complete_tasks:
                db_task = Task(
                    task_id=uuid.UUID(task.task_id),
                    project_id=uuid.UUID(task.project_id),
                    title=task.title,
                    description=task.description,
                    detail=task.detail,
                    priority=task.priority,
                    status=task.status,
                    category=task.category,
                    estimated_hours=task.estimated_hours,
                    assignee=task.assignee,
                    completed=task.completed,
                    node_id=task.node_id,
                    position_x=task.position_x,
                    position_y=task.position_y,
                    function_id=uuid.UUID(task.function_id) if task.function_id else None
                )
                self.db.add(db_task)
                saved_task_ids.append(str(db_task.task_id))
            
            # 依存関係を保存
            for edge in edges:
                db_dependency = TaskDependency(
                    edge_id=edge["edge_id"],
                    source_task_id=uuid.UUID(edge["source_task_id"]),
                    target_task_id=uuid.UUID(edge["target_task_id"]),
                    source_node_id=edge["source_node_id"],
                    target_node_id=edge["target_node_id"],
                    is_animated=edge.get("is_animated", True),
                    is_next_day=edge.get("is_next_day", False)
                )
                self.db.add(db_dependency)
                saved_edge_ids.append(str(db_dependency.id))
            
            # コミット
            self.db.commit()
            
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"DB保存エラー: {str(e)}")
        
        return saved_task_ids, saved_edge_ids