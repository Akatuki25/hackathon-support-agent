import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Complete task generation request type
 */
export interface CompleteTaskGenerationRequest {
  project_id: string;
}

/**
 * Complete task generation response type
 */
export interface CompleteTaskGenerationResponse {
  success: boolean;
  message: string;
  project_id: string;
  total_tasks: number;
  total_dependencies: number;
  saved_task_ids: string[];
  saved_edge_ids: string[];
  processing_time: number;
  phases_completed: {
    [key: string]: boolean;
  };
  error?: string;
}

/**
 * Task generation preview response type
 */
export interface TaskGenerationPreviewResponse {
  project_id: string;
  project_title: string;
  total_functions: number;
  estimated_tasks: number;
  estimated_categories: string[];
  estimated_dependencies: number;
  ready_for_generation: boolean;
}

/**
 * Clear tasks response type
 */
export interface ClearTasksResponse {
  project_id: string;
  deleted_tasks: number;
  message: string;
}

/**
 * Generate complete task set (includes tasks + dependencies + ReactFlow coordinates)
 *
 * This endpoint performs:
 * 1. Generate tasks from functions
 * 2. Quality evaluation and improvement
 * 3. Generate dependencies
 * 4. Calculate ReactFlow coordinates
 * 5. Save all to database
 *
 * @param projectId - The project ID
 * @returns Complete task generation result
 */
export const generateCompleteTaskSet = async (
  projectId: string
): Promise<CompleteTaskGenerationResponse> => {
  const response = await axios.post<CompleteTaskGenerationResponse>(
    `${API_URL}/api/complete_task_generation/generate_complete`,
    { project_id: projectId }
  );
  return response.data;
};

/**
 * Preview task generation (no database save)
 *
 * Get an overview of what tasks will be generated
 *
 * @param projectId - The project ID
 * @returns Preview information
 */
export const previewTaskGeneration = async (
  projectId: string
): Promise<TaskGenerationPreviewResponse> => {
  const response = await axios.get<TaskGenerationPreviewResponse>(
    `${API_URL}/api/complete_task_generation/preview/${projectId}`
  );
  return response.data;
};

/**
 * Clear generated tasks (for development/debugging)
 *
 * Delete all tasks for a project
 *
 * @param projectId - The project ID
 * @returns Deletion result
 */
export const clearGeneratedTasks = async (
  projectId: string
): Promise<ClearTasksResponse> => {
  const response = await axios.delete<ClearTasksResponse>(
    `${API_URL}/api/complete_task_generation/clear/${projectId}`
  );
  return response.data;
};
