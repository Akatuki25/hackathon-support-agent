import axios from 'axios';
import {
  ChatHansonRequest,
  ChatHansonResponse,
  ChatHansonPlanResponse
} from '@/types/modelTypes';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Main chat API for hackathon development support
 * Responds to user questions using Planning + Execute 2-step approach
 */
export const chatWithHanson = async (
  projectId: string,
  userQuestion: string,
  chatHistory: string = '',
  returnPlan: boolean = false
): Promise<ChatHansonResponse> => {
  const requestData: ChatHansonRequest = {
    project_id: projectId,
    user_question: userQuestion,
    chat_history: chatHistory,
    return_plan: returnPlan
  };

  const response = await axios.post<ChatHansonResponse>(
    `${API_BASE_URL}/api/chatHanson/`,
    requestData
  );

  return response.data;
};

/**
 * Execute only the Planning step
 * Use this when you only want to get the response plan
 */
export const getPlanOnly = async (
  projectId: string,
  userQuestion: string,
  chatHistory: string = ''
): Promise<ChatHansonPlanResponse> => {
  const requestData: Omit<ChatHansonRequest, 'return_plan'> = {
    project_id: projectId,
    user_question: userQuestion,
    chat_history: chatHistory
  };

  const response = await axios.post<ChatHansonPlanResponse>(
    `${API_BASE_URL}/api/chatHanson/plan`,
    requestData
  );

  return response.data;
};

/**
 * Simple helper to send a message
 * Use this for simple questions without chat history
 */
export const sendMessage = async (
  projectId: string,
  question: string
): Promise<string> => {
  const response = await chatWithHanson(projectId, question, '', false);
  return response.answer;
};

/**
 * Get detailed response with plan included
 */
export const getDetailedResponse = async (
  projectId: string,
  question: string,
  chatHistory: string = ''
): Promise<ChatHansonResponse> => {
  return chatWithHanson(projectId, question, chatHistory, true);
};
