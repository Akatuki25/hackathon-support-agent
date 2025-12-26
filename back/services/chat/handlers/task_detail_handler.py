"""
タスク詳細・実装支援ハンドラ (taskDetail ページ用)

タスクの詳細とハンズオン情報を基に実装を支援する。
- コード例の解説
- 実装のヒント提供
- エラー対応
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from ..base_handler import BaseChatHandler
from ..chat_router import ChatRouter
from models.project_base import Task, TaskHandsOn, TaskDependency


@ChatRouter.register("taskDetail")
class TaskDetailHandler(BaseChatHandler):
    """タスク詳細・実装支援ハンドラ"""

    @property
    def page_context(self) -> str:
        return "taskDetail"

    async def get_db_context(self) -> Dict[str, Any]:
        """
        タスク情報とハンズオン情報を取得
        """
        context = {}

        # ページ固有コンテキストから現在のタスクIDを取得
        page_ctx = self.get_page_specific_context()
        task_id = page_ctx.get("task_id")

        if not task_id:
            context["error"] = "タスクIDが指定されていません"
            return context

        # タスク情報を取得
        task = self.db.query(Task).filter(Task.task_id == task_id).first()

        if not task:
            context["error"] = f"タスクが見つかりません: {task_id}"
            return context

        context["task"] = {
            "task_id": str(task.task_id),
            "title": task.title,
            "description": task.description or "",
            "detail": task.detail or "",
            "priority": task.priority,
            "status": task.status,
            "category": task.category,
            "estimated_hours": task.estimated_hours,
        }

        # ハンズオン情報を取得
        hands_on = (
            self.db.query(TaskHandsOn)
            .filter(TaskHandsOn.task_id == task_id)
            .first()
        )

        if hands_on:
            context["hands_on"] = {
                "overview": getattr(hands_on, "overview", "") or "",
                "prerequisites": getattr(hands_on, "prerequisites", "") or "",
                "implementation_steps": getattr(hands_on, "implementation_steps", "") or "",
                "code_examples": getattr(hands_on, "code_examples", None),
                "common_errors": getattr(hands_on, "common_errors", None),
                "technical_context": getattr(hands_on, "technical_context", "") or "",
                "verification": getattr(hands_on, "verification", "") or "",
            }
        else:
            context["hands_on"] = None

        # 依存タスクを取得
        dependencies = (
            self.db.query(TaskDependency)
            .filter(TaskDependency.target_task_id == task_id)
            .all()
        )

        dep_tasks = []
        for dep in dependencies:
            source_task = (
                self.db.query(Task)
                .filter(Task.task_id == dep.source_task_id)
                .first()
            )
            if source_task:
                dep_tasks.append({
                    "task_id": str(source_task.task_id),
                    "title": source_task.title,
                    "status": source_task.status,
                })
        context["dependent_tasks"] = dep_tasks

        return context

    def get_system_prompt(self, db_context: Dict[str, Any]) -> str:
        """
        タスク詳細・実装支援用のシステムプロンプトを生成
        教育的アプローチ：直接答えを与えず、段階的にヒントを提供
        """
        # エラーチェック
        if db_context.get("error"):
            return f"""あなたはタスク実装の学習を支援するアシスタントです。

エラー: {db_context['error']}
タスクIDを指定してください。
"""

        # タスク情報
        task = db_context.get("task", {})
        task_info = f"""
タイトル: {task.get('title', '不明')}
説明: {task.get('description', 'なし')}
カテゴリ: {task.get('category', '未分類')}
"""

        # ハンズオン情報
        hands_on = db_context.get("hands_on")
        if hands_on:
            hands_on_info = f"""
## 現在のハンズオン内容
概要: {hands_on.get('overview', 'なし')}

前提条件: {hands_on.get('prerequisites', 'なし')}

実装手順:
{hands_on.get('implementation_steps', 'なし')}

技術的背景: {hands_on.get('technical_context', 'なし')}
"""
            # コード例（AIには見せるが、ユーザーへの回答では直接出さない）
            code_examples = hands_on.get("code_examples")
            if code_examples and isinstance(code_examples, list):
                code_text = "\n\n".join(
                    [
                        f"### {ex.get('file', 'ファイル名不明')}\n```{ex.get('language', '')}\n{ex.get('code', '')}\n```"
                        for ex in code_examples
                    ]
                )
                hands_on_info += f"\n## コード例（参考用・直接見せない）\n{code_text}"

            # よくあるエラー
            common_errors = hands_on.get("common_errors")
            if common_errors and isinstance(common_errors, list):
                error_text = "\n".join(
                    [f"- {err.get('error', '')}: {err.get('cause', '')}"
                     for err in common_errors]
                )
                hands_on_info += f"\n## よくあるエラー（参考用）\n{error_text}"
        else:
            hands_on_info = "(ハンズオン情報はまだ生成されていません)"

        # 依存タスク
        dep_tasks = db_context.get("dependent_tasks", [])
        if dep_tasks:
            dep_text = "\n".join(
                [f"- {t['title']} ({t['status']})" for t in dep_tasks]
            )
            dep_info = f"\n## 前提タスク\n{dep_text}"
        else:
            dep_info = ""

        prompt = f"""あなたはタスク実装を支援するアシスタントです。

## タスク情報
{task_info}
{hands_on_info}
{dep_info}

## 支援方針

### このAIの役割
初心者は「何がわからないか」すらわからない状態で聞きに来る。
このAIが責任を持って、詰まりポイントを特定し、概念を噛み砕いて説明する。
外部サービス（ChatGPT、公式ドキュメント等）に丸投げしない。

### ステップ1: 詰まりポイントを絞り込む
漠然とした質問には、選択肢を提示して絞り込む。
例: 「CRUDがわからない」→「どの操作で詰まってる？データの登録？取得？更新？削除？」

### ステップ2: 全体フローの中での位置づけ + 専門用語 + 具体的説明
専門用語は検索キーワードになるので必ず使う。ただし：
- その用語が「全体の流れのどこにあるか」を示す
- その用語が「具体的に何をするか」を説明する

良い例:
「ユーザーがデータを送ってきた時、最初の入り口になるのが@Post()デコレータ。
 『このURLにPOSTで来たらこのメソッドで受け取る』という目印。
 次に、送られてきたデータ（body）を取り出すのが@Body()。
 この2つで『受け取り』ができたら、次はServiceに渡す流れになる」

悪い例:
- ❌「Controllerは窓口係です」→ 抽象的すぎ、検索できない
- ❌「@Post()をつけて@Body()で...」→ 専門用語だけで何をするか不明
- ❌「公式ドキュメント読んで」→ 丸投げ

### ステップ3: 実装のとっかかり
概念を理解したら、具体的にどう書き始めるかのヒントを出す。
ただし完成コードは見せない。構造やパターンを示す。

### やらないこと
- 外部に丸投げ（「公式ドキュメント読め」「ChatGPTに聞け」）
- 最初から完成コードを見せる
- 漠然とした質問に漠然と返す

### ハンズオン補足アクション
説明した内容がハンズオンに不足していると判断した場合、以下で補足を追記：

[ACTION:adjust_hands_on:ハンズオンを補足:{{{{"field": "対象フィールド", "content": "追記内容"}}}}]

対象フィールド:
- implementation_steps: 実装手順の補足
- technical_context: 技術的背景の補足
- prerequisites: 前提知識の補足

発動条件:
- 同じ概念で2回以上つまずいている
- ハンズオンの説明が不十分だと判断した
- 補足説明がユーザーの理解に役立ったと確認できた時

## 会話例
ユーザー: 「このタスクどうやるの？」
AI: 「ハンズオンの手順は見ましたか？どの部分で詰まっていますか？
     - 環境構築？
     - ファイルの作り方？
     - 具体的なコードの書き方？」

ユーザー: 「Controllerの書き方がわからない」
AI: 「なるほど。Controllerの中でも、どの部分？
     - リクエストの受け取り方？
     - データの加工？
     - Serviceへの渡し方？」

ユーザー: 「リクエストの受け取り方」
AI: 「OK。ユーザーがデータを送ってきた時の流れを説明すると：
     1. @Post()デコレータが『このURLにPOSTが来たらここ』という入り口
     2. @Body()で送られてきたデータを取り出す
     3. 取り出したデータをServiceに渡す
     まず1と2を書いてみて、データがちゃんと取れるかconsole.logで確認してみて」"""

        return prompt
