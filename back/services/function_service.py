from typing import List, Dict, Any
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from pydantic import BaseModel, Field
from .base_service import BaseService
from sqlalchemy.orm import Session
from json_repair import repair_json
import uuid

from models.project_base import QA, ProjectDocument


class FunctionalRequirement(BaseModel):
    requirement_id: str = Field(description="Unique identifier for the requirement")
    category: str = Field(description="Category of the requirement (e.g., 'authentication', 'data_management', 'user_interface')")
    title: str = Field(description="Brief title of the requirement")
    description: str = Field(description="Detailed description of the functional requirement")
    priority: str = Field(description="Priority level: Must, Should, Could")
    confidence_level: float = Field(description="Confidence level from 0.0 to 1.0")
    acceptance_criteria: List[str] = Field(description="List of acceptance criteria")
    dependencies: List[str] = Field(description="List of requirement IDs this depends on")


class RequirementWithQA(BaseModel):
    requirement: FunctionalRequirement
    clarification_questions: List[str] = Field(description="Questions for low confidence requirements")


class FunctionRequirementsResponse(BaseModel):
    requirements: List[RequirementWithQA] = Field(description="List of functional requirements with potential questions")
    overall_confidence: float = Field(description="Overall confidence level for all requirements")


class QAForRequirement(BaseModel):
    question: str = Field(description="Question to clarify the requirement")
    requirement_id: str = Field(description="ID of the requirement this question relates to")
    importance: int = Field(description="Importance level 1-5")


class FunctionService(BaseService):
    def __init__(self, db: Session):
        super().__init__(db=db)

    def generate_functional_requirements(self, project_id: str, confidence_threshold: float = 0.7) -> Dict[str, Any]:
        """
        プロジェクトIDから機能要件を生成し、確信度が低い項目についてはQAを生成する

        Args:
            project_id: プロジェクトID
            confidence_threshold: QA生成の閾値 (この値以下の確信度の要件にQAを生成)

        Returns:
            Dict containing requirements and questions
        """
        self.logger.debug(f"Generating functional requirements for project_id: {project_id}")

        # プロジェクトドキュメント（仕様書）を取得
        project_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_id
        ).first()

        if not project_doc or not project_doc.specification:
            raise ValueError(f"No specification found for project_id: {project_id}")

        # 既存のQ&Aも参考情報として取得
        existing_qas = self.db.query(QA).filter(QA.project_id == project_id).all()
        qa_context = ""
        if existing_qas:
            qa_context = "\n".join([
                f"Q: {qa.question}\nA: {qa.answer or '未回答'}"
                for qa in existing_qas
            ])

        # 機能要件生成のプロンプト
        response_schemas = [
            ResponseSchema(
                name="requirements",
                type="array(objects)",
                description=(
                    "機能要件のリスト。各要素は以下のフィールドを持つ: "
                    "requirement_id (string), category (string), title (string), "
                    "description (string), priority (string: Must/Should/Could), "
                    "confidence_level (float 0.0-1.0), acceptance_criteria (array of strings), "
                    "dependencies (array of requirement_ids)"
                )
            ),
            ResponseSchema(
                name="overall_confidence",
                type="float",
                description="全体の確信度 0.0-1.0"
            )
        ]

        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("function_service", "generate_functional_requirements"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash_thinking | parser
        result = chain.invoke({
            "specification": project_doc.specification,
            "qa_context": qa_context
        })

        # JSONの修復を試みる
        if not isinstance(result.get("requirements"), list):
            repaired = repair_json(
                json_like_string=str(result["requirements"]),
                array_root=True
            )
            result["requirements"] = repaired

        # 確信度が低い要件についてQAを生成
        low_confidence_requirements = []
        for req in result["requirements"]:
            if req.get("confidence_level", 1.0) < confidence_threshold:
                low_confidence_requirements.append(req)

        # 低確信度要件用のQA生成
        clarification_qas = []
        if low_confidence_requirements:
            clarification_qas = self._generate_clarification_questions(
                low_confidence_requirements,
                project_doc.specification,
                project_id
            )

        return {
            "requirements": result["requirements"],
            "overall_confidence": result.get("overall_confidence", 0.8),
            "clarification_questions": clarification_qas,
            "low_confidence_count": len(low_confidence_requirements)
        }

    def _generate_clarification_questions(self, requirements: List[Dict], specification: str, project_id: str) -> List[Dict[str, Any]]:
        """
        確信度が低い機能要件について明確化のための質問を生成する

        Args:
            requirements: 低確信度の機能要件リスト
            specification: 仕様書
            project_id: プロジェクトID

        Returns:
            List of clarification questions
        """
        self.logger.debug(f"Generating clarification questions for {len(requirements)} low-confidence requirements")

        requirements_text = ""
        for req in requirements:
            requirements_text += f"- ID: {req.get('requirement_id')}\n"
            requirements_text += f"  タイトル: {req.get('title')}\n"
            requirements_text += f"  説明: {req.get('description')}\n"
            requirements_text += f"  確信度: {req.get('confidence_level')}\n\n"

        response_schemas = [
            ResponseSchema(
                name="questions",
                type="array(objects)",
                description=(
                    "明確化質問のリスト。各要素は以下のフィールドを持つ: "
                    "question (string), answer_example (string), requirement_id (string), importance (integer 1-5)"
                )
            )
        ]

        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("function_service", "generate_clarification_questions"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash_thinking | parser
        result = chain.invoke({
            "specification": specification,
            "requirements_text": requirements_text
        })

        # JSONの修復を試みる
        if not isinstance(result.get("questions"), list):
            repaired = repair_json(
                json_like_string=str(result["questions"]),
                array_root=True
            )
            result["questions"] = repaired

        # QA形式に変換してバリデーション
        validated_qas = []
        for qa in result.get("questions", []):
            if not all(key in qa for key in ("question", "requirement_id", "importance")):
                self.logger.error(f"Missing fields in QA item: {qa}")
                continue

            if not isinstance(qa["importance"], int) or qa["importance"] < 1 or qa["importance"] > 5:
                self.logger.error(f"Invalid importance in QA item: {qa}")
                qa["importance"] = 3  # デフォルト値

            # SQLのための追加フィールド
            # answer_exampleが提供されていればそれを使用、なければNone
            answer_value = qa.get("answer_example", None)

            qa_item = {
                "qa_id": uuid.uuid4(),  # UUID型で作成
                "project_id": project_id,
                "question": qa["question"],
                "answer": answer_value,  # answer_exampleを使用（回答例として）
                "is_ai": True,
                "source_doc_id": None,
                "follows_qa_id": None,
                "importance": qa["importance"],
                "requirement_id": qa["requirement_id"]  # 追加情報として保持
            }
            validated_qas.append(qa_item)

        return validated_qas

    def save_functional_requirements_to_document(self, project_id: str, requirements: List[Dict]) -> ProjectDocument:
        """
        生成された機能要件をプロジェクトドキュメントに保存する

        Args:
            project_id: プロジェクトID
            requirements: 機能要件のリスト

        Returns:
            Updated ProjectDocument
        """
        self.logger.debug(f"Saving functional requirements to project document: {project_id}")

        # 機能要件をMarkdown形式にフォーマット
        requirements_md = self._format_requirements_as_markdown(requirements)

        # DBの既存ドキュメントを更新
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        existing_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if existing_doc:
            existing_doc.function_doc = requirements_md
            self.db.commit()
            self.db.refresh(existing_doc)
            return existing_doc
        else:
            # 新規作成
            new_doc = ProjectDocument(
                doc_id=uuid.uuid4(),
                project_id=project_uuid,
                specification="",
                function_doc=requirements_md,
                frame_work_doc="",
                directory_info=""
            )
            self.db.add(new_doc)
            self.db.commit()
            self.db.refresh(new_doc)
            return new_doc

    def _format_requirements_as_markdown(self, requirements: List[Dict]) -> str:
        """
        機能要件リストを文章形式のMarkdownにフォーマット
        人間が編集しやすいように、機能の説明と関係性を文章で表現する
        """
        md_content = "# 機能要件書\n\n"

        # カテゴリ別にグループ化
        categories = {}
        for req in requirements:
            category = req.get("category", "その他")
            if category not in categories:
                categories[category] = []
            categories[category].append(req)

        # 全体概要を生成
        md_content += "## 概要\n\n"
        md_content += "このドキュメントでは、プロジェクトの機能要件を説明します。"
        md_content += f"全体として{len(categories)}つの主要カテゴリに分類され、{len(requirements)}個の機能要件が定義されています。\n\n"

        # 各カテゴリの説明を文章形式で記述
        for category, reqs in categories.items():
            md_content += f"## {category}\n\n"

            # カテゴリの導入文
            must_reqs = [r for r in reqs if r.get('priority') == 'Must']
            should_reqs = [r for r in reqs if r.get('priority') == 'Should']
            could_reqs = [r for r in reqs if r.get('priority') == 'Could']

            intro = f"この{category}カテゴリには{len(reqs)}個の機能要件が含まれます。"
            if must_reqs:
                intro += f"そのうち{len(must_reqs)}個は必須機能(Must)であり、"
            if should_reqs:
                intro += f"{len(should_reqs)}個は推奨機能(Should)、"
            if could_reqs:
                intro += f"{len(could_reqs)}個はオプション機能(Could)です。"

            md_content += intro + "\n\n"

            # 各要件を文章形式で説明
            for idx, req in enumerate(reqs, 1):
                title = req.get('title', 'タイトル未設定')
                description = req.get('description', '説明未設定')
                priority = req.get('priority', 'Should')
                confidence = req.get('confidence_level', 0.8)

                # 優先度の日本語表現
                priority_text = {
                    'Must': '必須機能',
                    'Should': '推奨機能',
                    'Could': 'オプション機能'
                }.get(priority, '機能')

                md_content += f"### {idx}. {title}\n\n"

                # 文章形式での説明
                md_content += f"この機能は{priority_text}として分類されています。{description}\n\n"

                # 受入基準がある場合は文章で説明
                if req.get('acceptance_criteria'):
                    criteria_list = req['acceptance_criteria']
                    if len(criteria_list) == 1:
                        md_content += f"この機能の受入基準は「{criteria_list[0]}」です。\n\n"
                    else:
                        md_content += "この機能が完成したと判断するための受入基準は以下の通りです：\n"
                        for criteria in criteria_list:
                            md_content += f"- {criteria}\n"
                        md_content += "\n"

                # 依存関係を文章で説明
                if req.get('dependencies'):
                    deps = req['dependencies']
                    if len(deps) == 1:
                        md_content += f"なお、この機能は「{deps[0]}」の完成に依存しています。\n\n"
                    else:
                        dep_list = '」「'.join(deps)
                        md_content += f"なお、この機能は以下の要件の完成に依存しています：「{dep_list}」\n\n"

                # 確信度が低い場合は注意を促す
                if confidence < 0.7:
                    md_content += f"⚠️ **注意**: この要件の確信度は{confidence:.0%}と低めです。実装前に詳細な確認が必要です。\n\n"

                md_content += "---\n\n"

        return md_content

    def save_clarification_questions(self, questions: List[Dict]) -> Dict[str, str]:
        """
        明確化質問をDBに保存する

        Args:
            questions: 質問のリスト

        Returns:
            Success message
        """
        self.logger.debug(f"Saving {len(questions)} clarification questions to database")

        try:
            for q in questions:
                # requirement_idを除外してQAテーブルに保存
                qa_data = {k: v for k, v in q.items() if k != "requirement_id"}

                # project_idをUUID型に変換
                if isinstance(qa_data["project_id"], str):
                    qa_data["project_id"] = uuid.UUID(qa_data["project_id"])

                # qa_idが既にUUID型でない場合の安全な変換
                if isinstance(qa_data.get("qa_id"), str):
                    qa_data["qa_id"] = uuid.UUID(qa_data["qa_id"])

                self.db.add(QA(**qa_data))

            self.db.commit()
            return {"message": f"Successfully saved {len(questions)} clarification questions"}

        except Exception as e:
            self.db.rollback()
            self.logger.exception(f"Failed to save clarification questions: {e}")
            raise

    def generate_confidence_feedback(self, project_id: str) -> Dict[str, Any]:
        """
        プロジェクトIDから機能要件書とQ&Aを取得し、確信度フィードバックを生成する

        Args:
            project_id: プロジェクトID

        Returns:
            Dict containing confidence feedback
        """
        self.logger.debug(f"Generating confidence feedback for project_id: {project_id}")

        # プロジェクトドキュメント（機能要件書）を取得
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        project_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc or not project_doc.function_doc:
            raise ValueError(f"No function document found for project_id: {project_id}")

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
                description="要件の明確性スコア 0.0-1.0"
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
                description="開発価値スコア 0.0-1.0"
            ),
            ResponseSchema(
                name="completeness_score",
                type="float",
                description="要件の完全性スコア 0.0-1.0"
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
                description="開発価値に関する詳細フィードバック"
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
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("function_service.confidence_feedback", "generate_confidence_feedback"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash_thinking | parser
        result = chain.invoke({
            "function_document": project_doc.function_doc,
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