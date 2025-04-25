from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from .base_service import BaseService
# json_repair
from json_repair import repair_json
from copy import deepcopy

class DeployService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_deploy_service(self, specification:str ,framework :str):
        """
        
        """
        response_schemas = [
            ResponseSchema(
                name="deploy",
                description="ここに出力してください。Markdonw形式である程度の量で出力してください",
                type="string"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template="""
            あなたは、ハッカソンの支援をするためのAIエージェントです。
            あなたは以下の情報を元に最適なdeployサービスを提案してください。
            以下はフレームワーク情報です。 : {framework}
            次が仕様書です。 : {specification}
            その際、選択したdeployサービスの情報を以下の形式で出力してください。
            あなたはjson形式で出力することが求められています。それ以外のについては、システムに障害が発生するため、出力しないでください。
            {format_instructions}
            
            """,
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )
        
        # 中間出力を保存する辞書
        intermediate_results = {}
        def capture_output(x):
            intermediate_results["llm_output"] = x
            # ここでJSONを修正する
            # JSONの修正
            # AIMessageからコンテンツを取得
            print(intermediate_results)
            
            if hasattr(x, 'content'):
                content = x.content
            else:
                # AIMessageでない場合は文字列変換を試みる
                content = str(x)
            # JSONを修正
            repaired_json = repair_json(content)
            if hasattr(x, 'content'):
            # AIMessageの場合は、contentを置き換えた新しいオブジェクトを作成
                repaired_message = deepcopy(x)
                repaired_message.content = repaired_json
                return repaired_message
            else:
                # それ以外の場合は修復された文字列を返す
                return repaired_json

        chain = prompt_template | self.llm_flash_thinking | (lambda x: capture_output(x)) | parser
        result = chain.invoke({"specification": specification, "framework": framework})
        
        result["deploy"] = result["deploy"].replace("```markdown",'').replace("```",'')
        return result 
