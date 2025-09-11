import axios from 'axios';
import {
  EvaluationResultType,
} from '@/types/modelTypes';

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const evaluateMvpFromSummary = async (
  projectId: string,
): Promise<EvaluationResultType> => {
  const response = await axios.post<EvaluationResultType>(
    `${API_BASE_URL}/api/summary/evaluate`,
    { project_id: projectId }
  );
  return response.data;
};

export const saveSummary = async (
  projectId: string,
  summary: string
): Promise<{ message: string; project_id: string; doc_id: string }> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/summary/save`,
    { 
      project_id: projectId,
      summary: summary
    }
  );
  return response.data;
};

export const generateSummaryAndEvaluate = async (
  projectId: string,
): Promise<EvaluationResultType> => {
  const response = await axios.post<EvaluationResultType>(
    `${API_BASE_URL}/api/summary/`,
    { project_id: projectId }
  );
  return response.data;
};

export const updateQAAndRegenerate = async (
  projectId: string,
  qaAnswers: Array<{ qa_id: string; answer: string }>
): Promise<EvaluationResultType> => {
  const response = await axios.post<EvaluationResultType>(
    `${API_BASE_URL}/api/summary/update-qa-and-regenerate`,
    { 
      project_id: projectId,
      qa_answers: qaAnswers
    }
  );
  return response.data;
};