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
    `${API_BASE_URL}/summary/evaluate`,
    { project_id: projectId }
  );
  return response.data;
};