from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .base_service import BaseService
from sqlalchemy.orm import Session
from models.project_base import ProjectDocument
from typing import Optional, Dict, Any


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
