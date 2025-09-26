export type PhaseKey = "P0" | "P1" | "P2";

export type TaskReference = {
  label: string;
  pointer: string;
  note?: string | null;
};

export type PlannedTask = {
  task_id: string;
  epic_id: string;
  title: string;
  description: string;
  deliverable: string;
  category: string;
  estimate_d: number;
  refs: TaskReference[];
  required_skills: string[];
  dependencies: string[];
  parallel_with: string[];
  phase: PhaseKey;
  due_at: string;
  assignee_project_member_id?: string | null;
  detail_generated: boolean;
  detail?: string | null;
};

export type PhasePlan = {
  phase: PhaseKey;
  deadline: string;
  tasks: PlannedTask[];
};

export type AssignmentSummary = {
  task_id: string;
  project_member_id: string;
  member_name: string;
};

export type PlanMember = {
  project_member_id: string;
  member_id: string;
  member_name: string;
  skills: string[];
  capacity_per_day: number;
};

export type PlanResult = {
  project_id: string;
  generated_at: string;
  directory_tree: string[];
  phases: PhasePlan[];
  assignments: AssignmentSummary[];
  members: PlanMember[];
};
