from typing import List, Union
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from pydantic import BaseModel
from .base_service import BaseService
from sqlalchemy.orm import Session
from langchain.text_splitter import MarkdownHeaderTextSplitter
from markdown_it import MarkdownIt
import uuid

from models.project_base import QA , ProjectDocument

from .mvp_judge_service import MVPJudgeService

# routerから渡されるPydanticモデルを想定
class SummaryQaItem(BaseModel):
    Question: str
    Answer: str

class SummaryService(BaseService):
    def __init__(self,db: Session):
        super().__init__(db=db)

    def generate_summary_from_qa_list(self, question_answer: List[Union[dict, BaseModel]]) -> str:
        """
        ユーザーのQ&A回答リストから要約を生成する（保存は行わない）。
        Pydanticモデルのリストと辞書のリストの両方に対応。
        
        Args:
            question_answer: Q&Aのリスト
            
        Returns:
            str: 生成された要約文字列
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

        return summary
    
    def generate_summary(self,project_id:str):
        """
        プロジェクトIDに紐づくQ&Aリストから要約を生成・保存する。
        
        Args:
            project_id: プロジェクトID
        Returns:
            ProjectDocument: 保存されたプロジェクトドキュメント
        """
        # QAリストをDBから取得
        qa_list: List[QA] = self.db.query(QA).filter(QA.project_id == project_id).all()
        if not qa_list:
            raise ValueError(f"No Q&A records found for project_id: {project_id}")
        
        formatted_qa_list = [ {"question": qa.question, "answer": qa.answer} for qa in qa_list ]
        summary = self.generate_summary_from_qa_list(formatted_qa_list)
        
        return summary
        
    
    
    def save_summary_to_project_document(self, project_id: uuid.UUID, summary: str) -> ProjectDocument:
        """
        生成された要約をプロジェクトドキュメントに保存する。
        
        Args:
            project_id: プロジェクトID
            summary: 保存する要約文字列
            
        Returns:
            ProjectDocument: 保存されたプロジェクトドキュメント
        """
        # DBにすでにあるかを確認する
        existing_doc = self.db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()
        if existing_doc:
            # すでにある場合は更新する
            existing_doc.specification = summary
            self.db.commit()
            self.db.refresh(existing_doc)
            return existing_doc
        else:
            # DBに保存する
            new_doc = ProjectDocument(
                doc_id=uuid.uuid4(),
                project_id=project_id,
                specification=summary,
                function_doc="",
                frame_work_doc="",
                directory_info=""
            )
            self.db.add(new_doc)
            self.db.commit()
            self.db.refresh(new_doc)
            return new_doc
