"use client";

import { useState, useCallback } from 'react';
import {
  proposeChange,
  reviseChange,
  approveChange,
  cancelChange,
  getChangeRequest,
} from '@/libs/service/changeRequest';
import type {
  ChangeRequestResponse,
  ApprovalResponse,
  ChangeConversationMessage,
} from '@/types/modelTypes';

interface UseChangeRequestState {
  /** 現在の変更リクエストID */
  requestId: string | null;
  /** 現在のステータス */
  status: 'idle' | 'proposing' | 'revising' | 'approving' | 'cancelling' | 'error';
  /** 現在の提案 */
  proposal: ChangeRequestResponse['proposal'] | null;
  /** 対話履歴 */
  conversation: ChangeConversationMessage[];
  /** 適用結果 */
  appliedChanges: ApprovalResponse['changes_applied'] | null;
  /** エラーメッセージ */
  error: string | null;
  /** ローディング中かどうか */
  isLoading: boolean;
}

interface UseChangeRequestActions {
  /** 変更提案を作成 */
  propose: (projectId: string, description: string) => Promise<void>;
  /** 修正要求を送信 */
  revise: (feedback: string) => Promise<void>;
  /** 変更を承認・適用 */
  approve: () => Promise<void>;
  /** 変更をキャンセル */
  cancel: () => Promise<void>;
  /** 状態をリセット */
  reset: () => void;
  /** 既存のリクエストを読み込む */
  loadRequest: (requestId: string) => Promise<void>;
}

export type UseChangeRequestReturn = UseChangeRequestState & UseChangeRequestActions;

/**
 * 仕様変更リクエストを管理するカスタムフック
 *
 * @example
 * ```tsx
 * const {
 *   requestId,
 *   status,
 *   proposal,
 *   conversation,
 *   isLoading,
 *   propose,
 *   revise,
 *   approve,
 *   cancel,
 * } = useChangeRequest();
 *
 * // 変更提案を作成
 * await propose(projectId, "LINE Botベースにしたい");
 *
 * // 修正要求を送信
 * await revise("通知機能もLINE Pushにしたい");
 *
 * // 変更を承認・適用
 * await approve();
 * ```
 */
export function useChangeRequest(): UseChangeRequestReturn {
  const [state, setState] = useState<UseChangeRequestState>({
    requestId: null,
    status: 'idle',
    proposal: null,
    conversation: [],
    appliedChanges: null,
    error: null,
    isLoading: false,
  });

  /**
   * 変更提案を作成
   */
  const propose = useCallback(async (projectId: string, description: string) => {
    setState(prev => ({
      ...prev,
      status: 'proposing',
      isLoading: true,
      error: null,
    }));

    try {
      const response = await proposeChange(projectId, description);
      setState(prev => ({
        ...prev,
        requestId: response.request_id,
        status: 'idle',
        proposal: response.proposal ?? null,
        conversation: response.conversation,
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '変更提案の作成に失敗しました';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: message,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  /**
   * 修正要求を送信
   */
  const revise = useCallback(async (feedback: string) => {
    if (!state.requestId) {
      throw new Error('変更リクエストが存在しません');
    }

    setState(prev => ({
      ...prev,
      status: 'revising',
      isLoading: true,
      error: null,
    }));

    try {
      const response = await reviseChange(state.requestId, feedback);
      setState(prev => ({
        ...prev,
        status: 'idle',
        proposal: response.proposal ?? null,
        conversation: response.conversation,
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '修正要求の処理に失敗しました';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: message,
        isLoading: false,
      }));
      throw error;
    }
  }, [state.requestId]);

  /**
   * 変更を承認・適用
   */
  const approve = useCallback(async () => {
    if (!state.requestId) {
      throw new Error('変更リクエストが存在しません');
    }

    setState(prev => ({
      ...prev,
      status: 'approving',
      isLoading: true,
      error: null,
    }));

    try {
      const response = await approveChange(state.requestId);
      setState(prev => ({
        ...prev,
        status: 'idle',
        appliedChanges: response.changes_applied,
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '変更の適用に失敗しました';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: message,
        isLoading: false,
      }));
      throw error;
    }
  }, [state.requestId]);

  /**
   * 変更をキャンセル
   */
  const cancel = useCallback(async () => {
    if (!state.requestId) {
      throw new Error('変更リクエストが存在しません');
    }

    setState(prev => ({
      ...prev,
      status: 'cancelling',
      isLoading: true,
      error: null,
    }));

    try {
      await cancelChange(state.requestId);
      setState({
        requestId: null,
        status: 'idle',
        proposal: null,
        conversation: [],
        appliedChanges: null,
        error: null,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'キャンセルに失敗しました';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: message,
        isLoading: false,
      }));
      throw error;
    }
  }, [state.requestId]);

  /**
   * 状態をリセット
   */
  const reset = useCallback(() => {
    setState({
      requestId: null,
      status: 'idle',
      proposal: null,
      conversation: [],
      appliedChanges: null,
      error: null,
      isLoading: false,
    });
  }, []);

  /**
   * 既存のリクエストを読み込む
   */
  const loadRequest = useCallback(async (requestId: string) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await getChangeRequest(requestId);
      setState({
        requestId: response.request_id,
        status: 'idle',
        proposal: response.proposal ?? null,
        conversation: response.conversation,
        appliedChanges: null,
        error: null,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'リクエストの読み込みに失敗しました';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: message,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  return {
    ...state,
    propose,
    revise,
    approve,
    cancel,
    reset,
    loadRequest,
  };
}

export default useChangeRequest;
