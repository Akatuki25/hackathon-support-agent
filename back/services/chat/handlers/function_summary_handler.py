"""
機能要件書・追加質問サポートハンドラ (functionSummary ページ用)

ユーザーが機能要件書の編集と追加質問への回答を行う際のサポート。
summaryQAより実装寄りの内容。
- 機能要件の意図を説明する
- 実装観点でのアドバイス
- 優先度の考え方を説明する
"""

from typing import Dict, Any, List
from datetime import date

from ..base_handler import BaseChatHandler
from ..chat_router import ChatRouter
from models.project_base import ProjectDocument, QA, ProjectBase, ProjectMember, StructuredFunction


@ChatRouter.register("functionSummary")
class FunctionSummaryHandler(BaseChatHandler):
    """機能要件書・追加質問サポートハンドラ"""

    @property
    def page_context(self) -> str:
        return "functionSummary"

    async def get_db_context(self) -> Dict[str, Any]:
        """
        機能要件書と追加質問を取得
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
            # 開発期間を計算
            if project.start_date and project.end_date:
                end = project.end_date.date() if hasattr(project.end_date, 'date') else project.end_date
                start = project.start_date if isinstance(project.start_date, date) else project.start_date.date()
                context["duration_days"] = (end - start).days
            else:
                context["duration_days"] = None
        else:
            context["project_title"] = ""
            context["project_idea"] = ""
            context["duration_days"] = None

        # チームサイズを取得
        team_size = (
            self.db.query(ProjectMember)
            .filter(ProjectMember.project_id == self.project_id)
            .count()
        )
        context["team_size"] = team_size if team_size > 0 else None

        # 機能要件書を取得
        doc = (
            self.db.query(ProjectDocument)
            .filter(ProjectDocument.project_id == self.project_id)
            .first()
        )
        context["function_doc"] = doc.function_doc if doc else ""

        # 構造化された機能を取得（参考情報）
        functions = (
            self.db.query(StructuredFunction)
            .filter(StructuredFunction.project_id == self.project_id)
            .all()
        )

        must_count = sum(1 for f in functions if f.priority == "Must")
        should_count = sum(1 for f in functions if f.priority == "Should")
        could_count = sum(1 for f in functions if f.priority == "Could")

        context["function_counts"] = {
            "must": must_count,
            "should": should_count,
            "could": could_count,
            "total": len(functions)
        }

        # 追加質問を取得
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

        return context

    def get_system_prompt(self, db_context: Dict[str, Any]) -> str:
        """
        機能要件書・追加質問サポート用のシステムプロンプトを生成
        """
        project_title = db_context.get("project_title", "不明")
        project_idea = db_context.get("project_idea", "不明")
        duration_days = db_context.get("duration_days")
        team_size = db_context.get("team_size")
        function_doc = db_context.get("function_doc", "")
        function_counts = db_context.get("function_counts", {})
        questions = db_context.get("questions", [])

        # 追加質問をフォーマット
        if questions:
            qa_lines = []
            unanswered = 0
            for i, q in enumerate(questions, 1):
                status = "✓" if q["answered"] else "未回答"
                if not q["answered"]:
                    unanswered += 1
                qa_lines.append(f"{i}. [{status}] Q: {q['question']}")
                if q["answered"]:
                    qa_lines.append(f"   A: {q['answer']}")
            qa_text = "\n".join(qa_lines)
        else:
            qa_text = "(追加質問なし)"
            unanswered = 0

        # 制約情報
        constraints = []
        if duration_days:
            constraints.append(f"開発期間: {duration_days}日")
        if team_size:
            constraints.append(f"チーム人数: {team_size}人")
        constraints_text = "、".join(constraints) if constraints else "未設定"

        # 機能数
        counts = function_counts
        counts_text = f"Must: {counts.get('must', 0)}件、Should: {counts.get('should', 0)}件、Could: {counts.get('could', 0)}件"

        prompt = f"""あなたはハッカソンプロジェクトの機能要件書作成をサポートするアシスタントです。

## プロジェクト情報
- タイトル: {project_title}
- アイデア: {project_idea}
- 制約: {constraints_text}

## 機能要件の状況
{counts_text}（未回答の質問: {unanswered}件）

## 追加質問一覧
{qa_text}

## 現在の機能要件書
{function_doc if function_doc else "(機能要件書はまだありません)"}

## あなたの役割

### 追加質問について
- 「この質問の意味は？」→ 質問の意図と、回答が実装にどう影響するかを説明
- 「どう答えればいい？」→ 実装観点での回答例を提示

### 機能要件について
- 「この機能どう書けばいい？」→ 具体的な要件の書き方を提示
- 「優先度どうすればいい？」→ ハッカソンの制約（{constraints_text}）を踏まえてアドバイス
- 「この機能必要？」→ プロジェクトのアイデアと照らし合わせて判断材料を提示

### 実装観点のアドバイス
仕様書（summaryQA）より具体的に：
- 「この機能、技術的にどうやる？」→ 実装アプローチのヒントを出す
- 「時間足りる？」→ 制約を踏まえてMust/Should/Couldの調整を提案

### 追加質問の活用（重要）
追加質問に回答すると、その回答を反映して機能要件書が更新されます。
ユーザーが追加質問を活用したい場合は、**必ずアクションボタンで再生成を実行**してもらう必要があります。

以下の場合にアクションボタンを提案する：
- ユーザーが「追加質問に答えたから反映して」と依頼した場合
- 全ての追加質問に回答済みで「更新して」と依頼された場合
- ユーザーが「他に聞くべきことある？」と質問した場合

アクションの書式:
[ACTION:regenerate_questions:追加質問を更新:{{{{"reason": "回答を反映して機能要件書を更新"}}}}]

**アクション実行時の動作**: 回答済みQ&Aを参照して機能要件書を再生成し、新たな追加質問（最大3個）を生成

## やらないこと
- AIから先に「ここを直すべき」と指摘しない
- 機能要件書の編集はUIで直接可能（アクション不要）
- アクションなしでQ&Aの内容を反映することはできない"""

        return prompt
