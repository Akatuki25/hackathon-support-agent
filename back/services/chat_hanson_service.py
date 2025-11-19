"""
Chat Hanson Service - Plan-and-Execute チャットエージェント

ProjectDocumentから仕様書、機能要件定義書、フレームワーク、ディレクトリ情報を取得し、
シンプルなPlan-and-Execute構成でユーザーの質問に答えるチャットサービス。
"""

from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

# Models
from models.project_base import ProjectDocument, ProjectBase

# Base Service
from services.base_service import BaseService


# =======================
# Pydantic スキーマ
# =======================

class PlanStep(BaseModel):
    """計画の各ステップ"""
    step_number: int = Field(description="ステップ番号")
    action: str = Field(description="実行するアクション")
    reasoning: str = Field(description="このステップの理由")


class Plan(BaseModel):
    """ユーザーの質問に答えるための計画"""
    question_summary: str = Field(description="質問の要約")
    steps: List[PlanStep] = Field(description="実行ステップのリスト")
    required_context: List[str] = Field(
        description="必要なコンテキスト（specification, function_doc, frame_work_doc, directory_info）"
    )


class ExecutionResult(BaseModel):
    """実行結果"""
    answer: str = Field(description="ユーザーへの回答")
    confidence: float = Field(description="回答の信頼度 0.0-1.0", ge=0.0, le=1.0)
    sources_used: List[str] = Field(description="使用した情報源")


# =======================
# State 定義
# =======================

class ChatState(TypedDict):
    """チャット状態"""
    project_id: str
    user_question: str
    chat_history: List[dict]  # 過去の会話履歴

    # コンテキスト情報
    specification: str
    function_doc: str
    frame_work_doc: str
    directory_info: str

    # ワークフロー状態
    plan: Plan | None
    execution_result: ExecutionResult | None
    final_answer: str


# =======================
# チャットサービス
# =======================

class ChatHansonService(BaseService):
    """Plan-and-Execute チャットエージェントサービス"""

    def __init__(self, db: Session, default_model_provider: str = "google"):
        """
        初期化

        Args:
            db: データベースセッション
            default_model_provider: モデルプロバイダ
        """
        super().__init__(db, default_model_provider)
        self.graph = self._build_graph()
        self.logger.info("ChatHansonService initialized successfully")

    def _build_graph(self) -> StateGraph:
        """LangGraphワークフローを構築"""
        self.logger.debug("Building LangGraph workflow")
        workflow = StateGraph(ChatState)

        # ノードを追加
        workflow.add_node("planning", self.planning_node)
        workflow.add_node("execute", self.execute_node)

        # エッジを追加
        workflow.set_entry_point("planning")
        workflow.add_edge("planning", "execute")
        workflow.add_edge("execute", END)

        self.logger.info("LangGraph workflow built successfully")
        return workflow.compile()

    def planning_node(self, state: ChatState) -> ChatState:
        """
        Planning ノード: ユーザーの質問を分析し、回答のための計画を立てる
        """
        self.logger.info("[PLANNING] Starting planning phase")
        user_question = state["user_question"]

        # プロンプトを取得
        system_prompt = self.get_prompt("chat_hanson", "planning_prompt")

        # ユーザープロンプト構築
        user_prompt = f"""
ユーザーの質問: {user_question}

この質問に答えるための計画を立ててください。
"""

        # LLMで計画生成
        try:
            plan = self.llm_pro.with_structured_output(Plan).invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ])

            self.logger.info(f"[PLANNING] Generated plan with {len(plan.steps)} steps")
            self.logger.info(f"[PLANNING] Required context: {plan.required_context}")

            state["plan"] = plan
        except Exception as e:
            self.logger.error(f"[PLANNING] Error generating plan: {e}", exc_info=True)
            # フォールバック: デフォルトプラン
            state["plan"] = Plan(
                question_summary=user_question[:100],
                steps=[
                    PlanStep(
                        step_number=1,
                        action="質問に直接回答する",
                        reasoning="プランニングエラーのためデフォルト動作"
                    )
                ],
                required_context=["specification", "function_doc"]
            )

        return state

    def execute_node(self, state: ChatState) -> ChatState:
        """
        Execute ノード: 計画に基づいて回答を生成
        """
        self.logger.info("[EXECUTE] Starting execution phase")

        plan = state["plan"]
        user_question = state["user_question"]

        # 必要なコンテキストを収集
        context_parts = []
        sources_used = []

        for ctx_name in plan.required_context:
            ctx_value = state.get(ctx_name, "")
            if ctx_value:
                context_parts.append(f"## {ctx_name.upper()}\n{ctx_value}")
                sources_used.append(ctx_name)

        available_context = "\n\n".join(context_parts)

        # チャット履歴をフォーマット
        chat_history_str = ""
        if state.get("chat_history"):
            history_lines = []
            for msg in state["chat_history"][-5:]:  # 直近5件
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_lines.append(f"{role.upper()}: {content}")
            chat_history_str = "\n".join(history_lines)

        # システムプロンプトを取得
        system_prompt = self.get_prompt("chat_hanson", "execution_prompt")

        # ユーザープロンプト構築
        user_prompt = f"""
# 計画
{plan.model_dump_json(indent=2)}

# ユーザーの質問
{user_question}

# 利用可能なコンテキスト情報
{available_context}

# 過去の会話履歴
{chat_history_str if chat_history_str else "なし"}

上記の計画とコンテキスト情報に基づいて、ユーザーの質問に答えてください。
"""

        # LLMで回答生成
        try:
            execution_result = self.llm_pro.with_structured_output(ExecutionResult).invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ])

            self.logger.info(f"[EXECUTE] Generated answer with confidence: {execution_result.confidence}")
            self.logger.info(f"[EXECUTE] Sources used: {execution_result.sources_used}")

            state["execution_result"] = execution_result
            state["final_answer"] = execution_result.answer
        except Exception as e:
            self.logger.error(f"[EXECUTE] Error generating answer: {e}", exc_info=True)
            # フォールバック: エラーメッセージ
            state["execution_result"] = ExecutionResult(
                answer="申し訳ございません。エラーが発生しました。もう一度お試しください。",
                confidence=0.0,
                sources_used=[]
            )
            state["final_answer"] = "申し訳ございません。エラーが発生しました。もう一度お試しください。"

        return state

    def get_project_context(self, project_id: str) -> dict:
        """
        ProjectDocumentからプロジェクトのコンテキスト情報を取得

        Args:
            project_id: プロジェクトID

        Returns:
            dict: コンテキスト情報
        """
        try:
            self.logger.debug(f"Fetching project context for project_id: {project_id}")

            # ProjectDocumentを取得
            stmt = select(ProjectDocument).where(ProjectDocument.project_id == project_id)
            result = self.db.execute(stmt)
            doc = result.scalar_one_or_none()

            if not doc:
                self.logger.warning(f"ProjectDocument not found for project_id: {project_id}")
                return {
                    "specification": "",
                    "function_doc": "",
                    "frame_work_doc": "",
                    "directory_info": ""
                }

            # ProjectBaseから基本情報も取得
            stmt_base = select(ProjectBase).where(ProjectBase.project_id == project_id)
            result_base = self.db.execute(stmt_base)
            project = result_base.scalar_one_or_none()

            context = {
                "specification": doc.specification or "",
                "function_doc": doc.function_doc or "",
                "frame_work_doc": doc.frame_work_doc or "",
                "directory_info": doc.directory_info or "",
            }

            # プロジェクト基本情報も追加
            if project:
                context["project_title"] = project.title
                context["project_idea"] = project.idea

            self.logger.info(f"Successfully loaded context for project_id: {project_id}")
            return context

        except Exception as e:
            self.logger.error(f"Error loading project context: {e}", exc_info=True)
            return {
                "specification": "",
                "function_doc": "",
                "frame_work_doc": "",
                "directory_info": ""
            }

    def chat(
        self,
        project_id: str,
        user_question: str,
        chat_history: List[dict] = None
    ) -> dict:
        """
        メインチャット関数

        Args:
            project_id: プロジェクトID
            user_question: ユーザーの質問
            chat_history: 過去の会話履歴

        Returns:
            dict: チャット結果
        """
        try:
            self.logger.info(f"[CHAT] Starting chat for project_id: {project_id}")
            self.logger.info(f"[CHAT] Question: {user_question}")

            # プロジェクトコンテキストを取得
            context = self.get_project_context(project_id)

            # 初期状態を構築
            initial_state: ChatState = {
                "project_id": project_id,
                "user_question": user_question,
                "chat_history": chat_history or [],
                "specification": context.get("specification", ""),
                "function_doc": context.get("function_doc", ""),
                "frame_work_doc": context.get("frame_work_doc", ""),
                "directory_info": context.get("directory_info", ""),
                "plan": None,
                "execution_result": None,
                "final_answer": ""
            }

            # ワークフローを実行
            final_state = self.graph.invoke(initial_state)

            self.logger.info("[CHAT] Workflow completed successfully")

            # 結果を返す
            return {
                "success": True,
                "answer": final_state["final_answer"],
                "confidence": final_state["execution_result"].confidence if final_state.get("execution_result") else 0.0,
                "sources_used": final_state["execution_result"].sources_used if final_state.get("execution_result") else [],
                "plan_steps": len(final_state["plan"].steps) if final_state.get("plan") else 0
            }

        except Exception as e:
            self.logger.error(f"[CHAT] Error in chat workflow: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "answer": "申し訳ございません。エラーが発生しました。もう一度お試しください。"
            }
