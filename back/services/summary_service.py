from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .base_service import BaseService

class SummaryService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_summary_docment(self, question_answer: list[dict]):
        """
        ユーザーのQ&A回答リストから要約を生成する。
        """
        # list[dict] => "Q: 〇〇\nA: 〇〇" のテキストに変換
        question_answer_str = "\n".join(
            [f"Q: {item.dict()['Question']}\nA: {item.dict()['Answer']}" for item in question_answer]
        )


        summary_system_prompt = ChatPromptTemplate.from_template(
            template=self.get_prompt("summary_service", "generate_summary_document")
        )

        chain = summary_system_prompt | self.llm_pro | StrOutputParser()
        summary = chain.invoke({"question_answer": question_answer_str})
        return summary
