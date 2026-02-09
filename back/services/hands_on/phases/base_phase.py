"""
フェーズハンドラ基底クラス

各フェーズの処理を独立したクラスとして実装するための基盤。
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, AsyncGenerator, Optional, TYPE_CHECKING

from ..types import GenerationPhase, SessionState

if TYPE_CHECKING:
    from ..context import AgentContext


class BasePhase(ABC):
    """
    フェーズハンドラの基底クラス

    各フェーズハンドラは以下を実装する:
    - phase: 担当するGenerationPhase
    - execute(): フェーズの処理を実行
    - handle_response(): ユーザー応答を処理（必要な場合のみ）
    """

    @property
    @abstractmethod
    def phase(self) -> GenerationPhase:
        """
        このハンドラが担当するフェーズ

        Returns:
            GenerationPhase enum値
        """
        pass

    @abstractmethod
    async def execute(
        self,
        session: SessionState,
        context: 'AgentContext'
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        フェーズの処理を実行

        Args:
            session: 現在のセッション状態
            context: エージェントコンテキスト（LLM、DB、設定等）

        Yields:
            SSEイベント辞書
        """
        pass

    async def handle_response(
        self,
        session: SessionState,
        context: 'AgentContext',
        response_type: str,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        ユーザー応答を処理

        デフォルトでは未実装エラーを発生。
        ユーザー応答を処理するフェーズのみオーバーライドする。

        Args:
            session: 現在のセッション状態
            context: エージェントコンテキスト
            response_type: 応答タイプ ("choice" | "input")
            **kwargs: 応答データ

        Yields:
            SSEイベント辞書
        """
        raise NotImplementedError(
            f"Phase {self.phase.value} does not handle user responses"
        )
        # AsyncGeneratorのために必要（実際には到達しない）
        yield  # type: ignore

    def transition_to(
        self,
        session: SessionState,
        next_phase: GenerationPhase
    ) -> None:
        """
        状態遷移を実行

        Args:
            session: 現在のセッション状態
            next_phase: 遷移先のフェーズ
        """
        session.phase = next_phase

    def can_handle_response(self) -> bool:
        """
        このフェーズがユーザー応答を処理できるか

        Returns:
            処理可能な場合True
        """
        return False


class WaitingPhase(BasePhase):
    """
    ユーザー応答を待つフェーズの基底クラス

    WAITING_* 系のフェーズはこのクラスを継承する。
    execute()はユーザー応答を待つだけなので、デフォルトでは何も生成しない。
    """

    async def execute(
        self,
        session: SessionState,
        context: 'AgentContext'
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        待機フェーズのexecute（何も生成しない）

        ユーザー応答を待つだけなので、すぐにreturnする。
        """
        return
        yield  # type: ignore - AsyncGeneratorのために必要

    def can_handle_response(self) -> bool:
        """ユーザー応答を処理可能"""
        return True
