"""
UseCaseTool: 仕様書からユースケースフローを取得するツール

Phase 3: タスクハンズオン生成のためのプロジェクト仕様参照
"""

from typing import Optional
from sqlalchemy.orm import Session
from models.project_base import ProjectDocument
from uuid import UUID


class UseCaseTool:
    """仕様書からユースケースフローを取得"""

    def __init__(self, db: Session, project_id: str):
        self.db = db
        self.project_id = UUID(project_id)

    def get_flow(self, task_category: Optional[str] = None) -> str:
        """
        ユースケースフローを取得

        Args:
            task_category: タスクカテゴリ (フィルタリング用、省略可)

        Returns:
            ユースケースフロー文字列
        """
        # プロジェクトドキュメント取得
        doc = (
            self.db.query(ProjectDocument)
            .filter(ProjectDocument.project_id == self.project_id)
            .first()
        )

        if not doc or not doc.specification:
            return "仕様書が見つかりませんでした。"

        spec = doc.specification

        # カテゴリに関連する部分を抽出
        if task_category:
            lines = spec.split('\n')
            relevant_lines = []
            in_relevant_section = False

            for line in lines:
                # セクション開始
                if task_category.lower() in line.lower():
                    in_relevant_section = True

                if in_relevant_section:
                    relevant_lines.append(line)

                    # 次のセクション開始で終了
                    if line.startswith('##') and task_category.lower() not in line.lower():
                        in_relevant_section = False

                # 2000文字で打ち切り
                if len('\n'.join(relevant_lines)) > 2000:
                    break

            if relevant_lines:
                return '\n'.join(relevant_lines)

        # カテゴリ指定なしまたは見つからない場合は全体から抜粋
        return spec[:2000]


def create_langchain_tool(db: Session, project_id: str, task_category: Optional[str] = None):
    """LangChain Tool として作成"""
    from langchain.tools import Tool

    use_case_tool = UseCaseTool(db, project_id)

    def flow_wrapper(query: str) -> str:
        """フロー取得ラッパー"""
        # queryは無視してtask_categoryを使用
        flow = use_case_tool.get_flow(task_category)

        return f"""## プロジェクトの仕様書 (関連部分)

{flow}

この仕様書を参考に、実装の整合性を保ってください。
"""

    return Tool(
        name="get_use_case_flow",
        description=(
            "Get the use case flow and specification from the project documentation. "
            "Use this to understand the overall project context and how this task fits into the bigger picture. "
            "Input can be any string (will be ignored)."
        ),
        func=flow_wrapper
    )
