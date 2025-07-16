from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema
from langchain_core.output_parsers import StrOutputParser
from .base_service import BaseService

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
            template="""
                あなたはプロダクト開発のエキスパートです。以下の仕様書の内容に基づいて、固定のフロントエンド候補（React, Vue, Next, Astro）とバックエンド候補（Nest, Flask, FastAPI, Rails, Gin）について、各候補の優先順位とその理由を評価してください。
                各候補に対して、プロジェクトにおける適合性を考慮し、優先順位（数字が小さいほど高い）を付け、理由を記述してください。
                回答は以下のフォーマットに従って、JSON 形式で出力してください。
                ここで日本語で出力してください。

                {format_instructions}
                仕様書:
                {specification}
            """,
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
            template="""
                あなたはプロダクト開発のエキスパートです。以下の仕様書の内容と、今回ユーザーが選定した技術要件の内容からフレームワークに沿った技術要件書を作成してください。
                以下は仕様書と技術要件書の内容です。
                仕様書:
                {specification}
                技術選定：
                {frame_work}
                技術要件書のフォーマット:
                マークダウン形式の仕様書のみを返してください。それ以外を含めてはいけません。
                ```markdown
                ```
                という風に囲むの必要はありません。
                
            """
        )

        chain = prompt_template | self.llm_flash | StrOutputParser()
        result = chain.invoke({"specification": specification,"frame_work":framework})
        return result
