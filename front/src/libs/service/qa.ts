import axios, { AxiosError } from "axios";
import {
  QAType,
  IdeaPromptType,
  QuestionResponseType,
} from "@/types/modelTypes";

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- SSE Streaming Types ---

/** SSEで受け取るQ&Aアイテム */
export interface StreamingQAItem {
  qa_id: string;
  question: string;
  answer: string;
  importance: number;
  is_ai: boolean;
  source_doc_id: string | null;
  project_id: string;
  follows_qa_id: string | null;
}

/** ストリーミング生成のコールバック */
export interface StreamingCallbacks {
  /** ストリーム開始時 */
  onStart?: (data: { ok: boolean; project_id: string }) => void;
  /** Q&Aアイテム受信時（1件ずつ呼ばれる） */
  onQA?: (item: StreamingQAItem, index: number) => void;
  /** 完了時 */
  onDone?: (data: { count: number }) => void;
  /** エラー時 */
  onError?: (error: Error | { message: string }) => void;
}

// --- 型定義 (ローカル) ---

// QA作成時にIDと作成日を除外するための型
export type QACreateType = Omit<QAType, "qa_id" | "created_at">;

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
  prompt: string,
): Promise<QuestionResponseType> => {
  const requestBody: IdeaPromptType = { Prompt: prompt };
  const response = await axios.post<QuestionResponseType>(
    `${API_BASE_URL}/api/question/${projectId}`,
    requestBody,
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

// --- SSE Streaming Functions ---

/**
 * SSEストリーミングでQ&Aを生成する
 * 質問が1件生成されるたびにコールバックが呼ばれるため、
 * UIに順次表示することでユーザー体験を向上させる。
 *
 * @param projectId - プロジェクトID
 * @param prompt - AIに与えるアイデアのプロンプト
 * @param callbacks - イベントコールバック
 * @returns 生成されたQ&Aアイテムの配列
 */
export const streamGenerateQuestions = async (
  projectId: string,
  prompt: string,
  callbacks: StreamingCallbacks = {},
): Promise<StreamingQAItem[]> => {
  const items: StreamingQAItem[] = [];
  let itemIndex = 0;

  return new Promise((resolve, reject) => {
    // fetchを使用してSSEストリームを処理
    fetch(`${API_BASE_URL}/api/question/stream/${projectId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Prompt: prompt }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // SSEイベントをパース
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // 最後の不完全な行を保持

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.substring(7).trim();
            } else if (line.startsWith("data: ") && currentEvent) {
              const data = line.substring(6);
              try {
                const parsed = JSON.parse(data);

                switch (currentEvent) {
                  case "start":
                    callbacks.onStart?.(parsed);
                    break;
                  case "qa":
                    items.push(parsed as StreamingQAItem);
                    callbacks.onQA?.(parsed as StreamingQAItem, itemIndex++);
                    break;
                  case "done":
                    callbacks.onDone?.(parsed);
                    resolve(items);
                    return;
                  case "error":
                    callbacks.onError?.(parsed);
                    reject(new Error(parsed.message || "Unknown error"));
                    return;
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", data, e);
              }
              currentEvent = "";
            }
          }
        }

        // ストリームが正常終了した場合
        resolve(items);
      })
      .catch((error) => {
        callbacks.onError?.(error);
        reject(error);
      });
  });
};

/**
 * ストリーミング生成したQ&Aを保存用の形式に変換する
 * @param items - ストリーミングで受け取ったQ&Aアイテム
 * @returns saveQuestions用のペイロード
 */
export const convertStreamingItemsToPayload = (
  items: StreamingQAItem[],
): SaveQuestionsPayload => {
  return {
    QA: items.map((item) => ({
      question: item.question,
      importance: item.importance,
      is_ai: item.is_ai,
      project_id: item.project_id,
      answer: item.answer || null,
      source_doc_id: item.source_doc_id || null,
      follows_qa_id: item.follows_qa_id || null,
    })),
  };
};
