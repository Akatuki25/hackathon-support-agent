# import os
# from dotenv import load_dotenv
# import tomllib
# from langchain_openai import ChatOpenAI
# from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain.prompts import PromptTemplate
# from langchain.schema.runnable import RunnableSequence
# from langchain_core.output_parsers import StrOutputParser
# from langchain.output_parsers import ResponseSchema
# from langchain.output_parsers import ResponseSchema, StructuredOutputParser
# from langchain.prompts import ChatPromptTemplate
# from langchain.agents import AgentExecutor, create_tool_calling_agent
# from langchain.schema.runnable import RunnableLambda
# from langchain.schema.runnable import RunnablePassthrough



# load_dotenv('/workspaces/dream_step/back/.env.local')

# class YumeService():
#     def __init__(self):
#         with open("./prompts.toml", 'rb') as f:
#             self.prompts = tomllib.load(f)
#         self.flash_llm_pro = self._load_llm("gemini-2.0-pro-exp-02-05")
#         self.flash_exp = self._load_llm('gemini-2.0-flash-exp')
        

#     def _load_llm(self, model_type: str):
#         return ChatGoogleGenerativeAI(model=model_type, temperature=0.5,api_key=os.getenv('GOOGLE_API_KEY'))
    
#     def _get_medium_prompt(self, prompt: str):
#         print("Intermediate Output:", prompt)
#         return prompt
        
    
#     def generate_yume_question(self,yume_prompt:str):
#         # 構造体の設定
#         response_schemas = [
#         ResponseSchema(
#             name="Question", 
#             description="配列形式の項目リスト。例: {Question:[{Question: string,Anser:string}]}",
#             type="array(objects)"
#         )
#         ]
        
#         # パーサーの設定
#         parser = StructuredOutputParser.from_response_schemas(response_schemas)
#         # プロンプトの設定
#         prompt_template=ChatPromptTemplate.from_template(
#             template="""
#             あなたは、夢を語る人に対してそれの具体化を支援するためのエージェントです。
#             あなたは、次の夢をみる人たちにその夢が現実的に実現することができるように支援するアシスタントです。
#             彼ら彼女らの夢はかなり抽象的であるので具体的に質問をしてより具体的な目標や夢に変換するための質問をしてください。
#             また想定回答も送ってください。
#             質問:{yume_prompt}
#             回答は以下のフォーマットを参照してください。質問が具体的であれば、3から5個で、抽象的であればそれ以上生成してください。
#             {format_instructions}
#             """,
#             partial_variables={"format_instructions": parser.get_format_instructions()},
#         )
#         # Chainの実行
#         chain = prompt_template | self.flash_llm_pro| parser
#         result = chain.invoke({"yume_prompt": yume_prompt})
#         return result
#     def generate_yume_summary_agent(self,yume_answer:list[str]):
#         yume_answer = "\n".join([f"Q: {item['Question']}\nA: {item['Answer']}" for item in yume_answer])
#         yume_summary_system_prompt = ChatPromptTemplate.from_template(
#             template="""
#             あなたは夢を語る人に対してそれの具体化を支援するエージェントです。
#             あなたは、夢を具体化するために必要な質問をして次のような回答をユーザーから得ることが出来ました。
#             この時に、ユーザーから得た回答をもとに、夢の実現のための要約を作成してください。
#             {yume_answer}
#             """
#         )
#         chain = yume_summary_system_prompt | self.flash_exp | StrOutputParser()
#         yume_summary = chain.invoke({"yume_answer": yume_answer})
#         return yume_summary
    
#     def generate_yume_object_and_task(self,yume_summary:str):
#         print('yume_summary:',yume_summary)
#         # 構造体の設定
#         object_response_schemas = [
#         ResponseSchema(
#             name="Objects", 
#             description="配列形式の項目リスト。例: [{Date: string,Object: string}]",
#             type="array(objects)"
#         )
#         ]
#         # yume_stepの構造体の設定
#         yume_step_response_schemas = [
#             ResponseSchema(
#                 name="tasks",
#                 description="配列形式の項目リスト。例: [{Date:string ,Objects: string,Task: string[]}]",
#                 type="array(objects)"
#             )
#         ]
        
        
#         object_parser = StructuredOutputParser.from_response_schemas(object_response_schemas)
#         yume_step_parser = StructuredOutputParser.from_response_schemas(yume_step_response_schemas)
#         yume_object_system_prompt = PromptTemplate(
#             input_variables=["yume_summary"],
#             partial_variables={"format_instructions": object_parser.get_format_instructions()},
#             template="""
#             あなたは、夢を語る人のために、次の夢についての要約から、その夢を叶えるために、未来から逆算して、具体的な目標を生成するエージェントです。
#             たとえば、場合、その夢を叶えるために、具体的な目標として、次のような形式で目標を生成してください。
#             夢の要約: {yume_summary}
#             ただし、中長期スパンで目標を設定するために、次のように目標を生成し、
#             例: 1. 一週間後までに、〇〇を達成する。
#             2. 1ヶ月後までに、〇〇を達成する・できるようになる・勉強する。
#             3. 3ヶ月後までに、〇〇を達成する・できるようになる・勉強する。
#             4. 半年後までに、〇〇を達成する・できるようになる・勉強する。
#             5. 1年後までに、〇〇を達成する・できるようになる・勉強する。
#             最後に次のような形式
#             回答は以下のフォーマットで出力してください。
#             {format_instructions}
#             """
#         )
#         yume_task_system_prompt = PromptTemplate(
#             partial_variables={"format_instructions": yume_step_parser.get_format_instructions(),"yume_summary":yume_summary},
#             input_variables=["yume_object"],
#             template = """
#             あなたは、目標を達成するために必要なタスクを生成するエージェントです。次のある一つの夢に向かっている人のために、その夢を最終的に達成するために必要なタスクを生成してください。
#             最終的に達成したい夢: {yume_summary}
#             この夢を達成するために必要なタスクを生成してください。
#             そして、そのタスクは次の中間目標に対して、具体的な行動になるように、中間目標一つに対して、タスクが複数個になるように、具体的なタスクを生成してください。中間目標は,[{{Date: string,Object: string}}]の形式で受け渡されます。
#             中間目標: {yume_object}
#             回答は以下のフォーマットで出力してください。
#             {format_instructions}
#             """,
#         )
        
#         object_chain = yume_object_system_prompt | self.flash_exp | object_parser 
#         yume_object = object_chain.invoke({"yume_summary": yume_summary})
#         print('yume_object:',yume_object)
#         yume_task_chain = yume_task_system_prompt | self.flash_llm_pro | yume_step_parser 
#         yume_task = yume_task_chain.invoke({"yume_object": yume_object})
#         return yume_task

    
    
    
    
# if __name__ == "__main__":
#     test_number = 2
#     yume_service = YumeService()
#     if test_number == 0:
#         output=yume_service.generate_yume_question("幸せになりたい！")
#         print(output)
#     if test_number == 1:
#         output = yume_service.generate_yume_summary_agent([{"Question":"幸せになりたい！","Answer":"幸せになるためには、自分の好きなことをすることが大切です。自分が好きなことは具体的には映画を見ることです"}])
#     if test_number == 2:
#         output = yume_service.generate_yume_object_and_task("私の夢はフルスタックエンジニアになることです。フルスタックエンジニアになるために、バックエンドのDBとフロントエンドのデザインを学びたいです。")
#         print(output)
        