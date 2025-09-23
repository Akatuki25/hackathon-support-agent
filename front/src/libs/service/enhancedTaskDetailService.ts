import axios from 'axios';
import { TaskItem, DivideTask } from '@/types/taskTypes';

// 環境変数からAPIのベースURLを取得
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Enhanced Task Detail Types
export interface TechnologyReference {
  name: string;
  official_url: string;
  documentation_url: string;
  tutorial_url: string;
  why_needed: string;
  key_concepts: string[];
}

export interface EnhancedTaskDetail {
  task_name: string;
  priority: string;
  content: string;
  detail: string;
  technologies_used: TechnologyReference[];
  learning_resources: string[];
  dependency_explanation: string;
  educational_notes: string;
}

export interface EnhancedTaskBatchResponse {
  tasks: EnhancedTaskDetail[];
  total_processed: number;
  generation_time_seconds: number;
  technologies_found: string[];
}

// Request Types
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

/**
 * 拡張タスク詳細生成：AI検索とRAG処理を使用
 */
export const generateEnhancedTaskDetails = async (
  request: EnhancedTaskDetailRequest
): Promise<EnhancedTaskBatchResponse> => {
  const response = await axios.post<EnhancedTaskBatchResponse>(
    `${API_BASE_URL}/api/taskDetail/enhanced`,
    request,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000, // 5分タイムアウト（AI処理のため）
    }
  );
  return response.data;
};

/**
 * ProjectDocumentからタスク詳細を生成
 */
export const generateTaskDetailsFromProjectDocument = async (
  request: ProjectDocumentTaskRequest
): Promise<EnhancedTaskBatchResponse> => {
  const response = await axios.post<EnhancedTaskBatchResponse>(
    `${API_BASE_URL}/api/taskDetail/from-project-document`,
    request,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000, // 5分タイムアウト
    }
  );
  return response.data;
};

/**
 * 従来のタスク詳細生成（後方互換性）
 */
export const generateTaskDetails = async (
  tasks: TaskItem[],
  specification: string
): Promise<{ tasks: DivideTask[] }> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/taskDetail/`,
    {
      tasks,
      specification
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 180000, // 3分タイムアウト
    }
  );
  return response.data;
};

/**
 * サポートされている技術一覧を取得
 */
export const getSupportedTechnologies = async (): Promise<{
  supported_technologies: string[];
  categories: Record<string, string[]>;
}> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/taskDetail/technologies`,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * ヘルスチェック
 */
export const checkTaskDetailServiceHealth = async (): Promise<{
  status: string;
  service: string;
}> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/taskDetail/health`,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * エラーハンドリング用ユーティリティ
 */
export const handleTaskDetailError = (error: any): string => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // サーバーからのエラーレスポンス
      const detail = error.response.data?.detail || error.response.statusText;
      return `タスク詳細生成エラー (${error.response.status}): ${detail}`;
    } else if (error.request) {
      // ネットワークエラー
      return 'ネットワークエラー: サーバーに接続できませんでした';
    }
  }
  return `予期しないエラー: ${error.message || 'Unknown error'}`;
};

/**
 * タスクの優先度を数値に変換（ソート用）
 */
export const priorityToNumber = (priority: string): number => {
  switch (priority) {
    case 'Must': return 3;
    case 'Should': return 2;
    case 'Could': return 1;
    default: return 0;
  }
};

/**
 * 学習リソースをカテゴリ別に分類
 */
export const categorizeLearnungResources = (resources: string[]): {
  official: string[];
  documentation: string[];
  tutorials: string[];
  other: string[];
} => {
  const categories = {
    official: [] as string[],
    documentation: [] as string[],
    tutorials: [] as string[],
    other: [] as string[]
  };

  resources.forEach(url => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('official') || lowerUrl.includes('.org') || lowerUrl.includes('.io')) {
      categories.official.push(url);
    } else if (lowerUrl.includes('docs') || lowerUrl.includes('documentation')) {
      categories.documentation.push(url);
    } else if (lowerUrl.includes('tutorial') || lowerUrl.includes('getting-started') || lowerUrl.includes('guide')) {
      categories.tutorials.push(url);
    } else {
      categories.other.push(url);
    }
  });

  return categories;
};