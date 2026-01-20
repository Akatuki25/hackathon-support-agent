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
from dataclasses import dataclass, field, asdict
from enum import Enum

from sqlalchemy.orm import Session
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from models.project_base import Task, TaskHandsOn, TaskDependency


class GenerationPhase(str, Enum):
    """生成フェーズ"""
    CONTEXT = "context"                    # タスクの位置づけ説明
    OVERVIEW = "overview"                  # 概要生成
    CHOICE_REQUIRED = "choice"             # 選択が必要
    WAITING_CHOICE_CONFIRM = "waiting_choice_confirm"  # 選択確認待ち
    IMPLEMENTATION_PLANNING = "impl_planning"  # 実装ステップ計画
    IMPLEMENTATION_STEP = "impl_step"      # 実装ステップ生成中
    WAITING_STEP_COMPLETE = "waiting_step" # ステップ完了待ち
    VERIFICATION = "verification"          # 動作確認
    COMPLETE = "complete"                  # 完了


@dataclass
class ChoiceOption:
    """選択肢"""
    id: str
    label: str
    description: str
    pros: List[str] = field(default_factory=list)
    cons: List[str] = field(default_factory=list)


@dataclass
class ChoiceRequest:
    """選択肢リクエスト"""
    choice_id: str
    question: str
    options: List[ChoiceOption]
    allow_custom: bool = True
    skip_allowed: bool = False
    research_hint: Optional[str] = None


@dataclass
class InputPrompt:
    """ユーザー入力プロンプト"""
    prompt_id: str
    question: str
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None  # ボタン選択肢


@dataclass
class ImplementationStep:
    """実装ステップ"""
    step_number: int
    title: str
    description: str
    content: str = ""
    is_completed: bool = False
    user_feedback: Optional[str] = None


@dataclass
class Decision:
    """ユーザーが採用した決定事項"""
    step_number: int
    description: str  # 「TypeScriptを使用する」など
    reason: str       # 採用理由


@dataclass
class SessionState:
    """セッション状態"""
    session_id: str
    task_id: str
    phase: GenerationPhase
    generated_content: Dict[str, str] = field(default_factory=dict)
    user_choices: Dict[str, Any] = field(default_factory=dict)
    user_inputs: Dict[str, str] = field(default_factory=dict)
    pending_choice: Optional[ChoiceRequest] = None
    pending_input: Optional[InputPrompt] = None
    # 実装ステップ管理
    implementation_steps: List[ImplementationStep] = field(default_factory=list)
    current_step_index: int = 0
    # ユーザーが採用した決定事項（次のステップ生成に反映）
    decisions: List[Decision] = field(default_factory=list)
    # 保留中の変更提案（ユーザーの採用確認待ち）
    pending_decision: Optional[Dict[str, str]] = None
    # タイムスタンプ
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


class InteractiveHandsOnAgent:
    """
    インタラクティブハンズオン生成エージェント

    SSEストリーミングで段階的に生成し、ステップごとにユーザー確認を待つ。
    各ステップ完了時にDBに保存し、中断しても進捗を保持する。
    """

    # 選択ポイント検出用キーワード
    CHOICE_KEYWORDS = [
        "ライブラリ", "フレームワーク", "パッケージ", "ツール",
        "認証", "DB", "データベース", "ORM", "API", "状態管理",
        "スタイリング", "CSS", "UI", "コンポーネント", "マップ", "地図",
        "選定", "選択", "比較", "検討"
    ]

    def __init__(
        self,
        db: Session,
        task: Task,
        project_context: Dict,
        config: Optional[Dict] = None
    ):
        self.db = db
        self.task = task
        self.project_context = project_context
        self.config = config or {}

        # LLM初期化
        self.llm = ChatGoogleGenerativeAI(
            model=self.config.get("model", "gemini-2.0-flash"),
            temperature=0.7
        )

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

    def _detect_choice_points(self) -> List[Dict]:
        """タスク説明から選択ポイントを検出"""
        choice_points = []
        task_text = f"{self.task.title} {self.task.description or ''}"

        for keyword in self.CHOICE_KEYWORDS:
            if keyword in task_text:
                choice_type = self._get_choice_type(keyword)
                if choice_type and choice_type not in [cp["type"] for cp in choice_points]:
                    choice_points.append({
                        "type": choice_type,
                        "keyword": keyword,
                        "question": self._get_choice_question(choice_type)
                    })

        return choice_points

    def _get_choice_type(self, keyword: str) -> Optional[str]:
        """キーワードから選択タイプを判定"""
        mapping = {
            "ライブラリ": "library",
            "フレームワーク": "framework",
            "パッケージ": "library",
            "ツール": "tool",
            "認証": "auth",
            "DB": "database",
            "データベース": "database",
            "ORM": "orm",
            "API": "api",
            "状態管理": "state_management",
            "スタイリング": "styling",
            "CSS": "styling",
            "UI": "ui_library",
            "コンポーネント": "ui_library",
            "マップ": "map_library",
            "地図": "map_library",
        }
        return mapping.get(keyword)

    def _get_choice_question(self, choice_type: str) -> str:
        """選択タイプに応じた質問文を生成"""
        questions = {
            "library": "使用するライブラリを選定しましょう",
            "framework": "使用するフレームワークを選定しましょう",
            "tool": "使用するツールを選定しましょう",
            "auth": "認証方式を選定しましょう",
            "database": "データベースを選定しましょう",
            "orm": "ORMを選定しましょう",
            "api": "API設計方式を選定しましょう",
            "state_management": "状態管理ライブラリを選定しましょう",
            "styling": "スタイリング手法を選定しましょう",
            "ui_library": "UIライブラリを選定しましょう",
            "map_library": "地図ライブラリを選定しましょう",
        }
        return questions.get(choice_type, "技術を選定しましょう")

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

        user_interactions_data = {
            "choices": interactions,
            "inputs": session.user_inputs,
            "steps": steps_data,
            "current_step": session.current_step_index,
            "phase": session.phase.value,
            "decisions": decisions_data,
            "pending_decision": pending_decision_data,
            "pending_input": pending_input_data
        }

        if existing:
            existing.overview = session.generated_content.get("overview", "")
            existing.implementation_steps = session.generated_content.get("implementation", "")
            existing.verification = session.generated_content.get("verification", "")
            existing.technical_context = session.generated_content.get("context", "")
            existing.user_interactions = user_interactions_data
            existing.generation_mode = "interactive"
            existing.generation_state = state
            existing.session_id = session.session_id
            existing.updated_at = datetime.now()
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
                user_interactions=user_interactions_data
            )
            self.db.add(hands_on)
            self.db.commit()
            self.db.refresh(hands_on)
            return hands_on

    async def _generate_choice_options(
        self,
        choice_type: str,
        choice_question: str
    ) -> ChoiceRequest:
        """選択肢をAIで生成"""
        prompt = f"""
以下のタスクで{choice_question}。
主要な選択肢を3つ程度提案してください。

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}
- カテゴリ: {self.task.category or '未分類'}

## プロジェクト情報
- 技術スタック: {', '.join(self.project_context.get('tech_stack', []))}
- フレームワーク: {self.project_context.get('framework', '未設定')}

## 出力形式（JSON）
{{
  "options": [
    {{
      "id": "option1",
      "label": "選択肢名",
      "description": "簡潔な説明（1行）",
      "pros": ["メリット1", "メリット2"],
      "cons": ["デメリット1"]
    }}
  ],
  "research_hint": "調べる際のヒント（任意）"
}}
"""

        response = await self.llm.ainvoke([
            SystemMessage(content="あなたは技術選定のエキスパートです。JSON形式で回答してください。"),
            HumanMessage(content=prompt)
        ])

        try:
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content.strip())

            options = [
                ChoiceOption(
                    id=opt["id"],
                    label=opt["label"],
                    description=opt["description"],
                    pros=opt.get("pros", []),
                    cons=opt.get("cons", [])
                )
                for opt in data.get("options", [])
            ]

            return ChoiceRequest(
                choice_id=f"choice_{choice_type}_{uuid.uuid4().hex[:8]}",
                question=choice_question,
                options=options,
                allow_custom=True,
                skip_allowed=True,
                research_hint=data.get("research_hint")
            )
        except (json.JSONDecodeError, KeyError):
            return ChoiceRequest(
                choice_id=f"choice_{choice_type}_{uuid.uuid4().hex[:8]}",
                question=choice_question,
                options=[
                    ChoiceOption(
                        id="custom",
                        label="自分で調べて決める",
                        description="ドキュメントや記事を参考に自分で選定します"
                    )
                ],
                allow_custom=True,
                skip_allowed=True,
                research_hint="公式ドキュメントや比較記事を参考にしてください"
            )

    async def _generate_implementation_plan(
        self,
        user_choices: Dict[str, Any]
    ) -> List[ImplementationStep]:
        """MVPアプローチで実装ステップを計画"""
        choices_text = ""
        if user_choices:
            for choice_id, choice_data in user_choices.items():
                choices_text += f"- 選択: {choice_data.get('selected', 'なし')}\n"

        prompt = f"""
以下のタスクをMVPアプローチで段階的に実装する計画を立ててください。

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}
{choices_text}

## プロジェクト情報
- 技術スタック: {', '.join(self.project_context.get('tech_stack', []))}
- フレームワーク: {self.project_context.get('framework', '未設定')}

## 計画のルール
1. 最初のステップは必ず「プロジェクト/ファイルの作成・初期設定」
2. 次のステップは「基本的な動作確認ができる最小構成」
3. その後、コア機能を段階的に追加
4. 各ステップは独立して動作確認できる単位にする
5. ステップ数は3〜5個程度

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
        decisions: List[Decision] = None
    ) -> AsyncGenerator[str, None]:
        """ステップの実装内容をストリーミング生成"""
        choices_text = ""
        if user_choices:
            for choice_id, choice_data in user_choices.items():
                choices_text += f"- 選択: {choice_data.get('selected', 'なし')}\n"

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

        prompt = f"""
以下のステップの詳細な実装手順を説明してください。

## タスク情報
- タイトル: {self.task.title}
- 説明: {self.task.description or 'なし'}
{choices_text}
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
- 「ユーザーが採用した決定事項」は必ず反映してください
- 例: TypeScriptを使うと決まっていたら、必ずTypeScriptでコード例を書いてください
- 例: 特定のライブラリを使うと決まっていたら、必ずそのライブラリを使ってください

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

            # Phase 2: 概要生成
            if session.phase == GenerationPhase.OVERVIEW:
                yield {"type": "section_start", "section": "overview"}

                async for chunk in self._stream_overview():
                    yield {"type": "chunk", "content": chunk}
                    session.generated_content["overview"] = session.generated_content.get("overview", "") + chunk

                yield {"type": "section_complete", "section": "overview"}

                # 中間保存
                await self._save_progress(session, "generating")
                yield {"type": "progress_saved", "phase": "overview"}

                # 選択ポイントをチェック
                choice_points = self._detect_choice_points()
                if choice_points and not session.user_choices:
                    first_choice = choice_points[0]
                    choice_request = await self._generate_choice_options(
                        first_choice["type"],
                        first_choice["question"]
                    )
                    session.pending_choice = choice_request
                    session.phase = GenerationPhase.CHOICE_REQUIRED

                    # 中間保存
                    await self._save_progress(session, "waiting_input")

                    yield {
                        "type": "choice_required",
                        "choice": {
                            "choice_id": choice_request.choice_id,
                            "question": choice_request.question,
                            "options": [
                                {
                                    "id": opt.id,
                                    "label": opt.label,
                                    "description": opt.description,
                                    "pros": opt.pros,
                                    "cons": opt.cons
                                }
                                for opt in choice_request.options
                            ],
                            "allow_custom": choice_request.allow_custom,
                            "skip_allowed": choice_request.skip_allowed,
                            "research_hint": choice_request.research_hint
                        }
                    }
                    return
                else:
                    session.phase = GenerationPhase.IMPLEMENTATION_PLANNING

            # Phase 3: 実装計画
            if session.phase == GenerationPhase.IMPLEMENTATION_PLANNING:
                yield {"type": "section_start", "section": "planning"}
                yield {"type": "chunk", "content": "\n\n### 実装計画\n\nMVPアプローチで段階的に実装していきます。\n\n"}

                # ステップを計画
                session.implementation_steps = await self._generate_implementation_plan(session.user_choices)

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

                    # セクション開始を通知（フロントエンドがchunkの行き先を知るため）
                    section_name = f"step_{current_step.step_number}"
                    yield {"type": "section_start", "section": section_name}

                    # ステップ内容を生成（決定事項を反映）
                    step_content = ""
                    async for chunk in self._generate_step_content(
                        current_step,
                        session.user_choices,
                        previous_steps,
                        session.decisions
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
            # 選択を記録
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
            # 選択確認への応答
            if session.phase == GenerationPhase.WAITING_CHOICE_CONFIRM:
                if user_input and user_input.upper() in ["OK", "はい", "YES", "進める"]:
                    session.phase = GenerationPhase.IMPLEMENTATION_PLANNING
                    session.pending_choice = None
                    session.pending_input = None
                else:
                    session.phase = GenerationPhase.OVERVIEW
                    session.pending_input = None
                    session.user_choices = {}

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
                        session.decisions
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


# セッションストア（インメモリ）
_session_store: Dict[str, SessionState] = {}


def get_session(session_id: str) -> Optional[SessionState]:
    """セッションを取得"""
    return _session_store.get(session_id)


def create_session(task_id: str) -> SessionState:
    """新しいセッションを作成（同じtask_idの古いセッションは削除）"""
    # 同じtask_idの古いセッションを削除
    sessions_to_delete = [
        sid for sid, s in _session_store.items()
        if s.task_id == task_id
    ]
    for sid in sessions_to_delete:
        del _session_store[sid]

    session = SessionState(
        session_id=str(uuid.uuid4()),
        task_id=task_id,
        phase=GenerationPhase.CONTEXT
    )
    _session_store[session.session_id] = session
    return session


def delete_session(session_id: str) -> bool:
    """セッションを削除"""
    if session_id in _session_store:
        del _session_store[session_id]
        return True
    return False


def restore_session_from_db(hands_on: 'TaskHandsOn', task_id: str) -> Optional[SessionState]:
    """DBからセッション状態を復元"""
    if not hands_on or not hands_on.user_interactions:
        return None

    interactions = hands_on.user_interactions
    phase_str = interactions.get("phase", "CONTEXT")

    # フェーズを復元
    try:
        phase = GenerationPhase(phase_str)
    except ValueError:
        phase = GenerationPhase.CONTEXT

    # 実装ステップを復元
    steps_data = interactions.get("steps", [])
    implementation_steps = [
        ImplementationStep(
            step_number=s["step_number"],
            title=s["title"],
            description=s["description"],
            content=s.get("content", ""),
            is_completed=s.get("is_completed", False),
            user_feedback=s.get("user_feedback")
        )
        for s in steps_data
    ]

    # 決定事項を復元
    decisions_data = interactions.get("decisions", [])
    decisions = [
        Decision(
            step_number=d["step_number"],
            description=d["description"],
            reason=d.get("reason", "")
        )
        for d in decisions_data
    ]

    # 保留中の入力プロンプトを復元
    pending_input_data = interactions.get("pending_input")
    pending_input = None
    if pending_input_data:
        pending_input = InputPrompt(
            prompt_id=pending_input_data.get("prompt_id", ""),
            question=pending_input_data.get("question", ""),
            placeholder=pending_input_data.get("placeholder"),
            options=pending_input_data.get("options")
        )

    # user_choicesを復元
    choices_data = interactions.get("choices", [])
    user_choices = {}
    for choice in choices_data:
        choice_id = choice.get("choice_id")
        if choice_id:
            user_choices[choice_id] = {
                "selected": choice.get("selected"),
                "user_note": choice.get("user_note")
            }

    # 生成済みコンテンツを復元
    generated_content = {
        "overview": hands_on.overview or "",
        "implementation": hands_on.implementation_steps or "",
        "verification": hands_on.verification or "",
        "context": hands_on.technical_context or ""
    }

    # セッション作成
    session = SessionState(
        session_id=hands_on.session_id or str(uuid.uuid4()),
        task_id=task_id,
        phase=phase,
        generated_content=generated_content,
        user_choices=user_choices,
        user_inputs=interactions.get("inputs", {}),
        pending_input=pending_input,
        implementation_steps=implementation_steps,
        current_step_index=interactions.get("current_step", 0),
        decisions=decisions,
        pending_decision=interactions.get("pending_decision")
    )

    # セッションストアに登録
    _session_store[session.session_id] = session

    return session
