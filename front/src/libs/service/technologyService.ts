import axios from 'axios';

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 技術ドキュメント生成で使用する型定義
export interface TechnologyDocumentRequest {
  selected_technologies: string[];
  framework_doc?: string;
}

export interface TechnologyDocumentResponse {
  message: string;
  technology_document: string;
}

export interface InstallationGuideRequest {
  technology_name: string;
}

export interface InstallationGuideResponse {
  installation_steps: string[];
  docker_setup: string[];
  official_docs: string;
  getting_started_guide: string;
  prerequisites: string[];
}

export interface EnvironmentSetupRequest {
  selected_technologies: string[];
  project_type?: string;
}

export interface EnvironmentSetupResponse {
  message: string;
  environment_setup: string;
}

/**
 * 選択された技術に基づいて技術ドキュメントを生成
 */
export const generateTechnologyDocument = async (
  request: TechnologyDocumentRequest
): Promise<TechnologyDocumentResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/technology/document`,
    request,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * 特定の技術のインストールガイドを取得
 */
export const getInstallationGuide = async (
  request: InstallationGuideRequest
): Promise<InstallationGuideResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/technology/installation-guide`,
    request,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * 統合的な開発環境セットアップガイドを生成
 */
export const generateEnvironmentSetup = async (
  request: EnvironmentSetupRequest
): Promise<EnvironmentSetupResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/technology/environment-setup`,
    request,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};