"""
実装計画ジェネレータ

MVPアプローチで実装ステップを計画。
"""

import json
from typing import Dict, Any, List

from langchain_core.messages import HumanMessage, SystemMessage

from ..context import AgentContext
from ..types import SessionState, ImplementationStep
from .base_generator import BaseGenerator


class PlanGenerator(BaseGenerator):
    """
    実装計画ジェネレータ

    タスクをMVPアプローチで段階的に実装する計画を生成。
    """

    async def generate(
        self,
        session: SessionState,
        context: AgentContext
    ):
        """
        Note: このメソッドはBaseGeneratorの抽象メソッドを満たすためのもの。
        実際の使用では generate_plan を使用してください。
        """
        raise NotImplementedError("Use generate_plan() instead")

    async def generate_plan(
        self,
        session: SessionState,
        context: AgentContext,
        user_choices: Dict[str, Any],
        decided_domains: Dict[str, str]
    ) -> List[ImplementationStep]:
        """
        実装計画を生成

        Args:
            session: セッション状態
            context: エージェントコンテキスト
            user_choices: ユーザーの選択
            decided_domains: プロジェクトで決定済みの技術

        Returns:
            実装ステップのリスト
        """
        prompt = self._build_prompt(session, context, user_choices, decided_domains)

        response = await context.llm.ainvoke([
            SystemMessage(content="あなたはMVP開発のエキスパートです。JSON形式で回答してください。"),
            HumanMessage(content=prompt)
        ])

        return self._parse_response(response.content)

    def _build_prompt(
        self,
        session: SessionState,
        context: AgentContext,
        user_choices: Dict[str, Any],
        decided_domains: Dict[str, str]
    ) -> str:
        """プロンプトを構築"""
        task = context.task

        choices_text = self.format_tech_choices(user_choices, context)
        decided_tech_section = self.format_decided_tech(decided_domains, context)
        dependency_summary = self.format_dependency_summary(session)
        project_overview_section = self.format_project_overview(session)
        mock_instruction = self.format_mock_instruction(session)
        successor_tasks_text = self.format_successor_tasks(session)

        return f"""
以下のタスクをMVPアプローチで段階的に実装する計画を立ててください。
{dependency_summary}
{project_overview_section}

## タスク情報
- タイトル: {task.title}
- 説明: {task.description or 'なし'}
- カテゴリ: {task.category or '未分類'}
{choices_text}
{decided_tech_section}
{successor_tasks_text}

## プロジェクト情報
- 技術スタック: {', '.join(context.tech_stack)}
- フレームワーク: {context.framework}
{mock_instruction}

## 重要：スコープの制約
**このタスクのスコープ（カテゴリ: {task.category or '未分類'}）内のみで計画を立ててください。**

- タスクのタイトルと説明に記載された範囲のみを実装する
- 後続タスクとして挙げられている内容は絶対に含めない
- 例: 「DB設計」タスクならスキーマ定義・マイグレーションまで。API実装は後続タスク
- 例: 「モデル定義」タスクならモデルクラスの作成まで。CRUD操作は後続タスク
- スコープ外の実装が必要に見えても、それは後続タスクで行う

## 計画のルール
1. 最初のステップは必ず「プロジェクト/ファイルの作成・初期設定」
2. 次のステップは「基本的な動作確認ができる最小構成」
3. その後、コア機能を段階的に追加
4. 各ステップは独立して動作確認できる単位にする
5. ステップ数は3〜5個程度
6. **実装済みの機能は再実装しない**
7. **後続タスクの内容は絶対に含めない**

## 出力形式（JSON）
{{
  "steps": [
    {{
      "step_number": 1,
      "title": "ステップのタイトル",
      "description": "このステップで何をするか（1-2文）"
    }}
  ]
}}
"""

    def _parse_response(self, content: str) -> List[ImplementationStep]:
        """レスポンスをパース"""
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content.strip())

            return [
                ImplementationStep(
                    step_number=s["step_number"],
                    title=s["title"],
                    description=s["description"]
                )
                for s in data.get("steps", [])
            ]
        except (json.JSONDecodeError, KeyError):
            # デフォルトのステップ
            return [
                ImplementationStep(1, "プロジェクト初期設定", "必要なファイルとディレクトリを作成します"),
                ImplementationStep(2, "基本実装", "最小限の動作する実装を作成します"),
                ImplementationStep(3, "機能追加", "コア機能を実装します"),
            ]
