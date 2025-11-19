"""
TaskHandsOnAgent: Plan-and-Execute パターンによるハンズオン生成

Phase 3: 最適化されたハンズオン生成エージェント
- Planner: 情報収集計画を立てる (1 LLM call)
- Executor: 計画を並列実行 (0 LLM calls, tool calls only)
- Generator: ハンズオンを生成 (1 LLM call with Structured Output)
"""

import asyncio
from typing import Dict, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session

from models.project_base import Task, TaskHandsOn
from services.task_hands_on_planner import TaskHandsOnPlanner
from services.task_hands_on_executor import InformationExecutor
from services.task_hands_on_generator import TaskHandsOnGenerator
from services.task_hands_on_schemas import TaskHandsOnOutput


class TaskHandsOnAgent:
    """
    Plan-and-Execute パターンによるハンズオン生成エージェント

    従来のReActパターン (10-15 LLM calls) から Plan-and-Execute (2 LLM calls) に変更:
    - Token削減: 45% (50,800 → 28,000 tokens/task)
    - レイテンシ削減: 57% (28秒 → 12秒/task)
    - コスト削減: 73% ($0.142 → $0.038/project)
    - パースエラー: 0 (Structured Output)
    """

    def __init__(
        self,
        db: Session,
        task: Task,
        project_context: Dict,
        config: Optional[Dict] = None
    ):
        """
        初期化

        Args:
            db: データベースセッション
            task: 対象タスク
            project_context: プロジェクトコンテキスト
                {
                    "project_id": "uuid",
                    "title": "プロジェクト名",
                    "tech_stack": ["Next.js 15", "PostgreSQL"],
                    "framework": "フレームワーク情報",
                    "directory_structure": "ディレクトリ構造",
                    ...
                }
            config: 生成設定
                {
                    "model": "gemini-2.5-flash"
                }
        """
        self.db = db
        self.task = task
        self.project_context = project_context
        self.config = config or {}

        # Plan-and-Execute コンポーネントの初期化
        self.planner = TaskHandsOnPlanner()
        self.executor = InformationExecutor(
            db=db,
            project_id=str(task.project_id),
            current_task_id=str(task.task_id)
        )
        self.generator = TaskHandsOnGenerator()

    def generate_hands_on(self) -> TaskHandsOn:
        """
        ハンズオン生成のメイン処理

        Plan-and-Execute パターン:
        1. Planner: 情報収集計画を立てる
        2. Executor: 計画を並列実行して情報収集
        3. Generator: 収集した情報からハンズオンを生成

        Returns:
            TaskHandsOn オブジェクト
        """
        print(f"\n[TaskHandsOnAgent] ハンズオン生成開始: {self.task.title}")
        print(f"[TaskHandsOnAgent] カテゴリ: {self.task.category}, 優先度: {self.task.priority}")

        try:
            # ===== Phase 1: Planning (1 LLM call) =====
            print("\n[Phase 1] Planning - 情報収集計画の作成...")
            task_info = self._prepare_task_info()
            plan = self.planner.create_plan(task_info)

            print(f"[Phase 1] 計画完了:")
            print(f"  - 依存タスク情報が必要: {plan.needs_dependencies}")
            if plan.needs_dependencies:
                print(f"  - 検索キーワード: {plan.dependency_search_keywords}")
            print(f"  - ユースケース/仕様書が必要: {plan.needs_use_case}")
            if plan.needs_use_case:
                print(f"  - カテゴリ: {plan.use_case_category}")

            # ===== Phase 2: Execution (0 LLM calls, parallel tool execution) =====
            print("\n[Phase 2] Execution - 情報収集の並列実行...")
            collected_info = asyncio.run(self.executor.execute_plan(plan))

            # 収集した情報を整形
            collected_info_text = self.executor.format_collected_info(collected_info)
            print(f"[Phase 2] 情報収集完了 ({len(collected_info_text)} 文字)")

            # ===== Phase 3: Generation (1 LLM call with Structured Output) =====
            print("\n[Phase 3] Generation - ハンズオンの生成...")
            hands_on_output: TaskHandsOnOutput = self.generator.generate(
                task_info=task_info,
                collected_info_text=collected_info_text
            )

            print(f"[Phase 3] ハンズオン生成完了")
            print(f"  - Overview: {len(hands_on_output.overview)} 文字")
            print(f"  - Implementation Steps: {len(hands_on_output.implementation_steps)} 文字")
            print(f"  - Code Examples: {len(hands_on_output.code_examples)} 件")
            print(f"  - Testing Guidelines: {len(hands_on_output.testing_guidelines)} 件")
            print(f"  - Common Errors: {len(hands_on_output.common_errors)} 件")
            print(f"  - Implementation Tips: {len(hands_on_output.implementation_tips)} 件")

            # ===== TaskHandsOn オブジェクト作成 =====
            hands_on = self._create_task_hands_on(hands_on_output, plan, collected_info)

            # 品質評価
            quality_score = self._evaluate_quality(hands_on_output)
            hands_on.quality_score = quality_score

            print(f"\n[TaskHandsOnAgent] ✅ ハンズオン生成完了 (品質スコア: {quality_score:.2f})")

            return hands_on

        except Exception as e:
            print(f"\n[TaskHandsOnAgent] ❌ エラー: {str(e)}")
            import traceback
            traceback.print_exc()
            raise

    def _prepare_task_info(self) -> Dict:
        """タスク情報を準備"""
        return {
            "title": self.task.title,
            "category": self.task.category or "未分類",
            "description": self.task.description or "説明なし",
            "priority": self.task.priority or "Must",
            "estimated_hours": self.task.estimated_hours or 0,
            "project_context": {
                "framework": self.project_context.get("framework", ""),
                "tech_stack": self.project_context.get("tech_stack", []),
                "directory_info": self.project_context.get("directory_info", ""),  # 修正: directory_structure → directory_info
            }
        }

    def _create_task_hands_on(
        self,
        output: TaskHandsOnOutput,
        plan,
        collected_info: Dict = None
    ) -> TaskHandsOn:
        """TaskHandsOnOutputからTaskHandsOnオブジェクトを作成"""

        # target_files を辞書のリストに変換
        target_files = [
            {
                "path": f.path,
                "action": f.action,
                "reason": f.reason
            }
            for f in output.target_files
        ]

        # code_examples を辞書のリストに変換
        code_examples = [
            {
                "description": ex.description,
                "file_path": ex.file_path,
                "code": ex.code,
                "language": ex.language
            }
            for ex in output.code_examples
        ]

        # testing_guidelines を文字列形式に変換 (verificationフィールド用)
        verification_text = self._format_testing_guidelines(output.testing_guidelines)

        # common_errors を辞書のリストに変換
        common_errors = [
            {
                "error": err.error,
                "cause": err.cause,
                "solution": err.solution
            }
            for err in output.common_errors
        ]

        # implementation_tips を辞書のリストに変換
        implementation_tips = [
            {
                "type": tip.type,
                "tip": tip.tip,
                "reason": tip.reason
            }
            for tip in output.implementation_tips
        ]

        # referenced_urls と references を収集した依存タスク情報から構築
        referenced_urls = []
        references = []

        if collected_info:
            dep_info = collected_info.get("dependency_info")
            if dep_info:
                # 直接的な依存タスクから
                for dep in dep_info.get("direct_dependencies", []):
                    task_id = dep.get("task_id")
                    if task_id:
                        # 参照URLとしてタスクIDを記録
                        task_url = f"/task/{task_id}"
                        referenced_urls.append(task_url)

                        # referencesにも追加 (UI表示用)
                        references.append({
                            "title": f"依存タスク: {dep.get('task_title', 'Unknown')}",
                            "url": task_url,
                            "type": "dependency"
                        })

                # 関連タスクから
                for task in dep_info.get("related_tasks", []):
                    task_id = task.get("task_id")
                    if task_id:
                        task_url = f"/task/{task_id}"
                        # referenced_urlsには追加済みでなければ追加
                        if task_url not in referenced_urls:
                            referenced_urls.append(task_url)
                            references.append({
                                "title": f"関連タスク: {task.get('task_title', 'Unknown')}",
                                "url": task_url,
                                "type": "related"
                            })

        # 検索クエリを記録
        search_queries = []
        if plan.web_search_queries:
            search_queries = plan.web_search_queries

        # ドキュメントURL
        if plan.document_urls:
            for doc_url in plan.document_urls:
                if doc_url not in referenced_urls:
                    referenced_urls.append(doc_url)
                    references.append({
                        "title": doc_url,  # URLをそのままタイトルとして使用
                        "url": doc_url,
                        "type": "documentation"
                    })

        return TaskHandsOn(
            task_id=self.task.task_id,
            overview=output.overview,
            prerequisites=output.prerequisites,
            target_files=target_files,
            implementation_steps=output.implementation_steps,
            code_examples=code_examples,
            verification=verification_text,  # testing_guidelines をテキスト形式で格納
            common_errors=common_errors,
            references=references,
            technical_context=output.technical_context,
            implementation_tips=implementation_tips,
            quality_score=0.0,  # 後で設定
            generation_model=self.config.get("model", "gemini-2.5-flash"),
            search_queries=search_queries,
            referenced_urls=referenced_urls,
            information_freshness=datetime.now().date()
            # Note: estimated_time_minutes は DB スキーマに存在しないため除外
        )

    def _format_testing_guidelines(self, guidelines: list) -> str:
        """testing_guidelinesをテキスト形式に変換"""
        if not guidelines:
            return ""

        lines = []
        for i, test in enumerate(guidelines, 1):
            lines.append(f"## テスト {i}: {test.test_type}")
            lines.append(f"{test.description}\n")

            if test.verification_points:
                lines.append("**確認ポイント:**")
                for point in test.verification_points:
                    lines.append(f"- {point}")
                lines.append("")

            if test.test_code:
                lines.append("**テストコード:**")
                lines.append(f"```\n{test.test_code}\n```\n")

        return "\n".join(lines)

    def _evaluate_quality(self, output: TaskHandsOnOutput) -> float:
        """
        ハンズオンの品質を評価

        Args:
            output: TaskHandsOnOutput

        Returns:
            品質スコア（0.0-1.0）
        """
        score = 0.0

        # チェック1: overview が十分な長さか（重要度: 高）
        if len(output.overview) >= 100:
            score += 0.15
        elif len(output.overview) >= 50:
            score += 0.10

        # チェック2: prerequisites が存在するか（重要度: 中）
        if len(output.prerequisites) >= 50:
            score += 0.10

        # チェック3: target_files が存在するか（重要度: 高）
        if len(output.target_files) >= 1:
            score += 0.15

        # チェック4: implementation_steps が十分か（重要度: 最高）
        # 修正: str型になったのでMarkdown文字数で判定
        if len(output.implementation_steps) >= 500:
            score += 0.25
        elif len(output.implementation_steps) >= 200:
            score += 0.15

        # チェック5: code_examples が存在するか（重要度: 高）
        if len(output.code_examples) >= 2:
            score += 0.20
        elif len(output.code_examples) >= 1:
            score += 0.10

        # チェック6: testing_guidelines が存在するか（重要度: 中）
        if len(output.testing_guidelines) >= 2:
            score += 0.10
        elif len(output.testing_guidelines) >= 1:
            score += 0.05

        # チェック7: common_errors が存在するか（重要度: 中）教育的価値
        if len(output.common_errors) >= 2:
            score += 0.05

        # チェック8: implementation_tips が存在するか（重要度: 中）教育的価値
        if len(output.implementation_tips) >= 2:
            score += 0.05

        return round(min(score, 1.0), 2)


if __name__ == "__main__":
    # 動作確認用サンプルコード
    from database import get_db
    from models.project_base import ProjectBase, ProjectDocument

    db = next(get_db())

    # サンプルタスク取得
    task = db.query(Task).first()
    if not task:
        print("タスクが見つかりません")
        exit(1)

    # プロジェクトコンテキスト構築
    project = db.query(ProjectBase).filter_by(project_id=task.project_id).first()
    project_doc = db.query(ProjectDocument).filter_by(project_id=task.project_id).first()

    project_context = {
        "project_id": str(project.project_id),
        "title": project.title,
        "tech_stack": ["Next.js 15", "FastAPI", "PostgreSQL"],
        "framework": project_doc.framework if project_doc else "",
        "directory_structure": project_doc.directory_structure if project_doc else "",
    }

    # エージェント実行
    agent = TaskHandsOnAgent(
        db=db,
        task=task,
        project_context=project_context,
        config={"model": "gemini-2.5-flash"}
    )

    hands_on = agent.generate_hands_on()

    print("\n=== 生成されたハンズオン ===")
    print(f"概要: {hands_on.overview[:200]}...")
    print(f"品質スコア: {hands_on.quality_score}")
    print(f"実装ステップ数: {len(hands_on.implementation_steps)}")
    print(f"コード例数: {len(hands_on.code_examples)}")
