import os
import tomllib
import logging
from logging import Logger
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

# LangChain & Model
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic
from typing import Dict, Any, List, Tuple, Optional
from models.project_base import ProjectDocument  # 未使用なら削除可
from sqlalchemy.orm import Session

# Google Search Grounding 用
try:
    from google.ai.generativelanguage_v1beta.types import Tool as GenAITool
    GROUNDING_AVAILABLE = True
except ImportError:
    GROUNDING_AVAILABLE = False

# ---- ロギング設定（環境変数で調整可能） -------------------------------
def _configure_logging() -> Logger:
    """
    LOG_LEVEL=DEBUG|INFO|WARNING|ERROR|CRITICAL
    LOG_FILE=/path/to/app.log（指定時はファイル出力; ローテーション有）
    LOG_MAX_BYTES=1048576（1MB）
    LOG_BACKUP_COUNT=3
    LOG_FORMAT='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
    """
    logger = logging.getLogger("hackthon_support_agent")
    if logger.handlers:
        # すでに設定済みなら再設定しない（重複出力防止）
        return logger

    level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_str, logging.INFO)

    log_format = os.getenv(
        "LOG_FORMAT",
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    formatter = logging.Formatter(log_format)

    logger.setLevel(level)
    logger.propagate = False  # ルートへ伝播しない

    # 標準出力
    sh = logging.StreamHandler()
    sh.setFormatter(formatter)
    logger.addHandler(sh)

    # ファイル出力（任意）
    log_file = os.getenv("LOG_FILE")
    if log_file:
        max_bytes = int(os.getenv("LOG_MAX_BYTES", "1048576"))
        backup_count = int(os.getenv("LOG_BACKUP_COUNT", "3"))
        fh = RotatingFileHandler(log_file, maxBytes=max_bytes, backupCount=backup_count)
        fh.setFormatter(formatter)
        logger.addHandler(fh)

    return logger

LOGGER = _configure_logging()

# ---- .env 読み込み ------------------------------------------------------
dotenv_path = "/workspaces/hackthon_support_agent/back/.env.local"
load_dotenv(dotenv_path)
LOGGER.info("Loaded environment variables from %s", dotenv_path)


class BaseService:
    def __init__(self, db: Session, default_model_provider: str = "google"):
        """
        db: DBセッション
        default_model_provider: モデルのプロバイダ（google/openai/anthropic）
        """
        self.db = db
        self.logger = logging.getLogger(f"{LOGGER.name}.{self.__class__.__name__}")
        self.logger.debug("Initializing BaseService (provider=%s)", default_model_provider)

        # プロンプトの読み込み
        prompts_path = os.path.join(os.path.dirname(__file__), "prompts.toml")
        try:
            with open(prompts_path, "rb") as f:
                self.prompts: Dict[str, Dict[str, str]] = tomllib.load(f)
            self.logger.info("Prompts loaded from %s", prompts_path)
        except FileNotFoundError:
            self.logger.exception("prompts.toml not found at %s", prompts_path)
            raise
        except Exception:
            self.logger.exception("Failed to load prompts from %s", prompts_path)
            raise

        # AIモデルの初期化
        # ※ APIキーそのものはログに出さない
        # gemini-2.5-flash は高性能でagenticタスクに適している
        self.llm_pro = self._load_llm(default_model_provider, "gemini-2.5-flash")
        self.llm_flash = self._load_llm(default_model_provider, "gemini-2.5-flash")
        self.llm_flash_thinking = self._load_llm(default_model_provider, "gemini-2.5-flash")
        self.llm_lite = self._load_llm(default_model_provider, "gemini-2.5-flash-lite")
        self.logger.debug("LLMs initialized")

    def _load_llm(self, model_provider: str, model_type: str, temperature: float = 0.5):
        self.logger.debug("Loading LLM (provider=%s, model=%s, temp=%.2f)",
                          model_provider, model_type, temperature)
        try:
            match model_provider:
                case "google":
                    has_key = bool(os.getenv("GOOGLE_API_KEY"))
                    if not has_key:
                        self.logger.warning("GOOGLE_API_KEY is not set")
                    llm = ChatGoogleGenerativeAI(
                        model=model_type,
                        temperature=temperature,
                        api_key=os.getenv("GOOGLE_API_KEY"),
                    )
                case "openai":
                    has_key = bool(os.getenv("OPENAI_API_KEY"))
                    if not has_key:
                        self.logger.warning("OPENAI_API_KEY is not set")
                    llm = ChatOpenAI(
                        model=model_type,
                        temperature=temperature,
                        openai_api_key=os.getenv("OPENAI_API_KEY"),
                    )
                case "anthropic":
                    has_key = bool(os.getenv("ANTHROPIC_API_KEY"))
                    if not has_key:
                        self.logger.warning("ANTHROPIC_API_KEY is not set")
                    llm = ChatAnthropic(
                        model=model_type,
                        temperature=temperature,
                        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
                    )
                case _:
                    self.logger.error("Unknown model provider: %s", model_provider)
                    raise ValueError(f"Unknown model provider: {model_provider}")

            self.logger.info("LLM loaded (provider=%s, model=%s, key_present=%s)",
                             model_provider, model_type, has_key)
            return llm

        except Exception:
            self.logger.exception("Failed to load LLM (provider=%s, model=%s)",
                                  model_provider, model_type)
            raise

    def get_prompt(self, service_name: str, prompt_name: str) -> str:
        """
        TOMLファイルからプロンプトを取得する。
        """
        self.logger.debug("Fetching prompt '%s.%s'", service_name, prompt_name)
        try:
            prompt = self.prompts[service_name][prompt_name]
            if not isinstance(prompt, str) or not prompt.strip():
                self.logger.error("Prompt '%s.%s' is empty or not a string", service_name, prompt_name)
                raise ValueError(f"Prompt '{prompt_name}' in '{service_name}' is empty")
            return prompt
        except KeyError:
            self.logger.exception(
                "Prompt '%s' not found under service '%s' in prompts.toml",
                prompt_name, service_name
            )
            raise ValueError(
                f"Prompt '{prompt_name}' not found in service '{service_name}' in prompts.toml"
            )

    def invoke_with_search(
        self,
        prompt: str,
        model_type: str = "gemini-2.5-flash"
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Google Search Grounding を使用してLLMを呼び出す

        Args:
            prompt: 検索クエリを含むプロンプト
            model_type: 使用するモデル（デフォルト: gemini-2.5-flash）

        Returns:
            (response_text, reference_urls)
            - response_text: LLMの応答テキスト
            - reference_urls: 参照URLのリスト
              [{"title": "...", "url": "...", "snippet": "..."}, ...]
        """
        if not GROUNDING_AVAILABLE:
            self.logger.warning("Google Search Grounding is not available (missing google-genai package)")
            # フォールバック: 通常のLLM呼び出し
            response = self.llm_flash.invoke(prompt)
            return response.content, []

        self.logger.debug("Invoking LLM with Google Search Grounding")
        try:
            # Google Search ツールを使用してLLM呼び出し
            llm_with_search = ChatGoogleGenerativeAI(
                model=model_type,
                temperature=0.3,
                api_key=os.getenv("GOOGLE_API_KEY"),
            )

            response = llm_with_search.invoke(
                prompt,
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
            # エラー時は通常のLLM呼び出しにフォールバック
            response = self.llm_flash.invoke(prompt)
            return response.content, []

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
            # response_metadata から grounding 情報を取得
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

            # search_entry_point から追加情報を取得
            search_entry = grounding_metadata.get('search_entry_point', {})
            if search_entry:
                rendered_content = search_entry.get('rendered_content', '')
                # rendered_content にはHTML形式の検索結果が含まれる可能性がある

            # grounding_supports から引用情報を取得
            grounding_supports = grounding_metadata.get('grounding_supports', [])
            for support in grounding_supports:
                segment = support.get('segment', {})
                grounding_chunk_indices = support.get('grounding_chunk_indices', [])

                # 対応するチャンクの情報を追加
                for idx in grounding_chunk_indices:
                    if idx < len(grounding_chunks):
                        chunk = grounding_chunks[idx]
                        web_info = chunk.get('web', {})
                        if web_info:
                            # snippetにセグメントのテキストを追加
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
