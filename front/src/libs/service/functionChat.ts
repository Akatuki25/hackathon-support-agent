import axios from 'axios';
import {
  FunctionChatRequest,
  FunctionChatResponse
} from '@/types/modelTypes';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 機能要件に関する質問に回答するチャットAPI
 * 機能要件の内容について、なぜその機能が必要なのかを説明する
 */
export const chatAboutFunction = async (
  projectId: string,
  userQuestion: string,
  chatHistory: string = ''
): Promise<FunctionChatResponse> => {
  const requestData: FunctionChatRequest = {
    project_id: projectId,
    user_question: userQuestion,
    chat_history: chatHistory
  };

  const response = await axios.post<FunctionChatResponse>(
    `${API_BASE_URL}/api/functionChat/`,
    requestData
  );

  return response.data;
};

/**
 * シンプルなヘルパー関数
 * チャット履歴なしで質問を送信する場合に使用
 */
export const askAboutFunction = async (
  projectId: string,
  question: string
): Promise<string> => {
  const response = await chatAboutFunction(projectId, question, '');
  return response.answer;
};
