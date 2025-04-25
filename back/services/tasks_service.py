from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from .base_service import BaseService

class TasksService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_tasks(self, specification: str, directory: str, framework: str):
        """
        仕様書、ディレクトリ構成、フレームワーク情報に基づいて、
        アプリ制作に必要なタスクをリスト形式で生成する。
        各タスクはタスク名、優先度（Must, Should, Could）、具体的な内容を含む。
        """
        response_schemas = [
            ResponseSchema(
                name="tasks",
                description=(
                    "タスクの一覧。各タスクは次の情報を含む："
                    "タスク名、優先度（Must, Should, Could）、具体的な内容。"
                ),
                type="array(objects)"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        prompt_template = ChatPromptTemplate.from_template(
            template="""
                        あなたはアプリ制作のプロフェッショナルです。以下の情報に基づいて、アプリ制作に必要な全タスクを具体的にリストアップしてください。
                        ただし、環境構築に関するタスクは含めないでください。
                        仕様書:
                        {specification}
                        ディレクトリ構成:
                        {directory}
                        フレームワーク:
                        {framework}
                        各タスクには、タスク名、優先度（Must, Should, Could）、具体的な内容を含めてください。
                        具体的に言うと、task_name: str 、priority: str ("Must", "Should", "Could") のいずれか 、content: strの全てを必ず含むものです。
                        回答は以下のフォーマットに従い、JSON形式で出力してください。
                        {format_instructions}
                    """,
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        chain = prompt_template | self.llm_pro | parser
        result = chain.invoke({"specification": specification, "directory": directory, "framework": framework})
        return result["tasks"]
