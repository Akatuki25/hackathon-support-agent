import axios from "axios";
import { SpecificationFeedback } from "@/types/modelTypes";

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 機能要件の型定義
export interface FunctionalRequirement {
  requirement_id: string;
  category: string;
  title: string;
  description: string;
  priority: "Must" | "Should" | "Could";
  confidence_level: number;
  acceptance_criteria: string[];
  dependencies: string[];
}

export interface FunctionRequirementsResponse {
  message: string;
  requirements: FunctionalRequirement[];
  overall_confidence: number;
  clarification_questions: QAForRequirement[];
  low_confidence_count: number;
}

export interface QAForRequirement {
  qa_id: string;
  project_id: string;
  question: string;
  answer: string | null;
  answer_example?: string; // 回答例（AI生成時に提供される）
  is_ai: boolean;
  importance: number;
  requirement_id?: string;
}

export interface ProjectDocument {
  doc_id: string;
  project_id: string;
  function_doc: string;
  has_requirements: boolean;
}

/**
 * 機能要件を生成し、確信度が低い項目についてはQAを生成する
 */
export const generateFunctionalRequirements = async (
  projectId: string,
  confidenceThreshold: number = 0.7,
): Promise<FunctionRequirementsResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/generate`,
    {
      project_id: projectId,
      confidence_threshold: confidenceThreshold,
    },
  );
  return response.data;
};

/**
 * 機能要件をプロジェクトドキュメントに保存する
 */
export const saveFunctionalRequirements = async (
  projectId: string,
  requirements: FunctionalRequirement[],
): Promise<{ message: string; doc_id: string; requirements_count: number }> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/save-requirements`,
    {
      project_id: projectId,
      requirements: requirements,
    },
  );
  return response.data;
};

/**
 * 明確化質問をDBに保存する
 */
export const saveClarificationQuestions = async (
  questions: QAForRequirement[],
): Promise<{ message: string; questions_count: number }> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/save-questions`,
    { questions: questions },
  );
  return response.data;
};

/**
 * 機能要件生成から保存まで一括で実行
 */
export const generateAndSaveAll = async (
  projectId: string,
  confidenceThreshold: number = 0.7,
): Promise<{
  message: string;
  doc_id: string;
  requirements: FunctionalRequirement[];
  requirements_count: number;
  overall_confidence: number;
  low_confidence_count: number;
  clarification_questions: QAForRequirement[];
  questions_saved: number;
}> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/generate-and-save`,
    {
      project_id: projectId,
      confidence_threshold: confidenceThreshold,
    },
  );
  return response.data;
};

/**
 * 保存済みの機能要件を取得する
 */
export const getFunctionalRequirements = async (
  projectId: string,
): Promise<ProjectDocument> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/function_requirements/requirements/${projectId}`,
  );
  return response.data;
};

/**
 * 機能要件ドキュメントを更新する
 */
export const updateFunctionDocument = async (
  projectId: string,
  functionDoc: string,
): Promise<{ message: string; doc_id: string }> => {
  // document APIを使用してfunction_docを更新
  const response = await axios.patch(
    `${API_BASE_URL}/project_document/${projectId}`,
    { function_doc: functionDoc },
  );
  return response.data;
};

/**
 * 機能要件を再生成する
 */
export const regenerateFunctionalRequirements = async (
  projectId: string,
  confidenceThreshold: number = 0.7,
): Promise<FunctionRequirementsResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/regenerate`,
    {
      project_id: projectId,
      confidence_threshold: confidenceThreshold,
    },
  );
  return response.data;
};

/**
 * 機能要件書の仕様書フィードバックを取得する
 */
export const getFunctionSpecificationFeedback = async (
  projectId: string,
): Promise<SpecificationFeedback> => {
  const response = await axios.post<SpecificationFeedback>(
    `${API_BASE_URL}/api/function_requirements/confidence-feedback`,
    { project_id: projectId },
  );
  return response.data;
};

// Legacy alias - deprecated, use getFunctionSpecificationFeedback instead
export const getFunctionConfidenceFeedback = getFunctionSpecificationFeedback;

// --- SSE Streaming Types ---

/** ストリーミングQ&Aの型 */
export interface StreamingQA {
  qa_id: string;
  project_id: string;
  question: string;
  answer: string | null;
  is_ai: boolean;
  importance: number;
}

/** ストリーミング生成のコールバック */
export interface FunctionStreamingCallbacks {
  /** ストリーム開始時 */
  onStart?: (data: { ok: boolean; project_id: string }) => void;
  /** テキストチャンク受信時（順次呼ばれる） */
  onChunk?: (text: string, accumulated: string) => void;
  /** 機能要件書完了時 */
  onDocDone?: (data: { doc_id: string; function_doc: string }) => void;
  /** 追加質問受信時 */
  onQuestions?: (questions: StreamingQA[]) => void;
  /** 完了時 */
  onDone?: () => void;
  /** エラー時 */
  onError?: (error: Error | { message: string }) => void;
}

/** ストリーミング生成の結果 */
export interface FunctionStreamingResult {
  function_doc: string;
  doc_id: string;
  questions: StreamingQA[];
}

/**
 * SSEストリーミングで機能要件を生成する
 * テキストチャンクが生成されるたびにコールバックが呼ばれるため、
 * UIに順次表示することでユーザー体験を向上させる。
 *
 * @param projectId - プロジェクトID
 * @param callbacks - イベントコールバック
 * @returns 生成結果
 */
export const streamGenerateFunctionalRequirements = async (
  projectId: string,
  callbacks: FunctionStreamingCallbacks = {},
): Promise<FunctionStreamingResult> => {
  let accumulatedText = "";
  let docId = "";
  let questions: StreamingQA[] = [];

  return new Promise((resolve, reject) => {
    fetch(`${API_BASE_URL}/api/function_requirements/stream/${projectId}`, {
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
                  case "doc_done":
                    docId = parsed.doc_id;
                    callbacks.onDocDone?.(parsed);
                    break;
                  case "questions":
                    questions = parsed.questions || [];
                    callbacks.onQuestions?.(questions);
                    break;
                  case "done":
                    callbacks.onDone?.();
                    resolve({
                      function_doc: accumulatedText,
                      doc_id: docId,
                      questions: questions,
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
          function_doc: accumulatedText,
          doc_id: docId,
          questions: questions,
        });
      })
      .catch((error) => {
        callbacks.onError?.(error);
        reject(error);
      });
  });
};
