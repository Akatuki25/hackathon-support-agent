'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Loader2, Play, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  startInteractiveSession,
  sendUserResponse,
  checkHandsOnExists,
  getSessionStatus,
  deleteSession,
  resumeInteractiveSession,
  type ChoiceRequest,
  type InputPrompt,
  type StepConfirmationPrompt,
  type StreamCallbacks,
  type SessionStatus,
  type HandsOnExistsCheck,
  type RestoredDecision,
} from '@/libs/service/interactiveHandsOn';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Project {
  project_id: string;
  title: string;
  idea: string;
}

interface Task {
  task_id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string | null;
}

interface EventLog {
  timestamp: string;
  type: string;
  data: unknown;
}

export default function InteractiveHandsOnTestPage() {
  // 状態
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 生成状態
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<ChoiceRequest | null>(null);
  const [pendingInput, setPendingInput] = useState<InputPrompt | null>(null);
  const [pendingStepConfirmation, setPendingStepConfirmation] = useState<StepConfirmationPrompt | null>(null);
  const [position, setPosition] = useState<{
    description: string;
    dependencies: string[];
    dependents: string[];
  } | null>(null);

  // ステップ進捗
  const [stepProgress, setStepProgress] = useState<{
    currentStep: number;
    totalSteps: number;
    currentStepTitle: string;
    completedSteps: number[];
  } | null>(null);

  // 既存の進捗情報
  const [existingProgress, setExistingProgress] = useState<HandsOnExistsCheck | null>(null);
  const [isCheckingProgress, setIsCheckingProgress] = useState(false);

  // 採用済み決定事項
  const [decisions, setDecisions] = useState<RestoredDecision[]>([]);

  // UI状態
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [userNote, setUserNote] = useState('');
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // ログ追加
  const addLog = useCallback((type: string, data: unknown) => {
    const log: EventLog = {
      timestamp: new Date().toISOString().split('T')[1].split('.')[0],
      type,
      data,
    };
    setEventLogs(prev => [...prev, log]);
    // 自動スクロール
    setTimeout(() => {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // プロジェクト一覧取得
  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/projectsAll`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);
      addLog('PROJECTS_LOADED', { count: data.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      addLog('ERROR', { message });
    } finally {
      setIsLoadingProjects(false);
    }
  }, [addLog]);

  // タスク一覧取得
  const fetchTasks = useCallback(async (projectId: string) => {
    setIsLoadingTasks(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/task/project/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      setTasks(data);
      addLog('TASKS_LOADED', { projectId, count: data.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      addLog('ERROR', { message });
    } finally {
      setIsLoadingTasks(false);
    }
  }, [addLog]);

  // 生成状態リセット
  const resetGenerationState = useCallback(() => {
    setSessionId(null);
    setSessionStatus(null);
    setGeneratedContent({});
    setCurrentSection(null);
    setPendingChoice(null);
    setPendingInput(null);
    setPendingStepConfirmation(null);
    setPosition(null);
    setSelectedChoice(null);
    setCustomInput('');
    setUserNote('');
    setStepProgress(null);
    setDecisions([]);
    setExistingProgress(null);
  }, []);

  // プロジェクト選択時
  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProject(projectId);
    setSelectedTask('');
    setTasks([]);
    resetGenerationState();
    if (projectId) {
      fetchTasks(projectId);
    }
  }, [fetchTasks, resetGenerationState]);

  // ストリーミングコールバック
  const createCallbacks = useCallback((): StreamCallbacks => ({
    onContext: (description, dependencies, dependents) => {
      setPosition({ description, dependencies, dependents });
      addLog('CONTEXT', { description, dependencies, dependents });
    },
    onSectionStart: (section) => {
      setCurrentSection(section);
      addLog('SECTION_START', { section });
    },
    onChunk: (chunk) => {
      setGeneratedContent(prev => {
        const section = currentSection || 'context';
        return {
          ...prev,
          [section]: (prev[section] || '') + chunk,
        };
      });
    },
    onSectionComplete: (section) => {
      setCurrentSection(null);
      addLog('SECTION_COMPLETE', { section });
    },
    onChoiceRequired: (choice) => {
      setPendingChoice(choice);
      setIsGenerating(false);
      addLog('CHOICE_REQUIRED', choice);
    },
    onInputRequired: (prompt) => {
      setPendingInput(prompt);
      setIsGenerating(false);
      addLog('INPUT_REQUIRED', prompt);
    },
    onStepStart: (stepNumber, stepTitle, totalSteps) => {
      setStepProgress(prev => ({
        currentStep: stepNumber,
        totalSteps,
        currentStepTitle: stepTitle,
        completedSteps: prev?.completedSteps || [],
      }));
      addLog('STEP_START', { stepNumber, stepTitle, totalSteps });
    },
    onStepComplete: (stepNumber) => {
      setStepProgress(prev => prev ? {
        ...prev,
        completedSteps: [...prev.completedSteps, stepNumber],
      } : null);
      addLog('STEP_COMPLETE', { stepNumber });
    },
    onStepConfirmationRequired: (prompt) => {
      setPendingStepConfirmation(prompt);
      setIsGenerating(false);
      addLog('STEP_CONFIRMATION_REQUIRED', prompt);
    },
    onProgressSaved: (phase) => {
      addLog('PROGRESS_SAVED', { phase });
    },
    onRedirectToChat: (message, stepNumber) => {
      addLog('REDIRECT_TO_CHAT', { message, stepNumber });
      // TODO: チャットへの遷移処理
    },
    onDone: (handsOnId, newSessionId) => {
      setSessionId(newSessionId);
      setIsGenerating(false);
      setPendingStepConfirmation(null);
      addLog('DONE', { handsOnId, sessionId: newSessionId });
    },
    onError: (message) => {
      setError(message);
      setIsGenerating(false);
      addLog('ERROR', { message });
    },
    // Resume callbacks
    onSessionRestored: (restoredSessionId, phase) => {
      setSessionId(restoredSessionId);
      addLog('SESSION_RESTORED', { sessionId: restoredSessionId, phase });
    },
    onRestoredContent: (section, content) => {
      setGeneratedContent(prev => ({
        ...prev,
        [section]: content,
      }));
      addLog('RESTORED_CONTENT', { section, contentLength: content.length });
    },
    onRestoredSteps: (steps, currentStep) => {
      const completedSteps = steps.filter(s => s.is_completed).map(s => s.step_number);
      const currentStepData = steps.find(s => s.step_number === currentStep + 1) || steps[currentStep];
      setStepProgress({
        currentStep: currentStep + 1,
        totalSteps: steps.length,
        currentStepTitle: currentStepData?.title || '',
        completedSteps,
      });
      addLog('RESTORED_STEPS', { steps: steps.length, currentStep, completedSteps });
    },
    onRestoredDecisions: (restoredDecisions) => {
      setDecisions(restoredDecisions);
      addLog('RESTORED_DECISIONS', { count: restoredDecisions.length, decisions: restoredDecisions });
    },
  }), [currentSection, addLog]);

  // 既存の進捗をチェック
  const checkExistingProgress = useCallback(async (taskId: string) => {
    setIsCheckingProgress(true);
    try {
      const existsCheck = await checkHandsOnExists(taskId);
      setExistingProgress(existsCheck);
      addLog('EXISTS_CHECK', existsCheck);
    } catch (err) {
      console.error('Failed to check existing progress:', err);
    } finally {
      setIsCheckingProgress(false);
    }
  }, [addLog]);

  // タスク選択時に既存の進捗をチェック
  const handleTaskSelect = useCallback(async (taskId: string) => {
    setSelectedTask(taskId);
    resetGenerationState();
    if (taskId) {
      await checkExistingProgress(taskId);
    }
  }, [resetGenerationState, checkExistingProgress]);

  // ハンズオン生成開始（新規）
  const handleStartGeneration = useCallback(async () => {
    if (!selectedTask) return;

    // 既存の進捗がある場合は一度リセット
    setGeneratedContent({});
    setCurrentSection(null);
    setPendingChoice(null);
    setPendingInput(null);
    setPendingStepConfirmation(null);
    setPosition(null);
    setStepProgress(null);
    setDecisions([]);

    setIsGenerating(true);
    setEventLogs([]);
    addLog('START', { taskId: selectedTask });

    const callbacks = createCallbacks();
    const newSessionId = await startInteractiveSession(selectedTask, callbacks);

    if (newSessionId) {
      setSessionId(newSessionId);
      addLog('SESSION_CREATED', { sessionId: newSessionId });
    }
  }, [selectedTask, addLog, createCallbacks]);

  // セッション再開
  const handleResumeSession = useCallback(async () => {
    if (!selectedTask || !existingProgress?.can_resume) return;

    setIsGenerating(true);
    setEventLogs([]);
    addLog('RESUME', { taskId: selectedTask });

    const callbacks = createCallbacks();
    const newSessionId = await resumeInteractiveSession(selectedTask, callbacks);

    if (newSessionId) {
      setSessionId(newSessionId);
      addLog('SESSION_RESUMED', { sessionId: newSessionId });
    }
  }, [selectedTask, existingProgress, addLog, createCallbacks]);

  // 選択肢送信
  const handleChoiceSubmit = useCallback(async () => {
    if (!sessionId || !pendingChoice) return;

    const selected = selectedChoice === 'custom' ? customInput : selectedChoice;
    if (!selected) return;

    setIsGenerating(true);
    addLog('CHOICE_SUBMIT', {
      choiceId: pendingChoice.choice_id,
      selected,
      userNote
    });

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'choice',
      choice_id: pendingChoice.choice_id,
      selected,
      user_note: userNote || undefined,
    }, callbacks);

    setPendingChoice(null);
    setSelectedChoice(null);
    setCustomInput('');
    setUserNote('');
  }, [sessionId, pendingChoice, selectedChoice, customInput, userNote, addLog, createCallbacks]);

  // 入力送信
  const handleInputSubmit = useCallback(async () => {
    if (!sessionId || !pendingInput) return;
    if (!customInput) return;

    const currentPromptId = pendingInput.prompt_id;
    setIsGenerating(true);
    addLog('INPUT_SUBMIT', {
      promptId: currentPromptId,
      input: customInput
    });

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'input',
      user_input: customInput,
    }, callbacks);

    // コールバックで新しいpendingInputがセットされていない場合のみクリア
    // （コールバック内でonInputRequiredが呼ばれると新しいpendingInputがセットされる）
    setCustomInput('');
  }, [sessionId, pendingInput, customInput, addLog, createCallbacks]);

  // ボタンオプション選択（optionsがある場合）
  const handleInputOptionSelect = useCallback(async (selectedOption: string) => {
    if (!sessionId || !pendingInput) return;

    setIsGenerating(true);
    addLog('INPUT_OPTION_SELECT', {
      promptId: pendingInput.prompt_id,
      selected: selectedOption
    });

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'input',
      user_input: selectedOption,
    }, callbacks);

    // コールバックで新しいpendingInputがセットされる可能性があるのでクリアしない
  }, [sessionId, pendingInput, addLog, createCallbacks]);

  // ステップ確認ボタン選択
  const handleStepConfirmationSelect = useCallback(async (selectedOption: string) => {
    if (!sessionId || !pendingStepConfirmation) return;

    setIsGenerating(true);
    addLog('STEP_CONFIRMATION_SELECT', {
      promptId: pendingStepConfirmation.prompt_id,
      selected: selectedOption
    });

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'input',
      user_input: selectedOption,
    }, callbacks);

    setPendingStepConfirmation(null);
  }, [sessionId, pendingStepConfirmation, addLog, createCallbacks]);

  // スキップ
  const handleSkip = useCallback(async () => {
    if (!sessionId) return;

    setIsGenerating(true);
    addLog('SKIP', {});

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'skip',
    }, callbacks);

    setPendingChoice(null);
    setPendingInput(null);
  }, [sessionId, addLog, createCallbacks]);

  // セッション状態取得
  const handleRefreshStatus = useCallback(async () => {
    if (!sessionId) return;

    const status = await getSessionStatus(sessionId);
    setSessionStatus(status);
    addLog('STATUS_REFRESH', status);
  }, [sessionId, addLog]);

  // セッション削除
  const handleDeleteSession = useCallback(async () => {
    if (!sessionId) return;

    const result = await deleteSession(sessionId);
    addLog('SESSION_DELETE', { success: result });

    if (result) {
      resetGenerationState();
    }
  }, [sessionId, addLog, resetGenerationState]);

  // スタイル
  const cardClass = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-cyan-500/30 dark:bg-slate-900/80';
  const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300';
  const selectClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white';
  const buttonPrimary = 'px-4 py-2 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2';
  const buttonSecondary = 'px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 flex items-center gap-2';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gradient-to-br dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className={cardClass}>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Interactive Hands-On Test Interface
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            インタラクティブハンズオン生成機能のテスト用インターフェース
          </p>
        </div>

        {/* コントロールパネル */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左: 選択とアクション */}
          <div className="space-y-4">
            {/* プロジェクト選択 */}
            <div className={cardClass}>
              <div className="flex items-center justify-between mb-3">
                <label className={labelClass}>1. プロジェクト選択</label>
                <button
                  onClick={fetchProjects}
                  disabled={isLoadingProjects}
                  className={buttonSecondary}
                >
                  {isLoadingProjects ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  取得
                </button>
              </div>
              <select
                value={selectedProject}
                onChange={(e) => handleProjectSelect(e.target.value)}
                className={selectClass}
                disabled={projects.length === 0}
              >
                <option value="">プロジェクトを選択...</option>
                {projects.map((p) => (
                  <option key={p.project_id} value={p.project_id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* タスク選択 */}
            <div className={cardClass}>
              <label className={`${labelClass} block mb-3`}>2. タスク選択</label>
              <select
                value={selectedTask}
                onChange={(e) => handleTaskSelect(e.target.value)}
                className={selectClass}
                disabled={tasks.length === 0 || isLoadingTasks}
              >
                <option value="">タスクを選択...</option>
                {tasks.map((t) => (
                  <option key={t.task_id} value={t.task_id}>
                    [{t.category || '未分類'}] {t.title}
                  </option>
                ))}
              </select>
              {selectedTask && tasks.find(t => t.task_id === selectedTask) && (
                <div className="mt-3 p-3 rounded bg-slate-50 dark:bg-slate-800 text-xs">
                  <p className="text-slate-600 dark:text-slate-400">
                    {tasks.find(t => t.task_id === selectedTask)?.description || '説明なし'}
                  </p>
                </div>
              )}
              {/* 既存の進捗表示 */}
              {isCheckingProgress && (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  進捗をチェック中...
                </div>
              )}
              {existingProgress && existingProgress.can_resume && (
                <div className="mt-3 p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30">
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 font-medium mb-2">
                    <RefreshCw className="w-4 h-4" />
                    中断されたセッションがあります
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                    <p>フェーズ: {existingProgress.progress?.phase}</p>
                    <p>進捗: {existingProgress.progress?.completed_steps}/{existingProgress.progress?.total_steps} ステップ完了</p>
                    {existingProgress.progress?.has_pending_input && (
                      <p className="text-cyan-600 dark:text-cyan-400">入力待ちの項目があります</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* アクションボタン */}
            <div className={cardClass}>
              <label className={`${labelClass} block mb-3`}>3. アクション</label>
              <div className="flex flex-wrap gap-2">
                {/* 再開ボタン（中断されたセッションがある場合） */}
                {existingProgress?.can_resume && (
                  <button
                    onClick={handleResumeSession}
                    disabled={!selectedTask || isGenerating}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    続きから再開
                  </button>
                )}
                <button
                  onClick={handleStartGeneration}
                  disabled={!selectedTask || isGenerating}
                  className={buttonPrimary}
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {existingProgress?.can_resume ? '最初から開始' : '生成開始'}
                </button>
                <button
                  onClick={handleRefreshStatus}
                  disabled={!sessionId}
                  className={buttonSecondary}
                >
                  <RefreshCw className="w-4 h-4" />
                  状態更新
                </button>
                <button
                  onClick={handleDeleteSession}
                  disabled={!sessionId}
                  className={buttonSecondary}
                >
                  <Trash2 className="w-4 h-4" />
                  セッション削除
                </button>
              </div>
              {sessionId && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Session: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{sessionId.slice(0, 8)}...</code>
                </p>
              )}
            </div>

            {/* 選択肢パネル */}
            {pendingChoice && (
              <div className={`${cardClass} border-cyan-500`}>
                <h4 className="text-sm font-semibold text-cyan-600 dark:text-cyan-300 mb-3">
                  選択が必要: {pendingChoice.question}
                </h4>
                {pendingChoice.research_hint && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {pendingChoice.research_hint}
                  </p>
                )}
                <div className="space-y-2 mb-4">
                  {pendingChoice.options.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${
                        selectedChoice === option.id
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                          : 'border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="choice"
                        value={option.id}
                        checked={selectedChoice === option.id}
                        onChange={() => setSelectedChoice(option.id)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-xs text-slate-500">{option.description}</div>
                      </div>
                    </label>
                  ))}
                  {pendingChoice.allow_custom && (
                    <label
                      className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${
                        selectedChoice === 'custom'
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                          : 'border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="choice"
                        value="custom"
                        checked={selectedChoice === 'custom'}
                        onChange={() => setSelectedChoice('custom')}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">その他</div>
                        {selectedChoice === 'custom' && (
                          <input
                            type="text"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            placeholder="入力..."
                            className="mt-1 w-full px-2 py-1 text-sm border rounded"
                          />
                        )}
                      </div>
                    </label>
                  )}
                </div>
                <input
                  type="text"
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="選択理由（任意）"
                  className="w-full px-3 py-2 text-sm border rounded mb-3"
                />
                <div className="flex gap-2">
                  <button onClick={handleChoiceSubmit} disabled={!selectedChoice} className={buttonPrimary}>
                    送信
                  </button>
                  {pendingChoice.skip_allowed && (
                    <button onClick={handleSkip} className={buttonSecondary}>
                      スキップ
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 入力パネル */}
            {pendingInput && (
              <div className={`${cardClass} border-cyan-500`}>
                <h4 className="text-sm font-semibold text-cyan-600 dark:text-cyan-300 mb-3">
                  {pendingInput.question}
                </h4>
                {/* optionsがある場合はボタンを表示 */}
                {pendingInput.options && pendingInput.options.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pendingInput.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleInputOptionSelect(option)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          option === 'OK' || option === 'できた' || option === '採用する'
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : option === '質問がある' || option === '別の選択肢を検討' || option === 'まだ質問がある'
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : option === 'スキップ' || option === '採用しない'
                            ? 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                            : 'bg-slate-500 text-white hover:bg-slate-600'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  /* optionsがない場合はテキスト入力を表示 */
                  <>
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder={pendingInput.placeholder || '入力...'}
                      className="w-full px-3 py-2 text-sm border rounded mb-3"
                      onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
                    />
                    <button onClick={handleInputSubmit} disabled={!customInput} className={buttonPrimary}>
                      送信
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ステップ確認パネル */}
            {pendingStepConfirmation && (
              <div className={`${cardClass} border-green-500`}>
                <div className="flex items-center gap-2 mb-3">
                  {stepProgress && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      ステップ {stepProgress.currentStep}/{stepProgress.totalSteps}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-green-600 dark:text-green-300 mb-3">
                  {pendingStepConfirmation.question}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {pendingStepConfirmation.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleStepConfirmationSelect(option)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        option === 'できた'
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : option === '質問がある'
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : option === 'スキップ'
                          ? 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                          : 'bg-slate-500 text-white hover:bg-slate-600'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右: イベントログ */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {showLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                イベントログ ({eventLogs.length})
              </button>
              <button
                onClick={() => setEventLogs([])}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                クリア
              </button>
            </div>
            {showLogs && (
              <div className="h-96 overflow-y-auto font-mono text-xs bg-slate-900 text-green-400 rounded p-3">
                {eventLogs.length === 0 ? (
                  <p className="text-slate-500">ログなし</p>
                ) : (
                  eventLogs.map((log, i) => (
                    <div key={i} className="mb-1">
                      <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                      <span className="text-cyan-400">{log.type}</span>:{' '}
                      <span className="text-slate-300">
                        {JSON.stringify(log.data).slice(0, 100)}
                        {JSON.stringify(log.data).length > 100 && '...'}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* ステップ進捗表示 */}
        {stepProgress && (
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                実装進捗
              </h3>
              <span className="text-xs text-slate-500">
                {stepProgress.completedSteps.length}/{stepProgress.totalSteps} 完了
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-3">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(stepProgress.completedSteps.length / stepProgress.totalSteps) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-sm text-cyan-600 dark:text-cyan-300 font-medium">
                ステップ{stepProgress.currentStep}: {stepProgress.currentStepTitle}
              </span>
            </div>
          </div>
        )}

        {/* 採用済み決定事項 */}
        {decisions.length > 0 && (
          <div className={cardClass}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              採用済み決定事項
            </h3>
            <div className="space-y-2">
              {decisions.map((decision, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <div>
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                      {decision.description}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ステップ{decision.step_number}で決定
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 生成コンテンツ表示 */}
        {(Object.keys(generatedContent).length > 0 || position) && (
          <div className={cardClass}>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
              生成されたコンテンツ
            </h3>

            {/* 位置づけ */}
            {position && (
              <div className="mb-4 p-3 rounded bg-slate-50 dark:bg-slate-800">
                <div className="text-xs text-slate-500 mb-1">タスクの位置づけ</div>
                <div className="text-sm">{position.description}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {position.dependencies.map((dep, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      前提: {dep}
                    </span>
                  ))}
                  {position.dependents.map((dep, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      次: {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* セクション */}
            <div className="space-y-4">
              {Object.entries(generatedContent).map(([section, content]) => (
                <div key={section} className="border rounded-lg p-4 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-cyan-600 dark:text-cyan-300">
                      {section}
                    </h4>
                    {currentSection === section && (
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                    )}
                  </div>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">
            {error}
          </div>
        )}

        {/* セッション状態 */}
        {sessionStatus && (
          <div className={cardClass}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              セッション状態
            </h3>
            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-auto">
              {JSON.stringify(sessionStatus, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
