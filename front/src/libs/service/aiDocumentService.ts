import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * AIドキュメント生成レスポンス型
 */
export interface AIDocumentGenerationResponse {
  success: boolean;
  message: string;
  project_id: string;
  ai_document: string;
}

/**
 * AIドキュメント取得レスポンス型
 */
export interface AIDocumentGetResponse {
  ai_doc_id: string;
  project_id: string;
  environment: string | null;
  front_end: string | null;
  back_end: string | null;
  database: string | null;
  deployment: string | null;
  ai_design: string | null;
  slide: string | null;
}

/**
 * AIドキュメント状態レスポンス型
 */
export interface AIDocumentStatusResponse {
  project_id: string;
  has_framework_doc: boolean;
  has_ai_document: boolean;
  framework_doc_length: number;
  ai_document_length: number;
  ready_for_generation: boolean;
  generation_completed: boolean;
}

/**
 * frame_work_docからAIドキュメントを生成
 *
 * @param projectId プロジェクトID
 * @returns AIドキュメント生成結果
 */
export const generateAIDocument = async (projectId: string): Promise<AIDocumentGenerationResponse> => {
  const response = await axios.post<AIDocumentGenerationResponse>(
    `${API_URL}/api/ai_document/generate`,
    { project_id: projectId }
  );
  return response.data;
};

/**
 * 生成済みAIドキュメントを取得
 *
 * @param projectId プロジェクトID
 * @returns AIドキュメント
 */
export const getAIDocument = async (projectId: string): Promise<AIDocumentGetResponse> => {
  const response = await axios.get<AIDocumentGetResponse>(
    `${API_URL}/api/ai_document/document/${projectId}`
  );
  return response.data;
};

/**
 * AIドキュメント生成の状況を確認
 *
 * @param projectId プロジェクトID
 * @returns AIドキュメント生成状況
 */
export const getAIDocumentStatus = async (projectId: string): Promise<AIDocumentStatusResponse> => {
  const response = await axios.get<AIDocumentStatusResponse>(
    `${API_URL}/api/ai_document/status/${projectId}`
  );
  return response.data;
};
