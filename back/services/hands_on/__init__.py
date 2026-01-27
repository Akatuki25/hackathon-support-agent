"""
ハンズオンエージェントパッケージ

インタラクティブハンズオン生成エージェントの公開API。
"""

from .types import (
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
from .context import AgentContext

__all__ = [
    # Enums
    "GenerationPhase",
    # Data classes
    "ChoiceOption",
    "ChoiceRequest",
    "InputPrompt",
    "ImplementationStep",
    "Decision",
    "DependencyTaskInfo",
    "StepRequirements",
    "SessionState",
    # Context
    "AgentContext",
]
