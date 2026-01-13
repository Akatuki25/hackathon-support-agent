"""
環境構築AIエージェントサービス

frame_work_docからAIで環境構築情報を生成し、Envテーブルに保存する
"""

from langchain_core.prompts import ChatPromptTemplate
from langchain_classic.output_parsers import ResponseSchema, StructuredOutputParser
from sqlalchemy.orm import Session
from models.project_base import ProjectDocument, Env
from .base_service import BaseService
import uuid


class EnvSetupAgentService(BaseService):
    """
    frame_work_docからAIで環境構築情報を生成し、Envテーブルに保存するエージェント
    """

    def __init__(self, db: Session):
        super().__init__(db=db)

    def generate_and_save_env(self, project_id: str, force_regenerate: bool = False) -> dict:
        """
        メインエントリーポイント
        1. ProjectDocumentからframe_work_docを取得
        2. AIで環境構築情報を生成
        3. Envテーブルに保存
        4. 結果を返す

        Args:
            project_id: プロジェクトID
            force_regenerate: 既存データを削除して再生成するかどうか

        Returns:
            dict: 生成された環境構築情報とenv_id
        """
        self.logger.info(f"Starting env setup generation for project: {project_id}")

        # 1. frame_work_doc を取得
        frame_work_doc = self._get_framework_doc(project_id)
        if not frame_work_doc:
            raise ValueError(f"frame_work_doc not found for project: {project_id}. Please complete framework selection first.")

        # 2. 既存データの確認と処理
        if force_regenerate:
            self._delete_existing_env(project_id)

        # 3. AIで環境構築情報を生成
        env_data = self._generate_env_setup(frame_work_doc)

        # 4. Envテーブルに保存
        env = self._save_env(project_id, env_data)

        self.logger.info(f"Env setup generation completed for project: {project_id}, env_id: {env.env_id}")

        return {
            "env_id": str(env.env_id),
            "project_id": project_id,
            "front": env.front,
            "backend": env.backend,
            "devcontainer": env.devcontainer,
            "database": env.database,
            "deploy": env.deploy
        }

    def _get_framework_doc(self, project_id: str) -> str:
        """
        ProjectDocumentからframe_work_docを取得

        Args:
            project_id: プロジェクトID

        Returns:
            str: frame_work_doc の内容
        """
        self.logger.debug(f"Fetching frame_work_doc for project: {project_id}")

        doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == uuid.UUID(project_id)
        ).first()

        if not doc:
            self.logger.warning(f"ProjectDocument not found for project: {project_id}")
            return ""

        return doc.frame_work_doc or ""

    def _generate_env_setup(self, frame_work_doc: str) -> dict:
        """
        AIで環境構築情報を生成

        Args:
            frame_work_doc: フレームワーク情報

        Returns:
            dict: front, backend, devcontainer, database, deploy を含む辞書
        """
        self.logger.debug("Generating env setup with AI")

        response_schemas = [
            ResponseSchema(
                name="front",
                description="フロントエンド環境構築の詳細手順（Markdown形式）。Node.jsバージョン、パッケージマネージャー、依存関係インストール、開発サーバー起動、環境変数設定を含む。",
                type="string"
            ),
            ResponseSchema(
                name="backend",
                description="バックエンド環境構築の詳細手順（Markdown形式）。言語ランタイム、仮想環境作成、依存関係インストール、サーバー起動、環境変数設定を含む。",
                type="string"
            ),
            ResponseSchema(
                name="devcontainer",
                description=".devcontainer設定の説明と使い方（Markdown形式）。devcontainer.json設定、VS Code拡張機能、Docker設定、ポートフォワーディングを含む。",
                type="string"
            ),
            ResponseSchema(
                name="database",
                description="データベース環境構築手順（Markdown形式）。推奨DB、ローカル起動方法（Docker推奨）、マイグレーション、接続設定を含む。",
                type="string"
            ),
            ResponseSchema(
                name="deploy",
                description="デプロイ環境構築手順（Markdown形式）。推奨デプロイ先、CI/CD設定、本番環境変数管理、デプロイコマンドを含む。",
                type="string"
            )
        ]

        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("env_setup_agent_service", "generate_env_setup"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash | parser

        result = chain.invoke({
            "frame_work_doc": frame_work_doc
        })

        self.logger.debug("AI env setup generation completed")
        return result

    def _save_env(self, project_id: str, env_data: dict) -> Env:
        """
        Envテーブルに保存（既存があれば更新）

        Args:
            project_id: プロジェクトID
            env_data: 環境構築情報

        Returns:
            Env: 保存されたEnvオブジェクト
        """
        self.logger.debug(f"Saving env data for project: {project_id}")

        # 既存のEnvを検索
        existing_env = self.db.query(Env).filter(
            Env.project_id == uuid.UUID(project_id)
        ).first()

        if existing_env:
            # 更新
            existing_env.front = env_data.get("front", "")
            existing_env.backend = env_data.get("backend", "")
            existing_env.devcontainer = env_data.get("devcontainer", "")
            existing_env.database = env_data.get("database", "")
            existing_env.deploy = env_data.get("deploy", "")
            self.db.commit()
            self.db.refresh(existing_env)
            self.logger.info(f"Updated existing env: {existing_env.env_id}")
            return existing_env
        else:
            # 新規作成
            new_env = Env(
                env_id=uuid.uuid4(),
                project_id=uuid.UUID(project_id),
                front=env_data.get("front", ""),
                backend=env_data.get("backend", ""),
                devcontainer=env_data.get("devcontainer", ""),
                database=env_data.get("database", ""),
                deploy=env_data.get("deploy", "")
            )
            self.db.add(new_env)
            self.db.commit()
            self.db.refresh(new_env)
            self.logger.info(f"Created new env: {new_env.env_id}")
            return new_env

    def _delete_existing_env(self, project_id: str) -> None:
        """
        既存のEnvデータを削除

        Args:
            project_id: プロジェクトID
        """
        self.logger.debug(f"Deleting existing env for project: {project_id}")

        self.db.query(Env).filter(
            Env.project_id == uuid.UUID(project_id)
        ).delete()
        self.db.commit()

    def get_env_by_project(self, project_id: str) -> dict | None:
        """
        プロジェクトIDからEnvデータを取得

        Args:
            project_id: プロジェクトID

        Returns:
            dict | None: Envデータまたは None
        """
        env = self.db.query(Env).filter(
            Env.project_id == uuid.UUID(project_id)
        ).first()

        if not env:
            return None

        return {
            "env_id": str(env.env_id),
            "project_id": str(env.project_id),
            "front": env.front,
            "backend": env.backend,
            "devcontainer": env.devcontainer,
            "database": env.database,
            "deploy": env.deploy,
            "created_at": env.created_at.isoformat() if env.created_at else None
        }
