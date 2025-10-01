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
