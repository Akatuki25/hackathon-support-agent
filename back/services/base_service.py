import os
import tomllib
from dotenv import load_dotenv

# LangChain & Model
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic
from typing import List, Dict
from models.project_base import ProjectDocument
from sqlalchemy.orm import Session


load_dotenv("/workspaces/hackson_support_agent/back/.env.local")

class BaseService:
    def __init__(self, db: Session, defult_model_provider: str = "google"):
        """
        db: DBセッション
        model_provider: モデルのプロバイダを指定する。デフォルトはGoogle。
        - google: Google Gemini
        - openai: OpenAI
        - anthropic: Anthropic
        
        などのデフォルトプロパイダーを指定することが出来る
        もし必要ならば、プロバイダーを増加させることも継承クラスで行うことが可能になる。
        """
        self.db = db
        
        # プロンプトの読み込み
        with open(os.path.join(os.path.dirname(__file__), "prompts.toml"), "rb") as f:
            self.prompts = tomllib.load(f)
        
        # AIモデルの初期化
        
        # proモデル
        self.llm_pro = self._load_llm(defult_model_provider,"gemini-2.5-flash-lite")
        # flashモデル
        self.llm_flash = self._load_llm(defult_model_provider,"gemini-2.5-flash-lite")
        # flash-thinkingモデル 仕様運転版
        self.llm_flash_thinking = self._load_llm(defult_model_provider,"gemini-2.5-flash-lite")
        # flash-liteモデル
        self.llm_lite = self._load_llm(defult_model_provider,"gemini-2.5-flash-lite")

    def _load_llm(self,model_provider ,model_type: str,temperature=0.5):
        
        match model_provider:
            case "google":
                api_key = os.getenv("GOOGLE_API_KEY")
                return ChatGoogleGenerativeAI(
                    model=model_type,
                    temperature=temperature,
                    api_key=api_key
                )
            case "openai":
                api_key = os.getenv("OPENAI_API_KEY")
                return ChatOpenAI(
                    model=model_type,
                    temperature=temperature,
                    openai_api_key=api_key
                )
            case "anthropic":
                api_key = os.getenv("ANTHROPIC_API_KEY")
                return ChatAnthropic(
                    model=model_type,
                    temperature=temperature,
                    anthropic_api_key=api_key
                )
    
    def get_prompt(self, service_name: str, prompt_name: str) -> str:
        """
        TOMLファイルからプロンプトを取得する。
        """
        try:
            return self.prompts[service_name][prompt_name]
        except KeyError:
            raise ValueError(f"Prompt '{prompt_name}' not found in service '{service_name}' in prompts.toml")



