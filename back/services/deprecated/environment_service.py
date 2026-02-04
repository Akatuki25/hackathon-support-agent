from langchain_core.prompts import ChatPromptTemplate
from langchain_classic.output_parsers import ResponseSchema, StructuredOutputParser
from ..core import BaseService
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import json


class EnvironmentService(BaseService):
    """
    環境構築ハンズオン生成サービス
    Google Search Grounding による検索機能付き（Geminiが自動判断）
    """

    def __init__(self, db: Session):
        super().__init__(db)

    def generate_hands_on(
        self,
        specification: str,
        directory: str,
        framework: str,
        enable_search: bool = True
    ) -> Dict[str, Any]:
        """
        仕様書、ディレクトリ構成、フレームワーク情報に基づいて、環境構築ハンズオンを生成する。
        Google Search Grounding を使用し、最新の公式ドキュメントを参照する。

        Args:
            specification: 仕様書
            directory: ディレクトリ構成
            framework: フレームワーク情報
            enable_search: 検索機能を有効にするかどうか

        Returns:
            以下のフィールドを含む辞書:
            - overall: 全体の環境構築ハンズオンの説明
            - devcontainer: .devcontainer の使い方と設定内容の詳細説明
            - frontend: フロントエンドの初期環境構築手順の詳細説明
            - backend: バックエンドの初期環境構築手順の詳細説明
            - reference_urls: 参照URLのリスト
        """
        self.logger.info("Environment hands-on generation started")

        # プロンプトを構築（検索を促す指示を含める）
        base_template = self.get_prompt("environment_service", "generate_hands_on")

        # 検索指示を追加したプロンプト
        search_instruction = """
## 重要: 最新情報の検索
以下の技術について、**必ず公式ドキュメントを検索して最新のセットアップ方法を確認してください**:
- 各技術の推奨バージョン
- 公式のインストール手順
- Docker環境でのベストプラクティス
- 既知の問題や注意点

検索結果に基づいて、正確で最新の環境構築手順を提供してください。
"""

        response_schemas = [
            ResponseSchema(
                name="overall",
                description="全体の環境構築ハンズオンの説明。",
                type="string"
            ),
            ResponseSchema(
                name="devcontainer",
                description=".devcontainer の使い方と設定内容の詳細説明。",
                type="string"
            ),
            ResponseSchema(
                name="frontend",
                description="フロントエンドの初期環境構築手順の詳細説明。（ただし、.devcontainerで整う環境構築を再度ローカルで）",
                type="string"
            ),
            ResponseSchema(
                name="backend",
                description="バックエンドの初期環境構築手順の詳細説明。（ただし、.devcontainerで整う環境構築を再度ローカルで整える必要はありません）",
                type="string"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        # プロンプトを構築
        prompt = f"""{base_template}

{search_instruction if enable_search else ""}

{parser.get_format_instructions()}
"""

        # 変数を埋め込み
        prompt = prompt.replace("{specification}", specification)
        prompt = prompt.replace("{directory}", directory)
        prompt = prompt.replace("{framework}", framework)
        prompt = prompt.replace("{format_instructions}", parser.get_format_instructions())

        reference_urls: List[Dict[str, Any]] = []

        if enable_search:
            # Google Search Grounding 付きで呼び出し
            # プロンプトで検索を促しているので、Gemini が検索を実行する
            response_text, reference_urls = self.invoke_with_search(prompt)
        else:
            # 検索なしで通常のLLM呼び出し
            response = self.llm_flash.invoke(prompt)
            response_text = response.content

        # レスポンスをパース
        try:
            result = parser.parse(response_text)
        except Exception as e:
            self.logger.warning(f"Failed to parse response, attempting JSON extraction: {e}")
            # JSONブロックを抽出して再試行
            try:
                json_match = response_text.find("```json")
                if json_match != -1:
                    json_end = response_text.find("```", json_match + 7)
                    json_str = response_text[json_match + 7:json_end].strip()
                    result = json.loads(json_str)
                else:
                    # フォールバック: 空の結果を返す
                    result = {
                        "overall": response_text,
                        "devcontainer": "",
                        "frontend": "",
                        "backend": ""
                    }
            except Exception:
                result = {
                    "overall": response_text,
                    "devcontainer": "",
                    "frontend": "",
                    "backend": ""
                }

        # reference_urls を結果に追加
        result["reference_urls"] = reference_urls

        self.logger.info(
            f"Environment hands-on generated (reference_urls={len(reference_urls)})"
        )

        return result
