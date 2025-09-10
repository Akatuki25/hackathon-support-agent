from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from langchain.schema.runnable import RunnableSequence
from .base_service import BaseService
from json_repair import repair_json
import uuid
from models.project_base import QA

from sqlalchemy.orm import Session

class QuestionService(BaseService):
    def __init__(self, db: Session):
        super().__init__(db=db)

    def generate_question(self, idea_prompt: str, project_id=None):
        """
        Q&Aの質問と想定回答を生成するメソッド。
        """
                
        response_schemas = [
            ResponseSchema(
                name="QA",
                type="array(objects)",
                description=(
                    "リスト形式で、各要素が以下のフィールドを持つオブジェクトを生成してください。 "
                    " - question: string (the question text)\n"
                    " - answer: string (the answer text)\n"
                    " - importance: integer (priority/vote)\n"
                ),
            )
        ]

        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("question_service", "generate_question"),
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )
        chain = prompt_template | self.llm_flash_thinking | parser
        result = chain.invoke({"idea_prompt": idea_prompt})
        # 想定されるQAフォーマットでない場合には修正を試みる
        if not isinstance(result["QA"], list):
            repaired = repair_json(
                json_like_string=result["QA"],
                array_root=True,
            )
            result["QA"] = repaired
        
        # SQLのためのバリデーションを行う is_aiとsource_doc_idとproject_idを追加する
        validate_qa = []
        try:
            # QAについて必要なフィールドを使いする。
            for qa in result["QA"]:
                if not all(key in qa for key in ("question", "answer", "importance")):
                    
                    self.logger.error(f"Missing fields in QA item: {qa}")
                    
                    raise ValueError("Missing required fields in QA item")
                if not isinstance(qa["importance"], int):
                    self.logger.error(f"Missing fields in QA item: {qa}")
                    
                    raise ValueError("Importance must be an integer")

                # SQLのためのバリデーションを行う is_aiとsource_doc_idとproject_idを追加する
                qa["is_ai"] = True
                qa["source_doc_id"] = None
                qa["project_id"] = project_id

                validate_qa.append(qa)
            result["QA"] = validate_qa

        except Exception as e:
            self.logger.exception("Validation failed for QA items")
            raise e
        
        
        # follows_qa_idを出力された順に設定する。
        for i in range(1, len(result["QA"])):
            result["QA"][i]["follows_qa_id"] = result["QA"][i-1].get("qa_id", None)

        return {"result": {"QA": result["QA"]}}

    def save_question(self, question: dict):
        """
        質問と回答をDBに保存するメソッド
        {
            QA : [
                {
                    "question": "質問内容",
                    "answer": "回答内容",
                    "importance": 1,
                    "is_ai": True,
                    "source_doc_id": None,
                    "project_id": "プロジェクトID"
                },
                ...
            ]
        }
        """
        
        try:
            for qa_data in question.get("QA", []):
                # project_idが文字列で渡された場合も考慮し、UUIDオブジェクトに変換
                project_uuid = qa_data["project_id"]
                if isinstance(project_uuid, str):
                    project_uuid = uuid.UUID(project_uuid)

                new_question = QA(
                    question=qa_data["question"],
                    answer=qa_data["answer"],
                    importance=qa_data["importance"],
                    is_ai=qa_data["is_ai"],
                    source_doc_id=qa_data.get("source_doc_id"), # 存在しない場合も考慮
                    follows_qa_id=qa_data.get("follows_qa_id"), # 存在しない場合も考慮
                    project_id=project_uuid
                )
                self.db.add(new_question)
            
            self.db.commit()
            self.logger.info("Questions saved successfully")
            return {"message": "Questions saved successfully"}
        except Exception as e:
            self.logger.exception("Failed to save questions")
            self.db.rollback()
            self.logger.error(f"Error details: {e}")
            raise e