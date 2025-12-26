/**
 * ページコンテキスト対応チャットAPI
 *
 * 各ページで異なる役割を持つチャット機能を提供する。
 * ページごとに適切なコンテキストとアクションが設定される。
 */

import axios from 'axios';
import {
  PageContext,
  PageChatRequest,
  PageChatResponse,
  ChatMessageType,
  ChatAction,
  ChatContextsResponse,
  PageActionsResponse,
} from '@/types/modelTypes';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * ページコンテキスト対応チャットAPIを呼び出す
 *
 * @param projectId プロジェクトID
 * @param pageContext ページ識別子
 * @param message ユーザーメッセージ
 * @param history チャット履歴（オプション）
 * @param pageSpecificContext ページ固有の追加情報（オプション）
 * @returns チャットレスポンス
 */
export const sendPageChatMessage = async (
  projectId: string,
  pageContext: PageContext,
  message: string,
  history: ChatMessageType[] = [],
  pageSpecificContext?: Record<string, unknown>
): Promise<PageChatResponse> => {
  const requestData: PageChatRequest = {
    project_id: projectId,
    page_context: pageContext,
    message,
    history,
    page_specific_context: pageSpecificContext,
  };

  const response = await axios.post<PageChatResponse>(
    `${API_BASE_URL}/api/chat/message`,
    requestData
  );

  return response.data;
};

/**
 * 利用可能なページコンテキスト一覧を取得
 *
 * @returns コンテキスト一覧とアクションマッピング
 */
export const getChatContexts = async (): Promise<ChatContextsResponse> => {
  const response = await axios.get<ChatContextsResponse>(
    `${API_BASE_URL}/api/chat/contexts`
  );

  return response.data;
};

/**
 * 指定ページで利用可能なアクションを取得
 *
 * @param pageContext ページ識別子
 * @returns アクション一覧
 */
export const getPageActions = async (
  pageContext: PageContext
): Promise<PageActionsResponse> => {
  const response = await axios.get<PageActionsResponse>(
    `${API_BASE_URL}/api/chat/actions/${pageContext}`
  );

  return response.data;
};

/**
 * チャット履歴を構築するヘルパー
 *
 * @param messages 既存のメッセージ配列
 * @param role 追加するメッセージのロール
 * @param content 追加するメッセージの内容
 * @returns 更新されたメッセージ配列
 */
export const appendMessage = (
  messages: ChatMessageType[],
  role: 'user' | 'assistant',
  content: string
): ChatMessageType[] => {
  return [...messages, { role, content }];
};

/**
 * アクションを実行するためのコールバック型
 */
export type ActionHandler = (action: ChatAction) => void | Promise<void>;

/**
 * ストリーミングイベントの型
 */
export type StreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; actions: ChatAction[]; context_used: string[] }
  | { type: 'error'; message: string };

/**
 * ストリーミング対応チャットAPIを呼び出す
 *
 * @param projectId プロジェクトID
 * @param pageContext ページ識別子
 * @param message ユーザーメッセージ
 * @param history チャット履歴
 * @param pageSpecificContext ページ固有の追加情報
 * @param onChunk チャンク受信時のコールバック
 * @param onDone 完了時のコールバック
 * @param onError エラー時のコールバック
 */
export const sendPageChatMessageStream = async (
  projectId: string,
  pageContext: PageContext,
  message: string,
  history: ChatMessageType[] = [],
  pageSpecificContext?: Record<string, unknown>,
  onChunk?: (content: string) => void,
  onDone?: (actions: ChatAction[]) => void,
  onError?: (error: string) => void
): Promise<void> => {
  const requestData: PageChatRequest = {
    project_id: projectId,
    page_context: pageContext,
    message,
    history,
    page_specific_context: pageSpecificContext,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/message/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSEイベントをパース
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 未完了の行を保持

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as StreamEvent;

            switch (data.type) {
              case 'chunk':
                // contentがstring型であることを保証
                if (typeof data.content === 'string') {
                  onChunk?.(data.content);
                }
                break;
              case 'done':
                onDone?.(data.actions ?? []);
                break;
              case 'error':
                onError?.(data.message ?? 'Unknown error');
                break;
            }
          } catch {
            // JSONパースエラーは無視（不完全なデータの可能性）
          }
        }
      }
    }
  } catch (error) {
    onError?.(error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * ページごとのデフォルトプレースホルダーテキスト
 */
export const PAGE_PLACEHOLDERS: Record<PageContext, string> = {
  hackQA: '質問への回答についてアドバイスを求める...',
  summaryQA: '仕様書の改善について質問する...',
  functionSummary: '機能要件について質問する...',
  functionStructuring: '機能について質問する...',
  selectFramework: '技術選定について相談する...',
  kanban: 'タスク分担について相談する...',
  taskDetail: '実装について質問する...',
};

/**
 * ページごとの初期メッセージ
 */
export const PAGE_INITIAL_MESSAGES: Record<PageContext, string> = {
  hackQA:
    'Q&A回答をサポートします。質問への回答に困ったら、お気軽にご相談ください。',
  summaryQA:
    '仕様書のレビューをサポートします。改善点や不明確な部分を指摘します。',
  functionSummary:
    '機能要件の編集をサポートします。優先度の決め方や実装観点でのアドバイスをします。',
  functionStructuring:
    '機能設計をサポートします。機能の意図や優先度についてアドバイスします。',
  selectFramework:
    '技術選定をサポートします。各技術のメリット・デメリットを説明します。',
  kanban:
    'タスク分担をサポートします。負荷バランスや依存関係についてアドバイスします。',
  taskDetail:
    '実装をサポートします。コードの解説やエラー対応をお手伝いします。',
};
