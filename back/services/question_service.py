from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from langchain.schema.runnable import RunnableSequence
from .base_service import BaseService

class QuestionService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_question(self, idea_prompt: str):
        """
        Q&Aの質問と想定回答を生成するメソッド。
        """
        response_schemas = [
            ResponseSchema(
                name="Question",
                description="配列形式の項目リスト。例: {Question:[{Question:string,Answer:string}]}",
                type="array(objects)"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("question_service", "generate_question"),
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )

        chain = prompt_template | self.llm_flash_thinking | parser
        result = chain.invoke({"idea_prompt": idea_prompt})
        return {"result": {"Question": result["Question"]}}
