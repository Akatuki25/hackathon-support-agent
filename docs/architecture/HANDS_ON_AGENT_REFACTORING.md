# InteractiveHandsOnAgent リファクタリング設計

## 現状分析

### ファイル情報
- **パス**: `back/services/interactive_hands_on_agent.py`
- **行数**: 2,410行
- **問題**: 1ファイルに全責務が集中し、保守性・可読性が低下

### 現状の責務（混在している）

| 責務 | 行数(概算) | 説明 |
|------|----------|------|
| データクラス定義 | 120行 | SessionState, ChoiceOption, etc. |
| 初期化・ユーティリティ | 130行 | __init__, _detect_ecosystem, etc. |
| 技術選定 | 240行 | _check_tech_selection, _check_step_requirements |
| 永続化 | 150行 | _save_progress |
| コンテンツ生成（LLM） | 400行 | _generate_*, _stream_* |
| メイン生成フロー | 450行 | generate_stream（巨大if文） |
| ユーザー応答処理 | 350行 | handle_user_response（巨大if文） |
| セッション管理 | 50行 | モジュールレベル関数 |

### 主な問題点

1. **generate_stream / handle_user_response が巨大**
   - フェーズごとの処理が1つのif文チェーンで管理
   - 新フェーズ追加時に既存コードを大幅に変更

2. **責務の混在**
   - LLM呼び出し、DB保存、イベント生成が1メソッド内に混在
   - テスト困難

3. **セッション管理がグローバル**
   - `_sessions: Dict[str, SessionState] = {}`がモジュールレベル

---

## 設計方針

### 参考パターン

1. **LangGraph ステートマシン**
   - 状態遷移を明示的に定義
   - 各ノード（状態）が独立した処理単位

2. **既存chatサービスの構造**
   - `base_handler.py`: 共通ロジック
   - `chat_router.py`: ハンドラ選択
   - `handlers/`: 具体的なハンドラ

3. **python-statemachine パターン**
   - 状態とイベントハンドラを分離
   - 遷移条件を宣言的に定義

---

## 提案ディレクトリ構造

```
back/services/hands_on/
├── __init__.py                    # 公開API
├── agent.py                       # メインエージェントクラス（薄いオーケストレータ）
├── types.py                       # データクラス定義
│   ├── SessionState
│   ├── ChoiceOption, ChoiceRequest, InputPrompt
│   ├── ImplementationStep, Decision
│   ├── DependencyTaskInfo, StepRequirements
│   └── GenerationPhase (Enum)
│
├── state/                         # 状態管理
│   ├── __init__.py
│   ├── session_manager.py         # セッション管理（create/get/delete）
│   └── persistence.py             # DB永続化（_save_progress相当）
│
├── phases/                        # フェーズハンドラ（ステートマシンのノード）
│   ├── __init__.py
│   ├── base_phase.py              # 基底クラス
│   ├── dependency_check.py        # DEPENDENCY_CHECK フェーズ
│   ├── context.py                 # CONTEXT フェーズ
│   ├── overview.py                # OVERVIEW フェーズ
│   ├── tech_check.py              # TECH_CHECK フェーズ
│   ├── choice.py                  # CHOICE_REQUIRED, WAITING_CHOICE_CONFIRM
│   ├── implementation.py          # IMPLEMENTATION_PLANNING, IMPLEMENTATION_STEP
│   ├── step_interaction.py        # WAITING_STEP_CHOICE, WAITING_STEP_COMPLETE
│   └── verification.py            # VERIFICATION, COMPLETE
│
├── generators/                    # LLMコンテンツ生成
│   ├── __init__.py
│   ├── overview_generator.py      # 概要生成
│   ├── plan_generator.py          # 実装計画生成
│   ├── step_generator.py          # ステップ内容生成
│   ├── verification_generator.py  # 動作確認生成
│   └── analysis_generator.py      # メリデメ分析、質問回答
│
├── events/                        # SSEイベント
│   ├── __init__.py
│   ├── event_types.py             # イベント型定義
│   └── event_builder.py           # イベント生成ヘルパー
│
└── utils/                         # ユーティリティ
    ├── __init__.py
    ├── context_builder.py         # コンテキスト構築（_build_context_text等）
    └── text_utils.py              # テキストユーティリティ（_chunk_text等）
```

---

## 各モジュールの責務

### 1. `agent.py` - メインオーケストレータ

```python
class InteractiveHandsOnAgent:
    """薄いオーケストレータ。フェーズハンドラに処理を委譲"""

    def __init__(self, task, db, project_context, dependency_context, config):
        self.phase_registry = PhaseRegistry()
        self.session_manager = SessionManager()
        self.persistence = PersistenceService(db)
        # ...

    async def generate_stream(self, session: SessionState) -> AsyncGenerator[Dict, None]:
        """フェーズに応じたハンドラを呼び出し"""
        while session.phase != GenerationPhase.COMPLETE:
            handler = self.phase_registry.get_handler(session.phase)
            async for event in handler.execute(session, self.context):
                yield event
                if event.get("type") in ["choice_required", "user_input_required", ...]:
                    return  # ユーザー待ち

    async def handle_user_response(self, session, response_type, **kwargs):
        """現在のフェーズのハンドラにユーザー応答を委譲"""
        handler = self.phase_registry.get_handler(session.phase)
        async for event in handler.handle_response(session, response_type, **kwargs):
            yield event
```

### 2. `phases/base_phase.py` - フェーズ基底クラス

```python
from abc import ABC, abstractmethod

class BasePhase(ABC):
    """フェーズハンドラの基底クラス"""

    @property
    @abstractmethod
    def phase(self) -> GenerationPhase:
        """このハンドラが担当するフェーズ"""
        pass

    @abstractmethod
    async def execute(self, session: SessionState, context: AgentContext) -> AsyncGenerator[Dict, None]:
        """フェーズの処理を実行"""
        pass

    async def handle_response(self, session: SessionState, response_type: str, **kwargs) -> AsyncGenerator[Dict, None]:
        """ユーザー応答を処理（必要なフェーズのみオーバーライド）"""
        raise NotImplementedError(f"Phase {self.phase} does not handle user responses")

    def transition_to(self, session: SessionState, next_phase: GenerationPhase):
        """状態遷移"""
        session.phase = next_phase
```

### 3. `phases/tech_check.py` - 技術選定フェーズ例

```python
from .base_phase import BasePhase

class TechCheckPhase(BasePhase):
    """技術選定判断フェーズ"""

    @property
    def phase(self) -> GenerationPhase:
        return GenerationPhase.TECH_CHECK

    async def execute(self, session: SessionState, context: AgentContext) -> AsyncGenerator[Dict, None]:
        # 既に選択済みならスキップ
        if session.user_choices:
            self.transition_to(session, GenerationPhase.IMPLEMENTATION_PLANNING)
            return

        # 技術選定チェック
        tech_result = await context.tech_service.check_tech_selection(session)

        if tech_result.needs_choice:
            # 選択肢を提示
            session.pending_choice = self._build_choice_request(tech_result)
            self.transition_to(session, GenerationPhase.CHOICE_REQUIRED)
            yield context.events.choice_required(session.pending_choice)
        elif tech_result.decided:
            # 確認を求める
            yield context.events.chunk(f"**技術選定**: {tech_result.decided}\n")
            session.pending_input = InputPrompt(...)
            self.transition_to(session, GenerationPhase.WAITING_CHOICE_CONFIRM)
            yield context.events.user_input_required(session.pending_input)
        else:
            # 技術選定不要
            self.transition_to(session, GenerationPhase.IMPLEMENTATION_PLANNING)
```

### 4. `state/persistence.py` - 永続化サービス

```python
class PersistenceService:
    """DB永続化を担当"""

    def __init__(self, db: Session):
        self.db = db

    async def save_progress(self, session: SessionState, task_id: UUID, state: str = "generating") -> TaskHandsOn:
        """進捗をDBに保存"""
        # 現在の_save_progressロジックを移動
        ...

    def serialize_session(self, session: SessionState) -> Dict:
        """セッションをJSON化"""
        ...

    def deserialize_session(self, data: Dict) -> SessionState:
        """JSONからセッションを復元"""
        ...
```

### 5. `events/event_builder.py` - イベント生成

```python
class EventBuilder:
    """SSEイベントを生成するヘルパー"""

    @staticmethod
    def section_start(section: str) -> Dict:
        return {"type": "section_start", "section": section}

    @staticmethod
    def chunk(content: str) -> Dict:
        return {"type": "chunk", "content": content}

    @staticmethod
    def choice_required(choice: ChoiceRequest) -> Dict:
        return {
            "type": "choice_required",
            "choice": {
                "choice_id": choice.choice_id,
                "question": choice.question,
                "options": [asdict(opt) for opt in choice.options],
                ...
            }
        }
    # ...
```

---

## 状態遷移図

```
                    ┌─────────────────┐
                    │ DEPENDENCY_CHECK│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              │              ▼
    ┌─────────────────┐      │    ┌─────────────────────┐
    │WAITING_DEP_DEC  │──────┴───▶│      CONTEXT        │
    └─────────────────┘           └──────────┬──────────┘
                                             │
                                             ▼
                                  ┌──────────────────┐
                                  │     OVERVIEW     │
                                  └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │   TECH_CHECK     │
                                  └────────┬─────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            │                            ▼
    ┌─────────────────┐                    │              ┌─────────────────────┐
    │ CHOICE_REQUIRED │                    │              │WAITING_CHOICE_CONFIRM│
    └────────┬────────┘                    │              └──────────┬──────────┘
             │                             │                         │
             └─────────────────────────────┼─────────────────────────┘
                                           │
                                           ▼
                                ┌────────────────────┐
                                │IMPLEMENTATION_PLAN │
                                └────────┬───────────┘
                                         │
                                         ▼
                                ┌────────────────────┐
                                │IMPLEMENTATION_STEP │◀─────────┐
                                └────────┬───────────┘          │
                                         │                      │
              ┌──────────────────────────┼──────────────────────┤
              │                          │                      │
              ▼                          ▼                      │
    ┌─────────────────┐       ┌─────────────────────┐          │
    │WAITING_STEP_CHO │──────▶│WAITING_STEP_COMPLETE│──────────┘
    └─────────────────┘       └─────────────────────┘
                                         │
                                         ▼ (all steps done)
                                ┌────────────────────┐
                                │   VERIFICATION     │
                                └────────┬───────────┘
                                         │
                                         ▼
                                ┌────────────────────┐
                                │     COMPLETE       │
                                └────────────────────┘
```

---

## 移行計画

### Phase 1: 基盤構築（破壊的変更なし）
1. `hands_on/types.py` 作成（データクラス移動）
2. `hands_on/events/` 作成（イベントビルダー）
3. `hands_on/utils/` 作成（ユーティリティ）
4. 既存ファイルからimport切り替え

### Phase 2: 状態管理分離
1. `hands_on/state/` 作成
2. `SessionManager`, `PersistenceService` 実装
3. 既存コードから段階的に移行

### Phase 3: フェーズハンドラ実装
1. `hands_on/phases/base_phase.py` 作成
2. 各フェーズハンドラを1つずつ実装・テスト
3. `generate_stream`を段階的に委譲

### Phase 4: ジェネレータ分離
1. `hands_on/generators/` 作成
2. LLM呼び出しロジックを移動

### Phase 5: 統合・クリーンアップ
1. 旧`interactive_hands_on_agent.py`を`agent.py`に置換
2. 後方互換性ラッパー（必要に応じて）
3. テスト整備

---

## メリット

1. **可読性向上**: 各フェーズが独立したファイル（50-150行）
2. **テスト容易性**: フェーズ単位でユニットテスト可能
3. **拡張性**: 新フェーズ追加が容易（ファイル追加 + 登録）
4. **責務分離**: LLM呼び出し、永続化、イベント生成が分離
5. **既存パターン踏襲**: chatサービスと同様の構造で統一感

---

## 注意事項

1. **後方互換性**: 外部インターフェース（`generate_stream`, `handle_user_response`）は維持
2. **段階的移行**: 一度に全て変更せず、フェーズごとに移行
3. **テスト優先**: 各移行ステップでテストを追加

---

## 参考資料

- [LangGraph Multi-Agent Orchestration](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/)
- [python-statemachine](https://python-statemachine.readthedocs.io/en/latest/)
- [pytransitions/transitions](https://github.com/pytransitions/transitions)
- 既存実装: `back/services/chat/` ディレクトリ構造
