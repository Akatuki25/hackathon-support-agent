from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .base_service import BaseService

class taskChatService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_response(self, specification: str, directory_structure: str, chat_history: str, user_question: str, framework: str, taskDetail: str) -> str:
        """
        仕様書、ディレクトリ構造、チャット履歴、新たなユーザーからの質問内容、
        使用しているフレームワークに基づいて、最適な回答をテキスト形式で生成する。
        """
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("task_chat_service", "generate_response")
        )
        chain = prompt_template | self.llm_flash | StrOutputParser()
        result = chain.invoke({
            "specification": specification,
            "directory_structure": directory_structure,
            "chat_history": chat_history,
            "user_question": user_question,
            "framework": framework,
            "taskDetail": taskDetail
        })
        return result
