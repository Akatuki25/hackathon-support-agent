from langchain.prompts import ChatPromptTemplate
from .base_service import BaseService
import uuid
from models.project_base import QA
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Any, Dict, Iterable, List, Sequence, Union


# ============================================================================
# Pydantic Models for Structured Output
# ============================================================================

class QuestionItem(BaseModel):
    """単一のQ&Aアイテム"""
    question: str = Field(description="ユーザーへの質問文")
    answer: str = Field(description="想定される回答例")
    importance: int = Field(ge=1, le=5, description="重要度 (1-5)")


class QuestionOutput(BaseModel):
    """質問生成の出力"""
    QA: List[QuestionItem] = Field(description="生成された質問リスト")


# ============================================================================
# Service
# ============================================================================

class QuestionService(BaseService):
    def __init__(self, db: Session):
        super().__init__(db=db)

    def generate_question(self, idea_prompt: str, project_id=None):
        """
        Q&Aの質問と想定回答を生成するメソッド (Pydantic構造化出力版)
        """
        self.logger.debug(f"Generating questions for project_id: {project_id} with idea_prompt: {idea_prompt}")

        # Pydantic構造化出力を使用
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("question_service", "generate_question")
        )
        chain = prompt_template | self.llm_flash_thinking.with_structured_output(QuestionOutput)

        # LLM呼び出し
        result: QuestionOutput = chain.invoke({"idea_prompt": idea_prompt})

        # Pydanticモデルからdictに変換してDB保存用のメタデータを付与
        qa_list = []
        prev_qa_id = None

        for qa_item in result.QA:
            qa_id = str(uuid.uuid4())
            qa_dict = {
                "qa_id": qa_id,
                "question": qa_item.question,
                "answer": qa_item.answer,
                "importance": qa_item.importance,
                "is_ai": True,
                "source_doc_id": None,
                "project_id": project_id,
                "follows_qa_id": prev_qa_id,
            }
            qa_list.append(qa_dict)
            prev_qa_id = qa_id

        self.logger.info(f"Generated {len(qa_list)} questions for project_id: {project_id}")
        return {"QA": qa_list}


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
