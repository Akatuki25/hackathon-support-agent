import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const BASE_URL = API_URL ? `${API_URL}/api/task_hands_on` : undefined;

export type HandsOnGenerationConfig = Record<string, unknown>;

export interface HandsOnGenerationRequest {
  project_id: string;
  config?: HandsOnGenerationConfig;
}

export interface HandsOnGenerationResponse {
  success: boolean;
  job_id: string;
  project_id: string;
  status: string;
  total_tasks: number;
  message: string;
}

export interface HandsOnJobStatusResponse {
  success: boolean;
  job_id: string;
  project_id: string;
  status: string;
  progress: Record<string, unknown>;
  current_processing: Record<string, unknown>[];
  completed_tasks: Record<string, unknown>[];
  error_message?: string | null;
  error_details?: Record<string, unknown> | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface TaskHandsOnResponse<THandsOn = Record<string, unknown>, TMetadata = Record<string, unknown>> {
  success: boolean;
  task_id: string;
  task_title: string;
  has_hands_on: boolean;
  hands_on?: THandsOn | null;
  metadata?: TMetadata | null;
}

export interface DeleteHandsOnResponse {
  success: boolean;
  deleted_count: number;
  message: string;
}

export interface HandsOnPreviewResponse<TPreview = Record<string, unknown>> {
  success: boolean;
  preview_mode?: boolean;
  message: string;
  [key: string]: unknown;
}

const ensureBaseUrl = (): string => {
  if (!BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not defined');
  }
  return BASE_URL;
};

export const startHandsOnGeneration = async (
  request: HandsOnGenerationRequest,
): Promise<HandsOnGenerationResponse> => {
  const baseUrl = ensureBaseUrl();
  const response = await axios.post<HandsOnGenerationResponse>(`${baseUrl}/generate_all`, request);
  return response.data;
};

export const fetchHandsOnJobStatus = async (
  jobId: string,
): Promise<HandsOnJobStatusResponse> => {
  const baseUrl = ensureBaseUrl();
  const response = await axios.get<HandsOnJobStatusResponse>(`${baseUrl}/status/${jobId}`);
  return response.data;
};

export const fetchTaskHandsOn = async <THandsOn = Record<string, unknown>, TMetadata = Record<string, unknown>>(
  taskId: string,
): Promise<TaskHandsOnResponse<THandsOn, TMetadata>> => {
  const baseUrl = ensureBaseUrl();
  const response = await axios.get<TaskHandsOnResponse<THandsOn, TMetadata>>(`${baseUrl}/${taskId}`);
  return response.data;
};

export const deleteProjectHandsOn = async (
  projectId: string,
): Promise<DeleteHandsOnResponse> => {
  const baseUrl = ensureBaseUrl();
  const response = await axios.delete<DeleteHandsOnResponse>(`${baseUrl}/${projectId}`);
  return response.data;
};

export const previewHandsOnGeneration = async <TPreview = Record<string, unknown>>(
  request: HandsOnGenerationRequest,
): Promise<HandsOnPreviewResponse<TPreview>> => {
  const baseUrl = ensureBaseUrl();
  const response = await axios.post<HandsOnPreviewResponse<TPreview>>(`${baseUrl}/preview`, request);
  return response.data;
};
