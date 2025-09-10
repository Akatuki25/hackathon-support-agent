import axios from 'axios';
import {
  QAType,
  QAPatch,
  IdeaPromptType,
  QuestionResponseType,
} from '@/types/modelTypes';

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- 型定義 (ローカル) ---

// QA作成時にIDと作成日を除外するための型
export type QACreateType = Omit<QAType, 'qa_id' | 'created_at'>;

// --- API呼び出し関数 ---

/**
 * AIによるQ&Aを生成・保存する (POST /qas/{project_id})
 * @param projectId - プロジェクトID
 * @param prompt - AIに与えるアイデアのプロンプト
 * @returns 生成されたQ&Aの情報
 */
export const generateQuestions = async (
  projectId: string,
  prompt: string
): Promise<QuestionResponseType> => {
  const requestBody: IdeaPromptType = { Prompt: prompt };
  const response = await axios.post<QuestionResponseType>(
    `${API_BASE_URL}/api/question/${projectId}`,
    requestBody
  );
  return response.data;
};

