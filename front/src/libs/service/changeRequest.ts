/**
 * 仕様変更リクエストサービス
 *
 * AIチャットを通じて仕様変更を提案し、既存のプロジェクト生成フローと同じ分割で
 * ドキュメント・機能・タスクを更新するシステム。
 *
 * ワークフロー:
 * 1. proposeChange() - 変更提案を作成
 * 2. reviseChange() - 修正要求を処理（繰り返し可能）
 * 3. approveChange() - 変更を適用 または cancelChange() - キャンセル
 */

import axios from 'axios';
import {
  ChangeRequestResponse,
  ApprovalResponse,
  FullChangeRequest,
  ProposeChangeRequest,
  ReviseChangeRequest,
} from '@/types/modelTypes';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 変更提案を作成する
 *
 * ユーザーの変更要望を分析し、最小スコープの変更提案を生成する。
 * 提案には機能・タスクの追加/変更/削除が含まれる。
 *
 * @param projectId - プロジェクトID
 * @param description - 変更要望（例: "LINE Botベースにしたい"）
 * @returns 変更リクエストのレスポンス
 *
 * @example
 * const result = await proposeChange(projectId, "LINE Botベースにしたい");
 * // result.request_id を使って以降の操作を行う
 * // result.proposal に変更提案の詳細が含まれる
 */
export const proposeChange = async (
  projectId: string,
  description: string
): Promise<ChangeRequestResponse> => {
  const response = await axios.post<ChangeRequestResponse>(
    `${API_BASE_URL}/api/change/propose`,
    {
      project_id: projectId,
      description: description,
    } as ProposeChangeRequest
  );
  return response.data;
};

/**
 * 修正要求を処理する
 *
 * ユーザーの修正要求を受けて、提案を更新する。
 * 差分ベースで更新されるため、既存の提案に修正が追加される。
 *
 * @param requestId - 変更リクエストID
 * @param feedback - 修正内容（例: "通知機能もLINE Pushにしたい"）
 * @returns 更新された変更リクエストのレスポンス
 *
 * @example
 * // 1. 初回提案で「フロントをLINE Bot化」が提案される
 * const initial = await proposeChange(projectId, "LINE Botにしたい");
 *
 * // 2. ユーザーが追加の要望がある場合
 * const revised = await reviseChange(initial.request_id, "通知もLINE Pushにしたい");
 * // revised.proposal に更新された提案が含まれる
 */
export const reviseChange = async (
  requestId: string,
  feedback: string
): Promise<ChangeRequestResponse> => {
  const response = await axios.post<ChangeRequestResponse>(
    `${API_BASE_URL}/api/change/${requestId}/revise`,
    {
      feedback: feedback,
    } as ReviseChangeRequest
  );
  return response.data;
};

/**
 * 変更を承認・適用する
 *
 * 提案された変更をDBに適用する。
 * この操作は不可逆であり、適用後はキャンセルできない。
 *
 * @param requestId - 変更リクエストID
 * @returns 適用結果
 *
 * @example
 * const result = await approveChange(requestId);
 * // result.changes_applied に適用された変更の詳細が含まれる
 * // result.changes_applied.tasks_added - 追加されたタスク
 * // result.changes_applied.tasks_deleted - 削除されたタスク
 */
export const approveChange = async (
  requestId: string
): Promise<ApprovalResponse> => {
  const response = await axios.post<ApprovalResponse>(
    `${API_BASE_URL}/api/change/${requestId}/approve`
  );
  return response.data;
};

/**
 * 変更をキャンセルする
 *
 * 提案中の変更をキャンセルする。
 * 既に適用済み（APPLIED）の変更はキャンセルできない。
 *
 * @param requestId - 変更リクエストID
 * @returns キャンセル結果
 */
export const cancelChange = async (
  requestId: string
): Promise<{ request_id: string; status: 'CANCELLED' }> => {
  const response = await axios.post<{ request_id: string; status: 'CANCELLED' }>(
    `${API_BASE_URL}/api/change/${requestId}/cancel`
  );
  return response.data;
};

/**
 * 変更リクエストを取得する
 *
 * @param requestId - 変更リクエストID
 * @returns 変更リクエストの全情報
 */
export const getChangeRequest = async (
  requestId: string
): Promise<FullChangeRequest> => {
  const response = await axios.get<FullChangeRequest>(
    `${API_BASE_URL}/api/change/${requestId}`
  );
  return response.data;
};

/**
 * 変更提案の表示用ヘルパー
 *
 * ImpactItem 形式と string 形式の両方に対応して名前を取得する
 */
export const getItemName = (item: string | { name: string }): string => {
  if (typeof item === 'string') {
    return item;
  }
  return item.name;
};

/**
 * 変更提案の表示用ヘルパー
 *
 * ImpactItem 形式の場合は理由も取得する
 */
export const getItemReason = (item: string | { name: string; reason?: string }): string | undefined => {
  if (typeof item === 'string') {
    return undefined;
  }
  return item.reason;
};
