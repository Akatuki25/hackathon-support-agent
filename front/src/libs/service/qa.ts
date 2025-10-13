import axios, { AxiosError } from 'axios';
import {
  QAType,
  IdeaPromptType,
  QuestionResponseType,
} from '@/types/modelTypes';

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- 型定義 (ローカル) ---

// QA作成時にIDと作成日を除外するための型
export type QACreateType = Omit<QAType, 'qa_id' | 'created_at'>;

type SaveQuestionsPayload = { QA: QACreateType[] };
type SaveQuestionsResponse = { message: string };

// --- API呼び出し関数 ---

/**
 * AIによるQ&Aを生成する (POST /qas/{project_id})
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

/**
 * Q&Aを保存する (POST /api/question/save_questions)
 * @param questions - 保存するQ&Aデータ
 * @returns 保存結果のメッセージ
 */


export const saveQuestions = async (
  questions: SaveQuestionsPayload,
  project_id: string,
): Promise<SaveQuestionsResponse> => {
  const payload: SaveQuestionsPayload = {
    QA: questions.QA.map((q) => ({
      question: q.question,
      importance: Number(q.importance),
      is_ai: Boolean(q.is_ai),
      project_id,
      answer: q.answer ?? null,
      source_doc_id: q.source_doc_id || null, // "" は NG → null
      follows_qa_id: q.follows_qa_id || null, // "" は NG → null
    })),
  };

  console.log("payload to save_questions:", JSON.stringify(payload, null, 2));

  try {
    const res = await axios.post<SaveQuestionsResponse>(
      `${API_BASE_URL}/api/question/save_questions`,
      payload,
    );
    return res.data;
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      console.error("422 detail:", error.response?.data);
    }
    throw error;
  }
};
