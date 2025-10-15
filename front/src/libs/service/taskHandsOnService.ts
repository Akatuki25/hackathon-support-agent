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

export interface HandsOnJobStatusProgress {
  total_tasks: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
}

export interface HandsOnProcessingTask {
  task_id: string;
  task_title: string;
}

export interface HandsOnCompletedTask {
  task_id: string;
  task_title: string;
  quality_score: number | null;
  completed_at: string | null;
}

export interface HandsOnJobStatusResponse {
  success: boolean;
  job_id: string;
  project_id: string;
  status: string;
  progress: HandsOnJobStatusProgress;
  current_processing: HandsOnProcessingTask[];
  completed_tasks: HandsOnCompletedTask[];
  error_message?: string | null;
  error_details?: Record<string, unknown> | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface HandsOnTargetFile {
  path: string;
  description: string;
  action: string;
}

export interface HandsOnCodeExample {
  file: string;
  language: string;
  code: string;
  explanation?: string;
}

export interface HandsOnCommonError {
  error: string;
  cause: string;
  solution: string;
}

export interface HandsOnImplementationTip {
  type: 'best_practice' | 'anti_pattern';
  tip: string;
  reason: string;
}

export interface HandsOnReference {
  title: string;
  url: string;
  type?: string;
}

export interface HandsOnContent {
  hands_on_id: string;
  overview: string | null;
  prerequisites: string | null;
  target_files: HandsOnTargetFile[] | null;
  implementation_steps: string | null;
  code_examples: HandsOnCodeExample[] | null;
  verification: string | null;
  common_errors: HandsOnCommonError[] | null;
  references: HandsOnReference[] | null;
  technical_context: string | null;
  implementation_tips: HandsOnImplementationTip[] | null;
}

export interface HandsOnMetadata {
  generated_at: string | null;
  quality_score: number | null;
  generation_model: string | null;
  information_freshness: string | null;
  search_queries: string[] | null;
  referenced_urls: string[] | null;
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

export interface HandsOnPreviewResponse {
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

export const fetchTaskHandsOn = async <THandsOn = HandsOnContent, TMetadata = HandsOnMetadata>(
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

export const previewHandsOnGeneration = async (
  request: HandsOnGenerationRequest,
): Promise<HandsOnPreviewResponse> => {
  const baseUrl = ensureBaseUrl();
  const response = await axios.post<HandsOnPreviewResponse>(`${baseUrl}/preview`, request);
  return response.data;
};
