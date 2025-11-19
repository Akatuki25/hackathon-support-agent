import axios from 'axios';
import { SpecificationFeedback } from '@/types/modelTypes';

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 機能要件の型定義
export interface FunctionalRequirement {
  requirement_id: string;
  category: string;
  title: string;
  description: string;
  priority: 'Must' | 'Should' | 'Could';
  confidence_level: number;
  acceptance_criteria: string[];
  dependencies: string[];
}

export interface FunctionRequirementsResponse {
  message: string;
  requirements: FunctionalRequirement[];
  overall_confidence: number;
  clarification_questions: QAForRequirement[];
  low_confidence_count: number;
}

export interface QAForRequirement {
  qa_id: string;
  project_id: string;
  question: string;
  answer: string | null;
  answer_example?: string;  // 回答例（AI生成時に提供される）
  is_ai: boolean;
  importance: number;
  requirement_id?: string;
}

export interface ProjectDocument {
  doc_id: string;
  project_id: string;
  function_doc: string;
  has_requirements: boolean;
}

/**
 * 機能要件を生成し、確信度が低い項目についてはQAを生成する
 */
export const generateFunctionalRequirements = async (
  projectId: string,
  confidenceThreshold: number = 0.7
): Promise<FunctionRequirementsResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/generate`,
    {
      project_id: projectId,
      confidence_threshold: confidenceThreshold
    }
  );
  return response.data;
};

/**
 * 機能要件をプロジェクトドキュメントに保存する
 */
export const saveFunctionalRequirements = async (
  projectId: string,
  requirements: FunctionalRequirement[]
): Promise<{ message: string; doc_id: string; requirements_count: number }> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/save-requirements`,
    {
      project_id: projectId,
      requirements: requirements
    }
  );
  return response.data;
};

/**
 * 明確化質問をDBに保存する
 */
export const saveClarificationQuestions = async (
  questions: QAForRequirement[]
): Promise<{ message: string; questions_count: number }> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/save-questions`,
    { questions: questions }
  );
  return response.data;
};

/**
 * 機能要件生成から保存まで一括で実行
 */
export const generateAndSaveAll = async (
  projectId: string,
  confidenceThreshold: number = 0.7
): Promise<{
  message: string;
  doc_id: string;
  requirements: FunctionalRequirement[];
  requirements_count: number;
  overall_confidence: number;
  low_confidence_count: number;
  clarification_questions: QAForRequirement[];
  questions_saved: number;
}> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/generate-and-save`,
    {
      project_id: projectId,
      confidence_threshold: confidenceThreshold
    }
  );
  return response.data;
};

/**
 * 保存済みの機能要件を取得する
 */
export const getFunctionalRequirements = async (
  projectId: string
): Promise<ProjectDocument> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/function_requirements/requirements/${projectId}`
  );
  return response.data;
};

/**
 * 機能要件ドキュメントを更新する
 */
export const updateFunctionDocument = async (
  projectId: string,
  functionDoc: string
): Promise<{ message: string; doc_id: string }> => {
  // document APIを使用してfunction_docを更新
  const response = await axios.patch(
    `${API_BASE_URL}/project_document/${projectId}`,
    { function_doc: functionDoc }
  );
  return response.data;
};

/**
 * 機能要件を再生成する
 */
export const regenerateFunctionalRequirements = async (
  projectId: string,
  confidenceThreshold: number = 0.7
): Promise<FunctionRequirementsResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/regenerate`,
    {
      project_id: projectId,
      confidence_threshold: confidenceThreshold
    }
  );
  return response.data;
};

/**
 * 機能要件書の仕様書フィードバックを取得する
 */
export const getFunctionSpecificationFeedback = async (
  projectId: string
): Promise<SpecificationFeedback> => {
  const response = await axios.post<SpecificationFeedback>(
    `${API_BASE_URL}/api/function_requirements/confidence-feedback`,
    { project_id: projectId }
  );
  return response.data;
};

// Legacy alias - deprecated, use getFunctionSpecificationFeedback instead
export const getFunctionConfidenceFeedback = getFunctionSpecificationFeedback;

/**
 * ユーザーが編集した機能要件ドキュメントを保存する
 */
export const saveFunctionDocument = async (
  projectId: string,
  functionDoc: string
): Promise<{ message: string; project_id: string; doc_id: string }> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/save`,
    {
      project_id: projectId,
      function_doc: functionDoc
    }
  );
  return response.data;
};

/**
 * 仕様書の変更に基づいて機能要件を差分更新する
 */
export const updateFunctionDocWithSpec = async (
  projectId: string,
  specificationDiff?: string
): Promise<{
  message: string;
  function_doc: string;
  project_id: string;
  doc_id: string;
}> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/update-with-spec`,
    {
      project_id: projectId,
      specification_diff: specificationDiff
    }
  );
  return response.data;
};