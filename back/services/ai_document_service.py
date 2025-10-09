"""
AIドキュメント生成サービス
frame_work_docからAIドキュメントを生成
"""
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.output_parsers import StructuredOutputParser, ResponseSchema
from .base_service import BaseService
from sqlalchemy.orm import Session
from models.project_base import ProjectDocument, AIDocument
from typing import Optional, Dict, Any
import uuid


class AIDocumentService(BaseService):
    """AIドキュメント生成サービス"""

    def __init__(self, db: Session):
        super().__init__(db=db)

    async def generate_ai_document_from_framework(self, project_id: str) -> dict:
        """
        frame_work_docからAIDocumentテーブルにカテゴリ別ドキュメントを生成

        Args:
            project_id: プロジェクトID

        Returns:
            生成されたドキュメント情報
        """
        try:
            # プロジェクトドキュメントを取得
            project_uuid = uuid.UUID(project_id)
            project_doc = self.db.query(ProjectDocument).filter(
                ProjectDocument.project_id == project_uuid
            ).first()

            if not project_doc:
                raise ValueError(f"Project document not found for project_id: {project_id}")

            if not project_doc.frame_work_doc:
                raise ValueError(f"frame_work_doc is empty for project_id: {project_id}")

            # カテゴリ別AIドキュメント生成
            ai_docs = await self._generate_categorized_documents(
                frame_work_doc=project_doc.frame_work_doc,
                function_doc=project_doc.function_doc or "",
                specification=project_doc.specification or ""
            )

            # 既存のAIDocumentを取得または新規作成
            ai_document = self.db.query(AIDocument).filter(
                AIDocument.project_id == project_uuid
            ).first()

            if ai_document:
                # 既存レコードを更新
                ai_document.environment = ai_docs.get("environment")
                ai_document.front_end = ai_docs.get("front_end")
                ai_document.back_end = ai_docs.get("back_end")
                ai_document.database = ai_docs.get("database")
                ai_document.deployment = ai_docs.get("deployment")
                ai_document.ai_design = ai_docs.get("ai_design")
            else:
                # 新規作成
                ai_document = AIDocument(
                    project_id=project_uuid,
                    environment=ai_docs.get("environment"),
                    front_end=ai_docs.get("front_end"),
                    back_end=ai_docs.get("back_end"),
                    database=ai_docs.get("database"),
                    deployment=ai_docs.get("deployment"),
                    ai_design=ai_docs.get("ai_design")
                )
                self.db.add(ai_document)

            self.db.commit()
            self.db.refresh(ai_document)

            return {
                "success": True,
                "project_id": project_id,
                "ai_doc_id": str(ai_document.ai_doc_id),
                "generated_documents": ai_docs,
                "message": "AIドキュメントが正常に生成されました"
            }

        except Exception as e:
            self.db.rollback()
            raise ValueError(f"AIドキュメント生成エラー: {str(e)}")

    async def _generate_categorized_documents(
        self,
        frame_work_doc: str,
        function_doc: str = "",
        specification: str = ""
    ) -> Dict[str, str]:
        """
        LLMを使用してカテゴリ別AIドキュメントを生成

        Args:
            frame_work_doc: フレームワーク選択情報
            function_doc: 機能ドキュメント（オプション）
            specification: 仕様書（オプション）

        Returns:
            カテゴリ別ドキュメント辞書
        """
        response_schemas = [
            ResponseSchema(
                name="environment",
                description="環境構築サマリ。Docker、ローカル環境のセットアップ手順を含む",
                type="string"
            ),
            ResponseSchema(
                name="front_end",
                description="フロントエンド技術の詳細ドキュメント。選択された技術についての理由",
                type="string"
            ),
            ResponseSchema(
                name="back_end",
                description="バックエンド技術の詳細ドキュメント。API設計、認証、データ処理ロジックを含む",
                type="string"
            ),
            ResponseSchema(
                name="database",
                description="データベース設計ドキュメント。スキーマ設計、インデックス戦略、マイグレーション手順を含む",
                type="string"
            ),
            ResponseSchema(
                name="deployment",
                description="デプロイメントドキュメント。CI/CD、ホスティング環境、スケーリング戦略を含む",
                type="string"
            ),
            ResponseSchema(
                name="ai_design",
                description="全体的なシステムアーキテクチャとAI活用設計。技術スタック間の連携、データフローを含む",
                type="string"
            )
        ]

        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            """あなたは技術ドキュメントを作成する専門家です。

以下の情報から、プロジェクトのカテゴリ別技術ドキュメントを生成してください。

## フレームワーク選択情報
{frame_work_doc}

## 機能要件（参考）
{function_doc}

## 既存仕様書（参考）
{specification}

---

{format_instructions}

各カテゴリについて、以下のような詳細で実用的なドキュメントを生成してください：

- **environment**: 環境構築の完全な手順、前提条件、トラブルシューティング
- **front_end**: フロントエンド技術の選択理由、ディレクトリ構造、状態管理、ルーティング設計
- **back_end**: バックエンドAPI設計、認証・認可、ビジネスロジック、エラーハンドリング
- **database**: ERD、テーブル設計、インデックス戦略、データ整合性保証
- **deployment**: CI/CDパイプライン、環境変数管理、モニタリング戦略
- **ai_design**: システム全体のアーキテクチャ図、マイクロサービス連携、セキュリティ設計

すべてMarkdown形式で、実装可能な具体的な内容を含めてください。"""
        )

        chain = prompt_template | self.llm_flash | parser

        result = chain.invoke({
            "frame_work_doc": frame_work_doc,
            "function_doc": function_doc or "指定なし",
            "specification": specification or "指定なし",
            "format_instructions": parser.get_format_instructions()
        })

        return result

    def get_ai_document(self, project_id: str) -> Optional[Dict[str, Any]]:
        """
        生成済みAIドキュメントを取得

        Args:
            project_id: プロジェクトID

        Returns:
            AIDocument全体
        """
        try:
            project_uuid = uuid.UUID(project_id)
            ai_doc = self.db.query(AIDocument).filter(
                AIDocument.project_id == project_uuid
            ).first()

            if not ai_doc:
                return None

            return {
                "ai_doc_id": str(ai_doc.ai_doc_id),
                "project_id": str(ai_doc.project_id),
                "environment": ai_doc.environment,
                "front_end": ai_doc.front_end,
                "back_end": ai_doc.back_end,
                "database": ai_doc.database,
                "deployment": ai_doc.deployment,
                "ai_design": ai_doc.ai_design,
                "slide": ai_doc.slide
            }

        except Exception as e:
            raise ValueError(f"AIドキュメント取得エラー: {str(e)}")
