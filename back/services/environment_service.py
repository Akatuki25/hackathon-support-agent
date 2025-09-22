from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from .base_service import BaseService

class EnvironmentService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_hands_on(self, specification: str, directory: str, framework: str):
        """
            仕様書、ディレクトリ構成、フレームワーク情報に基づいて、以下の4つのハンズオン説明を生成する。
            - overall: 全体の環境構築ハンズオンの説明
            - devcontainer: .devcontainer の使い方と設定内容の詳細説明
            - frontend: フロントエンドの初期環境構築手順の詳細説明
            - backend: バックエンドの初期環境構築手順の詳細説明
            出力はMarkdown形式の文字列とし、JSON形式で返す。
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

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("environment_service", "generate_hands_on"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash | parser
        result = chain.invoke({
            "specification": specification,
            "directory": directory,
            "framework": framework
        })
        return result
