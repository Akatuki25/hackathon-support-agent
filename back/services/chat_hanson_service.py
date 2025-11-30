from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from .base_service import BaseService
from .tools.project_document_tool import ProjectDocumentTool, create_langchain_tools
from .tools.web_search_tool import WebSearchTool, create_langchain_tool as create_web_search_tool
from sqlalchemy.orm import Session
from models.project_base import ProjectDocument
from typing import Optional, Dict, Any, List
import os


class ChatHansonService(BaseService):
    """
    ハッカソン開発支援のためのチャットサービス
    Planning + Execute の2ステップで回答を生成
    """

    def __init__(self, db: Session):
        super().__init__(db)

    def get_project_context(self, project_id: str) -> Optional[Dict[str, str]]:
        """
        project_idからProjectDocumentの情報を取得する

        Args:
            project_id: プロジェクトID

        Returns:
            プロジェクトドキュメントの情報を含む辞書、存在しない場合はNone
        """
        try:
            doc = self.db.query(ProjectDocument).filter(
                ProjectDocument.project_id == project_id
            ).first()

            if not doc:
                self.logger.warning(f"ProjectDocument not found for project_id: {project_id}")
                return None

            return {
                "specification": doc.specification or "",
                "function_doc": doc.function_doc or "",
                "frame_work_doc": doc.frame_work_doc or "",
                "directory_info": doc.directory_info or ""
            }
        except Exception as e:
            self.logger.exception(f"Error fetching ProjectDocument for project_id {project_id}: {e}")
            raise

    def plan(
        self,
        user_question: str,
        project_context: Dict[str, str],
        chat_history: str = ""
    ) -> str:
        """
        Planning step: ユーザーの質問に対する回答計画を立てる

        Args:
            user_question: ユーザーからの質問
            project_context: プロジェクトドキュメントの情報
            chat_history: これまでのチャット履歴

        Returns:
            回答計画のテキスト
        """
        self.logger.info("Planning step started")

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("chat_hanson_service", "plan")
        )

        chain = prompt_template | self.llm_flash | StrOutputParser()

        result = chain.invoke({
            "specification": project_context.get("specification", ""),
            "function_doc": project_context.get("function_doc", ""),
            "framework": project_context.get("frame_work_doc", ""),
            "directory_info": project_context.get("directory_info", ""),
            "chat_history": chat_history,
            "user_question": user_question
        })

        self.logger.info("Planning step completed")
        return result

    def execute(
        self,
        user_question: str,
        plan: str,
        project_context: Dict[str, str],
        chat_history: str = ""
    ) -> str:
        """
        Execute step: 計画に基づいて実際の回答を生成する

        Args:
            user_question: ユーザーからの質問
            plan: Planning stepで作成した回答計画
            project_context: プロジェクトドキュメントの情報
            chat_history: これまでのチャット履歴

        Returns:
            最終的な回答テキスト
        """
        self.logger.info("Execute step started")

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("chat_hanson_service", "execute")
        )

        chain = prompt_template | self.llm_flash | StrOutputParser()

        result = chain.invoke({
            "specification": project_context.get("specification", ""),
            "function_doc": project_context.get("function_doc", ""),
            "framework": project_context.get("frame_work_doc", ""),
            "directory_info": project_context.get("directory_info", ""),
            "chat_history": chat_history,
            "user_question": user_question,
            "plan": plan
        })

        self.logger.info("Execute step completed")
        return result

    def chat(
        self,
        project_id: str,
        user_question: str,
        chat_history: str = "",
        return_plan: bool = False
    ) -> Dict[str, Any]:
        """
        メインのチャット機能: Planning → Execute の流れで回答を生成

        Args:
            project_id: プロジェクトID
            user_question: ユーザーからの質問
            chat_history: これまでのチャット履歴（デフォルト: ""）
            return_plan: 計画も返すかどうか（デフォルト: False）

        Returns:
            回答と計画（オプション）を含む辞書
        """
        self.logger.info(f"Chat started for project_id: {project_id}")

        # プロジェクトコンテキストを取得
        project_context = self.get_project_context(project_id)
        if not project_context:
            raise ValueError(f"Project context not found for project_id: {project_id}")

        # Step 1: Planning
        plan = self.plan(user_question, project_context, chat_history)

        # Step 2: Execute
        answer = self.execute(user_question, plan, project_context, chat_history)

        result = {
            "answer": answer
        }

        if return_plan:
            result["plan"] = plan

        self.logger.info("Chat completed successfully")
        return result

    def _create_react_tools(self, project_id: str) -> List[Tool]:
        """
        ReActエージェント用のツールリストを作成

        Args:
            project_id: プロジェクトID

        Returns:
            LangChain Tool オブジェクトのリスト
        """
        tools = []

        # プロジェクトドキュメント関連ツールを追加
        try:
            project_tools = create_langchain_tools(self.db, project_id)
            tools.extend(project_tools)
            self.logger.info(f"Added {len(project_tools)} project document tools")
        except Exception as e:
            self.logger.warning(f"Failed to create project document tools: {e}")

        # Web検索ツールを追加
        try:
            if os.getenv("TAVILY_API_KEY"):
                web_tool = create_web_search_tool()
                tools.append(web_tool)
                self.logger.info("Added web search tool")
            else:
                self.logger.warning("TAVILY_API_KEY not set, web search tool not available")
        except Exception as e:
            self.logger.warning(f"Failed to create web search tool: {e}")

        return tools

    def _create_react_agent_executor(
        self,
        project_id: str,
        chat_history: str = ""
    ) -> AgentExecutor:
        """
        ReActエージェントを作成

        Args:
            project_id: プロジェクトID
            chat_history: チャット履歴

        Returns:
            AgentExecutor
        """
        tools = self._create_react_tools(project_id)

        # ReActプロンプトテンプレート
        react_prompt = PromptTemplate.from_template("""
あなたはハッカソン開発支援のエキスパートAIエージェントです。
ユーザーからの質問に対して、利用可能なツールを使って情報を収集し、最適な回答を提供します。

# 利用可能なツール

{tools}

# チャット履歴
{chat_history}

# 回答方針

1. まずユーザーの質問を理解し、必要な情報を特定する
2. プロジェクトに関する質問の場合、まずプロジェクトドキュメントを確認する
3. 最新の技術情報やベストプラクティスが必要な場合、web_searchツールを活用する
4. 収集した情報を統合し、プロジェクトの文脈に沿った具体的な回答を提供する
5. コード例が必要な場合は、プロジェクトのフレームワークやディレクトリ構成に合わせる

# 注意事項

- プロジェクト固有の情報（仕様、タスク、技術スタック）を優先的に参照する
- 一般的なアドバイスではなく、このプロジェクトに特化した回答を心がける
- 不明な点がある場合は、適切なツールを使って確認してから回答する
- 回答はマークダウン形式で、構造化して分かりやすく出力する

# ReAct形式

質問に回答するには、以下の形式を使用してください:

Question: 回答する必要のある入力質問
Thought: 何をすべきかを常に考える
Action: 実行するアクション。以下のいずれか: [{tool_names}]
Action Input: アクションへの入力
Observation: アクションの結果
... (Thought/Action/Action Input/Observationは必要に応じて繰り返す)
Thought: 最終的な回答が分かった
Final Answer: 元の質問に対する最終的な回答

# 質問

Question: {input}

{agent_scratchpad}
""")

        # ReActエージェントを作成
        agent = create_react_agent(
            llm=self.llm_flash,
            tools=tools,
            prompt=react_prompt.partial(chat_history=chat_history)
        )

        # AgentExecutorを作成
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=10,
            return_intermediate_steps=True
        )

        return agent_executor

    def chat_with_react(
        self,
        project_id: str,
        user_question: str,
        chat_history: str = "",
        return_intermediate_steps: bool = False
    ) -> Dict[str, Any]:
        """
        ReActエージェントを使用したチャット機能

        Args:
            project_id: プロジェクトID
            user_question: ユーザーからの質問
            chat_history: これまでのチャット履歴
            return_intermediate_steps: 中間ステップも返すかどうか

        Returns:
            回答と中間ステップ（オプション）を含む辞書
        """
        self.logger.info(f"ReAct chat started for project_id: {project_id}")

        try:
            # ReActエージェントを作成
            agent_executor = self._create_react_agent_executor(
                project_id=project_id,
                chat_history=chat_history
            )

            # エージェントを実行
            result = agent_executor.invoke({
                "input": user_question
            })

            response = {
                "answer": result.get("output", "回答を生成できませんでした。")
            }

            if return_intermediate_steps:
                # 中間ステップを整形
                steps = []
                for step in result.get("intermediate_steps", []):
                    action, observation = step
                    steps.append({
                        "tool": action.tool,
                        "tool_input": action.tool_input,
                        "observation": str(observation)[:500]  # 長すぎる場合は切り詰め
                    })
                response["intermediate_steps"] = steps

            self.logger.info("ReAct chat completed successfully")
            return response

        except Exception as e:
            print(f"Error: {e}")
            self.logger.exception(f"ReAct chat failed: {e}")
            # フォールバック: 従来のchatメソッドを使用
            self.logger.info("Falling back to standard chat method")
            return self.chat(
                project_id=project_id,
                user_question=user_question,
                chat_history=chat_history,
                return_plan=False
            )
