"""
チャットハンドラの基底クラス

各ページ固有のハンドラはこのクラスを継承して実装する。
Google Search Grounding による検索機能付き（Geminiが自動判断）
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, AsyncGenerator, Tuple, TYPE_CHECKING
from pydantic import BaseModel
import re
import logging
import json
import os

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy.orm import Session

from .actions import ActionType, get_available_actions

# Google Search Grounding 用
try:
    from google.ai.generativelanguage_v1beta.types import Tool as GenAITool
    GROUNDING_AVAILABLE = True
except ImportError:
    GROUNDING_AVAILABLE = False


class ChatMessage(BaseModel):
    """チャットメッセージ"""

    role: str  # "user" | "assistant" | "system"
    content: str


class ChatAction(BaseModel):
    """チャットが提案するアクション"""

    action_type: str  # ActionType の値
    label: str  # UI表示用ラベル
    payload: Dict[str, Any]  # アクション実行データ
    requires_confirm: bool = True  # 確認ダイアログ表示


class ReferenceUrl(BaseModel):
    """参照URL情報"""

    title: str
    url: str
    snippet: str = ""
    source: str = "grounding_chunk"


class ChatResponse(BaseModel):
    """チャットの応答"""

    message: str  # アシスタントの返答
    suggested_actions: List[ChatAction] = []  # 提案アクション
    context_used: List[str] = []  # 使用したコンテキスト種別（デバッグ用）
    reference_urls: List[ReferenceUrl] = []  # 検索で参照したURL


class BaseChatHandler(ABC):
    """
    全ページ共通のチャットハンドラ基底クラス

    各ページ固有のハンドラは以下を実装する必要がある:
    - page_context: ページ識別子
    - get_db_context(): DBから取得するコンテキスト
    - get_system_prompt(): システムプロンプトの生成
    """

    # アクション抽出用の正規表現パターン
    # 形式: [ACTION:type:label:json_payload]
    ACTION_PATTERN = re.compile(
        r'\[ACTION:([^:]+):([^:]+):(\{[^]]*\})\]',
        re.DOTALL
    )

    def __init__(
        self,
        project_id: str,
        db: Session,
        llm,
        prompts: Dict[str, Dict[str, str]],
    ):
        """
        Args:
            project_id: プロジェクトID
            db: DBセッション
            llm: LangChain LLMインスタンス
            prompts: プロンプト辞書（prompts.tomlの内容）
        """
        self.project_id = project_id
        self.db = db
        self.llm = llm
        self.prompts = prompts
        self.logger = logging.getLogger(f"chat.{self.__class__.__name__}")
        self._page_specific_context: Dict[str, Any] = {}

    @property
    @abstractmethod
    def page_context(self) -> str:
        """
        ページ識別子を返す

        Returns:
            ページ識別子（例: "hackQA", "kanban"）
        """
        pass

    @property
    def available_action_types(self) -> List[ActionType]:
        """このページで利用可能なアクションタイプ一覧"""
        return get_available_actions(self.page_context)

    @abstractmethod
    async def get_db_context(self) -> Dict[str, Any]:
        """
        DBから取得するコンテキスト情報

        Returns:
            コンテキスト情報を含む辞書
        """
        pass

    @abstractmethod
    def get_system_prompt(self, db_context: Dict[str, Any]) -> str:
        """
        ページ固有のシステムプロンプトを生成

        Args:
            db_context: get_db_context()で取得したコンテキスト

        Returns:
            システムプロンプト文字列
        """
        pass

    def set_page_specific_context(self, context: Dict[str, Any]) -> None:
        """
        ページ固有の追加コンテキストを設定

        フロントエンドから渡される、現在選択中のアイテムなどの情報。

        Args:
            context: ページ固有のコンテキスト
        """
        self._page_specific_context = context

    def get_page_specific_context(self) -> Dict[str, Any]:
        """ページ固有の追加コンテキストを取得"""
        return self._page_specific_context

    def _invoke_with_search(
        self,
        messages: List,
        model_type: str = "gemini-2.5-flash"
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Google Search Grounding を使用してLLMを呼び出す
        Geminiが検索の必要性を自動判断する

        Args:
            messages: メッセージリスト [SystemMessage, HumanMessage, ...]
            model_type: 使用するモデル（デフォルト: gemini-2.5-flash）

        Returns:
            (response_text, reference_urls)
        """
        if not GROUNDING_AVAILABLE:
            self.logger.warning("Google Search Grounding is not available")
            # フォールバック: 通常のLLM呼び出し（直接メッセージオブジェクトを使用）
            response = self.llm.invoke(messages)
            response_text = response.content if hasattr(response, 'content') else str(response)
            return response_text, []

        self.logger.debug("Invoking LLM with Google Search Grounding")
        try:
            # Google Search ツール付きLLMを作成
            llm_with_search = ChatGoogleGenerativeAI(
                model=model_type,
                temperature=0.3,
                api_key=os.getenv("GOOGLE_API_KEY"),
            )

            # 検索ツール付きで呼び出し（直接メッセージオブジェクトを使用）
            response = llm_with_search.invoke(
                messages,
                tools=[GenAITool(google_search={})],
            )

            # grounding metadata からURLを抽出
            reference_urls = self._extract_grounding_urls(response)

            self.logger.info(
                "Search grounding completed: %d reference URLs found",
                len(reference_urls)
            )

            return response.content, reference_urls

        except Exception as e:
            self.logger.exception("Failed to invoke with search grounding: %s", e)
            # エラー時は通常のLLM呼び出しにフォールバック（直接メッセージオブジェクトを使用）
            response = self.llm.invoke(messages)
            response_text = response.content if hasattr(response, 'content') else str(response)
            return response_text, []

    def _extract_grounding_urls(self, response) -> List[Dict[str, Any]]:
        """
        LLMレスポンスからgrounding metadataのURLを抽出

        Args:
            response: LangChain ChatGoogleGenerativeAI のレスポンス

        Returns:
            参照URLのリスト
        """
        urls = []

        try:
            if not hasattr(response, 'response_metadata'):
                return urls

            metadata = response.response_metadata
            grounding_metadata = metadata.get('grounding_metadata', {})

            # grounding_chunks から URL を抽出
            grounding_chunks = grounding_metadata.get('grounding_chunks', [])
            for chunk in grounding_chunks:
                web_info = chunk.get('web', {})
                if web_info:
                    urls.append({
                        "title": web_info.get('title', ''),
                        "url": web_info.get('uri', ''),
                        "snippet": "",
                        "source": "grounding_chunk"
                    })

            # grounding_supports から引用情報を取得
            grounding_supports = grounding_metadata.get('grounding_supports', [])
            for support in grounding_supports:
                segment = support.get('segment', {})
                grounding_chunk_indices = support.get('grounding_chunk_indices', [])

                for idx in grounding_chunk_indices:
                    if idx < len(grounding_chunks):
                        chunk = grounding_chunks[idx]
                        web_info = chunk.get('web', {})
                        if web_info:
                            existing = next(
                                (u for u in urls if u.get('url') == web_info.get('uri')),
                                None
                            )
                            if existing and segment.get('text'):
                                existing['snippet'] = segment.get('text', '')[:200]

            # 重複を除去
            seen_urls = set()
            unique_urls = []
            for url_info in urls:
                url = url_info.get('url', '')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    unique_urls.append(url_info)

            return unique_urls

        except Exception as e:
            self.logger.warning("Failed to extract grounding URLs: %s", e)
            return []

    def get_prompt(self, section: str, key: str) -> str:
        """
        プロンプトを取得

        Args:
            section: セクション名（例: "chat_hackQA"）
            key: プロンプトキー（例: "system"）

        Returns:
            プロンプト文字列

        Raises:
            ValueError: プロンプトが見つからない場合
        """
        try:
            prompt = self.prompts[section][key]
            if not isinstance(prompt, str) or not prompt.strip():
                raise ValueError(f"Prompt '{key}' in '{section}' is empty")
            return prompt
        except KeyError:
            raise ValueError(f"Prompt '{key}' not found in section '{section}'")

    def parse_actions_from_response(self, response: str) -> List[ChatAction]:
        """
        LLMレスポンスからアクションを抽出

        形式: [ACTION:action_type:label:{"key": "value"}]

        Args:
            response: LLMからのレスポンス

        Returns:
            抽出されたアクションのリスト
        """
        import json

        actions = []
        matches = self.ACTION_PATTERN.findall(response)

        for action_type, label, payload_str in matches:
            action_type = action_type.strip()
            label = label.strip()

            # このページで有効なアクションかチェック
            valid_types = [a.value for a in self.available_action_types]
            if action_type not in valid_types:
                self.logger.warning(
                    f"Invalid action type '{action_type}' for page '{self.page_context}'"
                )
                continue

            try:
                # 二重括弧を単一括弧に変換（LLMがプロンプト例をそのまま真似た場合の対応）
                normalized_payload = payload_str.replace('{{', '{').replace('}}', '}')
                payload = json.loads(normalized_payload)
            except json.JSONDecodeError:
                self.logger.warning(f"Failed to parse action payload: {payload_str}")
                payload = {}

            actions.append(
                ChatAction(
                    action_type=action_type,
                    label=label,
                    payload=payload,
                    requires_confirm=True,
                )
            )

        return actions

    def clean_response(self, response: str) -> str:
        """
        アクションタグを除去したクリーンな返答を取得

        Args:
            response: LLMからのレスポンス

        Returns:
            アクションタグを除去したテキスト
        """
        cleaned = self.ACTION_PATTERN.sub('', response)
        # 連続する空行を1つにまとめる
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        return cleaned.strip()

    def build_action_instruction(self) -> str:
        """
        利用可能なアクションの説明を生成

        Returns:
            アクション説明文字列
        """
        if not self.available_action_types:
            return ""

        lines = [
            "回答の中で、ユーザーに対してアクションを提案する場合は、以下の形式で記述してください：",
            "[ACTION:アクションタイプ:ラベル:JSONペイロード]",
            "",
            "利用可能なアクション:",
        ]

        # NOTE: LangChainのChatPromptTemplateは {} を変数として解釈するため、
        # JSONの波括弧は二重 {{ }} でエスケープする
        action_descriptions = {
            # hackQA用
            ActionType.SUGGEST_ANSWER: 'suggest_answer - 回答候補を提示（payload: {{"answer": "回答テキスト"}}）',
            ActionType.ADD_QUESTION: 'add_question - 追加質問を生成（payload: {{"question": "質問テキスト"}}）',
            # summaryQA用
            ActionType.REPLACE_SECTION: 'replace_section - セクション置換提案（payload: {{"original": "元のテキスト", "replacement": "置換後のテキスト"}}）',
            ActionType.REGENERATE_QUESTIONS: 'regenerate_questions - 追加質問を再生成（payload: {{}}）',
            # functionStructuring用
            ActionType.EXPLAIN_FUNCTION: 'explain_function - 機能の意図説明（payload: {{"function_id": "ID", "explanation": "説明"}}）',
            ActionType.SUGGEST_PRIORITY: 'suggest_priority - 優先度変更提案（payload: {{"function_id": "ID", "priority": "high|medium|low", "reason": "理由"}}）',
            ActionType.ADD_FUNCTION: 'add_function - 機能追加提案（payload: {{"name": "機能名", "description": "説明", "category": "カテゴリ"}}）',
            # selectFramework用
            ActionType.COMPARE_TECH: 'compare_tech - 技術比較表示（payload: {{"technologies": ["tech1", "tech2"], "comparison": "比較内容"}}）',
            ActionType.RECOMMEND_TECH: 'recommend_tech - 技術推薦（payload: {{"technology": "技術名", "reason": "推薦理由"}}）',
            # kanban用
            ActionType.SUGGEST_ASSIGNEE: 'suggest_assignee - 担当者提案（payload: {{"task_id": "ID", "member_id": "ID", "reason": "理由"}}）',
            ActionType.SHOW_WORKLOAD: 'show_workload - 負荷分析表示（payload: {{"analysis": "分析結果"}}）',
            # taskDetail用
            ActionType.ADJUST_HANDS_ON: 'adjust_hands_on - ハンズオン補足（payload: {{"field": "対象フィールド", "content": "追記内容"}}）',
        }

        for action_type in self.available_action_types:
            if action_type in action_descriptions:
                lines.append(f"- {action_descriptions[action_type]}")

        return "\n".join(lines)

    async def chat(
        self,
        user_message: str,
        history: List[ChatMessage],
        enable_search: bool = True,
    ) -> ChatResponse:
        """
        メインのチャット処理
        Google Search Grounding 付き（Geminiが検索の必要性を自動判断）

        Args:
            user_message: ユーザーからのメッセージ
            history: チャット履歴
            enable_search: 検索機能を有効にするか（デフォルト: True）

        Returns:
            チャットレスポンス
        """
        self.logger.info(f"Chat started for page '{self.page_context}'")

        # 1. DBコンテキスト取得
        db_context = await self.get_db_context()
        self.logger.debug(f"DB context keys: {list(db_context.keys())}")

        # 2. システムプロンプト生成
        system_prompt = self.get_system_prompt(db_context)

        # 3. アクション説明を追加
        action_instruction = self.build_action_instruction()
        if action_instruction:
            system_prompt = f"{system_prompt}\n\n{action_instruction}"

        # 4. メッセージを構築（直接メッセージオブジェクトを使用してテンプレート解析を回避）
        messages = [SystemMessage(content=system_prompt)]
        for msg in history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))
            else:
                messages.append(SystemMessage(content=msg.content))
        messages.append(HumanMessage(content=user_message))

        # 5. LLM呼び出し（検索機能付き）
        reference_urls: List[Dict[str, Any]] = []

        try:
            if enable_search:
                # Google Search Grounding 付きで呼び出し（Geminiが自動判断）
                llm_response, reference_urls = self._invoke_with_search(messages)
            else:
                # 検索なしで通常のLLM呼び出し（直接LLMを使用）
                response = self.llm.invoke(messages)
                llm_response = response.content if hasattr(response, 'content') else str(response)
        except Exception as e:
            self.logger.exception(f"LLM call failed: {e}")
            raise

        # 6. アクション抽出
        actions = self.parse_actions_from_response(llm_response)

        # 7. レスポンス生成
        response = ChatResponse(
            message=self.clean_response(llm_response),
            suggested_actions=actions,
            context_used=list(db_context.keys()),
            reference_urls=[
                ReferenceUrl(
                    title=url.get("title", ""),
                    url=url.get("url", ""),
                    snippet=url.get("snippet", ""),
                    source=url.get("source", "grounding_chunk"),
                )
                for url in reference_urls
            ],
        )

        self.logger.info(
            f"Chat completed: {len(actions)} actions suggested, "
            f"{len(reference_urls)} reference URLs, "
            f"context used: {response.context_used}"
        )

        return response

    async def chat_stream(
        self,
        user_message: str,
        history: List[ChatMessage],
    ) -> AsyncGenerator[str, None]:
        """
        ストリーミング対応のチャット処理

        Server-Sent Events形式でレスポンスを返す。
        - data: {"type": "chunk", "content": "..."} - テキストチャンク
        - data: {"type": "done", "actions": [...]} - 完了時にアクション情報

        Args:
            user_message: ユーザーからのメッセージ
            history: チャット履歴

        Yields:
            SSE形式の文字列
        """
        self.logger.info(f"Chat stream started for page '{self.page_context}'")

        # 1. DBコンテキスト取得
        db_context = await self.get_db_context()

        # 2. システムプロンプト生成
        system_prompt = self.get_system_prompt(db_context)

        # 3. アクション説明を追加
        action_instruction = self.build_action_instruction()
        if action_instruction:
            system_prompt = f"{system_prompt}\n\n{action_instruction}"

        # 4. メッセージを構築（直接メッセージオブジェクトを使用してテンプレート解析を回避）
        messages = [SystemMessage(content=system_prompt)]
        for msg in history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))
            else:
                messages.append(SystemMessage(content=msg.content))
        messages.append(HumanMessage(content=user_message))

        # 5. LLMストリーミング呼び出し（直接LLMを使用）
        full_response = ""
        try:
            async for event in self.llm.astream(messages):
                # イベントからテキストを抽出
                chunk = event.content if hasattr(event, 'content') else str(event)
                full_response += chunk
                # SSE形式でチャンクを送信
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk}, ensure_ascii=False)}\n\n"

        except Exception as e:
            self.logger.exception(f"LLM stream failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
            return

        # 6. アクション抽出（ストリーム完了後）
        actions = self.parse_actions_from_response(full_response)
        cleaned_message = self.clean_response(full_response)

        # 7. 完了イベントを送信（アクション情報付き）
        done_data = {
            "type": "done",
            "actions": [
                {
                    "action_type": action.action_type,
                    "label": action.label,
                    "payload": action.payload,
                    "requires_confirm": action.requires_confirm,
                }
                for action in actions
            ],
            "context_used": list(db_context.keys()),
        }
        yield f"data: {json.dumps(done_data, ensure_ascii=False)}\n\n"

        self.logger.info(
            f"Chat stream completed: {len(actions)} actions suggested"
        )
