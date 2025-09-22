from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from langchain.schema.runnable import RunnableSequence
from .base_service import BaseService
from json_repair import repair_json
import uuid
from models.project_base import QA
import pydantic
from pydantic import BaseModel

from sqlalchemy.orm import Session

from typing import Any, Dict, Iterable, List, Sequence, Union
from pydantic import BaseModel
import uuid
from sqlalchemy.orm import Session

class QuestionService(BaseService):
    def __init__(self, db: Session):
        super().__init__(db=db)

    def generate_question(self, idea_prompt: str, project_id=None):
        """
        Q&Aの質問と想定回答を生成するメソッド。
        """
        self.logger.debug(f"Generating questions for project_id: {project_id} with idea_prompt: {idea_prompt}")
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
        
        # qa_idの設定
        for i in range(len(result["QA"])):
            result["QA"][i]["qa_id"] = str(uuid.uuid4())
        
        # follows_qa_idを出力された順に設定する。
        for i in range(1, len(result["QA"])):
            result["QA"][i]["follows_qa_id"] = result["QA"][i-1]["qa_id"]

        return {"QA": result["QA"]}


    def save_question(
        self, question: Union[Dict[str, Any], Sequence[Union[BaseModel, Dict[str, Any]]]]
    ):
        """
        受け取りは { "QA": [ ... ] } でも [ ... ] でもOK。
        各要素は Pydantic(BaseModel) でも dict でもOK。
        follows_qa_id がDBに無い場合は NULL に落として保存します。
        """
        # --- 正規化: qa_items を List[dict] にする ---
        if isinstance(question, dict) and "QA" in question:
            items = question["QA"]
        else:
            items = question  # すでに list/tuple の想定

        if not isinstance(items, Iterable):
            raise ValueError("save_question: payload must be a list or { 'QA': [...] }")

        to_insert: List[Dict[str, Any]] = []
        for item in items:
            d = item.model_dump() if isinstance(item, BaseModel) else dict(item)

            # 空文字は None に（UUID等のパース失敗回避）
            for k in ("answer", "source_doc_id", "follows_qa_id"):
                if k in d and d[k] == "":
                    d[k] = None

            # project_id を uuid.UUID に
            project_uuid = d.get("project_id")
            if isinstance(project_uuid, str):
                project_uuid = uuid.UUID(project_uuid)

            # follows_qa_id の存在チェック（無ければ None に落とす）
            follows = d.get("follows_qa_id")
            if follows:
                if isinstance(follows, str):
                    follows = uuid.UUID(follows)
                exists = self.db.query(QA.qa_id).filter(QA.qa_id == follows).first()
                if not exists:
                    follows = None  # ← 不正参照は切る（今回の要件に合わせてNULLへ）

            to_insert.append(
                {
                    "question": d.get("question"),
                    "answer": d.get("answer"),
                    "importance": int(d.get("importance", 0)),
                    "is_ai": bool(d.get("is_ai")),
                    "source_doc_id": d.get("source_doc_id"),
                    "follows_qa_id": follows,
                    "project_id": project_uuid,
                }
            )

        # --- DB INSERT ---
        try:
            for row in to_insert:
                self.db.add(QA(**row))
            self.db.commit()
            return {"message": "Questions saved successfully"}
        except Exception as e:
            self.db.rollback()
            if self.logger:
                self.logger(f"Failed to save questions: {e}")
            raise
