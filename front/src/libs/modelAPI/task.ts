import useSWR, { mutate } from 'swr';
import { TaskType, TaskResponseType, TaskPatch } from '@/types/modelTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TASKS_URL = API_URL ? `${API_URL}/tasks` : undefined;
const TASK_URL = API_URL ? `${API_URL}/task` : undefined;

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
  const { task_id, ...payload } = task;
  return payload;
};

const normalizeTaskPatchPayload = (taskPatch: TaskPatch) => {
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
  const mutations: Array<Promise<any>> = [];
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
  const { data, error } = useSWR<TaskType[]>(key, fetcher);
  return {
    tasks: data,
    isLoading: !!key && !error && !data,
    isError: error,
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
