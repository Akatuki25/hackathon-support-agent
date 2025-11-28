import axios from 'axios';
import {
  SpecificationChatRequest,
  SpecificationChatResponse
} from '@/types/modelTypes';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 仕様書に関する質問に回答するチャットAPI
 * 仕様書の内容について、なぜそのような仕様にしたのかを説明する
 */
export const chatAboutSpecification = async (
  projectId: string,
  userQuestion: string,
  chatHistory: string = ''
): Promise<SpecificationChatResponse> => {
  const requestData: SpecificationChatRequest = {
    project_id: projectId,
    user_question: userQuestion,
    chat_history: chatHistory
  };

  const response = await axios.post<SpecificationChatResponse>(
    `${API_BASE_URL}/api/specificationChat/`,
    requestData
  );

  return response.data;
};

/**
 * シンプルなヘルパー関数
 * チャット履歴なしで質問を送信する場合に使用
 */
export const askAboutSpecification = async (
  projectId: string,
  question: string
): Promise<string> => {
  const response = await chatAboutSpecification(projectId, question, '');
  return response.answer;
};
