"""
FunctionStructuring Workflow using LangGraph StateGraph.

Plan-and-Execute pattern implementation.
"""

import os
import time
import json
import asyncio
import re
import uuid
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.prompts import ChatPromptTemplate
from google import genai
from google.genai import types

from ..core import BaseService
from .function_structuring_state import GlobalState, FocusAreaState, create_initial_state
from .function_structuring_schemas import (
    ExtractionPlan,
    FunctionExtractionOutput,
    StructuredFunctionOutput,
    DependencyAnalysisOutput,
    FunctionCategory,
    FunctionPriority,
    FunctionValidationResult
)
from models.project_base import StructuredFunction, FunctionDependency, ProjectDocument, ProjectBase


class FunctionStructuringWorkflow:
    """
    StateGraph-based function structuring workflow.

    Plan-and-Execute pattern for deterministic execution.
    """

    def __init__(self, db: Session):
        self.db = db
        self.base_service = BaseService(db=db)
        self.logger = self.base_service.logger

        # LLMアクセス
        self.llm_pro = self.base_service.llm_pro
        self.llm_flash = self.base_service.llm_flash

        # Google GenAI クライアント（Context Cache用）
        self.genai_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

        # メイングラフ
        self.workflow = StateGraph(GlobalState)
        self._build_graph()

        # Checkpointer（状態永続化）
        self.app = self.workflow.compile(checkpointer=MemorySaver())

    def _build_graph(self):
        """グラフ構造を構築"""

        # ノード追加
        self.workflow.add_node("planning", self._planning_node)
        self.workflow.add_node("create_cache", self._create_cache_node)
        self.workflow.add_node("parallel_extraction", self._parallel_extraction_node)
        self.workflow.add_node("merge", self._merge_results_node)
        self.workflow.add_node("parallel_structuring", self._parallel_structuring_node)
        self.workflow.add_node("persistence", self._persistence_node)

        # エントリーポイント
        self.workflow.set_entry_point("planning")

        # エッジ定義（確定的な遷移）
        self.workflow.add_edge("planning", "create_cache")
        self.workflow.add_edge("create_cache", "parallel_extraction")
        self.workflow.add_edge("parallel_extraction", "merge")
        self.workflow.add_edge("merge", "parallel_structuring")
        self.workflow.add_edge("parallel_structuring", "persistence")
        self.workflow.add_edge("persistence", END)

    # ===================================================================
    # Workflow Nodes
    # ===================================================================

    def _planning_node(self, state: GlobalState) -> GlobalState:
        """
        計画ノード

        機能抽出の戦略を立案し、focus_areasを決定。
        """
        self.logger.info("[PLANNING] Starting planning phase")

        try:
            # Phase 2: 簡易実装（固定計画）
            # Phase 3以降: LLMによる動的計画

            plan = {
                "strategy": "parallel_extraction",
                "focus_areas": [
                    "データ・モデル",
                    "API・バックエンド",
                    "UI・画面"
                ]
            }

            state["plan"] = plan
            state["focus_areas"] = plan["focus_areas"]

            self.logger.info(f"[PLANNING] Plan created with {len(plan['focus_areas'])} focus areas")

            return state

        except Exception as e:
            self.logger.error(f"[PLANNING] Planning failed: {str(e)}")
            state["errors"].append(f"Planning error: {str(e)}")
            # フォールバック: 単一フォーカスエリア
            state["focus_areas"] = ["全機能"]
            return state

    def _invoke_with_cache(self, cache_name: str, prompt: str, response_schema: Dict) -> Dict:
        """
        Context Cacheを使用してモデルを呼び出す

        Args:
            cache_name: キャッシュ名
            prompt: プロンプト
            response_schema: JSONスキーマ（Pydanticモデルから生成）

        Returns:
            構造化されたレスポンス
        """
        try:
            response = self.genai_client.models.generate_content(
                model='gemini-2.0-flash-001',
                contents=prompt,
                config=types.GenerateContentConfig(
                    cached_content=cache_name,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                )
            )

            # JSONレスポンスをパース
            return json.loads(response.text)

        except Exception as e:
            self.logger.error(f"[CACHE] Cached invocation failed: {str(e)}")
            raise

    def _create_cache_node(self, state: GlobalState) -> GlobalState:
        """
        Context Cache作成ノード

        固定コンテキスト（function_doc, specification, constraints）を
        Google GenAI Context Cache APIでキャッシュ化。
        """
        self.logger.info("[CACHE] Creating context cache")

        try:
            # キャッシュ対象コンテンツの構築（全コンテキストを含める）
            cache_parts = []

            # プロジェクト制約情報
            if state.get("constraints"):
                cache_parts.append(f"## プロジェクト情報\n{json.dumps(state['constraints'], ensure_ascii=False, indent=2)}")

            # 機能要件書（必須）
            cache_parts.append(f"## 機能要件書\n{state['function_doc']}")

            # 要件定義書（オプション）
            if state.get("specification"):
                cache_parts.append(f"## 要件定義書\n{state['specification']}")

            # 技術スタック情報（オプション）
            if state.get("framework_doc"):
                cache_parts.append(f"## 技術スタック\n{state['framework_doc']}")

            cache_content = "\n\n".join(cache_parts)

            # Context Cache作成
            cache = self.genai_client.caches.create(
                model='models/gemini-2.0-flash-001',
                config=types.CreateCachedContentConfig(
                    display_name=f'project_{state["project_id"]}_function_structuring',
                    system_instruction="あなたは機能要件書から構造化された機能を抽出するエキスパートです。",
                    contents=[{
                        "role": "user",
                        "parts": [{
                            "text": f"""{cache_content}

上記のドキュメントを参照してください。"""
                        }]
                    }],
                    ttl="3600s",
                )
            )

            state["cache_created"] = True
            state["cache_name"] = cache.name

            self.logger.info(f"[CACHE] Context cache created: {cache.name}")

            return state

        except Exception as e:
            self.logger.error(f"[CACHE] Cache creation failed: {str(e)}")
            state["errors"].append(f"Cache error: {str(e)}")
            state["cache_created"] = False
            state["cache_name"] = None
            return state

    def _parallel_extraction_node(self, state: GlobalState) -> GlobalState:
        """
        並列抽出ノード（同期ラッパー）
        """
        return asyncio.run(self._parallel_extraction_node_async(state))

    async def _parallel_extraction_node_async(self, state: GlobalState) -> GlobalState:
        """
        並列抽出ノード

        各focus_areaごとにSubGraphで機能抽出・構造化を並列実行。

        Phase 2: 逐次実行（Phase 3-4で並列化）
        """
        self.logger.info("[PARALLEL_EXTRACT] Starting parallel extraction")

        try:
            focus_areas = state["focus_areas"]
            area_states = {}

            # Phase 3-4: asyncio.gather()で並列実行
            # Phase 2: 逐次実行
            for area in focus_areas:
                self.logger.info(f"[PARALLEL_EXTRACT] Processing focus area: {area}")
                area_state = await self._process_focus_area_async(area, state)
                area_states[area] = area_state

            state["area_states"] = area_states

            self.logger.info(f"[PARALLEL_EXTRACT] Completed: {len(area_states)} areas processed")

            return state

        except Exception as e:
            self.logger.error(f"[PARALLEL_EXTRACT] Parallel extraction failed: {str(e)}")
            state["errors"].append(f"Parallel extraction error: {str(e)}")
            return state

    async def _process_focus_area_async(self, focus_area: str, state: GlobalState) -> FocusAreaState:
        """
        focus_area別の処理（抽出のみ）

        カテゴリ・優先度・依存関係はmerge後に全体で実行
        """
        start_time = time.time()
        try:
            # 機能抽出のみ
            context = {
                "project": state["constraints"],
                "focus_area": focus_area,
                "retry_instruction": ""
            }
            cache_name = state.get("cache_name")
            extracted = await self._extract_functions(state["function_doc"], context, cache_name)

            if not extracted:
                self.logger.warning(f"[PROCESS_FOCUS_AREA] {focus_area}: No functions extracted")
                return FocusAreaState(
                    focus_area=focus_area,
                    extracted_functions=[],
                    structured_functions=[],
                    dependencies=[],
                    processing_time=time.time() - start_time
                )

            processing_time = time.time() - start_time

            self.logger.info(f"[PROCESS_FOCUS_AREA] {focus_area} completed in {processing_time:.2f}s - {len(extracted)} functions extracted")

            return FocusAreaState(
                focus_area=focus_area,
                extracted_functions=extracted,
                structured_functions=[],  # merge後に処理
                dependencies=[],  # merge後に処理
                processing_time=processing_time
            )

        except Exception as e:
            self.logger.error(f"[PROCESS_FOCUS_AREA] Error in {focus_area}: {str(e)}", exc_info=True)
            return FocusAreaState(
                focus_area=focus_area,
                extracted_functions=[],
                structured_functions=[],
                dependencies=[],
                processing_time=time.time() - start_time
            )

    async def _parallel_structure_functions(
        self,
        extracted: List[Dict],
        state: GlobalState
    ) -> tuple[List[Dict], List[Dict], List[Dict]]:
        """
        カテゴリ・優先度・依存関係を並列実行

        Phase 2: 逐次実行
        Phase 3-4: asyncio.gather()で並列実行
        """
        context = {"project": state["constraints"], "technology": state.get("technology", {})}

        # Phase 3-4: 並列実行
        # categorized_task = asyncio.to_thread(self._categorize_functions, extracted, context)
        # prioritized_task = asyncio.to_thread(self._assign_priorities, extracted, context)
        # dependencies_task = asyncio.to_thread(self._analyze_dependencies, extracted, context)
        # categorized, prioritized, dependencies = await asyncio.gather(...)

        # Phase 2: 逐次実行
        categorized = self._categorize_functions(extracted, context)
        prioritized = self._assign_priorities(categorized, context)
        dependencies = self._analyze_dependencies(prioritized, context)

        return categorized, prioritized, dependencies

    def _merge_results_node(self, state: GlobalState) -> GlobalState:
        """
        マージノード

        各focus_areaの結果を統合し、重複排除を実施。
        """
        self.logger.info("[MERGE] Merging results from all focus areas")

        try:
            all_functions = []
            all_dependencies = []

            # 各focus_areaの結果を収集（extractedのみ）
            for area, area_state in state["area_states"].items():
                all_functions.extend(area_state["extracted_functions"])

            # 重複排除（function_nameベース）
            unique_functions = []
            seen_names = set()

            for func in all_functions:
                name = func.get("function_name", "")
                if name and name not in seen_names:
                    unique_functions.append(func)
                    seen_names.add(name)

            state["all_functions"] = unique_functions
            state["all_dependencies"] = []  # まだ依存関係は計算していない

            self.logger.info(f"[MERGE] Merged: {len(unique_functions)} unique functions")

            return state

        except Exception as e:
            self.logger.error(f"[MERGE] Merge failed: {str(e)}")
            state["errors"].append(f"Merge error: {str(e)}")
            return state

    def _parallel_structuring_node(self, state: GlobalState) -> GlobalState:
        """
        カテゴリ・優先度・依存関係を並列実行（asyncio.gather）
        """
        self.logger.info("[PARALLEL_STRUCTURING] Starting parallel structuring")

        try:
            functions = state["all_functions"]
            context = {"project": state["constraints"], "technology": state.get("technology", {})}

            # asyncio.gather で真の並列実行（非同期関数を直接呼び出し）
            try:
                loop = asyncio.get_event_loop()
                if loop.is_closed():
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            categorized, prioritized, dependencies = loop.run_until_complete(
                asyncio.gather(
                    self._categorize_functions(functions, context),
                    self._assign_priorities(functions, context),
                    self._analyze_dependencies(functions, context)
                )
            )

            # loop.close()は呼ばない - gRPCのクリーンアップが後で走るため

            # prioritized が最終結果（category, priority 両方含む）
            state["all_functions"] = prioritized
            state["all_dependencies"] = dependencies

            self.logger.info(f"[PARALLEL_STRUCTURING] Completed: {len(prioritized)} functions, {len(dependencies)} dependencies")
            return state

        except Exception as e:
            self.logger.error(f"[PARALLEL_STRUCTURING] Failed: {str(e)}", exc_info=True)
            state["errors"].append(f"Parallel structuring error: {str(e)}")
            return state

    def _categorization_node(self, state: GlobalState) -> GlobalState:
        """
        カテゴリ分類ノード（merge後の全機能に対して1回）
        """
        self.logger.info("[CATEGORIZATION] Starting categorization")

        try:
            functions = state["all_functions"]
            context = {"project": state["constraints"], "technology": state.get("technology", {})}

            categorized = self._categorize_functions(functions, context)
            state["all_functions"] = categorized

            self.logger.info(f"[CATEGORIZATION] Categorized {len(categorized)} functions")
            return state

        except Exception as e:
            self.logger.error(f"[CATEGORIZATION] Failed: {str(e)}", exc_info=True)
            state["errors"].append(f"Categorization error: {str(e)}")
            return state

    def _priority_node(self, state: GlobalState) -> GlobalState:
        """
        優先度割り当てノード（merge後の全機能に対して1回）
        """
        self.logger.info("[PRIORITY] Starting priority assignment")

        try:
            functions = state["all_functions"]
            context = {"project": state["constraints"], "technology": state.get("technology", {})}

            prioritized = self._assign_priorities(functions, context)
            state["all_functions"] = prioritized

            self.logger.info(f"[PRIORITY] Assigned priorities to {len(prioritized)} functions")
            return state

        except Exception as e:
            self.logger.error(f"[PRIORITY] Failed: {str(e)}", exc_info=True)
            state["errors"].append(f"Priority error: {str(e)}")
            return state

    def _dependency_node(self, state: GlobalState) -> GlobalState:
        """
        依存関係分析ノード（merge後の全機能に対して1回）
        """
        self.logger.info("[DEPENDENCY] Starting dependency analysis")

        try:
            functions = state["all_functions"]
            context = {"project": state["constraints"], "technology": state.get("technology", {})}

            dependencies = self._analyze_dependencies(functions, context)
            state["all_dependencies"] = dependencies

            self.logger.info(f"[DEPENDENCY] Analyzed {len(dependencies)} dependencies")
            return state

        except Exception as e:
            self.logger.error(f"[DEPENDENCY] Failed: {str(e)}", exc_info=True)
            state["errors"].append(f"Dependency error: {str(e)}")
            return state

    def _persistence_node(self, state: GlobalState) -> GlobalState:
        """
        DB永続化ノード

        構造化された機能をDBに保存。
        """
        self.logger.info("[PERSISTENCE] Saving to database")

        try:
            functions = state["all_functions"]
            dependencies = state["all_dependencies"]
            project_id = state["project_id"]

            # 既存データを削除（重複を防ぐため）
            self.db.query(FunctionDependency).filter(
                FunctionDependency.from_function_id.in_(
                    self.db.query(StructuredFunction.function_id).filter(
                        StructuredFunction.project_id == project_id
                    )
                )
            ).delete(synchronize_session=False)

            self.db.query(StructuredFunction).filter(
                StructuredFunction.project_id == project_id
            ).delete(synchronize_session=False)

            self.db.commit()
            self.logger.info(f"[PERSISTENCE] Cleared existing data for project {project_id}")

            saved_functions = []
            saved_dependencies = []

            # 機能の保存
            for i, func_data in enumerate(functions):
                function_code = f"F{str(i+1).zfill(3)}"

                # データ型チェック
                if not isinstance(func_data, dict):
                    self.logger.error(f"Expected dict but got {type(func_data)}: {func_data}")
                    if isinstance(func_data, str):
                        try:
                            func_data = json.loads(func_data)
                        except json.JSONDecodeError:
                            self.logger.error(f"Failed to parse func_data as JSON: {func_data}")
                            func_data = {"function_name": f"Function_{i+1}", "description": str(func_data)}
                    else:
                        func_data = {"function_name": f"Function_{i+1}", "description": str(func_data)}

                raw_category = func_data.get("category", func_data.get("estimated_category", "logic"))
                structured_function = StructuredFunction(
                    project_id=project_id,
                    function_code=function_code,
                    function_name=func_data.get("function_name", ""),
                    description=func_data.get("description", ""),
                    category=self._normalize_category(raw_category),
                    priority=self._normalize_priority(func_data.get("priority", "Should")),
                    extraction_confidence=0.8,
                    order_index=i + 1
                )

                self.db.add(structured_function)
                self.db.flush()

                saved_functions.append({
                    "function_id": str(structured_function.function_id),
                    "function_code": function_code,
                    "function_name": structured_function.function_name
                })

            # 依存関係の保存
            from uuid import UUID as UUIDType

            function_name_to_id = {
                func["function_name"]: func["function_id"]
                for func in saved_functions
            }

            for dep_data in dependencies:
                if not isinstance(dep_data, dict):
                    self.logger.error(f"Expected dict but got {type(dep_data)}: {dep_data}")
                    continue

                from_name = dep_data.get("from_function")
                to_name = dep_data.get("to_function")

                if from_name in function_name_to_id and to_name in function_name_to_id:
                    from_id = function_name_to_id[from_name]
                    to_id = function_name_to_id[to_name]

                    # 文字列の場合はUUIDに変換
                    if isinstance(from_id, str):
                        from_id = UUIDType(from_id)
                    if isinstance(to_id, str):
                        to_id = UUIDType(to_id)

                    dependency = FunctionDependency(
                        from_function_id=from_id,
                        to_function_id=to_id,
                        dependency_type=dep_data.get("dependency_type", "requires")
                    )

                    self.db.add(dependency)
                    saved_dependencies.append({
                        "from_function": from_name,
                        "to_function": to_name,
                        "dependency_type": dep_data.get("dependency_type", "requires")
                    })

            self.db.commit()

            state["db_saved"] = True
            state["saved_function_ids"] = [f["function_id"] for f in saved_functions]

            self.logger.info(f"[PERSISTENCE] Saved {len(saved_functions)} functions and {len(saved_dependencies)} dependencies to DB")

            return state

        except Exception as e:
            self.db.rollback()
            self.logger.error(f"[PERSISTENCE] Persistence failed: {str(e)}")
            state["errors"].append(f"Persistence error: {str(e)}")
            state["db_saved"] = False
            return state

    def _validation_node(self, state: GlobalState) -> GlobalState:
        """
        バリデーションノード

        抽出された機能の品質をチェック（ハッカソン向け）:
        - 機能数: 15-25個
        - 粒度: description長さ、適切な複雑度
        - 本質性: プロジェクトアイデアとの整合性
        - 依存関係: 循環依存、複雑度
        """
        self.logger.info("[VALIDATION] Starting validation")

        try:
            validation_result = self._validate_functions(
                all_functions=state["all_functions"],
                all_dependencies=state["all_dependencies"],
                constraints=state.get("constraints", {}),
                iteration_count=state.get("iteration_count", 0)
            )

            state["final_validation"] = validation_result.model_dump() if hasattr(validation_result, "model_dump") else validation_result

            status = validation_result.get("status", "PASS")
            issues_count = len(validation_result.get("issues", []))

            self.logger.info(f"[VALIDATION] Status: {status}, Issues: {issues_count}")

            if status == "REJECT":
                retry_instruction = validation_result.get("retry_instruction", "")
                self.logger.warning(f"[VALIDATION] REJECT - Retry instruction: {retry_instruction[:200]}")

            return state

        except Exception as e:
            self.logger.error(f"[VALIDATION] Validation failed: {str(e)}")
            state["errors"].append(f"Validation error: {str(e)}")
            # エラー時は強制的にPASSとして処理
            state["final_validation"] = {
                "status": "PASS",
                "issues": [],
                "retry_instruction": "",
                "function_count": len(state["all_functions"]),
                "must_count": sum(1 for f in state["all_functions"] if f.get("priority") == "Must"),
                "avg_description_length": sum(len(f.get("description", "")) for f in state["all_functions"]) / max(len(state["all_functions"]), 1),
                "has_circular_dependency": False
            }
            return state

    def _validation_decision(self, state: GlobalState) -> str:
        """
        バリデーション結果に基づく次の遷移先を決定

        Returns:
            "accept": persistenceノードへ（DB保存）
            "retry": parallel_extractionノードへ（再抽出）
        """
        validation = state.get("final_validation", {})
        status = validation.get("status", "PASS")
        iteration_count = state.get("iteration_count", 0)
        max_iterations = state.get("max_iterations", 1)  # 最大1回のリトライ

        # 最大反復回数チェック
        if iteration_count >= max_iterations:
            self.logger.info(f"[VALIDATION_DECISION] Max iterations ({max_iterations}) reached, forcing accept")
            return "accept"

        # ステータスに基づいて決定
        if status == "PASS":
            self.logger.info("[VALIDATION_DECISION] Validation passed, proceeding to persistence")
            return "accept"
        elif status == "REJECT":
            self.logger.info(f"[VALIDATION_DECISION] Validation rejected (iteration {iteration_count}/{max_iterations}), retrying extraction")
            state["iteration_count"] = iteration_count + 1
            return "retry"
        else:
            # 不明なステータスは強制的にaccept
            self.logger.warning(f"[VALIDATION_DECISION] Unknown status '{status}', forcing accept")
            return "accept"

    # ===================================================================
    # Helper Methods
    # ===================================================================

    def _validate_functions(
        self,
        all_functions: List[Dict],
        all_dependencies: List[Dict],
        constraints: Dict,
        iteration_count: int
    ) -> Dict:
        """
        機能の品質をLLMで検証（ハッカソン向け）
        """
        from .function_structuring_schemas import FunctionValidationResult

        prompt = ChatPromptTemplate.from_template("""
あなたはハッカソンプロジェクトの機能設計を評価するエキスパートです。

## プロジェクト情報
タイトル: {title}
アイデア: {idea}
開発期間: {start_date} 〜 {end_date}

## 抽出された機能（{function_count}個）
{functions_summary}

## 依存関係（{dependency_count}個）
{dependencies_summary}

## 検証基準（ハッカソン向け）

### 1. 機能数チェック
- 推奨: 15-25個
- 10個未満: 粒度が粗すぎる（REJECT）
- 30個超: 粒度が細かすぎる（REJECT）

### 2. 粒度チェック
- description平均文字数 >= 100文字（詳細な実装内容が必要）
- 1ファイル1機能レベルの細かさは不適切（例: "ログイン画面のボタンコンポーネント"）
- 適切な粒度: "ユーザー認証機能"、"タスク管理画面"など

### 3. 本質性チェック
- プロジェクトアイデアの核心に必要な機能か？
- MVP（最小限の価値提供）として本質的か？
- "あれば良い"機能が多すぎないか？

### 4. 依存関係チェック
- 循環依存がないか？
- 1機能あたりの依存数が過剰でないか？（5個以下推奨）

## タスク
上記の基準で検証し、statusを"PASS"または"REJECT"で返してください。
REJECTの場合は、retry_instructionに具体的な修正指示を含めてください。

例:
"機能数が{{actual_count}}個です。15-25個に収めてください。以下の細かすぎる機能を統合してください: [機能名1, 機能名2]"

反復回数: {iteration_count} / 1
""")

        structured_llm = self.llm_pro.with_structured_output(FunctionValidationResult)
        chain = prompt | structured_llm

        try:
            # 機能サマリー作成
            functions_summary = "\n".join([
                f"- [{f.get('priority', 'N/A')}] {f.get('function_name', 'Unknown')}: {f.get('description', 'No description')[:150]}"
                for f in all_functions[:30]
            ])

            # 依存関係サマリー
            dependencies_summary = "\n".join([
                f"- {d.get('from_function', 'Unknown')} → {d.get('to_function', 'Unknown')} ({d.get('dependency_type', 'requires')})"
                for d in all_dependencies[:20]
            ])

            result = chain.invoke({
                "title": constraints.get("title", ""),
                "idea": constraints.get("idea", ""),
                "start_date": constraints.get("start_date", ""),
                "end_date": constraints.get("end_date", ""),
                "function_count": len(all_functions),
                "functions_summary": functions_summary,
                "dependency_count": len(all_dependencies),
                "dependencies_summary": dependencies_summary,
                "iteration_count": iteration_count
            })

            return result.model_dump()

        except Exception as e:
            self.logger.error(f"Validation failed: {str(e)}")
            # エラー時は強制的にPASS
            return {
                "status": "PASS",
                "issues": [],
                "retry_instruction": "",
                "function_count": len(all_functions),
                "must_count": sum(1 for f in all_functions if f.get("priority") == "Must"),
                "avg_description_length": sum(len(f.get("description", "")) for f in all_functions) / max(len(all_functions), 1),
                "has_circular_dependency": False
            }

    # ===================================================================
    # Public API
    # ===================================================================

    def _gather_context_from_db(self, project_id: str) -> Dict:
        """DBからコンテキスト情報を直接取得（過剰な処理を削除）"""
        try:
            project_uuid = uuid.UUID(project_id)
        except ValueError:
            raise ValueError(f"Invalid project_id format: {project_id}")

        # ProjectDocumentを取得
        project_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc:
            raise ValueError(f"ProjectDocument not found for project_id: {project_id}")

        if not project_doc.function_doc:
            raise ValueError(f"function_doc not found for project_id: {project_id}")

        # ProjectBaseを取得
        project_base = self.db.query(ProjectBase).filter(
            ProjectBase.project_id == project_uuid
        ).first()

        # 必要最小限のコンテキストのみ返す
        return {
            "project_id": project_id,
            "function_doc": project_doc.function_doc,
            "specification": project_doc.specification or "",
            "framework_doc": project_doc.frame_work_doc or "",
            "constraints": {
                "title": project_base.title if project_base else "",
                "idea": project_base.idea if project_base else "",
                "start_date": str(project_base.start_date) if project_base else "",
                "end_date": str(project_base.end_date) if project_base else "",
            }
        }

    def process_project(self, project_id: str) -> Dict:
        """
        プロジェクトの機能構造化を実行

        Args:
            project_id: プロジェクトID

        Returns:
            実行結果
        """
        try:
            # DBからコンテキストを取得
            self.logger.info(f"[WORKFLOW] Fetching context for project: {project_id}")
            context = self._gather_context_from_db(project_id)

            # Workflowを実行
            result = self.run(
                project_id=project_id,
                function_doc=context["function_doc"],
                specification=context.get("specification"),
                framework_doc=context.get("framework_doc"),
                constraints=context.get("constraints"),
                technology=context.get("technology")
            )

            return result

        except Exception as e:
            self.logger.error(f"[WORKFLOW] Failed to process project {project_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def run(
        self,
        project_id: str,
        function_doc: str,
        specification: Optional[str] = None,
        framework_doc: Optional[str] = None,
        constraints: Optional[Dict] = None,
        technology: Optional[Dict] = None
    ) -> Dict:
        """
        ワークフローを実行

        Args:
            project_id: プロジェクトID
            function_doc: 機能要件書（必須）
            specification: 要件定義書（オプション）
            framework_doc: 技術スタック情報（オプション）
            constraints: プロジェクト制約（オプション）
            technology: 技術制約（オプション）

        Returns:
            実行結果
        """
        start_time = time.time()

        # 初期状態作成
        initial_state = create_initial_state(
            project_id=project_id,
            function_doc=function_doc,
            specification=specification,
            framework_doc=framework_doc,
            constraints=constraints or {},
            technology=technology or {}
        )

        try:
            # Workflowを実行
            self.logger.info(f"[WORKFLOW] Starting workflow for project: {project_id}")
            config = {"configurable": {"thread_id": project_id}}
            final_state = self.app.invoke(initial_state, config=config)

            # 終了時刻を記録
            final_state["workflow_end_time"] = time.time()

            self.logger.info(f"[WORKFLOW] Workflow completed in {final_state['workflow_end_time'] - start_time:.2f}s")

            # 結果を返す
            return {
                "success": final_state.get("db_saved", False),
                "data": {
                    "functions": final_state.get("all_functions", []),
                    "dependencies": final_state.get("all_dependencies", []),
                    "function_ids": final_state.get("saved_function_ids", []),
                    "coverage_rate": final_state.get("coverage_rate", 0.0),
                    "errors": final_state.get("errors", [])
                },
                "metadata": {
                    "workflow_time": final_state["workflow_end_time"] - start_time,
                    "total_tokens": final_state.get("total_tokens", 0),
                    "total_cost": final_state.get("total_cost", 0.0)
                }
            }

        except Exception as e:
            self.logger.error(f"[WORKFLOW] Workflow failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def _normalize_priority(priority: str) -> str:
        """優先度をDB制約に適合する形式に正規化

        DB制約: 'Must', 'Should', 'Could', 'Wont' (アポストロフィなし)
        """
        if not priority:
            return "Should"

        # アポストロフィを除去
        priority_clean = priority.replace("'", "").strip()

        # 大文字小文字を正規化
        priority_map = {
            "must": "Must",
            "should": "Should",
            "could": "Could",
            "wont": "Wont",
            "won't": "Wont",
            "would": "Wont",
        }

        return priority_map.get(priority_clean.lower(), "Should")

    @staticmethod
    def _normalize_category(category: str) -> str:
        """カテゴリ名をDB制約に適合する形式に正規化"""
        if not category:
            return "logic"

        category_lower = category.lower()

        # カテゴリマッピング
        category_mapping = {
            # 認証関連
            "authentication": "auth",
            "auth": "auth",
            "login": "auth",
            "user": "auth",
            "security": "auth",

            # データ関連
            "data": "data",
            "database": "data",
            "storage": "data",
            "model": "data",
            "entity": "data",

            # ビジネスロジック
            "logic": "logic",
            "business": "logic",
            "service": "logic",
            "processing": "logic",
            "management": "logic",
            "product_management": "logic",
            "order_management": "logic",
            "inventory_management": "logic",

            # UI関連
            "ui": "ui",
            "frontend": "ui",
            "interface": "ui",
            "view": "ui",
            "component": "ui",
            "product_catalog": "ui",
            "shopping_cart": "ui",
            "user_profile": "ui",

            # API関連
            "api": "api",
            "endpoint": "api",
            "rest": "api",
            "payment_processing": "api",
            "reporting": "api",

            # デプロイメント
            "deployment": "deployment",
            "deploy": "deployment",
            "infrastructure": "deployment",
            "system_administration": "deployment"
        }

        return category_mapping.get(category_lower, "logic")

    async def _extract_functions(self, function_doc: str, context: Dict, cache_name: Optional[str] = None) -> List[Dict]:
        """機能抽出 (Pydantic structured output with optional cache)"""

        # バリデーション失敗時の retry_instruction を追加
        retry_instruction = context.get("retry_instruction", "")
        retry_section = f"\n\n## 前回の問題点（必ず修正すること）\n{retry_instruction}\n" if retry_instruction else ""

        # focus_area別の抽出数制限
        focus_area = context.get("focus_area", "")
        focus_area_instruction = f"\n**【重要】この抽出は「{focus_area}」領域に特化しています**:\n- **この領域に関連する機能のみを5-8個抽出してください**\n- 他の領域の機能は抽出しないでください\n- 全体で15-25個になるよう、各領域が分担します\n" if focus_area else "\n**機能数は厳密に15-25個**\n"

        prompt_text = f"""以下のテキストから独立した機能を抽出してください。

プロジェクト制約:
{json.dumps(context.get("project", {}), ensure_ascii=False)}
{focus_area_instruction}
**【厳格な抽出方針】**:
- **粒度を守る** - 1ファイル1機能のような細かすぎる分割は禁止
- **MVP（最小限の価値提供）のみ** - ハッカソンで必須でない機能は抽出しない
- **descriptionは100文字以上** - 実装内容を詳細に記述（API仕様、画面要素、ビジネスロジック）

**適切な粒度の例**:
✅ 良い例: "ユーザー認証機能（ログイン/ログアウト/セッション管理）"
✅ 良い例: "タスク管理画面（一覧表示、作成、編集、削除機能）"
✅ 良い例: "プロジェクトCRUD API（作成・取得・更新・削除エンドポイント）"

❌ 悪い例: "ログインボタンコンポーネント" ← 細かすぎる
❌ 悪い例: "データベース接続設定ファイル" ← 1ファイルレベル
❌ 悪い例: "ユーザー情報取得API" ← CRUDの一部のみ

**抽出禁止事項**:
- ボタン、アイコン、フォームなど単一コンポーネントレベルの機能
- 設定ファイル、環境変数など1ファイルで完結する項目
- CRUD操作の一部のみ（作成・取得・更新・削除は1つの機能として統合）
- テスト、ドキュメント、リファクタリングなど非機能要件

**抽出基準**:
1. **実装単位**: フロント1画面 or バックエンド1エンドポイント群 程度
2. **独立性**: 単独でユーザー価値を提供できる
3. **MVP必須**: なくてもアプリが動く機能は除外
4. **descriptionの質**: 何をどう実装するか、技術的詳細を含める

カテゴリ定義（estimated_categoryに使用）:
- auth: 認証、ログイン、権限管理
- data: データベース操作、CRUD、データ永続化
- logic: ビジネスロジック、計算処理、アルゴリズム
- ui: フロントエンド、画面、ユーザーインターフェース
- api: 外部API連携、通信、データ取得
- deployment: デプロイ設定、環境構築、インフラ
{retry_section}"""

        try:
            if cache_name:
                # Context Cacheを使用
                result_dict = self._invoke_with_cache(
                    cache_name=cache_name,
                    prompt=prompt_text,
                    response_schema=FunctionExtractionOutput.model_json_schema()
                )
                if not result_dict:
                    self.logger.error(f"[EXTRACT] Cache invocation returned None")
                    return []
                functions = result_dict.get("functions", [])
                self.logger.info(f"[EXTRACT] Extracted {len(functions)} functions using Cache")
            else:
                # LangChainの通常フロー
                prompt = ChatPromptTemplate.from_template("""
                {prompt_text}

                機能要件書:
                {function_doc}
                """)
                structured_llm = self.llm_pro.with_structured_output(FunctionExtractionOutput)
                chain = prompt | structured_llm
                result = await chain.ainvoke({
                    "prompt_text": prompt_text,
                    "function_doc": function_doc,
                })
                if not result or not result.functions:
                    self.logger.warning(f"[EXTRACT] LangChain returned empty result")
                    return []
                functions = [func.model_dump() for func in result.functions]
                self.logger.info(f"[EXTRACT] Extracted {len(functions)} functions using LangChain")

            return functions

        except Exception as e:
            self.logger.error(f"[EXTRACT] Function extraction failed: {str(e)}", exc_info=True)
            return []

    async def _categorize_functions(self, functions: List[Dict], context: Dict) -> List[Dict]:
        """カテゴリ分類 (Pydantic structured output)"""

        prompt = ChatPromptTemplate.from_template("""
        以下の機能を適切なカテゴリに分類してください。

        機能リスト:
        {functions}

        技術制約:
        {tech_constraints}

        カテゴリ定義:
        - auth: 認証、ログイン、権限管理
        - data: データベース操作、CRUD、データ永続化
        - logic: ビジネスロジック、計算処理、アルゴリズム
        - ui: フロントエンド、画面、ユーザーインターフェース
        - api: 外部API連携、通信、データ取得
        - deployment: デプロイ設定、環境構築、インフラ

        各機能に確定的なカテゴリを割り当てて、元のフィールドを全て保持したまま出力してください。
        """)

        # Pydantic structured outputを使用
        structured_llm = self.llm_pro.with_structured_output(StructuredFunctionOutput)
        chain = prompt | structured_llm

        try:
            result = await chain.ainvoke({
                "functions": json.dumps(functions, ensure_ascii=False),
                "tech_constraints": json.dumps(context.get("technology", {}), ensure_ascii=False)
            })

            # Pydantic model -> dict変換
            categorized = [func.model_dump() for func in result.functions]
            self.logger.info(f"[CATEGORIZE] Categorization successful: {len(categorized)} functions")

            # カテゴリ分布をログ出力
            categories = {}
            for func in categorized:
                cat = func.get("category", "unknown")
                categories[cat] = categories.get(cat, 0) + 1
            self.logger.info(f"[CATEGORIZE] Category distribution: {categories}")

            return categorized

        except Exception as e:
            self.logger.error(f"Categorization failed: {str(e)}")
            self.logger.error(f"[CATEGORIZE] Returning original functions unchanged")
            return functions

    async def _assign_priorities(self, functions: List[Dict], context: Dict) -> List[Dict]:
        """優先度設定 (Pydantic structured output)"""

        prompt = ChatPromptTemplate.from_template("""
        ハッカソンプロジェクトの制約を考慮して優先度を設定してください。

        機能リスト:
        {functions}

        プロジェクト制約:
        {constraints}

        優先度定義（必ずこの4つのいずれかを使用）:
        - Must: MVP必須機能（最小限のユーザー価値を提供）
        - Should: 価値は高いが必須ではない
        - Could: あれば良い機能
        - Wont: 今回は実装しない（アポストロフィなし、"Won't"ではなく"Wont"）

        重要: priorityフィールドには必ず "Must", "Should", "Could", "Wont" のいずれかを正確に設定してください。

        判定基準:
        1. 期間内に実装可能か
        2. チーム規模に適しているか
        3. MVPとして必要最小限か
        4. ユーザー価値を提供するか

        各機能に優先度を割り当てて出力してください。
        """)

        # Pydantic structured outputを使用
        structured_llm = self.llm_pro.with_structured_output(StructuredFunctionOutput)
        chain = prompt | structured_llm

        try:
            result = await chain.ainvoke({
                "functions": json.dumps(functions, ensure_ascii=False),
                "constraints": json.dumps(context.get("project", {}), ensure_ascii=False)
            })

            # Pydantic model -> dict変換
            prioritized = [func.model_dump() for func in result.functions]
            self.logger.info(f"[PRIORITY] Priority assignment successful: {len(prioritized)} functions")

            # 優先度分布をログ出力
            priorities = {}
            for func in prioritized:
                prio = func.get("priority", "unknown")
                priorities[prio] = priorities.get(prio, 0) + 1
            self.logger.info(f"[PRIORITY] Priority distribution: {priorities}")

            return prioritized

        except Exception as e:
            self.logger.error(f"Priority assignment failed: {str(e)}")
            return functions

    async def _analyze_dependencies(self, functions: List[Dict], context: Dict) -> List[Dict]:
        """依存関係分析 (Pydantic structured output)"""

        prompt = ChatPromptTemplate.from_template("""
        機能間の依存関係を分析してください。

        機能リスト:
        {functions}

        依存関係の種類:
        - requires: AがないとBは動作しない
        - blocks: Aが完了しないとBは開始できない
        - relates: AとBは関連するが独立して実装可能

        分析観点:
        1. データフロー依存
        2. 前提条件依存
        3. UI/UXフロー依存
        4. 技術的依存

        from_functionとto_functionには機能名を正確に指定してください。
        """)

        # Pydantic structured outputを使用
        structured_llm = self.llm_pro.with_structured_output(DependencyAnalysisOutput)
        chain = prompt | structured_llm

        try:
            result = await chain.ainvoke({
                "functions": json.dumps(functions, ensure_ascii=False)
            })

            # Pydantic model -> dict変換
            dependencies = [dep.model_dump() for dep in result.dependencies]
            self.logger.info(f"[DEPENDENCY] Dependency analysis successful: {len(dependencies)} dependencies")

            # 依存関係タイプ分布をログ出力
            dep_types = {}
            for dep in dependencies:
                dep_type = dep.get("dependency_type", "unknown")
                dep_types[dep_type] = dep_types.get(dep_type, 0) + 1
            self.logger.info(f"[DEPENDENCY] Dependency type distribution: {dep_types}")

            return dependencies

        except Exception as e:
            self.logger.error(f"Dependency analysis failed: {str(e)}")
            return []
