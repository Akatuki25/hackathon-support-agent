"""
機能からタスクを生成するサービス
バッチ処理で効率的にタスクを生成
"""
import asyncio
import json
import uuid
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from .base_service import BaseService
from models.project_base import (
    ProjectBase, ProjectDocument, StructuredFunction, Task
)


class ValidationConfig:
    """バリデーションの設定"""
    MAX_RETRIES = 3  # 最大リトライ回数
    RETRY_DELAY = 1  # リトライ間隔（秒）


class FunctionBatch(BaseModel):
    """機能のバッチ処理用モデル"""
    function_id: str
    function_code: str
    function_name: str
    description: str
    category: str
    priority: str


class GeneratedTask(BaseModel):
    """生成されたタスクモデル"""
    function_id: str
    function_name: str
    task_name: str
    task_description: str
    category: str
    priority: str
    estimated_hours: float
    reason: str  # このタスクが必要な理由


class BatchTaskResponse(BaseModel):
    """バッチ処理のレスポンスモデル"""
    batch_id: str
    functions_processed: List[str]
    generated_tasks: List[GeneratedTask]
    total_tasks: int
    processing_time: float


class TaskGenerationService(BaseService):
    """機能からタスクを生成するメインサービス"""
    
    def __init__(self, db: Session):
        super().__init__(db)
        self.batch_size = 5  # 1バッチあたりの機能数
    
    async def generate_tasks_in_memory(self, project_id: str) -> List[GeneratedTask]:
        """
        メモリ上でのみタスクを生成（DB保存なし）
        統合サービスから呼ばれる
        """
        # 1. プロジェクトの基本情報を取得
        project_context = await self._get_project_context(project_id)

        # 2. 全機能を取得
        functions = self._get_all_functions(project_id)

        if not functions:
            raise ValueError("No functions found for this project")

        # 3. ドメイン別にバッチ分割
        domain_batches = await self._create_domain_batches(functions)

        print(f"ドメイン別バッチ分割: {len(domain_batches)}ドメイン")
        for domain_name, domain_funcs in domain_batches.items():
            print(f"  - {domain_name}: {len(domain_funcs)}機能")

        # 4. 各ドメインバッチを並列処理
        batch_tasks = [
            self._process_domain_batch(domain_name, domain_funcs, project_context)
            for domain_name, domain_funcs in domain_batches.items()
        ]

        batch_results = await asyncio.gather(*batch_tasks)

        all_tasks = []
        for batch_result in batch_results:
            all_tasks.extend(batch_result.generated_tasks)

        return all_tasks
    
    async def generate_tasks_from_functions(self, project_id: str) -> Dict[str, Any]:
        """
        プロジェクトの全機能からタスクを生成
        """
        import time
        start_time = time.time()
        
        # 1. プロジェクトの基本情報を取得
        project_context = await self._get_project_context(project_id)
        
        # 2. 全機能を取得
        functions = self._get_all_functions(project_id)
        
        if not functions:
            raise ValueError("No functions found for this project")
        
        # 3. バッチに分割
        batches = self._create_batches(functions, self.batch_size)
        
        # 4. 各バッチを並列処理
        batch_tasks = [
            self._process_batch(batch, project_context, batch_id=f"batch_{i+1}")
            for i, batch in enumerate(batches)
        ]

        all_batch_results = await asyncio.gather(*batch_tasks)

        all_tasks = []
        for batch_result in all_batch_results:
            all_tasks.extend(batch_result.generated_tasks)
        
        processing_time = time.time() - start_time
        
        # メモリ上でのみ処理、DB保存はしない
        # complete_task_generation_service.py を使用してください
        
        return {
            "project_id": project_id,
            "total_functions": len(functions),
            "total_batches": len(batches),
            "total_tasks_generated": len(all_tasks),
            "batch_results": all_batch_results,
            "processing_time": processing_time,
            "generated_tasks": [task.dict() for task in all_tasks],
            "warning": "このメソッドはメモリ上でのみ動作します。完全なタスク生成にはCompleteTaskGenerationServiceを使用してください"
        }
    
    async def _get_project_context(self, project_id: str) -> Dict[str, Any]:
        """プロジェクトの基本コンテキストを取得"""
        import uuid
        project_uuid = uuid.UUID(project_id)
        project = self.db.query(ProjectBase).filter_by(project_id=project_uuid).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # プロジェクトドキュメントから技術スタック情報を取得
        doc = self.db.query(ProjectDocument).filter_by(project_id=project_uuid).first()

        context = {
            "project_title": project.title,
            "project_idea": project.idea,
            "tech_stack": self._extract_tech_stack(doc),
            "framework_info": self._extract_framework_info(doc),
            "specification": doc.specification if doc else "",
            "function_doc": doc.function_doc if doc else ""
        }

        return context
    
    def _extract_tech_stack(self, doc: Optional[ProjectDocument]) -> str:
        """ドキュメントから技術スタックを抽出"""
        if not doc or not doc.frame_work_doc:
            return "Next.js, FastAPI, PostgreSQL"  # デフォルト
        
        # フレームワークドキュメントから技術スタックを抽出（簡易版）
        framework_text = doc.frame_work_doc.lower()
        
        tech_stack = []
        if "next.js" in framework_text or "nextjs" in framework_text:
            tech_stack.append("Next.js")
        if "fastapi" in framework_text:
            tech_stack.append("FastAPI")
        if "postgresql" in framework_text or "postgres" in framework_text:
            tech_stack.append("PostgreSQL")
        if "react" in framework_text:
            tech_stack.append("React")
        
        return ", ".join(tech_stack) if tech_stack else "Web技術スタック"
    
    def _extract_framework_info(self, doc: Optional[ProjectDocument]) -> str:
        """ドキュメントからフレームワーク情報を抽出"""
        if not doc or not doc.frame_work_doc:
            return "標準的なWebアプリケーション"
        
        # フレームワークドキュメントの最初の500文字を要約として使用
        return doc.frame_work_doc[:500] + "..." if len(doc.frame_work_doc) > 500 else doc.frame_work_doc
    
    def _get_all_functions(self, project_id: str) -> List[FunctionBatch]:
        """プロジェクトの全機能を取得"""
        import uuid
        project_uuid = uuid.UUID(project_id)
        functions = self.db.query(StructuredFunction).filter_by(
            project_id=project_uuid
        ).order_by(StructuredFunction.order_index).all()
        
        return [
            FunctionBatch(
                function_id=str(func.function_id),
                function_code=func.function_code,
                function_name=func.function_name,
                description=func.description,
                category=func.category,
                priority=func.priority
            )
            for func in functions
        ]
    
    async def _create_domain_batches(self, functions: List[FunctionBatch]) -> Dict[str, List[FunctionBatch]]:
        """LLMを使って機能をドメイン別にグルーピング"""

        # 機能リストを生成
        functions_list = "\n".join([
            f"{i+1}. [{func.category}] {func.function_name}: {func.description[:80] if func.description else '説明なし'}"
            for i, func in enumerate(functions)
        ])

        prompt = f"""以下の機能を論理的なドメイン（業務領域）ごとにグルーピングしてください。

## 機能一覧（{len(functions)}個）
{functions_list}

## グルーピングルール
- 同じデータモデルを扱う機能は同じドメイン（例: ユーザーテーブルを使う機能は全て「ユーザー管理」）
- データ層（data）、API層、UI層が同じドメインなら必ず統合
- 例: 「ユーザーデータ管理」(data) + 「ユーザー認証API」(auth) + 「ユーザー登録画面」(ui) → 「ユーザー管理」ドメイン

## 出力形式（JSON）
```json
{{
  "domains": [
    {{
      "domain_name": "ドメイン名（簡潔に）",
      "function_indices": [1, 6, 13],
      "reason": "このドメインにグルーピングした理由"
    }}
  ]
}}
```

**重要**: 同じデータを扱う機能は必ず同じドメインにまとめてください。"""

        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1)

        response = await llm.ainvoke(prompt)
        response_content = response.content if hasattr(response, 'content') else str(response)
        domain_mapping = self._parse_llm_response(response_content)

        # ドメインごとに機能をグループ化
        domain_batches = {}
        for domain in domain_mapping.get("domains", []):
            domain_name = domain["domain_name"]
            indices = domain["function_indices"]
            domain_batches[domain_name] = [
                functions[idx - 1] for idx in indices if 0 < idx <= len(functions)
            ]
            print(f"  ドメイン「{domain_name}」: {len(domain_batches[domain_name])}機能")
            print(f"    理由: {domain.get('reason', '不明')}")

        return domain_batches
    
    async def _process_batch(
        self,
        batch: List[FunctionBatch],
        project_context: Dict[str, Any],
        batch_id: str
    ) -> BatchTaskResponse:
        """1つのバッチを処理してタスクを生成（リトライ機能付き）"""
        start_time = time.time()

        # リトライループ
        for attempt in range(ValidationConfig.MAX_RETRIES):
            try:
                # プロンプトの作成
                prompt = self._create_task_generation_prompt(batch, project_context, attempt)

                # LLM呼び出し
                response = await self.llm_pro.ainvoke(prompt)
                response_content = response.content if hasattr(response, 'content') else str(response)

                # レスポンスをパース
                parsed_response = self._parse_llm_response(response_content)

                # Pydanticバリデーション付きでタスクに変換
                generated_tasks, validation_errors = self._convert_to_generated_tasks_with_validation(
                    parsed_response, batch
                )

                # バリデーションエラーがない、または最後の試行
                if not validation_errors or attempt == ValidationConfig.MAX_RETRIES - 1:
                    if validation_errors:
                        self.logger.error(
                            f"❌ Batch {batch_id}: Validation errors remain after {ValidationConfig.MAX_RETRIES} attempts. "
                            f"Generated {len(generated_tasks)}/{len(parsed_response.get('tasks', []))} tasks. "
                            f"Errors: {validation_errors[:3]}"  # 最初の3件のみ表示
                        )
                    else:
                        self.logger.info(f"✅ Batch {batch_id}: All tasks validated successfully on attempt {attempt + 1}")

                    processing_time = time.time() - start_time
                    return BatchTaskResponse(
                        batch_id=batch_id,
                        functions_processed=[func.function_id for func in batch],
                        generated_tasks=generated_tasks,
                        total_tasks=len(generated_tasks),
                        processing_time=processing_time
                    )

                # バリデーションエラーがある場合はリトライ
                self.logger.warning(
                    f"⚠️ Batch {batch_id}: Validation failed on attempt {attempt + 1}/{ValidationConfig.MAX_RETRIES}. "
                    f"Errors: {len(validation_errors)} tasks failed validation. Retrying..."
                )
                time.sleep(ValidationConfig.RETRY_DELAY)

            except Exception as e:
                self.logger.error(f"Error in batch processing attempt {attempt + 1}: {str(e)}")
                if attempt == ValidationConfig.MAX_RETRIES - 1:
                    raise ValueError(f"Batch processing failed after {ValidationConfig.MAX_RETRIES} attempts: {str(e)}")
                time.sleep(ValidationConfig.RETRY_DELAY)

    async def _process_domain_batch(
        self,
        domain_name: str,
        batch: List[FunctionBatch],
        project_context: Dict[str, Any]
    ) -> BatchTaskResponse:
        """ドメイン単位のバッチを処理してタスクを生成"""
        start_time = time.time()
        batch_id = f"domain_{domain_name}"

        # リトライループ
        for attempt in range(ValidationConfig.MAX_RETRIES):
            try:
                # ドメイン特化型プロンプトの作成
                prompt = self._create_domain_prompt(domain_name, batch, project_context, attempt)

                # LLM呼び出し
                response = await self.llm_pro.ainvoke(prompt)
                response_content = response.content if hasattr(response, 'content') else str(response)

                # レスポンスをパース
                parsed_response = self._parse_llm_response(response_content)

                # Pydanticバリデーション付きでタスクに変換
                generated_tasks, validation_errors = self._convert_to_generated_tasks_with_validation(
                    parsed_response, batch
                )

                # バリデーションエラーがない、または最後の試行
                if not validation_errors or attempt == ValidationConfig.MAX_RETRIES - 1:
                    if validation_errors:
                        self.logger.error(
                            f"❌ Domain {domain_name}: Validation errors remain after {ValidationConfig.MAX_RETRIES} attempts. "
                            f"Generated {len(generated_tasks)}/{len(parsed_response.get('tasks', []))} tasks. "
                            f"Errors: {validation_errors[:3]}"
                        )
                    else:
                        self.logger.info(f"✅ Domain {domain_name}: All tasks validated successfully on attempt {attempt + 1}")

                    processing_time = time.time() - start_time
                    return BatchTaskResponse(
                        batch_id=batch_id,
                        functions_processed=[func.function_id for func in batch],
                        generated_tasks=generated_tasks,
                        total_tasks=len(generated_tasks),
                        processing_time=processing_time
                    )

                # バリデーションエラーがある場合はリトライ
                self.logger.warning(
                    f"⚠️ Domain {domain_name}: Validation failed on attempt {attempt + 1}/{ValidationConfig.MAX_RETRIES}. "
                    f"Errors: {len(validation_errors)} tasks failed validation. Retrying..."
                )
                time.sleep(ValidationConfig.RETRY_DELAY)

            except Exception as e:
                self.logger.error(f"Error in domain batch processing attempt {attempt + 1}: {str(e)}")
                if attempt == ValidationConfig.MAX_RETRIES - 1:
                    raise ValueError(f"Domain batch processing failed after {ValidationConfig.MAX_RETRIES} attempts: {str(e)}")
                time.sleep(ValidationConfig.RETRY_DELAY)

    def _create_domain_prompt(
        self,
        domain_name: str,
        batch: List[FunctionBatch],
        project_context: Dict[str, Any],
        attempt: int = 0
    ) -> str:
        """ドメイン特化型タスク生成プロンプトを作成"""

        functions_text = "\n".join([
            f"- {func.function_code}: {func.function_name} ({func.category}, {func.priority})\n  説明: {func.description}"
            for func in batch
        ])

        retry_warning = ""
        if attempt > 0:
            retry_warning = f"""
⚠️ **これは{attempt + 1}回目の試行です。前回バリデーションエラーがありました。**
- すべての必須フィールドを必ず含めてください
- データ型を正確に守ってください（estimated_hoursは数値）
- 空文字列や不正な値を避けてください
"""

        # 仕様書から関連部分を抽出（最大2000文字）
        spec_context = ""
        if project_context.get("specification"):
            spec_text = project_context["specification"]
            # ドメイン名に関連する部分を優先的に抽出
            if domain_name in spec_text:
                # ドメイン名が含まれるセクションを抽出
                lines = spec_text.split('\n')
                relevant_lines = []
                in_relevant_section = False
                for line in lines:
                    if domain_name in line:
                        in_relevant_section = True
                    if in_relevant_section:
                        relevant_lines.append(line)
                        if len('\n'.join(relevant_lines)) > 2000:
                            break
                    if line.startswith('##') and in_relevant_section and domain_name not in line:
                        in_relevant_section = False
                spec_context = '\n'.join(relevant_lines[:30])  # 最大30行
            else:
                # 全体から抽出
                spec_context = spec_text[:2000]

        spec_section = ""
        if spec_context:
            spec_section = f"""
## プロジェクト仕様（「{domain_name}」ドメイン関連）
{spec_context}

**重要**: この仕様書の情報を使って、ドメイン間の連携や整合性を考慮してください。
"""

        prompt = f"""あなたは機能をタスクに分解する専門家です。
今回は **「{domain_name}」ドメイン** に特化したタスク生成を行います。
{retry_warning}
## プロジェクト情報
- プロジェクト: {project_context['project_title']}
- 技術スタック: {project_context['tech_stack']}
- アーキテクチャ: {project_context['framework_info'][:200]}
{spec_section}
## 対象ドメイン: {domain_name}

このドメインには以下の機能が含まれます（{len(batch)}個）:
{functions_text}

## ドメイン特化型の重要な方針

**このバッチには「{domain_name}」ドメインの全レイヤーが含まれています:**
- データ層（DBモデル、スキーマ）
- API層（エンドポイント、ビジネスロジック）
- UI層（画面、コンポーネント）

**タスク生成ルール:**
1. **レイヤーごとに統合されたタスクを作成**
   - データ層タスク: 「{domain_name}のDBモデル・スキーマ設計」
   - API層タスク: 「{domain_name}のAPIエンドポイント実装」
   - UI層タスク: 「{domain_name}の画面実装」

2. **レイヤー間の重複を絶対に避ける**
   - 同じ機能が複数のカテゴリ（data/auth/logicなど）に分かれている場合、それらは1つのドメインの異なるレイヤーです
   - 例: 「ユーザーデータ管理」(data) + 「ユーザー認証API」(auth) → 別々のタスクとして扱う

3. **タスク数の目安**
   - 各レイヤーに1-2個のタスク
   - ドメイン全体で3-6個のタスク程度

4. **他ドメインとの連携を考慮**
   - 仕様書のフロー情報を参考に、他ドメインとのAPI連携を意識
   - 依存関係は後の工程で自動生成されるため、ここでは明示不要

## 出力形式（必須）
```json
{{
  "tasks": [
    {{
      "function_id": "機能ID",
      "function_name": "機能名",
      "task_name": "具体的なタスク名（レイヤーを明示）",
      "task_description": "タスクの詳細説明（統合された作業内容を明記）",
      "category": "DB設計|バックエンド|フロントエンド",
      "priority": "Must|Should|Could",
      "estimated_hours": 6.0,
      "reason": "このタスクが必要な理由"
    }}
  ]
}}
```

**重要**: 「{domain_name}」ドメインの完全な実装に必要なタスクのみを生成してください。重複を避け、レイヤーごとに明確に分離してください。"""

        return prompt

    def _create_task_generation_prompt(
        self,
        batch: List[FunctionBatch],
        project_context: Dict[str, Any],
        attempt: int = 0
    ) -> str:
        """厳密なタスク生成プロンプトを作成"""
        
        functions_text = "\n".join([
            f"- {func.function_code}: {func.function_name} ({func.category}, {func.priority})\n  説明: {func.description}"
            for func in batch
        ])
        
        retry_warning = ""
        if attempt > 0:
            retry_warning = f"""
⚠️ **これは{attempt + 1}回目の試行です。前回バリデーションエラーがありました。**
- すべての必須フィールドを必ず含めてください
- データ型を正確に守ってください（estimated_hoursは数値）
- 空文字列や不正な値を避けてください
"""

        prompt = f"""あなたは機能をタスクに分解する専門家です。
以下の厳密な思考プロセスに従って処理してください。
{retry_warning}
## プロジェクト情報
- プロジェクト: {project_context['project_title']}
- 技術スタック: {project_context['tech_stack']}
- アーキテクチャ: {project_context['framework_info'][:200]}

## 対象機能（{len(batch)}個）
{functions_text}

## 重要な方針
- 機能自体は既に大きくまとめられた単位で送られている（例: "ユーザー管理"、"プロジェクト管理"）
- タスクは機能を実装しやすい単位に分割する
- **ハッカソンは時間が限られているため、タスク数を最小限にする**
- **1機能あたり2-3個のタスク**を目安とする（最大4個まで）
- 関連する細かい作業は必ず1つのタスクにまとめる
- **全体で30-50タスク程度**に収めることを意識する

## タスク生成ルール

各機能パターンに対して、**統合されたタスク**を生成：

**ユーザー管理系（認証含む）の場合:**
1. 「ユーザー管理のバックエンド実装」
   → DBモデル、認証ロジック、APIエンドポイントをそれぞれタスクとして登録
   → 見積: 6-10時間
2. 「ユーザー管理のフロントエンド実装」
   → ログイン画面、登録画面、プロフィール画面をそれぞれタスクとして登録
   → 見積: 6-10時間

**データ管理系（CRUD）の場合:**
1. 「[機能名]のバックエンド実装」
   → DBモデル、APIエンドポイント、バリデーションをそれぞれタスクとして登録
   → 見積: 4-8時間
2. 「[機能名]のフロントエンド実装」
   → 一覧画面、詳細画面、編集画面、削除機能をそれぞれタスクとして登録
   → 見積: 6-10時間

**UI中心の機能の場合:**
1. 「[機能名]の画面実装」
   → コンポーネント設計、スタイリング、レスポンシブ対応をそれぞれタスクとして登録
   → 見積: 4-8時間
2. 「[機能名]のデータ連携」（必要な場合のみ）
   → API連携、状態管理をそれぞれタスクとして登録
   → 見積: 2-4時間

**外部連携系の場合:**
1. 「[サービス名]連携機能の実装」
   → API接続、データマッピング、エラーハンドリングをそれぞれタスクとして登録
   → 見積: 4-8時間

## タスク統合の原則
- DBスキーマ設計とモデル実装は**1つのタスク**にまとめる
- 関連するAPIエンドポイントは**1つのタスク**にまとめる
- 関連する画面（一覧・詳細・編集）は**1つのタスク**にまとめる
- タスクの説明に関しては過不足なく**必要な要件を全て**記載すること
- バックエンドとフロントエンドは**分離**する（別タスク）

## 出力形式（必須）
```json
{{
  "tasks": [
    {{
      "function_id": "機能ID",
      "function_name": "機能名",
      "task_name": "具体的なタスク名",
      "task_description": "タスクの詳細説明（統合された作業内容を明記）",
      "category": "DB設計|バックエンド|フロントエンド",
      "priority": "Must|Should|Could",
      "estimated_hours": 6.0,
      "reason": "このタスクが必要な理由"
    }}
  ]
}}
```

**重要**: 各機能に対して**2-4個のタスク**を生成してください。細かく分割しすぎないでください。"""

        return prompt
    
    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """LLMレスポンスをJSONとしてパース"""
        try:
            # JSONブロックを抽出
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                json_text = response[json_start:json_end].strip()
            else:
                # JSON部分を探す
                start = response.find("{")
                end = response.rfind("}") + 1
                if start == -1 or end == 0:
                    raise ValueError("JSON not found in response")
                json_text = response[start:end]
            
            return json.loads(json_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in LLM response: {e}")
    
    def _convert_to_generated_tasks_with_validation(
        self,
        parsed_response: Dict[str, Any],
        batch: List[FunctionBatch]
    ) -> tuple[List[GeneratedTask], List[str]]:
        """
        パースされたレスポンスをGeneratedTaskオブジェクトに変換（バリデーションエラーを返す）

        Returns:
            tuple: (成功したタスクのリスト, エラーメッセージのリスト)
        """
        generated_tasks = []
        validation_errors = []

        if "tasks" not in parsed_response:
            raise ValueError("No 'tasks' key found in parsed response")

        for idx, task_data in enumerate(parsed_response["tasks"]):
            try:
                # function_idを適切に設定（LLMの出力では正しくないことがある）
                function_id = task_data.get("function_id")
                if function_id and function_id in ["機能ID", "Unknown", ""]:
                    # バッチの最初の機能IDを使用（単一機能バッチの場合）
                    function_id = batch[0].function_id if batch else None
                elif function_id:
                    # バッチから対応する機能を探す
                    matching_func = next((f for f in batch if f.function_code in str(function_id) or f.function_name in str(function_id)), None)
                    function_id = matching_func.function_id if matching_func else batch[0].function_id if batch else None

                # Pydanticバリデーション
                task = GeneratedTask(
                    function_id=function_id,
                    function_name=task_data["function_name"],
                    task_name=task_data["task_name"],
                    task_description=task_data.get("task_description", ""),
                    category=task_data["category"],
                    priority=task_data.get("priority", "Should"),
                    estimated_hours=float(task_data.get("estimated_hours", 2.0)),
                    reason=task_data.get("reason", "")
                )
                generated_tasks.append(task)

            except ValidationError as e:
                # Pydanticバリデーションエラー
                error_msg = f"Task {idx + 1} validation failed: {e.errors()}"
                validation_errors.append(error_msg)
                self.logger.debug(f"Pydantic validation error: {error_msg}")

            except (KeyError, ValueError, TypeError) as e:
                # その他のエラー（必須フィールド欠落、型変換エラーなど）
                error_msg = f"Task {idx + 1} processing failed: {str(e)}"
                validation_errors.append(error_msg)
                self.logger.debug(f"Task processing error: {error_msg}")

        return generated_tasks, validation_errors

    def _convert_to_generated_tasks(
        self,
        parsed_response: Dict[str, Any],
        batch: List[FunctionBatch]
    ) -> List[GeneratedTask]:
        """
        パースされたレスポンスをGeneratedTaskオブジェクトに変換（後方互換性のため残す）
        """
        generated_tasks, _ = self._convert_to_generated_tasks_with_validation(parsed_response, batch)
        return generated_tasks
    
    
    def _determine_assignee(self, category: str) -> str:
        """カテゴリに基づいて担当者を決定"""
        assignee_map = {
            "DB設計": "バックエンド担当",
            "バックエンド": "バックエンド担当", 
            "フロントエンド": "フロントエンド担当",
            "認証": "バックエンド担当",
            "統合": "エンジニア",
            "デプロイ": "DevOps担当",
            "環境構築": "エンジニア"
        }
        return assignee_map.get(category, "エンジニア")
    
