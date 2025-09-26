"""Plan generation service orchestrating skeleton creation, task derivation, scheduling, and member assignment."""
from __future__ import annotations

import math
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Literal, Optional, Tuple, TypedDict

from langchain.output_parsers import RetryOutputParser
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda, RunnableParallel
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field, root_validator, validator
from sqlalchemy.orm import Session, selectinload

from models.project_base import (
    MemberBase,
    ProjectBase,
    ProjectDocument,
    ProjectMember,
    Task,
    TaskAssignment,
    TaskStatusEnum,
)
from .base_service import BaseService

CATEGORY_ORDER: Dict[str, int] = {
    "research": 0,
    "analysis": 1,
    "architecture": 2,
    "design": 3,
    "implementation": 4,
    "integration": 5,
    "testing": 6,
    "deployment": 7,
    "operation": 8,
}

ESTIMATE_CHOICES = {0.5, 1.0, 1.5}
PHASES: Tuple[str, ...] = ("P0", "P1", "P2")
STATUS_WEIGHT = {
    "TODO": 0.0,
    "DOING": 0.5,
    "DONE": 1.0,
}


class PlanReference(BaseModel):
    label: str
    pointer: str
    note: Optional[str] = None


class SkeletonEpic(BaseModel):
    epic_id: str
    name: str
    mission: str
    deliverables: List[str]
    depends_on: List[str] = Field(default_factory=list)
    refs: List[str] = Field(default_factory=list)

    @validator("epic_id")
    def validate_epic_id(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("epic_id cannot be empty")
        return value

    @validator("depends_on", each_item=True)
    def normalize_depends(cls, value: str) -> str:
        return value.strip()


class PlanSkeleton(BaseModel):
    directory_tree: List[str]
    epics: List[SkeletonEpic]

    @validator("directory_tree")
    def ensure_directory_entries(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("directory_tree requires at least one entry")
        return value


class TaskReference(BaseModel):
    label: str
    pointer: str
    note: Optional[str] = None


class EpicTaskDetail(BaseModel):
    local_id: str
    title: str
    objective: str
    deliverable: str
    category: str
    estimate_d: float
    refs: List[TaskReference]
    required_skills: List[str]

    @validator("local_id")
    def validate_local_id(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("local_id must not be empty")
        return value

    @validator("category")
    def validate_category(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in CATEGORY_ORDER:
            raise ValueError(f"category '{value}' is not supported")
        return normalized

    @validator("estimate_d")
    def validate_estimate(cls, value: float) -> float:
        if value not in ESTIMATE_CHOICES:
            raise ValueError("estimate_d must be one of 0.5, 1.0, 1.5")
        return value

    @validator("refs")
    def ensure_refs(cls, value: List[TaskReference]) -> List[TaskReference]:
        if not value:
            raise ValueError("each task requires at least one reference")
        return value


class EpicPlan(BaseModel):
    epic_id: str
    summary: str
    explanation: str
    tasks: List[EpicTaskDetail]

    @validator("tasks")
    def ensure_tasks(cls, value: List[EpicTaskDetail]) -> List[EpicTaskDetail]:
        if not value:
            raise ValueError("tasks must not be empty")
        return value


class PlannedTask(BaseModel):
    task_id: uuid.UUID
    epic_id: str
    title: str
    description: str
    deliverable: str
    category: str
    estimate_d: float
    refs: List[TaskReference]
    required_skills: List[str]
    dependencies: List[uuid.UUID] = Field(default_factory=list)
    parallel_with: List[uuid.UUID] = Field(default_factory=list)
    phase: Literal["P0", "P1", "P2"]
    due_at: datetime
    assignee_project_member_id: Optional[uuid.UUID] = None
    detail_generated: bool = False
    detail: Optional[str] = None


class PhasePlan(BaseModel):
    phase: Literal["P0", "P1", "P2"]
    deadline: datetime
    tasks: List[PlannedTask]


class AssignmentSummary(BaseModel):
    task_id: uuid.UUID
    project_member_id: uuid.UUID
    member_name: str


class PlanMember(BaseModel):
    project_member_id: uuid.UUID
    member_id: uuid.UUID
    member_name: str
    skills: List[str]
    capacity_per_day: float


class PlanResult(BaseModel):
    project_id: uuid.UUID
    generated_at: datetime
    directory_tree: List[str]
    phases: List[PhasePlan]
    assignments: List[AssignmentSummary]
    members: List[PlanMember]


class PlanState(TypedDict, total=False):
    context: "ProjectContext"
    skeleton: PlanSkeleton
    epic_plans: Dict[str, EpicPlan]
    plan: PlanResult


@dataclass
class ProjectContext:
    project: ProjectBase
    document: ProjectDocument
    project_members: List[ProjectMember]
    members: Dict[uuid.UUID, MemberBase]
    existing_tasks: List[Task]
    now: datetime


class PlanGeneratorService(BaseService):
    """Service responsible for generating project execution plans."""

    def __init__(self, db: Session, default_model_provider: str = "google"):
        """Initialize service with database session and model provider."""
        super().__init__(db=db, default_model_provider=default_model_provider)
        self.graph = self._build_graph()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def generate_plan(self, project_id: uuid.UUID) -> PlanResult:
        """Generate a project plan for the given project."""
        context = self._load_context(project_id)
        initial_state: PlanState = {"context": context}
        final_state = self.graph.invoke(initial_state)
        plan = final_state.get("plan")
        if plan is None:
            raise RuntimeError("Plan graph did not produce a result")
        return plan

    def get_plan(self, project_id: uuid.UUID) -> PlanResult:
        """Return the latest persisted plan snapshot for a project."""
        context = self._load_context(project_id)
        tasks_map, assignments = self._hydrate_planned_from_db(context.project)

        plan_meta = context.project.plan_metadata or {}
        raw_directory = plan_meta.get("directory_tree")
        if raw_directory and isinstance(raw_directory, list):
            directory_tree = [str(entry) for entry in raw_directory]
        else:
            directory_tree = [line.strip() for line in (context.document.directory_info or "").splitlines() if line.strip()]

        generated_at_raw = plan_meta.get("generated_at")
        generated_at = context.now
        if isinstance(generated_at_raw, str):
            try:
                parsed = datetime.fromisoformat(generated_at_raw)
                generated_at = parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                generated_at = context.now

        stored_deadlines = plan_meta.get("phase_deadlines", {}) if isinstance(plan_meta, dict) else {}
        phases: List[PhasePlan] = []
        for phase in PHASES:
            deadline = self._resolve_phase_deadline(
                phase=phase,
                stored_deadlines=stored_deadlines,
                tasks_map=tasks_map,
                fallback=context.project.end_date,
            )
            tasks_in_phase = [task for task in tasks_map.values() if task.phase == phase]
            tasks_sorted = sorted(
                tasks_in_phase,
                key=lambda t: (CATEGORY_ORDER.get(t.category, 99), t.title),
            )
            phases.append(PhasePlan(phase=phase, deadline=deadline, tasks=tasks_sorted))

        return PlanResult(
            project_id=context.project.project_id,
            generated_at=generated_at,
            directory_tree=directory_tree,
            phases=phases,
            assignments=list(assignments.values()),
            members=self._build_member_payload(context),
        )

    # ------------------------------------------------------------------
    # LangGraph construction
    # ------------------------------------------------------------------
    def _build_graph(self):
        """Create LangGraph pipeline for skeleton, detail, and scheduling stages."""
        builder = StateGraph(PlanState)
        builder.add_node("skeleton", self._node_generate_skeleton)
        builder.add_node("details", self._node_generate_details)
        builder.add_node("schedule", self._node_schedule_and_assign)

        builder.set_entry_point("skeleton")
        builder.add_edge("skeleton", "details")
        builder.add_edge("details", "schedule")
        builder.add_edge("schedule", END)
        return builder.compile()

    # ------------------------------------------------------------------
    # Nodes
    # ------------------------------------------------------------------
    def _node_generate_skeleton(self, state: PlanState) -> PlanState:
        """Generate plan skeleton using LLM."""
        context = state["context"]
        skeleton = self._invoke_skeleton_chain(context)
        new_state = dict(state)
        new_state["skeleton"] = skeleton
        return new_state

    def _node_generate_details(self, state: PlanState) -> PlanState:
        """Expand each epic into concrete tasks."""
        context = state["context"]
        skeleton = state["skeleton"]
        epic_plans = self._invoke_epic_detail_chains(context, skeleton)
        new_state = dict(state)
        new_state["epic_plans"] = epic_plans
        return new_state

    def _node_schedule_and_assign(self, state: PlanState) -> PlanState:
        """Derive schedule, phase grouping, and assignments from tasks."""
        context = state["context"]
        skeleton = state["skeleton"]
        epic_plans = state["epic_plans"]
        plan = self._build_schedule_and_assign(context, skeleton, epic_plans)
        new_state = dict(state)
        new_state["plan"] = plan
        return new_state

    # ------------------------------------------------------------------
    # Context loading
    # ------------------------------------------------------------------
    def _load_context(self, project_id: uuid.UUID) -> ProjectContext:
        """Fetch project, document, member, and task context from the database."""
        project: ProjectBase = (
            self.db.query(ProjectBase)
            .options(
                selectinload(ProjectBase.document),
                selectinload(ProjectBase.members).selectinload(ProjectMember.member_base),
                selectinload(ProjectBase.tasks)
                .selectinload(Task.assignees)
                .selectinload(TaskAssignment.project_member),
            )
            .filter(ProjectBase.project_id == project_id)
            .first()
        )
        if project is None:
            raise ValueError(f"project {project_id} not found")
        if project.document is None:
            raise ValueError("project document is required for plan generation")

        member_map: Dict[uuid.UUID, MemberBase] = {}
        project_members = []
        for association in project.members:
            project_members.append(association)
            if association.member_base:
                member_map[association.member_id] = association.member_base

        now = datetime.now(timezone.utc)

        return ProjectContext(
            project=project,
            document=project.document,
            project_members=project_members,
            members=member_map,
            existing_tasks=project.tasks,
            now=now,
        )

    # ------------------------------------------------------------------
    # Skeleton generation
    # ------------------------------------------------------------------
    def _invoke_skeleton_chain(self, context: ProjectContext) -> PlanSkeleton:
        """Call LLM to build directory skeleton and epic outline."""
        parser = PydanticOutputParser(pydantic_object=PlanSkeleton)
        prompt_template = ChatPromptTemplate.from_template(
            self.get_prompt("plan_generator_service", "skeleton")
        )
        retry_parser = RetryOutputParser.from_llm(parser=parser, llm=self.llm_flash)

        prompt_value = prompt_template.format_prompt(
            project_title=context.project.title,
            specification=context.document.specification,
            function_doc=context.document.function_doc,
            technology_doc=context.document.frame_work_doc,
            directory_hint=context.document.directory_info,
            format_instructions=parser.get_format_instructions(),
        )
        raw_output = self.llm_flash.invoke(prompt_value.to_messages())
        try:
            return parser.parse(raw_output.content)
        except Exception:
            return retry_parser.parse_with_prompt(raw_output.content, prompt_value)

    # ------------------------------------------------------------------
    # Epic detail generation
    # ------------------------------------------------------------------
    def _invoke_epic_detail_chains(
        self, context: ProjectContext, skeleton: PlanSkeleton
    ) -> Dict[str, EpicPlan]:
        """Generate per-epic task details in parallel with retry handling."""
        parser = PydanticOutputParser(pydantic_object=EpicPlan)
        retry_parser = RetryOutputParser.from_llm(parser=parser, llm=self.llm_flash)
        template = ChatPromptTemplate.from_template(
            self.get_prompt("plan_generator_service", "epic_detail")
        )

        def build_runnable(epic: SkeletonEpic) -> RunnableLambda:
            def invoke_epic(_: Dict[str, Any]) -> EpicPlan:
                prompt_value = template.format_prompt(
                    project_title=context.project.title,
                    epic=epic.model_dump(),
                    specification=context.document.specification,
                    function_doc=context.document.function_doc,
                    format_instructions=parser.get_format_instructions(),
                )
                raw = self.llm_flash.invoke(prompt_value.to_messages())
                try:
                    parsed = parser.parse(raw.content)
                except Exception:
                    parsed = retry_parser.parse_with_prompt(raw.content, prompt_value)
                if parsed.epic_id != epic.epic_id:
                    parsed.epic_id = epic.epic_id
                return parsed

            return RunnableLambda(invoke_epic)

        parallel_inputs = {
            epic.epic_id: build_runnable(epic)
            for epic in skeleton.epics
        }
        parallel = RunnableParallel(parallel_inputs)
        results = parallel.invoke({})
        return {epic_id: plan for epic_id, plan in results.items()}

    # ------------------------------------------------------------------
    # Schedule, dependency, assignment logic
    # ------------------------------------------------------------------
    def _build_schedule_and_assign(
        self,
        context: ProjectContext,
        skeleton: PlanSkeleton,
        epic_plans: Dict[str, EpicPlan],
    ) -> PlanResult:
        """Compute dependencies, phases, deadlines, and member assignments."""
        all_tasks = self._flatten_tasks(epic_plans)
        self._apply_epic_dependencies(skeleton, epic_plans, all_tasks)
        topo_order, levels = self._topological_sort(all_tasks)
        critical_cost = self._compute_critical_costs(all_tasks, topo_order)
        phases, phase_deadlines = self._assign_phases_and_deadlines(
            context, all_tasks, topo_order
        )
        for planned in all_tasks.values():
            if planned.detail_generated:
                planned.detail = self._format_task_detail(planned)
        assignments = self._assign_members(
            context=context,
            tasks=all_tasks,
            topo_order=topo_order,
            critical_cost=critical_cost,
        )
        self._persist_plan(
            context=context,
            tasks=all_tasks,
            assignments=assignments,
            directory_tree=skeleton.directory_tree,
            phase_deadlines=phase_deadlines,
            generated_at=context.now,
        )
        phase_objects = self._assemble_phase_objects(
            all_tasks, phases, phase_deadlines, assignments
        )
        return PlanResult(
            project_id=context.project.project_id,
            generated_at=context.now,
            directory_tree=skeleton.directory_tree,
            phases=phase_objects,
            assignments=[
                AssignmentSummary(
                    task_id=task_id,
                    project_member_id=assignment.project_member_id,
                    member_name=assignment.member_name,
                )
                for task_id, assignment in assignments.items()
            ],
            members=self._build_member_payload(context),
        )

    # ------------------------------------------------------------------
    # Task flattening & dependency injection
    # ------------------------------------------------------------------
    def _flatten_tasks(self, epic_plans: Dict[str, EpicPlan]) -> Dict[uuid.UUID, PlannedTask]:
        """Flatten epic outputs into global task map with generated identifiers."""
        flattened: Dict[uuid.UUID, PlannedTask] = {}
        for epic_id, epic_plan in epic_plans.items():
            for detail in epic_plan.tasks:
                task_id = uuid.uuid4()
                flattened[task_id] = PlannedTask(
                    task_id=task_id,
                    epic_id=epic_id,
                    title=detail.title,
                    description=detail.objective,
                    deliverable=detail.deliverable,
                    category=detail.category,
                    estimate_d=detail.estimate_d,
                    refs=detail.refs,
                    required_skills=[skill.lower().strip() for skill in detail.required_skills],
                    dependencies=[],
                    parallel_with=[],
                    phase="P0",
                    due_at=datetime.now(timezone.utc),
                    detail_generated=False,
                )
        return flattened

    def _apply_epic_dependencies(
        self,
        skeleton: PlanSkeleton,
        epic_plans: Dict[str, EpicPlan],
        tasks: Dict[uuid.UUID, PlannedTask],
    ) -> None:
        """Apply intra- and inter-epic dependency rules to the task set."""
        epic_to_tasks: Dict[str, List[uuid.UUID]] = defaultdict(list)
        for task_id, task in tasks.items():
            epic_to_tasks[task.epic_id].append(task_id)

        # Intra-epic dependencies based on category order
        for epic_id, task_ids in epic_to_tasks.items():
            sorted_tasks = sorted(
                task_ids,
                key=lambda tid: (CATEGORY_ORDER[tasks[tid].category], tasks[tid].title),
            )
            last_by_category: Dict[str, uuid.UUID] = {}
            for task_id in sorted_tasks:
                task = tasks[task_id]
                for category, last_task_id in last_by_category.items():
                    if CATEGORY_ORDER[category] <= CATEGORY_ORDER[task.category]:
                        if last_task_id not in task.dependencies and last_task_id != task_id:
                            task.dependencies.append(last_task_id)
                last_by_category[task.category] = task_id

        # Cross-epic dependencies from skeleton
        epic_last_task: Dict[str, Optional[uuid.UUID]] = {}
        for epic_id, task_ids in epic_to_tasks.items():
            if not task_ids:
                epic_last_task[epic_id] = None
            else:
                epic_last_task[epic_id] = max(
                    task_ids,
                    key=lambda tid: CATEGORY_ORDER[tasks[tid].category],
                )

        epic_dependency_map = {
            epic.epic_id: epic.depends_on for epic in skeleton.epics
        }
        for epic_id, dependencies in epic_dependency_map.items():
            for dependent_epic_id in dependencies:
                tail_task_id = epic_last_task.get(dependent_epic_id)
                if tail_task_id is None:
                    continue
                for task_id in epic_to_tasks.get(epic_id, []):
                    task = tasks[task_id]
                    if tail_task_id not in task.dependencies and tail_task_id != task.task_id:
                        task.dependencies.append(tail_task_id)

    # ------------------------------------------------------------------
    # DAG utilities
    # ------------------------------------------------------------------
    def _topological_sort(
        self, tasks: Dict[uuid.UUID, PlannedTask]
    ) -> Tuple[List[uuid.UUID], Dict[uuid.UUID, int]]:
        """Perform Kahn topological sort and annotate parallelizable groups."""
        indegree: Dict[uuid.UUID, int] = {task_id: 0 for task_id in tasks}
        adjacency: Dict[uuid.UUID, List[uuid.UUID]] = defaultdict(list)
        for task_id, task in tasks.items():
            for dep in task.dependencies:
                adjacency[dep].append(task_id)
                indegree[task_id] += 1

        queue = deque([task_id for task_id, deg in indegree.items() if deg == 0])
        levels: Dict[uuid.UUID, int] = {task_id: 0 for task_id in queue}
        order: List[uuid.UUID] = []

        while queue:
            current = queue.popleft()
            order.append(current)
            for follower in adjacency[current]:
                indegree[follower] -= 1
                levels[follower] = max(levels.get(follower, 0), levels[current] + 1)
                if indegree[follower] == 0:
                    queue.append(follower)

        if len(order) != len(tasks):
            raise ValueError("cycle detected in generated tasks")

        # annotate parallelism
        level_groups: Dict[int, List[uuid.UUID]] = defaultdict(list)
        for task_id in order:
            level_groups[levels[task_id]].append(task_id)
        for group in level_groups.values():
            if len(group) <= 1:
                continue
            for task_id in group:
                tasks[task_id].parallel_with = [gid for gid in group if gid != task_id]

        return order, levels

    def _compute_critical_costs(
        self,
        tasks: Dict[uuid.UUID, PlannedTask],
        topo_order: List[uuid.UUID],
    ) -> Dict[uuid.UUID, float]:
        reversed_order = list(reversed(topo_order))
        adjacency: Dict[uuid.UUID, List[uuid.UUID]] = defaultdict(list)
        for task_id, task in tasks.items():
            for dep in task.dependencies:
                adjacency[dep].append(task_id)

        cost: Dict[uuid.UUID, float] = {task_id: tasks[task_id].estimate_d for task_id in tasks}
        for task_id in reversed_order:
            downstream_cost = 0.0
            for follower in adjacency[task_id]:
                downstream_cost = max(downstream_cost, cost[follower])
            cost[task_id] = tasks[task_id].estimate_d + downstream_cost
        return cost

    # ------------------------------------------------------------------
    # Phase allocation & deadlines
    # ------------------------------------------------------------------
    def _assign_phases_and_deadlines(
        self,
        context: ProjectContext,
        tasks: Dict[uuid.UUID, PlannedTask],
        topo_order: List[uuid.UUID],
    ) -> Tuple[Dict[uuid.UUID, str], Dict[str, datetime]]:
        """Assign P0/P1/P2 phases and compute phase deadlines backwards from project end."""
        total_estimate = sum(tasks[task_id].estimate_d for task_id in topo_order)
        if total_estimate <= 0:
            total_estimate = len(topo_order) or 1

        boundaries = [total_estimate * frac for frac in (0.33, 0.66, 1.0)]
        cumulative = 0.0
        phase_index = 0
        phase_map: Dict[uuid.UUID, str] = {}
        for task_id in topo_order:
            cumulative += tasks[task_id].estimate_d
            while phase_index < len(PHASES) - 1 and cumulative > boundaries[phase_index]:
                phase_index += 1
            tasks[task_id].phase = PHASES[phase_index]
            phase_map[task_id] = PHASES[phase_index]
            tasks[task_id].detail_generated = PHASES[phase_index] == "P0"

        project = context.project
        now = context.now
        project_end = project.end_date
        if project_end.tzinfo is None:
            project_end = project_end.replace(tzinfo=timezone.utc)
        remaining_days = max((project_end - now).days, 1)

        progress_ratio = self._calculate_progress_ratio(context.existing_tasks)
        remaining_days = max(1, math.ceil(remaining_days * (1 - progress_ratio)))

        phase_estimate = {
            phase: sum(
                tasks[task_id].estimate_d for task_id in topo_order if phase_map[task_id] == phase
            )
            for phase in PHASES
        }
        est_total = sum(phase_estimate.values()) or 1
        deadlines: Dict[str, datetime] = {}
        cursor = project_end
        for phase in reversed(PHASES):
            share = phase_estimate[phase] / est_total
            span_days = max(1, math.ceil(remaining_days * share))
            deadlines[phase] = cursor
            cursor = cursor - timedelta(days=span_days)

        for task_id in topo_order:
            tasks[task_id].due_at = deadlines[phase_map[task_id]]

        return phase_map, deadlines

    def _calculate_progress_ratio(self, tasks: Iterable[Task]) -> float:
        task_list = list(tasks)
        if not task_list:
            return 0.0
        weights = []
        for task in task_list:
            status_key = self._normalize_status(task.status)
            weights.append(STATUS_WEIGHT.get(status_key, 0.0))
        return sum(weights) / len(weights)

    def _normalize_status(self, status: Any) -> str:
        if isinstance(status, str):
            upper = status.upper()
            choices = getattr(TaskStatusEnum, "enums", [])
            return upper if upper in choices else "TODO"
        if hasattr(status, "value"):
            upper = str(status.value).upper()
            choices = getattr(TaskStatusEnum, "enums", [])
            return upper if upper in choices else "TODO"
        try:
            upper = str(status).upper()
            choices = getattr(TaskStatusEnum, "enums", [])
            return upper if upper in choices else "TODO"
        except Exception:
            return "TODO"

    # ------------------------------------------------------------------
    # Assignment logic
    # ------------------------------------------------------------------
    def _assign_members(
        self,
        context: ProjectContext,
        tasks: Dict[uuid.UUID, PlannedTask],
        topo_order: List[uuid.UUID],
        critical_cost: Dict[uuid.UUID, float],
    ) -> Dict[uuid.UUID, "AssignmentContext"]:
        """Assign each task to the best suited member based on skills and load."""
        member_capacities = self._load_member_capacity(context)
        assignment_summary: Dict[uuid.UUID, AssignmentContext] = {}

        for task_id in topo_order:
            task = tasks[task_id]
            selected_assignment = self._select_member_for_task(
                task=task,
                member_capacities=member_capacities,
                critical_cost=critical_cost[task_id],
            )
            if selected_assignment:
                task.assignee_project_member_id = selected_assignment.project_member_id
                assignment_summary[task_id] = selected_assignment

        return assignment_summary

    def _load_member_capacity(
        self, context: ProjectContext
    ) -> Dict[uuid.UUID, "AssignmentContext"]:
        """Load member skills and available capacity including existing workload."""
        member_capacity: Dict[uuid.UUID, AssignmentContext] = {}
        existing_load = self._calculate_existing_load(context)
        for association in context.project_members:
            member = context.members.get(association.member_id)
            if member is None:
                continue
            skills = self._parse_skills(member.member_skill)
            capacity = member.capacity_per_day if member.capacity_per_day else 1.0
            load = existing_load.get(association.project_member_id, 0.0)
            member_capacity[association.project_member_id] = AssignmentContext(
                project_member_id=association.project_member_id,
                member_id=association.member_id,
                member_name=association.member_name,
                skills=skills,
                capacity_per_day=capacity,
                current_load=load,
            )
        return member_capacity

    def _build_member_payload(self, context: ProjectContext) -> List[PlanMember]:
        """Assemble plan-specific member data for frontend consumption."""
        payload: List[PlanMember] = []
        for association in context.project_members:
            member = context.members.get(association.member_id)
            skills = self._parse_skills(member.member_skill) if member else []
            capacity = member.capacity_per_day if member and member.capacity_per_day else 1.0
            payload.append(
                PlanMember(
                    project_member_id=association.project_member_id,
                    member_id=association.member_id,
                    member_name=association.member_name,
                    skills=[skill.lower() for skill in skills],
                    capacity_per_day=capacity,
                )
            )
        return payload

    def _calculate_existing_load(self, context: ProjectContext) -> Dict[uuid.UUID, float]:
        """Aggregate remaining workload for each member from existing assignments."""
        load_map: Dict[uuid.UUID, float] = defaultdict(float)
        assignments = (
            self.db.query(TaskAssignment, Task)
            .join(Task, TaskAssignment.task_id == Task.task_id)
            .filter(Task.project_id == context.project.project_id)
            .all()
        )
        for assignment, task in assignments:
            if self._normalize_status(task.status) == "DONE":
                continue
            load_map[assignment.project_member_id] += 1.0
        return load_map

    def _select_member_for_task(
        self,
        task: PlannedTask,
        member_capacities: Dict[uuid.UUID, "AssignmentContext"],
        critical_cost: float,
    ) -> Optional["AssignmentContext"]:
        """Select highest scoring member for a task; update member load."""
        if not member_capacities:
            return None

        best_score = -1.0
        best_assignment: Optional[AssignmentContext] = None
        for context_item in member_capacities.values():
            skill_score = self._skill_match(task.required_skills, context_item.skills)
            if skill_score == 0:
                continue
            load_factor = max(context_item.capacity_per_day - context_item.current_load, 0.0)
            criticality = 1.0 + (critical_cost / 10.0)
            score = (skill_score * 0.6) + (load_factor * 0.2) + (criticality * 0.2)
            if score > best_score:
                best_score = score
                best_assignment = context_item

        if best_assignment is not None:
            best_assignment.current_load += task.estimate_d
        return best_assignment

    def _skill_match(self, required: List[str], possessed: List[str]) -> float:
        """Return overlap ratio between required and possessed skills."""
        if not required:
            return 0.0
        required_set = {skill.lower().strip() for skill in required if skill.strip()}
        possessed_set = {skill.lower().strip() for skill in possessed if skill.strip()}
        if not possessed_set:
            return 0.0
        overlap = required_set.intersection(possessed_set)
        return len(overlap) / len(required_set)

    def _parse_skills(self, skill_blob: str) -> List[str]:
        """Parse comma or delimiter separated skills into normalized list."""
        if not skill_blob:
            return []
        separators = [",", "|", "/", "\n"]
        normalized = skill_blob
        for sep in separators:
            normalized = normalized.replace(sep, ",")
        return [skill.strip() for skill in normalized.split(",") if skill.strip()]

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _persist_plan(
        self,
        context: ProjectContext,
        tasks: Dict[uuid.UUID, PlannedTask],
        assignments: Dict[uuid.UUID, "AssignmentContext"],
        directory_tree: List[str],
        phase_deadlines: Dict[str, datetime],
        generated_at: datetime,
    ) -> None:
        """Persist generated tasks, assignments, and project metadata into the database."""
        project_id = context.project.project_id
        document_id = context.document.doc_id
        # Remove existing plan-derived tasks and assignments to avoid duplication
        (
            self.db.query(TaskAssignment)
            .filter(TaskAssignment.task_id.in_(
                self.db.query(Task.task_id).filter(Task.project_id == project_id)
            ))
            .delete(synchronize_session=False)
        )
        self.db.query(Task).filter(Task.project_id == project_id).delete(synchronize_session=False)

        created_tasks: Dict[uuid.UUID, Task] = {}
        for task_id, planned in tasks.items():
            db_task = Task(
                task_id=task_id,
                project_id=project_id,
                epic_id=planned.epic_id,
                title=planned.title,
                description=planned.description,
                detail=self._format_task_detail(planned) if planned.detail_generated else None,
                deliverable=planned.deliverable,
                status="TODO",
                priority=self._phase_to_priority(planned.phase),
                due_at=planned.due_at,
                phase=planned.phase,
                estimate_d=planned.estimate_d,
                category=planned.category,
                required_skills=planned.required_skills,
                refs=[ref.model_dump() for ref in planned.refs],
                dependencies=[str(dep) for dep in planned.dependencies],
                parallel_with=[str(peer) for peer in planned.parallel_with],
                detail_generated=planned.detail_generated,
                depends_on_task_id=(planned.dependencies[0] if planned.dependencies else None),
                source_doc_id=document_id,
            )
            self.db.add(db_task)
            created_tasks[task_id] = db_task

        self.db.flush()

        for task_id, assignment in assignments.items():
            db_assignment = TaskAssignment(
                task_assignment_id=uuid.uuid4(),
                task_id=task_id,
                project_member_id=assignment.project_member_id,
                role="owner",
            )
            self.db.add(db_assignment)

        metadata_payload = {
            "generated_at": generated_at.isoformat(),
            "directory_tree": directory_tree,
            "phase_deadlines": {
                phase: deadline.isoformat() for phase, deadline in phase_deadlines.items()
            },
        }
        context.project.plan_metadata = metadata_payload

        self.db.commit()

    def _resolve_phase_deadline(
        self,
        phase: str,
        stored_deadlines: Dict[str, Any],
        tasks_map: Dict[uuid.UUID, PlannedTask],
        fallback: datetime,
    ) -> datetime:
        """Resolve deadline for a phase using stored metadata or task due dates."""
        deadline_raw = stored_deadlines.get(phase) if isinstance(stored_deadlines, dict) else None
        if isinstance(deadline_raw, str):
            try:
                parsed = datetime.fromisoformat(deadline_raw)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                pass

        due_candidates = [task.due_at for task in tasks_map.values() if task.phase == phase]
        if due_candidates:
            candidate = max(due_candidates)
            return candidate if candidate.tzinfo else candidate.replace(tzinfo=timezone.utc)

        deadline = fallback
        return deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)

    def generate_phase_details(
        self, project_id: uuid.UUID, phase: Literal["P0", "P1", "P2"]
    ) -> PhasePlan:
        """Generate detail strings for all tasks in the given phase if not yet prepared."""
        if phase not in PHASES:
            raise ValueError(f"Unknown phase: {phase}")

        context = self._load_context(project_id)
        tasks_map, _ = self._hydrate_planned_from_db(context.project)
        if not tasks_map:
            raise ValueError("No tasks found for project; run plan generation first")

        target_index = PHASES.index(phase)
        for prev_phase in PHASES[:target_index]:
            blockers = [t for t in tasks_map.values() if t.phase == prev_phase and not t.detail_generated]
            if blockers:
                raise ValueError(
                    f"Phase {prev_phase} still has {len(blockers)} tasks without detail; cannot open {phase}."
                )

        updated = False
        for planned in tasks_map.values():
            if planned.phase != phase or planned.detail_generated:
                continue
            detail_text = self._format_task_detail(planned)
            (
                self.db.query(Task)
                .filter(Task.task_id == planned.task_id)
                .update(
                    {
                        "detail": detail_text,
                        "detail_generated": True,
                    },
                    synchronize_session=False,
                )
            )
            planned.detail_generated = True
            planned.detail = detail_text
            updated = True

        if updated:
            self.db.commit()
            # reload to keep relationships fresh
            context = self._load_context(project_id)
            tasks_map, _ = self._hydrate_planned_from_db(context.project)
        else:
            self.db.commit()

        plan_meta = context.project.plan_metadata or {}
        deadline = self._resolve_phase_deadline(
            phase=phase,
            stored_deadlines=plan_meta.get("phase_deadlines", {}) if isinstance(plan_meta, dict) else {},
            tasks_map=tasks_map,
            fallback=context.project.end_date,
        )
        tasks_in_phase = [task for task in tasks_map.values() if task.phase == phase]
        tasks_sorted = sorted(
            tasks_in_phase,
            key=lambda t: (CATEGORY_ORDER.get(t.category, 99), t.title),
        )
        return PhasePlan(phase=phase, deadline=deadline, tasks=tasks_sorted)

    def _format_task_detail(self, planned: PlannedTask) -> str:
        """Build a human-friendly detail payload for task storage."""
        refs_text = "; ".join(f"{ref.label}: {ref.pointer}" for ref in planned.refs)
        return (
            f"Deliverable: {planned.deliverable}\n"
            f"Category: {planned.category}\n"
            f"Estimate(d): {planned.estimate_d}\n"
            f"Phase: {planned.phase}\n"
            f"Dependencies: {[str(dep) for dep in planned.dependencies]}\n"
            f"Parallel: {[str(peer) for peer in planned.parallel_with]}\n"
            f"Required Skills: {', '.join(planned.required_skills)}\n"
            f"References: {refs_text}"
        )

    def _hydrate_planned_from_db(
        self, project: ProjectBase
    ) -> Tuple[Dict[uuid.UUID, PlannedTask], Dict[uuid.UUID, AssignmentSummary]]:
        """Create PlannedTask snapshots and assignment summaries from persisted DB rows."""
        tasks_map: Dict[uuid.UUID, PlannedTask] = {}
        assignments: Dict[uuid.UUID, AssignmentSummary] = {}
        default_due = project.end_date
        if default_due.tzinfo is None:
            default_due = default_due.replace(tzinfo=timezone.utc)

        for db_task in project.tasks:
            refs_raw = db_task.refs or []
            refs: List[TaskReference] = []
            for item in refs_raw:
                if isinstance(item, dict):
                    label = item.get("label", "ref")
                    pointer = item.get("pointer", "")
                    note = item.get("note")
                else:
                    label = "ref"
                    pointer = str(item)
                    note = None
                pointer = pointer or f"generated:{db_task.task_id}"
                refs.append(TaskReference(label=label, pointer=pointer, note=note))

            dependencies_raw = db_task.dependencies or []
            dependencies: List[uuid.UUID] = []
            for dep in dependencies_raw:
                try:
                    dependencies.append(uuid.UUID(str(dep)))
                except Exception:
                    continue

            parallel_raw = db_task.parallel_with or []
            parallel_with: List[uuid.UUID] = []
            for peer in parallel_raw:
                try:
                    parallel_with.append(uuid.UUID(str(peer)))
                except Exception:
                    continue

            due_at = db_task.due_at or default_due
            if due_at.tzinfo is None:
                due_at = due_at.replace(tzinfo=timezone.utc)

            planned = PlannedTask(
                task_id=db_task.task_id,
                epic_id=db_task.epic_id or "unclassified",
                title=db_task.title,
                description=db_task.description or "",
                deliverable=db_task.deliverable or "",
                category=db_task.category or "implementation",
                estimate_d=db_task.estimate_d or 1.0,
                refs=refs if refs else [TaskReference(label="ref", pointer="")],
                required_skills=[skill.lower() for skill in (db_task.required_skills or [])],
                dependencies=dependencies,
                parallel_with=parallel_with,
                phase=db_task.phase or "P0",
                due_at=due_at,
                assignee_project_member_id=None,
                detail_generated=bool(db_task.detail_generated),
                detail=db_task.detail,
            )

            tasks_map[db_task.task_id] = planned

            if db_task.assignees:
                assignment = db_task.assignees[0]
                member_name = ""
                if assignment.project_member is not None:
                    member_name = assignment.project_member.member_name
                planned.assignee_project_member_id = assignment.project_member_id
                assignments[db_task.task_id] = AssignmentSummary(
                    task_id=db_task.task_id,
                    project_member_id=assignment.project_member_id,
                    member_name=member_name,
                )

        return tasks_map, assignments

    def _phase_to_priority(self, phase: str) -> str:
        """Map phase to task priority string."""
        if phase == "P0":
            return "CRITICAL"
        if phase == "P1":
            return "HIGH"
        return "MEDIUM"

    # ------------------------------------------------------------------
    # Assemble final phases
    # ------------------------------------------------------------------
    def _assemble_phase_objects(
        self,
        tasks: Dict[uuid.UUID, PlannedTask],
        phase_map: Dict[uuid.UUID, str],
        deadlines: Dict[str, datetime],
        assignments: Dict[uuid.UUID, "AssignmentContext"],
    ) -> List[PhasePlan]:
        """Collect tasks per phase and produce final response objects."""
        grouped: Dict[str, List[PlannedTask]] = {phase: [] for phase in PHASES}
        for task_id, task in tasks.items():
            grouped[phase_map[task_id]].append(task)

        phase_objects: List[PhasePlan] = []
        for phase in PHASES:
            tasks_sorted = sorted(
                grouped[phase],
                key=lambda t: (CATEGORY_ORDER[t.category], t.title),
            )
            phase_objects.append(
                PhasePlan(
                    phase=phase,
                    deadline=deadlines[phase],
                    tasks=[tasks_sorted_item.copy() for tasks_sorted_item in tasks_sorted],
                )
            )
        return phase_objects


class AssignmentContext(BaseModel):
    project_member_id: uuid.UUID
    member_id: uuid.UUID
    member_name: str
    skills: List[str]
    capacity_per_day: float
    current_load: float = 0.0
