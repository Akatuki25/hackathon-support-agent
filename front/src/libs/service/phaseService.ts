import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export interface PhaseHistory {
  from_phase: string;
  to_phase: string;
  timestamp: string;
}

export interface PhaseResponse {
  project_id: string;
  current_phase: string;
  phase_updated_at: string;
  phase_history?: PhaseHistory[];
}

/**
 * プロジェクトの現在のフェーズを取得
 */
export const getProjectPhase = async (projectId: string): Promise<PhaseResponse> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/project/${projectId}/phase`
  );
  return response.data;
};

/**
 * プロジェクトのフェーズを手動更新
 */
export const updateProjectPhase = async (
  projectId: string,
  phase: string
): Promise<PhaseResponse> => {
  const response = await axios.patch(
    `${API_BASE_URL}/api/project/${projectId}/phase`,
    { phase }
  );
  return response.data;
};

/**
 * フェーズに対応するページパスを取得
 */
export const getPagePathForPhase = (
  phase: string,
  projectId: string,
  userName?: string
): string => {
  const phaseToPath: Record<string, string> = {
    initial: "/hackSetUp",
    qa_editing: `/hackSetUp/${projectId}/hackQA`,
    summary_review: `/hackSetUp/${projectId}/summaryQA`,
    function_review: `/hackSetUp/${projectId}/functionSummary`,
    framework_selection: `/hackSetUp/${projectId}/selectFramework`,
    function_structuring: `/hackSetUp/${projectId}/functionStructuring`,
    task_management: userName
      ? `/${userName}/${projectId}/kanban`
      : `/hackSetUp/${projectId}/functionStructuring`,
  };

  return phaseToPath[phase] || "/hackSetUp";
};

/**
 * フェーズのラベルを取得
 */
export const getPhaseLabel = (phase: string): string => {
  const phaseLabels: Record<string, string> = {
    initial: "プロジェクト作成",
    qa_editing: "Q&A編集",
    summary_review: "要約確認",
    function_review: "機能確認",
    framework_selection: "技術選定",
    function_structuring: "機能構造化",
    task_management: "タスク管理",
  };

  return phaseLabels[phase] || phase;
};

/**
 * 次のフェーズを取得
 */
export const getNextPhaseInfo = async (projectId: string) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/project/${projectId}/phase/next`
  );
  return response.data;
};
