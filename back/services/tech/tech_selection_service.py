"""
技術選定サービス

技術領域（domain）と技術スタック（stack）のマスタデータを取得し、
プロジェクト内で決定済みの技術を管理するサービス。
"""

from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from models.tech_preset import TechDomain, TechStack
from models.project_base import Task, TaskHandsOn


class TechSelectionService:
    """技術選定サービス"""

    def __init__(self, db: Session):
        self.db = db

    def get_available_domains(self, ecosystem: Optional[str] = None) -> List[TechDomain]:
        """
        利用可能なdomain一覧を取得

        Args:
            ecosystem: エコシステム（python, next.js等）。指定時はそのエコシステムに
                       stackが存在するdomainのみ返す。

        Returns:
            有効なTechDomainのリスト
        """
        query = self.db.query(TechDomain).filter(TechDomain.is_active == True)

        if ecosystem:
            # 指定エコシステムにstackが存在するdomainのみ
            subquery = self.db.query(TechStack.domain_id).filter(
                TechStack.is_active == True,
                (TechStack.ecosystem == ecosystem) | (TechStack.ecosystem == None)
            ).distinct()
            query = query.filter(TechDomain.id.in_(subquery))

        return query.all()

    def get_stacks_for_domain(
        self,
        domain_key: str,
        ecosystem: Optional[str] = None
    ) -> List[TechStack]:
        """
        domainに属するstack一覧を取得

        Args:
            domain_key: ドメインキー（orm_python等）
            ecosystem: エコシステム（python, next.js等）

        Returns:
            有効なTechStackのリスト
        """
        domain = self.db.query(TechDomain).filter(
            TechDomain.key == domain_key,
            TechDomain.is_active == True
        ).first()

        if not domain:
            return []

        query = self.db.query(TechStack).filter(
            TechStack.domain_id == domain.id,
            TechStack.is_active == True
        )

        if ecosystem:
            query = query.filter(
                (TechStack.ecosystem == ecosystem) | (TechStack.ecosystem == None)
            )

        return query.all()

    def get_domain_by_key(self, domain_key: str) -> Optional[TechDomain]:
        """
        キーでdomainを取得

        Args:
            domain_key: ドメインキー

        Returns:
            TechDomainまたはNone
        """
        return self.db.query(TechDomain).filter(
            TechDomain.key == domain_key,
            TechDomain.is_active == True
        ).first()

    def get_decided_domains(
        self,
        project_id: UUID,
        exclude_task_id: Optional[UUID] = None
    ) -> Dict[str, str]:
        """
        プロジェクト内で決定済みのdomain→stack_keyを取得

        Args:
            project_id: プロジェクトID
            exclude_task_id: 除外するタスクID（現在のタスク）

        Returns:
            決定済みのdomain_key → stack_keyのマッピング
        """
        query = self.db.query(TaskHandsOn).join(Task).filter(
            Task.project_id == project_id,
            TaskHandsOn.generation_state == "completed"
        )

        if exclude_task_id:
            query = query.filter(Task.task_id != exclude_task_id)

        completed_hands_ons = query.all()

        decided = {}
        for ho in completed_hands_ons:
            if not ho.user_interactions:
                continue

            choices = ho.user_interactions.get("choices", [])
            for choice in choices:
                # 新形式: {"domain_key": "xxx", "stack_key": "yyy"}
                domain_key = choice.get("domain_key")
                stack_key = choice.get("stack_key")
                if domain_key and stack_key:
                    decided[domain_key] = stack_key

        return decided

    def get_domains_for_prompt(self, ecosystem: Optional[str] = None) -> str:
        """
        LLMプロンプト用のdomain一覧テキストを生成

        Args:
            ecosystem: エコシステム

        Returns:
            "- orm_python: ORMライブラリ" のような形式のテキスト
        """
        domains = self.get_available_domains(ecosystem)
        lines = []
        for d in domains:
            lines.append(f"- {d.key}: {d.name}")
        return "\n".join(lines)

    def get_decided_for_prompt(
        self,
        project_id: UUID,
        exclude_task_id: Optional[UUID] = None
    ) -> str:
        """
        LLMプロンプト用の決定済み技術テキストを生成

        Args:
            project_id: プロジェクトID
            exclude_task_id: 除外するタスクID

        Returns:
            "- orm_python: sqlalchemy" のような形式のテキスト
        """
        decided = self.get_decided_domains(project_id, exclude_task_id)
        if not decided:
            return "なし"

        lines = []
        for domain_key, stack_key in decided.items():
            lines.append(f"- {domain_key}: {stack_key}")
        return "\n".join(lines)


