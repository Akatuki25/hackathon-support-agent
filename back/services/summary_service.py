from typing import List, Union, Dict, Any, Optional
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel, Field
from .base_service import BaseService
from sqlalchemy.orm import Session
import uuid
from datetime import datetime, timedelta
import difflib
import re
import os
import json
try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False
    genai = None
    types = None
from models.project_base import QA, ProjectDocument
from .mvp_judge_service import MVPJudgeService

# routerから渡されるPydanticモデルを想定
class SummaryQaItem(BaseModel):
    Question: str
    Answer: str

class MissingInformation(BaseModel):
    """不足している情報項目"""
    category: str = Field(description="カテゴリ（例: 技術要件、ユーザー要件、非機能要件）")
    question: str = Field(description="具体的な質問")
    why_needed: str = Field(description="なぜこの情報が必要か")
    priority: str = Field(description="優先度（high/medium/low）")

class SpecificationFeedback(BaseModel):
    """仕様書評価フィードバック（Pydantic構造化出力用）"""
    summary: str = Field(description="仕様書の全体的な評価サマリー")
    strengths: List[str] = Field(description="現在の仕様書の強み")
    missing_info: List[MissingInformation] = Field(description="不足している情報のリスト")
    suggestions: List[str] = Field(description="改善提案")


class CacheMetadata(BaseModel):
    """LLMキャッシュのメタデータ"""
    project_id: str
    cache_name: str
    summary_snapshot: str
    qa_snapshot: str
    created_at: datetime

class SummaryService(BaseService):
    def __init__(self,db: Session):
        super().__init__(db=db)
        self._cache = {}  # project_id -> (summary_snapshot, qa_snapshot, cache_name)
        # Google GenAI クライアント初期化
        if HAS_GENAI:
            self.genai_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        else:
            self.genai_client = None
            self.logger.warning("Google GenAI SDK not installed. Context caching will be unavailable.")

    async def generate_summary_from_qa_list(self, question_answer: List[Union[dict, BaseModel]]) -> str:
        """
        ユーザーのQ&A回答リストから要約を生成する（保存は行わない）。
        Pydanticモデルのリストと辞書のリストの両方に対応。
        非同期版に最適化

        Args:
            question_answer: Q&Aのリスト

        Returns:
            str: 生成された要約文字列
        """
        question_answer_str = ""
        for item in question_answer:
            if hasattr(item, 'dict'):
                data = item.dict()
            else:
                data = item

            q = data.get('Question') or data.get('question')
            a = data.get('Answer') or data.get('answer')

            if q and a:
                question_answer_str += f"Q: {q}\nA: {a}\n"

        question_answer_str = question_answer_str.strip()

        summary_system_prompt = ChatPromptTemplate.from_template(
            template=self.get_prompt("summary_service", "generate_summary_document")
        )

        chain = summary_system_prompt | self.llm_pro | StrOutputParser()
        summary = await chain.ainvoke({"question_answer": question_answer_str})

        return summary
    
    async def generate_summary(self,project_id:str):
        """
        プロジェクトIDに紐づくQ&Aリストから要約を生成・保存する。
        非同期版に最適化

        Args:
            project_id: プロジェクトID
        Returns:
            ProjectDocument: 保存されたプロジェクトドキュメント
        """
        # QAリストをDBから取得
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        qa_list: List[QA] = self.db.query(QA).filter(QA.project_id == project_uuid).all()
        if not qa_list:
            raise ValueError(f"No Q&A records found for project_id: {project_id}")

        formatted_qa_list = [ {"question": qa.question, "answer": qa.answer} for qa in qa_list ]
        summary = await self.generate_summary_from_qa_list(formatted_qa_list)

        return summary

    async def generate_summary_with_feedback(self, project_id: str) -> Dict[str, Any]:
        """
        プロジェクトIDに紐づくQ&Aリストから要約を生成し、仕様書評価も同時に返す
        差分ベース：既存仕様書がある場合は、手動編集と新規Q&Aのみ反映
        非同期版に最適化

        Args:
            project_id: プロジェクトID
        Returns:
            Dict containing summary, doc_id, and specification_feedback
        """
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id

        # 既存の仕様書があるかチェック
        existing_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if existing_doc and existing_doc.specification:
            # 既存仕様書がある場合：差分ベースで更新
            self.logger.info(f"既存仕様書を検出。差分ベースで更新します。")

            # 手動編集の差分を検出
            manual_diff = self.detect_manual_edits(project_id)

            # 前回生成日時以降の新規Q&Aを取得
            last_generated_at = existing_doc.created_at or datetime.min
            new_qa = self.get_new_qa_since_last_generation(project_id, last_generated_at)

            if manual_diff or new_qa:
                self.logger.info(f"差分検出: 手動編集={bool(manual_diff)}, 新規Q&A={len(new_qa)}件")
                # キャッシュを使用した差分更新
                summary = await self.update_summary_with_diff_cached(project_id, manual_diff, new_qa)
            else:
                self.logger.info("差分なし。既存仕様書を使用します。")
                summary = existing_doc.specification
        else:
            # 初回生成：全Q&Aから生成
            self.logger.info("初回生成：全Q&Aから仕様書を生成します。")
            summary = await self.generate_summary(project_id)

        # 要約をDBに保存
        saved_doc = self.save_summary_to_project_document(project_uuid, summary)

        # 仕様書フィードバックを生成
        try:
            specification_feedback = await self.generate_confidence_feedback(project_id)

            # missing_infoを追加Q&Aに変換して保存
            if specification_feedback.get("missing_info"):
                self._create_qa_from_missing_info(project_uuid, specification_feedback["missing_info"])

        except Exception as e:
            self.logger.warning(f"Failed to generate specification feedback: {e}")
            # フィードバック生成に失敗してもエラーにせず、デフォルト値を返す
            specification_feedback = {
                "summary": "評価を生成できませんでした",
                "strengths": [],
                "missing_info": [],
                "suggestions": []
            }

        return {
            "summary": summary,
            "doc_id": str(saved_doc.doc_id),
            "specification_feedback": specification_feedback
        }
        
    
    
    def save_summary_to_project_document(self, project_id: uuid.UUID, summary: str) -> ProjectDocument:
        """
        生成された要約をプロジェクトドキュメントに保存する。
        
        Args:
            project_id: プロジェクトID
            summary: 保存する要約文字列
            
        Returns:
            ProjectDocument: 保存されたプロジェクトドキュメント
        """
        # DBにすでにあるかを確認する
        existing_doc = self.db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).first()
        if existing_doc:
            # すでにある場合は更新する
            existing_doc.specification = summary
            self.db.commit()
            self.db.refresh(existing_doc)
            return existing_doc
        else:
            # DBに保存する
            new_doc = ProjectDocument(
                doc_id=uuid.uuid4(),
                project_id=project_id,
                specification=summary,
                function_doc="",
                frame_work_doc="",
                directory_info=""
            )
            self.db.add(new_doc)
            self.db.commit()
            self.db.refresh(new_doc)
            return new_doc

    async def generate_confidence_feedback(self, project_id: str) -> Dict[str, Any]:
        """
        プロジェクトIDから仕様書とQ&Aを取得し、仕様書評価フィードバックを生成する（Pydantic版）
        非同期版に最適化

        Args:
            project_id: プロジェクトID

        Returns:
            Dict containing specification feedback
        """
        self.logger.debug(f"Generating confidence feedback for project_id: {project_id}")

        # プロジェクトドキュメント（仕様書）を取得
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        project_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc or not project_doc.specification:
            raise ValueError(f"No specification found for project_id: {project_id}")

        # Q&Aリストを取得（全て）
        qa_list = self.db.query(QA).filter(QA.project_id == project_uuid).all()
        qa_context = "\n".join([
            f"Q: {qa.question}\nA: {qa.answer or '未回答'}"
            for qa in qa_list
        ]) if qa_list else "Q&Aなし"

        # Pydantic構造化出力を使用
        prompt_text = self.get_prompt("summary_service", "evaluate_specification")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        chain = prompt_template | self.llm_flash_thinking.with_structured_output(SpecificationFeedback)

        result: SpecificationFeedback = await chain.ainvoke({
            "specification": project_doc.specification,
            "question_answer": qa_context
        })

        return result.model_dump()

    def detect_manual_edits(self, project_id: str) -> Optional[str]:
        """
        DBに保存されている仕様書と、キャッシュされた仕様書の差分を検出する

        Args:
            project_id: プロジェクトID

        Returns:
            手動編集の差分テキスト。差分がなければNone
        """
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id

        # DBから現在の仕様書を取得
        project_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc or not project_doc.specification:
            return None

        current_spec = project_doc.specification.strip()

        # キャッシュから前回の仕様書を取得
        cache_key = str(project_uuid)
        if cache_key not in self._cache:
            # 初回はキャッシュがないので、現在の仕様書をキャッシュに保存
            self._cache[cache_key] = (current_spec, None, None)
            return None

        cached_spec, _, _ = self._cache[cache_key]

        if cached_spec == current_spec:
            return None  # 差分なし

        # 差分を生成（簡易版：difflib使用）
        from difflib import unified_diff
        diff_lines = list(unified_diff(
            cached_spec.splitlines(keepends=True),
            current_spec.splitlines(keepends=True),
            lineterm='',
            fromfile='前回生成',
            tofile='現在のDB'
        ))

        if not diff_lines:
            return None

        diff_text = ''.join(diff_lines)
        self.logger.info(f"手動編集を検出: {len(diff_lines)}行の差分")

        return diff_text

    def get_new_qa_since_last_generation(self, project_id: str, last_generated_at: datetime) -> List[QA]:
        """
        前回の生成以降に追加されたQ&Aを取得

        Args:
            project_id: プロジェクトID
            last_generated_at: 前回の生成日時

        Returns:
            新規Q&Aのリスト
        """
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id

        new_qa_list = self.db.query(QA).filter(
            QA.project_id == project_uuid,
            QA.created_at > last_generated_at
        ).order_by(QA.created_at).all()

        return new_qa_list

    def _create_qa_from_missing_info(self, project_id: uuid.UUID, missing_info_list: List[Dict[str, Any]]) -> None:
        """
        missing_infoから追加Q&Aを生成してDBに保存する

        Args:
            project_id: プロジェクトID
            missing_info_list: 不足情報のリスト（dictのリスト）
        """
        for missing_item in missing_info_list:
            # 質問文を構築（カテゴリと理由を含める）
            question_text = f"【{missing_item['category']}】{missing_item['question']}"

            # 既に同じ質問が存在しないかチェック
            existing_qa = self.db.query(QA).filter(
                QA.project_id == project_id,
                QA.question == question_text
            ).first()

            if existing_qa:
                self.logger.debug(f"質問が既に存在するためスキップ: {question_text}")
                continue

            # 新しいQ&Aを作成
            new_qa = QA(
                qa_id=uuid.uuid4(),
                project_id=project_id,
                question=question_text,
                answer=None,  # 未回答
                created_at=datetime.now(),
                source_doc_id=None,
                follows_qa_id=None
            )

            self.db.add(new_qa)
            self.logger.info(f"不足情報から追加Q&Aを生成: {question_text[:50]}...")

        self.db.commit()

    async def update_summary_with_diff(self, project_id: str, manual_diff: Optional[str] = None, new_qa: Optional[List[QA]] = None) -> str:
        """
        差分情報（手動編集 + 新規Q&A）を使って仕様書を更新
        非同期版に最適化

        Args:
            project_id: プロジェクトID
            manual_diff: 手動編集の差分（detect_manual_editsの結果）
            new_qa: 新規Q&Aリスト

        Returns:
            更新された仕様書
        """
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id

        # 既存の仕様書を取得
        project_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc or not project_doc.specification:
            raise ValueError(f"No specification found for project_id: {project_id}")

        # 差分情報がない場合は既存仕様書を返す
        if not manual_diff and not new_qa:
            return project_doc.specification

        # 差分情報を構築
        diff_info = ""

        if manual_diff:
            diff_info += f"## 手動編集による変更:\n{manual_diff}\n\n"

        if new_qa and len(new_qa) > 0:
            diff_info += "## 新規Q&A:\n"
            for qa in new_qa:
                diff_info += f"Q: {qa.question}\nA: {qa.answer or '未回答'}\n\n"

        # プロンプトで差分更新を指示
        prompt_text = f"""
既存の仕様書に対して、以下の新しい情報を反映して更新してください。

既存の仕様書:
{project_doc.specification}

{diff_info}

既存の仕様書の構造を保ちつつ、新しい情報を適切に反映してください。
変更が必要ない部分はそのまま残してください。
"""

        # LLMで更新
        from langchain.prompts import ChatPromptTemplate
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)
        chain = prompt_template | self.llm_pro | StrOutputParser()
        updated_summary = await chain.ainvoke({})

        # キャッシュを更新
        cache_key = str(project_uuid)
        self._cache[cache_key] = (updated_summary, None, None)

        return updated_summary


    async def update_summary_with_diff_cached(
        self,
        project_id: str,
        manual_diff: Optional[str] = None,
        new_qa: Optional[List[QA]] = None
    ) -> str:
        """
        Google GenAI Context Cachingを使用した差分ベース更新
        非同期版に最適化

        Args:
            project_id: プロジェクトID
            manual_diff: 手動編集の差分
            new_qa: 新規Q&Aリスト

        Returns:
            更新された仕様書
        """
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id

        # 既存の仕様書を取得
        project_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc or not project_doc.specification:
            raise ValueError(f"No specification found for project_id: {project_id}")

        # 差分情報がない場合は既存仕様書を返す
        if not manual_diff and not new_qa:
            return project_doc.specification

        # キャッシュキーを生成
        cache_key = str(project_uuid)

        # システムインストラクションと既存仕様書をキャッシュ対象とする
        system_instruction = """あなたは仕様書を更新するアシスタントです。
既存の仕様書に対して、新しい情報（手動編集または新規Q&A）を反映して更新してください。
既存の仕様書の構造を保ちつつ、新しい情報を適切に反映してください。
変更が必要ない部分はそのまま残してください。"""

        base_context = f"""# 既存の仕様書

{project_doc.specification}

---

上記が既存の仕様書です。以下の新しい情報を反映して更新してください。
"""

        try:
            # キャッシュが存在するか確認
            cached_content_name = None
            if cache_key in self._cache:
                _, _, cached_content_name = self._cache[cache_key]

            # キャッシュが存在しない、または期限切れの場合は作成
            if not cached_content_name:
                self.logger.info(f"新規キャッシュを作成: {project_id}")

                # キャッシュを作成
                cache = self.genai_client.caches.create(
                    model='models/gemini-2.0-flash-001',
                    config=types.CreateCachedContentConfig(
                        display_name=f'project_{project_id}_spec',
                        system_instruction=system_instruction,
                        contents=[base_context],
                        ttl="3600s",  # 1時間
                    )
                )
                cached_content_name = cache.name
                self.logger.info(f"キャッシュ作成成功: {cached_content_name}")
            else:
                self.logger.info(f"既存キャッシュを使用: {cached_content_name}")

            # 差分情報を構築
            diff_prompt = ""
            if manual_diff:
                diff_prompt += f"## 手動編集による変更:\n{manual_diff}\n\n"

            if new_qa and len(new_qa) > 0:
                diff_prompt += "## 新規Q&A:\n"
                for qa in new_qa:
                    diff_prompt += f"Q: {qa.question}\nA: {qa.answer or '未回答'}\n\n"

            diff_prompt += "\n更新された仕様書を出力してください。"

            # キャッシュを使用してコンテンツ生成
            response = self.genai_client.models.generate_content(
                model='models/gemini-2.0-flash-001',
                contents=diff_prompt,
                config=types.GenerateContentConfig(cached_content=cached_content_name)
            )

            updated_summary = response.text

            # キャッシュ情報を更新
            self._cache[cache_key] = (updated_summary, None, cached_content_name)

            self.logger.info(f"キャッシュ使用で仕様書更新完了")
            return updated_summary

        except Exception as e:
            self.logger.error(f"キャッシュ使用中にエラー: {e}")
            # フォールバック: キャッシュなしで生成
            self.logger.info("フォールバック: キャッシュなしで生成")
            return await self.update_summary_with_diff(project_id, manual_diff, new_qa)
