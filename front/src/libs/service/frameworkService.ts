import axios from 'axios';

// 環境変数からAPIのベースURLを取得。なければデフォルト値を設定。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// フレームワーク推薦で使用する型定義
export interface TechnologyOption {
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'deployment';
  description: string;
  pros: string[];
  cons: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  recommended?: boolean;
  priority?: number;
  reason?: string;
}

export interface RecommendedTechnology {
  name: string;
  priority: number;
  reason: string;
}

export interface FrameworkRecommendationResponse {
  recommended_technologies: RecommendedTechnology[];
}

export interface FrameworkSelectionRequest {
  project_id: string;
  specification: string;
  platforms: ('web' | 'ios' | 'android')[];
  team_experience?: {
    frontend?: string[];
    backend?: string[];
    mobile?: string[];
  };
  project_constraints?: {
    timeline?: string;
    budget?: string;
    team_size?: number;
  };
}

export interface FrameworkSelectionSaveRequest {
  project_id: string;
  selected_platform: 'web' | 'ios' | 'android';
  selected_technologies: string[];
  reasoning?: string;
}

export interface FrameworkSelectionResponse {
  message: string;
  doc_id: string;
  framework_document: string;
}

/**
 * プロジェクト仕様と機能ドキュメントに基づいて推薦技術を取得
 */
export const getFrameworkRecommendations = async (
  specification: string,
  functionDoc: string = ""
): Promise<FrameworkRecommendationResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/framework/recommendations`,
    {
      specification,
      function_doc: functionDoc
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};



/**
 * プラットフォーム別の技術オプションを取得
 */
export const getTechnologyOptions = async (
  platform: 'web' | 'ios' | 'android'
): Promise<TechnologyOption[]> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/framework/technology-options/${platform}`,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * 保存されたフレームワーク選択情報を取得
 */
export const getFrameworkSelection = async (
  projectId: string
): Promise<{
  selected_platform: string;
  selected_technologies: string[];
  framework_document: string;
  reasoning: string;
}> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/framework/selection/${projectId}`,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * フレームワーク技術要件定義書を生成
 */
export const generateFrameworkDocument = async (
  projectId: string,
  specification: string,
  selectedTechnologies: string[]
): Promise<FrameworkSelectionResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/framework/generate-document`,
    {
      project_id: projectId,
      specification,
      selected_technologies: selectedTechnologies
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};

/**
 * フレームワーク選択の妥当性を評価
 */
export const evaluateFrameworkChoice = async (
  specification: string,
  selectedTechnologies: string[],
  platform: 'web' | 'ios' | 'android'
): Promise<{
  score: number;
  feedback: string[];
  alternatives: TechnologyOption[];
  risks: string[];
}> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/framework/evaluate-choice`,
    {
      specification,
      selected_technologies: selectedTechnologies,
      platform
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return response.data;
};