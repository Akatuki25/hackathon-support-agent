/**
 * 環境構築AIエージェント API連携サービス
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- 型定義 ---

export interface EnvSetupRequest {
  project_id: string;
}

export interface EnvSetupResponse {
  env_id: string;
  project_id: string;
  front: string | null;
  backend: string | null;
  devcontainer: string | null;
  database: string | null;
  deploy: string | null;
  message: string;
}

export interface EnvGetResponse {
  env_id: string;
  project_id: string;
  front: string | null;
  backend: string | null;
  devcontainer: string | null;
  database: string | null;
  deploy: string | null;
  created_at: string | null;
}

// --- API関数 ---

/**
 * 環境構築情報をAIで生成してDBに保存
 * @param projectId プロジェクトID
 * @returns 生成された環境構築情報
 */
export const generateEnvSetup = async (projectId: string): Promise<EnvSetupResponse> => {
  const response = await axios.post<EnvSetupResponse>(
    `${API_BASE_URL}/api/env_setup/generate`,
    { project_id: projectId },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * 環境構築情報を再生成（既存データを削除して再生成）
 * @param projectId プロジェクトID
 * @returns 再生成された環境構築情報
 */
export const regenerateEnvSetup = async (projectId: string): Promise<EnvSetupResponse> => {
  const response = await axios.post<EnvSetupResponse>(
    `${API_BASE_URL}/api/env_setup/regenerate/${projectId}`,
    {},
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * 環境構築情報を取得
 * @param projectId プロジェクトID
 * @returns 環境構築情報（存在しない場合は404エラー）
 */
export const getEnvSetup = async (projectId: string): Promise<EnvGetResponse> => {
  const response = await axios.get<EnvGetResponse>(
    `${API_BASE_URL}/api/env_setup/${projectId}`,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * 環境構築情報を取得（存在しない場合はnullを返す）
 * @param projectId プロジェクトID
 * @returns 環境構築情報またはnull
 */
export const getEnvSetupOrNull = async (projectId: string): Promise<EnvGetResponse | null> => {
  try {
    return await getEnvSetup(projectId);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * 環境構築情報を生成または取得
 * 既に存在する場合は取得、存在しない場合は生成
 * @param projectId プロジェクトID
 * @returns 環境構築情報
 */
export const getOrGenerateEnvSetup = async (projectId: string): Promise<EnvSetupResponse | EnvGetResponse> => {
  // まず既存データを確認
  const existing = await getEnvSetupOrNull(projectId);
  if (existing) {
    return existing;
  }

  // 存在しない場合は生成
  return await generateEnvSetup(projectId);
};
