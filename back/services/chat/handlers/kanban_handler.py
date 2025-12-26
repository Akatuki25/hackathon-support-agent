"""
タスク分担支援ハンドラ (kanban ページ用)

タスクの割り当てと分担をサポートする。
- タスク分担のアドバイス
- 負荷バランスの分析
- 依存関係を考慮した順序提案
"""

from typing import Dict, Any, List
from collections import defaultdict
from sqlalchemy.orm import Session

from ..base_handler import BaseChatHandler
from ..chat_router import ChatRouter
from models.project_base import (
    Task,
    TaskAssignment,
    TaskDependency,
    ProjectMember,
    MemberBase,
)


@ChatRouter.register("kanban")
class KanbanHandler(BaseChatHandler):
    """タスク分担支援ハンドラ"""

    @property
    def page_context(self) -> str:
        return "kanban"

    async def get_db_context(self) -> Dict[str, Any]:
        """
        タスク、メンバー、割り当て情報を取得
        """
        context = {}

        # メンバー一覧を取得
        project_members = (
            self.db.query(ProjectMember)
            .filter(ProjectMember.project_id == self.project_id)
            .all()
        )

        members = []
        member_skills = {}
        for pm in project_members:
            member = self.db.query(MemberBase).filter(
                MemberBase.member_id == pm.member_id
            ).first()
            if member:
                members.append({
                    "project_member_id": str(pm.project_member_id),
                    "member_id": str(pm.member_id),
                    "member_name": pm.member_name,
                    "skill": member.member_skill,
                })
                member_skills[str(pm.project_member_id)] = member.member_skill

        context["members"] = members

        # タスク一覧を取得
        tasks = (
            self.db.query(Task)
            .filter(Task.project_id == self.project_id)
            .order_by(Task.priority.asc())
            .all()
        )

        task_list = []
        for task in tasks:
            task_list.append({
                "task_id": str(task.task_id),
                "title": task.title,
                "description": task.description or "",
                "priority": task.priority,
                "status": task.status,
                "category": task.category,
                "estimated_hours": task.estimated_hours,
            })
        context["tasks"] = task_list

        # 現在の割り当て状況を取得
        assignments = (
            self.db.query(TaskAssignment)
            .join(Task)
            .filter(Task.project_id == self.project_id)
            .all()
        )

        # メンバーごとの割り当てタスク数を集計
        member_workload: Dict[str, List[str]] = defaultdict(list)
        assignment_map: Dict[str, str] = {}  # task_id -> member_name

        for assign in assignments:
            pm = next(
                (m for m in members if m["project_member_id"] == str(assign.project_member_id)),
                None,
            )
            if pm:
                member_workload[pm["member_name"]].append(str(assign.task_id))
                assignment_map[str(assign.task_id)] = pm["member_name"]

        context["assignments"] = assignment_map
        context["member_workload"] = dict(member_workload)

        # タスク依存関係を取得
        dependencies = (
            self.db.query(TaskDependency)
            .join(Task, TaskDependency.source_task_id == Task.task_id)
            .filter(Task.project_id == self.project_id)
            .all()
        )

        dep_list = []
        for dep in dependencies:
            dep_list.append({
                "source_task_id": str(dep.source_task_id),
                "target_task_id": str(dep.target_task_id),
            })
        context["dependencies"] = dep_list

        return context

    def get_system_prompt(self, db_context: Dict[str, Any]) -> str:
        """
        タスク分担支援用のシステムプロンプトを生成
        """
        # メンバー一覧
        members = db_context.get("members", [])
        members_with_skill = []
        members_without_skill = []

        for m in members:
            if m['skill'] and m['skill'].strip():
                members_with_skill.append(f"- {m['member_name']} (スキル: {m['skill']})")
            else:
                members_without_skill.append(f"- {m['member_name']} (スキル: 未登録)")

        if members_with_skill or members_without_skill:
            member_text = "\n".join(members_with_skill + members_without_skill)
        else:
            member_text = "(メンバーはまだ登録されていません)"

        # スキル未登録メンバーがいるかどうか
        has_members_without_skill = len(members_without_skill) > 0

        # タスク一覧（割り当て状況付き）
        tasks = db_context.get("tasks", [])
        assignments = db_context.get("assignments", {})
        if tasks:
            task_lines = []
            for task in tasks:
                assignee = assignments.get(task["task_id"], "未割当")
                priority_badge = f"[{task['priority']}]" if task['priority'] else ""
                hours = f"({task['estimated_hours']}h)" if task.get('estimated_hours') else ""
                task_lines.append(
                    f"- {task['title']} {priority_badge} {hours} → {assignee}"
                )
            task_text = "\n".join(task_lines)
        else:
            task_text = "(タスクはまだありません)"

        # 負荷分析
        workload = db_context.get("member_workload", {})
        if workload:
            workload_text = "\n".join(
                [f"- {name}: {len(task_list)}件のタスク" for name, task_list in workload.items()]
            )
        else:
            workload_text = "(割り当てはまだありません)"

        # 依存関係
        dependencies = db_context.get("dependencies", [])
        if dependencies:
            dep_text = f"{len(dependencies)}件の依存関係があります"
        else:
            dep_text = "(依存関係はありません)"

        # スキル未登録時の追加指示
        skill_note = ""
        if has_members_without_skill:
            skill_note = """
## 重要：スキル未登録メンバーへの対応
スキルが未登録のメンバーがいます。担当者を提案する際は、まずそのメンバーのスキルを質問してください。
例：「〇〇さんはどんな技術が得意ですか？（フロントエンド/バックエンド/デザインなど）」
ヒアリングした情報を踏まえて担当を提案してください。
"""

        prompt = f"""あなたはカンバンボードでのタスク分担についての質問に答えるアシスタントです。

## メンバー一覧
{member_text}

## タスク一覧（{len(tasks)}件）
{task_text}

## 現在の負荷状況
{workload_text}

## タスク依存関係
{dep_text}
{skill_note}
## あなたの役割
ユーザーの質問に応じてタスク分担を手伝う：

### 担当者決め
- 「このタスク誰がやる？」→ メンバーのスキルと現在の負荷を踏まえて提案
- 「〇〇さんに何やらせる？」→ そのメンバーのスキルに合うタスクを提案

### 負荷バランス
- 「負荷バランスどう？」→ 現在の割り当て状況を分析して説明
- 「〇〇さん大丈夫？」→ 特定メンバーの負荷を確認

### 進め方
- 「何から始める？」→ 依存関係を踏まえた優先順位を説明
- 「並列でできるのどれ？」→ 依存関係がないタスクを特定

### 操作方法
- 「メンバー追加したい」→ プロジェクト設定から追加できることを説明
- 「割り当て変えたい」→ タスクカードをドラッグ＆ドロップで移動できることを説明

## やらないこと
- AIから先に「この分担は問題」「負荷が偏っている」と指摘しない
- アクションボタンは使用しない（UIでドラッグ＆ドロップで割り当て可能）"""

        return prompt
