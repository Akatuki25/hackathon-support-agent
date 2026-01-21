import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface FrameworkProposal {
  name: string;
  priority: number;
  reason: string;
}

export interface FrameworkResponse {
  frontend: FrameworkProposal[];
  backend: FrameworkProposal[];
}

export interface FrameworkDocumentRequest {
  project_id: string;
  specification: string;
  framework: string;
}

export interface FrameworkDocumentResponse {
  doc_id: string;
  framework_document: string;
  message: string;
}

// フレームワーク優先順位取得API
export const getFrameworkPriority = async (
  specification: string,
): Promise<FrameworkResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/framework/`,
    { specification },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  return response.data;
};

// フレームワーク技術要件定義書生成API
export const generateFrameworkDocument = async (
  projectId: string,
  specification: string,
  framework: string,
): Promise<FrameworkDocumentResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/framework/generate-document`,
    {
      project_id: projectId,
      specification,
      framework,
    },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  return response.data;
};

// プロジェクトドキュメント取得API
export const getProjectDocument = async (projectId: string) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/project_document/${projectId}`,
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // 404エラーの場合は空のドキュメントを返す
      return {
        function_doc: "",
        framework_doc: "",
        directory_doc: "",
        task_doc: "",
        env_doc: "",
      };
    }
    // その他のエラーは再スロー
    throw error;
  }
};

// フレームワークドキュメント更新API
export const updateFrameworkDocument = async (
  projectId: string,
  frameworkDoc: string,
): Promise<{ message: string }> => {
  const response = await axios.put(
    `${API_BASE_URL}/api/projects/${projectId}/framework-document`,
    { frame_work_doc: frameworkDoc },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  return response.data;
};
