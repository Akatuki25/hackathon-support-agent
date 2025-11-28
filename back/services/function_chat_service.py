from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .base_service import BaseService
from sqlalchemy.orm import Session
from models.project_base import ProjectDocument
from typing import Optional, Dict, Any


class FunctionChatService(BaseService):
    """
    機能要件に関する質問に回答するチャットサービス
    機能要件の内容について、なぜその機能が必要なのかを説明する
    """

    def __init__(self, db: Session):
        super().__init__(db)
    
    def get_specification(self, project_id: str) -> Optional[str]:
        """
        project_idからProjectDocumentのspecificationを取得する

        Args:
            project_id: プロジェクトID

        Returns:
            仕様書の内容、存在しない場合はNone
        """
        try:
            doc = self.db.query(ProjectDocument).filter(
                ProjectDocument.project_id == project_id
            ).first()

            if not doc:
                self.logger.warning(f"ProjectDocument not found for project_id: {project_id}")
                return None

            return doc.specification or ""
        except Exception as e:
            self.logger.exception(f"Error fetching specification for project_id {project_id}: {e}")
            raise

    def get_function_doc(self, project_id: str) -> Optional[str]:
        """
        project_idからProjectDocumentのfunction_docを取得する

        Args:
            project_id: プロジェクトID

        Returns:
            機能要件書の内容、存在しない場合はNone
        """
        try:
            doc = self.db.query(ProjectDocument).filter(
                ProjectDocument.project_id == project_id
            ).first()

            if not doc:
                self.logger.warning(f"ProjectDocument not found for project_id: {project_id}")
                return None

            return doc.function_doc or ""
        except Exception as e:
            self.logger.exception(f"Error fetching function_doc for project_id {project_id}: {e}")
            raise

    def chat(
        self,
        project_id: str,
        user_question: str,
        chat_history: str = ""
    ) -> Dict[str, Any]:
        """
        機能要件に関するチャット機能

        Args:
            project_id: プロジェクトID
            user_question: ユーザーからの質問
            chat_history: これまでのチャット履歴（デフォルト: ""）

        Returns:
            回答を含む辞書
        """
        self.logger.info(f"Function chat started for project_id: {project_id}")

        # 機能要件書を取得
        function_doc = self.get_function_doc(project_id)
        if function_doc is None:
            raise ValueError(f"Function document not found for project_id: {project_id}")
        
        # 要件定義書を取得
        specification = self.get_specification(project_id)
        if specification is None:
            raise ValueError(f"Specification not found for project_id: {project_id}")
        
        
        # プロンプトテンプレートを作成
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("function_chat_service", "chat")
        )

        # チェーンを構築して実行
        chain = prompt_template | self.llm_flash | StrOutputParser()

        answer = chain.invoke({
            "function_doc": function_doc,
            "specification": specification,
            "chat_history": chat_history,
            "user_question": user_question
        })

        self.logger.info("Function chat completed successfully")

        return {
            "answer": answer
        }
