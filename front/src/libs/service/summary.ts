import axios from 'axios';
import {
  MVPJudge,
  ConfidenceFeedback
} from '@/types/modelTypes';

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';


export const generateSummary = async (
  projectId: string,
):Promise<string>=>{

   const response = await axios.post(
     `${API_BASE_URL}/api/summary/`,
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

export const evaluateSummary = async (
  projectId: string
) : Promise<MVPJudge> => {
  const response = await axios.post<MVPJudge>(
    `${API_BASE_URL}/api/summary/evaluate`,
    { project_id: projectId }
  );
  return response.data;
}

export const getConfidenceFeedback = async (
  projectId: string
): Promise<ConfidenceFeedback> => {
  const response = await axios.post<ConfidenceFeedback>(
    `${API_BASE_URL}/api/summary/confidence-feedback`,
    { project_id: projectId }
  );
  return response.data;
}

export const generateSummaryWithFeedback = async (
  projectId: string
): Promise<{
  summary: string;
  doc_id: string;
  confidence_feedback: ConfidenceFeedback;
}> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/summary/generate-with-feedback`,
    { project_id: projectId }
  );
  return response.data;
}

