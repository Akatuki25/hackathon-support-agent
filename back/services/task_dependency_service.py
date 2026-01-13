"""
タスク依存関係生成サービス
機能内→機能間→全体最適化の3段階アプローチ
"""
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from langchain_core.prompts import ChatPromptTemplate
import json
import asyncio
import networkx as nx
from .base_service import BaseService


class TaskDependencyService(BaseService):
    """タスク依存関係生成エージェント"""
    
    def __init__(self, db: Session):
        super().__init__(db)
    
    async def generate_dependencies(self, tasks: List[Dict[str, Any]], functions: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        3段階アプローチで依存関係を生成
        1. 機能内タスクの依存関係分析（LLM）
        2. 機能間の依存関係分析（LLM）
        3. 全体フロー最適化（ルールベース）
        """
        print(f"依存関係生成開始: {len(tasks)}個のタスク, {len(functions)}個の機能")
        
        # タスクにnode_idを割り当て
        for i, task in enumerate(tasks):
            task["node_id"] = f"task_{i}"
            task["depends_on"] = []
        
        # 機能ごとにタスクをグループ化
        tasks_by_function = {}
        orphan_tasks = []
        
        for task in tasks:
            func_id = task.get("function_id")
            if func_id:
                if func_id not in tasks_by_function:
                    tasks_by_function[func_id] = []
                tasks_by_function[func_id].append(task)
            else:
                orphan_tasks.append(task)
        
        # Phase 1: 機能内タスクの依存関係分析
        print("Phase 1: 機能内タスクの依存関係分析")
        await self._analyze_intra_function_dependencies(tasks_by_function, functions)
        
        # Phase 2: 機能間の依存関係分析
        print("Phase 2: 機能間の依存関係分析")
        await self._analyze_inter_function_dependencies(tasks_by_function, functions)
        
        # Phase 3: 全体フロー最適化
        print("Phase 3: 全体フロー最適化")
        self._optimize_overall_flow(tasks, orphan_tasks)
        
        # エッジ情報を生成
        edges = self._generate_edges(tasks)
        
        print(f"依存関係生成完了: {len(edges)}個のエッジ")
        return tasks, edges
    
    async def _analyze_intra_function_dependencies(self, tasks_by_function: Dict[str, List[Dict[str, Any]]], functions: List[Dict[str, Any]]) -> None:
        """Phase 1: 機能内タスクの依存関係をLLMで分析"""
        
        function_map = {str(f.get("function_id")): f for f in functions}
        
        # 各機能を並列で処理
        tasks = []
        for func_id, func_tasks in tasks_by_function.items():
            if len(func_tasks) > 1:  # 1つしかないタスクは依存関係不要
                function_info = function_map.get(func_id, {})
                tasks.append(self._analyze_single_function_dependencies(func_tasks, function_info))
        
        if tasks:
            await asyncio.gather(*tasks)
    
    async def _analyze_single_function_dependencies(self, func_tasks: List[Dict[str, Any]], function_info: Dict[str, Any]) -> None:
        """単一機能内のタスク依存関係を分析"""
        
        # タスク情報を整形
        task_list = []
        for i, task in enumerate(func_tasks):
            task_list.append(
                f"{i+1}. [{task['node_id']}] {task.get('task_name', task.get('title', 'Unknown'))}\n"
                f"   説明: {task.get('task_description', task.get('description', ''))}\n"
                f"   カテゴリ: {task.get('category', '未分類')}\n"
                f"   優先度: {task.get('priority', 'Should')}"
            )
        
        task_descriptions = "\n\n".join(task_list)
        
        prompt = ChatPromptTemplate.from_template("""
あなたはソフトウェア開発の専門家です。
以下の機能内のタスクについて、実装の論理的な順序と依存関係を分析してください。

## 機能情報：
- 機能名: {function_name}
- 説明: {function_description}
- カテゴリ: {function_category}

## タスクリスト：
{task_descriptions}

## 分析の観点：
1. データベース設計は他のタスクの前提となるか？
2. バックエンドAPIはフロントエンドの前提となるか？
3. どのタスクが並行実行可能か？
4. テストはどのタスクの実装後に可能か？

## 出力形式（JSON）：
{{
  "dependencies": [
    {{
      "task_node_id": "依存するタスクのnode_id",
      "depends_on": ["依存先タスクのnode_id"],
      "reason": "依存理由"
    }}
  ],
  "parallel_groups": [
    ["並行実行可能なnode_id1", "node_id2"]
  ]
}}

重要：
- 本当に必要な依存関係のみを設定
- 過度な直列化を避け、並行実行を最大化
- 論理的な実装順序を重視
""")
        
        try:
            response = await self.llm_pro.ainvoke(prompt.format(
                function_name=function_info.get("function_name", ""),
                function_description=function_info.get("description", ""),
                function_category=function_info.get("category", ""),
                task_descriptions=task_descriptions
            ))
            
            # JSON部分を抽出してパース
            content = response.content
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                
                # 依存関係を適用
                for dep in result.get("dependencies", []):
                    task = next((t for t in func_tasks if t["node_id"] == dep["task_node_id"]), None)
                    if task and dep.get("depends_on"):
                        task["depends_on"].extend(dep["depends_on"])
                        # 重複削除
                        task["depends_on"] = list(set(task["depends_on"]))
                
                print(f"機能内依存関係分析完了: {function_info.get('function_name', 'Unknown')}")
        
        except Exception as e:
            print(f"機能内依存関係分析エラー ({function_info.get('function_name', 'Unknown')}): {e}")
            # フォールバック：カテゴリベースの依存関係
            self._apply_fallback_intra_dependencies(func_tasks)
    
    async def _analyze_inter_function_dependencies(self, tasks_by_function: Dict[str, List[Dict[str, Any]]], functions: List[Dict[str, Any]]) -> None:
        """Phase 2: 機能間の依存関係をLLMで分析"""

        if len(functions) <= 1:
            print("機能間依存関係スキップ: 機能が1つ以下")
            return
        
        # 機能情報を整形
        function_list = []
        for i, func in enumerate(functions):
            function_list.append(
                f"{i+1}. [{func.get('function_id')}] {func.get('function_name')}\n"
                f"   説明: {func.get('description')}\n"
                f"   カテゴリ: {func.get('category')}\n"
                f"   優先度: {func.get('priority')}"
            )
        
        function_descriptions = "\n\n".join(function_list)
        
        prompt = ChatPromptTemplate.from_template("""
あなたはシステムアーキテクチャの専門家です。
以下の機能間の依存関係を分析してください。

## 機能リスト：
{function_descriptions}

## 分析の観点：
1. 認証機能は他の機能の前提条件か？
2. データ管理機能はUI機能の前提か？
3. 基盤となる機能はどれか？
4. どの機能が独立して開発可能か？

## 出力形式（JSON）：
{{
  "function_dependencies": [
    {{
      "function_id": "依存する機能ID",
      "depends_on_functions": ["依存先機能ID"],
      "dependency_type": "必須|推奨|参考",
      "reason": "依存理由"
    }}
  ]
}}

重要：
- 「必須」は本当に前提となる場合のみ
- 「推奨」は順序があった方が良い場合
- 過度な依存関係は設定しない
""")
        
        try:
            response = await self.llm_pro.ainvoke(prompt.format(
                function_descriptions=function_descriptions
            ))
            
            content = response.content
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                
                # 機能間依存関係をタスクレベルに適用
                for func_dep in result.get("function_dependencies", []):
                    dependent_func_id = func_dep["function_id"]
                    depends_on_func_ids = func_dep["depends_on_functions"]
                    dependency_type = func_dep.get("dependency_type", "必須")

                    print(f"機能間依存: {dependent_func_id} -> {depends_on_func_ids} (タイプ: {dependency_type})")

                    # 「必須」の依存関係のみを適用
                    if dependency_type == "必須" and dependent_func_id in tasks_by_function:
                        dependent_tasks = tasks_by_function[dependent_func_id]

                        for dep_func_id in depends_on_func_ids:
                            if dep_func_id in tasks_by_function:
                                prerequisite_tasks = tasks_by_function[dep_func_id]

                                if dependent_tasks and prerequisite_tasks:
                                    # テスト用: 元のロジックに戻す
                                    first_dependent = min(dependent_tasks, key=lambda t: len(t.get("depends_on", [])))
                                    last_prerequisite = max(prerequisite_tasks, key=lambda t: len(t.get("depends_on", [])))

                                    print(f"  タスク依存追加: {first_dependent['node_id']} (依存数: {len(first_dependent.get('depends_on', []))}) <- {last_prerequisite['node_id']} (依存数: {len(last_prerequisite.get('depends_on', []))})")

                                    if last_prerequisite["node_id"] not in first_dependent["depends_on"]:
                                        first_dependent["depends_on"].append(last_prerequisite["node_id"])
                                        print(f"  ✓ 追加成功 (新しい依存数: {len(first_dependent['depends_on'])})")
                                    else:
                                        print(f"  - 既に存在（スキップ）")
                
                print("機能間依存関係分析完了")
        
        except Exception as e:
            print(f"機能間依存関係分析エラー: {e}")
    
    def _optimize_overall_flow(self, tasks: List[Dict[str, Any]], orphan_tasks: List[Dict[str, Any]]) -> None:
        """Phase 3: 全体フローを最適化"""
        
        # 孤立タスクの依存関係を設定
        self._handle_orphan_tasks(orphan_tasks, tasks)
        
        # 循環依存をチェック・修正
        self._remove_circular_dependencies(tasks)
        
        # 不要な推移的依存関係を削除
        self._remove_transitive_dependencies(tasks)
        
        print("全体フロー最適化完了")
    
    def _handle_orphan_tasks(self, orphan_tasks: List[Dict[str, Any]], all_tasks: List[Dict[str, Any]]) -> None:
        """機能に属さないタスクの依存関係を設定"""
        
        function_tasks = [t for t in all_tasks if t.get("function_id")]
        
        for task in orphan_tasks:
            category = task.get("category", "")
            
            if category == "環境構築":
                # 環境構築は依存なし（最初に実行）
                continue
            
            elif category == "デプロイ":
                # デプロイは全機能の完了後
                # 最も依存が多いタスク（最後のタスク）に依存
                if function_tasks:
                    last_tasks = sorted(function_tasks, key=lambda t: len(t.get("depends_on", [])), reverse=True)[:3]
                    for last_task in last_tasks:
                        if last_task["node_id"] not in task["depends_on"]:
                            task["depends_on"].append(last_task["node_id"])
            
            elif category == "テスト":
                # 統合テストは主要機能の完了後
                if function_tasks:
                    main_tasks = [t for t in function_tasks if t.get("priority") == "Must"][:2]
                    for main_task in main_tasks:
                        if main_task["node_id"] not in task["depends_on"]:
                            task["depends_on"].append(main_task["node_id"])
    
    def _remove_circular_dependencies(self, tasks: List[Dict[str, Any]]) -> None:
        """networkxを使用した循環依存の検出・削除"""
        print("循環依存チェック開始")
        # グラフ構築
        G = nx.DiGraph()

        # ノードとエッジを追加
        edge_count = 0
        for task in tasks:
            node_id = task["node_id"]
            G.add_node(node_id)
            for dep_id in task.get("depends_on", []):
                G.add_edge(dep_id, node_id)  # 依存先 -> 依存元
                edge_count += 1

        print(f"グラフ構築完了: {len(G.nodes)}ノード, {edge_count}エッジ")

        # 循環依存検出と削除
        try:
            cycles = list(nx.simple_cycles(G))
            if cycles:
                print(f"⚠️ 循環依存を検出: {len(cycles)}個のサイクル")
                for i, cycle in enumerate(cycles[:5]):  # 最初の5つを表示
                    print(f"  サイクル {i+1}: {' -> '.join(cycle)} -> {cycle[0]}")
                
                # 各サイクルの最小重要度のエッジを削除
                for cycle in cycles:
                    if len(cycle) >= 2:
                        # サイクル内で最も重要度の低いエッジを削除
                        edges_to_remove = []
                        for i in range(len(cycle)):
                            from_node = cycle[i]
                            to_node = cycle[(i + 1) % len(cycle)]
                            edges_to_remove.append((from_node, to_node))
                        
                        # 最初のエッジを削除（簡単な解決策）
                        if edges_to_remove:
                            from_node, to_node = edges_to_remove[0]
                            print(f"  循環解決: {from_node} -> {to_node} を削除")

                            # タスクの依存関係から削除
                            for task in tasks:
                                if task["node_id"] == to_node:
                                    if from_node in task.get("depends_on", []):
                                        task["depends_on"].remove(from_node)
                                        print(f"  ✓ 削除成功")
                                    break

                print(f"循環依存除去完了: {len(cycles)}個のサイクルを解決")
            else:
                print("✓ 循環依存なし")
        except Exception as e:
            print(f"❌ 循環依存検出エラー: {e}")
    
    def _remove_transitive_dependencies(self, tasks: List[Dict[str, Any]]) -> None:
        """networkxを使用した推移的依存関係の削除"""
        # グラフ構築
        G = nx.DiGraph()
        
        for task in tasks:
            node_id = task["node_id"]
            G.add_node(node_id)
            for dep_id in task.get("depends_on", []):
                G.add_edge(dep_id, node_id)
        
        # 推移的縮約を計算
        try:
            tr = nx.transitive_reduction(G)
            
            # 元のタスクの依存関係を更新
            for task in tasks:
                node_id = task["node_id"]
                # 縮約後のグラフから新しい依存関係を取得
                new_deps = list(tr.predecessors(node_id))
                task["depends_on"] = new_deps
                
        except Exception as e:
            print(f"推移的依存削除エラー: {e}")
    
    def _apply_fallback_intra_dependencies(self, func_tasks: List[Dict[str, Any]]) -> None:
        """フォールバック用の機能内依存関係"""
        category_order = ["DB設計", "バックエンド", "フロントエンド", "テスト"]
        
        func_tasks.sort(key=lambda t: (
            category_order.index(t.get("category", "")) if t.get("category") in category_order else 99,
            0 if t.get("priority") == "Must" else 1
        ))
        
        for i, task in enumerate(func_tasks):
            if i > 0 and task.get("category") != func_tasks[i-1].get("category"):
                task["depends_on"].append(func_tasks[i-1]["node_id"])
    
    def _generate_edges(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """エッジ情報を生成"""
        edges = []
        
        for task in tasks:
            for dep_node_id in task.get("depends_on", []):
                edges.append({
                    "edge_id": f"{dep_node_id}-{task['node_id']}",
                    "source_node_id": dep_node_id,
                    "target_node_id": task["node_id"],
                    "is_animated": True,
                    "is_next_day": False
                })
        
        return edges