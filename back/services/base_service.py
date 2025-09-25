import os
import tomllib
import logging
from collections import defaultdict
from datetime import datetime
from logging import Logger
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

# LangChain & Model
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic
from typing import Dict, Any, Optional
from models.project_base import ProjectDocument  # 未使用なら削除可
from sqlalchemy.orm import Session

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
        self.llm_usage: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"calls": 0, "tokens": 0, "last_called_at": None}
        )

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
        self.llm_pro = self._load_llm(default_model_provider, "gemini-2.5-flash")
        self.llm_flash = self._load_llm(default_model_provider, "gemini-2.5-flash")
        self.llm_flash_thinking = self._load_llm(default_model_provider, "gemini-2.5-flash")
        self.llm_lite = self._load_llm(default_model_provider, "gemini-2.5-flash")
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

    def record_llm_usage(self, model_label: str, tokens: Optional[int] = None) -> None:
        """LLM使用状況を記録するユーティリティ"""
        usage = self.llm_usage[model_label]
        usage["calls"] += 1
        if tokens:
            usage["tokens"] += tokens
        usage["last_called_at"] = datetime.utcnow().isoformat()

    def merge_llm_usage(self, external_usage: Dict[str, Dict[str, Any]]) -> None:
        """他サービスで記録されたLLM使用状況を集計"""
        for model_label, metrics in external_usage.items():
            usage = self.llm_usage[model_label]
            usage["calls"] += metrics.get("calls", 0)
            usage["tokens"] += metrics.get("tokens", 0)
            last_called = metrics.get("last_called_at")
            if last_called:
                usage["last_called_at"] = last_called

    def get_llm_usage_snapshot(self) -> Dict[str, Dict[str, Any]]:
        """現在のLLM使用状況を辞書形式で取得"""
        return {label: dict(metrics) for label, metrics in self.llm_usage.items()}
