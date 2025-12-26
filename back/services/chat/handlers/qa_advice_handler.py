"""
Q&A回答支援ハンドラ (hackQA ページ用)

ユーザーがプロジェクトに関する質問に回答する際の支援を行う。
- プロジェクトアイデアに基づいた回答例の提示
- 回答の不足点・見落としがちな観点の指摘
"""

from typing import Dict, Any
from sqlalchemy.orm import Session

from ..base_handler import BaseChatHandler
from ..chat_router import ChatRouter
from models.project_base import QA, ProjectDocument, ProjectBase


@ChatRouter.register("hackQA")
class QAAdviceHandler(BaseChatHandler):
    """Q&A回答支援ハンドラ"""

    @property
    def page_context(self) -> str:
        return "hackQA"

    async def get_db_context(self) -> Dict[str, Any]:
        """
        プロジェクト情報、QA一覧を取得
        フロントから渡されたpageSpecificContextがあればそれを優先（編集中の最新状態を反映）
        """
        context = {}
        page_ctx = self.get_page_specific_context()

        # フロントからideaが渡されていればそれを使用
        if page_ctx.get("idea"):
            context["project_idea"] = page_ctx["idea"]
            # titleはDBから取得
            project = (
                self.db.query(ProjectBase)
                .filter(ProjectBase.project_id == self.project_id)
                .first()
            )
            context["project_title"] = project.title if project else ""
        else:
            # DBから取得
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

        # フロントからqasが渡されていればそれを使用（編集中の内容を含む）
        if page_ctx.get("qas"):
            qa_list = []
            unanswered_count = 0
            for qa in page_ctx["qas"]:
                answer = qa.get("answer")
                is_unanswered = not answer or (isinstance(answer, str) and answer.strip() == "")
                if is_unanswered:
                    unanswered_count += 1
                qa_item = {
                    "qa_id": qa.get("qa_id", ""),
                    "question": qa.get("question", ""),
                    "answer": answer if answer else "(未回答)",
                    "is_unanswered": is_unanswered,
                }
                qa_list.append(qa_item)
            context["qa_list"] = qa_list
            context["unanswered_count"] = unanswered_count
            context["total_count"] = len(qa_list)
        else:
            # DBから取得
            qas = (
                self.db.query(QA)
                .filter(QA.project_id == self.project_id)
                .order_by(QA.importance.desc(), QA.created_at.asc())
                .all()
            )
            qa_list = []
            unanswered_count = 0
            for qa in qas:
                is_unanswered = not qa.answer or qa.answer.strip() == ""
                if is_unanswered:
                    unanswered_count += 1
                qa_item = {
                    "qa_id": str(qa.qa_id),
                    "question": qa.question,
                    "answer": qa.answer if qa.answer else "(未回答)",
                    "is_unanswered": is_unanswered,
                }
                qa_list.append(qa_item)
            context["qa_list"] = qa_list
            context["unanswered_count"] = unanswered_count
            context["total_count"] = len(qa_list)

        return context

    def get_system_prompt(self, db_context: Dict[str, Any]) -> str:
        """
        Q&A回答支援用のシステムプロンプトを生成
        """
        project_title = db_context.get("project_title", "不明")
        project_idea = db_context.get("project_idea", "不明")
        qa_list = db_context.get("qa_list", [])
        unanswered = db_context.get("unanswered_count", 0)
        total = db_context.get("total_count", 0)

        # QA一覧をフォーマット（未回答を明示）
        if qa_list:
            qa_text = "\n".join(
                [
                    f"{'[未回答] ' if qa['is_unanswered'] else ''}Q: {qa['question']}\n  A: {qa['answer']}"
                    for qa in qa_list
                ]
            )
        else:
            qa_text = "(質問はまだありません)"

        prompt = f"""あなたはハッカソンプロジェクトのQ&A回答を支援するアドバイザーです。

## あなたの役割
1. ユーザーが質問の意図を理解できるよう説明する
2. 回答が不十分な場合、具体的に何が足りないか指摘する
3. ユーザーが見落としがちな観点を提示する
4. プロジェクトのアイデアに合わせた具体的な回答例を提示する
5. 必要に応じて追加で聞くべき質問を提案する

## プロジェクト情報
- タイトル: {project_title}
- アイデア: {project_idea}

## 現在のQ&A状況（{unanswered}/{total}件が未回答）
{qa_text}

## 回答のポイント
- 回答は具体的に。「〜を実装する」ではなく「〜を〜の方法で実装する」
- 技術的な制約や代替案も考慮する
- ハッカソンの時間制約を意識し、現実的な範囲で回答する

## 追加質問の提案（アクション）
ユーザーが「質問を追加して」「足りない観点は？」などと求めた場合、積極的にアクションを使ってください。

**アクション形式**（回答の最後に1つだけ出力）：
[ACTION:add_question:この質問を追加:{{"question": "提案する質問文"}}]

**アクションを使うタイミング**：
- ユーザーが質問の追加・提案を求めた場合
- 仕様を固める上で重要な観点が不足している場合
- プロジェクトの成功に必要な情報が欠けている場合

**注意**: アクションは必ず1つだけ出力してください。

ユーザーからの質問に対して、上記の情報を踏まえて支援してください。"""

        return prompt
