from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema
from langchain_core.output_parsers import StrOutputParser
from .base_service import BaseService
from sqlalchemy.orm import Session
from langchain.output_parsers import StructuredOutputParser, ResponseSchema
from typing import List, Dict, Any

class TechnologyService(BaseService):
    def __init__(self, db: Session):
        super().__init__(db=db)

    def generate_technology_document(self, selected_technologies: List[str], framework_doc: str = "") -> str:
        """
        選択された技術に基づいて、Docker環境でのインストール手順と
        公式ドキュメントへのリンクを含む技術ドキュメントを生成する。
        """

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("technology_service", "generate_technology_document")
        )

        technologies_text = ", ".join(selected_technologies)

        chain = prompt_template | self.llm_flash | StrOutputParser()
        result = chain.invoke({
            "selected_technologies": technologies_text,
            "framework_doc": framework_doc
        })
        return result

    def get_technology_installation_guide(self, technology_name: str) -> Dict[str, Any]:
        """
        特定の技術のインストールガイドと公式ドキュメントリンクを取得
        """

        response_schemas = [
            ResponseSchema(
                name="installation_steps",
                description="インストール手順の配列。各ステップは文字列。",
                type="array(strings)"
            ),
            ResponseSchema(
                name="docker_setup",
                description="Docker環境でのセットアップ手順の配列。",
                type="array(strings)"
            ),
            ResponseSchema(
                name="official_docs",
                description="公式ドキュメントのURL",
                type="string"
            ),
            ResponseSchema(
                name="getting_started_guide",
                description="入門ガイドのURL",
                type="string"
            ),
            ResponseSchema(
                name="prerequisites",
                description="前提条件の配列",
                type="array(strings)"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("technology_service", "get_installation_guide"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash | parser
        result = chain.invoke({"technology_name": technology_name})
        return result

    def generate_development_environment_setup(self, selected_technologies: List[str], project_type: str = "web") -> str:
        """
        選択された技術スタックに基づいて、統合的な開発環境のセットアップガイドを生成
        """

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("technology_service", "generate_environment_setup")
        )

        technologies_text = ", ".join(selected_technologies)

        chain = prompt_template | self.llm_flash | StrOutputParser()
        result = chain.invoke({
            "selected_technologies": technologies_text,
            "project_type": project_type
        })
        return result