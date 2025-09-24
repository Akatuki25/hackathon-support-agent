from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from .base_service import BaseService
from .taskDetail_service import TaskDetailService, EnhancedTaskDetail
from typing import List, Dict, Any, Optional, Tuple
from models.project_base import ProjectDocument, Task, TaskDependency, ProjectBase
from datetime import datetime, timedelta
import json
import uuid
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict, deque
import asyncio
import networkx as nx
import logging

# Custom JSON encoder to handle UUID objects
class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

# Custom Exception for dependency cycle errors
class DependencyCycleError(Exception):
    pass

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

            # Stage 2: MoSCoW優先度付けと詳細分析
            stage2_result = await self._stage2_moscow_prioritization_and_analysis(
                stage1_result, project_document, use_parallel_processing
            )

            # Stage 3: 依存関係分析とトポロジカルソート
            stage3_result = await self._stage3_dependency_analysis_and_topological_sort(
                stage2_result, project_document
            )

            # Stage 4: 時系列タイムライン生成
            stage4_result = await self._stage4_timeline_generation_with_project_dates(
                stage3_result, project_base, project_duration_days, team_size
            )

            # Stage 5: 教育的タスク詳細生成（並列処理）
            stage5_result = await self._stage5_educational_task_details_generation(
                stage4_result, project_document, use_parallel_processing
            )

            # Stage 6: 最終DB保存と包括的結果構築
            final_result = await self._stage6_final_database_save_and_result_compilation(
                stage5_result, project_document.project_id, project_document.doc_id
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
        self.logger.info("Stage 1: Initial task decomposition starting")
        raw_tasks = self._decompose_project_into_tasks(project_document, hackathon_mode)
        db_task_ids = {}
        if self.db:
            for i, task_data in enumerate(raw_tasks):
                task = Task(
                    project_id=project_document.project_id,
                    title=task_data.get("task_name", f"Task {i+1}"),
                    description=task_data.get("description", ""),
                    category=task_data.get("category"),
                    estimated_hours=task_data.get("estimated_hours"),
                    complexity_level=task_data.get("complexity_level"),
                    source_doc_id=project_document.doc_id
                )
                self.db.add(task)
                self.db.flush()
                db_task_ids[i] = task.task_id
                task_data["db_task_id"] = task.task_id
            self.db.commit()
        result = {"tasks": raw_tasks, "db_task_ids": db_task_ids, "stage": "initial_decomposition"}
        self.logger.info(f"Stage 1 completed: {len(raw_tasks)} tasks created")
        return result

    async def _stage2_moscow_prioritization_and_analysis(
        self,
        stage1_result: Dict[str, Any],
        project_document: ProjectDocument,
        use_parallel_processing: bool
    ) -> Dict[str, Any]:
        self.logger.info("Stage 2: MoSCoW prioritization and analysis starting")
        tasks = stage1_result["tasks"]
        if use_parallel_processing:
            prioritized_tasks = await self._parallel_moscow_analysis(tasks, project_document)
        else:
            prioritized_tasks = self._apply_moscow_prioritization(tasks, project_document)
        if self.db:
            for i, task_data in enumerate(prioritized_tasks):
                db_task_id = stage1_result["db_task_ids"].get(i)
                if db_task_id:
                    task = self.db.query(Task).filter(Task.task_id == db_task_id).first()
                    if task:
                        task.business_value_score = task_data.get("business_value_score")
                        task.technical_risk_score = task_data.get("technical_risk_score")
                        task.implementation_difficulty = task_data.get("implementation_difficulty")
                        task.user_impact_score = task_data.get("user_impact_score")
                        task.dependency_weight = task_data.get("dependency_weight")
                        task.moscow_priority = task_data.get("moscow_priority")
                        task.mvp_critical = task_data.get("mvp_critical", False)
            self.db.commit()
        result = {**stage1_result, "tasks": prioritized_tasks, "stage": "moscow_prioritization"}
        self.logger.info("Stage 2 completed: MoSCoW prioritization applied")
        return result

    async def _stage3_dependency_analysis_and_topological_sort(
        self,
        stage2_result: Dict[str, Any],
        project_document: ProjectDocument
    ) -> Dict[str, Any]:
        self.logger.info("Stage 3: Dependency analysis and topological sort starting")
        tasks = stage2_result["tasks"]
        try:
            dependency_analysis = self._analyze_task_dependencies(tasks)
            topological_result = self._perform_topological_sort(
                tasks, dependency_analysis, stage2_result["db_task_ids"]
            )
            if self.db:
                self._save_dependencies_to_db(
                    dependency_analysis, stage2_result["db_task_ids"], project_document.project_id
                )
                self._update_topological_order_in_db(topological_result, stage2_result["db_task_ids"])
            result = {
                **stage2_result,
                "dependency_analysis": dependency_analysis,
                "topological_order": topological_result,
                "stage": "dependency_analysis"
            }
        except DependencyCycleError as e:
            self.logger.error(f"Could not complete dependency analysis due to unresolvable cycles: {e}")
            result = {
                **stage2_result,
                "dependency_analysis": {"error": str(e)},
                "topological_order": {"error": str(e)},
                "stage": "dependency_analysis_failed"
            }
        self.logger.info("Stage 3 completed.")
        return result

    async def _stage4_timeline_generation_with_project_dates(
        self,
        stage3_result: Dict[str, Any],
        project_base: ProjectBase,
        project_duration_days: int,
        team_size: int
    ) -> Dict[str, Any]:
        self.logger.info("Stage 4: Timeline generation with project dates starting")
        if stage3_result.get("stage") == "dependency_analysis_failed":
            self.logger.warning("Skipping Stage 4 (Timeline Generation) due to failure in dependency analysis.")
            return {**stage3_result, "stage": "timeline_generation_skipped"}
        
        project_start = project_base.start_date
        project_end = project_base.end_date
        timeline = self._generate_optimized_timeline(
            stage3_result["tasks"],
            stage3_result["dependency_analysis"],
            project_duration_days,
            team_size
        )
        timeline_with_dates = self._map_timeline_to_project_dates(
            timeline, stage3_result["topological_order"], project_start, project_end
        )
        if self.db:
            self._save_timeline_to_db(timeline_with_dates, stage3_result["db_task_ids"])
        result = {
            **stage3_result,
            "timeline": timeline_with_dates,
            "project_dates": {
                "start_date": project_start.isoformat(),
                "end_date": project_end.isoformat()
            },
            "stage": "timeline_generation"
        }
        self.logger.info("Stage 4 completed: Timeline mapped to project dates")
        return result

    async def _stage5_educational_task_details_generation(
        self,
        stage4_result: Dict[str, Any],
        project_document: ProjectDocument,
        use_parallel_processing: bool
    ) -> Dict[str, Any]:
        self.logger.info("Stage 5: Educational task details generation starting")
        tasks = stage4_result["tasks"]
        if use_parallel_processing and self.task_detail_service:
            enhanced_tasks = await self._parallel_educational_details_generation(tasks, project_document)
        else:
            enhanced_tasks = self._sequential_educational_details_generation(tasks, project_document)
        if self.db:
            self._save_educational_details_to_db(enhanced_tasks, stage4_result["db_task_ids"])
        result = {**stage4_result, "tasks": enhanced_tasks, "stage": "educational_details"}
        self.logger.info("Stage 5 completed: Educational details generated")
        return result

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
        stage5_result: Dict[str, Any],
        project_id: uuid.UUID,
        source_doc_id: uuid.UUID
    ) -> Dict[str, Any]:
        self.logger.info("Stage 6: Final database save and result compilation starting")
        markdown_output = self._generate_markdown_summary(stage5_result["tasks"])
        
        final_result = {
            "tasks": stage5_result["tasks"],
            "dependency_graph": stage5_result.get("dependency_analysis", {}),
            "topological_order": stage5_result.get("topological_order", {}),
            "timeline": stage5_result.get("timeline", {}),
            "project_dates": stage5_result.get("project_dates", {}),
            "priority_matrix": self._generate_priority_matrix(stage5_result["tasks"]),
            "confidence_metrics": self._calculate_confidence_and_risks(
                stage5_result["tasks"],
                self.db.query(ProjectDocument).filter(ProjectDocument.doc_id == source_doc_id).first(),
                stage5_result.get("dependency_analysis", {})
            ),
            "educational_summary": self._generate_educational_summary(stage5_result["tasks"]),
            "markdown_output": markdown_output,
            "generated_at": datetime.now().isoformat(),
            "metadata": {
                "project_id": str(project_id),
                "source_doc_id": str(source_doc_id),
                "total_tasks": len(stage5_result["tasks"]),
                "critical_path_length": len(stage5_result.get("topological_order", {}).get("critical_path", [])),
                "generation_method": "enhanced_full_workflow_v3",
                "stages_completed": [s for s in [stage5_result.get("stage")] if s]
            }
        }

        if stage5_result.get("stage") == "dependency_analysis_failed":
            final_result["metadata"]["notes"] = "Dependency analysis was skipped due to unresolvable circular dependencies. Timeline and critical path are not available."

        if self.db:
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
        project_document: ProjectDocument
    ) -> List[Dict[str, Any]]:
        if not self.task_detail_service:
            return tasks
        enhanced_tasks = self.task_detail_service.generate_task_details_parallel(
            tasks,
            project_document.specification,
            batch_size=3,
            max_workers=4
        )
        return enhanced_tasks

    def _sequential_educational_details_generation(
        self,
        tasks: List[Dict[str, Any]],
        project_document: ProjectDocument
    ) -> List[Dict[str, Any]]:
        enhanced_tasks = []
        for task in tasks:
            if self.task_detail_service:
                enhanced_detail = self.task_detail_service.generate_enhanced_task_detail(
                    task, project_document.specification
                )
                enhanced_task = {**task}
                enhanced_task["educational_detail"] = enhanced_detail.model_dump()
                enhanced_tasks.append(enhanced_task)
            else:
                enhanced_tasks.append(task)
        return enhanced_tasks

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