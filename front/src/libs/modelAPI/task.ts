import useSWR, { mutate } from 'swr';
import {
  TaskType,
  TaskResponseType,
  TaskPatch,
  TaskDependencyType,
  TaskAssignmentType,
  TaskAssignmentResponseType,
  TaskAssignmentPatch
} from '@/types/modelTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TASKS_URL = API_URL ? `${API_URL}/tasks` : undefined;
const TASK_URL = API_URL ? `${API_URL}/task` : undefined;
const TASK_DEPENDENCY_URL = API_URL ? `${API_URL}/api/task_dependencies` : undefined;
const TASK_ASSIGNMENT_URL = API_URL ? `${API_URL}/task_assignment` : undefined;

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const ensureApiUrl = (): string => {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not defined');
  }
  return API_URL;
};

const normalizeTaskPayload = (task: TaskType) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { task_id, ...payload } = task;
  return payload;
};

const normalizeTaskPatchPayload = (taskPatch: TaskPatch) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { task_id, ...payload } = taskPatch;
  return payload;
};

const ensureRequiredTaskFields = (task: TaskType) => {
  if (!task.project_id) {
    throw new Error('project_id is required to create or update a task');
  }
  if (!task.title) {
    throw new Error('title is required to create or update a task');
  }
};

const invalidateTaskCache = async ({
  taskId,
  projectId,
}: {
  taskId?: string;
  projectId?: string;
} = {}) => {
  const mutations: Array<Promise<unknown>> = [];
  if (TASKS_URL) {
    mutations.push(mutate(TASKS_URL));
  }
  if (TASK_URL && taskId) {
    mutations.push(mutate(`${TASK_URL}/${taskId}`));
  }
  if (TASK_URL && projectId) {
    mutations.push(mutate(`${TASK_URL}/project/${projectId}`));
  }
  await Promise.all(mutations);
};

export const useTasks = () => {
  const key = TASKS_URL ?? null;
  const { data, error } = useSWR<TaskType[]>(key, fetcher);
  return {
    tasks: data,
    isLoading: !!key && !error && !data,
    isError: error,
  };
};

export const useTask = (taskId?: string) => {
  const key = taskId && TASK_URL ? `${TASK_URL}/${taskId}` : null;
  const { data, error } = useSWR<TaskType>(key, fetcher);
  return {
    task: data,
    isLoading: !!key && !error && !data,
    isError: error,
  };
};

export const useTasksByProjectId = (projectId?: string) => {
  const key = projectId && TASK_URL ? `${TASK_URL}/project/${projectId}` : null;

  // デバッグ用ログ
  console.log("🔗 useTasksByProjectId - API URL:", key);
  console.log("🔗 projectId:", projectId);
  console.log("🔗 TASK_URL:", TASK_URL);

  const { data, error, mutate } = useSWR<TaskType[]>(key, fetcher);
  return {
    tasks: data,
    isLoading: !!key && !error && !data,
    isError: error,
    mutate,
  };
};

export const postTask = async (task: TaskType): Promise<TaskResponseType> => {
  const baseUrl = ensureApiUrl();
  ensureRequiredTaskFields(task);

  const response = await fetch(`${baseUrl}/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeTaskPayload(task)),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskResponseType = await response.json();
  await invalidateTaskCache({ taskId: data.task_id, projectId: task.project_id });
  return data;
};

export const putTask = async (taskId: string, task: TaskType): Promise<TaskResponseType> => {
  const baseUrl = ensureApiUrl();
  ensureRequiredTaskFields(task);

  const response = await fetch(`${baseUrl}/task/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeTaskPayload(task)),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskResponseType = await response.json();
  await invalidateTaskCache({ taskId, projectId: task.project_id });
  return data;
};

export const patchTask = async (taskId: string, taskPatch: TaskPatch): Promise<TaskResponseType> => {
  const baseUrl = ensureApiUrl();

  const response = await fetch(`${baseUrl}/task/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeTaskPatchPayload(taskPatch)),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskResponseType = await response.json();
  const projectId = taskPatch.project_id ?? undefined;
  await invalidateTaskCache({ taskId, projectId });
  return data;
};

export const deleteTask = async (taskId: string, projectId?: string): Promise<TaskResponseType> => {
  const baseUrl = ensureApiUrl();

  const response = await fetch(`${baseUrl}/task/${taskId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskResponseType = await response.json();
  await invalidateTaskCache({ taskId, projectId });
  return data;
};

// ============================================================================
// TaskDependency API Functions
// ============================================================================

/**
 * Get all task dependencies for a specific task
 * @param taskId - The task ID to get dependencies for
 * @returns Array of task dependencies
 */
export const useTaskDependencies = (taskId?: string) => {
  const key = taskId && TASK_DEPENDENCY_URL ? `${TASK_DEPENDENCY_URL}/${taskId}` : null;
  const { data, error } = useSWR<TaskDependencyType[]>(key, fetcher);
  return {
    dependencies: data,
    isLoading: !!key && !error && !data,
    isError: error,
  };
};

/**
 * Get all task dependencies for a project
 * @param projectId - The project ID to get dependencies for
 * @returns Array of task dependencies
 */
export const useTaskDependenciesByProject = (projectId?: string) => {
  const key = projectId && TASK_DEPENDENCY_URL ? `${TASK_DEPENDENCY_URL}/project/${projectId}` : null;
  const { data, error } = useSWR<TaskDependencyType[]>(key, fetcher);
  return {
    dependencies: data,
    isLoading: !!key && !error && !data,
    isError: error,
  };
};

// ============================================================================
// TaskAssignment API Functions
// ============================================================================

/**
 * Get all task assignments
 * @returns Array of all task assignments
 */
export const useTaskAssignments = () => {
  const key = TASK_ASSIGNMENT_URL ? `${TASK_ASSIGNMENT_URL}s` : null;
  const { data, error } = useSWR<TaskAssignmentType[]>(key, fetcher);
  return {
    assignments: data,
    isLoading: !!key && !error && !data,
    isError: error,
  };
};

/**
 * Get a specific task assignment by ID
 * @param assignmentId - The task assignment ID
 * @returns Task assignment
 */
export const useTaskAssignment = (assignmentId?: string) => {
  const key = assignmentId && TASK_ASSIGNMENT_URL ? `${TASK_ASSIGNMENT_URL}/${assignmentId}` : null;
  const { data, error } = useSWR<TaskAssignmentType>(key, fetcher);
  return {
    assignment: data,
    isLoading: !!key && !error && !data,
    isError: error,
  };
};

/**
 * Get all task assignments for a specific task
 * @param taskId - The task ID
 * @returns Array of task assignments
 */
export const useTaskAssignmentsByTaskId = (taskId?: string) => {
  const key = taskId && TASK_ASSIGNMENT_URL ? `${TASK_ASSIGNMENT_URL}/task/${taskId}` : null;
  const { data, error } = useSWR<TaskAssignmentType[]>(key, fetcher);
  return {
    assignments: data,
    isLoading: !!key && !error && !data,
    isError: error,
  };
};

/**
 * Get all task assignments for a specific project member
 * @param projectMemberId - The project member ID
 * @returns Array of task assignments
 */
export const useTaskAssignmentsByProjectMemberId = (projectMemberId?: string) => {
  const key = projectMemberId && TASK_ASSIGNMENT_URL ? `${TASK_ASSIGNMENT_URL}/project_member/${projectMemberId}` : null;
  const { data, error } = useSWR<TaskAssignmentType[]>(key, fetcher);
  return {
    assignments: data,
    isLoading: !!key && !error && !data,
    isError: error,
  };
};

/**
 * Create a new task assignment
 * @param assignment - Task assignment data
 * @returns Task assignment response with ID
 */
export const postTaskAssignment = async (assignment: TaskAssignmentType): Promise<TaskAssignmentResponseType> => {
  const baseUrl = ensureApiUrl();

  const response = await fetch(`${baseUrl}/task_assignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: assignment.task_id,
      project_member_id: assignment.project_member_id,
      role: assignment.role,
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskAssignmentResponseType = await response.json();

  // Invalidate cache for this task's assignments
  if (TASK_ASSIGNMENT_URL) {
    await mutate(`${TASK_ASSIGNMENT_URL}/task/${assignment.task_id}`);
    await mutate(`${TASK_ASSIGNMENT_URL}s`); // All assignments
  }

  return data;
};

/**
 * Update a task assignment (full update)
 * @param assignmentId - The task assignment ID
 * @param assignment - Task assignment data
 * @returns Task assignment response
 */
export const putTaskAssignment = async (
  assignmentId: string,
  assignment: TaskAssignmentType
): Promise<TaskAssignmentResponseType> => {
  const baseUrl = ensureApiUrl();

  const response = await fetch(`${baseUrl}/task_assignment/${assignmentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: assignment.task_id,
      project_member_id: assignment.project_member_id,
      role: assignment.role,
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskAssignmentResponseType = await response.json();

  // Invalidate cache
  if (TASK_ASSIGNMENT_URL) {
    await mutate(`${TASK_ASSIGNMENT_URL}/${assignmentId}`);
    await mutate(`${TASK_ASSIGNMENT_URL}/task/${assignment.task_id}`);
    await mutate(`${TASK_ASSIGNMENT_URL}s`);
  }

  return data;
};

/**
 * Partially update a task assignment
 * @param assignmentId - The task assignment ID
 * @param assignmentPatch - Partial task assignment data
 * @returns Success message
 */
export const patchTaskAssignment = async (
  assignmentId: string,
  assignmentPatch: TaskAssignmentPatch
): Promise<{ message: string }> => {
  const baseUrl = ensureApiUrl();

  const response = await fetch(`${baseUrl}/task_assignment/${assignmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignmentPatch),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: { message: string } = await response.json();

  // Invalidate cache
  if (TASK_ASSIGNMENT_URL) {
    await mutate(`${TASK_ASSIGNMENT_URL}/${assignmentId}`);
    if (assignmentPatch.task_id) {
      await mutate(`${TASK_ASSIGNMENT_URL}/task/${assignmentPatch.task_id}`);
    }
    await mutate(`${TASK_ASSIGNMENT_URL}s`);
  }

  return data;
};

/**
 * Delete a task assignment
 * @param assignmentId - The task assignment ID
 * @param taskId - Optional task ID to invalidate cache
 * @returns Task assignment response
 */
export const deleteTaskAssignment = async (
  assignmentId: string,
  taskId?: string
): Promise<TaskAssignmentResponseType> => {
  const baseUrl = ensureApiUrl();

  const response = await fetch(`${baseUrl}/task_assignment/${assignmentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskAssignmentResponseType = await response.json();

  // Invalidate cache
  if (TASK_ASSIGNMENT_URL) {
    await mutate(`${TASK_ASSIGNMENT_URL}/${assignmentId}`);
    if (taskId) {
      await mutate(`${TASK_ASSIGNMENT_URL}/task/${taskId}`);
    }
    await mutate(`${TASK_ASSIGNMENT_URL}s`);
  }

  return data;
};
