from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .base_service import BaseService
from sqlalchemy.orm import Session
from models.project_base import ProjectDocument
from typing import Optional, Dict, Any


class SpecificationChatService(BaseService):
    """
    仕様書に関する質問に回答するチャットサービス
    仕様書の内容について、なぜそのような仕様にしたのかを説明する
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

    def chat(
        self,
        project_id: str,
        user_question: str,
        chat_history: str = ""
    ) -> Dict[str, Any]:
        """
        仕様書に関するチャット機能

        Args:
            project_id: プロジェクトID
            user_question: ユーザーからの質問
            chat_history: これまでのチャット履歴（デフォルト: ""）

        Returns:
            回答を含む辞書
        """
        self.logger.info(f"Specification chat started for project_id: {project_id}")

        # 仕様書を取得
        specification = self.get_specification(project_id)
        if specification is None:
            raise ValueError(f"Specification not found for project_id: {project_id}")

        # プロンプトテンプレートを作成
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("specification_chat_service", "chat")
        )

        # チェーンを構築して実行
        chain = prompt_template | self.llm_flash | StrOutputParser()

        answer = chain.invoke({
            "specification": specification,
            "chat_history": chat_history,
            "user_question": user_question
        })

        self.logger.info("Specification chat completed successfully")

        return {
            "answer": answer
        }
