"""
HandsOnSearchTool: プロジェクト内のハンズオンを検索するツール

Phase 3: タスクハンズオン生成のためのプロジェクト内情報検索
"""

from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models.project_base import Task, TaskHandsOn, TaskDependency
from uuid import UUID


class HandsOnSearchTool:
    """プロジェクト内のハンズオンを検索するツール"""

    def __init__(self, db: Session, project_id: str, current_task_id: str):
        self.db = db
        self.project_id = UUID(project_id)
        self.current_task_id = UUID(current_task_id)

    def search(self, query: str, max_results: int = 3) -> List[Dict]:
        """
        キーワードでハンズオンを検索

        Args:
            query: 検索クエリ (例: "database model", "authentication")
            max_results: 最大取得数

        Returns:
            ハンズオンのリスト
        """
        # プロジェクトの全タスクのハンズオンを取得
        tasks_with_hands_on = (
            self.db.query(Task, TaskHandsOn)
            .join(TaskHandsOn, Task.task_id == TaskHandsOn.task_id)
            .filter(Task.project_id == self.project_id)
            .filter(Task.task_id != self.current_task_id)  # 自分自身を除外
            .all()
        )

        if not tasks_with_hands_on:
            return []

        # キーワードマッチング
        query_lower = query.lower()
        results = []

        for task, hands_on in tasks_with_hands_on:
            score = 0

            # タイトルマッチ
            if query_lower in (task.title or "").lower():
                score += 10

            # カテゴリマッチ
            if query_lower in (task.category or "").lower():
                score += 5

            # 概要マッチ
            if hands_on.overview and query_lower in hands_on.overview.lower():
                score += 3

            # ターゲットファイルマッチ
            if hands_on.target_files:
                for file_info in hands_on.target_files:
                    if query_lower in file_info.get("path", "").lower():
                        score += 8

            if score > 0:
                # コード例の取得
                code_example = ""
                if hands_on.code_examples and len(hands_on.code_examples) > 0:
                    code_example = hands_on.code_examples[0].get("code", "")[:500]

                results.append({
                    "task_id": str(task.task_id),  # Task ID を追加
                    "task_title": task.title,
                    "task_category": task.category,
                    "score": score,
                    "overview": (hands_on.overview or "")[:300],
                    "target_files": [
                        f"{f.get('path', '')} ({f.get('action', '')})"
                        for f in (hands_on.target_files or [])[:3]
                    ],
                    "code_example": code_example
                })

        # スコア順にソート
        results.sort(key=lambda x: x["score"], reverse=True)

        return results[:max_results]

    def get_dependency_hands_on(self) -> List[Dict]:
        """
        依存タスクのハンズオンを取得

        Returns:
            依存タスクのハンズオンリスト
        """
        # 依存タスクIDを取得
        dependencies = (
            self.db.query(TaskDependency)
            .filter(TaskDependency.target_task_id == self.current_task_id)
            .all()
        )

        if not dependencies:
            return []

        dependency_ids = [dep.source_task_id for dep in dependencies]

        # 依存タスクのハンズオンを取得
        dep_hands_on = (
            self.db.query(Task, TaskHandsOn)
            .join(TaskHandsOn, Task.task_id == TaskHandsOn.task_id)
            .filter(Task.task_id.in_(dependency_ids))
            .all()
        )

        results = []
        for task, hands_on in dep_hands_on:
            code_example = ""
            if hands_on.code_examples and len(hands_on.code_examples) > 0:
                code_example = hands_on.code_examples[0].get("code", "")[:500]

            results.append({
                "task_id": str(task.task_id),  # Task ID を追加
                "task_title": task.title,
                "overview": hands_on.overview or "",
                "target_files": hands_on.target_files or [],
                "prerequisites": hands_on.prerequisites or "",
                "code_example": code_example
            })

        return results


def create_langchain_tools(db: Session, project_id: str, current_task_id: str):
    """LangChain Tool として作成"""
    from langchain.tools import Tool

    search_tool = HandsOnSearchTool(db, project_id, current_task_id)

    def search_wrapper(query: str) -> str:
        """検索ラッパー"""
        results = search_tool.search(query, max_results=3)

        if not results:
            return "関連するハンズオンが見つかりませんでした。"

        output = []
        for i, result in enumerate(results, 1):
            output.append(
                f"{i}. {result['task_title']} (スコア: {result['score']})\n"
                f"   概要: {result['overview']}\n"
                f"   ファイル: {', '.join(result['target_files'])}\n"
                f"   コード例:\n```\n{result['code_example']}\n```\n"
            )

        return "\n".join(output)

    def get_dependency_wrapper(input_str: str) -> str:
        """依存タスク取得ラッパー"""
        results = search_tool.get_dependency_hands_on()

        if not results:
            return "このタスクには依存する前提タスクがありません。"

        output = ["このタスクの前提タスク:\n"]
        for i, result in enumerate(results, 1):
            files = [f.get("path", "") for f in result["target_files"][:3]]
            output.append(
                f"{i}. {result['task_title']}\n"
                f"   前提条件: {result['prerequisites']}\n"
                f"   実装ファイル: {', '.join(files)}\n"
                f"   コード例:\n```\n{result['code_example']}\n```\n"
            )

        return "\n".join(output)

    # 2つのツールを返す
    return [
        Tool(
            name="search_project_hands_on",
            description=(
                "Search for hands-on guides of other tasks in this project. "
                "Useful when you need to reference how other related tasks are implemented. "
                "Input should be a keyword or task description (e.g., 'database model', 'authentication API')."
            ),
            func=search_wrapper
        ),
        Tool(
            name="get_dependency_tasks",
            description=(
                "Get hands-on guides of tasks that this task depends on (prerequisite tasks). "
                "Use this to understand what has already been implemented before this task. "
                "Input can be any string (will be ignored)."
            ),
            func=get_dependency_wrapper
        )
    ]
