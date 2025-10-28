import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * 非同期タスク生成リクエスト
 */
export interface AsyncTaskGenerationRequest {
  project_id: string;
}

/**
 * 非同期タスク生成レスポンス
 */
export interface AsyncTaskGenerationResponse {
  success: boolean;
  job_id: string;
  project_id: string;
  status: string;
  message: string;
}

/**
 * ジョブステータスレスポンス
 */
export interface JobStatusResponse {
  success: boolean;
  job_id: string;
  project_id: string;
  status: string;  // 'queued' | 'processing' | 'completed' | 'failed'
  progress: {
    percentage: number;
    current_phase: number;
    total_phases: number;
  };
  total_tasks: number;
  completed_phases: number;
  total_phases: number;
  error_message?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * 非同期タスク生成を開始
 */
export const startTaskGenerationAsync = async (
  projectId: string
): Promise<AsyncTaskGenerationResponse> => {
  const response = await axios.post<AsyncTaskGenerationResponse>(
    `${API_URL}/api/complete_task_generation/generate_async`,
    { project_id: projectId }
  );
  return response.data;
};

/**
 * ジョブステータスを取得
 */
export const getJobStatus = async (
  jobId: string
): Promise<JobStatusResponse> => {
  const response = await axios.get<JobStatusResponse>(
    `${API_URL}/api/complete_task_generation/job_status/${jobId}`
  );
  return response.data;
};

/**
 * ジョブ完了を待機（ポーリング）
 *
 * @param jobId ジョブID
 * @param onProgress 進捗更新コールバック
 * @param pollingInterval ポーリング間隔（ミリ秒）
 * @returns 完了時のジョブステータス
 */
export const waitForJobCompletion = async (
  jobId: string,
  onProgress?: (status: JobStatusResponse) => void,
  pollingInterval: number = 3000
): Promise<JobStatusResponse> => {
  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const status = await getJobStatus(jobId);

        // 進捗コールバック
        if (onProgress) {
          onProgress(status);
        }

        // 完了チェック
        if (status.status === 'completed') {
          resolve(status);
        } else if (status.status === 'failed') {
          reject(new Error(status.error_message || 'Task generation failed'));
        } else {
          // 継続してポーリング
          setTimeout(checkStatus, pollingInterval);
        }
      } catch (error) {
        reject(error);
      }
    };

    checkStatus();
  });
};
