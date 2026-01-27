"""
InteractiveHandsOnAgent: インタラクティブハンズオン生成エージェント

ストリーミングで段階的に生成し、必要に応じて選択肢を提示する対話型エージェント。
- ストリーミングでレイテンシを誤魔化しながら段階的に生成
- 必要な時だけ選択肢を提示（技術選定など）
- ステップごとに「できた」を待つMVPアプローチ
- 各ステップでDB保存（中断時も進捗を保持）
"""

import asyncio
import json
import uuid
from typing import Dict, Optional, AsyncGenerator, List, Any
from datetime import datetime
from dataclasses import asdict
from enum import Enum

from sqlalchemy.orm import Session
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from models.project_base import Task, TaskHandsOn, TaskDependency
from services.tech_selection_service import TechSelectionService

# 型定義は hands_on モジュールからインポート
from services.hands_on.types import (
    GenerationPhase,
    ChoiceOption,
    ChoiceRequest,
    InputPrompt,
    ImplementationStep,
    Decision,
    DependencyTaskInfo,
    StepRequirements,
    SessionState,
)


class InteractiveHandsOnAgent:
    """
    インタラクティブハンズオン生成エージェント

    SSEストリーミングで段階的に生成し、ステップごとにユーザー確認を待つ。
    各ステップ完了時にDBに保存し、中断しても進捗を保持する。
    """

    def __init__(
        self,
        db: Session,
        task: Task,
        project_context: Dict,
        config: Optional[Dict] = None,
        dependency_context: Optional[Dict] = None
    ):
        self.db = db
        self.task = task
        self.project_context = project_context
        self.config = config or {}
        self.dependency_context = dependency_context or {}

        # LLM初期化
        self.llm = ChatGoogleGenerativeAI(
            model=self.config.get("model", "gemini-2.0-flash"),
            temperature=0.7
        )

        # 技術選定サービス初期化
        self.tech_service = TechSelectionService(db)

        # 決定済みdomainをキャッシュ
        self.decided_domains = self.tech_service.get_decided_domains(
            task.project_id, task.task_id
        )

        # エコシステム特定
        self.ecosystem = self._detect_ecosystem(project_context.get('tech_stack', []))

    def _get_task_position(self) -> Dict:
        """タスクの全体における位置づけを取得"""
        dependencies_from = self.db.query(TaskDependency).filter(
            TaskDependency.target_task_id == self.task.task_id
        ).all()

        dependencies_to = self.db.query(TaskDependency).filter(
            TaskDependency.source_task_id == self.task.task_id
        ).all()

        prev_tasks = []
        for dep in dependencies_from:
            source_task = self.db.query(Task).filter(
                Task.task_id == dep.source_task_id
            ).first()
            if source_task:
                prev_tasks.append({
                    "task_id": str(source_task.task_id),
                    "title": source_task.title,
                    "category": source_task.category
                })

        next_tasks = []
        for dep in dependencies_to:
            target_task = self.db.query(Task).filter(
                Task.task_id == dep.target_task_id
            ).first()
            if target_task:
                next_tasks.append({
                    "task_id": str(target_task.task_id),
                    "title": target_task.title,
                    "category": target_task.category
                })

        return {
            "current": {
                "task_id": str(self.task.task_id),
                "title": self.task.title,
                "category": self.task.category or "未分類"
            },
            "previous_tasks": prev_tasks,
            "next_tasks": next_tasks,
            "position_description": self._build_position_description(prev_tasks, next_tasks)
        }

    def _build_position_description(
        self,
        prev_tasks: List[Dict],
        next_tasks: List[Dict]
    ) -> str:
        """位置づけの説明文を生成"""
        parts = []

        if prev_tasks:
            prev_names = [t["title"] for t in prev_tasks[:3]]
            parts.append(f"前提タスク: {', '.join(prev_names)}")

        if next_tasks:
            next_names = [t["title"] for t in next_tasks[:3]]
            parts.append(f"次のタスク: {', '.join(next_names)}")

        if not parts:
            return "このタスクは独立したタスクです。"

        return " → ".join(parts)

    def _detect_ecosystem(self, tech_stack: List[str]) -> Optional[str]:
        """
        tech_stackからエコシステムを特定

        Args:
            tech_stack: 技術スタックのリスト

        Returns:
            "python", "next.js"等、または特定できない場合はNone
        """
        tech_stack_lower = [t.lower() for t in tech_stack]

        # Python系
        python_indicators = ["python", "fastapi", "flask", "django", "sqlalchemy"]
        if any(indicator in " ".join(tech_stack_lower) for indicator in python_indicators):
            return "python"

        # Next.js/React系
        nextjs_indicators = ["next.js", "nextjs", "next", "react"]
        if any(indicator in " ".join(tech_stack_lower) for indicator in nextjs_indicators):
            return "next.js"

        # Node.js系
        nodejs_indicators = ["node.js", "nodejs", "express"]
        if any(indicator in " ".join(tech_stack_lower) for indicator in nodejs_indicators):
            return "node.js"

        return None

    async def _check_tech_selection(self, session: SessionState, force_choice: bool = False) -> Dict:
        """
        技術選定が必要かどうかを判断（DBプリセット + LLM判断）

        LLMはdomain検出のみ行い、選択肢はDBから取得する。

        Returns:
            選択が必要な場合:
            {
                "needs_choice": True,
                "domain_key": "orm_python",
                "question": "どのORMを使用しますか？",
                "options": [{"id": "...", "label": "...", "description": "...", "pros": [...], "cons": [...]}]
            }
            既に決まっている場合:
            {
                "needs_choice": False,
                "decided": "SQLAlchemy",
                "reason": "タスク説明で指定済み"
            }
        """
        # 利用可能なdomainを取得
        domains = self.tech_service.get_available_domains(self.ecosystem)
        if not domains:
            return {"needs_choice": False, "decided": None, "reason": "利用可能な技術領域がありません"}

        # 決定済みdomainを取得（キャッシュを使用）
        decided_text = self.tech_service.get_decided_for_prompt(
            self.task.project_id, self.task.task_id
        )

        # domain一覧をテキスト化
        domains_text = "\n".join([f"- {d.key}: {d.name}" for d in domains])

        prompt = f"""
以下のタスクを実装するにあたり、技術選定が必要かどうか判断してください。

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}

## プロジェクト情報
- 技術スタック: {', '.join(self.project_context.get('tech_stack', []))}
- フレームワーク: {self.project_context.get('framework', '未設定')}

## 利用可能な技術領域（プリセットあり）
{domains_text}

## プロジェクトで決定済み（これらは除外）
{decided_text}

## 判断基準
以下の場合は選択不要（needs_selection: false）:
- タスク説明で既に技術が明記されている（例: 「SQLAlchemyでモデルを作成」）
- プロジェクトで決定済みの技術領域のみ使用する
- 技術選定と無関係なタスク（ドキュメント作成、テスト、リファクタリング等）
- 選択の余地がない（フレームワーク指定で選択肢が1つしかない）

選択が必要な場合のみ、domain_keyを出力してください。

## 出力形式（JSON）
選択不要の場合:
{{
  "needs_selection": false,
  "decided": "決定済みの技術名（あれば）",
  "reason": "理由"
}}

選択が必要な場合:
{{
  "needs_selection": true,
  "domain_key": "利用可能な技術領域のkey"
}}
"""

        try:
            response = await self.llm.ainvoke([
                SystemMessage(content="技術選定を判断するアシスタントです。JSON形式で回答してください。"),
                HumanMessage(content=prompt)
            ])

            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            result = json.loads(content.strip())

            if not result.get("needs_selection"):
                return {
                    "needs_choice": False,
                    "decided": result.get("decided"),
                    "reason": result.get("reason", "")
                }

            # DBからstackを取得
            domain_key = result.get("domain_key")
            if not domain_key:
                return {"needs_choice": False, "decided": None, "reason": "domain_keyが指定されていません"}

            stacks = self.tech_service.get_stacks_for_domain(domain_key, self.ecosystem)
            if not stacks:
                return {"needs_choice": False, "decided": None, "reason": f"domain '{domain_key}' に選択肢がありません"}

            # domainを取得
            domain = self.tech_service.get_domain_by_key(domain_key)
            if not domain:
                return {"needs_choice": False, "decided": None, "reason": f"domain '{domain_key}' が見つかりません"}

            # 現在の選択対象domainをセッションに記録
            session.current_domain_key = domain_key

            return {
                "needs_choice": True,
                "domain_key": domain_key,
                "question": domain.decision_prompt,
                "options": [
                    {
                        "id": s.key,
                        "label": s.label,
                        "description": s.summary,
                        "pros": s.pros or [],
                        "cons": s.cons or []
                    }
                    for s in stacks
                ]
            }

        except Exception as e:
            return {"needs_choice": False, "decided": None, "reason": f"判断できませんでした: {str(e)}"}

    async def _check_step_requirements(
        self,
        step: 'ImplementationStep',
        session: 'SessionState'
    ) -> 'StepRequirements':
        """
        ステップ内の要件をチェック（概念説明・技術選定が必要かを判断）

        1回のLLMリクエストで以下を取得：
        - objective: ステップの目的
        - prerequisite: 前提概念（必要な場合）
        - tech_selection: 技術選定（必要な場合）

        Returns:
            StepRequirements オブジェクト
        """
        # 既にこのステップで選択済みの技術があれば含める
        step_choice_text = ""
        if step.step_number in session.step_choices:
            choice = session.step_choices[step.step_number]
            step_choice_text = f"\n## このステップで選択済みの技術\n- {choice.get('selected', '')}\n"

        # プロジェクトで決定済みの技術
        decided_tech_text = ""
        if session.project_implementation_overview:
            decided_tech_text = f"\n## プロジェクトで決定済みの技術\n{session.project_implementation_overview}\n"

        prompt = f"""
以下のステップを実装するにあたり、前提知識の説明と技術選定が必要かを判断してください。

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}
- カテゴリ: {self.task.category or '未分類'}

## 現在のステップ
- ステップ{step.step_number}: {step.title}
- 説明: {step.description}

## プロジェクト情報
- 技術スタック: {', '.join(self.project_context.get('tech_stack', []))}
- フレームワーク: {self.project_context.get('framework', '未設定')}
{decided_tech_text}
{step_choice_text}

## 判断基準

### 前提概念（prerequisite）
- このステップで使う概念・用語で、初心者が知らない可能性があるものがあれば提示
- 概念名と簡潔な説明（1-2文）のみ
- 既知の基本概念（変数、関数など）は不要

### 技術選定（tech_selection）
- このステップで複数の選択肢がある技術決定が必要な場合のみ
- プロジェクトや前のステップで既に決まっている場合は不要
- 選択肢は代表的なもの2-4個、それぞれ名前と簡潔な説明

## 出力形式（JSON）
{{
  "objective": "このステップで何をするか（1文）",
  "prerequisite": {{
    "needed": true/false,
    "concept": "概念名（例: DBマイグレーション）",
    "brief": "簡潔な説明（1-2文）"
  }},
  "tech_selection": {{
    "needed": true/false,
    "question": "選定の質問（例: マイグレーションツールを選びましょう）",
    "options": [
      {{"id": "tool1", "name": "ツール名", "description": "簡潔な説明"}}
    ]
  }}
}}
"""

        try:
            response = await self.llm.ainvoke([
                SystemMessage(content="ハンズオンレクチャーのアシスタントです。初心者向けに必要な説明を判断してJSON形式で回答してください。"),
                HumanMessage(content=prompt)
            ])

            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content.strip())

            # StepRequirements オブジェクトを構築
            prereq = data.get("prerequisite", {})
            tech = data.get("tech_selection", {})

            return StepRequirements(
                objective=data.get("objective", step.description),
                prerequisite_concept=prereq.get("concept") if prereq.get("needed") else None,
                prerequisite_brief=prereq.get("brief") if prereq.get("needed") else None,
                tech_selection_needed=tech.get("needed", False),
                tech_selection_question=tech.get("question") if tech.get("needed") else None,
                tech_selection_options=tech.get("options", []) if tech.get("needed") else []
            )
        except Exception:
            # エラー時はデフォルト（選定不要）
            return StepRequirements(
                objective=step.description,
                tech_selection_needed=False
            )

    async def _save_progress(self, session: SessionState, state: str = "generating") -> TaskHandsOn:
        """進捗をDBに保存（中間保存）"""
        existing = self.db.query(TaskHandsOn).filter(
            TaskHandsOn.task_id == self.task.task_id
        ).first()

        # 実装ステップをJSONに変換
        steps_data = [
            {
                "step_number": s.step_number,
                "title": s.title,
                "description": s.description,
                "content": s.content,
                "is_completed": s.is_completed,
                "user_feedback": s.user_feedback
            }
            for s in session.implementation_steps
        ]

        # ユーザーインタラクション履歴
        interactions = [
            {"type": "choice", "choice_id": k, **v}
            for k, v in session.user_choices.items()
        ]

        # 決定事項をJSONに変換
        decisions_data = [
            {
                "step_number": d.step_number,
                "description": d.description,
                "reason": d.reason
            }
            for d in session.decisions
        ]

        # 保留中の変更提案
        pending_decision_data = session.pending_decision if session.pending_decision else None

        # 保留中の入力プロンプト
        pending_input_data = None
        if session.pending_input:
            pending_input_data = {
                "prompt_id": session.pending_input.prompt_id,
                "question": session.pending_input.question,
                "placeholder": session.pending_input.placeholder,
                "options": session.pending_input.options
            }

        # 保留中の選択肢（pending_choice）
        pending_choice_data = None
        if session.pending_choice:
            pending_choice_data = {
                "choice_id": session.pending_choice.choice_id,
                "question": session.pending_choice.question,
                "options": [
                    {
                        "id": opt.id,
                        "label": opt.label,
                        "description": opt.description,
                        "pros": opt.pros,
                        "cons": opt.cons
                    }
                    for opt in session.pending_choice.options
                ],
                "allow_custom": session.pending_choice.allow_custom,
                "skip_allowed": session.pending_choice.skip_allowed,
                "research_hint": session.pending_choice.research_hint
            }

        # 確認待ち状態をpending_stateフィールドに保存
        # セッション復帰時に正確に状態を復元するため
        pending_state_data = None
        if session.pending_choice:
            pending_state_data = {
                "type": "choice",
                "state": {"choice": pending_choice_data},
                "entered_at": datetime.now().isoformat(),
                "phase": session.phase.value
            }
        elif session.pending_input:
            # ステップ完了確認か通常の入力かを判定
            pending_type = "step_confirmation" if session.phase == GenerationPhase.WAITING_STEP_COMPLETE else "input"
            pending_state_data = {
                "type": pending_type,
                "state": {"input": pending_input_data},
                "entered_at": datetime.now().isoformat(),
                "phase": session.phase.value
            }

        # ステップごとの技術選択をJSON化（キーをstrに変換）
        step_choices_data = {
            str(k): v for k, v in session.step_choices.items()
        }

        user_interactions_data = {
            "choices": interactions,
            "inputs": session.user_inputs,
            "steps": steps_data,
            "current_step": session.current_step_index,
            "phase": session.phase.value,
            "decisions": decisions_data,
            "pending_decision": pending_decision_data,
            "pending_input": pending_input_data,
            "pending_choice": pending_choice_data,  # 選択肢待ち状態も保存
            "step_choices": step_choices_data,
            "project_implementation_overview": session.project_implementation_overview
        }

        # 完了時は実装リソースサマリーを生成
        implementation_resources = None
        if state == "completed":
            implementation_resources = await self._generate_implementation_resources(session)

        if existing:
            existing.overview = session.generated_content.get("overview", "")
            existing.implementation_steps = session.generated_content.get("implementation", "")
            existing.verification = session.generated_content.get("verification", "")
            existing.technical_context = session.generated_content.get("context", "")
            existing.user_interactions = user_interactions_data
            existing.generation_mode = "interactive"
            existing.generation_state = state
            existing.session_id = session.session_id
            existing.pending_state = pending_state_data  # 確認待ち状態を保存
            existing.updated_at = datetime.now()
            if implementation_resources:
                existing.implementation_resources = implementation_resources
            self.db.commit()
            return existing
        else:
            hands_on = TaskHandsOn(
                task_id=self.task.task_id,
                overview=session.generated_content.get("overview", ""),
                implementation_steps=session.generated_content.get("implementation", ""),
                verification=session.generated_content.get("verification", ""),
                technical_context=session.generated_content.get("context", ""),
                generation_model=self.config.get("model", "gemini-2.0-flash"),
                quality_score=0.8,
                generation_mode="interactive",
                generation_state=state,
                session_id=session.session_id,
                user_interactions=user_interactions_data,
                implementation_resources=implementation_resources,
                pending_state=pending_state_data  # 確認待ち状態を保存
            )
            self.db.add(hands_on)
            self.db.commit()
            self.db.refresh(hands_on)
            return hands_on

    async def _summarize_implementation(self, predecessor_task: Dict) -> Optional[str]:
        """
        完了済み依存タスクの実装内容をサマリー

        Args:
            predecessor_task: 依存タスク情報（hands_on_contentを含む）

        Returns:
            実装サマリー（例：「POST /api/chat エンドポイント実装済み、Gemini API統合済み」）
        """
        hands_on_content = predecessor_task.get("hands_on_content")
        if not hands_on_content:
            return None

        overview = hands_on_content.get("overview", "")
        steps = hands_on_content.get("steps", [])
        impl_summary = hands_on_content.get("implementation_summary", "")

        # ステップ内容を結合
        steps_text = "\n".join([
            f"- {s.get('title', '')}: {s.get('content', '')[:300]}"
            for s in steps[:5]  # 最大5ステップ
        ])

        prompt = f"""
以下の完了済みタスクの実装内容から、「何が実装されたか」を簡潔に箇条書きでまとめてください。
特にAPIエンドポイント、コンポーネント、データ構造、外部サービス連携などを抽出してください。

## タスク
タイトル: {predecessor_task.get('title', '')}
説明: {predecessor_task.get('description', '')}

## 概要
{overview[:500]}

## 実装ステップ
{steps_text}

## 実装内容サマリー
{impl_summary[:500]}

## 出力形式
- 実装されたAPIエンドポイント（あれば）
- 実装されたコンポーネント/クラス（あれば）
- 連携した外部サービス（あれば）
- その他の実装内容

簡潔に3-5行で出力してください。
"""

        try:
            response = await self.llm.ainvoke([
                SystemMessage(content="実装内容を簡潔にまとめるアシスタントです。"),
                HumanMessage(content=prompt)
            ])
            return response.content.strip()
        except Exception as e:
            return f"サマリー生成エラー: {str(e)}"

    async def _generate_implementation_resources(self, session: SessionState) -> Dict:
        """
        タスク完了時に実装済みリソースをJSON形式で抽出

        Returns:
            {
                "apis": ["POST /api/chat", "GET /api/users/{id}"],
                "components": ["ChatComponent", "UserList"],
                "services": ["GeminiService"],
                "files": ["src/app/api/chat/route.ts"],
                "summary": "チャットAPIとGemini統合を実装"
            }
        """
        overview = session.generated_content.get("overview", "")
        implementation = session.generated_content.get("implementation", "")

        # ステップ内容を取得
        steps_text = ""
        for step in session.implementation_steps:
            if step.content:
                steps_text += f"\n### {step.title}\n{step.content[:500]}\n"

        # ユーザーの技術選択を取得（新形式: domain_key/stack_key 対応）
        choices_text = ""
        if session.user_choices:
            choices_text = "\n## 技術選択\n"
            for choice_id, choice_data in session.user_choices.items():
                if "domain_key" in choice_data and "stack_key" in choice_data:
                    # 新形式: DBプリセットからの選択
                    domain = self.tech_service.get_domain_by_key(choice_data["domain_key"])
                    domain_name = domain.name if domain else choice_data["domain_key"]
                    choices_text += f"- {domain_name}: {choice_data['stack_key']}\n"
                else:
                    # 従来形式（後方互換）
                    selected = choice_data.get("selected", "")
                    if selected:
                        choices_text += f"- {selected}\n"

        prompt = f"""
以下の完了したタスクから、実装されたリソースと技術決定をJSON形式で抽出してください。

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}

## 概要
{overview[:500]}

## 実装内容
{implementation[:1500]}

## ステップ
{steps_text[:1500]}
{choices_text}
## 出力形式（JSON）
{{
  "apis": ["POST /api/xxx", "GET /api/yyy"],  // 実装したAPIエンドポイント
  "components": ["XxxComponent"],  // 実装したReactコンポーネント等
  "services": ["XxxService"],  // 実装したサービスクラス等
  "files": ["src/xxx/yyy.ts"],  // 主要な作成・修正ファイル
  "tech_decisions": ["REST APIを使用", "TypeScriptを採用"],  // 技術決定
  "summary": "〇〇機能を実装"  // 1行サマリー
}}

**注意:**
- 存在しないものは空配列[]にする
- ファイルパスは主要なもののみ（最大5つ）
- summaryは20文字以内
"""

        try:
            response = await self.llm.ainvoke([
                SystemMessage(content="実装内容からリソースを抽出するアシスタントです。JSON形式で回答してください。"),
                HumanMessage(content=prompt)
            ])

            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            return json.loads(content.strip())
        except Exception as e:
            # エラー時は空のリソース
            return {
                "apis": [],
                "components": [],
                "services": [],
                "files": [],
                "tech_decisions": [],
                "summary": self.task.title[:20] if self.task.title else ""
            }

    async def _generate_implementation_plan(
        self,
        user_choices: Dict[str, Any],
        session: SessionState
    ) -> List[ImplementationStep]:
        """MVPアプローチで実装ステップを計画"""
        # ユーザー選択を文字列化（新形式: domain_key/stack_key 対応）
        choices_text = ""
        if user_choices:
            for choice_id, choice_data in user_choices.items():
                if "domain_key" in choice_data and "stack_key" in choice_data:
                    # 新形式: DBプリセットからの選択
                    domain = self.tech_service.get_domain_by_key(choice_data["domain_key"])
                    domain_name = domain.name if domain else choice_data["domain_key"]
                    choices_text += f"- {domain_name}: {choice_data['stack_key']}\n"
                else:
                    # 従来形式（後方互換）
                    choices_text += f"- 選択: {choice_data.get('selected', 'なし')}\n"

        # プロジェクト全体で決定済みの技術（DBから取得）
        decided_tech_section = ""
        if self.decided_domains:
            decided_tech_section = "\n## プロジェクトで決定済みの技術（必ず使用すること）\n"
            for domain_key, stack_key in self.decided_domains.items():
                domain = self.tech_service.get_domain_by_key(domain_key)
                domain_name = domain.name if domain else domain_key
                decided_tech_section += f"- {domain_name}: {stack_key}\n"

        # 依存タスクの実装サマリーを取得（直接依存のみ詳細）
        dependency_summary = ""
        if session.predecessor_tasks:
            completed_deps = [
                dep for dep in session.predecessor_tasks
                if dep.hands_on_status == "completed" and dep.implementation_summary
            ]
            if completed_deps:
                dependency_summary = "\n## 直接依存タスクで実装済みの内容（必ず利用すること）\n"
                for dep in completed_deps:
                    dependency_summary += f"\n### {dep.title}\n{dep.implementation_summary}\n"

        # プロジェクト全体の実装概要（高レベル、重複回避用）
        project_overview_section = ""
        if session.project_implementation_overview:
            project_overview_section = f"""
## プロジェクト内で実装済みの機能（重複実装を避けること）
以下の機能は既に他のタスクで実装済みです。再実装せず、既存のものを利用してください。

{session.project_implementation_overview}
"""

        # モック実装モードの場合の追加指示
        mock_instruction = ""
        if session.dependency_decision == "mock":
            incomplete_deps = [
                dep for dep in session.predecessor_tasks
                if dep.hands_on_status != "completed"
            ]
            if incomplete_deps:
                dep_titles = ", ".join([dep.title for dep in incomplete_deps])
                mock_instruction = f"""
## モック実装について
依存タスク「{dep_titles}」が未完了のため、モック実装で進めます。
- 依存タスクとの接続部分はインターフェースを明確に定義
- モックデータやスタブ関数を使用
- 後で結合しやすいように設計
"""

        # 後続タスク情報を取得（スコープ判断用）
        successor_tasks_text = ""
        if session.successor_tasks:
            successor_tasks_text = "\n## このタスクの後に実装予定のタスク（これらはこのタスクのスコープ外）\n"
            for st in session.successor_tasks:
                successor_tasks_text += f"- {st.title}: {st.description[:100] if st.description else 'なし'}\n"

        prompt = f"""
以下のタスクをMVPアプローチで段階的に実装する計画を立ててください。
{dependency_summary}
{project_overview_section}

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}
- カテゴリ: {self.task.category or '未分類'}
{choices_text}
{decided_tech_section}
{successor_tasks_text}

## プロジェクト情報
- 技術スタック: {', '.join(self.project_context.get('tech_stack', []))}
- フレームワーク: {self.project_context.get('framework', '未設定')}
{mock_instruction}

## 重要：スコープの制約
**このタスクのスコープ（カテゴリ: {self.task.category or '未分類'}）内のみで計画を立ててください。**

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

        response = await self.llm.ainvoke([
            SystemMessage(content="あなたはMVP開発のエキスパートです。JSON形式で回答してください。"),
            HumanMessage(content=prompt)
        ])

        try:
            content = response.content
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

    async def _generate_step_content(
        self,
        step: ImplementationStep,
        user_choices: Dict[str, Any],
        previous_steps: List[ImplementationStep],
        decisions: List[Decision] = None,
        session: SessionState = None
    ) -> AsyncGenerator[str, None]:
        """ステップの実装内容をストリーミング生成"""
        # タスク全体の選択（新形式: domain_key/stack_key 対応）
        choices_text = ""
        if user_choices:
            for choice_id, choice_data in user_choices.items():
                if "domain_key" in choice_data and "stack_key" in choice_data:
                    # 新形式: DBプリセットからの選択
                    domain = self.tech_service.get_domain_by_key(choice_data["domain_key"])
                    domain_name = domain.name if domain else choice_data["domain_key"]
                    choices_text += f"- {domain_name}: {choice_data['stack_key']}\n"
                else:
                    # 従来形式（後方互換）
                    choices_text += f"- 選択: {choice_data.get('selected', 'なし')}\n"

        # このステップで選択した技術
        step_choice_text = ""
        if session and step.step_number in session.step_choices:
            step_choice = session.step_choices[step.step_number]
            if "domain_key" in step_choice and "stack_key" in step_choice:
                # 新形式
                domain = self.tech_service.get_domain_by_key(step_choice["domain_key"])
                domain_name = domain.name if domain else step_choice["domain_key"]
                step_choice_text = f"\n## このステップで選択した技術（必ずこれを使って実装すること）\n- **{domain_name}: {step_choice['stack_key']}**\n"
            else:
                # 従来形式
                step_choice_text = f"\n## このステップで選択した技術（必ずこれを使って実装すること）\n- **{step_choice.get('selected', '')}**\n"

        prev_steps_text = ""
        if previous_steps:
            prev_steps_text = "\n## 完了済みステップ\n"
            for ps in previous_steps:
                prev_steps_text += f"- ステップ{ps.step_number}: {ps.title} ✓\n"

        # ユーザーが採用した決定事項
        decisions_context = ""
        if decisions:
            decisions_context = "\n## ユーザーが採用した決定事項（必ず反映してください）\n"
            for d in decisions:
                decisions_context += f"- **{d.description}**（ステップ{d.step_number}で決定）\n"

        # プロジェクト内で実装済みの機能
        project_overview_context = ""
        if session and session.project_implementation_overview:
            project_overview_context = f"""
## プロジェクト内で実装済みの機能（再実装しないこと）
{session.project_implementation_overview}
"""

        # プロジェクト全体で決定済みの技術（DBから取得）
        decided_tech_context = ""
        if self.decided_domains:
            decided_tech_context = "\n## プロジェクトで決定済みの技術（必ず使用すること）\n"
            for domain_key, stack_key in self.decided_domains.items():
                domain = self.tech_service.get_domain_by_key(domain_key)
                domain_name = domain.name if domain else domain_key
                decided_tech_context += f"- {domain_name}: {stack_key}\n"

        prompt = f"""
以下のステップの詳細な実装手順を説明してください。
{project_overview_context}

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}
- カテゴリ: {self.task.category or '未分類'}
{choices_text}
{decided_tech_context}
{step_choice_text}
{prev_steps_text}
{decisions_context}

## 現在のステップ
- ステップ{step.step_number}: {step.title}
- 目的: {step.description}

## プロジェクト情報
- 技術スタック: {', '.join(self.project_context.get('tech_stack', []))}
- フレームワーク: {self.project_context.get('framework', '未設定')}
- ディレクトリ構造: {self.project_context.get('directory_info', '未設定')[:500]}

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

        async for chunk in self.llm.astream([
            SystemMessage(content="あなたは丁寧な開発ガイドを作成するエキスパートです。ユーザーが採用した決定事項（言語、ライブラリ等）は必ず反映してください。"),
            HumanMessage(content=prompt)
        ]):
            if chunk.content:
                yield chunk.content

    async def generate_stream(
        self,
        session: SessionState
    ) -> AsyncGenerator[Dict, None]:
        """
        ストリーミングでハンズオンを生成

        Yields:
            SSEイベント辞書
        """
        try:
            # Phase 0: 依存タスクチェック
            if session.phase == GenerationPhase.DEPENDENCY_CHECK:
                # 依存タスク情報をセッションに設定
                if self.dependency_context:
                    predecessor_tasks = self.dependency_context.get("predecessor_tasks", [])
                    has_incomplete = self.dependency_context.get("has_incomplete_predecessors", False)

                    # プロジェクト全体の実装概要をセッションに設定
                    session.project_implementation_overview = self.dependency_context.get(
                        "project_implementation_overview", ""
                    )

                    # 依存タスク情報をセッションに保存（predecessors）
                    for pt in predecessor_tasks:
                        session.predecessor_tasks.append(DependencyTaskInfo(
                            task_id=pt["task_id"],
                            title=pt["title"],
                            description=pt["description"],
                            hands_on_status=pt["hands_on_status"],
                            implementation_summary=None  # 後でサマリー生成
                        ))

                    # 後続タスク情報をセッションに保存（successors: スコープ判断用）
                    successor_tasks = self.dependency_context.get("successor_tasks", [])
                    for st in successor_tasks:
                        session.successor_tasks.append(DependencyTaskInfo(
                            task_id=st["task_id"],
                            title=st["title"],
                            description=st.get("description", ""),
                            hands_on_status="not_started",  # 後続タスクのステータスは参照しない
                            implementation_summary=None
                        ))

                    # 未完了の依存タスクがある場合はユーザーに確認
                    if has_incomplete:
                        incomplete_tasks = [
                            pt for pt in predecessor_tasks
                            if pt["hands_on_status"] != "completed"
                        ]
                        task_list = "\n".join([f"- {pt['title']}" for pt in incomplete_tasks])

                        yield {"type": "section_start", "section": "dependency_check"}
                        warning_text = f"""⚠️ **未完了の依存タスクがあります**

このタスクは以下のタスクに依存していますが、まだ完了していません：

{task_list}

どのように進めますか？
"""
                        for chunk in self._chunk_text(warning_text):
                            yield {"type": "chunk", "content": chunk}
                            await asyncio.sleep(0.02)

                        yield {"type": "section_complete", "section": "dependency_check"}

                        # ユーザーに選択を求める
                        session.phase = GenerationPhase.WAITING_DEPENDENCY_DECISION
                        session.pending_input = InputPrompt(
                            prompt_id="dependency_decision",
                            question="依存タスクが未完了です。どのように進めますか？",
                            options=["そのまま進める", "モックで進める（後で結合）", "先に依存タスクを完了させる"]
                        )
                        await self._save_progress(session, "waiting_input")
                        yield {
                            "type": "step_confirmation_required",
                            "prompt": {
                                "prompt_id": session.pending_input.prompt_id,
                                "question": session.pending_input.question,
                                "options": session.pending_input.options
                            }
                        }
                        return

                    # 完了済みの依存タスクがある場合はサマリーを生成
                    completed_tasks = [
                        pt for pt in predecessor_tasks
                        if pt["hands_on_status"] == "completed" and pt.get("hands_on_content")
                    ]
                    if completed_tasks:
                        yield {"type": "section_start", "section": "dependency_summary"}
                        summary_text = "📋 **直接依存タスクの実装状況**\n\n"
                        for pt in completed_tasks:
                            summary_text += f"**{pt['title']}** は完了済みです。\n"
                            # LLMでサマリーを生成
                            impl_summary = await self._summarize_implementation(pt)
                            if impl_summary:
                                summary_text += f"{impl_summary}\n\n"
                                # セッションに保存
                                for dep_info in session.predecessor_tasks:
                                    if dep_info.task_id == pt["task_id"]:
                                        dep_info.implementation_summary = impl_summary
                                        break

                        for chunk in self._chunk_text(summary_text):
                            yield {"type": "chunk", "content": chunk}
                            await asyncio.sleep(0.02)
                        yield {"type": "section_complete", "section": "dependency_summary"}
                        session.generated_content["dependency_summary"] = summary_text

                    # プロジェクト全体の実装概要がある場合は表示
                    if session.project_implementation_overview:
                        yield {"type": "section_start", "section": "project_overview"}
                        project_text = "📦 **プロジェクト内の実装済み機能**\n\n以下の機能は既に他のタスクで実装済みです。重複して実装しないでください。\n\n"
                        project_text += session.project_implementation_overview
                        project_text += "\n"

                        for chunk in self._chunk_text(project_text):
                            yield {"type": "chunk", "content": chunk}
                            await asyncio.sleep(0.02)
                        yield {"type": "section_complete", "section": "project_overview"}
                        session.generated_content["project_overview"] = project_text

                # 依存タスクがない、または処理完了したらCONTEXTへ
                session.phase = GenerationPhase.CONTEXT

            # Phase 1: コンテキスト（タスクの位置づけ）
            if session.phase == GenerationPhase.CONTEXT:
                position = self._get_task_position()

                yield {
                    "type": "context",
                    "position": position["position_description"],
                    "dependencies": [t["title"] for t in position["previous_tasks"]],
                    "dependents": [t["title"] for t in position["next_tasks"]]
                }

                # セクション開始を通知
                yield {"type": "section_start", "section": "context"}

                context_text = self._build_context_text(position)
                for chunk in self._chunk_text(context_text):
                    yield {"type": "chunk", "content": chunk}
                    await asyncio.sleep(0.02)

                session.generated_content["context"] = context_text
                yield {"type": "section_complete", "section": "context"}
                session.phase = GenerationPhase.OVERVIEW

                # 中間保存
                await self._save_progress(session, "generating")
                yield {"type": "progress_saved", "phase": "context"}

            # Phase 2: 概要生成（概要生成のみ、技術選定は別フェーズ）
            if session.phase == GenerationPhase.OVERVIEW:
                # 概要が未生成の場合のみ生成
                if not session.generated_content.get("overview"):
                    yield {"type": "section_start", "section": "overview"}

                    async for chunk in self._stream_overview():
                        yield {"type": "chunk", "content": chunk}
                        session.generated_content["overview"] = session.generated_content.get("overview", "") + chunk

                    yield {"type": "section_complete", "section": "overview"}

                    # 中間保存
                    await self._save_progress(session, "generating")
                    yield {"type": "progress_saved", "phase": "overview"}

                # 次のフェーズへ
                session.phase = GenerationPhase.TECH_CHECK

            # Phase 2.5: 技術選定判断（独立フェーズ）
            if session.phase == GenerationPhase.TECH_CHECK:
                # 既に選択済みなら実装計画へ
                if session.user_choices:
                    session.phase = GenerationPhase.IMPLEMENTATION_PLANNING
                else:
                    force_choice = session.generated_content.get("force_choice") == "true"
                    if force_choice:
                        del session.generated_content["force_choice"]  # フラグをクリア

                    tech_check = await self._check_tech_selection(session, force_choice=force_choice)

                    if tech_check.get("needs_choice"):
                        # 選択肢を提示
                        choice_id = f"choice_{uuid.uuid4().hex[:8]}"
                        options = tech_check.get("options", [])

                        session.pending_choice = ChoiceRequest(
                            choice_id=choice_id,
                            question=tech_check.get("question", "技術を選定しましょう"),
                            options=[
                                ChoiceOption(
                                    id=opt.get("id", f"opt_{i}"),
                                    label=opt.get("label", ""),
                                    description=opt.get("description", ""),
                                    pros=opt.get("pros", []),
                                    cons=opt.get("cons", [])
                                )
                                for i, opt in enumerate(options)
                            ],
                            allow_custom=True,
                            skip_allowed=True
                        )
                        session.phase = GenerationPhase.CHOICE_REQUIRED

                        await self._save_progress(session, "waiting_input")

                        yield {
                            "type": "choice_required",
                            "choice": {
                                "choice_id": choice_id,
                                "question": tech_check.get("question"),
                                "options": options,
                                "allow_custom": True,
                                "skip_allowed": True
                            }
                        }
                        return
                    elif tech_check.get("decided"):
                        # 既に決まっている場合は確認を求める
                        decided = tech_check.get("decided")
                        reason = tech_check.get("reason", "")

                        yield {"type": "chunk", "content": f"\n\n**技術選定**: {decided}\n{reason}\n\n"}

                        # 確認を求める
                        session.pending_input = InputPrompt(
                            prompt_id="confirm_auto_decided",
                            question=f"{decided}で進めてよろしいですか？",
                            options=["OK", "別の選択肢を検討"]
                        )
                        session.phase = GenerationPhase.WAITING_CHOICE_CONFIRM

                        # 一時的に記録（確認後に正式記録）
                        session.user_choices["auto_decided"] = {
                            "selected": decided,
                            "note": reason
                        }

                        await self._save_progress(session, "waiting_input")

                        yield {
                            "type": "user_input_required",
                            "prompt": {
                                "prompt_id": "confirm_auto_decided",
                                "question": f"{decided}で進めてよろしいですか？",
                                "options": ["OK", "別の選択肢を検討"]
                            }
                        }
                        return
                    else:
                        # 技術選定不要の場合は実装計画へ
                        session.phase = GenerationPhase.IMPLEMENTATION_PLANNING

            # Phase 3: 実装計画
            if session.phase == GenerationPhase.IMPLEMENTATION_PLANNING:
                yield {"type": "section_start", "section": "planning"}
                yield {"type": "chunk", "content": "\n\n### 実装計画\n\nMVPアプローチで段階的に実装していきます。\n\n"}

                # ステップを計画（依存タスク情報も考慮）
                session.implementation_steps = await self._generate_implementation_plan(session.user_choices, session)

                # ステップ一覧を表示
                steps_overview = ""
                for step in session.implementation_steps:
                    steps_overview += f"**ステップ{step.step_number}**: {step.title}\n"
                    steps_overview += f"  - {step.description}\n\n"

                for chunk in self._chunk_text(steps_overview):
                    yield {"type": "chunk", "content": chunk}
                    await asyncio.sleep(0.02)

                yield {"type": "section_complete", "section": "planning"}

                # 中間保存
                await self._save_progress(session, "generating")

                session.current_step_index = 0
                session.phase = GenerationPhase.IMPLEMENTATION_STEP

            # Phase 4: 実装ステップ（ステップごとに生成→確認待ち）
            if session.phase == GenerationPhase.IMPLEMENTATION_STEP:
                if session.current_step_index < len(session.implementation_steps):
                    current_step = session.implementation_steps[session.current_step_index]
                    previous_steps = session.implementation_steps[:session.current_step_index]

                    yield {
                        "type": "step_start",
                        "step_number": current_step.step_number,
                        "step_title": current_step.title,
                        "total_steps": len(session.implementation_steps)
                    }

                    # セクション開始を通知
                    section_name = f"step_{current_step.step_number}"
                    yield {"type": "section_start", "section": section_name}

                    # ステップ内の要件をチェック（概念説明・技術選定が必要か）
                    requirements = await self._check_step_requirements(current_step, session)
                    session.current_step_requirements = requirements

                    # 目的を出力
                    yield {"type": "chunk", "content": f"### ステップ{current_step.step_number}: {current_step.title}\n\n"}
                    yield {"type": "chunk", "content": f"**目的**: {requirements.objective}\n\n"}

                    # 前提概念があれば説明
                    if requirements.prerequisite_concept:
                        yield {"type": "chunk", "content": f"**{requirements.prerequisite_concept}とは**: {requirements.prerequisite_brief}\n\n"}

                    # 技術選定が必要な場合
                    if requirements.tech_selection_needed and requirements.tech_selection_options:
                        # このステップで既に選択済みでなければ選択肢を提示
                        if current_step.step_number not in session.step_choices:
                            yield {"type": "section_complete", "section": section_name}

                            # 選択肢を提示
                            choice_id = f"step_{current_step.step_number}_tech"
                            session.pending_choice = ChoiceRequest(
                                choice_id=choice_id,
                                question=requirements.tech_selection_question or "技術を選択してください",
                                options=[
                                    ChoiceOption(
                                        id=opt.get("id", f"opt_{i}"),
                                        label=opt.get("name", ""),
                                        description=opt.get("description", ""),
                                        pros=[],
                                        cons=[]
                                    )
                                    for i, opt in enumerate(requirements.tech_selection_options)
                                ],
                                allow_custom=True,
                                skip_allowed=False
                            )
                            session.phase = GenerationPhase.WAITING_STEP_CHOICE

                            await self._save_progress(session, "waiting_input")

                            yield {
                                "type": "step_choice_required",
                                "step_number": current_step.step_number,
                                "choice": {
                                    "choice_id": choice_id,
                                    "question": requirements.tech_selection_question,
                                    "options": [
                                        {"id": opt.get("id", f"opt_{i}"), "name": opt.get("name", ""), "description": opt.get("description", "")}
                                        for i, opt in enumerate(requirements.tech_selection_options)
                                    ],
                                    "allow_custom": True
                                }
                            }
                            return

                    # 技術選定不要 or 選択済み → 実装内容を生成
                    step_content = f"### ステップ{current_step.step_number}: {current_step.title}\n\n"
                    step_content += f"**目的**: {requirements.objective}\n\n"
                    if requirements.prerequisite_concept:
                        step_content += f"**{requirements.prerequisite_concept}とは**: {requirements.prerequisite_brief}\n\n"

                    # 選択済みの技術があれば表示
                    if current_step.step_number in session.step_choices:
                        choice = session.step_choices[current_step.step_number]
                        yield {"type": "chunk", "content": f"**選択した技術**: {choice.get('selected', '')}\n\n"}
                        step_content += f"**選択した技術**: {choice.get('selected', '')}\n\n"

                    yield {"type": "chunk", "content": "---\n\n"}
                    step_content += "---\n\n"

                    # 実装手順を生成
                    async for chunk in self._generate_step_content(
                        current_step,
                        session.user_choices,
                        previous_steps,
                        session.decisions,
                        session
                    ):
                        yield {"type": "chunk", "content": chunk}
                        step_content += chunk

                    current_step.content = step_content

                    # 実装内容を累積
                    session.generated_content["implementation"] = session.generated_content.get("implementation", "") + "\n\n" + step_content

                    yield {"type": "section_complete", "section": section_name}
                    yield {"type": "step_complete", "step_number": current_step.step_number}

                    # ユーザー確認待ち状態を設定
                    session.phase = GenerationPhase.WAITING_STEP_COMPLETE
                    session.pending_input = InputPrompt(
                        prompt_id=f"step_{current_step.step_number}_complete",
                        question=f"ステップ{current_step.step_number}「{current_step.title}」は完了しましたか？",
                        placeholder="できた / 質問がある",
                        options=["できた", "質問がある", "スキップ"]
                    )

                    # pending_inputを設定した後に保存
                    await self._save_progress(session, "waiting_input")
                    yield {"type": "progress_saved", "phase": f"step_{current_step.step_number}"}

                    yield {
                        "type": "step_confirmation_required",
                        "prompt": {
                            "prompt_id": session.pending_input.prompt_id,
                            "question": session.pending_input.question,
                            "options": session.pending_input.options
                        }
                    }
                    return
                else:
                    # 全ステップ完了
                    session.phase = GenerationPhase.VERIFICATION

            # Phase 5: 動作確認
            if session.phase == GenerationPhase.VERIFICATION:
                yield {"type": "section_start", "section": "verification"}

                async for chunk in self._stream_verification():
                    yield {"type": "chunk", "content": chunk}
                    session.generated_content["verification"] = session.generated_content.get("verification", "") + chunk

                yield {"type": "section_complete", "section": "verification"}

                # 中間保存
                await self._save_progress(session, "generating")

                session.phase = GenerationPhase.COMPLETE

            # Phase 6: 完了
            if session.phase == GenerationPhase.COMPLETE:
                hands_on = await self._save_progress(session, "completed")

                yield {
                    "type": "done",
                    "hands_on_id": str(hands_on.hands_on_id),
                    "session_id": session.session_id
                }

        except Exception as e:
            # エラー時も進捗を保存
            try:
                await self._save_progress(session, "generating")
            except:
                pass
            yield {"type": "error", "message": str(e)}

    def _build_context_text(self, position: Dict) -> str:
        """コンテキスト説明テキストを構築"""
        parts = [f"## {self.task.title}\n\n"]

        if self.task.description:
            parts.append(f"{self.task.description}\n\n")

        parts.append(f"### タスクの位置づけ\n\n")
        parts.append(f"{position['position_description']}\n\n")

        if position["previous_tasks"]:
            parts.append("**前提となるタスク:**\n\n")
            for task in position["previous_tasks"][:3]:
                parts.append(f"- {task['title']}\n")
            parts.append("\n")

        if position["next_tasks"]:
            parts.append("**このタスク完了後に実装できるタスク:**\n\n")
            for task in position["next_tasks"][:3]:
                parts.append(f"- {task['title']}\n")
            parts.append("\n")

        return "".join(parts)

    def _chunk_text(self, text: str, chunk_size: int = 5) -> List[str]:
        """テキストをチャンクに分割（ストリーミング用）"""
        words = list(text)
        return [
            "".join(words[i:i + chunk_size])
            for i in range(0, len(words), chunk_size)
        ]

    async def _stream_overview(self) -> AsyncGenerator[str, None]:
        """概要をストリーミング生成"""
        prompt = f"""
以下のタスクの概要を説明してください。
このタスクで何を実装するか、なぜ必要かを簡潔に説明してください。

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}
- カテゴリ: {self.task.category or '未分類'}
- 優先度: {self.task.priority or 'Must'}

## プロジェクト情報
- 技術スタック: {', '.join(self.project_context.get('tech_stack', []))}
- フレームワーク: {self.project_context.get('framework', '未設定')}

## 出力形式
Markdown形式で、200-300文字程度で説明してください。

**重要な書式ルール:**
- 段落間には必ず空行を入れる
- 見出し（##, ###）の前後には空行を入れる
- 箇条書きの前後には空行を入れる
"""

        async for chunk in self.llm.astream([
            SystemMessage(content="あなたは開発ガイドを作成するエキスパートです。"),
            HumanMessage(content=prompt)
        ]):
            if chunk.content:
                yield chunk.content

    async def _stream_verification(self) -> AsyncGenerator[str, None]:
        """動作確認手順をストリーミング生成"""
        prompt = f"""
以下のタスク全体の最終動作確認方法を説明してください。

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}

## 出力形式
Markdown形式で、以下の構成で説明してください：

### 最終動作確認

1. 〇〇を確認
2. 〇〇を実行
3. 期待される結果: 〇〇

### よくあるエラーと対処法

- **エラー1**: 〇〇

  - 原因: 〇〇
  - 対処法: 〇〇

**重要な書式ルール:**
- 各セクション・段落の間には必ず空行を入れる
- 見出し（###）の前後には空行を入れる
- 箇条書きの前後には空行を入れる
"""

        async for chunk in self.llm.astream([
            SystemMessage(content="あなたは開発ガイドを作成するエキスパートです。"),
            HumanMessage(content=prompt)
        ]):
            if chunk.content:
                yield chunk.content

    async def _generate_pros_cons_analysis(
        self,
        choice_type: str,
        user_choice: str,
        user_note: Optional[str] = None
    ) -> str:
        """ユーザーの選択に対するメリデメ分析を生成"""
        prompt = f"""
ユーザーが以下の選択をしました。メリット・デメリットを簡潔に分析してください。

## 選択内容
- 選択: {user_choice}
- ユーザーのメモ: {user_note or 'なし'}

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}

## プロジェクト情報
- 技術スタック: {', '.join(self.project_context.get('tech_stack', []))}

## 出力形式
以下の形式で、簡潔に（全体で200文字程度）分析してください：

**{user_choice}の特徴:**

✓ メリット1
✓ メリット2

△ 注意点1
△ 注意点2

この選択で進めますか？
"""

        response = await self.llm.ainvoke([
            SystemMessage(content="あなたは技術選定のアドバイザーです。簡潔に分析してください。"),
            HumanMessage(content=prompt)
        ])

        return response.content

    async def handle_user_response(
        self,
        session: SessionState,
        response_type: str,
        choice_id: Optional[str] = None,
        selected: Optional[str] = None,
        user_input: Optional[str] = None,
        user_note: Optional[str] = None
    ) -> AsyncGenerator[Dict, None]:
        """ユーザーの応答を処理して生成を継続"""
        session.updated_at = datetime.now()

        # ユーザーの応答をイベントとして通知
        yield {
            "type": "user_response",
            "response_type": response_type,
            "choice_id": choice_id,
            "selected": selected,
            "user_input": user_input,
            "user_note": user_note
        }

        if response_type == "choice":
            # ステップ内技術選定の場合
            if session.phase == GenerationPhase.WAITING_STEP_CHOICE:
                current_step = session.implementation_steps[session.current_step_index]

                # ステップごとの選択を記録
                session.step_choices[current_step.step_number] = {
                    "selected": selected or user_input,
                    "note": user_note
                }

                # 全体の user_choices にも記録（後の参照用）
                session.user_choices[choice_id] = {
                    "selected": selected or user_input,
                    "note": user_note
                }

                session.pending_choice = None
                session.phase = GenerationPhase.IMPLEMENTATION_STEP

                yield {"type": "chunk", "content": f"\n\n**選択**: {selected or user_input}\n\n"}

                await self._save_progress(session, "generating")

                # 生成を継続（実装内容の生成へ）
                async for event in self.generate_stream(session):
                    yield event
                return

            # タスク全体の技術選定の場合
            # 選択を記録（domain_keyがある場合は新形式）
            if session.current_domain_key:
                session.user_choices[choice_id] = {
                    "domain_key": session.current_domain_key,
                    "stack_key": selected or user_input
                }
                # 決定済みdomainをキャッシュに追加
                self.decided_domains[session.current_domain_key] = selected or user_input
            else:
                # 従来形式（後方互換）
                session.user_choices[choice_id] = {
                    "selected": selected or user_input,
                    "note": user_note
                }

            # メリデメ分析を生成
            if session.pending_choice:
                analysis = await self._generate_pros_cons_analysis(
                    session.pending_choice.choice_id,
                    selected or user_input,
                    user_note
                )

                yield {"type": "section_start", "section": "analysis"}
                for chunk in self._chunk_text(analysis):
                    yield {"type": "chunk", "content": chunk}
                    await asyncio.sleep(0.02)
                yield {"type": "section_complete", "section": "analysis"}

                # 確認を求める
                session.pending_input = InputPrompt(
                    prompt_id="confirm_choice",
                    question="この選択で進めますか？",
                    options=["OK", "別の選択肢を検討"]
                )
                session.phase = GenerationPhase.WAITING_CHOICE_CONFIRM

                # pending_inputを設定した後に保存
                await self._save_progress(session, "waiting_input")

                yield {
                    "type": "user_input_required",
                    "prompt": {
                        "prompt_id": "confirm_choice",
                        "question": "この選択で進めますか？",
                        "options": ["OK", "別の選択肢を検討"]
                    }
                }
                return

        elif response_type == "input":
            # 依存タスク対応方針への応答
            if session.phase == GenerationPhase.WAITING_DEPENDENCY_DECISION:
                session.pending_input = None
                if user_input == "そのまま進める":
                    session.dependency_decision = "proceed"
                    yield {"type": "chunk", "content": "\n\n依存タスクを無視して進めます。\n\n"}
                elif user_input == "モックで進める（後で結合）":
                    session.dependency_decision = "mock"
                    yield {"type": "chunk", "content": "\n\nモック実装で進めます。後で依存タスクと結合してください。\n\n"}
                elif user_input == "先に依存タスクを完了させる":
                    session.dependency_decision = "redirect"
                    # 依存タスクへのリダイレクトを通知
                    incomplete_tasks = [
                        pt for pt in session.predecessor_tasks
                        if pt.hands_on_status != "completed"
                    ]
                    if incomplete_tasks:
                        yield {
                            "type": "redirect_to_task",
                            "task_id": incomplete_tasks[0].task_id,
                            "task_title": incomplete_tasks[0].title,
                            "message": f"先に「{incomplete_tasks[0].title}」を完了させてください。"
                        }
                    return
                else:
                    session.dependency_decision = "proceed"

                session.phase = GenerationPhase.CONTEXT
                await self._save_progress(session, "generating")

            # 選択確認への応答
            elif session.phase == GenerationPhase.WAITING_CHOICE_CONFIRM:
                if user_input and user_input.upper() in ["OK", "はい", "YES", "進める"]:
                    session.phase = GenerationPhase.IMPLEMENTATION_PLANNING
                    session.pending_choice = None
                    session.pending_input = None
                else:
                    # 別の選択肢を検討 → TECH_CHECKに戻して強制的に選択肢を提示
                    # OVERVIEWは生成済みなのでスキップされる
                    session.phase = GenerationPhase.TECH_CHECK
                    session.pending_input = None
                    session.user_choices = {}
                    # 選択肢を強制生成するフラグをセット
                    session.generated_content["force_choice"] = "true"

            # ステップ完了確認への応答
            elif session.phase == GenerationPhase.WAITING_STEP_COMPLETE:
                current_step = session.implementation_steps[session.current_step_index]

                if user_input in ["できた", "完了", "done"]:
                    current_step.is_completed = True
                    current_step.user_feedback = "completed"
                    session.current_step_index += 1
                    session.phase = GenerationPhase.IMPLEMENTATION_STEP
                    session.pending_input = None

                elif user_input == "スキップ":
                    current_step.is_completed = True
                    current_step.user_feedback = "skipped"
                    session.current_step_index += 1
                    session.phase = GenerationPhase.IMPLEMENTATION_STEP
                    session.pending_input = None

                elif user_input in ["質問がある", "まだ質問がある"]:
                    # 質問入力を求める
                    session.pending_input = InputPrompt(
                        prompt_id=f"question_step_{current_step.step_number}",
                        question=f"ステップ{current_step.step_number}「{current_step.title}」について質問してください",
                        placeholder="わからないことや詰まっている点を入力..."
                    )
                    # pending_inputを設定した後に保存
                    await self._save_progress(session, "waiting_input")
                    yield {
                        "type": "user_input_required",
                        "prompt": {
                            "prompt_id": session.pending_input.prompt_id,
                            "question": session.pending_input.question,
                            "placeholder": session.pending_input.placeholder
                        }
                    }
                    return

                elif user_input == "採用する" and session.pending_decision:
                    # 変更提案を採用
                    new_decision = Decision(
                        step_number=current_step.step_number,
                        description=session.pending_decision["proposal"],
                        reason=session.pending_decision["reason"]
                    )
                    session.decisions.append(new_decision)
                    yield {"type": "chunk", "content": f"\n\n✓ **決定事項として保存しました:** {session.pending_decision['proposal']}\n\n"}
                    session.pending_decision = None

                    # 決定を反映してステップ内容を再生成
                    yield {"type": "chunk", "content": f"---\n\n**決定を反映して、ステップ{current_step.step_number}の内容を更新します...**\n\n"}
                    yield {"type": "section_start", "section": f"step_{current_step.step_number}_updated"}

                    previous_steps = [s for s in session.implementation_steps[:session.current_step_index]]
                    updated_content = ""
                    async for chunk in self._generate_step_content(
                        current_step,
                        session.user_choices,
                        previous_steps,
                        session.decisions,
                        session
                    ):
                        yield {"type": "chunk", "content": chunk}
                        updated_content += chunk

                    current_step.content = updated_content
                    yield {"type": "section_complete", "section": f"step_{current_step.step_number}_updated"}

                    # 再度ステップ確認を求める
                    session.pending_input = InputPrompt(
                        prompt_id=f"step_{current_step.step_number}_complete",
                        question=f"ステップ{current_step.step_number}「{current_step.title}」の更新内容を確認してください。完了しましたか？",
                        options=["できた", "まだ質問がある", "スキップ"]
                    )
                    # pending_inputを設定した後に保存
                    await self._save_progress(session, "waiting_input")
                    yield {
                        "type": "step_confirmation_required",
                        "prompt": {
                            "prompt_id": session.pending_input.prompt_id,
                            "question": session.pending_input.question,
                            "options": session.pending_input.options
                        }
                    }
                    return

                elif user_input == "採用しない" and session.pending_decision:
                    # 変更提案を採用しない
                    yield {"type": "chunk", "content": "\n\n現状のまま進めます。\n\n"}
                    session.pending_decision = None

                    # 再度ステップ確認を求める
                    session.pending_input = InputPrompt(
                        prompt_id=f"step_{current_step.step_number}_complete",
                        question=f"ステップ{current_step.step_number}「{current_step.title}」は完了しましたか？",
                        options=["できた", "まだ質問がある", "スキップ"]
                    )
                    # pending_inputを設定した後に保存
                    await self._save_progress(session, "waiting_input")
                    yield {
                        "type": "step_confirmation_required",
                        "prompt": {
                            "prompt_id": session.pending_input.prompt_id,
                            "question": session.pending_input.question,
                            "options": session.pending_input.options
                        }
                    }
                    return

                else:
                    # その他の入力は質問/提案として分析
                    current_step.user_feedback = user_input

                    # 変更提案かどうかを分析
                    decision_proposal = await self._analyze_question_for_decision(user_input, current_step)

                    if decision_proposal:
                        # 変更提案が検出された → メリデメ分析してから採用確認
                        session.pending_decision = decision_proposal
                        yield {"type": "section_start", "section": "proposal"}
                        yield {"type": "chunk", "content": f"\n\n**変更提案を検出しました:**\n\n"}
                        yield {"type": "chunk", "content": f"📝 **{decision_proposal['proposal']}**\n\n"}

                        # メリデメ分析をストリーミング
                        yield {"type": "chunk", "content": "---\n\n"}
                        async for chunk in self._stream_pros_cons_analysis(
                            decision_proposal['proposal'],
                            current_step
                        ):
                            yield {"type": "chunk", "content": chunk}

                        yield {"type": "chunk", "content": "\n\n---\n\n"}
                        yield {"type": "section_complete", "section": "proposal"}

                        session.pending_input = InputPrompt(
                            prompt_id=f"decision_confirm_{current_step.step_number}",
                            question="この変更を採用しますか？",
                            options=["採用する", "採用しない"]
                        )
                        # pending_inputを設定した後に保存
                        await self._save_progress(session, "waiting_input")
                        yield {
                            "type": "user_input_required",
                            "prompt": {
                                "prompt_id": session.pending_input.prompt_id,
                                "question": session.pending_input.question,
                                "options": session.pending_input.options
                            }
                        }
                        return
                    else:
                        # 単純な質問 → 回答のみ
                        yield {"type": "section_start", "section": "answer"}
                        async for chunk in self._stream_answer_question(user_input, current_step, session.decisions):
                            yield {"type": "chunk", "content": chunk}
                        yield {"type": "section_complete", "section": "answer"}

                        # 再度ステップ確認を求める
                        session.pending_input = InputPrompt(
                            prompt_id=f"step_{current_step.step_number}_complete",
                            question=f"質問に回答しました。ステップ{current_step.step_number}「{current_step.title}」は完了しましたか？",
                            options=["できた", "まだ質問がある", "スキップ"]
                        )
                        # pending_inputを設定した後に保存
                        await self._save_progress(session, "waiting_input")
                        yield {
                            "type": "step_confirmation_required",
                            "prompt": {
                                "prompt_id": session.pending_input.prompt_id,
                                "question": session.pending_input.question,
                                "options": session.pending_input.options
                            }
                        }
                        return

        elif response_type == "skip":
            if session.phase == GenerationPhase.CHOICE_REQUIRED:
                session.phase = GenerationPhase.IMPLEMENTATION_PLANNING
                session.pending_choice = None
                session.pending_input = None
            elif session.phase == GenerationPhase.WAITING_STEP_COMPLETE:
                current_step = session.implementation_steps[session.current_step_index]
                current_step.is_completed = True
                current_step.user_feedback = "skipped"
                session.current_step_index += 1
                session.phase = GenerationPhase.IMPLEMENTATION_STEP
                session.pending_input = None

        # 中間保存
        await self._save_progress(session, "generating")

        # 生成を継続
        async for event in self.generate_stream(session):
            yield event

    async def _answer_question(self, question: str, step: ImplementationStep) -> str:
        """ステップに関する質問に回答"""
        prompt = f"""
ユーザーからの質問に回答してください。

## 現在のステップ
- ステップ{step.step_number}: {step.title}
- 説明: {step.description}

## ステップの内容
{step.content[:1000]}

## ユーザーの質問
{question}

## 回答ルール
- 簡潔に（200文字程度）回答
- 具体的なコード例があれば含める
- 段落間には空行を入れる
"""

        response = await self.llm.ainvoke([
            SystemMessage(content="あなたは丁寧な開発サポーターです。"),
            HumanMessage(content=prompt)
        ])

        return response.content

    async def _stream_answer_question(
        self,
        question: str,
        step: ImplementationStep,
        decisions: List[Decision] = None
    ) -> AsyncGenerator[str, None]:
        """ステップに関する質問にストリーミングで回答"""
        # 既存の決定事項をコンテキストに含める
        decisions_context = ""
        if decisions:
            decisions_context = "\n## 採用済みの決定事項（これらを考慮して回答してください）\n"
            for d in decisions:
                decisions_context += f"- {d.description}\n"

        prompt = f"""
ユーザーからの質問に回答してください。

## 現在のステップ
- ステップ{step.step_number}: {step.title}
- 説明: {step.description}

## ステップの内容
{step.content[:1500]}
{decisions_context}

## ユーザーの質問
{question}

## 回答ルール
- わかりやすく丁寧に回答
- 具体的なコード例があれば含める
- 段落間には空行を入れる
- コードブロックの前後には空行を入れる
- 採用済みの決定事項がある場合は、それを考慮して回答してください
"""

        async for chunk in self.llm.astream([
            SystemMessage(content="あなたは丁寧な開発サポーターです。初心者にもわかりやすく説明してください。"),
            HumanMessage(content=prompt)
        ]):
            if chunk.content:
                yield chunk.content

    async def _stream_pros_cons_analysis(
        self,
        proposal: str,
        step: ImplementationStep
    ) -> AsyncGenerator[str, None]:
        """変更提案のメリット・デメリットをストリーミングで分析"""
        prompt = f"""
以下の変更提案について、メリットとデメリットを簡潔に分析してください。

## 変更提案
{proposal}

## 現在のステップ
- ステップ{step.step_number}: {step.title}
- 内容: {step.content[:500]}

## プロジェクト情報
- 技術スタック: {', '.join(self.project_context.get('tech_stack', []))}

## 出力形式
以下の形式で、簡潔に（全体で150-200文字程度）分析してください：

**メリット:**

✓ メリット1
✓ メリット2

**デメリット・注意点:**

△ 注意点1
△ 注意点2
"""

        async for chunk in self.llm.astream([
            SystemMessage(content="技術選定のアドバイザーとして、簡潔にメリデメを分析してください。"),
            HumanMessage(content=prompt)
        ]):
            if chunk.content:
                yield chunk.content

    async def _analyze_question_for_decision(
        self,
        question: str,
        step: ImplementationStep
    ) -> Optional[Dict[str, str]]:
        """
        質問を分析し、変更提案が含まれているか判断。
        含まれていれば提案内容を返す、なければNone。
        """
        prompt = f"""
ユーザーの入力を分析してください。

## ステップの内容
- ステップ{step.step_number}: {step.title}
- 内容: {step.content[:800]}

## ユーザーの入力
「{question}」

## 分析タスク
この入力が以下のどちらかを判断してください：

A) **変更提案・要望**: 技術選択、言語、ライブラリ、アプローチなどを変更したい意図がある
   例: 「TypeScriptの方がいい」「Reduxじゃなくてzustandを使いたい」「もっとシンプルにできない？」

B) **単純な質問**: 理解を深めるための質問、エラーの相談など
   例: 「これどういう意味？」「なぜこうするの？」「エラーが出た」

## 出力形式（JSON）
変更提案の場合:
{{"type": "decision", "proposal": "〇〇を使用する", "reason": "ユーザーが〇〇と言ったため"}}

単純な質問の場合:
{{"type": "question"}}
"""

        response = await self.llm.ainvoke([
            SystemMessage(content="JSON形式で回答してください。"),
            HumanMessage(content=prompt)
        ])

        try:
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content.strip())

            if data.get("type") == "decision":
                return {
                    "proposal": data.get("proposal", ""),
                    "reason": data.get("reason", "")
                }
            return None
        except (json.JSONDecodeError, KeyError):
            return None


# セッション管理は hands_on モジュールからインポート
from services.hands_on.state import (
    default_manager as _session_manager,
    get_session,
    create_session,
    delete_session,
    restore_session_from_db,
)

# 後方互換性: _session_storeへの参照を維持
_session_store = _session_manager._store
