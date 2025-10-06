import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface CreateFunctionRequest {
  project_id: string;
  function_name: string;
  description: string;
  category?: string;
  priority?: string;
}

export interface UpdateFunctionRequest {
  function_name?: string;
  description?: string;
  category?: string;
  priority?: string;
}

export interface StructuredFunction {
  function_id: string;
  function_code: string;
  function_name: string;
  description: string;
  category: string;
  priority: string;
  extraction_confidence: number;
  order_index: number;
  created_at?: string;
  // GETエンドポイントと同じ形式
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

export interface CreateFunctionResponse {
  message: string;
  function: StructuredFunction;
}

export interface UpdateFunctionResponse {
  message: string;
  function: StructuredFunction;
}

export interface DeleteFunctionResponse {
  message: string;
  deleted_function: {
    function_id: string;
    function_code: string;
    function_name: string;
  };
}

/**
 * 新しい機能を手動で作成
 */
export const createFunction = async (
  data: CreateFunctionRequest
): Promise<CreateFunctionResponse> => {
  const response = await axios.post<CreateFunctionResponse>(
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
): Promise<UpdateFunctionResponse> => {
  const response = await axios.patch<UpdateFunctionResponse>(
    `${API_URL}/api/function_structuring/functions/${functionId}`,
    data
  );
  return response.data;
};

/**
 * 機能を削除
 */
export const deleteFunction = async (
  functionId: string
): Promise<DeleteFunctionResponse> => {
  const response = await axios.delete<DeleteFunctionResponse>(
    `${API_URL}/api/function_structuring/functions/${functionId}`
  );
  return response.data;
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

