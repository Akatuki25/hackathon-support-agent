from __future__ import annotations

import json
import uuid
from typing import Dict, List, Literal, Sequence

from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from models.project_base import Task

from ..core import BaseService


class GeneratedTask(BaseModel):
    """LLM から得られる単一タスクのスキーマ。"""

    task_name: str = Field(..., description="タスク名")
    priority: Literal["Must", "Should", "Could"] = Field(
        ..., description="優先度 (Must/Should/Could)"
    )
    content: str = Field(..., description="タスク概要")


class GeneratedTaskList(BaseModel):
    """タスクの配列をまとめて扱うためのラッパー。"""

    tasks: List[GeneratedTask]


class TasksService(BaseService):
    """仕様情報からタスクリストを生成し、必要に応じてDBへ保存するサービス。"""

    def __init__(self, db: Session):
        super().__init__(db=db)

        self._parser = PydanticOutputParser(pydantic_object=GeneratedTaskList)
        prompt_template = self.get_prompt("tasks_service", "generate_tasks")
        self._prompt = ChatPromptTemplate.from_template(prompt_template).partial(
            format_instructions=self._parser.get_format_instructions()
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_tasks(
        self,
        specification: str,
        directory: str,
        framework: str,
        project_id: uuid.UUID | str | None = None,
        *,
        overwrite_existing: bool = True,
    ) -> List[Dict[str, str]]:
        """LLMでタスクリストを生成し、オプションでDBへ保存する。"""

        llm_payload = {
            "specification": specification,
            "directory": directory,
            "framework": framework,
        }
        self.logger.debug("Generating tasks with payload keys: %s", list(llm_payload.keys()))

        raw_response = (self._prompt | self.llm_flash).invoke(llm_payload)
        response_text = self._extract_text(raw_response)

        try:
            parsed = self._parser.parse(response_text)
        except ValidationError as exc:
            self.logger.error("Failed to parse tasks output: %s", exc, exc_info=True)
            raise ValueError("LLM response could not be parsed into tasks") from exc
        except json.JSONDecodeError as exc:
            self.logger.error("Invalid JSON returned from LLM: %s", response_text)
            raise ValueError("LLM response was not valid JSON") from exc

        tasks_as_dicts = [task.dict() for task in parsed.tasks]
        self.logger.info("Generated %d tasks", len(tasks_as_dicts))

        if project_id is not None:
            project_uuid = self._normalize_uuid(project_id)
            self._persist_tasks(project_uuid, parsed.tasks, overwrite_existing)

        return tasks_as_dicts

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_text(raw_response) -> str:
        """LangChainの出力が文字列/AIMessageなど異なる場合に備えたラッパー。"""

        if raw_response is None:
            return ""
        if isinstance(raw_response, str):
            return raw_response
        content = getattr(raw_response, "content", None)
        if isinstance(content, str):
            return content
        if isinstance(content, Sequence):
            # e.g. list[BaseMessageChunk]
            return "".join(str(part) for part in content)
        return str(raw_response)

    def _persist_tasks(
        self,
        project_id: uuid.UUID,
        tasks: Sequence[GeneratedTask],
        overwrite_existing: bool,
    ) -> None:
        """生成したタスクを task テーブルへ保存する。"""

        self.logger.debug(
            "Persisting %d tasks for project_id=%s (overwrite=%s)",
            len(tasks),
            project_id,
            overwrite_existing,
        )

        if overwrite_existing:
            (
                self.db.query(Task)
                .filter(Task.project_id == project_id)
                .delete(synchronize_session=False)
            )

        for task in tasks:
            entity = Task(
                project_id=project_id,
                title=task.task_name,
                description=task.content,
                priority=task.priority,
            )
            self.db.add(entity)

        self.db.commit()
        self.logger.info("Persisted %d tasks for project_id=%s", len(tasks), project_id)

    @staticmethod
    def _normalize_uuid(value: uuid.UUID | str) -> uuid.UUID:
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))
