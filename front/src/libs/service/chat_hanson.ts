import axios, { AxiosError } from 'axios';

// Get API base URL from environment variables, use default if not set
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- Type Definitions ---

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Chat Hanson request payload
 */
export interface ChatHansonRequest {
  project_id: string;
  user_question: string;
  chat_history?: ChatMessage[];
}

/**
 * Chat Hanson response payload
 */
export interface ChatHansonResponse {
  success: boolean;
  answer: string;
  confidence: number;
  sources_used: string[];
  plan_steps: number;
  error?: string;
}

// --- API Functions ---

/**
 * Call Chat Hanson API to get answers using project context
 *
 * @param projectId - Project ID
 * @param userQuestion - User's question
 * @param chatHistory - Optional chat history (up to 5 messages considered)
 * @returns Response from Chat Hanson
 *
 * @example
 * ```typescript
 * const response = await chatWithHanson(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   'Tell me about the authentication feature in the specification',
 *   [
 *     { role: 'user', content: 'What are the main features?' },
 *     { role: 'assistant', content: 'The main features are...' }
 *   ]
 * );
 *
 * if (response.success) {
 *   console.log('Answer:', response.answer);
 *   console.log('Confidence:', response.confidence);
 *   console.log('Sources used:', response.sources_used);
 * }
 * ```
 */
export const chatWithHanson = async (
  projectId: string,
  userQuestion: string,
  chatHistory?: ChatMessage[]
): Promise<ChatHansonResponse> => {
  const requestBody: ChatHansonRequest = {
    project_id: projectId,
    user_question: userQuestion,
    ...(chatHistory && chatHistory.length > 0 && { chat_history: chatHistory })
  };

  try {
    const response = await axios.post<ChatHansonResponse>(
      `${API_BASE_URL}/api/chat_hanson/chat`,
      requestBody
    );
    return response.data;
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      console.error('[Chat Hanson] API Error:', error.response?.data);

      // Return error response
      return {
        success: false,
        answer: 'An error occurred. Please try again.',
        confidence: 0.0,
        sources_used: [],
        plan_steps: 0,
        error: error.response?.data?.detail || error.message
      };
    }

    // Unexpected error
    throw error;
  }
};

/**
 * Check Chat Hanson API health status
 *
 * @returns Service health status
 */
export const checkChatHansonHealth = async (): Promise<{
  status: string;
  service: string;
  version: string;
}> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/chat_hanson/health`
  );
  return response.data;
};
