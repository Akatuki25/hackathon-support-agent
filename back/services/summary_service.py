from typing import List, Union, Dict, Any
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from pydantic import BaseModel, Field
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

class ConfidenceFeedback(BaseModel):
    overall_confidence: float = Field(description="Overall confidence score 0.0-1.0")
    clarity_score: float = Field(description="Specification clarity score 0.0-1.0")
    feasibility_score: float = Field(description="Technical feasibility score 0.0-1.0")
    scope_score: float = Field(description="Appropriate scope score 0.0-1.0")
    value_score: float = Field(description="User value score 0.0-1.0")
    completeness_score: float = Field(description="Information completeness score 0.0-1.0")

    clarity_feedback: str = Field(description="Detailed feedback on clarity")
    feasibility_feedback: str = Field(description="Detailed feedback on feasibility")
    scope_feedback: str = Field(description="Detailed feedback on scope")
    value_feedback: str = Field(description="Detailed feedback on value")
    completeness_feedback: str = Field(description="Detailed feedback on completeness")

    improvement_suggestions: List[str] = Field(description="List of improvement suggestions")
    confidence_reason: str = Field(description="Reason for overall confidence score")

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
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        qa_list: List[QA] = self.db.query(QA).filter(QA.project_id == project_uuid).all()
        if not qa_list:
            raise ValueError(f"No Q&A records found for project_id: {project_id}")

        formatted_qa_list = [ {"question": qa.question, "answer": qa.answer} for qa in qa_list ]
        summary = self.generate_summary_from_qa_list(formatted_qa_list)

        return summary

    def generate_summary_with_feedback(self, project_id: str) -> Dict[str, Any]:
        """
        プロジェクトIDに紐づくQ&Aリストから要約を生成し、確信度フィードバックも同時に返す

        Args:
            project_id: プロジェクトID
        Returns:
            Dict containing summary and confidence feedback
        """
        # 要約を生成
        summary = self.generate_summary(project_id)

        # 要約をDBに保存
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        saved_doc = self.save_summary_to_project_document(project_uuid, summary)

        # 確信度フィードバックを生成
        try:
            confidence_feedback = self.generate_confidence_feedback(project_id)
        except Exception as e:
            self.logger.warning(f"Failed to generate confidence feedback: {e}")
            # フィードバック生成に失敗してもエラーにせず、デフォルト値を返す
            confidence_feedback = {
                "overall_confidence": 0.7,
                "clarity_score": 0.7,
                "feasibility_score": 0.7,
                "scope_score": 0.7,
                "value_score": 0.7,
                "completeness_score": 0.7,
                "clarity_feedback": "評価を生成できませんでした",
                "feasibility_feedback": "評価を生成できませんでした",
                "scope_feedback": "評価を生成できませんでした",
                "value_feedback": "評価を生成できませんでした",
                "completeness_feedback": "評価を生成できませんでした",
                "improvement_suggestions": [],
                "confidence_reason": "評価を生成できませんでした"
            }

        return {
            "summary": summary,
            "doc_id": str(saved_doc.doc_id),
            "confidence_feedback": confidence_feedback
        }
        
    
    
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

    def generate_confidence_feedback(self, project_id: str) -> Dict[str, Any]:
        """
        プロジェクトIDから仕様書とQ&Aを取得し、確信度フィードバックを生成する

        Args:
            project_id: プロジェクトID

        Returns:
            Dict containing confidence feedback
        """
        self.logger.debug(f"Generating confidence feedback for project_id: {project_id}")

        # プロジェクトドキュメント（仕様書）を取得
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        project_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc or not project_doc.specification:
            raise ValueError(f"No specification found for project_id: {project_id}")

        # Q&Aリストを取得
        qa_list = self.db.query(QA).filter(QA.project_id == project_uuid).all()
        qa_context = ""
        if qa_list:
            qa_context = "\n".join([
                f"Q: {qa.question}\nA: {qa.answer or '未回答'}"
                for qa in qa_list
            ])

        # 確信度フィードバック生成のレスポンススキーマ
        response_schemas = [
            ResponseSchema(
                name="overall_confidence",
                type="float",
                description="全体の確信度 0.0-1.0"
            ),
            ResponseSchema(
                name="clarity_score",
                type="float",
                description="仕様の明確性スコア 0.0-1.0"
            ),
            ResponseSchema(
                name="feasibility_score",
                type="float",
                description="技術的実現可能性スコア 0.0-1.0"
            ),
            ResponseSchema(
                name="scope_score",
                type="float",
                description="スコープの適切性スコア 0.0-1.0"
            ),
            ResponseSchema(
                name="value_score",
                type="float",
                description="ユーザー価値スコア 0.0-1.0"
            ),
            ResponseSchema(
                name="completeness_score",
                type="float",
                description="情報の完全性スコア 0.0-1.0"
            ),
            ResponseSchema(
                name="clarity_feedback",
                type="string",
                description="明確性に関する詳細フィードバック"
            ),
            ResponseSchema(
                name="feasibility_feedback",
                type="string",
                description="実現可能性に関する詳細フィードバック"
            ),
            ResponseSchema(
                name="scope_feedback",
                type="string",
                description="スコープに関する詳細フィードバック"
            ),
            ResponseSchema(
                name="value_feedback",
                type="string",
                description="ユーザー価値に関する詳細フィードバック"
            ),
            ResponseSchema(
                name="completeness_feedback",
                type="string",
                description="完全性に関する詳細フィードバック"
            ),
            ResponseSchema(
                name="improvement_suggestions",
                type="array(strings)",
                description="改善提案のリスト"
            ),
            ResponseSchema(
                name="confidence_reason",
                type="string",
                description="全体確信度の理由"
            )
        ]

        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        # プロンプトのパスを修正
        try:
            prompt_text = self.get_prompt("summary_service", "confidence_feedback")
        except Exception as e:
            self.logger.error(f"Failed to get prompt: {e}")
            # フォールバック用のデフォルトプロンプト
            prompt_text = """
あなたはプロジェクト仕様書の品質評価エキスパートです。
以下の仕様書とQ&Aの内容から、仕様書の完成度と確信度を分析し、フィードバックを提供してください。

仕様書:
{specification}

Q&Aの内容:
{question_answer}

以下の観点から分析し、JSON形式で回答してください:
{format_instructions}

評価観点:
1. 仕様の明確性 - 要件が明確に定義されているか
2. 技術的実現可能性 - 提案された機能が技術的に実現可能か
3. スコープの適切性 - ハッカソンの期間内で実現可能な範囲か
4. ユーザー価値 - エンドユーザーにとって価値のある機能か
5. 情報の完全性 - 開発に必要な情報が十分に含まれているか

各観点について詳細な理由と改善提案を含めてください。
"""

        prompt_template = ChatPromptTemplate.from_template(
            template=prompt_text,
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash_thinking | parser
        result = chain.invoke({
            "specification": project_doc.specification,
            "question_answer": qa_context
        })

        # 結果の検証と調整
        validated_result = {
            "overall_confidence": max(0.0, min(1.0, result.get("overall_confidence", 0.7))),
            "clarity_score": max(0.0, min(1.0, result.get("clarity_score", 0.7))),
            "feasibility_score": max(0.0, min(1.0, result.get("feasibility_score", 0.7))),
            "scope_score": max(0.0, min(1.0, result.get("scope_score", 0.7))),
            "value_score": max(0.0, min(1.0, result.get("value_score", 0.7))),
            "completeness_score": max(0.0, min(1.0, result.get("completeness_score", 0.7))),
            "clarity_feedback": result.get("clarity_feedback", ""),
            "feasibility_feedback": result.get("feasibility_feedback", ""),
            "scope_feedback": result.get("scope_feedback", ""),
            "value_feedback": result.get("value_feedback", ""),
            "completeness_feedback": result.get("completeness_feedback", ""),
            "improvement_suggestions": result.get("improvement_suggestions", []),
            "confidence_reason": result.get("confidence_reason", "")
        }

        return validated_result
