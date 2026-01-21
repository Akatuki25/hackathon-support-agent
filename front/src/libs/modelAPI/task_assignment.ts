import useSWR, { mutate } from "swr";
import {
  TaskAssignmentType,
  TaskAssignmentResponseType,
  TaskAssignmentPatch,
} from "@/types/modelTypes";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// --- Fetcher for SWR ---
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

// --- GET All Task Assignments ---
export const useTaskAssignments = () => {
  const { data, error } = useSWR<TaskAssignmentType[]>(
    `${API_URL}/task_assignments`,
    fetcher,
  );
  return {
    taskAssignments: data,
    isLoading: !error && !data,
    isError: error,
  };
};

// --- GET Task Assignment by ID ---
export const useTaskAssignment = (taskAssignmentId?: string) => {
  const { data, error } = useSWR<TaskAssignmentType>(
    taskAssignmentId ? `${API_URL}/task_assignment/${taskAssignmentId}` : null,
    fetcher,
  );
  return {
    taskAssignment: data,
    isLoading: !error && !data,
    isError: error,
  };
};

// --- GET Task Assignments by Task ID ---
export const useTaskAssignmentsByTaskId = (taskId?: string) => {
  const { data, error } = useSWR<TaskAssignmentType[]>(
    taskId ? `${API_URL}/task_assignment/task/${taskId}` : null,
    fetcher,
  );
  return {
    taskAssignments: data,
    isLoading: !error && !data,
    isError: error,
  };
};

// --- GET Task Assignments by Project Member ID ---
export const useTaskAssignmentsByProjectMemberId = (
  projectMemberId?: string,
) => {
  const { data, error } = useSWR<TaskAssignmentType[]>(
    projectMemberId
      ? `${API_URL}/task_assignment/project_member/${projectMemberId}`
      : null,
    fetcher,
  );
  return {
    taskAssignments: data,
    isLoading: !error && !data,
    isError: error,
  };
};

// --- POST Task Assignment ---
export const postTaskAssignment = async (
  taskAssignment: TaskAssignmentType,
) => {
  const response = await fetch(`${API_URL}/task_assignment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(taskAssignment),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskAssignmentResponseType = await response.json();
  mutate(`${API_URL}/task_assignments`); // Revalidate all task assignments
  mutate(`${API_URL}/task_assignment/task/${taskAssignment.task_id}`); // Revalidate by task ID
  mutate(
    `${API_URL}/task_assignment/project_member/${taskAssignment.project_member_id}`,
  ); // Revalidate by project member ID
  return data.task_assignment_id;
};

// --- PUT Task Assignment ---
export const putTaskAssignment = async (
  taskAssignmentId: string,
  taskAssignment: TaskAssignmentType,
) => {
  const response = await fetch(
    `${API_URL}/task_assignment/${taskAssignmentId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskAssignment),
    },
  );

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskAssignmentResponseType = await response.json();
  mutate(`${API_URL}/task_assignments`); // Revalidate all task assignments
  mutate(`${API_URL}/task_assignment/${taskAssignmentId}`, data, false); // Optimistic update for single item
  mutate(`${API_URL}/task_assignment/task/${taskAssignment.task_id}`); // Revalidate by task ID
  mutate(
    `${API_URL}/task_assignment/project_member/${taskAssignment.project_member_id}`,
  ); // Revalidate by project member ID
  return data.message;
};

// --- PATCH Task Assignment ---
export const patchTaskAssignment = async (
  taskAssignmentId: string,
  taskAssignmentPatch: TaskAssignmentPatch,
) => {
  const response = await fetch(
    `${API_URL}/task_assignment/${taskAssignmentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskAssignmentPatch),
    },
  );

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data: TaskAssignmentResponseType = await response.json();
  mutate(`${API_URL}/task_assignments`); // Revalidate all task assignments
  mutate(`${API_URL}/task_assignment/${taskAssignmentId}`, data, false); // Optimistic update for single item
  mutate(`${API_URL}/task_assignment/task/${data.task_assignment_id}`); // Revalidate by task ID (using returned task_assignment_id)
  mutate(
    `${API_URL}/task_assignment/project_member/${data.task_assignment_id}`,
  ); // Revalidate by project member ID (using returned task_assignment_id)
  return data.message;
};

// --- DELETE Task Assignment ---
export const deleteTaskAssignment = async (taskAssignmentId: string) => {
  const response = await fetch(
    `${API_URL}/task_assignment/${taskAssignmentId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  mutate(`${API_URL}/task_assignments`); // Revalidate all task assignments
  mutate(`${API_URL}/task_assignment/${taskAssignmentId}`, undefined, false); // Remove from cache
  // Note: Revalidating by task ID and project member ID after delete might require knowing them
  return { message: "Deleted successfully" };
};
