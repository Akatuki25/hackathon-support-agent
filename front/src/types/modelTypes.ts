// UUIDs should be string in TypeScript for consistency with FastAPI
// All types are based on FastAPI Pydantic models in back/models/project_base.py and back/routers/project/*.py

// --- Member Types ---
export type MemberType = {
  member_id: string; // UUID from FastAPI is string
  member_name: string;
  member_skill: string;
  github_name: string;
  email?: string; // Optional as per FastAPI model
};

export type MemberResponseType = {
  member_id: string; // UUID from FastAPI is string
  message: string;
};

export type MemberPatch = Partial<MemberType>; // All fields optional for PATCH

// --- Project Types ---
export type ProjectType = {
  project_id?: string; // UUID from FastAPI is string
  title: string;
  idea: string;
  start_date: string; // date from FastAPI is string (YYYY-MM-DD)
  end_date: string; // datetime from FastAPI is string (ISO 8601)
  creator_member_id?: string; // プロジェクト作成者のmember_id（オプション）
};

export type ProjectResponseType = {
  project_id: string;
  message: string;
};

export type ProjectPatch = Partial<ProjectType>; // All fields optional for PATCH

// --- ProjectDocument Types ---
export type ProjectDocumentType = {
  doc_id?: string; // UUID from FastAPI is string
  project_id: string; // UUID from FastAPI is string
  specification: string;
  function_doc: string;
  frame_work_doc: string;
  directory_info: string;
};

export type ProjectDocumentResponseType = {
  project_id: string; // For create response
  message: string;
};

export type ProjectDocumentPatch = Partial<ProjectDocumentType>; // All fields optional for PATCH

// --- ProjectMember Types ---
export type ProjectMemberType = {
  project_member_id?: string; // UUID from FastAPI is string
  project_id: string; // UUID from FastAPI is string
  member_id: string; // UUID from FastAPI is string
  member_name: string;
};

export type ProjectMemberResponseType = {
  project_member_id: string;
  message: string;
};

export type ProjectMemberPatch = Partial<ProjectMemberType>; // All fields optional for PATCH

// --- Env Types ---
export type EnvType = {
  env_id?: string; // UUID from FastAPI is string
  project_id: string; // UUID from FastAPI is string
  front?: string;
  backend?: string;
  devcontainer?: string;
  database?: string;
  deploy?: string;
};

export type EnvResponseType = {
  env_id: string;
  message: string;
};

export type EnvPatch = Partial<EnvType>; // All fields optional for PATCH

// --- Task Types ---
export type TaskStatusEnum = "TODO" | "DOING" | "DONE";
export type PriorityEnum = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TaskType = {
  task_id?: string; // UUID from FastAPI is string
  project_id: string; // UUID from FastAPI is string
  title: string;
  description?: string;
  detail?: string;
  status?: TaskStatusEnum;
  priority?: PriorityEnum;
  due_at?: string; // datetime from FastAPI is string (ISO 8601)
  depends_on_task_id?: string; // UUID from FastAPI is string
  source_doc_id?: string; // UUID from FastAPI is string
  function_id?: string; // UUID from FastAPI is string
  node_id?: string;
  category?: string;
  start_time?: string;
  estimated_hours?: number;
  assignee?: string;
  completed?: boolean;
  position_x?: number;
  position_y?: number;
};

export type TaskResponseType = {
  task_id: string;
  message: string;
};

export type TaskPatch = Partial<TaskType>; // All fields optional for PATCH

// --- TaskAssignment Types ---
export type TaskAssignmentType = {
  task_assignment_id?: string; // UUID from FastAPI is string
  task_id: string; // UUID from FastAPI is string
  project_member_id: string; // UUID from FastAPI is string
  role?: string;
};

export type TaskAssignmentResponseType = {
  task_assignment_id: string;
  message: string;
};

export type TaskAssignmentPatch = Partial<TaskAssignmentType>; // All fields optional for PATCH

// --- TaskDependency Types ---
export type TaskDependencyType = {
  id: string; // UUID from FastAPI is string
  edge_id: string;
  source_task_id: string; // UUID from FastAPI is string
  target_task_id: string; // UUID from FastAPI is string
  source_node_id: string;
  target_node_id: string;
  is_animated: boolean;
  is_next_day: boolean;
};

// --- QA Types ---
export interface QAType {
  qa_id: string;
  project_id: string;
  question: string;
  answer?: string | null;
  is_ai: boolean;
  source_doc_id?: string | null;
  follows_qa_id?: string | null;
  importance: number;
  created_at?: string;
}

export interface QAPatch {
  project_id?: string;
  question?: string;
  answer?: string | null;
  is_ai?: boolean;
  source_doc_id?: string | null;
  follows_qa_id?: string | null;
  importance?: number;
}

export interface QAResponseType {
  qa_id: string;
  message: string;
}

/**
 * AIによるQ&A生成API (`POST /qas/{project_id}`) のリクエストボディ
 */
export interface IdeaPromptType {
  Prompt: string;
}

/**
 * AIによるQ&A生成API (`POST /qas/{project_id}`) のレスポンス
 */
export interface QuestionResponseType {
  QA: QAType[];
}

// --- Summary Types ---
export interface SummaryQaItem {
  Question: string;
  Answer: string;
}

export interface SummaryRequest {
  Answer: SummaryQaItem[];
}

export interface SummaryResponse {
  summary: string;
}

// --- Evaluation Types ---
export type MVPJudge = {
  mvp_feasible: boolean;
  score_0_100: number; // 0〜100 の範囲 (ランタイムでチェック推奨)
  confidence: number; // 0.0〜1.0 の範囲 (ランタイムでチェック推奨)
  qa: QAType[];
};

export type MissingInformation = {
  category: string;
  question: string;
  why_needed: string;
  priority: "high" | "medium" | "low";
};

export type SpecificationFeedback = {
  summary: string;
  strengths: string[];
  missing_info: MissingInformation[];
  suggestions: string[];
};

// Legacy ConfidenceFeedback type - deprecated, use SpecificationFeedback instead
export type ConfidenceFeedback = SpecificationFeedback;

// --- Reference URL Types (Google Search Grounding) ---
/**
 * 検索で取得した参照URL情報
 * Google Search Grounding や外部検索で取得したドキュメントへのリンク
 */
export type ReferenceUrl = {
  title: string; // ドキュメントのタイトル
  url: string; // URL
  snippet?: string; // 抜粋テキスト
  source?: string; // ソース種別 (grounding_chunk, documentation など)
};

// --- ChatHanson Types ---
export type ChatHansonRequest = {
  project_id: string; // Project ID
  user_question: string; // User's question
  chat_history?: string; // Chat history (optional)
  return_plan?: boolean; // Whether to return plan (optional, default: false)
  enable_search?: boolean; // Whether to enable web search (optional, default: true)
};

export type ChatHansonResponse = {
  answer: string; // AI-generated answer
  plan?: string; // Response plan (only when return_plan=true)
  reference_urls?: ReferenceUrl[]; // Reference URLs from search
};

export type ChatHansonPlanResponse = {
  plan: string; // Response plan only
};

// --- EnvSetup Types (AI Generated) ---

export type EnvSetupRequest = {
  project_id: string;
};

export type EnvSetupResponse = {
  env_id: string;
  project_id: string;
  front: string | null;
  backend: string | null;
  devcontainer: string | null;
  database: string | null;
  deploy: string | null;
  message: string;
  reference_urls?: ReferenceUrl[]; // Reference URLs from search
};

export type EnvGetResponse = {
  env_id: string;
  project_id: string;
  front: string | null;
  backend: string | null;
  devcontainer: string | null;
  database: string | null;
  deploy: string | null;
  created_at: string | null;
  reference_urls?: ReferenceUrl[]; // Reference URLs from search
};

// --- Environment Hands-on Types (Legacy API) ---
/**
 * 環境構築ハンズオン生成APIのレスポンス
 * /api/environment で使用
 */
export type EnvironmentHandsOnResponse = {
  overall: string; // 全体のハンズオン説明
  devcontainer: string; // .devcontainerの設定説明
  frontend: string; // フロントエンド構築手順
  backend: string; // バックエンド構築手順
  reference_urls?: ReferenceUrl[]; // 参照した公式ドキュメントURL
};

// --- Page Context Chat Types ---

/**
 * ページコンテキスト識別子
 * 各ページで異なるチャットの役割を持つ
 */
export type PageContext =
  | "hackQA" // Q&A回答支援
  | "summaryQA" // 仕様書レビュー
  | "functionSummary" // 機能要件書編集
  | "functionStructuring" // 機能設計支援
  | "selectFramework" // 技術選定支援
  | "kanban" // タスク分担支援
  | "taskDetail"; // タスク詳細・実装支援

/**
 * チャットで利用可能なアクションタイプ
 */
export type ChatActionType =
  // hackQA用
  | "suggest_answer" // 回答候補を提示
  | "add_question" // 追加質問を生成
  // functionStructuring用
  | "explain_function" // 機能の意図説明
  | "suggest_priority" // 優先度変更提案
  | "add_function" // 機能追加提案
  | "update_function" // 機能更新
  | "delete_function" // 機能削除
  // summaryQA/functionSummary用
  | "regenerate_questions" // 質問再生成
  // selectFramework用
  | "compare_tech" // 技術比較表示
  | "recommend_tech" // 技術推薦
  // kanban用
  | "suggest_assignee" // 担当者提案
  | "show_workload" // 負荷分析表示
  // taskDetail用
  | "explain_code" // コード解説
  | "show_hint" // 実装ヒント
  | "explain_error" // エラー原因説明
  | "adjust_hands_on"; // ハンズオン内容調整

/**
 * チャットメッセージ
 */
export type ChatMessageType = {
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * チャットが提案するアクション
 */
export type ChatAction = {
  action_type: ChatActionType;
  label: string;
  payload: Record<string, unknown>;
  requires_confirm: boolean;
};

/**
 * ページコンテキスト対応チャットのリクエスト
 */
export type PageChatRequest = {
  project_id: string;
  page_context: PageContext;
  message: string;
  history?: ChatMessageType[];
  page_specific_context?: Record<string, unknown>;
};

/**
 * ページコンテキスト対応チャットのレスポンス
 */
export type PageChatResponse = {
  message: string;
  suggested_actions: ChatAction[];
  context_used: string[];
  reference_urls?: ReferenceUrl[]; // 検索で参照したURL
};

/**
 * 利用可能なコンテキスト一覧のレスポンス
 */
export type ChatContextsResponse = {
  contexts: PageContext[];
  actions_by_context: Record<PageContext, ChatActionType[]>;
};

/**
 * ページごとのアクション一覧のレスポンス
 */
export type PageActionsResponse = {
  page_context: PageContext;
  actions: ChatActionType[];
};

// --- Change Request Types (仕様変更リクエスト) ---

/**
 * 変更リクエストのステータス
 */
export type ChangeRequestStatus = 'PROPOSING' | 'APPROVED' | 'APPLIED' | 'CANCELLED';

/**
 * 影響項目
 */
export type ImpactItem = {
  name: string;
  reason: string;
};

/**
 * 依存関係の変更
 */
export type DependencyChanges = {
  add: string[];
  remove: string[];
};

/**
 * 影響サマリー
 */
export type ImpactSummary = {
  tasks_to_discard: number;
  tasks_to_add: number;
  tasks_to_modify: number;
  dependencies_to_add?: number;
  dependencies_to_remove?: number;
};

/**
 * 変更項目（名前と理由）
 */
export type ChangeItem = {
  name: string;
  reason: string;
};

/**
 * 機能の追加
 */
export type FunctionChange = {
  function_name: string;
  description: string;
  category: string;
  priority: string;
  reason: string;
};

/**
 * 機能の変更
 */
export type FunctionModify = {
  target_name: string;
  description: string;
  reason: string;
};

/**
 * タスクの追加
 */
export type TaskChange = {
  title: string;
  description: string;
  category: string;
  priority: string;
  reason: string;
};

/**
 * タスクの変更
 */
export type TaskModify = {
  target_title: string;
  description: string;
  reason: string;
};

/**
 * 機能の変更提案
 */
export type FunctionsProposal = {
  keep: string[];
  discard: ChangeItem[];
  add: FunctionChange[];
  modify: FunctionModify[];
};

/**
 * タスクの変更提案
 */
export type TasksProposal = {
  discard: ChangeItem[];
  add: TaskChange[];
  modify: TaskModify[];
};

/**
 * 変更提案（API初期レスポンス用）
 */
export type ChangeProposal = {
  understood_intent?: string;
  approach: string;
  // 概要レベルの変更（LLMの意図理解）
  keep: (string | ImpactItem)[];
  discard: (string | ImpactItem)[];
  add: (string | ImpactItem)[];
  modify: (string | ImpactItem)[];
  // 機能の変更
  functions: FunctionsProposal;
  // タスクの変更（実際にカンバンに反映されるもの）
  tasks: TasksProposal;
  dependency_changes?: DependencyChanges;
  impact?: ImpactSummary;
};

/**
 * UI用の簡略化された提案
 * 注: revise後もkeep/discard/add/modifyが正しく表示されるよう、
 * トップレベルにもこれらのフィールドを含む
 */
export type ChangeProposalUI = {
  understood_intent?: string;
  approach: string;
  // トップレベルのkeep/discard/add/modify（revise後も正しく表示するため）
  keep?: (string | ImpactItem)[];
  discard?: (string | ImpactItem)[];
  add?: (string | ImpactItem)[];
  modify?: (string | ImpactItem)[];
  functions: FunctionsProposal;
  tasks: TasksProposal;
  dependency_changes?: DependencyChanges;
  impact: ImpactSummary;
};

/**
 * 対話メッセージ
 */
export type ChangeConversationMessage = {
  role: 'user' | 'assistant';
  content?: string;
  type?: 'proposal';
  summary?: string;
  timestamp: string;
};

/**
 * 変更リクエストのレスポンス
 */
export type ChangeRequestResponse = {
  request_id: string;
  status: ChangeRequestStatus;
  proposal?: ChangeProposal | ChangeProposalUI;
  conversation: ChangeConversationMessage[];
};

/**
 * 変更リクエスト作成のリクエスト
 */
export type ProposeChangeRequest = {
  project_id: string;
  description: string;
};

/**
 * 修正要求のリクエスト
 */
export type ReviseChangeRequest = {
  feedback: string;
};

/**
 * 承認後のレスポンス
 */
export type ApprovalResponse = {
  request_id: string;
  status: 'APPLIED';
  changes_applied: {
    specification_updated: boolean;
    function_doc_updated: boolean;
    functions_added: string[];
    functions_deleted: string[];
    functions_modified: string[];
    tasks_added: string[];
    tasks_deleted: string[];
    tasks_modified: string[];
  };
};

/**
 * 変更リクエストの全情報
 */
export type FullChangeRequest = {
  request_id: string;
  project_id: string;
  description: string;
  status: ChangeRequestStatus;
  proposal?: ChangeProposal | ChangeProposalUI;
  conversation: ChangeConversationMessage[];
  created_at?: string;
  updated_at?: string;
};
