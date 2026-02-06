"""
ハンズオンエージェントの型定義

データクラス、Enum、型エイリアスを定義。
"""

from typing import Dict, Optional, List, Any
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum


class GenerationPhase(str, Enum):
    """生成フェーズ"""
    DEPENDENCY_CHECK = "dependency_check"  # 依存タスクチェック
    WAITING_DEPENDENCY_DECISION = "waiting_dep_decision"  # 依存タスク対応方針待ち
    CONTEXT = "context"                    # タスクの位置づけ説明
    OVERVIEW = "overview"                  # 概要生成（生成のみ、技術選定は別）
    TECH_CHECK = "tech_check"              # 技術選定判断
    CHOICE_REQUIRED = "choice"             # 選択肢提示待ち
    WAITING_CHOICE_CONFIRM = "waiting_choice_confirm"  # 決定済み技術の確認待ち
    IMPLEMENTATION_PLANNING = "impl_planning"  # 実装ステップ計画
    IMPLEMENTATION_STEP = "impl_step"      # 実装ステップ生成中
    WAITING_STEP_CHOICE = "waiting_step_choice"  # ステップ内技術選定待ち
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
class DependencyTaskInfo:
    """依存タスク情報"""
    task_id: str
    title: str
    description: str
    hands_on_status: str  # "completed" | "in_progress" | "not_started"
    implementation_summary: Optional[str] = None  # 完了済みの場合のサマリー


@dataclass
class StepRequirements:
    """ステップ内の要件（概念説明・技術選定）"""
    objective: str  # このステップの目的
    prerequisite_concept: Optional[str] = None  # 前提概念名（例: "DBマイグレーション"）
    prerequisite_brief: Optional[str] = None  # 前提概念の簡潔な説明
    tech_selection_needed: bool = False  # 技術選定が必要か
    tech_selection_question: Optional[str] = None  # 選定の質問
    tech_selection_options: List[Dict[str, str]] = field(default_factory=list)  # 選択肢


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
    # ステップ内の要件（概念説明・技術選定）
    current_step_requirements: Optional[StepRequirements] = None
    # ステップごとの技術選択（step_number -> 選択内容）
    step_choices: Dict[int, Dict[str, Any]] = field(default_factory=dict)
    # ユーザーが採用した決定事項（次のステップ生成に反映）
    decisions: List[Decision] = field(default_factory=list)
    # 保留中の変更提案（ユーザーの採用確認待ち）
    pending_decision: Optional[Dict[str, str]] = None
    # 依存タスク情報
    predecessor_tasks: List[DependencyTaskInfo] = field(default_factory=list)
    successor_tasks: List[DependencyTaskInfo] = field(default_factory=list)
    dependency_decision: Optional[str] = None  # "proceed" | "mock" | "redirect"
    # プロジェクト全体の実装概要（重複実装回避用）
    project_implementation_overview: str = ""
    # 現在選択中の技術領域（DB記録用）
    current_domain_key: Optional[str] = None
    # タイムスタンプ
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
