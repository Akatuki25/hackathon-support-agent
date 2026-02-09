"""
タスク座標計算サービス
ReactFlow用の最適な座標配置を計算
"""
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from collections import defaultdict
from ..core import BaseService


class TaskPositionService(BaseService):
    """タスク座標計算エージェント"""
    
    def __init__(self, db: Session):
        super().__init__(db)
    
    def calculate_positions(self, tasks: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        ReactFlow用の座標を計算
        
        アルゴリズム：
        1. トポロジカルソートでレイヤー分け
        2. 各レイヤー内で機能・カテゴリごとにグループ化
        3. 美しい配置でX,Y座標を計算
        """
        print(f"座標計算開始: {len(tasks)}個のタスク")
        
        # 依存関係グラフを構築
        dependency_graph = self._build_dependency_graph(tasks, edges)
        
        # トポロジカルソートでレイヤー分け
        layers = self._calculate_layers(tasks, dependency_graph)
        
        # 各レイヤー内でタスクをグループ化
        grouped_layers = self._group_tasks_in_layers(layers, tasks)
        
        # 座標を計算
        positioned_tasks = self._assign_coordinates(grouped_layers, tasks)
        
        print(f"座標計算完了: {len(layers)}レイヤー")
        return positioned_tasks
    
    def _build_dependency_graph(self, tasks: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """依存関係グラフを構築"""
        graph = defaultdict(list)
        in_degree = defaultdict(int)
        
        # 全ノードを初期化
        for task in tasks:
            node_id = task["node_id"]
            if node_id not in in_degree:
                in_degree[node_id] = 0
        
        # エッジを追加
        for edge in edges:
            source = edge["source_node_id"]
            target = edge["target_node_id"]
            graph[source].append(target)
            in_degree[target] += 1
        
        return dict(graph)
    
    def _calculate_layers(self, tasks: List[Dict[str, Any]], dependency_graph: Dict[str, List[str]]) -> List[List[str]]:
        """トポロジカルソートでレイヤー分け"""
        task_ids = {task["node_id"] for task in tasks}
        in_degree = defaultdict(int)
        
        # 入次数を計算
        for task in tasks:
            node_id = task["node_id"]
            for dep_id in task.get("depends_on", []):
                if dep_id in task_ids:
                    in_degree[node_id] += 1
        
        layers = []
        remaining_tasks = task_ids.copy()
        
        while remaining_tasks:
            # 入次数0のタスクを見つける
            current_layer = []
            for task_id in remaining_tasks:
                if in_degree[task_id] == 0:
                    current_layer.append(task_id)
            
            if not current_layer:
                # 循環依存がある場合、残りを最後のレイヤーに
                current_layer = list(remaining_tasks)
            
            layers.append(current_layer)
            
            # 処理したタスクを削除し、入次数を更新
            for task_id in current_layer:
                remaining_tasks.remove(task_id)
                for successor in dependency_graph.get(task_id, []):
                    if successor in remaining_tasks:
                        in_degree[successor] -= 1
        
        return layers
    
    def _group_tasks_in_layers(self, layers: List[List[str]], tasks: List[Dict[str, Any]]) -> List[List[Dict[str, List[Dict[str, Any]]]]]:
        """各レイヤー内でタスクをグループ化"""
        task_map = {task["node_id"]: task for task in tasks}
        grouped_layers = []
        
        for layer in layers:
            # 機能でグループ化
            function_groups = defaultdict(list)
            orphan_group = []
            
            for task_id in layer:
                task = task_map[task_id]
                func_id = task.get("function_id")
                
                if func_id:
                    function_groups[func_id].append(task)
                else:
                    orphan_group.append(task)
            
            # カテゴリでサブグループ化
            layer_groups = []
            
            # 機能グループ内でカテゴリ別にソート
            for func_id, func_tasks in function_groups.items():
                category_groups = defaultdict(list)
                for task in func_tasks:
                    category = task.get("category", "その他")
                    category_groups[category].append(task)
                
                # カテゴリ順でソート
                category_order = ["環境構築", "DB設計", "バックエンド", "フロントエンド", "統合", "テスト", "デプロイ", "その他"]
                
                for category in category_order:
                    if category in category_groups:
                        layer_groups.append({
                            "type": "function",
                            "function_id": func_id,
                            "category": category,
                            "tasks": category_groups[category]
                        })
            
            # 孤立タスクをカテゴリ別に追加
            if orphan_group:
                orphan_categories = defaultdict(list)
                for task in orphan_group:
                    category = task.get("category", "その他")
                    orphan_categories[category].append(task)
                
                for category, cat_tasks in orphan_categories.items():
                    layer_groups.append({
                        "type": "orphan",
                        "category": category,
                        "tasks": cat_tasks
                    })
            
            grouped_layers.append(layer_groups)
        
        return grouped_layers
    
    def _assign_coordinates(self, grouped_layers: List[List[Dict[str, List[Dict[str, Any]]]]], tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """座標を計算"""
        
        # 定数
        LAYER_SPACING = 400  # レイヤー間のX間隔
        GROUP_SPACING_Y = 150  # グループ間のY間隔
        TASK_SPACING_Y = 80   # タスク間のY間隔
        START_X = 100
        START_Y = 100
        
        positioned_tasks = []
        current_x = START_X
        
        for layer_index, layer_groups in enumerate(grouped_layers):
            current_y = START_Y
            max_y = START_Y
            
            for group in layer_groups:
                group_tasks = group["tasks"]
                group_start_y = current_y
                
                # グループ内のタスクに座標を割り当て
                for task_index, task in enumerate(group_tasks):
                    task_copy = task.copy()
                    task_copy["position_x"] = current_x
                    task_copy["position_y"] = current_y
                    positioned_tasks.append(task_copy)
                    
                    current_y += TASK_SPACING_Y
                
                # グループ間のスペース
                current_y += GROUP_SPACING_Y
                max_y = max(max_y, current_y)
            
            # 次のレイヤーのX座標
            current_x += LAYER_SPACING
        
        # Y座標を中央寄せ調整
        self._center_align_y_coordinates(positioned_tasks, grouped_layers)
        
        return positioned_tasks
    
    def _center_align_y_coordinates(self, positioned_tasks: List[Dict[str, Any]], grouped_layers: List[List[Dict[str, List[Dict[str, Any]]]]]) -> None:
        """Y座標を中央寄せ調整"""
        if not positioned_tasks:
            return
        
        # 全体の高さを計算
        min_y = min(task["position_y"] for task in positioned_tasks)
        max_y = max(task["position_y"] for task in positioned_tasks)
        total_height = max_y - min_y
        
        # 各レイヤーの高さを計算して中央寄せ
        layer_tasks = defaultdict(list)
        for task in positioned_tasks:
            layer_tasks[task["position_x"]].append(task)
        
        for x_pos, tasks_in_layer in layer_tasks.items():
            if len(tasks_in_layer) <= 1:
                continue
            
            layer_min_y = min(task["position_y"] for task in tasks_in_layer)
            layer_max_y = max(task["position_y"] for task in tasks_in_layer)
            layer_height = layer_max_y - layer_min_y
            
            # 中央寄せのためのオフセット
            center_offset = (total_height - layer_height) // 2
            
            for task in tasks_in_layer:
                task["position_y"] = task["position_y"] - layer_min_y + center_offset + min_y