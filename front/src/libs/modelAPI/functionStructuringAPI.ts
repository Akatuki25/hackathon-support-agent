import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface FunctionDependency {
  dependency_id: string;
  from_function_id: string;
  to_function_id: string;
  dependency_type: string;
  reason: string;
  from_function_name: string;
  to_function_name: string;
  strength: string;
}

export interface StructuredFunction {
  function_id: string;
  function_code: string;
  function_name: string;
  description: string;
  category: 'auth' | 'data' | 'logic' | 'ui' | 'api' | 'deployment';
  priority: 'Must' | 'Should' | 'Could' | 'Wont';
  extraction_confidence: number;
  order_index: number;
  created_at: string;
  dependencies: {
    incoming: Array<{
      function_id: string;
      dependency_type: string;
      reason: string;
    }>;
    outgoing: Array<{
      function_id: string;
      dependency_type: string;
      reason: string;
    }>;
  };
  implementation_order: number;
  estimated_effort: string;
  validation_status: string;
}

export interface ImplementationOrderItem {
  order: number;
  function_id: string;
  function_name: string;
  function_code: string;
  category: string;
  priority: string;
  can_start: boolean;
  blocked_by: string[];
}

export interface StructuringResult {
  project_id: string;
  functions: StructuredFunction[];
  dependencies: FunctionDependency[];
  total_functions: number;
  total_dependencies: number;
  implementation_order: ImplementationOrderItem[];
  summary: {
    categories: {
      counts: Record<string, number>;
      priorities: Record<string, Record<string, number>>;
      total_categories: number;
    };
    priorities: {
      counts: Record<string, number>;
      by_category: Record<string, Record<string, number>>;
      mvp_ready: boolean;
    };
    dependency_analysis: {
      types: Record<string, number>;
      circular_dependencies: any[];
      critical_paths: any[];
      complexity_score: number;
    };
  };
}

export interface CreateFunctionRequest {
  project_id: string;
  function_name: string;
  description: string;
  category?: 'auth' | 'data' | 'logic' | 'ui' | 'api' | 'deployment';
  priority?: 'Must' | 'Should' | 'Could' | 'Wont';
  function_code?: string;
}

export interface UpdateFunctionRequest {
  function_name?: string;
  description?: string;
  category?: 'auth' | 'data' | 'logic' | 'ui' | 'api' | 'deployment';
  priority?: 'Must' | 'Should' | 'Could' | 'Wont';
}

/**
 * 機能構造化を実行
 */
export const structureFunctions = async (projectId: string): Promise<{ success: boolean; error?: string }> => {
  const response = await axios.post(
    `${API_URL}/api/function_structuring/structure`,
    { project_id: projectId }
  );
  return response.data;
};

/**
 * 構造化結果を取得
 */
export const getStructuredFunctions = async (projectId: string): Promise<StructuringResult> => {
  const response = await axios.get<StructuringResult>(
    `${API_URL}/api/function_structuring/functions/${projectId}`
  );
  return response.data;
};

/**
 * 新しい機能を手動で作成
 */
export const createFunction = async (data: CreateFunctionRequest): Promise<StructuredFunction> => {
  const response = await axios.post<StructuredFunction>(
    `${API_URL}/api/function_structuring/functions`,
    data
  );
  return response.data;
};

/**
 * 機能を更新
 */
export const updateFunction = async (
  functionId: string,
  data: UpdateFunctionRequest
): Promise<StructuredFunction> => {
  const response = await axios.patch<StructuredFunction>(
    `${API_URL}/api/function_structuring/functions/${functionId}`,
    data
  );
  return response.data;
};

/**
 * 機能を削除
 */
export const deleteFunction = async (functionId: string): Promise<void> => {
  await axios.delete(`${API_URL}/api/function_structuring/functions/${functionId}`);
};

/**
 * プロジェクトの全機能を削除
 */
export const deleteAllProjectFunctions = async (
  projectId: string
): Promise<{ message: string; deleted_count: number }> => {
  const response = await axios.delete<{ message: string; deleted_count: number }>(
    `${API_URL}/api/function_structuring/project/${projectId}/functions`
  );
  return response.data;
};

