"""
仕様変更リクエストサービス

AIチャットを通じて仕様変更を提案し、既存のプロジェクト生成フローと同じ分割で
ドキュメント・機能・タスクを更新するシステム。

設計原則:
1. 最小スコープ優先: 最初から全部変える案ではなく、最小限の変更案を提示
2. 差分ベースの修正: 修正時は直前の提案に差分をマージ（全履歴は不要）
3. 変更は不可逆: 適用後は戻せない
4. 固定ワークフロー: LLMはフロー判断しない、生成のみ
5. LLMには判断と内容生成のみ: ID採番・位置計算はプログラムで行う
"""

import asyncio
import copy
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Set

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.project_base import (
    ChangeRequest,
    ProjectBase,
    ProjectDocument,
    StructuredFunction,
    Task,
    TaskDependency,
    TaskHandsOn,
)
from .base_service import BaseService
from .task_hands_on_service import TaskHandsOnService


# =============================================================================
# Pydanticスキーマ
# =============================================================================

class ImpactItem(BaseModel):
    """影響を受ける項目"""
    name: str = Field(description="項目名")
    reason: str = Field(description="影響を受ける理由")


class MinimalChangeProposal(BaseModel):
    """最小スコープ変更提案"""
    understood_intent: str = Field(description="ユーザーの意図の理解")
    approach: str = Field(description="変更アプローチの概要")
    keep: List[ImpactItem] = Field(default_factory=list, description="残すもの")
    discard: List[ImpactItem] = Field(default_factory=list, description="破棄するもの")
    add: List[ImpactItem] = Field(default_factory=list, description="追加するもの")
    modify: List[ImpactItem] = Field(default_factory=list, description="変更するもの")


class ChangeItem(BaseModel):
    """削除項目（名前と理由）"""
    name: str = Field(description="項目名")
    reason: str = Field(description="削除する理由")


class FunctionChange(BaseModel):
    """機能の追加"""
    function_name: str = Field(description="機能名")
    description: str = Field(description="機能の説明")
    category: str = Field(description="カテゴリ (auth/data/logic/ui/api/deployment)")
    priority: str = Field(description="優先度 (Must/Should/Could)")
    reason: str = Field(description="追加する理由")


class FunctionModify(BaseModel):
    """機能の修正"""
    target_name: str = Field(description="対象機能名")
    description: str = Field(description="変更後の説明")
    reason: str = Field(description="何がどう変わるか、なぜ変更するか")


class TaskChange(BaseModel):
    """タスクの追加"""
    title: str = Field(description="タスクタイトル")
    description: str = Field(description="タスクの説明")
    category: str = Field(description="カテゴリ（フロントエンド/バックエンド/DB設計）")
    priority: str = Field(description="優先度 (Must/Should/Could)")
    reason: str = Field(description="追加する理由")


class TaskModify(BaseModel):
    """タスクの修正"""
    target_title: str = Field(description="対象タスクタイトル")
    description: str = Field(description="変更後の説明")
    reason: str = Field(description="何がどう変わるか、なぜ変更するか")


class DependencyChange(BaseModel):
    """依存関係の変更"""
    source_task: str = Field(description="依存元タスク名（先に完了すべきタスク）")
    target_task: str = Field(description="依存先タスク名（後に実行するタスク）")


class DependencyDiff(BaseModel):
    """依存関係の差分"""
    add: List[DependencyChange] = Field(default_factory=list, description="追加する依存関係")
    remove: List[DependencyChange] = Field(default_factory=list, description="削除する依存関係")


class FunctionsProposal(BaseModel):
    """機能の変更提案"""
    keep: List[str] = Field(default_factory=list, description="残す機能名")
    discard: List[ChangeItem] = Field(default_factory=list, description="破棄する機能")
    add: List[FunctionChange] = Field(default_factory=list, description="追加する機能")
    modify: List[FunctionModify] = Field(default_factory=list, description="変更する機能")


class TasksProposal(BaseModel):
    """タスクの変更提案"""
    discard: List[ChangeItem] = Field(default_factory=list, description="破棄するタスク")
    add: List[TaskChange] = Field(default_factory=list, description="追加するタスク")
    modify: List[TaskModify] = Field(default_factory=list, description="変更するタスク")


class DocumentUpdate(BaseModel):
    """ドキュメント更新"""
    updated: bool = Field(description="更新されたかどうか")
    content: str = Field(default="", description="更新後の全文")


class FullProposal(BaseModel):
    """完全な変更提案"""
    approach: str = Field(description="変更アプローチの概要")
    specification: DocumentUpdate = Field(description="仕様書の更新")
    function_doc: DocumentUpdate = Field(description="機能要件書の更新")
    functions: FunctionsProposal = Field(description="機能の変更")
    tasks: TasksProposal = Field(description="タスクの変更")
    hands_on_to_regenerate: List[str] = Field(default_factory=list, description="ハンズオン再生成が必要なタスク")


class DiffProposal(BaseModel):
    """差分提案（修正要求時）"""
    functions: Dict[str, Any] = Field(default_factory=dict, description="機能の差分")
    tasks: Dict[str, Any] = Field(default_factory=dict, description="タスクの差分")
    specification_needs_update: bool = Field(default=False, description="仕様書の更新が必要か")
    function_doc_needs_update: bool = Field(default=False, description="機能要件書の更新が必要か")


# =============================================================================
# サービス実装
# =============================================================================

class ChangeRequestService(BaseService):
    """仕様変更リクエストサービス"""

    def __init__(self, db: Session):
        super().__init__(db=db)
        # 影響分析・変更生成にはthinkingを使用
        self.llm_with_thinking = self._load_llm(
            self.default_model_provider, "gemini-2.5-flash", thinking_budget=None
        )

    # =========================================================================
    # 公開API
    # =========================================================================

    async def propose(self, project_id: str, description: str) -> Dict[str, Any]:
        """
        変更リクエストを作成し、最小スコープの提案を生成する

        Args:
            project_id: プロジェクトID
            description: ユーザーの変更要望

        Returns:
            {
                "request_id": "...",
                "status": "PROPOSING",
                "proposal": {...}
            }
        """
        self.logger.info(f"Creating change request for project_id: {project_id}")

        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id

        # プロジェクトの現在状態を取得
        current_state = self._get_project_state(project_uuid)

        # Step 1: 影響分析と最小スコープ方針の生成
        minimal_proposal = await self._generate_minimal_proposal(
            description=description,
            current_state=current_state
        )

        # Step 2: 全ドメインを並列生成
        full_proposal = await self._generate_full_proposal(
            description=description,
            approach=minimal_proposal,
            current_state=current_state
        )

        # minimal_proposalの情報をfull_proposalに含める（revise時に使用）
        full_proposal["understood_intent"] = minimal_proposal.get("understood_intent", "")
        full_proposal["keep"] = minimal_proposal.get("keep", [])
        full_proposal["discard"] = minimal_proposal.get("discard", [])
        full_proposal["add"] = minimal_proposal.get("add", [])
        full_proposal["modify"] = minimal_proposal.get("modify", [])

        # ChangeRequestをDBに保存
        change_request = ChangeRequest(
            project_id=project_uuid,
            description=description,
            status="PROPOSING",
            proposal=full_proposal,
            conversation=[]
        )
        change_request.add_user_message(description)
        change_request.add_proposal_message(minimal_proposal["approach"])

        self.db.add(change_request)
        self.db.commit()
        self.db.refresh(change_request)

        self.logger.info(f"Created change request: {change_request.request_id}")

        return {
            "request_id": str(change_request.request_id),
            "status": change_request.status.name if hasattr(change_request.status, 'name') else str(change_request.status),
            "proposal": self._format_proposal_for_response(minimal_proposal, full_proposal),
            "conversation": change_request.conversation
        }

    async def revise(self, request_id: str, feedback: str) -> Dict[str, Any]:
        """
        修正要求を受けて提案を更新する

        Args:
            request_id: 変更リクエストID
            feedback: ユーザーの修正要求

        Returns:
            更新された提案
        """
        self.logger.info(f"Revising change request: {request_id}")

        request_uuid = uuid.UUID(request_id) if isinstance(request_id, str) else request_id
        change_request = self.db.query(ChangeRequest).filter(
            ChangeRequest.request_id == request_uuid
        ).first()

        if not change_request:
            raise ValueError(f"ChangeRequest not found: {request_id}")

        if change_request.status not in ["PROPOSING", "PROPOSAL_READY"]:
            raise ValueError(f"Cannot revise request in status: {change_request.status}")

        # プロジェクトの現在状態を取得
        current_state = self._get_project_state(change_request.project_id)
        current_proposal = change_request.proposal

        # 差分を生成
        diff = await self._generate_diff(
            current_proposal=current_proposal,
            feedback=feedback,
            current_state=current_state
        )

        # 差分をマージ
        updated_proposal = self._apply_diff(current_proposal, diff)

        # ドキュメントの更新が必要な場合は再生成
        if diff.get("specification_needs_update"):
            updated_proposal["specification"] = await self._regenerate_specification(
                current_state=current_state,
                proposal=updated_proposal
            )

        if diff.get("function_doc_needs_update"):
            updated_proposal["function_doc"] = await self._regenerate_function_doc(
                current_state=current_state,
                proposal=updated_proposal
            )

        # 対話履歴を更新
        change_request.add_user_message(feedback)
        change_request.add_proposal_message(updated_proposal["approach"])

        # DBを更新
        change_request.proposal = updated_proposal
        self.db.commit()
        self.db.refresh(change_request)

        self.logger.info(f"Revised change request: {request_id}")

        return {
            "request_id": str(change_request.request_id),
            "status": change_request.status.name if hasattr(change_request.status, 'name') else str(change_request.status),
            "proposal": self._format_proposal_for_ui(updated_proposal),
            "conversation": change_request.conversation
        }

    async def approve(self, request_id: str) -> Dict[str, Any]:
        """
        提案を承認し、変更をDBに適用する

        Args:
            request_id: 変更リクエストID

        Returns:
            適用結果
        """
        self.logger.info(f"Approving change request: {request_id}")

        request_uuid = uuid.UUID(request_id) if isinstance(request_id, str) else request_id
        change_request = self.db.query(ChangeRequest).filter(
            ChangeRequest.request_id == request_uuid
        ).first()

        if not change_request:
            raise ValueError(f"ChangeRequest not found: {request_id}")

        if change_request.status not in ["PROPOSING", "PROPOSAL_READY"]:
            raise ValueError(f"Cannot approve request in status: {change_request.status}")

        # ステータスを更新
        change_request.status = "APPROVED"
        self.db.commit()

        # 変更を適用
        try:
            applied_changes = self._apply_changes(
                project_id=change_request.project_id,
                proposal=change_request.proposal
            )

            # 提案に含まれる依存関係差分を適用
            dependency_diff = change_request.proposal.get("dependency_diff", {})
            if dependency_diff.get("add") or dependency_diff.get("remove"):
                self._apply_dependency_diff(change_request.project_id, dependency_diff)

            change_request.status = "APPLIED"
            self.db.commit()

            self.logger.info(f"Applied change request: {request_id}")

            return {
                "request_id": str(change_request.request_id),
                "status": "APPLIED",
                "changes_applied": applied_changes
            }

        except Exception as e:
            self.logger.exception(f"Failed to apply changes: {e}")
            change_request.status = "PROPOSING"  # ロールバック
            self.db.commit()
            raise

    def cancel(self, request_id: str) -> Dict[str, Any]:
        """
        変更リクエストをキャンセルする

        Args:
            request_id: 変更リクエストID

        Returns:
            キャンセル結果
        """
        self.logger.info(f"Cancelling change request: {request_id}")

        request_uuid = uuid.UUID(request_id) if isinstance(request_id, str) else request_id
        change_request = self.db.query(ChangeRequest).filter(
            ChangeRequest.request_id == request_uuid
        ).first()

        if not change_request:
            raise ValueError(f"ChangeRequest not found: {request_id}")

        if change_request.status == "APPLIED":
            raise ValueError("Cannot cancel already applied request")

        change_request.status = "CANCELLED"
        self.db.commit()

        self.logger.info(f"Cancelled change request: {request_id}")

        return {
            "request_id": str(change_request.request_id),
            "status": "CANCELLED"
        }

    def get_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        """変更リクエストを取得する"""
        request_uuid = uuid.UUID(request_id) if isinstance(request_id, str) else request_id
        change_request = self.db.query(ChangeRequest).filter(
            ChangeRequest.request_id == request_uuid
        ).first()

        if not change_request:
            return None

        return {
            "request_id": str(change_request.request_id),
            "project_id": str(change_request.project_id),
            "description": change_request.description,
            "status": change_request.status.name if hasattr(change_request.status, 'name') else str(change_request.status),
            "proposal": self._format_proposal_for_ui(change_request.proposal) if change_request.proposal else None,
            "conversation": change_request.conversation,
            "created_at": change_request.created_at.isoformat() if change_request.created_at else None,
            "updated_at": change_request.updated_at.isoformat() if change_request.updated_at else None
        }

    # =========================================================================
    # 内部メソッド: 状態取得
    # =========================================================================

    def _get_project_state(self, project_id: uuid.UUID) -> Dict[str, Any]:
        """プロジェクトの現在状態を取得"""
        project = self.db.query(ProjectBase).filter(
            ProjectBase.project_id == project_id
        ).first()

        if not project:
            raise ValueError(f"Project not found: {project_id}")

        # ドキュメント取得
        document = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_id
        ).first()

        # 機能取得
        functions = self.db.query(StructuredFunction).filter(
            StructuredFunction.project_id == project_id
        ).all()

        # タスク取得
        tasks = self.db.query(Task).filter(
            Task.project_id == project_id
        ).all()

        # タスクをステータス別に分類
        done_tasks = [t for t in tasks if t.status == "DONE"]
        in_progress_tasks = [t for t in tasks if t.status == "DOING"]
        todo_tasks = [t for t in tasks if t.status == "TODO"]

        # 依存関係を取得（タスク名ベース）
        task_id_to_title = {t.task_id: t.title for t in tasks}
        dependencies = self.db.query(TaskDependency).join(
            Task, TaskDependency.source_task_id == Task.task_id
        ).filter(Task.project_id == project_id).all()

        current_dependencies = []
        for dep in dependencies:
            source_title = task_id_to_title.get(dep.source_task_id)
            target_title = task_id_to_title.get(dep.target_task_id)
            if source_title and target_title:
                current_dependencies.append({
                    "source": source_title,
                    "target": target_title
                })

        return {
            "project": {
                "project_id": str(project_id),
                "title": project.title,
                "idea": project.idea,
            },
            "specification": document.specification if document else "",
            "function_doc": document.function_doc if document else "",
            "framework_doc": document.frame_work_doc if document else "",
            "functions": [
                {
                    "function_id": str(f.function_id),
                    "function_code": f.function_code,
                    "function_name": f.function_name,
                    "description": f.description,
                    "category": f.category,
                    "priority": f.priority,
                }
                for f in functions
            ],
            "tasks": {
                "done": [{"title": t.title, "description": t.description, "node_id": t.node_id} for t in done_tasks],
                "in_progress": [{"title": t.title, "description": t.description, "node_id": t.node_id} for t in in_progress_tasks],
                "todo": [{"title": t.title, "description": t.description, "node_id": t.node_id} for t in todo_tasks],
            },
            "dependencies": current_dependencies
        }

    # =========================================================================
    # 内部メソッド: LLM生成
    # =========================================================================

    async def _generate_minimal_proposal(
        self,
        description: str,
        current_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """最小スコープの変更提案を生成"""
        prompt_text = self.get_prompt("change_request_service", "generate_minimal_proposal")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        # タスク情報をフォーマット
        done_tasks = "\n".join([f"- {t['title']}" for t in current_state["tasks"]["done"]]) or "なし"
        in_progress_tasks = "\n".join([f"- {t['title']}" for t in current_state["tasks"]["in_progress"]]) or "なし"
        todo_tasks = "\n".join([f"- {t['title']}" for t in current_state["tasks"]["todo"]]) or "なし"

        # 機能情報をフォーマット
        functions_text = "\n".join([
            f"- {f['function_name']}: {f['description']} [{f['priority']}]"
            for f in current_state["functions"]
        ]) or "なし"

        chain = prompt_template | self.llm_with_thinking.with_structured_output(MinimalChangeProposal)

        result: MinimalChangeProposal = await chain.ainvoke({
            "description": description,
            "framework_info": current_state["framework_doc"],
            "done_tasks": done_tasks,
            "in_progress_tasks": in_progress_tasks,
            "todo_tasks": todo_tasks,
            "functions": functions_text,
        })

        return result.model_dump()

    async def _generate_full_proposal(
        self,
        description: str,
        approach: Dict[str, Any],
        current_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """全ドメインの変更を並列生成"""
        # 共通コンテキスト
        common_context = {
            "user_request": description,
            "approach": approach,
            "current_state": current_state
        }

        # 並列実行（ドキュメント・機能・タスク）
        spec_task = self._generate_specification_changes(common_context)
        func_doc_task = self._generate_function_doc_changes(common_context)
        func_task = self._generate_function_changes(common_context)
        tasks_task = self._generate_task_changes(common_context)

        spec_result, func_doc_result, func_result, tasks_result = await asyncio.gather(
            spec_task, func_doc_task, func_task, tasks_task
        )

        # タスク変更に基づいて依存関係差分を生成
        dependency_diff = await self._generate_dependency_diff_for_proposal(
            description=description,
            tasks_result=tasks_result,
            current_state=current_state
        )

        return {
            "approach": approach["approach"],
            "specification": spec_result,
            "function_doc": func_doc_result,
            "functions": func_result,
            "tasks": tasks_result,
            "dependency_diff": dependency_diff,
            "hands_on_to_regenerate": self._identify_hands_on_to_regenerate(tasks_result)
        }

    async def _generate_specification_changes(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """仕様書の変更を生成"""
        current_spec = context["current_state"]["specification"]
        if not current_spec:
            return {"updated": False, "content": ""}

        prompt_text = self.get_prompt("change_request_service", "update_specification")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        chain = prompt_template | self.llm_with_thinking

        result = await chain.ainvoke({
            "user_request": context["user_request"],
            "approach": context["approach"]["approach"],
            "current_specification": current_spec,
        })

        content = getattr(result, "content", "") or str(result)

        return {
            "updated": True,
            "content": content.strip()
        }

    async def _generate_function_doc_changes(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """機能要件書の変更を生成"""
        current_doc = context["current_state"]["function_doc"]
        if not current_doc:
            return {"updated": False, "content": ""}

        prompt_text = self.get_prompt("change_request_service", "update_function_doc")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        chain = prompt_template | self.llm_with_thinking

        result = await chain.ainvoke({
            "user_request": context["user_request"],
            "approach": context["approach"]["approach"],
            "current_function_doc": current_doc,
        })

        content = getattr(result, "content", "") or str(result)

        return {
            "updated": True,
            "content": content.strip()
        }

    async def _generate_function_changes(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """機能の変更を生成"""
        prompt_text = self.get_prompt("change_request_service", "generate_function_changes")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        functions_text = "\n".join([
            f"- {f['function_name']}: {f['description']} [{f['category']}] [{f['priority']}]"
            for f in context["current_state"]["functions"]
        ]) or "なし"

        chain = prompt_template | self.llm_with_thinking.with_structured_output(FunctionsProposal)

        result: FunctionsProposal = await chain.ainvoke({
            "user_request": context["user_request"],
            "approach": context["approach"]["approach"],
            "keep_items": ", ".join([i["name"] for i in context["approach"].get("keep", [])]),
            "discard_items": ", ".join([i["name"] for i in context["approach"].get("discard", [])]),
            "add_items": ", ".join([i["name"] for i in context["approach"].get("add", [])]),
            "modify_items": ", ".join([i["name"] for i in context["approach"].get("modify", [])]),
            "current_functions": functions_text,
        })

        return result.model_dump()

    async def _generate_task_changes(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """タスクの変更を生成"""
        prompt_text = self.get_prompt("change_request_service", "generate_task_changes")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        all_tasks = (
            context["current_state"]["tasks"]["done"] +
            context["current_state"]["tasks"]["in_progress"] +
            context["current_state"]["tasks"]["todo"]
        )
        tasks_text = "\n".join([
            f"- {t['title']}: {t.get('description', '')}"
            for t in all_tasks
        ]) or "なし"

        chain = prompt_template | self.llm_with_thinking.with_structured_output(TasksProposal)

        result: TasksProposal = await chain.ainvoke({
            "user_request": context["user_request"],
            "approach": context["approach"]["approach"],
            "discard_items": ", ".join([i["name"] for i in context["approach"].get("discard", [])]),
            "add_items": ", ".join([i["name"] for i in context["approach"].get("add", [])]),
            "modify_items": ", ".join([i["name"] for i in context["approach"].get("modify", [])]),
            "current_tasks": tasks_text,
        })

        return result.model_dump()

    async def _generate_diff(
        self,
        current_proposal: Dict[str, Any],
        feedback: str,
        current_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """修正要求から差分を生成"""
        prompt_text = self.get_prompt("change_request_service", "generate_diff")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        chain = prompt_template | self.llm_with_thinking.with_structured_output(DiffProposal)

        result: DiffProposal = await chain.ainvoke({
            "current_proposal": str(current_proposal),
            "feedback": feedback,
        })

        return result.model_dump()

    async def _regenerate_specification(
        self,
        current_state: Dict[str, Any],
        proposal: Dict[str, Any]
    ) -> Dict[str, Any]:
        """仕様書を再生成"""
        prompt_text = self.get_prompt("change_request_service", "update_specification")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        chain = prompt_template | self.llm_with_thinking

        result = await chain.ainvoke({
            "user_request": proposal.get("approach", ""),
            "approach": proposal.get("approach", ""),
            "current_specification": current_state["specification"],
        })

        content = getattr(result, "content", "") or str(result)

        return {
            "updated": True,
            "content": content.strip()
        }

    async def _regenerate_function_doc(
        self,
        current_state: Dict[str, Any],
        proposal: Dict[str, Any]
    ) -> Dict[str, Any]:
        """機能要件書を再生成"""
        prompt_text = self.get_prompt("change_request_service", "update_function_doc")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        chain = prompt_template | self.llm_with_thinking

        result = await chain.ainvoke({
            "user_request": proposal.get("approach", ""),
            "approach": proposal.get("approach", ""),
            "current_function_doc": current_state["function_doc"],
        })

        content = getattr(result, "content", "") or str(result)

        return {
            "updated": True,
            "content": content.strip()
        }

    # =========================================================================
    # 内部メソッド: 差分適用
    # =========================================================================

    def _apply_diff(self, current_proposal: Dict[str, Any], diff: Dict[str, Any]) -> Dict[str, Any]:
        """差分を現在の提案に適用"""
        proposal = copy.deepcopy(current_proposal)

        # 機能の差分を適用
        func_diff = diff.get("functions", {})
        if func_diff:
            # 破棄から除外（ChangeItem形式に対応）
            for name in func_diff.get("remove_from_discard", []):
                discard_list = proposal.get("functions", {}).get("discard", [])
                proposal["functions"]["discard"] = [
                    item for item in discard_list
                    if (item.get("name") if isinstance(item, dict) else item) != name
                ]

            # keepに追加
            proposal.setdefault("functions", {}).setdefault("keep", [])
            proposal["functions"]["keep"].extend(func_diff.get("add_to_keep", []))

            # 新規追加
            proposal["functions"].setdefault("add", [])
            proposal["functions"]["add"].extend(func_diff.get("add", []))

            # 変更
            proposal["functions"].setdefault("modify", [])
            proposal["functions"]["modify"].extend(func_diff.get("modify", []))

        # タスクの差分を適用
        task_diff = diff.get("tasks", {})
        if task_diff:
            # 破棄から除外（ChangeItem形式に対応）
            for name in task_diff.get("remove_from_discard", []):
                discard_list = proposal.get("tasks", {}).get("discard", [])
                proposal["tasks"]["discard"] = [
                    item for item in discard_list
                    if (item.get("name") if isinstance(item, dict) else item) != name
                ]

            # 新規追加
            proposal.setdefault("tasks", {}).setdefault("add", [])
            proposal["tasks"]["add"].extend(task_diff.get("add", []))

            # 変更
            proposal["tasks"].setdefault("modify", [])
            proposal["tasks"]["modify"].extend(task_diff.get("modify", []))

        return proposal

    def _identify_hands_on_to_regenerate(self, tasks_result: Dict[str, Any]) -> List[str]:
        """ハンズオン再生成が必要なタスクを特定"""
        hands_on_tasks = []

        # 変更されるタスク
        for task in tasks_result.get("modify", []):
            if isinstance(task, dict):
                hands_on_tasks.append(task.get("target_title", ""))

        return [t for t in hands_on_tasks if t]

    # =========================================================================
    # 内部メソッド: DB適用
    # =========================================================================

    def _apply_changes(self, project_id: uuid.UUID, proposal: Dict[str, Any]) -> Dict[str, Any]:
        """変更をDBに適用"""
        applied = {
            "specification_updated": False,
            "function_doc_updated": False,
            "functions_added": [],
            "functions_deleted": [],
            "functions_modified": [],
            "tasks_added": [],
            "tasks_deleted": [],
            "tasks_modified": []
        }

        # 1. ドキュメントの更新
        doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_id
        ).first()

        if doc:
            spec = proposal.get("specification", {})
            if spec.get("updated") and spec.get("content"):
                doc.specification = spec["content"]
                applied["specification_updated"] = True

            func_doc = proposal.get("function_doc", {})
            if func_doc.get("updated") and func_doc.get("content"):
                doc.function_doc = func_doc["content"]
                applied["function_doc_updated"] = True

        # 2. 機能の更新
        functions = proposal.get("functions", {})

        # 機能を破棄
        for func_item in functions.get("discard", []):
            func_name = func_item.get("name") if isinstance(func_item, dict) else func_item
            func = self.db.query(StructuredFunction).filter(
                StructuredFunction.project_id == project_id,
                StructuredFunction.function_name == func_name
            ).first()
            if func:
                self.db.delete(func)
                applied["functions_deleted"].append(func_name)

        # 機能を追加
        max_code = self._get_max_function_code(project_id)
        for func_data in functions.get("add", []):
            max_code += 1
            new_code = f"F{str(max_code).zfill(3)}"

            new_func = StructuredFunction(
                project_id=project_id,
                function_code=new_code,
                function_name=func_data.get("function_name", ""),
                description=func_data.get("description", ""),
                category=func_data.get("category", "logic"),
                priority=func_data.get("priority", "Should")
            )
            self.db.add(new_func)
            applied["functions_added"].append(func_data.get("function_name", ""))

        # 機能を変更
        for mod in functions.get("modify", []):
            func = self.db.query(StructuredFunction).filter(
                StructuredFunction.project_id == project_id,
                StructuredFunction.function_name == mod.get("target_name", "")
            ).first()
            if func:
                func.description = mod.get("description", func.description)
                applied["functions_modified"].append(mod.get("target_name", ""))

        # 3. タスクの更新
        tasks = proposal.get("tasks", {})

        # タスクを破棄（CASCADE削除で依存関係も自動削除）
        for task_item in tasks.get("discard", []):
            task_title = task_item.get("name") if isinstance(task_item, dict) else task_item
            task = self.db.query(Task).filter(
                Task.project_id == project_id,
                Task.title == task_title
            ).first()
            if task:
                self.db.delete(task)
                applied["tasks_deleted"].append(task_title)

        # タスクを追加
        max_node = self._get_max_node_id(project_id)
        new_tasks_map: Dict[str, Task] = {}  # タスク名 -> Taskオブジェクト
        tasks_to_regenerate: List[Task] = []  # ハンズオン再生成対象

        for task_data in tasks.get("add", []):
            max_node += 1
            new_node_id = f"n{max_node}"
            task_title = task_data.get("title", "")

            new_task = Task(
                project_id=project_id,
                node_id=new_node_id,
                title=task_title,
                description=task_data.get("description", ""),
                category=task_data.get("category", ""),
                priority=task_data.get("priority", "Should"),
                status="TODO",
                position_x=100,
                position_y=100
            )
            self.db.add(new_task)
            new_tasks_map[task_title] = new_task
            tasks_to_regenerate.append(new_task)  # 追加タスクは再生成対象
            applied["tasks_added"].append(task_title)

        # タスクを変更
        for mod in tasks.get("modify", []):
            target_title = mod.get("target_title", "")
            task = self.db.query(Task).filter(
                Task.project_id == project_id,
                Task.title == target_title
            ).first()
            if not task:
                continue

            # 説明の変更
            if mod.get("description"):
                task.description = mod["description"]

            tasks_to_regenerate.append(task)  # 変更タスクは再生成対象
            applied["tasks_modified"].append(target_title)

        # フラッシュしてタスクのIDを確定
        self.db.flush()

        # 4. 変更されたタスクの既存ハンズオンを削除（インタラクティブで再生成される）
        if tasks_to_regenerate:
            target_task_ids = [task.task_id for task in tasks_to_regenerate]
            deleted_count = self.db.query(TaskHandsOn).filter(
                TaskHandsOn.task_id.in_(target_task_ids)
            ).delete(synchronize_session=False)
            print(f"[ChangeRequest] 既存ハンズオン削除: {deleted_count} 件（インタラクティブモードで再生成）")

        self.db.commit()

        return applied

    def _get_max_function_code(self, project_id: uuid.UUID) -> int:
        """現在の最大function_codeを取得"""
        functions = self.db.query(StructuredFunction).filter(
            StructuredFunction.project_id == project_id
        ).all()

        if not functions:
            return 0

        max_code = 0
        for func in functions:
            if func.function_code and func.function_code.startswith("F"):
                try:
                    code_num = int(func.function_code[1:])
                    max_code = max(max_code, code_num)
                except ValueError:
                    pass

        return max_code

    def _get_max_node_id(self, project_id: uuid.UUID) -> int:
        """現在の最大node_idを取得"""
        tasks = self.db.query(Task).filter(
            Task.project_id == project_id
        ).all()

        if not tasks:
            return 0

        max_id = 0
        for task in tasks:
            if task.node_id and task.node_id.startswith("n"):
                try:
                    node_num = int(task.node_id[1:])
                    max_id = max(max_id, node_num)
                except ValueError:
                    pass

        return max_id

    def _calculate_task_position(
        self,
        project_id: uuid.UUID,
        depends_on: List[str]
    ) -> Tuple[int, int]:
        """依存先タスクから位置を計算"""
        if not depends_on:
            # 依存先がない場合はデフォルト位置
            return (100, 100)

        # 最初の依存先タスクの位置を基準にする
        depend_task = self.db.query(Task).filter(
            Task.project_id == project_id,
            Task.title == depends_on[0]
        ).first()

        if depend_task and depend_task.position_x is not None:
            return (depend_task.position_x + 200, depend_task.position_y or 100)

        return (100, 100)

    def _create_task_dependency(self, source_task: Task, target_task: Task) -> None:
        """タスク間の依存関係を作成"""
        # 既に存在するかチェック
        existing = self.db.query(TaskDependency).filter(
            TaskDependency.source_task_id == source_task.task_id,
            TaskDependency.target_task_id == target_task.task_id
        ).first()
        if existing:
            return

        edge_id = f"{source_task.node_id}-{target_task.node_id}"
        dependency = TaskDependency(
            edge_id=edge_id,
            source_task_id=source_task.task_id,
            target_task_id=target_task.task_id,
            source_node_id=source_task.node_id or "",
            target_node_id=target_task.node_id or "",
            is_animated=True,
            is_next_day=False
        )
        self.db.add(dependency)

    def _remove_task_dependency(self, source_task: Task, target_task: Task) -> None:
        """タスク間の依存関係を削除"""
        dependency = self.db.query(TaskDependency).filter(
            TaskDependency.source_task_id == source_task.task_id,
            TaskDependency.target_task_id == target_task.task_id
        ).first()
        if dependency:
            self.db.delete(dependency)

    # =========================================================================
    # 内部メソッド: 依存関係差分
    # =========================================================================

    async def _generate_dependency_diff_for_proposal(
        self,
        description: str,
        tasks_result: Dict[str, Any],
        current_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        提案フェーズで依存関係の差分を生成（DBに適用前）

        Input:
        - 変更の説明
        - タスク変更の提案（add/discard/modify）
        - 現在のプロジェクト状態（タスク一覧 + 依存関係）

        Output:
        - 追加する依存関係
        - 削除する依存関係
        """
        # 現在のタスク一覧を取得
        all_current_tasks = (
            current_state["tasks"]["done"] +
            current_state["tasks"]["in_progress"] +
            current_state["tasks"]["todo"]
        )

        # 変更後のタスク一覧を構築（仮想的に）
        # discard は ChangeItem のリスト（{name, reason}）
        discard_items = tasks_result.get("discard", [])
        tasks_to_discard = set(
            item.get("name") if isinstance(item, dict) else item
            for item in discard_items
        )
        tasks_after_change = [
            {"title": t["title"], "description": t.get("description", "")}
            for t in all_current_tasks
            if t["title"] not in tasks_to_discard
        ]

        # 追加タスクを加える
        for task_data in tasks_result.get("add", []):
            tasks_after_change.append({
                "title": task_data.get("title", ""),
                "description": task_data.get("description", "")
            })

        # 変更情報を抽出
        tasks_added = [t.get("title", "") for t in tasks_result.get("add", [])]
        tasks_deleted = list(tasks_to_discard)
        tasks_modified = [m.get("target_title", "") for m in tasks_result.get("modify", [])]

        # タスク変更がなければ空の差分を返す
        if not tasks_added and not tasks_deleted and not tasks_modified:
            return {"add": [], "remove": []}

        # LLMで依存関係差分を生成
        prompt_text = self.get_prompt("change_request_service", "generate_dependency_diff")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        chain = prompt_template | self.llm_with_thinking.with_structured_output(DependencyDiff)

        result: DependencyDiff = await chain.ainvoke({
            "tasks_info": str(tasks_after_change),
            "current_dependencies": str(current_state.get("dependencies", [])),
            "tasks_added": ", ".join(tasks_added) if tasks_added else "なし",
            "tasks_deleted": ", ".join(tasks_deleted) if tasks_deleted else "なし",
            "tasks_modified": ", ".join(tasks_modified) if tasks_modified else "なし",
            "change_description": description,
        })

        return result.model_dump()

    async def _generate_dependency_diff(
        self,
        project_id: uuid.UUID,
        tasks_added: List[str],
        tasks_deleted: List[str],
        tasks_modified: List[str],
        change_description: str
    ) -> Dict[str, Any]:
        """
        タスク変更に基づいて依存関係の差分を生成

        Input:
        - 変更後のタスク一覧
        - 現在の依存関係（タスク名ベース）
        - 変更内容（追加/削除/変更されたタスク名）
        - 変更の説明

        Output:
        - 追加する依存関係
        - 削除する依存関係
        """
        # 変更後のタスク一覧を取得
        all_tasks = self.db.query(Task).filter(
            Task.project_id == project_id
        ).all()

        tasks_info = [
            {"title": t.title, "description": t.description or ""}
            for t in all_tasks
        ]

        # 現在の依存関係を取得（タスク名ベース）
        task_id_to_title = {t.task_id: t.title for t in all_tasks}

        dependencies = self.db.query(TaskDependency).join(
            Task, TaskDependency.source_task_id == Task.task_id
        ).filter(Task.project_id == project_id).all()

        current_deps = []
        for dep in dependencies:
            source_title = task_id_to_title.get(dep.source_task_id)
            target_title = task_id_to_title.get(dep.target_task_id)
            if source_title and target_title:
                current_deps.append({
                    "source": source_title,
                    "target": target_title
                })

        # LLMで依存関係差分を生成
        prompt_text = self.get_prompt("change_request_service", "generate_dependency_diff")
        prompt_template = ChatPromptTemplate.from_template(template=prompt_text)

        chain = prompt_template | self.llm_with_thinking.with_structured_output(DependencyDiff)

        result: DependencyDiff = await chain.ainvoke({
            "tasks_info": str(tasks_info),
            "current_dependencies": str(current_deps),
            "tasks_added": ", ".join(tasks_added) if tasks_added else "なし",
            "tasks_deleted": ", ".join(tasks_deleted) if tasks_deleted else "なし",
            "tasks_modified": ", ".join(tasks_modified) if tasks_modified else "なし",
            "change_description": change_description,
        })

        return result.model_dump()

    def _apply_dependency_diff(self, project_id: uuid.UUID, diff: Dict[str, Any]) -> None:
        """依存関係の差分を適用"""
        # タスク名からTaskオブジェクトを取得するためのマップ
        all_tasks = self.db.query(Task).filter(
            Task.project_id == project_id
        ).all()
        title_to_task = {t.title: t for t in all_tasks}

        # 依存関係を削除
        for dep in diff.get("remove", []):
            source_title = dep.get("source_task")
            target_title = dep.get("target_task")
            source_task = title_to_task.get(source_title)
            target_task = title_to_task.get(target_title)
            if source_task and target_task:
                self._remove_task_dependency(source_task, target_task)

        # 依存関係を追加
        for dep in diff.get("add", []):
            source_title = dep.get("source_task")
            target_title = dep.get("target_task")
            source_task = title_to_task.get(source_title)
            target_task = title_to_task.get(target_title)
            if source_task and target_task:
                self._create_task_dependency(source_task, target_task)

        self.db.flush()

    # =========================================================================
    # 内部メソッド: レスポンスフォーマット
    # =========================================================================

    def _format_proposal_for_response(
        self,
        minimal: Dict[str, Any],
        full: Dict[str, Any]
    ) -> Dict[str, Any]:
        """APIレスポンス用に提案をフォーマット"""
        dependency_diff = full.get("dependency_diff", {})

        # タスク情報を取得
        tasks_data = full.get("tasks", {})

        return {
            "understood_intent": minimal.get("understood_intent", ""),
            "approach": minimal.get("approach", ""),
            "keep": minimal.get("keep", []),
            "discard": minimal.get("discard", []),
            "add": minimal.get("add", []),
            "modify": minimal.get("modify", []),
            # 機能の変更（フルオブジェクトを返す）
            "functions": {
                "keep": full.get("functions", {}).get("keep", []),
                "discard": full.get("functions", {}).get("discard", []),
                "add": full.get("functions", {}).get("add", []),
                "modify": full.get("functions", {}).get("modify", [])
            },
            # タスクの変更（フルオブジェクトを返す）
            "tasks": {
                "discard": tasks_data.get("discard", []),
                "add": tasks_data.get("add", []),
                "modify": tasks_data.get("modify", [])
            },
            "dependency_changes": {
                "add": [
                    f"{d.get('source_task', '')} → {d.get('target_task', '')}"
                    for d in dependency_diff.get("add", [])
                ],
                "remove": [
                    f"{d.get('source_task', '')} → {d.get('target_task', '')}"
                    for d in dependency_diff.get("remove", [])
                ]
            },
            "impact": {
                "tasks_to_discard": len(tasks_data.get("discard", [])),
                "tasks_to_add": len(tasks_data.get("add", [])),
                "tasks_to_modify": len(tasks_data.get("modify", [])),
                "dependencies_to_add": len(dependency_diff.get("add", [])),
                "dependencies_to_remove": len(dependency_diff.get("remove", [])),
            }
        }

    def _format_proposal_for_ui(self, proposal: Dict[str, Any]) -> Dict[str, Any]:
        """UI表示用に提案をフォーマット"""
        dependency_diff = proposal.get("dependency_diff", {})

        # keepはminimal_proposalから保存されたものを使用
        keep_items = proposal.get("keep", [])
        # ImpactItemの場合はname、stringの場合はそのまま
        keep_names = [
            item.get("name", item) if isinstance(item, dict) else item
            for item in keep_items
        ]

        return {
            "understood_intent": proposal.get("understood_intent", ""),
            "approach": proposal.get("approach", ""),
            "keep": keep_names,
            "discard": [
                item.get("name", item) if isinstance(item, dict) else item
                for item in proposal.get("discard", [])
            ],
            "add": [
                item.get("name", item) if isinstance(item, dict) else item
                for item in proposal.get("add", [])
            ],
            "modify": [
                item.get("name", item) if isinstance(item, dict) else item
                for item in proposal.get("modify", [])
            ],
            "functions": {
                "keep": proposal.get("functions", {}).get("keep", []),
                "discard": proposal.get("functions", {}).get("discard", []),
                "add": proposal.get("functions", {}).get("add", []),
                "modify": proposal.get("functions", {}).get("modify", [])
            },
            "tasks": {
                "discard": proposal.get("tasks", {}).get("discard", []),
                "add": proposal.get("tasks", {}).get("add", []),
                "modify": proposal.get("tasks", {}).get("modify", [])
            },
            "dependency_changes": {
                "add": [
                    f"{d.get('source_task', '')} → {d.get('target_task', '')}"
                    for d in dependency_diff.get("add", [])
                ],
                "remove": [
                    f"{d.get('source_task', '')} → {d.get('target_task', '')}"
                    for d in dependency_diff.get("remove", [])
                ]
            },
            "impact": {
                "tasks_to_discard": len(proposal.get("tasks", {}).get("discard", [])),
                "tasks_to_add": len(proposal.get("tasks", {}).get("add", [])),
                "tasks_to_modify": len(proposal.get("tasks", {}).get("modify", [])),
                "dependencies_to_add": len(dependency_diff.get("add", [])),
                "dependencies_to_remove": len(dependency_diff.get("remove", [])),
            }
        }
