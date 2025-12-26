"""
技術選定支援ハンドラ (selectFramework ページ用)

技術スタックの選定をサポートする。
- 技術の組み合わせの整合性確認
- プロジェクト要件との適合性確認
- 技術の比較・解説
"""

from typing import Dict, Any, List

from ..base_handler import BaseChatHandler
from ..chat_router import ChatRouter
from models.project_base import ProjectDocument, StructuredFunction, ProjectBase


@ChatRouter.register("selectFramework")
class FrameworkHandler(BaseChatHandler):
    """技術選定支援ハンドラ"""

    @property
    def page_context(self) -> str:
        return "selectFramework"

    async def get_db_context(self) -> Dict[str, Any]:
        """
        現在の技術選択（フロントから）、仕様、機能要件を取得
        """
        context = {}
        page_ctx = self.get_page_specific_context()

        # プロジェクト基本情報
        project = (
            self.db.query(ProjectBase)
            .filter(ProjectBase.project_id == self.project_id)
            .first()
        )
        if project:
            context["project_title"] = project.title
            context["project_idea"] = project.idea
        else:
            context["project_title"] = ""
            context["project_idea"] = ""

        # フロントから渡された現在の選択状態
        context["selected_platform"] = page_ctx.get("selected_platform", "未選択")
        context["selected_technologies"] = page_ctx.get("selected_technologies", [])

        # 仕様書を取得
        doc = (
            self.db.query(ProjectDocument)
            .filter(ProjectDocument.project_id == self.project_id)
            .first()
        )
        context["specification"] = doc.function_doc if doc else ""

        # 機能一覧を取得（Must優先度のもの）
        functions = (
            self.db.query(StructuredFunction)
            .filter(StructuredFunction.project_id == self.project_id)
            .filter(StructuredFunction.priority == "Must")
            .all()
        )
        context["must_functions"] = [
            {"name": f.function_name, "category": f.category}
            for f in functions
        ]

        return context

    def get_system_prompt(self, db_context: Dict[str, Any]) -> str:
        """
        技術選定支援用のシステムプロンプトを生成
        """
        project_title = db_context.get("project_title", "不明")
        project_idea = db_context.get("project_idea", "不明")
        selected_platform = db_context.get("selected_platform", "未選択")
        selected_technologies = db_context.get("selected_technologies", [])
        specification = db_context.get("specification", "")
        must_functions = db_context.get("must_functions", [])

        # 選択中の技術
        if selected_technologies:
            tech_text = ", ".join(selected_technologies)
        else:
            tech_text = "(まだ選択されていません)"

        # Must機能
        if must_functions:
            must_text = "\n".join([f"- {f['name']} ({f['category']})" for f in must_functions])
        else:
            must_text = "(Must機能なし)"

        prompt = f"""あなたはハッカソンプロジェクトの技術選定についての質問に答えるアシスタントです。

## プロジェクト情報
- タイトル: {project_title}
- アイデア: {project_idea}

## 現在の選択状態
- プラットフォーム: {selected_platform}
- 選択中の技術: {tech_text}

## 必須機能（Must）
{must_text}

## あなたの役割
ユーザーの質問に応じて技術選定を手伝う：
- 「ReactとVue.jsどっちがいい？」→ プロジェクト要件とチーム経験を踏まえて比較
- 「この組み合わせで大丈夫？」→ 技術同士の相性を説明
- 「Python経験あるけど何がいい？」→ 経験を活かせる技術を推薦
- 「〇〇って難しい？」→ 学習コストとハッカソンの時間制約を踏まえて回答

## 重要
- 推薦する際はチームの経験を聞いてから判断する
- 経験がある技術を優先的に推薦する
- 未経験の技術を選ぶ場合はリスクを伝える

## やらないこと
- AIから先に「この技術が足りない」「この組み合わせは問題」と指摘しない
  （必須カテゴリのチェックはUI側で行っている）
- アクションボタンは使用しない"""

        return prompt
