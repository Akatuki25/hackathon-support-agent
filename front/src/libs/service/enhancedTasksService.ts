import axios from 'axios';
import useSWR from 'swr';
import type { EnhancedTaskDetail } from './enhancedTaskDetailService';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */

export interface TaskGenerationRequest {
  hackathon_mode?: boolean;
  use_parallel_processing?: boolean;
  use_full_workflow?: boolean;
}

export interface TaskGenerationResponse {
  success: boolean;
  message: string;
  tasks_count: number;
  dependencies_count: number;
  critical_path_length: number;
  confidence_score?: number;
  priority_distribution: Record<string, number>;
  generation_metadata: Record<string, unknown>;
  topological_order?: string[];
  parallel_groups?: string[][];
  educational_summary?: Record<string, unknown>;
}

export interface GeneratedTaskSnapshot {
  task_name: string;
  category?: string;
  description?: string;
  estimated_hours?: number;
  complexity_level?: number;
  business_value_score?: number;
  technical_risk_score?: number;
  implementation_difficulty?: number;
  user_impact_score?: number;
  dependency_weight?: number;
  moscow_priority?: string;
  mvp_critical?: boolean;
  db_task_id?: string;
  educational_detail?: EnhancedTaskDetail | Record<string, unknown> | string;
  learning_resources?: string[];
  technology_stack?: Array<string | Record<string, unknown>>;
  reference_links?: string[];
}

export interface Stage1Result {
  tasks: GeneratedTaskSnapshot[];
  db_task_ids: Record<number, string>;
  priority_distribution: Record<string, number>;
  stage: string;
}

export interface DirectoryPlanPayload {
  directory_tree: Record<string, unknown> | null;
  task_directory_mapping: Record<string, unknown>;
}

export interface Stage2Result extends Stage1Result {
  directory_plan?: DirectoryPlanPayload;
}

export type Stage3Result = Stage2Result;

export interface Stage4Result extends Stage3Result {
  dependency_analysis?: Record<string, unknown>;
  topological_order?: Record<string, unknown>;
}

export interface Stage5Result extends Stage4Result {
  timeline?: Record<string, unknown>;
  project_dates?: Record<string, unknown>;
}

export interface StageExecutionResponse<TStageData = Record<string, unknown>> {
  success: boolean;
  stage: string;
  data: TStageData;
}

export interface GraphAnalysisResponse {
  success: boolean;
  stage: string;
  dependency_analysis: Record<string, unknown>;
  topological_order: Record<string, unknown>;
  reactflow: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface LLMUsageMetrics {
  calls?: number;
  tokens?: number;
  last_called_at?: string;
  [key: string]: unknown;
}

export interface LLMUsageResponse {
  success: boolean;
  project_id: string;
  llm_usage: Record<string, LLMUsageMetrics>;
}

export interface Task {
  task_id: string;
  project_id: string;
  title: string;
  description?: string;
  detail?: string;
  status: string;
  priority: string;

  // Timeline fields
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  due_at?: string;

  // Task ordering fields
  topological_order?: number;
  execution_phase?: string;
  parallel_group_id?: string;
  critical_path: boolean;

  // Management fields
  category?: string;
  estimated_hours?: number;
  complexity_level?: number;
  business_value_score?: number;
  technical_risk_score?: number;
  implementation_difficulty?: number;
  user_impact_score?: number;
  dependency_weight?: number;
  moscow_priority?: string;
  mvp_critical: boolean;

  // Progress fields
  progress_percentage: number;
  blocking_reason?: string;
  completion_criteria?: string;

  // Educational fields
  learning_resources?: string[];
  technology_stack?: Array<string | Record<string, unknown>>;
  reference_links?: string[];

  // Metadata
  created_at: string;
  updated_at: string;
  source_doc_id?: string;
}

export interface TaskListResponse {
  success: boolean;
  message: string;
  tasks: Task[];
  total_count: number;
}

export interface TaskStatistics {
  total_tasks: number;
  tasks_by_status: Record<string, number>;
  tasks_by_priority: Record<string, number>;
  tasks_by_category: Record<string, number>;
  tasks_by_moscow: Record<string, number>;
  mvp_critical_count: number;
  critical_path_count: number;
  average_complexity?: number;
  average_business_value?: number;
  total_estimated_hours?: number;
  completion_percentage: number;
}

export interface TaskQualityAnalysisResponse {
  success: boolean;
  message: string;
  task_distribution: Record<string, unknown>;
  dependency_analysis: Record<string, unknown>;
  quality_indicators: Record<string, unknown>;
  recommendations: string[];
}

export interface TaskDependencyResponse {
  success: boolean;
  message: string;
  project_id: string;
  total_tasks: number;
  total_dependencies: number;
  dependencies: any[];
  topological_info?: any;
  critical_path_info?: any;
}

export interface TaskTimelineResponse {
  success: boolean;
  message: string;
  project_id: string;
  project_stats: any;
  timeline: any[];
}

export interface TaskEducationalResponse {
  success: boolean;
  message: string;
  project_id: string;
  educational_summary: any;
  tasks_educational_info: any[];
}

// Legacy interface - kept for compatibility
export interface TaskTimelineItem {
  task_id: string;
  title: string;
  topological_order?: number;
  execution_phase?: string;
  parallel_group_id?: string;
  critical_path: boolean;
  planned_start_date?: string;
  planned_end_date?: string;
  estimated_hours?: number;
  dependencies: string[];
}

// API Base Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Generic fetcher for SWR
const fetcher = (url: string) => apiClient.get(url).then(res => res.data);

export class EnhancedTasksService {
  // タスク生成
  static async generateTasks(
    projectId: string,
    request: TaskGenerationRequest = {}
  ): Promise<TaskGenerationResponse> {
    const response = await apiClient.post(`/api/enhanced_tasks/generate/${projectId}`, this.buildStageRequest(request));
    return response.data;
  }

  private static buildStageRequest(request: TaskGenerationRequest = {}): TaskGenerationRequest {
    return {
      hackathon_mode: true,
      use_parallel_processing: true,
      use_full_workflow: true,
      ...request,
    };
  }

  // Individual stage execution helpers
  static async runStage1(
    projectId: string,
    request: TaskGenerationRequest = {}
  ): Promise<StageExecutionResponse<Stage1Result>> {
    const response = await apiClient.post(
      `/api/enhanced_tasks/generate/${projectId}/stage1`,
      this.buildStageRequest(request)
    );
    return response.data;
  }

  static async runStage2(
    projectId: string,
    request: TaskGenerationRequest = {}
  ): Promise<StageExecutionResponse<Stage2Result>> {
    const response = await apiClient.post(
      `/api/enhanced_tasks/generate/${projectId}/stage2`,
      this.buildStageRequest(request)
    );
    return response.data;
  }

  static async runStage3(
    projectId: string,
    request: TaskGenerationRequest = {}
  ): Promise<StageExecutionResponse<Stage3Result>> {
    const response = await apiClient.post(
      `/api/enhanced_tasks/generate/${projectId}/stage3`,
      this.buildStageRequest(request)
    );
    return response.data;
  }

  static async runStage4(
    projectId: string,
    request: TaskGenerationRequest = {}
  ): Promise<GraphAnalysisResponse> {
    const response = await apiClient.post(
      `/api/enhanced_tasks/generate/${projectId}/analysis`,
      this.buildStageRequest(request)
    );
    return response.data;
  }

  static async runStage5(
    projectId: string,
    request: TaskGenerationRequest = {}
  ): Promise<StageExecutionResponse<Stage5Result>> {
    const response = await apiClient.post(
      `/api/enhanced_tasks/generate/${projectId}/stage5`,
      this.buildStageRequest(request)
    );
    return response.data;
  }

  static async getLLMUsage(projectId: string): Promise<LLMUsageResponse> {
    const response = await apiClient.get(`/api/enhanced_tasks/generate/${projectId}/llm-usage`);
    return response.data;
  }

  // プロジェクトのタスク一覧取得（Enhanced Tasks APIを使用）
  static async getProjectTasks(
    projectId: string,
    filters: {
      category?: string;
      moscow_priority?: string;
      mvp_critical_only?: boolean;
      include_details?: boolean;
    } = {}
  ): Promise<TaskListResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = `/api/enhanced_tasks/tasks/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  }

  // SWRフックを使用したタスク一覧取得
  static useProjectTasks(
    projectId: string,
    filters: {
      category?: string;
      moscow_priority?: string;
      mvp_critical_only?: boolean;
      include_details?: boolean;
    } = {},
    options: { refreshInterval?: number; revalidateOnFocus?: boolean } = {}
  ) {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = `/api/enhanced_tasks/tasks/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    return useSWR<TaskListResponse>(
      projectId ? url : null,
      fetcher,
      {
        refreshInterval: options.refreshInterval || 30000, // 30秒間隔で自動更新
        revalidateOnFocus: options.revalidateOnFocus !== false,
        ...options
      }
    );
  }

  // 単一タスク取得（基本Task APIを使用）
  static async getTask(taskId: string): Promise<Task> {
    const response = await apiClient.get(`/task/${taskId}`);
    return response.data;
  }

  // SWRフックを使用した単一タスク取得
  static useTask(taskId: string | null) {
    return useSWR<Task>(
      taskId ? `/task/${taskId}` : null,
      fetcher,
      {
        refreshInterval: 10000, // 10秒間隔で自動更新
      }
    );
  }

  // タスク更新（基本Task APIを使用）
  static async updateTask(taskId: string, task: Partial<Task>): Promise<Task> {
    const response = await apiClient.patch(`/task/${taskId}`, task);
    return response.data;
  }

  // タスク作成（基本Task APIを使用）
  static async createTask(task: Omit<Task, 'task_id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const response = await apiClient.post('/task', task);
    return response.data;
  }

  // タスク削除（基本Task APIを使用）
  static async deleteTask(taskId: string): Promise<{ task_id: string; message: string; deleted_at: string }> {
    const response = await apiClient.delete(`/task/${taskId}`);
    return response.data;
  }

  // プロジェクト統計取得（基本Task APIを使用）
  static async getProjectStatistics(projectId: string): Promise<TaskStatistics> {
    const response = await apiClient.get(`/project/${projectId}/tasks/statistics`);
    return response.data;
  }

  // SWRフックを使用したプロジェクト統計取得
  static useProjectStatistics(projectId: string | null) {
    return useSWR<TaskStatistics>(
      projectId ? `/project/${projectId}/tasks/statistics` : null,
      fetcher,
      {
        refreshInterval: 60000, // 1分間隔で自動更新
      }
    );
  }

  // タイムライン取得（Enhanced Tasks APIを使用）
  static async getProjectTimeline(
    projectId: string,
    filters: {
      include_task_details?: boolean;
    } = {}
  ): Promise<TaskTimelineResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = `/api/enhanced_tasks/timeline/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  }

  // SWRフックを使用したタイムライン取得
  static useProjectTimeline(
    projectId: string | null,
    filters: {
      include_task_details?: boolean;
    } = {}
  ) {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = projectId ? `/api/enhanced_tasks/timeline/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}` : null;

    return useSWR<TaskTimelineResponse>(
      url,
      fetcher,
      {
        refreshInterval: 30000, // 30秒間隔で自動更新
      }
    );
  }

  // 依存関係取得（Enhanced Tasks APIを使用）
  static async getProjectDependencies(
    projectId: string,
    options: {
      include_topological_info?: boolean;
      include_critical_path?: boolean;
    } = {}
  ): Promise<TaskDependencyResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = `/api/enhanced_tasks/dependencies/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  }

  // SWRフックを使用した依存関係取得
  static useProjectDependencies(
    projectId: string | null,
    options: {
      include_topological_info?: boolean;
      include_critical_path?: boolean;
    } = {}
  ) {
    const queryParams = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = projectId ? `/api/enhanced_tasks/dependencies/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}` : null;

    return useSWR<TaskDependencyResponse>(
      url,
      fetcher,
      {
        refreshInterval: 60000, // 1分間隔で自動更新
      }
    );
  }

  // 教育的情報取得（Enhanced Tasks APIを使用）
  static async getProjectEducationalInfo(
    projectId: string,
    taskId?: string
  ): Promise<TaskEducationalResponse> {
    const queryParams = new URLSearchParams();
    if (taskId) {
      queryParams.append('task_id', taskId);
    }

    const url = `/api/enhanced_tasks/educational/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  }

  // SWRフックを使用した教育的情報取得
  static useProjectEducationalInfo(
    projectId: string | null,
    taskId?: string
  ) {
    const queryParams = new URLSearchParams();
    if (taskId) {
      queryParams.append('task_id', taskId);
    }

    const url = projectId ? `/api/enhanced_tasks/educational/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}` : null;

    return useSWR<TaskEducationalResponse>(
      url,
      fetcher,
      {
        refreshInterval: 300000, // 5分間隔で自動更新（教育的情報は頻繁に変わらない）
      }
    );
  }

  // タスク品質分析
  static async analyzeTaskQuality(projectId: string): Promise<TaskQualityAnalysisResponse> {
    const response = await apiClient.get(`/api/enhanced_tasks/analyze/${projectId}`);
    return response.data;
  }

  // SWRフックを使用したタスク品質分析
  static useTaskQualityAnalysis(projectId: string | null) {
    return useSWR<TaskQualityAnalysisResponse>(
      projectId ? `/api/enhanced_tasks/analyze/${projectId}` : null,
      fetcher,
      {
        refreshInterval: 300000, // 5分間隔で自動更新
      }
    );
  }

  // プロジェクトタスク全削除
  static async deleteProjectTasks(projectId: string): Promise<{ success: boolean; message: string; deleted_count: number }> {
    const response = await apiClient.delete(`/api/enhanced_tasks/tasks/${projectId}`);
    return response.data;
  }

  // 基本Task APIを使用したプロジェクトタスク一覧取得（レガシー対応）
  static async getBasicProjectTasks(
    projectId: string,
    filters: {
      category?: string;
      status?: string;
      priority?: string;
      moscow_priority?: string;
      mvp_critical?: boolean;
      execution_phase?: string;
      critical_path?: boolean;
      sort_by?: string;
      sort_desc?: boolean;
      skip?: number;
      limit?: number;
    } = {}
  ): Promise<{ tasks: Task[]; total_count: number; filtered_count: number }> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = `/task/project/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  }

  // クリティカルパスタスク取得（基本Task APIを使用）
  static async getCriticalPathTasks(projectId: string): Promise<Task[]> {
    const response = await apiClient.get(`/project/${projectId}/tasks/critical-path`);
    return response.data;
  }

  // MVPタスク取得（基本Task APIを使用）
  static async getMVPTasks(projectId: string): Promise<Task[]> {
    const response = await apiClient.get(`/project/${projectId}/tasks/mvp`);
    return response.data;
  }

  // タスクの教育的情報取得（基本Task APIを使用）
  static async getTaskEducationalInfo(taskId: string): Promise<{
    task_id: string;
    title: string;
    learning_resources: string[];
    technology_stack: Record<string, any>[];
    reference_links: string[];
    completion_criteria?: string;
    complexity_level?: number;
    implementation_difficulty?: number;
    estimated_hours?: number;
  }> {
    const response = await apiClient.get(`/task/${taskId}/educational`);
    return response.data;
  }

  // タスクの依存関係取得（基本Task APIを使用）
  static async getTaskDependencies(taskId: string): Promise<any[]> {
    const response = await apiClient.get(`/task/${taskId}/dependencies`);
    return response.data;
  }

  // タスクの依存先取得（基本Task APIを使用）
  static async getTaskDependents(taskId: string): Promise<any[]> {
    const response = await apiClient.get(`/task/${taskId}/dependents`);
    return response.data;
  }

  // プロジェクトタイムライン取得（基本Task APIを使用）
  static async getBasicProjectTimeline(
    projectId: string,
    filters: {
      execution_phase?: string;
      critical_path_only?: boolean;
    } = {}
  ): Promise<TaskTimelineItem[]> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = `/project/${projectId}/tasks/timeline${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  }

  // SWRキャッシュを無効化して再取得をトリガー
  static mutateProjectTasks(projectId: string) {
    // SWRのmutateを使用してキャッシュを無効化
    // 注意: この関数を使用する際は、コンポーネントでuseSWRConfigからmutateを取得して使用してください
    return `/api/enhanced_tasks/tasks/${projectId}`;
  }

  // 複数のSWRキーを一括で無効化
  static getProjectSWRKeys(projectId: string) {
    return [
      `/api/enhanced_tasks/tasks/${projectId}`,
      `/api/enhanced_tasks/timeline/${projectId}`,
      `/api/enhanced_tasks/dependencies/${projectId}`,
      `/api/enhanced_tasks/educational/${projectId}`,
      `/api/enhanced_tasks/analyze/${projectId}`,
      `/project/${projectId}/tasks/statistics`
    ];
  }
}
