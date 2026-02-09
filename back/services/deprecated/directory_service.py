from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from ..core import BaseService

class DirectoryService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_directory_structure(self, framework: str, specification: str) -> str:
        """
        仕様書とフレームワーク情報に基づいて、プロジェクトに適したディレクトリ構成を
        コードブロック形式のテキストとして生成する。
        """
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("directory_service", "generate_directory_structure"),
        )
        chain = prompt_template | self.llm_pro | StrOutputParser()
        result = chain.invoke({"framework": framework, "specification": specification})
        return result
