export type DivideTask = {
  task_name: string;
  priority: "Must" | "Should" | "Could";
  content: string;
  // detail は UI には表示せず、API呼び出し結果としてセッションストレージに保存するだけ
  detail?: string;
};

export type Task = {
  task_id: string;
  task_name: string;
  priority: "Must" | "Should" | "Could";
  content: string;
  assignment: string; // "", "done" or participant name
  detail?: string;
  // DnD で扱う際に一意キーとして使うための補助
  __index?: number;
};

export type TaskDetail = {
  tasks: Task[];
};

export type TaskResponse = {
  tasks: Task[];
};

export type DirectoryResponse = {
  directory_structure: string;
};

// Enhanced Task Detail Types
export interface TechnologyReference {
  name: string;
  official_url: string;
  documentation_url: string;
  tutorial_url: string;
  why_needed: string;
  key_concepts: string[];
}

export interface EnhancedTaskDetail {
  task_name: string;
  priority: "Must" | "Should" | "Could";
  content: string;
  detail: string;
  technologies_used: TechnologyReference[];
  learning_resources: string[];
  dependency_explanation: string;
  educational_notes: string;
}

export interface EnhancedTaskBatchResponse {
  tasks: EnhancedTaskDetail[];
  total_processed: number;
  generation_time_seconds: number;
  technologies_found: string[];
}

export interface TaskItem {
  task_name: string;
  priority: "Must" | "Should" | "Could";
  content: string;
  detail?: string;
}

// Project data interface for compatibility with the provided Kanban board component
export interface ProjectData {
  project_id: string;
  title: string;
  idea: string;
  start_date: string;
  end_date: string;
  num_people: number;
  task_info: string[]; // JSON strings of tasks
  menber_info: string[]; // Member names
}
