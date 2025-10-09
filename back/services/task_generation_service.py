"""
機能からタスクを生成するサービス
バッチ処理で効率的にタスクを生成
"""
import json
import uuid
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from langchain_core.output_parsers import StrOutputParser
from langchain.prompts import ChatPromptTemplate

from .base_service import BaseService
from models.project_base import (
    ProjectBase, ProjectDocument, StructuredFunction, Task
)


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
        
        # 3. バッチに分割
        batches = self._create_batches(functions, self.batch_size)
        
        # 4. 各バッチを処理
        all_tasks = []
        
        for i, batch in enumerate(batches):
            batch_result = await self._process_batch(
                batch, project_context, batch_id=f"batch_{i+1}"
            )
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
        
        # 4. 各バッチを処理
        all_batch_results = []
        all_tasks = []
        
        for i, batch in enumerate(batches):
            batch_result = await self._process_batch(
                batch, project_context, batch_id=f"batch_{i+1}"
            )
            all_batch_results.append(batch_result)
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
            "framework_info": self._extract_framework_info(doc)
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
    
    def _create_batches(self, functions: List[FunctionBatch], batch_size: int) -> List[List[FunctionBatch]]:
        """機能をバッチに分割"""
        batches = []
        for i in range(0, len(functions), batch_size):
            batch = functions[i:i + batch_size]
            batches.append(batch)
        return batches
    
    async def _process_batch(
        self, 
        batch: List[FunctionBatch], 
        project_context: Dict[str, Any],
        batch_id: str
    ) -> BatchTaskResponse:
        """1つのバッチを処理してタスクを生成"""
        import time
        start_time = time.time()
        
        # プロンプトの作成
        prompt = self._create_task_generation_prompt(batch, project_context)
        
        # LLM呼び出し
        try:
            response = await self.llm_pro.ainvoke(prompt)
            response_content = response.content if hasattr(response, 'content') else str(response)
        except Exception as e:
            raise ValueError(f"LLM generation failed: {str(e)}")
        
        # レスポンスをパース
        try:
            parsed_response = self._parse_llm_response(response_content)
            generated_tasks = self._convert_to_generated_tasks(parsed_response, batch)
        except Exception as e:
            raise ValueError(f"Failed to parse LLM response: {str(e)}")
        
        processing_time = time.time() - start_time
        
        return BatchTaskResponse(
            batch_id=batch_id,
            functions_processed=[func.function_id for func in batch],
            generated_tasks=generated_tasks,
            total_tasks=len(generated_tasks),
            processing_time=processing_time
        )
    
    def _create_task_generation_prompt(
        self, 
        batch: List[FunctionBatch], 
        project_context: Dict[str, Any]
    ) -> str:
        """厳密なタスク生成プロンプトを作成"""
        
        functions_text = "\n".join([
            f"- {func.function_code}: {func.function_name} ({func.category}, {func.priority})\n  説明: {func.description}"
            for func in batch
        ])
        
        prompt = f"""あなたは機能をタスクに分解する専門家です。
以下の厳密な思考プロセスに従って処理してください。

## プロジェクト情報
- プロジェクト: {project_context['project_title']}
- 技術スタック: {project_context['tech_stack']}
- アーキテクチャ: {project_context['framework_info'][:200]}

## 対象機能（{len(batch)}個）
{functions_text}

## 思考プロセス（必ず順守）

### Step 1: 機能分類
各機能を以下のパターンに分類：
- データモデル系: テーブル/モデルが必要
- CRUD系: 基本的なデータ操作  
- 認証系: セキュリティ/権限
- UI系: 画面/コンポーネント
- 統合系: 外部API連携
- 分析系: データ集計/可視化

### Step 2: タスク生成ルール
各パターンに対して必須タスクを生成：

**データモデル系の場合:**
1. DBスキーマ設計（必須）
2. モデルクラス実装（必須）
3. マイグレーション実行（必須）

**CRUD系の場合:**
1. APIエンドポイント実装（必須）
2. バリデーション実装（必須）
3. フロントエンド画面実装（必須）

**認証系の場合:**
1. 認証ミドルウェア実装（必須）
2. トークン管理実装（必須）
3. ログイン/ログアウトUI実装（必須）

**UI系の場合:**
1. コンポーネント設計（必須）
2. スタイリング実装（必須）
3. レスポンシブ対応（推奨）

### Step 3: 見積もり時間の設定
- DB設計: 1-2時間
- API実装: 2-4時間
- フロントエンド画面: 3-6時間
- 認証系: 3-5時間
- 統合系: 4-8時間

## 出力形式（必須）
```json
{{
  "tasks": [
    {{
      "function_id": "機能ID",
      "function_name": "機能名",
      "task_name": "具体的なタスク名",
      "task_description": "タスクの詳細説明",
      "category": "DB設計|バックエンド|フロントエンド|認証|統合",
      "priority": "Must|Should|Could",
      "estimated_hours": 2.5,
      "reason": "このタスクが必要な理由"
    }}
  ]
}}
```

必ずJSON形式で出力してください。各機能に対して3-5個のタスクを生成してください。"""

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
    
    def _convert_to_generated_tasks(
        self, 
        parsed_response: Dict[str, Any], 
        batch: List[FunctionBatch]
    ) -> List[GeneratedTask]:
        """パースされたレスポンスをGeneratedTaskオブジェクトに変換"""
        generated_tasks = []
        
        if "tasks" not in parsed_response:
            raise ValueError("No 'tasks' key found in parsed response")
        
        for task_data in parsed_response["tasks"]:
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
            except (KeyError, ValueError, TypeError) as e:
                print(f"Warning: Skipping invalid task data: {e}")
                continue
        
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
    
