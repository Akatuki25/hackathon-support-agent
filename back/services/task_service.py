from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass
from typing import Dict, List, Optional

from langchain.agents import AgentExecutor, create_react_agent
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from models.project_base import  Task

from .base_service import BaseService


class GraphNode(BaseModel):
    """ReactFlow node schema."""

    id: str
    title: str
    label: str
    overview: str
    expected_time: str


class GraphEdge(BaseModel):
    """ReactFlow edge schema."""

    from_: str = Field(alias="from")
    to: str

    class Config:
        populate_by_name = True


class TaskGraph(BaseModel):
    """Top-level graph structure."""

    nodes: List[GraphNode]
    edges: List[GraphEdge]


class _EmptyToolArgs(BaseModel):
    """Structured tool placeholder without arguments."""

    pass


class _AreaSummary(BaseModel):
    """LLM summary payload for a specific area."""

    summary: str = Field(..., description="Concise Japanese summary")


class _AreaNode(BaseModel):
    """LLM response for node metadata."""
    title: str
    overview: str
    expected_time: str


@dataclass(slots=True)
class _AgentContext:
    """Execution context shared across tools."""

    project_id: uuid.UUID
    requirement: str
    directory: Optional[str]
    framework: Optional[str]


class TaskService(BaseService):
    """Service generating ReactFlow graphs via LangChain ReAct agent."""

    _ORIGIN_MARKER = "task_graph_agent"

    _AREA_CONFIG: Dict[str, Dict[str, str]] = {
        "environment": {
            "id": "env-setup",
            "label": "infra",
            "display": "環境構築",
            "summary_attr": "environment",
            "focus": "devcontainerの設定と共通開発環境の整備"
        },
        "frontend": {
            "id": "frontend",
            "label": "front",
            "display": "フロントエンド",
            "summary_attr": "front_end",
            "focus": "UI設計とアプリケーションの実装準備"
        },
        "backend": {
            "id": "backend",
            "label": "back",
            "display": "バックエンド",
            "summary_attr": "back_end",
            "focus": "API設計とサービスロジック"
        },
        "database": {
            "id": "database",
            "label": "infra",
            "display": "DB設計",
            "summary_attr": "database",
            "focus": "スキーマ設計とデータ永続化"
        },
        "ai": {
            "id": "ai-design",
            "label": "ai",
            "display": "AI設計",
            "summary_attr": "ai_design",
            "focus": "モデル連携と推論フロー"
        },
        "deployment": {
            "id": "deployment",
            "label": "infra",
            "display": "デプロイ",
            "summary_attr": "deployment",
            "focus": "リリースとCI/CD"
        },
        "slides": {
            "id": "slides",
            "label": "doc",
            "display": "スライド資料作成",
            "summary_attr": "slide",
            "focus": "プレゼン資料とデモ準備"
        },
    }

    _EDGE_TEMPLATE: List[tuple[str, str]] = [
        ("env-setup", "frontend"),
        ("env-setup", "backend"),
        ("backend", "database"),
        ("database", "ai-design"),
        ("frontend", "deployment"),
        ("backend", "deployment"),
        ("ai-design", "deployment"),
        ("deployment", "slides"),
    ]

    def __init__(self, db: Session):
        super().__init__(db=db)
        self._context: Optional[_AgentContext] = None

        self._summary_parser = PydanticOutputParser(pydantic_object=_AreaSummary)
        self._node_parser = PydanticOutputParser(pydantic_object=_AreaNode)
        self._graph_parser = PydanticOutputParser(pydantic_object=TaskGraph)

        self._summary_prompt = ChatPromptTemplate.from_template(
            """
            あなたはハッカソン支援のエキスパートです。以下の要求と補足情報を基に、{area_display}に関する短い要約を作成してください。
            要約は150文字以内、日本語で簡潔にまとめてください。
            特に{area_focus}に触れ、実施目的・主要タスク・成果物を整理してください。
            必ず次のJSONフォーマットのみで出力します。
            {format_instructions}

            ---
            要件定義書:
            {requirement}

            フレームワーク情報:
            {framework}
            """
        )

        self._node_prompt = ChatPromptTemplate.from_template(
            """
        あなたはプロジェクトマネージャーです。{area_display}フェーズの主要タスクを1ノードにまとめてください。
        以下の要約を基に、ノードのタイトル・概要・想定時間を決定します。
        想定時間は"4h"や"2d"などの短い記法で表現してください。
        出力は必ず次のJSONスキーマに従います。
        {format_instructions}

        ---
        フェーズ要約:
        {summary}

        追加コンテキスト:
        {requirement}
        """
        )

        self._agent_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", self._agent_instruction()),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
                MessagesPlaceholder("agent_scratchpad"),
            ]
        )

        self._store_tool = StructuredTool.from_function(
            func=self._store_summaries,
            coroutine=self._store_summaries_async,
            name="store_phase_summaries",
            description=(
                "要約資料を作成してデータベースに保存するときに使用します。"
                " 入力はJSONで良いですが無視されます。"
            ),
            args_schema=_EmptyToolArgs,
        )

        self._graph_tool = StructuredTool.from_function(
            func=self._build_graph,
            coroutine=self._build_graph_async,
            name="build_reactflow_graph",
            description=(
                "保存済みの要約からタスクノードを生成し、ReactFlowグラフJSONを返します。"
                " 出力は必ずJSON文字列です。"
            ),
            args_schema=_EmptyToolArgs,
        )

        agent = create_react_agent(
            self.llm_flash,
            [self._store_tool, self._graph_tool],
            prompt=self._agent_prompt,
        )
        self._executor = AgentExecutor(
            agent=agent,
            tools=[self._store_tool, self._graph_tool],
            verbose=False,
            handle_parsing_errors=True,
        )

    def _agent_instruction(self) -> str:
        return (
            "あなたはハッカソン支援AIです。Thought→Action→Observationの形式で推論し、"
            "必要に応じて提供されたツールを呼び出してください。"
            " 最終回答(Final Answer)は必ずReactFlowグラフのJSON文字列のみで、"
            "追加の説明やコードブロックを含めてはいけません。"
        )

    async def generate_reactflow_graph(
        self,
        project_id: uuid.UUID | str | None,
        requirement: str,
        directory: Optional[str] = None,
        framework: Optional[str] = None,
    ) -> TaskGraph:
        """Execute the agent and return validated graph output."""

        if not requirement:
            raise ValueError("requirement must not be empty")
        if project_id is None:
            raise ValueError("project_id is required")
        project_uuid = self._normalize_uuid(project_id)
        self._context = _AgentContext(
            project_id=project_uuid,
            requirement=requirement,
            directory=directory,
            framework=framework,
        )

        try:
            agent_input = "プロジェクトのタスク整理を開始してください。"
            result = await self._executor.ainvoke({"input": agent_input, "chat_history": []})
            raw_output = result.get("output", "")
            graph = self._graph_parser.parse(raw_output)
        except ValidationError as exc:
            self.logger.error("Graph validation failed: %s", exc, exc_info=True)
            raise ValueError("最終出力がGraphスキーマに一致しません") from exc
        finally:
            self._context = None

        return graph

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    def _require_context(self) -> _AgentContext:
        if not self._context:
            raise RuntimeError("Agent context is not set")
        return self._context

    def _store_summaries(self, _: _EmptyToolArgs | None = None) -> str:
        raise RuntimeError("store_phase_summaries must be awaited")

    async def _store_summaries_async(self, _: _EmptyToolArgs | None = None) -> str:
        ctx = self._require_context()
        doc = self._get_or_create_ai_document(ctx.project_id)

        tasks: List[asyncio.Task] = []
        for area_key, cfg in self._AREA_CONFIG.items():
            prompt = self._summary_prompt.partial(
                area_display=cfg["display"],
                area_focus=cfg["focus"],
                format_instructions=self._summary_parser.get_format_instructions(),
            )
            task = asyncio.create_task(
                self._invoke_prompt(
                    prompt,
                    {
                        "requirement": ctx.requirement,
                        "directory": ctx.directory or "情報なし",
                        "framework": ctx.framework or "情報なし",
                    },
                )
            )
            tasks.append(task)

        responses = await asyncio.gather(*tasks)

        summary_map: Dict[str, str] = {}
        for area_key, raw in zip(self._AREA_CONFIG.keys(), responses):
            parsed = self._summary_parser.parse(raw)
            summary_map[area_key] = parsed.summary.strip()

        doc.environment = summary_map.get("environment")
        doc.front_end = summary_map.get("frontend")
        doc.back_end = summary_map.get("backend")
        doc.database = summary_map.get("database")
        doc.ai_design = summary_map.get("ai")
        doc.deployment = summary_map.get("deployment")
        doc.slide = summary_map.get("slides")

        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)

        return "Summaries stored"

    def _build_graph(self, _: _EmptyToolArgs | None = None) -> str:
        raise RuntimeError("build_reactflow_graph must be awaited")

    async def _build_graph_async(self, _: _EmptyToolArgs | None = None) -> str:
        ctx = self._require_context()
        doc = self._get_ai_document(ctx.project_id)
        if not doc:
            raise ValueError("要約が保存されていません。まずstore_phase_summariesを実行してください。")

        summary_map = {
            key: getattr(doc, cfg["summary_attr"], None) or ""
            for key, cfg in self._AREA_CONFIG.items()
        }

        node_tasks = []
        for key, cfg in self._AREA_CONFIG.items():
            prompt = self._node_prompt.partial(
                area_display=cfg["display"],
                format_instructions=self._node_parser.get_format_instructions(),
            )
            task = asyncio.create_task(
                self._invoke_prompt(
                    prompt,
                    {
                        "summary": summary_map.get(key, ""),
                        "requirement": ctx.requirement,
                    },
                )
            )
            node_tasks.append((key, cfg, task))

        awaitables = [task for _, _, task in node_tasks]
        node_responses = await asyncio.gather(*awaitables)

        nodes: List[GraphNode] = []
        for (key, cfg, _), raw in zip(node_tasks, node_responses):
            parsed = self._node_parser.parse(raw)
            node = GraphNode(
                id=cfg["id"],
                title=parsed.title.strip(),
                label=cfg["label"],
                overview=parsed.overview.strip(),
                expected_time=parsed.expected_time.strip(),
            )
            nodes.append(node)

        edges = [GraphEdge(from_=src, to=dst) for src, dst in self._EDGE_TEMPLATE]
        graph = TaskGraph(nodes=nodes, edges=edges)

        await self._persist_tasks_async(ctx.project_id, graph)

        return graph.model_dump_json(by_alias=True, ensure_ascii=True)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_ai_document(self, project_id: uuid.UUID) -> Optional[AIDocument]:
        return (
            self.db.query(AIDocument)
            .filter(AIDocument.project_id == project_id)
            .one_or_none()
        )

    def _get_or_create_ai_document(self, project_id: uuid.UUID) -> AIDocument:
        doc = self._get_ai_document(project_id)
        if doc:
            return doc
        doc = AIDocument(project_id=project_id)
        self.db.add(doc)
        self.db.flush()
        return doc

    async def _persist_tasks_async(self, project_id: uuid.UUID, graph: TaskGraph) -> None:
        existing = (
            self.db.query(Task)
            .filter(Task.project_id == project_id)
            .all()
        )
        for task in existing:
            if not task.detail:
                continue
            try:
                detail = json.loads(task.detail)
            except json.JSONDecodeError:
                continue
            if detail.get("origin") == self._ORIGIN_MARKER:
                self.db.delete(task)

        self.db.flush()

        task_entities: Dict[str, Task] = {}
        for node in graph.nodes:
            detail_payload = {
                "origin": self._ORIGIN_MARKER,
                "node_id": node.id,
                "label": node.label,
                "expected_time": node.expected_time,
            }
            entity = Task(
                project_id=project_id,
                title=node.title,
                description=node.overview,
                detail=json.dumps(detail_payload, ensure_ascii=True),
                priority="Must",
            )
            self.db.add(entity)
            task_entities[node.id] = entity

        self.db.flush()

        for edge in graph.edges:
            source = task_entities.get(edge.from_)
            target = task_entities.get(edge.to)
            if source and target:
                target.depends_on_task_id = source.task_id

        self.db.commit()

    async def _invoke_prompt(self, prompt: ChatPromptTemplate, variables: Dict[str, str]) -> str:
        chain = prompt | self.llm_flash
        raw_response = await chain.ainvoke(variables)
        return self._extract_text(raw_response)

    @staticmethod
    def _extract_text(raw_response) -> str:
        if raw_response is None:
            return ""
        if isinstance(raw_response, str):
            return raw_response
        content = getattr(raw_response, "content", None)
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(str(part) for part in content)
        return str(raw_response)
