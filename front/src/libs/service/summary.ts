import axios from "axios";
import { MVPJudge, SpecificationFeedback } from "@/types/modelTypes";

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const generateSummary = async (projectId: string): Promise<string> => {
  const response = await axios.post(`${API_BASE_URL}/api/summary/`, {
    project_id: projectId,
  });
  return response.data;
};

export const saveSummary = async (
  projectId: string,
  summary: string,
): Promise<{ message: string; project_id: string; doc_id: string }> => {
  const response = await axios.post(`${API_BASE_URL}/api/summary/save`, {
    project_id: projectId,
    summary: summary,
  });
  return response.data;
};

export const evaluateSummary = async (projectId: string): Promise<MVPJudge> => {
  const response = await axios.post<MVPJudge>(
    `${API_BASE_URL}/api/summary/evaluate`,
    { project_id: projectId },
  );
  return response.data;
};

export const getSpecificationFeedback = async (
  projectId: string,
): Promise<SpecificationFeedback> => {
  const response = await axios.post<SpecificationFeedback>(
    `${API_BASE_URL}/api/summary/confidence-feedback`,
    { project_id: projectId },
  );
  return response.data;
};

// Legacy alias - deprecated, use getSpecificationFeedback instead
export const getConfidenceFeedback = getSpecificationFeedback;

export const generateSummaryWithFeedback = async (
  projectId: string,
): Promise<{
  summary: string;
  doc_id: string;
  specification_feedback: SpecificationFeedback;
}> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/summary/generate-with-feedback`,
    { project_id: projectId },
  );
  return response.data;
};

// --- SSE Streaming Types ---

/** ストリーミング生成のコールバック */
export interface SummaryStreamingCallbacks {
  /** ストリーム開始時 */
  onStart?: (data: { ok: boolean; project_id: string }) => void;
  /** テキストチャンク受信時（順次呼ばれる） */
  onChunk?: (text: string, accumulated: string) => void;
  /** 仕様書完了時 */
  onSpecDone?: (data: { doc_id: string; summary: string }) => void;
  /** フィードバック受信時 */
  onFeedback?: (feedback: SpecificationFeedback) => void;
  /** 完了時 */
  onDone?: () => void;
  /** エラー時 */
  onError?: (error: Error | { message: string }) => void;
}

/** ストリーミング生成の結果 */
export interface SummaryStreamingResult {
  summary: string;
  doc_id: string;
  specification_feedback: SpecificationFeedback;
}

/**
 * SSEストリーミングで仕様書を生成する
 * テキストチャンクが生成されるたびにコールバックが呼ばれるため、
 * UIに順次表示することでユーザー体験を向上させる。
 *
 * @param projectId - プロジェクトID
 * @param callbacks - イベントコールバック
 * @returns 生成結果
 */
export const streamGenerateSummary = async (
  projectId: string,
  callbacks: SummaryStreamingCallbacks = {},
): Promise<SummaryStreamingResult> => {
  let accumulatedText = "";
  let docId = "";
  let feedback: SpecificationFeedback = {
    summary: "",
    strengths: [],
    missing_info: [],
    suggestions: [],
  };

  return new Promise((resolve, reject) => {
    fetch(`${API_BASE_URL}/api/summary/stream/${projectId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
        let currentEvent = ""; // whileループの外で定義

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // SSEイベントをパース
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // 最後の不完全な行を保持
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
                  case "chunk":
                    accumulatedText += parsed.text;
                    callbacks.onChunk?.(parsed.text, accumulatedText);
                    break;
                  case "spec_done":
                    docId = parsed.doc_id;
                    callbacks.onSpecDone?.(parsed);
                    break;
                  case "feedback":
                    feedback = parsed as SpecificationFeedback;
                    callbacks.onFeedback?.(feedback);
                    break;
                  case "done":
                    callbacks.onDone?.();
                    resolve({
                      summary: accumulatedText,
                      doc_id: docId,
                      specification_feedback: feedback,
                    });
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
        resolve({
          summary: accumulatedText,
          doc_id: docId,
          specification_feedback: feedback,
        });
      })
      .catch((error) => {
        callbacks.onError?.(error);
        reject(error);
      });
  });
};
