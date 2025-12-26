"""
機能編集支援ハンドラ (functionStructuring ページ用)

ユーザーが機能一覧を編集する際のサポート役。
- 優先度の判断（依存関係の観点）
- 削除時の影響説明
- 追加の手伝い
"""

from typing import Dict, Any, List

from ..base_handler import BaseChatHandler
from ..chat_router import ChatRouter
from models.project_base import StructuredFunction, ProjectBase


@ChatRouter.register("functionStructuring")
class FunctionHandler(BaseChatHandler):
    """機能編集支援ハンドラ"""

    @property
    def page_context(self) -> str:
        return "functionStructuring"

    async def get_db_context(self) -> Dict[str, Any]:
        """
        機能一覧を取得
        """
        context = {}

        # プロジェクト基本情報
        project = (
            self.db.query(ProjectBase)
            .filter(ProjectBase.project_id == self.project_id)
            .first()
        )
        if project:
            context["project_title"] = project.title
            context["project_idea"] = project.idea
            context["start_date"] = project.start_date
            context["end_date"] = project.end_date
        else:
            context["project_title"] = ""
            context["project_idea"] = ""
            context["start_date"] = None
            context["end_date"] = None

        # 機能一覧を取得
        functions = (
            self.db.query(StructuredFunction)
            .filter(StructuredFunction.project_id == self.project_id)
            .order_by(StructuredFunction.order_index.asc())
            .all()
        )

        # カテゴリごとにグループ化
        categories: Dict[str, List[Dict]] = {}
        for func in functions:
            category = func.category or "その他"
            if category not in categories:
                categories[category] = []
            categories[category].append({
                "function_name": func.function_name,
                "description": func.description,
                "priority": func.priority,
            })

        context["functions_by_category"] = categories
        context["total_functions"] = len(functions)

        return context

    def get_system_prompt(self, db_context: Dict[str, Any]) -> str:
        """
        機能編集支援用のシステムプロンプトを生成
        """
        project_title = db_context.get("project_title", "不明")
        project_idea = db_context.get("project_idea", "不明")
        start_date = db_context.get("start_date")
        end_date = db_context.get("end_date")
        functions_by_category = db_context.get("functions_by_category", {})
        total = db_context.get("total_functions", 0)

        # 機能一覧をフォーマット
        if functions_by_category:
            func_lines = []
            for category, funcs in functions_by_category.items():
                func_lines.append(f"\n### {category}")
                for func in funcs:
                    priority = func['priority'] or '未設定'
                    func_lines.append(
                        f"- [{priority}] {func['function_name']}: {func['description']}"
                    )
            func_text = "\n".join(func_lines)
        else:
            func_text = "(機能はまだ定義されていません)"

        # 期間
        if start_date and end_date:
            duration_text = f"{start_date} 〜 {end_date}"
        else:
            duration_text = "未設定"

        prompt = f"""あなたはハッカソンプロジェクトの機能一覧を編集する際のサポート役です。

## ハッカソン期間
{duration_text}

## あなたの役割
ユーザーの質問・要望に応じて、機能の編集を手伝う。
- 優先度の判断 → 依存関係とハッカソンの時間制約を考慮
- 削除の判断 → 他の機能への影響を説明
- 追加の手伝い → 適切なカテゴリと優先度で追加

## やらないこと
- AIから先に「これが足りない」「これを追加すべき」と指摘しない
- 複数機能をまとめて提案しない

## プロジェクト情報
- タイトル: {project_title}
- アイデア: {project_idea}

## 現在の機能一覧（全{total}件）
{func_text}

## 依存関係の判断基準
機能名と説明から依存関係を推測する：
- 「〇〇画面」→「〇〇API」が必要
- 「〇〇編集」→「〇〇取得」が前提
- 「〇〇一覧」→ 個別の「〇〇詳細」より先

## 質問への回答例
- 「優先度どうすべき？」→ 依存する機能と同じかそれ以下を提案
- 「消していい？」→ この機能に依存している他の機能があるか確認して回答
- 「〇〇追加したい」→ 追加アクションを提示

## 機能の操作
操作が必要な場合、回答の最後に以下の形式で出力：

[ACTION:add_function:「機能名」を追加:{{{{"function_name": "機能名", "description": "説明", "category": "カテゴリ", "priority": "優先度"}}}}]
[ACTION:update_function:「機能名」の優先度をXXに変更:{{{{"function_name": "対象の機能名", "priority": "新しい優先度"}}}}]
[ACTION:delete_function:「機能名」を削除:{{{{"function_name": "対象の機能名"}}}}]

カテゴリ: auth, data, logic, ui, api, deployment
優先度: Must, Should, Could, Wont"""

        return prompt
