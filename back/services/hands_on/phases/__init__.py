"""
フェーズハンドラモジュール

各生成フェーズの処理を独立したクラスとして実装。
"""

from .base_phase import BasePhase, WaitingPhase
from .registry import PhaseRegistry, default_registry, register_phase

# フェーズハンドラをインポート（自動登録）
from .context_phase import ContextPhase
from .overview_phase import OverviewPhase

__all__ = [
    # Base classes
    "BasePhase",
    "WaitingPhase",
    # Registry
    "PhaseRegistry",
    "default_registry",
    "register_phase",
    # Phase handlers
    "ContextPhase",
    "OverviewPhase",
]
