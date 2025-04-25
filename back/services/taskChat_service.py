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
            template="""
            あなたはエンジニアを補助するプロフェッショナルなChatBotです。以下の情報を元に、ユーザーの質問に対して最適な回答をテキスト形式で提供してください。
            ユーザーが着手しているのはタスク詳細の内容で、仕様書、ディレクトリ構造などは全体を包括したものです。
            また、マークダウン形式で回答してください。
            現在のタスク詳細:
            {taskDetail}
            仕様書:
            {specification}
            ディレクトリ構造:
            {directory_structure}
            チャット履歴:
            {chat_history}
            新たなユーザーからのチャットでの質問内容:
            {user_question}
            使用しているフレームワーク:
            {framework}
            回答は、他の情報を含まずに、テキストのみで回答してください。
            """
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
