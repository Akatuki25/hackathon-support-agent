"""
エージェントコンテキスト

フェーズハンドラに渡す共有コンテキスト。
LLM、DB、設定、サービス等へのアクセスを提供。
"""

from typing import Dict, Any, Optional, List, TYPE_CHECKING
from dataclasses import dataclass, field

from .events import EventBuilder

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from langchain_google_genai import ChatGoogleGenerativeAI
    from models.project_base import Task
    from services.tech_selection_service import TechSelectionService


@dataclass
class AgentContext:
    """
    エージェントコンテキスト

    フェーズハンドラが必要とする全ての依存関係を保持。
    InteractiveHandsOnAgentから注入される。
    """

    # コアコンポーネント
    task: 'Task'
    db: 'Session'
    llm: 'ChatGoogleGenerativeAI'

    # 設定
    config: Dict[str, Any] = field(default_factory=dict)

    # プロジェクトコンテキスト
    project_context: Dict[str, Any] = field(default_factory=dict)

    # 依存タスクコンテキスト
    dependency_context: Dict[str, Any] = field(default_factory=dict)

    # サービス
    tech_service: Optional['TechSelectionService'] = None

    # キャッシュ
    decided_domains: Dict[str, str] = field(default_factory=dict)
    ecosystem: Optional[str] = None

    # イベントビルダー（ユーティリティ）
    events: EventBuilder = field(default_factory=EventBuilder)

    @property
    def tech_stack(self) -> List[str]:
        """プロジェクトの技術スタック"""
        return self.project_context.get('tech_stack', [])

    @property
    def framework(self) -> str:
        """プロジェクトのフレームワーク"""
        return self.project_context.get('framework', '未設定')

    @property
    def directory_info(self) -> str:
        """ディレクトリ構造情報"""
        return self.project_context.get('directory_info', '未設定')
