"""
フェーズハンドラモジュール

各生成フェーズの処理を独立したクラスとして実装。
"""

from .base_phase import BasePhase, WaitingPhase
from .registry import PhaseRegistry, default_registry, register_phase

# フェーズハンドラをインポート（自動登録）
from .dependency_check_phase import DependencyCheckPhase, WaitingDependencyDecisionPhase
from .context_phase import ContextPhase
from .overview_phase import OverviewPhase
from .tech_check_phase import TechCheckPhase, ChoiceRequiredPhase, WaitingChoiceConfirmPhase
from .implementation_phase import (
    ImplementationPlanningPhase,
    ImplementationStepPhase,
    WaitingStepChoicePhase,
    WaitingStepCompletePhase,
)
from .verification_phase import VerificationPhase, CompletePhase

__all__ = [
    # Base classes
    "BasePhase",
    "WaitingPhase",
    # Registry
    "PhaseRegistry",
    "default_registry",
    "register_phase",
    # Phase handlers
    "DependencyCheckPhase",
    "WaitingDependencyDecisionPhase",
    "ContextPhase",
    "OverviewPhase",
    "TechCheckPhase",
    "ChoiceRequiredPhase",
    "WaitingChoiceConfirmPhase",
    "ImplementationPlanningPhase",
    "ImplementationStepPhase",
    "WaitingStepChoicePhase",
    "WaitingStepCompletePhase",
    "VerificationPhase",
    "CompletePhase",
]
