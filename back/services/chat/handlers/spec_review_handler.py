"""
仕様書・追加質問サポートハンドラ (summaryQA ページ用)

ユーザーが仕様書の編集と追加質問への回答を行う際のサポート。
- 追加質問の意図を説明する
- 回答のヒントを提供する
- 仕様書の改善案を提示する
"""

from typing import Dict, Any, List

from ..base_handler import BaseChatHandler
from ..chat_router import ChatRouter
from models.project_base import ProjectDocument, QA, ProjectBase


@ChatRouter.register("summaryQA")
class SpecReviewHandler(BaseChatHandler):
    """仕様書・追加質問サポートハンドラ"""

    @property
    def page_context(self) -> str:
        return "summaryQA"

    async def get_db_context(self) -> Dict[str, Any]:
        """
        仕様書と追加質問を取得
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
        else:
            context["project_title"] = ""
            context["project_idea"] = ""

        # 仕様書を取得
        doc = (
            self.db.query(ProjectDocument)
            .filter(ProjectDocument.project_id == self.project_id)
            .first()
        )
        context["specification"] = doc.specification if doc else ""

        # 追加質問を取得（全て）
        qas = (
            self.db.query(QA)
            .filter(QA.project_id == self.project_id)
            .order_by(QA.importance.desc())
            .all()
        )

        context["questions"] = [
            {
                "question": qa.question,
                "answer": qa.answer,
                "answered": qa.answer is not None and qa.answer.strip() != ""
            }
            for qa in qas
        ]

        # フロントからの情報
        page_ctx = self.get_page_specific_context()
        context["focus_mode"] = page_ctx.get("focus_mode", "questions")
        context["unanswered_count"] = page_ctx.get("unanswered_count", 0)

        return context

    def get_system_prompt(self, db_context: Dict[str, Any]) -> str:
        """
        仕様書・追加質問サポート用のシステムプロンプトを生成
        """
        project_title = db_context.get("project_title", "不明")
        project_idea = db_context.get("project_idea", "不明")
        specification = db_context.get("specification", "")
        questions = db_context.get("questions", [])
        focus_mode = db_context.get("focus_mode", "questions")
        unanswered_count = db_context.get("unanswered_count", 0)

        # 追加質問をフォーマット
        if questions:
            qa_lines = []
            for i, q in enumerate(questions, 1):
                status = "✓" if q["answered"] else "未回答"
                qa_lines.append(f"{i}. [{status}] Q: {q['question']}")
                if q["answered"]:
                    qa_lines.append(f"   A: {q['answer']}")
            qa_text = "\n".join(qa_lines)
        else:
            qa_text = "(追加質問なし)"

        prompt = f"""あなたはハッカソンプロジェクトの仕様書作成と追加質問への回答をサポートするアシスタントです。

## プロジェクト情報
- タイトル: {project_title}
- アイデア: {project_idea}

## 現在のフォーカス
{focus_mode}（未回答の質問: {unanswered_count}件）

## 追加質問一覧
{qa_text}

## 現在の仕様書
{specification if specification else "(仕様書はまだありません)"}

## あなたの役割

### 追加質問について
- ユーザーが「この質問の意味は？」と聞いたら、質問の意図を説明する
- ユーザーが「どう答えればいい？」と聞いたら、回答のヒントや例を提示する
- 追加質問に答えることで仕様書がより具体的になることを伝える

### 仕様書について
- ユーザーが「この部分どう書けばいい？」と聞いたら、具体的な改善案を提示する
- 改善案はコピペできる形で提示する

### 追加質問の再生成について
以下の場合に「追加質問を更新しますか？」とアクションボタンを提案する：
- 全ての追加質問に回答済みの場合
- ユーザーが仕様書を編集した後「他に聞くべきことある？」と質問した場合
- ユーザーが「追加質問を更新して」と明示的に依頼した場合

アクションの書式:
[ACTION:regenerate_questions:追加質問を更新:{{{{"reason": "仕様書の更新を反映"}}}}]

## やらないこと
- AIから先に「ここを直すべき」と指摘しない
- 仕様書の編集はUIで直接可能なのでアクションは不要"""

        return prompt
