import axios from 'axios';
import { SummaryQaItem, SummaryRequest, SummaryResponse } from '@/types/modelTypes';

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Q&Aのリストから要約ドキュメントを生成する (POST /summary)
 * @param qaList - 質問と回答のペアのリスト
 * @returns 生成された要約テキスト
 */
export const generateSummary = async (
  qaList: SummaryQaItem[]
): Promise<string> => {
  const requestBody: SummaryRequest = { Answer: qaList };
  const response = await axios.post<SummaryResponse>(
    `${API_BASE_URL}/summary`,
    requestBody
  );
  return response.data.summary;
};
