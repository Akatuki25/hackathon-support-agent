import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface FinalizedIdea {
  title: string;
  idea: string;
}

export interface IdeaProposal {
  title: string;
  description: string;
}

/**
 * SSEイベントをパースする
 * event: xxx と data: {...} のペアを解析
 */
function parseSSEEvents(buffer: string): { events: Array<{ event: string; data: unknown }>; remaining: string } {
  const events: Array<{ event: string; data: unknown }> = [];
  const lines = buffer.split("\n");

  let currentEvent = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith("data: ") && currentEvent) {
      try {
        const data = JSON.parse(line.slice(6));
        events.push({ event: currentEvent, data });
        currentEvent = "";
      } catch {
        // JSONパースエラーは無視
      }
    } else if (line === "" && currentEvent) {
      // 空行でイベント終了
      currentEvent = "";
    }

    i++;
  }

  // 最後の不完全なイベントをバッファに残す
  const lastNewline = buffer.lastIndexOf("\n\n");
  const remaining = lastNewline >= 0 ? buffer.slice(lastNewline + 2) : buffer;

  return { events, remaining };
}

/**
 * アイデア発想サポートチャット（ストリーミング）
 *
 * SSEイベント形式:
 * - event: chunk -> {"content": "..."} テキストチャンク
 * - event: proposal -> {"title": "...", "description": "..."} アイデア提案
 * - event: done -> {"ok": true} 完了
 * - event: error -> {"message": "..."} エラー
 *
 * @param message ユーザーのメッセージ
 * @param chatHistory これまでのチャット履歴
 * @param onChunk 各チャンクを受け取るコールバック
 * @param onProposal 提案を受け取るコールバック
 * @param onDone 完了時のコールバック
 * @param onError エラー時のコールバック
 */
export async function chatWithIdeaSupportStream(
  message: string,
  chatHistory: ChatMessage[],
  onChunk: (content: string) => void,
  onProposal: (proposal: IdeaProposal) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/idea_support/chat/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          chat_history: chatHistory,
        }),
      }
    );

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
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSEイベントを解析
      const { events, remaining } = parseSSEEvents(buffer);
      buffer = remaining;

      for (const { event, data } of events) {
        switch (event) {
          case "chunk": {
            const chunkData = data as { content: string };
            if (chunkData.content) {
              onChunk(chunkData.content);
            }
            break;
          }
          case "proposal": {
            const proposalData = data as IdeaProposal;
            if (proposalData.title && proposalData.description) {
              onProposal(proposalData);
            }
            break;
          }
          case "done":
            onDone();
            break;
          case "error": {
            const errorData = data as { message: string };
            onError(errorData.message || "Unknown error");
            break;
          }
        }
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    onError(errorMessage);
  }
}

/**
 * チャット履歴からアイデアを確定
 *
 * @param chatHistory チャット履歴
 * @returns 確定したタイトルとアイデア
 */
export async function finalizeIdea(
  chatHistory: ChatMessage[]
): Promise<FinalizedIdea> {
  const response = await axios.post<FinalizedIdea>(
    `${API_BASE_URL}/api/idea_support/finalize`,
    {
      chat_history: chatHistory,
    }
  );

  return response.data;
}
