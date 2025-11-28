"""
ProjectDocumentTool: プロジェクトドキュメント検索ツール

ReActエージェント用: ProjectDocument モデルから情報を取得
"""

from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from models.project_base import (
    ProjectDocument, ProjectBase, Task, QA, Env,
    StructuredFunction, MemberBase, ProjectMember
)


class ProjectDocumentTool:
    """
    プロジェクトドキュメント検索ツール

    SQLAlchemy を使用してプロジェクト関連の情報を検索・取得します。
    """

    def __init__(self, db: Session, project_id: str):
        """
        初期化

        Args:
            db: SQLAlchemy セッション
            project_id: プロジェクトID
        """
        self.db = db
        self.project_id = project_id

    def get_specification(self) -> str:
        """
        仕様書を取得

        Returns:
            仕様書テキスト
        """
        doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == self.project_id
        ).first()

        if not doc or not doc.specification:
            return "仕様書が見つかりませんでした。"

        return doc.specification

    def get_function_doc(self) -> str:
        """
        機能要件定義書を取得

        Returns:
            機能要件定義書テキスト
        """
        doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == self.project_id
        ).first()

        if not doc or not doc.function_doc:
            return "機能要件定義書が見つかりませんでした。"

        return doc.function_doc

    def get_framework_doc(self) -> str:
        """
        フレームワーク情報を取得

        Returns:
            フレームワーク情報テキスト
        """
        doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == self.project_id
        ).first()

        if not doc or not doc.frame_work_doc:
            return "フレームワーク情報が見つかりませんでした。"

        return doc.frame_work_doc

    def get_directory_info(self) -> str:
        """
        ディレクトリ構成を取得

        Returns:
            ディレクトリ構成テキスト
        """
        doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == self.project_id
        ).first()

        if not doc or not doc.directory_info:
            return "ディレクトリ構成が見つかりませんでした。"

        return doc.directory_info

    def get_project_info(self) -> str:
        """
        プロジェクト基本情報を取得

        Returns:
            プロジェクト基本情報テキスト
        """
        project = self.db.query(ProjectBase).filter(
            ProjectBase.project_id == self.project_id
        ).first()

        if not project:
            return "プロジェクトが見つかりませんでした。"

        return f"""# プロジェクト情報
- タイトル: {project.title}
- アイデア: {project.idea}
- 開始日: {project.start_date}
- 終了日: {project.end_date}
"""

    def get_tasks(self, status: Optional[str] = None) -> str:
        """
        タスク一覧を取得

        Args:
            status: フィルタするステータス (TODO, DOING, DONE)

        Returns:
            タスク一覧テキスト
        """
        query = self.db.query(Task).filter(
            Task.project_id == self.project_id
        )

        if status:
            query = query.filter(Task.status == status)

        tasks = query.all()

        if not tasks:
            return "タスクが見つかりませんでした。"

        result = "# タスク一覧\n\n"
        for task in tasks:
            result += f"## {task.title}\n"
            result += f"- ステータス: {task.status}\n"
            result += f"- 優先度: {task.priority or '未設定'}\n"
            result += f"- カテゴリ: {task.category or '未設定'}\n"
            if task.description:
                result += f"- 説明: {task.description}\n"
            if task.detail:
                result += f"- 詳細: {task.detail[:200]}...\n"
            result += "\n"

        return result

    def get_qa_list(self) -> str:
        """
        Q&A一覧を取得

        Returns:
            Q&A一覧テキスト
        """
        qas = self.db.query(QA).filter(
            QA.project_id == self.project_id
        ).order_by(QA.importance.desc()).all()

        if not qas:
            return "Q&Aが見つかりませんでした。"

        result = "# Q&A一覧\n\n"
        for qa in qas:
            result += f"## Q: {qa.question}\n"
            if qa.answer:
                result += f"A: {qa.answer}\n"
            result += f"(重要度: {qa.importance})\n\n"

        return result

    def get_env_info(self) -> str:
        """
        環境情報を取得

        Returns:
            環境情報テキスト
        """
        env = self.db.query(Env).filter(
            Env.project_id == self.project_id
        ).first()

        if not env:
            return "環境情報が見つかりませんでした。"

        result = "# 環境情報\n\n"
        if env.front:
            result += f"## フロントエンド\n{env.front}\n\n"
        if env.backend:
            result += f"## バックエンド\n{env.backend}\n\n"
        if env.database:
            result += f"## データベース\n{env.database}\n\n"
        if env.devcontainer:
            result += f"## DevContainer\n{env.devcontainer}\n\n"
        if env.deploy:
            result += f"## デプロイ\n{env.deploy}\n\n"

        return result

    def get_structured_functions(self) -> str:
        """
        構造化された機能一覧を取得

        Returns:
            機能一覧テキスト
        """
        functions = self.db.query(StructuredFunction).filter(
            StructuredFunction.project_id == self.project_id
        ).order_by(StructuredFunction.order_index).all()

        if not functions:
            return "構造化機能が見つかりませんでした。"

        result = "# 機能一覧\n\n"
        for func in functions:
            result += f"## {func.function_code}: {func.function_name}\n"
            result += f"- カテゴリ: {func.category or '未設定'}\n"
            result += f"- 優先度: {func.priority or '未設定'}\n"
            result += f"- 説明: {func.description}\n\n"

        return result

    def get_members(self) -> str:
        """
        プロジェクトメンバー一覧を取得

        Returns:
            メンバー一覧テキスト
        """
        project_members = self.db.query(ProjectMember).filter(
            ProjectMember.project_id == self.project_id
        ).all()

        if not project_members:
            return "メンバーが見つかりませんでした。"

        result = "# プロジェクトメンバー\n\n"
        for pm in project_members:
            member = self.db.query(MemberBase).filter(
                MemberBase.member_id == pm.member_id
            ).first()
            if member:
                result += f"- {member.member_name} (@{member.github_name})\n"
                result += f"  スキル: {member.member_skill}\n"

        return result

    def search_all(self, query: str) -> str:
        """
        全ドキュメントを横断検索

        Args:
            query: 検索キーワード

        Returns:
            マッチした情報のサマリー
        """
        results = []
        query_lower = query.lower()

        # 仕様書を検索
        spec = self.get_specification()
        if query_lower in spec.lower():
            results.append(f"【仕様書】\n{self._extract_context(spec, query)}")

        # 機能要件定義書を検索
        func_doc = self.get_function_doc()
        if query_lower in func_doc.lower():
            results.append(f"【機能要件定義書】\n{self._extract_context(func_doc, query)}")

        # フレームワーク情報を検索
        framework = self.get_framework_doc()
        if query_lower in framework.lower():
            results.append(f"【フレームワーク】\n{self._extract_context(framework, query)}")

        # ディレクトリ構成を検索
        directory = self.get_directory_info()
        if query_lower in directory.lower():
            results.append(f"【ディレクトリ構成】\n{self._extract_context(directory, query)}")

        # タスクを検索
        tasks = self.db.query(Task).filter(
            Task.project_id == self.project_id
        ).all()
        for task in tasks:
            task_text = f"{task.title} {task.description or ''} {task.detail or ''}"
            if query_lower in task_text.lower():
                results.append(f"【タスク: {task.title}】\nステータス: {task.status}\n説明: {task.description or 'なし'}")

        # Q&Aを検索
        qas = self.db.query(QA).filter(
            QA.project_id == self.project_id
        ).all()
        for qa in qas:
            qa_text = f"{qa.question} {qa.answer or ''}"
            if query_lower in qa_text.lower():
                results.append(f"【Q&A】\nQ: {qa.question}\nA: {qa.answer or '未回答'}")

        if not results:
            return f"「{query}」に関連する情報は見つかりませんでした。"

        return "\n\n---\n\n".join(results)

    def _extract_context(self, text: str, query: str, context_chars: int = 300) -> str:
        """
        検索キーワード周辺のコンテキストを抽出

        Args:
            text: 対象テキスト
            query: 検索キーワード
            context_chars: 抽出する前後の文字数

        Returns:
            コンテキスト付きテキスト
        """
        query_lower = query.lower()
        text_lower = text.lower()

        pos = text_lower.find(query_lower)
        if pos == -1:
            return text[:500] + "..."

        start = max(0, pos - context_chars)
        end = min(len(text), pos + len(query) + context_chars)

        result = ""
        if start > 0:
            result += "..."
        result += text[start:end]
        if end < len(text):
            result += "..."

        return result


def create_langchain_tools(db: Session, project_id: str):
    """
    LangChain で使用可能なツール群を作成

    Args:
        db: SQLAlchemy セッション
        project_id: プロジェクトID

    Returns:
        LangChain Tool オブジェクトのリスト
    """
    try:
        from langchain.tools import Tool
    except ImportError:
        raise ImportError(
            "langchain is not installed. "
            "Install it with: pip install langchain"
        )

    doc_tool = ProjectDocumentTool(db, project_id)

    tools = [
        Tool(
            name="get_specification",
            description=(
                "プロジェクトの仕様書を取得します。"
                "プロジェクトの概要、目的、ユーザー像、解決する課題などを確認できます。"
            ),
            func=lambda _: doc_tool.get_specification()
        ),
        Tool(
            name="get_function_doc",
            description=(
                "プロジェクトの機能要件定義書を取得します。"
                "実装すべき機能の詳細、優先度、技術的な要件を確認できます。"
            ),
            func=lambda _: doc_tool.get_function_doc()
        ),
        Tool(
            name="get_framework_doc",
            description=(
                "プロジェクトで使用するフレームワーク情報を取得します。"
                "フロントエンド、バックエンド、データベースなどの技術スタックを確認できます。"
            ),
            func=lambda _: doc_tool.get_framework_doc()
        ),
        Tool(
            name="get_directory_info",
            description=(
                "プロジェクトのディレクトリ構成を取得します。"
                "ファイル配置、フォルダ構造、各ディレクトリの役割を確認できます。"
            ),
            func=lambda _: doc_tool.get_directory_info()
        ),
        Tool(
            name="get_project_info",
            description=(
                "プロジェクトの基本情報を取得します。"
                "タイトル、アイデア、開始日、終了日などを確認できます。"
            ),
            func=lambda _: doc_tool.get_project_info()
        ),
        Tool(
            name="get_tasks",
            description=(
                "プロジェクトのタスク一覧を取得します。"
                "入力: ステータスでフィルタする場合は 'TODO', 'DOING', 'DONE' のいずれかを入力。"
                "全タスクを取得する場合は空文字列を入力。"
            ),
            func=lambda status: doc_tool.get_tasks(status if status else None)
        ),
        Tool(
            name="get_qa_list",
            description=(
                "プロジェクトのQ&A一覧を取得します。"
                "仕様に関する質問と回答、重要度を確認できます。"
            ),
            func=lambda _: doc_tool.get_qa_list()
        ),
        Tool(
            name="get_env_info",
            description=(
                "プロジェクトの環境設定情報を取得します。"
                "フロントエンド、バックエンド、データベース、DevContainer、デプロイの設定を確認できます。"
            ),
            func=lambda _: doc_tool.get_env_info()
        ),
        Tool(
            name="get_structured_functions",
            description=(
                "プロジェクトの構造化された機能一覧を取得します。"
                "機能コード、機能名、カテゴリ、優先度、説明を確認できます。"
            ),
            func=lambda _: doc_tool.get_structured_functions()
        ),
        Tool(
            name="get_members",
            description=(
                "プロジェクトメンバー一覧を取得します。"
                "メンバー名、GitHubアカウント、スキルを確認できます。"
            ),
            func=lambda _: doc_tool.get_members()
        ),
        Tool(
            name="search_project_docs",
            description=(
                "プロジェクトの全ドキュメントを横断検索します。"
                "入力: 検索したいキーワード。"
                "仕様書、機能要件、フレームワーク、タスク、Q&Aなど全てを検索します。"
            ),
            func=lambda query: doc_tool.search_all(query)
        ),
    ]

    return tools
