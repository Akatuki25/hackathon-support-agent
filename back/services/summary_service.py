from typing import List, Union
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from pydantic import BaseModel
from .base_service import BaseService
from sqlalchemy.orm import Session
from langchain.text_splitter import MarkdownHeaderTextSplitter
from markdown_it import MarkdownIt
import uuid

from models.project_base import QA
from .mvp_judge_service import MVPJudgeService

# routerから渡されるPydanticモデルを想定
class SummaryQaItem(BaseModel):
    Question: str
    Answer: str

class SummaryService(BaseService):
    def __init__(self,db: Session):
        super().__init__(db=db)

    def generate_summary_document(self, question_answer: List[Union[dict, BaseModel]]):
        """
        ユーザーのQ&A回答リストから要約を生成する。
        Pydanticモデルのリストと辞書のリストの両方に対応。
        """
        question_answer_str = ""
        for item in question_answer:
            if hasattr(item, 'dict'):
                data = item.dict()
            else:
                data = item
            
            q = data.get('Question') or data.get('question')
            a = data.get('Answer') or data.get('answer')

            if q and a:
                question_answer_str += f"Q: {q}\nA: {a}\n"
        
        question_answer_str = question_answer_str.strip()

        summary_system_prompt = ChatPromptTemplate.from_template(
            template=self.get_prompt("summary_service", "generate_summary_document")
        )

        chain = summary_system_prompt | self.llm_pro | StrOutputParser()
        summary = chain.invoke({"question_answer": question_answer_str})
        md = MarkdownIt()
        tokens = md.parse(summary)
        return summary

    def format_summary(self, summary: str):
        """
        マークダウン形式の要約を見出しごとに分割する。
        """
        headers_to_split_on = [("#", "section"), ("##", "subsection")]
        text_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on, keep_header=True, remove_empty_headers=True)
        sections = text_splitter.split_text(summary)
        return sections

    def generate_qa_for_section(self, section_content: str) -> dict:
        """
        要件定義の1セクションを受け取り、内容を深掘りするための質問をJSON形式で生成する。
        """
        parser = JsonOutputParser()
        # プロンプトをサービス内に直接定義
        template = """以下の要件定義のセクションについて、内容の曖昧さをなくし、具体的な実装に進めるようにするために必要な確認事項を、JSON形式で3つ質問してください。

        【要件定義セクション】
        {section_content}

        【出力フォーマット指示】
        {format_instructions}
        """
        prompt = ChatPromptTemplate.from_template(
            template=template,
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )
        chain = prompt | self.llm_flash_thinking | parser
        return chain.invoke({"section_content": section_content})

    def main(self, project_id: uuid.UUID):
        """
        指定されたプロジェクトIDに基づいてQ&Aリストを取得し、要約を生成して評価する。
        評価が不十分な場合は、セクションごとに深掘りのためのQAを生成する。
        
        Returns:
            dict: 評価結果を含む辞書。構造は評価が合格か不合格かによって異なる。

            【評価が合格の場合 (`action`キーが `"proceed"`)】
            {
                "action": "proceed",
                "judge": { ... }  # MVPJudgeモデルの詳細な評価内容
            }

            【評価が不合格の場合 (`action`キーが `"ask_user"`)】
            {
                "action": "ask_user",
                "judge": { ... },             # MVPJudgeモデルの詳細な評価内容
                "questions": [ ... ],         # 全体に対するフォローアップ質問リスト
                "missing_items": [ ... ],     # 不足している情報のリスト
                "blockers": [ ... ],          # ブロッカーのリスト
                "sectional_qa": [             # ★不合格時に追加されるセクション毎の質問
                    {
                        "section_title": "セクションのタイトル",
                        "questions": [
                            "このセクションに関する具体的な質問1",
                            "このセクションに関する具体的な質問2"
                        ]
                    },
                    ...
                ]
            }
        """
        qa_list: List[QA] = self.db.query(QA).filter(QA.project_id == project_id).all()
        formatted_qa_list = [ {"question": qa.question, "answer": qa.answer} for qa in qa_list ]

        summary = self.generate_summary_document(formatted_qa_list)
        
        evaluation = MVPJudgeService(self.db)
        evaluation_result = evaluation.judge_and_route(summary)
        
        # 評価が不十分な場合、セクションごとのQAを生成して追加
        if evaluation_result.get("action") == "ask_user":
            sections = self.format_summary(summary)
            
            sectional_qas = []
            for section in sections:
                # Documentオブジェクトからヘッダーとコンテンツを取得
                header = " ".join(section.metadata.values())
                content = section.page_content
                
                # 各セクションについてQAを生成
                generated_qa = self.generate_qa_for_section(content)
                sectional_qas.append({
                    "section_title": header,
                    "questions": generated_qa.get("questions", []) # LLMの出力が期待通りでない場合も考慮
                })
            
            # 元の評価結果に、セクションごとのQAを追加
            evaluation_result["sectional_qa"] = sectional_qas
        
        return evaluation_result
    
