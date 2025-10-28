from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from .base_service import BaseService
from sqlalchemy.orm import Session
from models.project_base import ProjectBase, ProjectDocument, Env
from uuid import UUID

class EnvironmentService(BaseService):
    def __init__(self, db: Session = None):
        super().__init__()
        self.db = db

    def generate_hands_on(self, specification: str, directory: str, framework: str):
        """
            仕様書、ディレクトリ構成、フレームワーク情報に基づいて、以下の4つのハンズオン説明を生成する。
            - overall: 全体の環境構築ハンズオンの説明
            - devcontainer: .devcontainer の使い方と設定内容の詳細説明
            - frontend: フロントエンドの初期環境構築手順の詳細説明
            - backend: バックエンドの初期環境構築手順の詳細説明
            出力はMarkdown形式の文字列とし、JSON形式で返す。
        """
        response_schemas = [
            ResponseSchema(
                name="overall",
                description="全体の環境構築ハンズオンの説明。",
                type="string"
            ),
            ResponseSchema(
                name="devcontainer",
                description=".devcontainer の使い方と設定内容の詳細説明。",
                type="string"
            ),
            ResponseSchema(
                name="frontend",
                description="フロントエンドの初期環境構築手順の詳細説明。（ただし、.devcontainerで整う環境構築を再度ローカルで）",
                type="string"
            ),
            ResponseSchema(
                name="backend",
                description="バックエンドの初期環境構築手順の詳細説明。（ただし、.devcontainerで整う環境構築を再度ローカルで整える必要はありません）",
                type="string"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("environment_service", "generate_hands_on"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash | parser
        result = chain.invoke({
            "specification": specification,
            "directory": directory,
            "framework": framework
        })
        return result

    def generate_and_save_environment(self, project_id: str):
        """
        プロジェクトIDからProjectDocumentの情報を取得し、
        環境構築ハンズオン資料を生成してEnvテーブルに保存する。

        Args:
            project_id: プロジェクトID（文字列）

        Returns:
            dict: 生成結果
                - success: 成功フラグ
                - env_id: 環境レコードID
                - project_id: プロジェクトID
                - hands_on: 生成された環境構築資料
                - error: エラーメッセージ（エラー時のみ）

        Raises:
            ValueError: project_idが無効な形式の場合
            Exception: プロジェクトまたはドキュメントが見つからない場合
        """
        if not self.db:
            raise Exception("Database session is not provided")

        # UUIDに変換
        try:
            project_uuid = UUID(project_id)
        except ValueError:
            raise ValueError("Invalid project_id format")

        # プロジェクトの存在確認
        project = self.db.query(ProjectBase).filter(ProjectBase.project_id == project_uuid).first()
        if not project:
            raise Exception("Project not found")

        # ProjectDocumentから情報を取得
        doc = self.db.query(ProjectDocument).filter(ProjectDocument.project_id == project_uuid).first()
        if not doc:
            raise Exception("Project document not found")

        # 必要な情報が揃っているか確認
        if not doc.specification or not doc.directory_info or not doc.frame_work_doc:
            raise Exception("Project document is incomplete. Missing specification, directory_info, or frame_work_doc")

        # 環境構築資料を生成
        result = self.generate_hands_on(
            specification=doc.specification,
            directory=doc.directory_info,
            framework=doc.frame_work_doc
        )

        # Envレコードを探す（既存があれば更新、なければ作成）
        env = self.db.query(Env).filter(Env.project_id == project_uuid).first()

        if env:
            # 既存レコードを更新
            env.overall_hands_on = result.get("overall")
            env.devcontainer_hands_on = result.get("devcontainer")
            env.frontend_hands_on = result.get("frontend")
            env.backend_hands_on = result.get("backend")
        else:
            # 新規作成
            env = Env(
                project_id=project_uuid,
                overall_hands_on=result.get("overall"),
                devcontainer_hands_on=result.get("devcontainer"),
                frontend_hands_on=result.get("frontend"),
                backend_hands_on=result.get("backend")
            )
            self.db.add(env)

        self.db.commit()
        self.db.refresh(env)

        return {
            "success": True,
            "env_id": str(env.env_id),
            "project_id": str(project_uuid),
            "hands_on": {
                "overall": env.overall_hands_on,
                "devcontainer": env.devcontainer_hands_on,
                "frontend": env.frontend_hands_on,
                "backend": env.backend_hands_on
            }
        }

    def get_environment_by_project(self, project_id: str):
        """
        プロジェクトIDから保存されている環境構築ハンズオン資料を取得する。

        Args:
            project_id: プロジェクトID（文字列）

        Returns:
            dict: 環境構築資料
                - env_id: 環境レコードID
                - project_id: プロジェクトID
                - hands_on: 環境構築資料
                - created_at: 作成日時
                - updated_at: 更新日時

        Raises:
            ValueError: project_idが無効な形式の場合
            Exception: プロジェクトまたは環境構築資料が見つからない場合
        """
        if not self.db:
            raise Exception("Database session is not provided")

        # UUIDに変換
        try:
            project_uuid = UUID(project_id)
        except ValueError:
            raise ValueError("Invalid project_id format")

        # プロジェクトの存在確認
        project = self.db.query(ProjectBase).filter(ProjectBase.project_id == project_uuid).first()
        if not project:
            raise Exception("Project not found")

        # Envレコードを取得
        env = self.db.query(Env).filter(Env.project_id == project_uuid).first()
        if not env:
            raise Exception("Environment hands-on not found for this project")

        return {
            "env_id": str(env.env_id),
            "project_id": str(env.project_id),
            "hands_on": {
                "overall": env.overall_hands_on,
                "devcontainer": env.devcontainer_hands_on,
                "frontend": env.frontend_hands_on,
                "backend": env.backend_hands_on
            },
            "created_at": env.created_at.isoformat() if env.created_at else None,
            "updated_at": env.updated_at.isoformat() if env.updated_at else None
        }
