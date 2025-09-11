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
        md = MarkdownIt()
        tokens = md.parse(summary)
        # 改行が<br>に変換されてしまうため、元に戻す
        summary = "".join([token.content if token.type != "softbreak" else "\n" for token in tokens])
        
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

    def generate_and_save_summary_document(self, project_id: uuid.UUID, question_answer: List[Union[dict, BaseModel]]) -> str:
        """
        Q&Aリストから要約を生成し、プロジェクトドキュメントに保存する。
        
        Args:
            project_id: プロジェクトID
            question_answer: Q&Aのリスト
            
        Returns:
            str: 生成された要約文字列
        """
        summary = self.generate_summary_from_qa_list(question_answer)
        self.save_summary_to_project_document(project_id, summary)
        return summary

    def format_summary(self, summary: str):
        """
        マークダウン形式の要約を見出しごとに分割する。
        """
        headers_to_split_on = [("#", "section"), ("##", "subsection")]
        text_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
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

    def evaluate_project_summary(self, project_id: uuid.UUID) -> dict:
        """
        指定されたプロジェクトIDの既存の要約を評価する。
        評価が不十分な場合は、セクションごとに深掘りのためのQAを生成する。
        
        Args:
            project_id: 評価対象のプロジェクトID
            
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
        # プロジェクトドキュメントから既存の要約を取得
        project_doc = self.db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()
        if not project_doc or not project_doc.specification:
            raise ValueError(f"Project document not found or summary is empty for project_id: {project_id}")
        
        summary = project_doc.specification
        
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

    def generate_summary_and_evaluate(self, project_id: uuid.UUID) -> dict:
        """
        指定されたプロジェクトIDに基づいてQ&Aリストを取得し、要約を生成・保存して評価する。
        （従来のmainメソッドの代替）
        
        Args:
            project_id: プロジェクトID
            
        Returns:
            dict: 評価結果（evaluate_project_summaryと同じ形式）
        """
        qa_list: List[QA] = self.db.query(QA).filter(QA.project_id == project_id).all()
        
        if not qa_list:
            raise ValueError(f"No Q&A records found for project_id: {project_id}")
        
        formatted_qa_list = [ {"question": qa.question, "answer": qa.answer} for qa in qa_list ]

        # 要約を生成・保存
        self.generate_and_save_summary_document(project_id, formatted_qa_list)
        
        # 評価を実行
        return self.evaluate_project_summary(project_id)

    def update_qa_answers_and_regenerate(self, project_id: uuid.UUID, qa_updates: List[dict]) -> dict:
        """
        Q&Aの回答を更新し、要約を再生成・保存して再評価する。
        
        Args:
            project_id: プロジェクトID
            qa_updates: [{"qa_id": "...", "answer": "..."}, ...]
            
        Returns:
            dict: 評価結果
        """
        # Q&Aの回答を更新
        for update in qa_updates:
            qa_id = update["qa_id"]
            answer = update["answer"]
            
            if isinstance(qa_id, str):
                qa_id = uuid.UUID(qa_id)
            
            qa = self.db.query(QA).filter(QA.qa_id == qa_id).first()
            if qa:
                qa.answer = answer
        
        self.db.commit()
        
        # 更新されたQ&Aから要約を再生成・保存・評価
        return self.generate_summary_and_evaluate(project_id)
    
