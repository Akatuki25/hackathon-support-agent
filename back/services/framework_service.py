from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema
from langchain_core.output_parsers import StrOutputParser
from .base_service import BaseService
# StructuredOutputParserをインポート
from langchain.output_parsers import StructuredOutputParser, ResponseSchema

class FrameworkService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_framework_priority(self, specification: str):
        """
        仕様書の内容に基づき、固定のフロントエンド候補（React, Vue, Next, Astro）
        およびバックエンド候補（Nest, Flask, FastAPI, Rails, Gin）の優先順位と理由を
        JSON 形式で生成する。
        """
        response_schemas = [
            ResponseSchema(
                name="frontend",
                description="配列形式のフロントエンドフレームワークの提案。各項目は {name: string, priority: number, reason: string} の形式。",
                type="array(objects)"
            ),
            ResponseSchema(
                name="backend",
                description="配列形式のバックエンドフレームワークの提案。各項目は {name: string, priority: number, reason: string} の形式。",
                type="array(objects)"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("framework_service", "generate_framework_priority"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash | parser
        result = chain.invoke({"specification": specification})
        return result
    def generate_framework_document(self, specification: str,framework:str):
        """
        仕様書の内容に基づき、固定のフロントエンド候補
        およびバックエンド候補の選択肢かを選んだものからそのフレームワークに沿った技術要件書を作成する。
        """
        
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("framework_service", "generate_framework_document")
        )

        chain = prompt_template | self.llm_flash | StrOutputParser()
        result = chain.invoke({"specification": specification,"frame_work":framework})
        return result
