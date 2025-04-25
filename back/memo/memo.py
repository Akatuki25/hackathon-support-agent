import langchain
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
response_schemas = [
            ResponseSchema(
                name="deploy",
                description="あなたが選択したdeployサービスの情報をMarkdonw形式で出力してください",
                type="string"
            )
        ]
parser = StructuredOutputParser.from_response_schemas(response_schemas)
print(parser.get_format_instructions())