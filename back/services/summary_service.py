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
            template="""
            あなたはプログラミング初心者のプロダクト開発を補助するハッカソン支援エージェントです。
            あなたは、プロダクト制作のための具体的な必要になる仕様の質問をして次のような回答をユーザーから得ることが出来ました。
            この時に、ユーザーから得た回答をもとに、プロダクト開発のための完全な仕様書を作成してください。
            この仕様書をもとにフレームワークを決定するのでフレームワークの記述は不要です。
            マークダウン形式の仕様書のみを返してください。それ以外を含めてはいけません。
            ```markdown
            ```
            という風に囲むの必要はありません。
            以下の回答をもとに、プロダクト開発のための完全な仕様書を作成してください。
            {question_answer}
            """
        )

        chain = summary_system_prompt | self.llm_pro | StrOutputParser()
        summary = chain.invoke({"question_answer": question_answer_str})
        return summary
