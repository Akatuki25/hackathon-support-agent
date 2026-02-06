"""
ステップコンテンツジェネレータ

各実装ステップの詳細な手順を生成。
"""

from typing import Dict, Any, AsyncGenerator, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from ..context import AgentContext
from ..types import SessionState, ImplementationStep, Decision
from .base_generator import BaseGenerator


class StepGenerator(BaseGenerator):
    """
    ステップコンテンツジェネレータ

    実装ステップの詳細な手順をストリーミング生成。
    """

    async def generate(
        self,
        session: SessionState,
        context: AgentContext
    ) -> AsyncGenerator[str, None]:
        """
        Note: このメソッドはBaseGeneratorの抽象メソッドを満たすためのもの。
        実際の使用では generate_step_content を使用してください。
        """
        raise NotImplementedError("Use generate_step_content() instead")

    async def generate_step_content(
        self,
        step: ImplementationStep,
        session: SessionState,
        context: AgentContext,
        user_choices: Dict[str, Any],
        decided_domains: Dict[str, str],
        previous_steps: List[ImplementationStep],
        decisions: Optional[List[Decision]] = None
    ) -> AsyncGenerator[str, None]:
        """
        ステップの実装内容をストリーミング生成

        Args:
            step: 現在のステップ
            session: セッション状態
            context: エージェントコンテキスト
            user_choices: ユーザーの選択
            decided_domains: プロジェクトで決定済みの技術
            previous_steps: 完了済みステップのリスト
            decisions: ユーザーが採用した決定事項

        Yields:
            生成されたコンテンツのチャンク
        """
        prompt = self._build_prompt(
            step, session, context, user_choices,
            decided_domains, previous_steps, decisions
        )

        messages = self.build_messages(
            "あなたは開発ガイドを作成するエキスパートです。",
            prompt
        )

        async for chunk in self.stream_llm(context, messages):
            yield chunk

    def _build_prompt(
        self,
        step: ImplementationStep,
        session: SessionState,
        context: AgentContext,
        user_choices: Dict[str, Any],
        decided_domains: Dict[str, str],
        previous_steps: List[ImplementationStep],
        decisions: Optional[List[Decision]]
    ) -> str:
        """プロンプトを構築"""
        task = context.task

        # タスク全体の選択
        choices_text = self.format_tech_choices(user_choices, context)

        # このステップで選択した技術
        step_choice_text = self._format_step_choice(step, session, context)

        # 完了済みステップ
        prev_steps_text = self._format_previous_steps(previous_steps)

        # ユーザーが採用した決定事項
        decisions_context = self._format_decisions(decisions)

        # プロジェクト実装概要
        project_overview_context = self.format_project_overview(session)

        # 決定済みの技術
        decided_tech_context = self.format_decided_tech(decided_domains, context)

        return f"""
以下のステップの詳細な実装手順を説明してください。
{project_overview_context}

## タスク情報
- タイトル: {task.title}
- 説明: {task.description or 'なし'}
- カテゴリ: {task.category or '未分類'}
{choices_text}
{decided_tech_context}
{step_choice_text}
{prev_steps_text}
{decisions_context}

## 現在のステップ
- ステップ{step.step_number}: {step.title}
- 目的: {step.description}

## プロジェクト情報
- 技術スタック: {', '.join(context.tech_stack)}
- フレームワーク: {context.framework}
- ディレクトリ構造: {context.directory_info[:500] if context.directory_info else '未設定'}

## 重要な注意事項
- **このステップの範囲内のみで実装すること**（スコープ外の内容は次のステップまたは別タスクで行う）
- 「このステップで選択した技術」は必ずそれを使って実装してください
- 「ユーザーが採用した決定事項」は必ず反映してください
- 「実装済みの機能」は再実装しないでください（既存のものをimport/呼び出しして利用）

## 出力形式
Markdown形式で以下を含めてください：

### ステップ{step.step_number}: {step.title}

#### 目的

このステップの目的を1-2文で説明

#### 実装手順

1. 最初にやること

```言語
コード例
```

2. 次にやること

```言語
コード例
```

#### 動作確認

このステップが完了したか確認する方法

---

**重要な書式ルール:**
- 各セクションの間には必ず空行を入れる
- 見出し（###, ####）の前後には空行を入れる
- コードブロックの前後には空行を入れる
- 箇条書きの前後には空行を入れる
"""

    def _format_step_choice(
        self,
        step: ImplementationStep,
        session: SessionState,
        context: AgentContext
    ) -> str:
        """このステップで選択した技術をフォーマット"""
        if step.step_number not in session.step_choices:
            return ""

        step_choice = session.step_choices[step.step_number]

        if "domain_key" in step_choice and "stack_key" in step_choice:
            # 新形式
            if context.tech_service:
                domain = context.tech_service.get_domain_by_key(step_choice["domain_key"])
                domain_name = domain.name if domain else step_choice["domain_key"]
            else:
                domain_name = step_choice["domain_key"]
            return f"\n## このステップで選択した技術（必ずこれを使って実装すること）\n- **{domain_name}: {step_choice['stack_key']}**\n"
        else:
            # 従来形式
            return f"\n## このステップで選択した技術（必ずこれを使って実装すること）\n- **{step_choice.get('selected', '')}**\n"

    def _format_previous_steps(
        self,
        previous_steps: List[ImplementationStep]
    ) -> str:
        """完了済みステップをフォーマット"""
        if not previous_steps:
            return ""

        text = "\n## 完了済みステップ\n"
        for ps in previous_steps:
            text += f"- ステップ{ps.step_number}: {ps.title} ✓\n"

        return text

    def _format_decisions(
        self,
        decisions: Optional[List[Decision]]
    ) -> str:
        """ユーザーが採用した決定事項をフォーマット"""
        if not decisions:
            return ""

        text = "\n## ユーザーが採用した決定事項（必ず反映してください）\n"
        for d in decisions:
            text += f"- **{d.description}**（ステップ{d.step_number}で決定）\n"

        return text
