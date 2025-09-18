// UUIDs should be string in TypeScript for consistency with FastAPI
// All types are based on FastAPI Pydantic models in back/models/project_base.py and back/routers/project/*.py

// --- Member Types ---
export type MemberType = {
  member_name: string;
  member_skill: string;
  github_name: string;
  email?: string; // Optional as per FastAPI model
};

export type MemberResponseType = {
  member_id: string; // UUID from FastAPI is string
  message: string;
};

export type MemberPatch = Partial<MemberType>; // All fields optional for PATCH

// --- Project Types ---
export type ProjectType = {
  project_id?: string; // UUID from FastAPI is string
  title: string;
  idea: string;
  start_date: string; // date from FastAPI is string (YYYY-MM-DD)
  end_date: string; // datetime from FastAPI is string (ISO 8601)
  num_people: number;
};

export type ProjectResponseType = {
  project_id: string;
  message: string;
};

export type ProjectPatch = Partial<ProjectType>; // All fields optional for PATCH

// --- ProjectDocument Types ---
export type ProjectDocumentType = {
  doc_id?: string; // UUID from FastAPI is string
  project_id: string; // UUID from FastAPI is string
  specification: string;
  function_doc: string;
  frame_work_doc: string;
  directory_info: string;
};

export type ProjectDocumentResponseType = {
  project_id: string; // For create response
  message: string;
};

export type ProjectDocumentPatch = Partial<ProjectDocumentType>; // All fields optional for PATCH

// --- ProjectMember Types ---
export type ProjectMemberType = {
  project_member_id?: string; // UUID from FastAPI is string
  project_id: string; // UUID from FastAPI is string
  member_id: string; // UUID from FastAPI is string
  member_name: string;
};

export type ProjectMemberResponseType = {
  project_member_id: string;
  message: string;
};

export type ProjectMemberPatch = Partial<ProjectMemberType>; // All fields optional for PATCH

// --- Env Types ---
export type EnvType = {
  env_id?: string; // UUID from FastAPI is string
  project_id: string; // UUID from FastAPI is string
  front?: string;
  backend?: string;
  devcontainer?: string;
  database?: string;
  deploy?: string;
};

export type EnvResponseType = {
  env_id: string;
  message: string;
};

export type EnvPatch = Partial<EnvType>; // All fields optional for PATCH

// --- Task Types ---
export type TaskStatusEnum = "TODO" | "DOING" | "DONE";
export type PriorityEnum = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TaskType = {
  task_id?: string; // UUID from FastAPI is string
  project_id: string; // UUID from FastAPI is string
  title: string;
  description?: string;
  detail?: string;
  status?: TaskStatusEnum;
  priority?: PriorityEnum;
  due_at?: string; // datetime from FastAPI is string (ISO 8601)
  depends_on_task_id?: string; // UUID from FastAPI is string
  source_doc_id?: string; // UUID from FastAPI is string
};

export type TaskResponseType = {
  task_id: string;
  message: string;
};

export type TaskPatch = Partial<TaskType>; // All fields optional for PATCH

// --- TaskAssignment Types ---
export type TaskAssignmentType = {
  task_assignment_id?: string; // UUID from FastAPI is string
  task_id: string; // UUID from FastAPI is string
  project_member_id: string; // UUID from FastAPI is string
  role?: string;
};

export type TaskAssignmentResponseType = {
  task_assignment_id: string;
  message: string;
};

export type TaskAssignmentPatch = Partial<TaskAssignmentType>; // All fields optional for PATCH

// --- QA Types ---
export interface QAType {
  qa_id: string;
  project_id: string;
  question: string;
  answer?: string | null;
  is_ai: boolean;
  source_doc_id?: string | null;
  follows_qa_id?: string | null;
  importance: number;
  created_at?: string;
}

export interface QAPatch {
  project_id?: string;
  question?: string;
  answer?: string | null;
  is_ai?: boolean;
  source_doc_id?: string | null;
  follows_qa_id?: string | null;
  importance?: number;
}

export interface QAResponseType {
  qa_id: string;
  message: string;
}

/**
 * AIによるQ&A生成API (`POST /qas/{project_id}`) のリクエストボディ
 */
export interface IdeaPromptType {
  Prompt: string;
}

/**
 * AIによるQ&A生成API (`POST /qas/{project_id}`) のレスポンス
 */
export interface QuestionResponseType {
    QA: QAType[];
}

// --- Summary Types ---
export interface SummaryQaItem {
  Question: string;
  Answer: string;
}

export interface SummaryRequest {
  Answer: SummaryQaItem[];
}

export interface SummaryResponse {
  summary: string;
}

// --- Evaluation Types ---
export type MVPJudge = {
  mvp_feasible: boolean;
  score_0_100: number; // 0〜100 の範囲 (ランタイムでチェック推奨)
  confidence: number;  // 0.0〜1.0 の範囲 (ランタイムでチェック推奨)
  qa: QAType[];
};

export type ConfidenceFeedback = {
  overall_confidence: number; // 0.0-1.0
  clarity_score: number; // 0.0-1.0
  feasibility_score: number; // 0.0-1.0
  scope_score: number; // 0.0-1.0
  value_score: number; // 0.0-1.0
  completeness_score: number; // 0.0-1.0
  clarity_feedback: string;
  feasibility_feedback: string;
  scope_feedback: string;
  value_feedback: string;
  completeness_feedback: string;
  improvement_suggestions: string[];
  confidence_reason: string;
};