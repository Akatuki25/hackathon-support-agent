"""
フェーズレジストリ

フェーズハンドラの登録と取得を管理。
"""

from typing import Dict, Type, Optional

from ..types import GenerationPhase
from .base_phase import BasePhase


class PhaseRegistry:
    """
    フェーズハンドラのレジストリ

    GenerationPhase → フェーズハンドラのマッピングを管理。

    使用例:
        registry = PhaseRegistry()

        @registry.register(GenerationPhase.CONTEXT)
        class ContextPhase(BasePhase):
            ...

        handler = registry.get(GenerationPhase.CONTEXT)
    """

    def __init__(self):
        self._handlers: Dict[GenerationPhase, Type[BasePhase]] = {}
        self._instances: Dict[GenerationPhase, BasePhase] = {}

    def register(self, phase: GenerationPhase):
        """
        フェーズハンドラ登録用デコレータ

        Args:
            phase: 担当するフェーズ

        Returns:
            デコレータ関数

        使用例:
            @registry.register(GenerationPhase.CONTEXT)
            class ContextPhase(BasePhase):
                ...
        """
        def decorator(handler_class: Type[BasePhase]):
            if phase in self._handlers:
                raise ValueError(
                    f"Handler already registered for phase: {phase.value}"
                )
            self._handlers[phase] = handler_class
            return handler_class
        return decorator

    def register_class(self, phase: GenerationPhase, handler_class: Type[BasePhase]) -> None:
        """
        フェーズハンドラを直接登録

        Args:
            phase: 担当するフェーズ
            handler_class: ハンドラクラス
        """
        if phase in self._handlers:
            raise ValueError(
                f"Handler already registered for phase: {phase.value}"
            )
        self._handlers[phase] = handler_class

    def get(self, phase: GenerationPhase) -> Optional[BasePhase]:
        """
        フェーズに対応するハンドラを取得

        ハンドラはシングルトンとしてキャッシュされる。

        Args:
            phase: フェーズ

        Returns:
            ハンドラインスタンス、または未登録の場合None
        """
        if phase not in self._handlers:
            return None

        # キャッシュされたインスタンスを返す
        if phase not in self._instances:
            self._instances[phase] = self._handlers[phase]()

        return self._instances[phase]

    def has(self, phase: GenerationPhase) -> bool:
        """
        フェーズが登録されているか確認

        Args:
            phase: フェーズ

        Returns:
            登録済みの場合True
        """
        return phase in self._handlers

    def list_phases(self) -> list:
        """
        登録済みフェーズ一覧を取得

        Returns:
            登録済みフェーズのリスト
        """
        return list(self._handlers.keys())

    def clear(self) -> None:
        """
        全登録をクリア（テスト用）
        """
        self._handlers.clear()
        self._instances.clear()


# デフォルトレジストリ（グローバルインスタンス）
default_registry = PhaseRegistry()


def register_phase(phase: GenerationPhase):
    """
    デフォルトレジストリへの登録デコレータ

    使用例:
        @register_phase(GenerationPhase.CONTEXT)
        class ContextPhase(BasePhase):
            ...
    """
    return default_registry.register(phase)
