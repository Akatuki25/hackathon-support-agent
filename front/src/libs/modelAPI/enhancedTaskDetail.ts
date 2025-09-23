import useSWR, { mutate } from 'swr';
import { EnhancedTaskDetail, EnhancedTaskBatchResponse, TaskItem } from '@/types/taskTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Fetcher for SWR
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

// Request interfaces
export interface EnhancedTaskDetailRequest {
  tasks: TaskItem[];
  specification: string;
  framework_doc?: string;
  directory_info?: string;
  function_doc?: string;
}

export interface ProjectDocumentTaskRequest {
  project_id: string;
  tasks: TaskItem[];
}

// SWR Hooks for enhanced task details

/**
 * Get supported technologies
 */
export const useSupportedTechnologies = () => {
  const { data, error } = useSWR<{
    supported_technologies: string[];
    categories: Record<string, string[]>;
  }>(`${API_URL}/api/taskDetail/technologies`, fetcher);

  return {
    technologies: data,
    isLoading: !error && !data,
    isError: error,
  };
};

/**
 * Health check for enhanced task detail service
 */
export const useTaskDetailServiceHealth = () => {
  const { data, error } = useSWR<{
    status: string;
    service: string;
  }>(`${API_URL}/api/taskDetail/health`, fetcher);

  return {
    health: data,
    isLoading: !error && !data,
    isError: error,
  };
};

// API Functions

/**
 * Generate enhanced task details with AI search and RAG
 */
export const postEnhancedTaskDetails = async (
  request: EnhancedTaskDetailRequest
): Promise<EnhancedTaskBatchResponse> => {
  const response = await fetch(`${API_URL}/api/taskDetail/enhanced`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status} ${response.statusText}`);
  }

  const data: EnhancedTaskBatchResponse = await response.json();

  // Invalidate related cache
  mutate(`${API_URL}/api/taskDetail/health`);

  return data;
};

/**
 * Generate task details from ProjectDocument
 */
export const postTaskDetailsFromProjectDocument = async (
  request: ProjectDocumentTaskRequest
): Promise<EnhancedTaskBatchResponse> => {
  const response = await fetch(`${API_URL}/api/taskDetail/from-project-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status} ${response.statusText}`);
  }

  const data: EnhancedTaskBatchResponse = await response.json();

  // Invalidate related cache
  mutate(`${API_URL}/api/taskDetail/health`);

  return data;
};

/**
 * Legacy task detail generation (backward compatibility)
 */
export const postTaskDetails = async (
  tasks: TaskItem[],
  specification: string
): Promise<{ tasks: any[] }> => {
  const response = await fetch(`${API_URL}/api/taskDetail/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks, specification }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// Utility functions for task processing

/**
 * Sort enhanced tasks by priority
 */
export const sortTasksByPriority = (tasks: EnhancedTaskDetail[]): EnhancedTaskDetail[] => {
  const priorityOrder = { 'Must': 3, 'Should': 2, 'Could': 1 };
  return [...tasks].sort((a, b) => {
    const aPriority = priorityOrder[a.priority] || 0;
    const bPriority = priorityOrder[b.priority] || 0;
    return bPriority - aPriority;
  });
};

/**
 * Group tasks by technology
 */
export const groupTasksByTechnology = (tasks: EnhancedTaskDetail[]): Record<string, EnhancedTaskDetail[]> => {
  const groups: Record<string, EnhancedTaskDetail[]> = {};

  tasks.forEach(task => {
    task.technologies_used.forEach(tech => {
      if (!groups[tech.name]) {
        groups[tech.name] = [];
      }
      groups[tech.name].push(task);
    });
  });

  return groups;
};

/**
 * Extract unique technologies from tasks
 */
export const extractTechnologies = (tasks: EnhancedTaskDetail[]): string[] => {
  const techSet = new Set<string>();
  tasks.forEach(task => {
    task.technologies_used.forEach(tech => {
      techSet.add(tech.name);
    });
  });
  return Array.from(techSet);
};

/**
 * Calculate task completion score based on detail length and resources
 */
export const calculateTaskCompletionScore = (task: EnhancedTaskDetail): number => {
  let score = 0;

  // Detail length (max 30 points)
  score += Math.min(task.detail.length / 100, 30);

  // Number of technologies (max 20 points)
  score += Math.min(task.technologies_used.length * 5, 20);

  // Number of learning resources (max 25 points)
  score += Math.min(task.learning_resources.length * 2.5, 25);

  // Educational notes presence (max 15 points)
  score += task.educational_notes.length > 0 ? 15 : 0;

  // Dependency explanation presence (max 10 points)
  score += task.dependency_explanation.length > 0 ? 10 : 0;

  return Math.round(score);
};

/**
 * Validate enhanced task detail structure
 */
export const validateEnhancedTaskDetail = (task: any): task is EnhancedTaskDetail => {
  return (
    typeof task === 'object' &&
    typeof task.task_name === 'string' &&
    typeof task.priority === 'string' &&
    ['Must', 'Should', 'Could'].includes(task.priority) &&
    typeof task.content === 'string' &&
    typeof task.detail === 'string' &&
    Array.isArray(task.technologies_used) &&
    Array.isArray(task.learning_resources) &&
    typeof task.dependency_explanation === 'string' &&
    typeof task.educational_notes === 'string'
  );
};