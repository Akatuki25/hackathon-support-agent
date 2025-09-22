import useSWR, { mutate } from 'swr';
import { TaskType, TaskResponseType, TaskPatch, TaskStatusEnum, PriorityEnum } from '@/types/modelTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// --- Fetcher for SWR ---
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

// --- GET All Tasks ---
export const useTasks = () => {
  const { data, error } = useSWR<TaskType[]>(`${API_URL}/tasks`, fetcher);
  return {
    tasks: data,
    isLoading: !error && !data,
    isError: error,
  };
};

// --- GET Task by ID ---
export const useTask = (taskId?: string) => {
  const { data, error } = useSWR<TaskType>(
    taskId ? `${API_URL}/task/${taskId}` : null,
    fetcher
  );
  return {
    task: data,
    isLoading: !error && !data,
    isError: error,
  };
};

// --- GET Tasks by Project ID ---
export const useTasksByProjectId = (projectId?: string) => {
  const { data, error } = useSWR<TaskType[]>(
    projectId ? `${API_URL}/task/project/${projectId}` : null,
    fetcher
  );
  return {
    tasks: data,
    isLoading: !error && !data,
    isError: error,
  };
};

// --- POST Task ---
export const postTask = async (task: TaskType) => {
  const response = await fetch(`${API_URL}/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskResponseType = await response.json();
  mutate(`${API_URL}/tasks`); // Revalidate all tasks
  mutate(`${API_URL}/task/project/${task.project_id}`); // Revalidate tasks by project ID
  return data.task_id;
};

// --- PUT Task ---
export const putTask = async (taskId: string, task: TaskType) => {
  const response = await fetch(`${API_URL}/task/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskResponseType = await response.json();
  mutate(`${API_URL}/tasks`); // Revalidate all tasks
  mutate(`${API_URL}/task/${taskId}`, data, false); // Optimistic update for single task
  mutate(`${API_URL}/task/project/${task.project_id}`); // Revalidate tasks by project ID
  return data.message;
};

// --- PATCH Task ---
export const patchTask = async (taskId: string, taskPatch: TaskPatch) => {
  const response = await fetch(`${API_URL}/task/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskPatch),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskResponseType = await response.json();
  mutate(`${API_URL}/tasks`); // Revalidate all tasks
  mutate(`${API_URL}/task/${taskId}`, data, false); // Optimistic update for single task
  mutate(`${API_URL}/task/project/${data.task_id}`); // Revalidate tasks by project ID (using returned task_id)
  return data.message;
};

// --- DELETE Task ---
export const deleteTask = async (taskId: string) => {
  const response = await fetch(`${API_URL}/task/${taskId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  mutate(`${API_URL}/tasks`); // Revalidate all tasks
  mutate(`${API_URL}/task/${taskId}`, undefined, false); // Remove from cache
  // Note: Revalidating by project ID after delete might require knowing the project_id
  // If not available, a full revalidation of all project-related tasks might be needed
  return { message: 'Deleted successfully' };
};
