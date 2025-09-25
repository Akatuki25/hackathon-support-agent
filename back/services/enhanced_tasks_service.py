from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from .base_service import BaseService
from .taskDetail_service import TaskDetailService, EnhancedTaskDetail
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
from models.project_base import (
    ProjectDocument,
    Task,
    TaskDependency,
    ProjectBase,
    TaskPipelineStage,
)
from datetime import datetime, timedelta
import json
import uuid
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict, deque
import asyncio
import networkx as nx
import logging
import re

# Custom JSON encoder to handle UUID objects
class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

# Custom Exception for dependency cycle errors
class DependencyCycleError(Exception):
    pass

class PipelineStage(str, Enum):
    TASK_DECOMPOSITION = "stage1_task_decomposition"
    DIRECTORY_BLUEPRINT = "stage2_directory_blueprint"
    EDUCATIONAL_RESOURCES = "stage3_educational_resources"
    GRAPH_ANALYSIS = "stage4_dependency_graph"
    TIMELINE_AND_REACTFLOW = "stage5_timeline_reactflow"
    LLM_USAGE = "stage6_llm_usage"


class EnhancedTasksService(BaseService):
    """
    プロジェクトドキュメントから包括的なタスク分解を生成するための強化型AIエージェント。
    """

    def __init__(self, db: Session = None):
        super().__init__(db)
        self.task_detail_service = TaskDetailService(db) if db else None
        self.dependency_graph = nx.DiGraph()  # NetworkX for graph operations
        self.logger = logging.getLogger(__name__)
        self.logger.info("EnhancedTasksService initialized with advanced AI capabilities")
        self._task_detail_usage_cache: Dict[str, Dict[str, int]] = {}

    async def generate_comprehensive_tasks_with_full_workflow(
        self,
        project_document: ProjectDocument,
        project_base: ProjectBase,
        project_duration_days: int = 30,
        team_size: int = 3,
        hackathon_mode: bool = True,
        use_parallel_processing: bool = True
    ) -> Dict[str, Any]:
        """
        完全なワークフローでタスク生成：段階的DB保存、トポロジカルソート、時系列依存関係、教育的詳細生成
        """
        self.logger.info(f"Starting full workflow task generation for project {project_document.project_id}")

        try:
            # Stage 1: 初期タスク分解とDB保存
            stage1_result = await self._stage1_initial_task_decomposition(
                project_document, hackathon_mode, use_parallel_processing
            )

            # Stage 2: ディレクトリ構成の生成
            stage2_result = await self._stage2_directory_blueprint_generation(
                stage1_result, project_document
            )

            # Stage 3: 教育的タスク詳細生成（並列処理）
            stage3_result = await self._stage3_educational_task_details_generation(
                stage2_result, project_document, use_parallel_processing
            )

            # Stage 4: 依存関係分析とトポロジカルソート
            stage4_result = await self._stage4_dependency_analysis_and_topological_sort(
                stage3_result, project_document
            )

            # Stage 5: 時系列タイムライン生成
            stage5_result = await self._stage5_timeline_generation_with_project_dates(
                stage4_result, project_base, project_duration_days, team_size
            )

            # Stage 6: 最終DB保存と包括的結果構築
            final_result = await self._stage6_final_database_save_and_result_compilation(
                stage3_result,
                project_document.project_id,
                project_document.doc_id,
                stage4_result,
                stage5_result,
            )

            self.logger.info(f"Full workflow completed successfully with {len(final_result.get('tasks', []))} tasks")
            return final_result

        except Exception as e:
            self.logger.error(f"Error in full workflow task generation: {str(e)}")
            raise

    def generate_comprehensive_tasks_from_document(
        self,
        project_document: ProjectDocument,
        project_duration_days: int = 30,
        team_size: int = 3,
        hackathon_mode: bool = True
    ) -> Dict[str, Any]:
        self.logger.info(f"Starting comprehensive task generation for project {project_document.project_id}")

        try:
            raw_tasks = self._decompose_project_into_tasks(project_document, hackathon_mode)
            prioritized_tasks = self._apply_moscow_prioritization(raw_tasks, project_document)
            
            try:
                dependency_analysis = self._analyze_task_dependencies(prioritized_tasks)
                # This old workflow does not have DB IDs, so we pass an empty dict
                topological_result = self._perform_topological_sort(prioritized_tasks, dependency_analysis, {})
                dependency_analysis["topological_order"] = topological_result
            except DependencyCycleError as e:
                self.logger.error(f"Could not complete dependency analysis for old workflow: {e}")
                dependency_analysis = {"error": str(e)}

            timeline_analysis = self._generate_optimized_timeline(
                prioritized_tasks,
                dependency_analysis,
                project_duration_days,
                team_size
            )
            confidence_metrics = self._calculate_confidence_and_risks(
                prioritized_tasks,
                project_document,
                dependency_analysis
            )

            result = {
                "tasks": prioritized_tasks,
                "dependency_graph": dependency_analysis,
                "timeline": timeline_analysis,
                "priority_matrix": self._generate_priority_matrix(prioritized_tasks),
                "confidence_metrics": confidence_metrics,
                "generated_at": datetime.now().isoformat(),
                "markdown_output": self._generate_markdown_summary(prioritized_tasks),
                "metadata": {
                    "project_duration_days": project_duration_days,
                    "team_size": team_size,
                    "hackathon_mode": hackathon_mode,
                    "total_tasks": len(prioritized_tasks),
                    "critical_path_length": len(dependency_analysis.get("critical_path", [])),
                    "generation_method": "enhanced_ai_agent_v2"
                }
            }

            self.logger.info(f"Task generation completed. Generated {len(prioritized_tasks)} tasks.")
            return result

        except Exception as e:
            self.logger.error(f"Error in comprehensive task generation: {str(e)}")
            raise

    def _decompose_project_into_tasks(
        self,
        project_document: ProjectDocument,
        hackathon_mode: bool = True
    ) -> List[Dict[str, Any]]:
        self.logger.debug("Phase 1: Decomposing project into atomic tasks")
        response_schemas = [
            ResponseSchema(
                name="tasks",
                description=(
                    "Comprehensive list of atomic development tasks. Each task must include: "
                    "task_name (string), category (frontend/backend/database/devops/testing/documentation), "
                    "description (detailed description), estimated_hours (realistic estimate), "
                    "complexity_level (1-5 scale), required_skills (array of skills), "
                    "deliverables (array of concrete outputs), acceptance_criteria (array), "
                    "technical_requirements (specific technical needs)"
                ),
                type="array(objects)"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("enhanced_tasks_service", "decompose_project_tasks"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        chain = prompt_template | self.llm_pro | parser
        result = chain.invoke({
            "specification": project_document.specification,
            "function_doc": project_document.function_doc,
            "framework_doc": project_document.frame_work_doc,
            "directory_info": project_document.directory_info,
            "hackathon_mode": hackathon_mode
        })
        self.record_llm_usage("llm_pro")
        tasks = result.get("tasks", [])
        self.logger.info(f"Phase 1 complete: Decomposed into {len(tasks)} atomic tasks")
        return tasks

    def _apply_moscow_prioritization(
        self,
        tasks: List[Dict[str, Any]],
        project_document: ProjectDocument
    ) -> List[Dict[str, Any]]:
        self.logger.debug("Phase 2: Applying MoSCoW prioritization")
        response_schemas = [
            ResponseSchema(
                name="prioritized_tasks",
                description=(
                    "Tasks with comprehensive priority analysis. Each task includes original data plus: "
                    "moscow_priority (Must/Should/Could/Won't), business_value_score (1-10), "
                    "technical_risk_score (1-10), implementation_difficulty (1-10), "
                    "user_impact_score (1-10), priority_rationale (detailed explanation), "
                    "mvp_critical (boolean), dependency_weight (1-10)"
                ),
                type="array(objects)"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("enhanced_tasks_service", "moscow_prioritization"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        chain = prompt_template | self.llm_pro | parser
        result = chain.invoke({
            "tasks": json.dumps(tasks, ensure_ascii=False, indent=2, cls=UUIDEncoder),
            "specification": project_document.specification,
            "function_doc": project_document.function_doc
        })
        self.record_llm_usage("llm_pro")
        prioritized_tasks = result.get("prioritized_tasks", [])
        self.logger.info(f"Phase 2 complete: Applied MoSCoW prioritization to {len(prioritized_tasks)} tasks")
        return prioritized_tasks

    def _analyze_task_dependencies(
        self,
        tasks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        self.logger.debug("Phase 3: Analyzing task dependencies")
        response_schemas = [
            ResponseSchema(
                name="dependency_analysis",
                description=(
                    "Comprehensive dependency analysis. Ensure the graph is a Directed Acyclic Graph (DAG). "
                    "Do NOT create circular dependencies (e.g., Task A -> Task B -> Task A). "
                    "Contains: edges (array of {from_task_index, to_task_index, dependency_type, strength}), "
                    "dependency_rationale (object with explanations for each dependency)."
                ),
                type="object"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("enhanced_tasks_service", "dependency_analysis"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        indexed_tasks = [{"task_index": i, **task} for i, task in enumerate(tasks)]
        chain = prompt_template | self.llm_pro | parser
        result = chain.invoke({
            "tasks": json.dumps(indexed_tasks, ensure_ascii=False, indent=2, cls=UUIDEncoder)
        })
        self.record_llm_usage("llm_pro")
        dependency_analysis = result.get("dependency_analysis", {})
        self.logger.info(f"Phase 3 complete: Identified {len(dependency_analysis.get('edges', []))} dependencies")
        return dependency_analysis

    def _generate_optimized_timeline(
        self,
        tasks: List[Dict[str, Any]],
        dependency_analysis: Dict[str, Any],
        project_duration_days: int,
        team_size: int
    ) -> Dict[str, Any]:
        self.logger.debug("Phase 4: Generating optimized timeline")
        if dependency_analysis.get("error"):
            self.logger.warning("Skipping timeline generation due to dependency analysis failure.")
            return {"error": "Timeline not generated due to dependency errors."}

        response_schemas = [
            ResponseSchema(
                name="timeline",
                description=(
                    "Optimized project timeline containing: "
                    "task_schedule (array with start_day, end_day for each task index), "
                    "milestones (array of key project milestones)."
                ),
                type="object"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("enhanced_tasks_service", "timeline_optimization"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        chain = prompt_template | self.llm_pro | parser
        result = chain.invoke({
            "tasks": json.dumps(tasks, ensure_ascii=False, indent=2, cls=UUIDEncoder),
            "dependency_analysis": json.dumps(dependency_analysis, ensure_ascii=False, indent=2, cls=UUIDEncoder),
            "project_duration_days": project_duration_days,
            "team_size": team_size
        })
        self.record_llm_usage("llm_pro")
        timeline = result.get("timeline", {})
        self.logger.info("Phase 4 complete: Generated optimized timeline")
        return timeline

    def _calculate_confidence_and_risks(
        self,
        tasks: List[Dict[str, Any]],
        project_document: ProjectDocument,
        dependency_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        self.logger.debug("Phase 5: Calculating confidence metrics and risk assessment")
        response_schemas = [
            ResponseSchema(
                name="confidence_metrics",
                description=(
                    "Comprehensive confidence and risk analysis containing: "
                    "overall_confidence (0-1), requirement_coverage_score (0-1), "
                    "dependency_accuracy_score (0-1 if no errors, 0 if errors), "
                    "improvement_suggestions (array of actionable recommendations)."
                ),
                type="object"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("enhanced_tasks_service", "confidence_and_risk_analysis"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        chain = prompt_template | self.llm_pro | parser
        result = chain.invoke({
            "tasks": json.dumps(tasks, ensure_ascii=False, indent=2, cls=UUIDEncoder),
            "specification": project_document.specification,
            "function_doc": project_document.function_doc,
            "dependency_analysis": json.dumps(dependency_analysis, ensure_ascii=False, indent=2, cls=UUIDEncoder)
        })
        self.record_llm_usage("llm_pro")
        confidence_metrics = result.get("confidence_metrics", {})
        self.logger.info("Phase 5 complete: Calculated confidence metrics")
        return confidence_metrics

    def _generate_priority_matrix(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        matrix = defaultdict(list)
        for task in tasks:
            priority = task.get("moscow_priority", "Could")
            matrix[priority].append({
                "task_name": task.get("task_name"),
                "business_value_score": task.get("business_value_score"),
                "technical_risk_score": task.get("technical_risk_score"),
                "estimated_hours": task.get("estimated_hours")
            })
        return dict(matrix)

    def convert_to_database_tasks(
        self,
        task_generation_result: Dict[str, Any],
        project_id: uuid.UUID,
        source_doc_id: uuid.UUID
    ) -> List[Task]:
        self.logger.debug("Converting AI-generated tasks to database objects")
        tasks = task_generation_result.get("tasks", [])
        dependency_graph = task_generation_result.get("dependency_graph", {})
        timeline = task_generation_result.get("timeline", {})
        db_tasks = []
        task_id_mapping = {} 
        for i, task_data in enumerate(tasks):
            task_id = uuid.uuid4()
            task_id_mapping[i] = task_id
            priority_mapping = {"Must": "CRITICAL", "Should": "HIGH", "Could": "MEDIUM", "Won't": "LOW"}
            moscow_priority = task_data.get("moscow_priority", "Could")
            db_priority = priority_mapping.get(moscow_priority, "MEDIUM")
            due_at = None
            task_schedule = timeline.get("task_schedule", [])
            if i < len(task_schedule) and task_schedule[i].get("end_day"):
                due_at = datetime.now() + timedelta(days=task_schedule[i]["end_day"])
            detail_info = {
                "required_skills": task_data.get("required_skills", []),
                "deliverables": task_data.get("deliverables", []),
                "acceptance_criteria": task_data.get("acceptance_criteria", []),
                "priority_rationale": task_data.get("priority_rationale"),
                "technical_requirements": task_data.get("technical_requirements", [])
            }
            task = Task(
                task_id=task_id,
                project_id=project_id,
                title=task_data.get("task_name", f"Task {i+1}"),
                description=task_data.get("description", ""),
                detail=json.dumps(detail_info, ensure_ascii=False, indent=2, cls=UUIDEncoder),
                status="TODO",
                priority=db_priority,
                due_at=due_at,
                source_doc_id=source_doc_id,
                category=task_data.get("category"),
                estimated_hours=task_data.get("estimated_hours"),
                complexity_level=task_data.get("complexity_level"),
                business_value_score=task_data.get("business_value_score"),
                technical_risk_score=task_data.get("technical_risk_score"),
                implementation_difficulty=task_data.get("implementation_difficulty"),
                user_impact_score=task_data.get("user_impact_score"),
                dependency_weight=task_data.get("dependency_weight"),
                moscow_priority=moscow_priority,
                mvp_critical=task_data.get("mvp_critical", False)
            )
            db_tasks.append(task)
        edges = dependency_graph.get("edges", [])
        for edge in edges:
            from_index = edge.get("from_task_index")
            to_index = edge.get("to_task_index")
            if (from_index is not None and to_index is not None and
                from_index < len(db_tasks) and to_index < len(db_tasks)):
                db_tasks[to_index].depends_on_task_id = task_id_mapping[from_index]
        self.logger.info(f"Converted {len(db_tasks)} tasks to database objects with {len(edges)} dependencies")
        return db_tasks

    # ... (analyze_task_breakdown_quality remains the same) ...

    async def _stage1_initial_task_decomposition(
        self,
        project_document: ProjectDocument,
        hackathon_mode: bool,
        use_parallel_processing: bool
    ) -> Dict[str, Any]:
        self.logger.info("Stage 1: Task decomposition and prioritization starting")
        raw_tasks = self._decompose_project_into_tasks(project_document, hackathon_mode)

        if use_parallel_processing:
            prioritized_tasks = await self._parallel_moscow_analysis(raw_tasks, project_document)
        else:
            prioritized_tasks = self._apply_moscow_prioritization(raw_tasks, project_document)

        db_task_ids = self._persist_tasks_for_project(project_document, prioritized_tasks)

        priority_distribution = self._build_priority_distribution(prioritized_tasks)
        stage_payload = {
            "total_tasks": len(prioritized_tasks),
            "priority_distribution": priority_distribution,
            "task_snapshots": [
                {
                    "task_id": str(db_task_ids.get(idx)) if db_task_ids.get(idx) else None,
                    "task_name": task.get("task_name"),
                    "category": task.get("category"),
                    "moscow_priority": task.get("moscow_priority"),
                    "estimated_hours": task.get("estimated_hours"),
                    "complexity_level": task.get("complexity_level"),
                }
                for idx, task in enumerate(prioritized_tasks)
            ],
        }

        if self.db:
            self._upsert_stage_payload(
                project_document.project_id,
                PipelineStage.TASK_DECOMPOSITION,
                stage_payload,
            )
            self.db.commit()

        result = {
            "tasks": prioritized_tasks,
            "db_task_ids": db_task_ids,
            "stage": PipelineStage.TASK_DECOMPOSITION.value,
            "priority_distribution": priority_distribution,
        }
        self.logger.info("Stage 1 completed: %s tasks created", len(prioritized_tasks))
        return result

    def _persist_tasks_for_project(
        self,
        project_document: ProjectDocument,
        tasks: List[Dict[str, Any]],
    ) -> Dict[int, uuid.UUID]:
        if not self.db:
            fallback_mapping: Dict[int, uuid.UUID] = {}
            for index, task_data in enumerate(tasks):
                generated_id = uuid.uuid4()
                fallback_mapping[index] = generated_id
                task_data["db_task_id"] = str(generated_id)
            return fallback_mapping

        self.logger.debug("Persisting %s tasks for project %s", len(tasks), project_document.project_id)
        self.db.query(Task).filter(Task.project_id == project_document.project_id).delete(synchronize_session=False)
        self.db.flush()

        index_to_id: Dict[int, uuid.UUID] = {}
        for index, task_data in enumerate(tasks):
            db_task = Task(
                project_id=project_document.project_id,
                title=task_data.get("task_name", f"Task {index + 1}"),
                description=task_data.get("description", ""),
                category=task_data.get("category"),
                estimated_hours=task_data.get("estimated_hours"),
                complexity_level=task_data.get("complexity_level"),
                business_value_score=task_data.get("business_value_score"),
                technical_risk_score=task_data.get("technical_risk_score"),
                implementation_difficulty=task_data.get("implementation_difficulty"),
                user_impact_score=task_data.get("user_impact_score"),
                dependency_weight=task_data.get("dependency_weight"),
                moscow_priority=task_data.get("moscow_priority"),
                mvp_critical=task_data.get("mvp_critical", False),
                source_doc_id=project_document.doc_id,
            )
            self.db.add(db_task)
            self.db.flush()
            index_to_id[index] = db_task.task_id
            task_data["db_task_id"] = str(db_task.task_id)

        return index_to_id

    def _build_priority_distribution(self, tasks: List[Dict[str, Any]]) -> Dict[str, int]:
        distribution: Dict[str, int] = {}
        for task in tasks:
            priority = task.get("moscow_priority") or "Unspecified"
            distribution[priority] = distribution.get(priority, 0) + 1
        return distribution

    def _load_tasks_from_db(
        self,
        project_document: ProjectDocument,
    ) -> Tuple[List[Dict[str, Any]], Dict[int, uuid.UUID]]:
        if not self.db:
            raise RuntimeError("Database session is required to load tasks from persistence")

        tasks_in_db: List[Task] = (
            self.db.query(Task)
            .filter(Task.project_id == project_document.project_id)
            .order_by(Task.created_at.asc())
            .all()
        )

        task_payload: List[Dict[str, Any]] = []
        mapping: Dict[int, uuid.UUID] = {}
        for index, db_task in enumerate(tasks_in_db):
            mapping[index] = db_task.task_id
            educational_detail = None
            if db_task.detail:
                try:
                    educational_detail = json.loads(db_task.detail)
                except json.JSONDecodeError:
                    educational_detail = db_task.detail
            task_payload.append(
                {
                    "task_name": db_task.title,
                    "description": db_task.description,
                    "category": db_task.category,
                    "estimated_hours": db_task.estimated_hours,
                    "complexity_level": db_task.complexity_level,
                    "business_value_score": db_task.business_value_score,
                    "technical_risk_score": db_task.technical_risk_score,
                    "implementation_difficulty": db_task.implementation_difficulty,
                    "user_impact_score": db_task.user_impact_score,
                    "dependency_weight": db_task.dependency_weight,
                    "moscow_priority": db_task.moscow_priority,
                    "mvp_critical": db_task.mvp_critical,
                    "db_task_id": str(db_task.task_id),
                    "educational_detail": educational_detail,
                    "learning_resources": db_task.learning_resources,
                    "technology_stack": db_task.technology_stack,
                    "reference_links": db_task.reference_links,
                }
            )
        return task_payload, mapping

    async def _stage2_directory_blueprint_generation(
        self,
        stage1_result: Dict[str, Any],
        project_document: ProjectDocument,
    ) -> Dict[str, Any]:
        self.logger.info("Stage 2: Directory blueprint generation starting")

        directory_tree = self._parse_directory_info(project_document.directory_info)
        task_directory_mapping = self._map_tasks_to_directories(
            stage1_result["tasks"],
            directory_tree,
        )

        directory_payload = {
            "directory_tree": directory_tree,
            "task_directory_mapping": task_directory_mapping,
        }

        if self.db:
            self._upsert_stage_payload(
                project_document.project_id,
                PipelineStage.DIRECTORY_BLUEPRINT,
                directory_payload,
            )
            self.db.commit()

        result = {
            **stage1_result,
            "directory_plan": directory_payload,
            "stage": PipelineStage.DIRECTORY_BLUEPRINT.value,
        }

        self.logger.info("Stage 2 completed: Directory blueprint prepared")
        return result

    async def _stage4_dependency_analysis_and_topological_sort(
        self,
        stage3_result: Dict[str, Any],
        project_document: ProjectDocument
    ) -> Dict[str, Any]:
        self.logger.info("Stage 4: Dependency analysis and topological sort starting")
        tasks = stage3_result["tasks"]
        try:
            dependency_analysis = self._analyze_task_dependencies(tasks)
            topological_result = self._perform_topological_sort(
                tasks, dependency_analysis, stage3_result["db_task_ids"]
            )
            if self.db:
                self._save_dependencies_to_db(
                    dependency_analysis, stage3_result["db_task_ids"], project_document.project_id
                )
                self._update_topological_order_in_db(topological_result, stage3_result["db_task_ids"])
                self._upsert_stage_payload(
                    project_document.project_id,
                    PipelineStage.GRAPH_ANALYSIS,
                    {
                        "graph_stats": topological_result.get("graph_stats", {}),
                        "edge_count": len(dependency_analysis.get("edges", [])),
                        "critical_path_length": len(topological_result.get("critical_path", [])),
                    },
                )
                self.db.commit()
            result = {
                **stage3_result,
                "dependency_analysis": dependency_analysis,
                "topological_order": topological_result,
                "stage": PipelineStage.GRAPH_ANALYSIS.value,
            }
        except DependencyCycleError as e:
            self.logger.error(f"Could not complete dependency analysis due to unresolvable cycles: {e}")
            result = {
                **stage3_result,
                "dependency_analysis": {"error": str(e)},
                "topological_order": {"error": str(e)},
                "stage": f"{PipelineStage.GRAPH_ANALYSIS.value}_failed",
            }
            if self.db:
                self._upsert_stage_payload(
                    project_document.project_id,
                    PipelineStage.GRAPH_ANALYSIS,
                    {"error": str(e)},
                    status="failed",
                )
                self.db.commit()
        self.logger.info("Stage 4 completed.")
        return result

    async def _stage5_timeline_generation_with_project_dates(
        self,
        stage4_result: Dict[str, Any],
        project_base: ProjectBase,
        project_duration_days: int,
        team_size: int
    ) -> Dict[str, Any]:
        self.logger.info("Stage 5: Timeline generation with project dates starting")
        if stage4_result.get("stage", "").endswith("failed"):
            self.logger.warning("Skipping Stage 5 (Timeline Generation) due to dependency analysis failure")
            return {
                **stage4_result,
                "timeline": {"error": "Dependency analysis failed"},
                "project_dates": {},
                "stage": f"{PipelineStage.TIMELINE_AND_REACTFLOW.value}_skipped",
            }

        project_start = project_base.start_date
        project_end = project_base.end_date
        if not project_start or not project_end:
            self.logger.warning("Project start or end date missing; skipping timeline generation")
            return {
                **stage4_result,
                "timeline": {"error": "Project dates missing"},
                "project_dates": {},
                "stage": f"{PipelineStage.TIMELINE_AND_REACTFLOW.value}_skipped",
            }

        timeline = self._generate_optimized_timeline(
            stage4_result["tasks"],
            stage4_result.get("dependency_analysis", {}),
            project_duration_days,
            team_size
        )
        timeline_with_dates = self._map_timeline_to_project_dates(
            timeline,
            stage4_result.get("topological_order", {}),
            project_start,
            project_end
        )
        if self.db:
            self._save_timeline_to_db(timeline_with_dates, stage4_result["db_task_ids"])
            self._upsert_stage_payload(
                project_base.project_id,
                PipelineStage.TIMELINE_AND_REACTFLOW,
                {
                    "timeline_overview": timeline_with_dates.get("summary", {}),
                    "project_dates": {
                        "start_date": project_start.isoformat(),
                        "end_date": project_end.isoformat(),
                    },
                },
            )
            self.db.commit()
        result = {
            **stage4_result,
            "timeline": timeline_with_dates,
            "project_dates": {
                "start_date": project_start.isoformat(),
                "end_date": project_end.isoformat()
            },
            "stage": PipelineStage.TIMELINE_AND_REACTFLOW.value
        }
        self.logger.info("Stage 5 completed: Timeline mapped to project dates")
        return result

    async def _stage3_educational_task_details_generation(
        self,
        stage2_result: Dict[str, Any],
        project_document: ProjectDocument,
        use_parallel_processing: bool
    ) -> Dict[str, Any]:
        self.logger.info("Stage 3: Educational task details generation starting")
        tasks = stage2_result["tasks"]
        directory_plan = stage2_result.get("directory_plan", {})
        directory_lookup = {
            entry.get("task_id"): entry.get("suggested_paths", [])
            for entry in directory_plan.get("task_directory_mapping", [])
        }

        if use_parallel_processing and self.task_detail_service:
            enhanced_tasks = await self._parallel_educational_details_generation(
                tasks,
                project_document,
                directory_lookup,
            )
        else:
            enhanced_tasks = self._sequential_educational_details_generation(
                tasks,
                project_document,
                directory_lookup,
            )

        if self.db:
            self._save_educational_details_to_db(enhanced_tasks, stage2_result["db_task_ids"])
            self._upsert_stage_payload(
                project_document.project_id,
                PipelineStage.EDUCATIONAL_RESOURCES,
                self._summarize_educational_details(enhanced_tasks),
            )
            self.db.commit()

        result = {**stage2_result, "tasks": enhanced_tasks, "stage": PipelineStage.EDUCATIONAL_RESOURCES.value}
        self.logger.info("Stage 3 completed: Educational details generated")
        return result

    async def _ensure_stage1_result(
        self,
        project_document: ProjectDocument,
        hackathon_mode: bool,
        use_parallel_processing: bool,
    ) -> Dict[str, Any]:
        if self.db:
            existing_count = (
                self.db.query(Task)
                .filter(Task.project_id == project_document.project_id)
                .count()
            )
            if existing_count:
                tasks, mapping = self._load_tasks_from_db(project_document)
                return {
                    "tasks": tasks,
                    "db_task_ids": mapping,
                    "priority_distribution": self._build_priority_distribution(tasks),
                    "stage": PipelineStage.TASK_DECOMPOSITION.value,
                }
        return await self._stage1_initial_task_decomposition(
            project_document,
            hackathon_mode,
            use_parallel_processing,
        )

    async def _ensure_stage2_result(
        self,
        project_document: ProjectDocument,
        hackathon_mode: bool,
        use_parallel_processing: bool,
    ) -> Dict[str, Any]:
        stage1_result = await self._ensure_stage1_result(
            project_document,
            hackathon_mode,
            use_parallel_processing,
        )
        directory_payload = self._get_stage_payload(
            project_document.project_id,
            PipelineStage.DIRECTORY_BLUEPRINT,
        )
        if directory_payload:
            return {
                **stage1_result,
                "directory_plan": directory_payload,
                "stage": PipelineStage.DIRECTORY_BLUEPRINT.value,
            }
        return await self._stage2_directory_blueprint_generation(stage1_result, project_document)

    async def _ensure_stage3_result(
        self,
        project_document: ProjectDocument,
        hackathon_mode: bool,
        use_parallel_processing: bool,
    ) -> Dict[str, Any]:
        stage2_result = await self._ensure_stage2_result(
            project_document,
            hackathon_mode,
            use_parallel_processing,
        )
        try:
            tasks_from_db, mapping = self._load_tasks_from_db(project_document)
        except RuntimeError:
            tasks_from_db, mapping = stage2_result["tasks"], stage2_result["db_task_ids"]

        has_details = any(
            isinstance(task.get("educational_detail"), (dict, list, str)) and task.get("educational_detail")
            for task in tasks_from_db
        )

        if has_details:
            return {
                **stage2_result,
                "tasks": tasks_from_db,
                "db_task_ids": mapping,
                "stage": PipelineStage.EDUCATIONAL_RESOURCES.value,
            }

        return await self._stage3_educational_task_details_generation(
            stage2_result,
            project_document,
            use_parallel_processing,
        )

    def _generate_markdown_summary(self, tasks: List[Dict[str, Any]]) -> str:
        markdown_lines = ["# Task Implementation Details", ""]
        if not tasks:
            return "No tasks were generated."

        for i, task in enumerate(tasks):
            markdown_lines.append(f"## {i+1}. {task.get('task_name', 'Unnamed Task')}")
            markdown_lines.append(f"**Category:** {task.get('category', 'N/A')}  |  **Priority:** {task.get('moscow_priority', 'N/A')}  |  **Est. Hours:** {task.get('estimated_hours', 'N/A')}")
            markdown_lines.append("")
            markdown_lines.append(f"**Description:** {task.get('description', 'No description provided.')}")
            markdown_lines.append("")
            
            edu_detail = task.get('educational_detail', {})
            if edu_detail:
                markdown_lines.append("### Implementation Details & Learning")
                markdown_lines.append(f"**Detail:** {edu_detail.get('detail', 'N/A')}")
                
                tech_stack = edu_detail.get('technologies_used', [])
                if tech_stack:
                    markdown_lines.append("**Technologies:**")
                    for tech in tech_stack:
                        name = tech.get('name', 'N/A') if isinstance(tech, dict) else str(tech)
                        reason = tech.get('reason', '') if isinstance(tech, dict) else ''
                        markdown_lines.append(f"- **{name}**: {reason}")

                learning_resources = edu_detail.get('learning_resources', [])
                if learning_resources:
                    markdown_lines.append("**Learning Resources:**")
                    for res in learning_resources:
                        markdown_lines.append(f"- {res}")
            markdown_lines.append("" )
            markdown_lines.append("---")
            markdown_lines.append("")

        return "\n".join(markdown_lines)

    async def _stage6_final_database_save_and_result_compilation(
        self,
        stage3_result: Dict[str, Any],
        project_id: uuid.UUID,
        source_doc_id: uuid.UUID,
        stage4_result: Optional[Dict[str, Any]] = None,
        stage5_result: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        self.logger.info("Stage 6: Final database save and result compilation starting")

        if self.task_detail_service:
            detail_usage_snapshot = self.task_detail_service.get_llm_usage_snapshot()
            incremental_usage: Dict[str, Dict[str, Any]] = {}
            for model_label, metrics in detail_usage_snapshot.items():
                previous = self._task_detail_usage_cache.get(model_label, {"calls": 0, "tokens": 0})
                delta_calls = max(0, metrics.get("calls", 0) - previous.get("calls", 0))
                delta_tokens = max(0, metrics.get("tokens", 0) - previous.get("tokens", 0))
                if delta_calls > 0 or delta_tokens > 0:
                    incremental_usage[model_label] = {
                        "calls": delta_calls,
                        "tokens": delta_tokens,
                        "last_called_at": metrics.get("last_called_at"),
                    }
                self._task_detail_usage_cache[model_label] = {
                    "calls": metrics.get("calls", 0),
                    "tokens": metrics.get("tokens", 0),
                }
            if incremental_usage:
                self.merge_llm_usage(incremental_usage)
        llm_usage_snapshot = self.get_llm_usage_snapshot()

        dependency_graph = stage4_result.get("dependency_analysis", {}) if stage4_result else {}
        topological_raw = stage4_result.get("topological_order", {}) if stage4_result else {}
        topological_order = self._serialize_topological_result(topological_raw)
        timeline = stage5_result.get("timeline", {}) if stage5_result else {}
        project_dates = stage5_result.get("project_dates", {}) if stage5_result else {}
        reactflow_payload = self._build_reactflow_payload(stage4_result)
        directory_plan = stage3_result.get("directory_plan", {})

        tasks_with_details = stage3_result["tasks"]
        markdown_output = self._generate_markdown_summary(tasks_with_details)

        project_document = None
        if self.db:
            project_document = (
                self.db.query(ProjectDocument)
                .filter(ProjectDocument.doc_id == source_doc_id)
                .first()
            )

        confidence_metrics = self._calculate_confidence_and_risks(
            tasks_with_details,
            project_document,
            dependency_graph,
        ) if project_document else {}

        stages_completed = [
            PipelineStage.TASK_DECOMPOSITION.value,
            PipelineStage.DIRECTORY_BLUEPRINT.value,
            PipelineStage.EDUCATIONAL_RESOURCES.value,
        ]
        if stage4_result:
            stages_completed.append(stage4_result.get("stage"))
        if stage5_result:
            stages_completed.append(stage5_result.get("stage"))
        stages_completed.append(PipelineStage.LLM_USAGE.value)

        final_result = {
            "tasks": tasks_with_details,
            "directory_plan": directory_plan,
            "dependency_graph": dependency_graph,
            "topological_order": topological_order,
            "timeline": timeline,
            "project_dates": project_dates,
            "reactflow": reactflow_payload,
            "priority_matrix": self._generate_priority_matrix(tasks_with_details),
            "confidence_metrics": confidence_metrics,
            "educational_summary": self._generate_educational_summary(tasks_with_details),
            "markdown_output": markdown_output,
            "llm_usage": llm_usage_snapshot,
            "generated_at": datetime.now().isoformat(),
            "metadata": {
                "project_id": str(project_id),
                "source_doc_id": str(source_doc_id),
                "total_tasks": len(tasks_with_details),
                "critical_path_length": len(topological_order.get("critical_path", [])),
                "generation_method": "enhanced_full_workflow_v3",
                "stages_completed": [stage for stage in stages_completed if stage],
                "priority_distribution": stage3_result.get("priority_distribution", {}),
            },
        }

        notes: List[str] = []
        if stage4_result and stage4_result.get("stage", "").endswith("failed"):
            notes.append("Dependency analysis was skipped due to unresolved cycles.")
        if stage5_result and stage5_result.get("stage") == f"{PipelineStage.TIMELINE_AND_REACTFLOW.value}_skipped":
            notes.append("Timeline generation was skipped because project dates were missing or dependency analysis failed.")
        if notes:
            final_result.setdefault("metadata", {})["notes"] = " ".join(notes)

        if self.db:
            self._upsert_stage_payload(
                project_id,
                PipelineStage.LLM_USAGE,
                {"llm_usage": llm_usage_snapshot},
            )
            self.db.commit()

        self.logger.info("Stage 6 completed: Final result compiled")
        return final_result

    async def _parallel_moscow_analysis(
        self,
        tasks: List[Dict[str, Any]],
        project_document: ProjectDocument
    ) -> List[Dict[str, Any]]:
        def analyze_batch(task_batch):
            return self._apply_moscow_prioritization(task_batch, project_document)
        batch_size = max(1, len(tasks) // 3)
        batches = [tasks[i:i + batch_size] for i in range(0, len(tasks), batch_size)]
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(analyze_batch, batch) for batch in batches]
            results = []
            for future in as_completed(futures):
                results.extend(future.result())
        return results

    def _perform_topological_sort(
        self,
        tasks: List[Dict[str, Any]],
        dependency_analysis: Dict[str, Any],
        db_task_ids: Dict[int, uuid.UUID]
    ) -> Dict[str, Any]:
        self.logger.debug("Building dependency graph")
        graph = nx.DiGraph()
        for i, task in enumerate(tasks):
            task_id = db_task_ids.get(i)
            if task_id is None:
                self.logger.error(f"Could not find DB task ID for task index {i} in full workflow. Skipping node.")
                continue
            graph.add_node(task_id, **task)

        for edge in dependency_analysis.get("edges", []):
            from_idx = edge.get("from_task_index")
            to_idx = edge.get("to_task_index")
            if from_idx is not None and to_idx is not None:
                from_task_id = db_task_ids.get(from_idx)
                to_task_id = db_task_ids.get(to_idx)
                if from_task_id and to_task_id and from_task_id in graph and to_task_id in graph:
                    graph.add_edge(from_task_id, to_task_id, weight=edge.get("strength", 5))

        is_dag = nx.is_directed_acyclic_graph(graph)
        if not is_dag:
            self.logger.warning("Dependency cycle detected. Attempting to break cycles algorithmically.")
            try:
                while not nx.is_directed_acyclic_graph(graph):
                    cycle_edges = nx.find_cycle(graph)
                    if not cycle_edges:
                        break
                    edge_to_remove = cycle_edges[0]
                    graph.remove_edge(edge_to_remove[0], edge_to_remove[1])
                    self.logger.info(f"Breaking cycle by removing dependency: {edge_to_remove[0]} -> {edge_to_remove[1]}")
            except nx.NetworkXNoCycle:
                self.logger.warning("Could not find a cycle to remove, though graph is not a DAG.")

        is_dag = nx.is_directed_acyclic_graph(graph)
        if not is_dag:
            self.logger.error("Failed to resolve dependency cycles algorithmically.")
            raise DependencyCycleError("Failed to resolve dependency cycles algorithmically.")

        topological_order = list(nx.topological_sort(graph))
        critical_path = self._calculate_critical_path(graph, tasks, db_task_ids)
        parallel_groups = self._identify_parallel_groups(graph, topological_order)
        execution_phases = self._determine_execution_phases(tasks, dependency_analysis)

        return {
            "topological_order": topological_order,
            "critical_path": critical_path,
            "parallel_groups": parallel_groups,
            "execution_phases": execution_phases,
            "graph_stats": {
                "nodes": graph.number_of_nodes(),
                "edges": graph.number_of_edges(),
                "is_dag": is_dag
            }
        }

    def _calculate_critical_path(
        self,
        graph: nx.DiGraph,
        tasks: List[Dict[str, Any]],
        db_task_ids: Dict[int, uuid.UUID]
    ) -> List[uuid.UUID]:
        if not nx.is_directed_acyclic_graph(graph):
            return []
        for i, task in enumerate(tasks):
            task_id = db_task_ids.get(i, i)
            if graph.has_node(task_id):
                graph.nodes[task_id]["duration"] = task.get("estimated_hours", 8)
        try:
            critical_path = nx.dag_longest_path(graph, weight="duration")
            return critical_path
        except nx.NetworkXError:
            return []

    def _identify_parallel_groups(
        self,
        graph: nx.DiGraph,
        topological_order: List[uuid.UUID]
    ) -> List[List[uuid.UUID]]:
        parallel_groups = []
        processed = set()
        for node in topological_order:
            if node in processed:
                continue
            parallel_group = [node]
            processed.add(node)
            for other_node in topological_order:
                if other_node in processed or node == other_node:
                    continue
                if not nx.has_path(graph, node, other_node) and not nx.has_path(graph, other_node, node):
                    node_predecessors = set(graph.predecessors(node))
                    other_predecessors = set(graph.predecessors(other_node))
                    if node_predecessors.issubset(processed) and other_predecessors.issubset(processed):
                        parallel_group.append(other_node)
                        processed.add(other_node)
            if len(parallel_group) > 0:
                parallel_groups.append(parallel_group)
        return parallel_groups

    def _determine_execution_phases(
        self,
        tasks: List[Dict[str, Any]],
        dependency_analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        phases = [
            {"name": "setup", "tasks": [], "description": "環境構築・初期設定"},
            {"name": "development", "tasks": [], "description": "主要機能開発"},
            {"name": "testing", "tasks": [], "description": "テスト・品質保証"},
            {"name": "deployment", "tasks": [], "description": "デプロイ・リリース"}
        ]
        for i, task in enumerate(tasks):
            category = task.get("category", "").lower()
            task_name = task.get("task_name", "").lower()
            if "setup" in task_name or "環境" in task_name or category == "devops":
                phases[0]["tasks"].append(i)
            elif "test" in task_name or "テスト" in task_name or category == "testing":
                phases[2]["tasks"].append(i)
            elif "deploy" in task_name or "デプロイ" in task_name or "リリース" in task_name:
                phases[3]["tasks"].append(i)
            else:
                phases[1]["tasks"].append(i)
        return phases

    async def _parallel_educational_details_generation(
        self,
        tasks: List[Dict[str, Any]],
        project_document: ProjectDocument,
        directory_lookup: Dict[str, List[str]],
    ) -> List[Dict[str, Any]]:
        if not self.task_detail_service:
            return tasks
        detail_results = self.task_detail_service.generate_task_details_parallel(
            tasks,
            project_document.specification,
            batch_size=3,
            max_workers=4,
            directory_lookup=directory_lookup,
        )
        enhanced_tasks: List[Dict[str, Any]] = []
        for idx, original in enumerate(tasks):
            enhanced_task = {**original}
            if idx < len(detail_results):
                detail = detail_results[idx]
                if isinstance(detail, dict):
                    enhanced_task["educational_detail"] = detail
            enhanced_tasks.append(enhanced_task)
        return enhanced_tasks

    def _sequential_educational_details_generation(
        self,
        tasks: List[Dict[str, Any]],
        project_document: ProjectDocument,
        directory_lookup: Dict[str, List[str]],
    ) -> List[Dict[str, Any]]:
        enhanced_tasks = []
        for task in tasks:
            if self.task_detail_service:
                identifier = str(task.get("db_task_id") or task.get("task_id") or "")
                directory_context = directory_lookup.get(identifier, [])
                enhanced_detail = self.task_detail_service.generate_enhanced_task_detail(
                    task,
                    project_document.specification,
                    directory_context,
                )
                enhanced_task = {**task}
                enhanced_task["educational_detail"] = enhanced_detail.model_dump()
                enhanced_tasks.append(enhanced_task)
            else:
                enhanced_tasks.append(task)
        return enhanced_tasks

    def _parse_directory_info(self, directory_info: str) -> List[str]:
        if not directory_info:
            return []
        matches = re.findall(r"[A-Za-z0-9_./-]+/", directory_info)
        directories = sorted(set(match.rstrip("/") for match in matches))
        return directories

    def _map_tasks_to_directories(
        self,
        tasks: List[Dict[str, Any]],
        directories: List[str],
    ) -> List[Dict[str, Any]]:
        if not directories:
            directories = []
        category_hints = {
            "frontend": ["front", "client", "ui", "component"],
            "backend": ["back", "api", "server", "service"],
            "database": ["db", "schema", "migration", "model"],
            "devops": ["devcontainer", "infra", "deploy", "docker", "ci"],
            "testing": ["test", "qa", "spec"],
            "documentation": ["doc", "readme", "guide"],
        }
        default_directories = directories[:3] if directories else []
        mapping: List[Dict[str, Any]] = []
        for index, task in enumerate(tasks):
            category = (task.get("category") or "").lower()
            task_id = str(task.get("db_task_id") or task.get("task_id") or f"task-{index}")
            hints = category_hints.get(category, [])
            suggestions = [path for path in directories if any(hint in path.lower() for hint in hints)]
            if not suggestions:
                suggestions = default_directories
            mapping.append(
                {
                    "task_id": task_id,
                    "task_name": task.get("task_name"),
                    "category": category,
                    "suggested_paths": suggestions[:3],
                    "notes": "Category-based directory suggestion" if suggestions else "Directory suggestions unavailable",
                }
            )
        return mapping

    def _summarize_educational_details(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        total_resources = 0
        tasks_with_resources = 0
        technologies = set()

        for task in tasks:
            detail = task.get("educational_detail") or {}
            resources = detail.get("learning_resources", [])
            if resources:
                tasks_with_resources += 1
                total_resources += len(resources)
            for tech in detail.get("technologies_used", []):
                if isinstance(tech, dict):
                    name = tech.get("name")
                    if name:
                        technologies.add(name)

        return {
            "tasks_with_resources": tasks_with_resources,
            "total_learning_resources": total_resources,
            "unique_technologies": sorted(technologies),
        }

    def _upsert_stage_payload(
        self,
        project_id: uuid.UUID,
        stage: PipelineStage,
        payload: Dict[str, Any],
        status: str = "completed",
    ) -> None:
        if not self.db:
            return

        serialized_payload = json.loads(json.dumps(payload, cls=UUIDEncoder))

        stage_record = (
            self.db.query(TaskPipelineStage)
            .filter(
                TaskPipelineStage.project_id == project_id,
                TaskPipelineStage.stage_name == stage.value,
            )
            .first()
        )
        if stage_record:
            stage_record.payload = serialized_payload
            stage_record.status = status
        else:
            stage_record = TaskPipelineStage(
                project_id=project_id,
                stage_name=stage.value,
                status=status,
                payload=serialized_payload,
            )
            self.db.add(stage_record)
        self.db.flush()

    def _get_stage_payload(self, project_id: uuid.UUID, stage: PipelineStage) -> Optional[Dict[str, Any]]:
        if not self.db:
            return None
        stage_record = (
            self.db.query(TaskPipelineStage)
            .filter(
                TaskPipelineStage.project_id == project_id,
                TaskPipelineStage.stage_name == stage.value,
            )
            .first()
        )
        if not stage_record:
            return None
        return stage_record.payload or None

    def _build_reactflow_payload(self, stage4_result: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not stage4_result or stage4_result.get("stage", "").endswith("failed"):
            return {}

        tasks = stage4_result.get("tasks", [])
        db_task_ids = stage4_result.get("db_task_ids", {})
        dependency_analysis = stage4_result.get("dependency_analysis", {})
        topological_data = stage4_result.get("topological_order", {})

        index_to_uuid = {
            idx: str(task_id) for idx, task_id in db_task_ids.items() if task_id
        }

        category_offsets = {
            "frontend": 0,
            "backend": 220,
            "database": 440,
            "devops": 660,
            "testing": 880,
            "documentation": 1100,
        }

        nodes = []
        for index, task in enumerate(tasks):
            task_identifier = str(task.get("db_task_id") or index_to_uuid.get(index) or index)
            label = task.get("task_name", f"Task {index + 1}")
            category = (task.get("category") or "general").lower()
            position_x = category_offsets.get(category, 1320)
            position_y = index * 140
            nodes.append(
                {
                    "id": task_identifier,
                    "type": "default",
                    "data": {
                        "label": label,
                        "category": category,
                        "moscow": task.get("moscow_priority"),
                        "estimated_hours": task.get("estimated_hours"),
                    },
                    "position": {"x": position_x, "y": position_y},
                }
            )

        edges = []
        for edge_index, edge in enumerate(dependency_analysis.get("edges", [])):
            from_idx = edge.get("from_task_index")
            to_idx = edge.get("to_task_index")
            source_id = index_to_uuid.get(from_idx)
            target_id = index_to_uuid.get(to_idx)
            if source_id and target_id:
                edges.append(
                    {
                        "id": f"edge-{edge_index}",
                        "source": source_id,
                        "target": target_id,
                        "data": {"strength": edge.get("strength", 5)},
                    }
                )

        reactflow_payload = {
            "nodes": nodes,
            "edges": edges,
            "meta": {
                "graph_stats": topological_data.get("graph_stats", {}),
                "critical_path": [str(node) for node in topological_data.get("critical_path", [])],
                "parallel_groups": [
                    [str(task_id) for task_id in group]
                    for group in topological_data.get("parallel_groups", [])
                ],
            },
        }
        return reactflow_payload

    def _serialize_topological_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        if not result:
            return {}
        serialized = dict(result)
        order = result.get("topological_order")
        if isinstance(order, list):
            serialized["topological_order"] = [str(node) for node in order]
        else:
            serialized["topological_order"] = order or []

        critical_path = result.get("critical_path")
        if isinstance(critical_path, list):
            serialized["critical_path"] = [str(node) for node in critical_path]
        else:
            serialized["critical_path"] = critical_path or []

        parallel_groups = result.get("parallel_groups")
        if isinstance(parallel_groups, list):
            serialized["parallel_groups"] = [
                [str(node) for node in group]
                for group in parallel_groups
                if isinstance(group, list)
            ]
        else:
            serialized["parallel_groups"] = parallel_groups or []
        return serialized

    async def run_stage1(
        self,
        project_id: uuid.UUID,
        hackathon_mode: bool = True,
        use_parallel_processing: bool = True,
    ) -> Dict[str, Any]:
        project_document, _ = self._load_project_entities(project_id)
        return await self._stage1_initial_task_decomposition(
            project_document,
            hackathon_mode,
            use_parallel_processing,
        )

    async def run_stage2(
        self,
        project_id: uuid.UUID,
        hackathon_mode: bool = True,
        use_parallel_processing: bool = True,
    ) -> Dict[str, Any]:
        project_document, _ = self._load_project_entities(project_id)
        return await self._ensure_stage2_result(
            project_document,
            hackathon_mode,
            use_parallel_processing,
        )

    async def run_stage3(
        self,
        project_id: uuid.UUID,
        hackathon_mode: bool = True,
        use_parallel_processing: bool = True,
    ) -> Dict[str, Any]:
        project_document, _ = self._load_project_entities(project_id)
        return await self._ensure_stage3_result(
            project_document,
            hackathon_mode,
            use_parallel_processing,
        )

    async def run_stage4(
        self,
        project_id: uuid.UUID,
        hackathon_mode: bool = True,
        use_parallel_processing: bool = True,
    ) -> Dict[str, Any]:
        project_document, _ = self._load_project_entities(project_id)
        stage3_result = await self._ensure_stage3_result(
            project_document,
            hackathon_mode,
            use_parallel_processing,
        )
        return await self._stage4_dependency_analysis_and_topological_sort(
            stage3_result,
            project_document,
        )

    async def run_stage5(
        self,
        project_id: uuid.UUID,
        hackathon_mode: bool = True,
        use_parallel_processing: bool = True,
    ) -> Dict[str, Any]:
        project_document, project_base = self._load_project_entities(project_id)
        stage4_result = await self.run_stage4(
            project_id,
            hackathon_mode,
            use_parallel_processing,
        )
        project_duration_days = max(
            1,
            int((project_base.end_date - project_base.start_date).days)
            if project_base.end_date and project_base.start_date
            else 30,
        )
        team_size = project_base.num_people or 1
        return await self._stage5_timeline_generation_with_project_dates(
            stage4_result,
            project_base,
            project_duration_days,
            team_size,
        )

    async def run_full_workflow(
        self,
        project_id: uuid.UUID,
        hackathon_mode: bool = True,
        use_parallel_processing: bool = True,
    ) -> Dict[str, Any]:
        project_document, project_base = self._load_project_entities(project_id)
        project_duration_days = max(
            1,
            int((project_base.end_date - project_base.start_date).days)
            if project_base.end_date and project_base.start_date
            else 30,
        )
        team_size = project_base.num_people or 1
        return await self.generate_comprehensive_tasks_with_full_workflow(
            project_document,
            project_base,
            project_duration_days,
            team_size,
            hackathon_mode,
            use_parallel_processing,
        )

    def _load_project_entities(
        self,
        project_id: uuid.UUID,
    ) -> Tuple[ProjectDocument, ProjectBase]:
        if not self.db:
            raise RuntimeError("Database session is required for this operation")
        project_base = (
            self.db.query(ProjectBase)
            .filter(ProjectBase.project_id == project_id)
            .first()
        )
        if not project_base:
            raise ValueError(f"Project {project_id} not found")
        project_document = (
            self.db.query(ProjectDocument)
            .filter(ProjectDocument.project_id == project_id)
            .first()
        )
        if not project_document:
            raise ValueError(f"Project document for {project_id} not found")
        return project_document, project_base

    def build_reactflow_payload(self, stage4_result: Dict[str, Any]) -> Dict[str, Any]:
        return self._build_reactflow_payload(stage4_result)

    def serialize_topological_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        return self._serialize_topological_result(result)

    def get_stage_payload(
        self,
        project_id: uuid.UUID,
        stage: PipelineStage,
    ) -> Optional[Dict[str, Any]]:
        return self._get_stage_payload(project_id, stage)

    def _save_dependencies_to_db(self, dependency_analysis, db_task_ids, project_id):
        if not self.db or dependency_analysis.get("error"):
            return
        for edge in dependency_analysis.get("edges", []):
            from_idx = edge.get("from_task_index")
            to_idx = edge.get("to_task_index")
            if from_idx is not None and to_idx is not None:
                prerequisite_task_id = db_task_ids.get(from_idx)
                dependent_task_id = db_task_ids.get(to_idx)
                if prerequisite_task_id and dependent_task_id:
                    dependency = TaskDependency(
                        project_id=project_id,
                        prerequisite_task_id=prerequisite_task_id,
                        dependent_task_id=dependent_task_id,
                        dependency_type="FINISH_TO_START",
                        dependency_strength=edge.get("strength", 5),
                        auto_detected=True
                    )
                    self.db.add(dependency)

    def _update_topological_order_in_db(self, topological_result, db_task_ids):
        if not self.db or topological_result.get("error"):
            return
        topological_order = topological_result.get("topological_order", [])
        critical_path = topological_result.get("critical_path", [])
        parallel_groups = topological_result.get("parallel_groups", [])
        for order, task_id in enumerate(topological_order):
            task = self.db.query(Task).filter(Task.task_id == task_id).first()
            if task:
                task.topological_order = order
                task.critical_path = task_id in critical_path
        for group_id, group in enumerate(parallel_groups):
            for task_id in group:
                task = self.db.query(Task).filter(Task.task_id == task_id).first()
                if task:
                    task.parallel_group_id = f"group_{group_id}"

    def _map_timeline_to_project_dates(self, timeline, topological_result, project_start, project_end):
        total_project_days = (project_end - project_start).days
        enhanced_timeline = {**timeline, "project_dates": {"start_date": project_start.isoformat(), "end_date": project_end.isoformat(), "total_days": total_project_days}}
        task_schedule = timeline.get("task_schedule", [])
        enhanced_schedule = []
        for task_info in task_schedule:
            start_day_offset = task_info.get("start_day", 0)
            end_day_offset = task_info.get("end_day", start_day_offset + 1)
            actual_start_date = project_start + timedelta(days=start_day_offset)
            actual_end_date = project_start + timedelta(days=end_day_offset)
            enhanced_task_info = {**task_info, "actual_start_date": actual_start_date.isoformat(), "actual_end_date": actual_end_date.isoformat(), "duration_days": end_day_offset - start_day_offset}
            enhanced_schedule.append(enhanced_task_info)
        enhanced_timeline["enhanced_task_schedule"] = enhanced_schedule
        return enhanced_timeline

    def _save_timeline_to_db(self, timeline_with_dates, db_task_ids):
        if not self.db or timeline_with_dates.get("error"):
            return
        enhanced_schedule = timeline_with_dates.get("enhanced_task_schedule", [])
        for i, schedule_info in enumerate(enhanced_schedule):
            task_id = db_task_ids.get(i)
            if task_id:
                task = self.db.query(Task).filter(Task.task_id == task_id).first()
                if task:
                    task.planned_start_date = datetime.fromisoformat(schedule_info["actual_start_date"].replace('Z', '+00:00'))
                    task.planned_end_date = datetime.fromisoformat(schedule_info["actual_end_date"].replace('Z', '+00:00'))

    def _save_educational_details_to_db(self, enhanced_tasks, db_task_ids):
        if not self.db:
            return
        for i, task_data in enumerate(enhanced_tasks):
            task_id = db_task_ids.get(i)
            if task_id:
                task = self.db.query(Task).filter(Task.task_id == task_id).first()
                if task:
                    educational_detail = task_data.get("educational_detail", {})
                    if educational_detail:
                        task.detail = json.dumps(educational_detail, ensure_ascii=False, indent=2, cls=UUIDEncoder)
                        task.learning_resources = educational_detail.get("learning_resources", [])
                        tech_stack_raw = educational_detail.get("technologies_used", [])
                        task.technology_stack = [tech.get("name") if isinstance(tech, dict) else str(tech) for tech in tech_stack_raw]
                        task.reference_links = educational_detail.get("reference_links", [])
                        task.completion_criteria = educational_detail.get("completion_criteria", "")

    def _generate_educational_summary(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        total_technologies = set()
        learning_resources = []
        complexity_distribution = defaultdict(int)
        for task in tasks:
            educational_detail = task.get("educational_detail", {})
            for tech in educational_detail.get("technologies_used", []):
                total_technologies.add(tech.get("name", "") if isinstance(tech, dict) else str(tech))
            learning_resources.extend(educational_detail.get("learning_resources", []))
            complexity_distribution[task.get("complexity_level", 0)] += 1
        return {
            "total_unique_technologies": len(total_technologies),
            "technologies_overview": list(total_technologies),
            "total_learning_resources": len(set(learning_resources)),
            "complexity_distribution": dict(complexity_distribution),
            "educational_recommendations": [
                "各タスクの技術ドキュメントを事前に確認してください",
                "複雑度の高いタスクは追加の学習時間を確保してください",
            ]
        }
