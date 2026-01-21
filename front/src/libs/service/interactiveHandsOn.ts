/**
 * インタラクティブハンズオンAPI
 *
 * SSEストリーミングで段階的にハンズオンを生成し、
 * 必要に応じて選択肢を提示する対話型API。
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const INTERACTIVE_HANDS_ON_URL = `${API_BASE_URL}/api/interactive-hands-on`;

// =====================================================
// 型定義
// =====================================================

export interface ChoiceOption {
  id: string;
  label: string;
  description: string;
  pros?: string[];
  cons?: string[];
}

export interface ChoiceRequest {
  choice_id: string;
  question: string;
  options: ChoiceOption[];
  allow_custom: boolean;
  skip_allowed: boolean;
  research_hint?: string;
}

export interface InputPrompt {
  prompt_id: string;
  question: string;
  placeholder?: string;
  options?: string[];
}

export interface StepConfirmationPrompt {
  prompt_id: string;
  question: string;
  options: string[];
}

export type HandsOnStreamEvent =
  | { type: 'context'; position: string; dependencies: string[]; dependents: string[] }
  | { type: 'section_start'; section: string }
  | { type: 'chunk'; content: string }
  | { type: 'section_complete'; section: string }
  | { type: 'choice_required'; choice: ChoiceRequest }
  | { type: 'user_input_required'; prompt: InputPrompt }
  | { type: 'step_start'; step_number: number; step_title: string; total_steps: number }
  | { type: 'step_complete'; step_number: number }
  | { type: 'step_confirmation_required'; prompt: StepConfirmationPrompt }
  | { type: 'progress_saved'; phase: string }
  | { type: 'redirect_to_chat'; message: string; step_number: number }
  | { type: 'done'; hands_on_id: string; session_id: string }
  | { type: 'error'; message: string }
  // User response echo
  | { type: 'user_response'; response_type: string; choice_id?: string; selected?: string; user_input?: string; user_note?: string }
  // Resume events
  | { type: 'session_restored'; session_id: string; phase: string }
  | { type: 'restored_content'; section: string; content: string }
  | { type: 'restored_steps'; steps: RestoredStep[]; current_step: number }
  | { type: 'restored_decisions'; decisions: RestoredDecision[] }
  | { type: 'restored_user_response'; response_type: string; display_text: string };

export interface StartSessionConfig {
  model?: string;
}

export interface UserResponse {
  response_type: 'choice' | 'input' | 'skip';
  choice_id?: string;
  selected?: string;
  user_input?: string;
  user_note?: string;
}

export interface SessionStatus {
  success: boolean;
  session_id: string;
  task_id: string;
  phase: string;
  has_pending_choice: boolean;
  has_pending_input: boolean;
  generated_sections: string[];
  user_choices: Record<string, unknown>;
}

export interface HandsOnExistsCheck {
  exists: boolean;
  hands_on_id: string | null;
  generated_at: string | null;
  quality_score: number | null;
  generation_state: string | null;
  can_resume: boolean;
  progress: {
    phase: string;
    completed_steps: number;
    total_steps: number;
    has_pending_input: boolean;
    pending_input: InputPrompt | null;
  } | null;
}

export interface RestoredStep {
  step_number: number;
  title: string;
  description: string;
  is_completed: boolean;
  content: string;
}

export interface RestoredDecision {
  step_number: number;
  description: string;
}

export interface HandsOnContent {
  success: boolean;
  hands_on_id: string;
  generation_state: string;
  context: string;
  overview: string;
  steps: RestoredStep[];
  decisions: RestoredDecision[];
  verification: string;
}

// =====================================================
// イベントコールバック型
// =====================================================

export interface StreamCallbacks {
  onContext?: (position: string, dependencies: string[], dependents: string[]) => void;
  onSectionStart?: (section: string) => void;
  onChunk?: (content: string) => void;
  onSectionComplete?: (section: string) => void;
  onChoiceRequired?: (choice: ChoiceRequest) => void;
  onInputRequired?: (prompt: InputPrompt) => void;
  onStepStart?: (stepNumber: number, stepTitle: string, totalSteps: number) => void;
  onStepComplete?: (stepNumber: number) => void;
  onStepConfirmationRequired?: (prompt: StepConfirmationPrompt) => void;
  onProgressSaved?: (phase: string) => void;
  onRedirectToChat?: (message: string, stepNumber: number) => void;
  onDone?: (handsOnId: string, sessionId: string) => void;
  onError?: (message: string) => void;
  // User response echo
  onUserResponse?: (responseType: string, selected?: string, userInput?: string, userNote?: string) => void;
  // Resume callbacks
  onSessionRestored?: (sessionId: string, phase: string) => void;
  onRestoredContent?: (section: string, content: string) => void;
  onRestoredSteps?: (steps: RestoredStep[], currentStep: number) => void;
  onRestoredDecisions?: (decisions: RestoredDecision[]) => void;
  onRestoredUserResponse?: (responseType: string, displayText: string) => void;
}

// =====================================================
// SSE ストリーム処理
// =====================================================

/**
 * SSEストリームを処理する汎用関数
 */
async function processSSEStream(
  response: Response,
  callbacks: StreamCallbacks
): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.('Response body is not readable');
    return null;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let sessionId: string | null = null;

  // ヘッダーからセッションIDを取得
  sessionId = response.headers.get('X-Session-Id');

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSEイベントをパース
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as HandsOnStreamEvent;

            switch (data.type) {
              case 'context':
                callbacks.onContext?.(data.position, data.dependencies, data.dependents);
                break;
              case 'section_start':
                callbacks.onSectionStart?.(data.section);
                break;
              case 'chunk':
                callbacks.onChunk?.(data.content);
                break;
              case 'section_complete':
                callbacks.onSectionComplete?.(data.section);
                break;
              case 'choice_required':
                callbacks.onChoiceRequired?.(data.choice);
                break;
              case 'user_input_required':
                callbacks.onInputRequired?.(data.prompt);
                break;
              case 'step_start':
                callbacks.onStepStart?.(data.step_number, data.step_title, data.total_steps);
                break;
              case 'step_complete':
                callbacks.onStepComplete?.(data.step_number);
                break;
              case 'step_confirmation_required':
                callbacks.onStepConfirmationRequired?.(data.prompt);
                break;
              case 'progress_saved':
                callbacks.onProgressSaved?.(data.phase);
                break;
              case 'redirect_to_chat':
                callbacks.onRedirectToChat?.(data.message, data.step_number);
                break;
              case 'done':
                sessionId = data.session_id;
                callbacks.onDone?.(data.hands_on_id, data.session_id);
                break;
              case 'error':
                callbacks.onError?.(data.message);
                break;
              // User response echo
              case 'user_response':
                callbacks.onUserResponse?.(data.response_type, data.selected, data.user_input, data.user_note);
                break;
              // Resume events
              case 'session_restored':
                sessionId = data.session_id;
                callbacks.onSessionRestored?.(data.session_id, data.phase);
                break;
              case 'restored_content':
                callbacks.onRestoredContent?.(data.section, data.content);
                break;
              case 'restored_steps':
                callbacks.onRestoredSteps?.(data.steps, data.current_step);
                break;
              case 'restored_decisions':
                callbacks.onRestoredDecisions?.(data.decisions);
                break;
              case 'restored_user_response':
                callbacks.onRestoredUserResponse?.(data.response_type, data.display_text);
                break;
            }
          } catch {
            // JSONパースエラーは無視
          }
        }
      }
    }
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error.message : 'Stream error');
  }

  return sessionId;
}

// =====================================================
// API関数
// =====================================================

/**
 * インタラクティブセッションを開始
 *
 * @param taskId タスクID
 * @param callbacks イベントコールバック
 * @param config オプション設定
 * @returns セッションID
 */
export async function startInteractiveSession(
  taskId: string,
  callbacks: StreamCallbacks,
  config?: StartSessionConfig
): Promise<string | null> {
  try {
    const response = await fetch(`${INTERACTIVE_HANDS_ON_URL}/${taskId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config: config || {} }),
    });

    if (!response.ok) {
      const error = await response.json();
      callbacks.onError?.(error.detail || 'Failed to start session');
      return null;
    }

    return await processSSEStream(response, callbacks);
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error.message : 'Network error');
    return null;
  }
}

/**
 * ユーザー応答を送信
 *
 * @param sessionId セッションID
 * @param response ユーザー応答
 * @param callbacks イベントコールバック
 */
export async function sendUserResponse(
  sessionId: string,
  userResponse: UserResponse,
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const response = await fetch(
      `${INTERACTIVE_HANDS_ON_URL}/session/${sessionId}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userResponse),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      callbacks.onError?.(error.detail || 'Failed to send response');
      return;
    }

    await processSSEStream(response, callbacks);
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error.message : 'Network error');
  }
}

/**
 * セッション状態を取得
 *
 * @param sessionId セッションID
 * @returns セッション状態
 */
export async function getSessionStatus(sessionId: string): Promise<SessionStatus | null> {
  try {
    const response = await fetch(
      `${INTERACTIVE_HANDS_ON_URL}/session/${sessionId}/status`
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * セッションを削除
 *
 * @param sessionId セッションID
 * @returns 成功したかどうか
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${INTERACTIVE_HANDS_ON_URL}/session/${sessionId}`,
      { method: 'DELETE' }
    );

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * ハンズオンの存在チェック
 *
 * @param taskId タスクID
 * @returns 存在チェック結果
 */
export async function checkHandsOnExists(taskId: string): Promise<HandsOnExistsCheck | null> {
  try {
    const response = await fetch(`${INTERACTIVE_HANDS_ON_URL}/${taskId}/check`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * インタラクティブセッションを再開
 *
 * DBに保存された進捗からセッションを復元し、再開する。
 *
 * @param taskId タスクID
 * @param callbacks イベントコールバック
 * @param config オプション設定
 * @returns セッションID
 */
export async function resumeInteractiveSession(
  taskId: string,
  callbacks: StreamCallbacks,
  config?: StartSessionConfig
): Promise<string | null> {
  try {
    const response = await fetch(`${INTERACTIVE_HANDS_ON_URL}/${taskId}/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config: config || {} }),
    });

    if (!response.ok) {
      const error = await response.json();
      callbacks.onError?.(error.detail || 'Failed to resume session');
      return null;
    }

    return await processSSEStream(response, callbacks);
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error.message : 'Network error');
    return null;
  }
}

/**
 * 完了済みハンズオンの内容を取得
 *
 * @param taskId タスクID
 * @returns ハンズオン内容
 */
export async function getHandsOnContent(taskId: string): Promise<HandsOnContent | null> {
  try {
    const response = await fetch(`${INTERACTIVE_HANDS_ON_URL}/${taskId}/content`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}
