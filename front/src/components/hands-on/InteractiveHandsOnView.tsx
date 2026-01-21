'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Play, RefreshCw, Bot, User, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import {
  startInteractiveSession,
  sendUserResponse,
  checkHandsOnExists,
  resumeInteractiveSession,
  getHandsOnContent,
  type ChoiceRequest,
  type InputPrompt,
  type StepConfirmationPrompt,
  type StreamCallbacks,
  type HandsOnExistsCheck,
  type RestoredDecision,
} from '@/libs/service/interactiveHandsOn';

interface InteractiveHandsOnViewProps {
  taskId: string;
  taskTitle: string;
  onComplete?: () => void;
}

interface StepProgress {
  currentStep: number;
  totalSteps: number;
  currentStepTitle: string;
  completedSteps: number[];
}

// タイムラインイベント型
type TimelineEvent =
  | { type: 'position'; description: string; dependencies: string[]; dependents: string[] }
  | { type: 'section'; section: string; content: string; isStreaming: boolean }
  | { type: 'user_response'; responseType: string; displayText: string };

export function InteractiveHandsOnView({
  taskId,
  taskTitle,
  onComplete,
}: InteractiveHandsOnViewProps) {
  // 基本状態
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // タイムライン（全イベントを時系列で管理）
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const currentSectionRef = useRef<string | null>(null);

  // 選択肢・入力・確認の状態（現在表示中のもの）
  const [pendingChoice, setPendingChoice] = useState<ChoiceRequest | null>(null);
  const [pendingInput, setPendingInput] = useState<InputPrompt | null>(null);
  const [pendingStepConfirmation, setPendingStepConfirmation] = useState<StepConfirmationPrompt | null>(null);

  // ステップ進捗
  const [stepProgress, setStepProgress] = useState<StepProgress | null>(null);

  // 決定事項
  const [decisions, setDecisions] = useState<RestoredDecision[]>([]);

  // 既存進捗
  const [existingProgress, setExistingProgress] = useState<HandsOnExistsCheck | null>(null);
  const [isCheckingProgress, setIsCheckingProgress] = useState(true);

  // UI入力
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [userNote, setUserNote] = useState('');

  const contentEndRef = useRef<HTMLDivElement>(null);

  // 自動スクロール
  useEffect(() => {
    contentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline, pendingChoice, pendingInput, pendingStepConfirmation]);

  // 既存進捗チェック & 完了済みならコンテンツロード
  useEffect(() => {
    const checkExisting = async () => {
      setIsCheckingProgress(true);
      try {
        const result = await checkHandsOnExists(taskId);
        setExistingProgress(result);

        // 完了済みの場合は自動的にコンテンツをロード
        if (result?.generation_state === 'completed') {
          const content = await getHandsOnContent(taskId);
          if (content) {
            // コンテンツをタイムラインにロード
            const newTimeline: TimelineEvent[] = [];

            if (content.context) {
              newTimeline.push({
                type: 'section',
                section: 'context',
                content: content.context,
                isStreaming: false,
              });
            }

            if (content.overview) {
              newTimeline.push({
                type: 'section',
                section: 'overview',
                content: content.overview,
                isStreaming: false,
              });
            }

            if (content.steps) {
              for (const step of content.steps) {
                if (step.content) {
                  newTimeline.push({
                    type: 'section',
                    section: `step_${step.step_number}`,
                    content: step.content,
                    isStreaming: false,
                  });
                }
              }
            }

            if (content.verification) {
              newTimeline.push({
                type: 'section',
                section: 'verification',
                content: content.verification,
                isStreaming: false,
              });
            }

            setTimeline(newTimeline);
            setDecisions(content.decisions || []);
            setIsStarted(true);

            if (content.steps && content.steps.length > 0) {
              setStepProgress({
                currentStep: content.steps.length,
                totalSteps: content.steps.length,
                currentStepTitle: content.steps[content.steps.length - 1]?.title || '',
                completedSteps: content.steps.map(s => s.step_number),
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to check existing progress:', err);
      } finally {
        setIsCheckingProgress(false);
      }
    };
    checkExisting();
  }, [taskId]);

  // ストリーミングコールバック
  const createCallbacks = useCallback((): StreamCallbacks => ({
    onContext: (description, dependencies, dependents) => {
      setTimeline(prev => [...prev, {
        type: 'position',
        description,
        dependencies,
        dependents,
      }]);
    },
    onSectionStart: (section) => {
      currentSectionRef.current = section;
      setTimeline(prev => [...prev, {
        type: 'section',
        section,
        content: '',
        isStreaming: true,
      }]);
    },
    onChunk: (chunk) => {
      const section = currentSectionRef.current;
      if (!section) return;

      setTimeline(prev => {
        const newTimeline = [...prev];
        // 最後のセクションイベントを探して更新
        for (let i = newTimeline.length - 1; i >= 0; i--) {
          if (newTimeline[i].type === 'section' && (newTimeline[i] as { section: string }).section === section) {
            newTimeline[i] = {
              ...newTimeline[i],
              content: (newTimeline[i] as { content: string }).content + chunk,
            } as TimelineEvent;
            break;
          }
        }
        return newTimeline;
      });
    },
    onSectionComplete: (section) => {
      if (currentSectionRef.current === section) {
        currentSectionRef.current = null;
      }
      setTimeline(prev => {
        const newTimeline = [...prev];
        for (let i = newTimeline.length - 1; i >= 0; i--) {
          if (newTimeline[i].type === 'section' && (newTimeline[i] as { section: string }).section === section) {
            newTimeline[i] = {
              ...newTimeline[i],
              isStreaming: false,
            } as TimelineEvent;
            break;
          }
        }
        return newTimeline;
      });
    },
    onChoiceRequired: (choice) => {
      setPendingChoice(choice);
      setIsGenerating(false);
    },
    onInputRequired: (prompt) => {
      setPendingInput(prompt);
      setIsGenerating(false);
    },
    onStepStart: (stepNumber, stepTitle, totalSteps) => {
      setStepProgress(prev => ({
        currentStep: stepNumber,
        totalSteps,
        currentStepTitle: stepTitle,
        completedSteps: prev?.completedSteps || [],
      }));
    },
    onStepComplete: (stepNumber) => {
      setStepProgress(prev => prev ? {
        ...prev,
        completedSteps: [...prev.completedSteps, stepNumber],
      } : null);
    },
    onStepConfirmationRequired: (prompt) => {
      setPendingStepConfirmation(prompt);
      setIsGenerating(false);
    },
    onProgressSaved: () => {},
    onRedirectToChat: () => {},
    onDone: (handsOnId, newSessionId) => {
      setSessionId(newSessionId);
      setIsGenerating(false);
      setPendingStepConfirmation(null);
      onComplete?.();
    },
    onError: (message) => {
      setError(message);
      setIsGenerating(false);
    },
    // User response echo - バックエンドから受け取るが、フロントで先に追加するので不要
    onUserResponse: () => {},
    // Resume callbacks
    onSessionRestored: (restoredSessionId) => {
      setSessionId(restoredSessionId);
    },
    onRestoredContent: (section, content) => {
      setTimeline(prev => [...prev, {
        type: 'section',
        section,
        content,
        isStreaming: false,
      }]);
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
    },
    onRestoredDecisions: (restoredDecisions) => {
      setDecisions(restoredDecisions);
    },
    onRestoredUserResponse: (responseType, displayText) => {
      // 復元されたユーザー応答をタイムラインに追加
      setTimeline(prev => [...prev, {
        type: 'user_response',
        responseType,
        displayText,
      }]);
    },
  }), [onComplete]);

  // 生成開始
  const handleStart = useCallback(async () => {
    setTimeline([]);
    setPendingChoice(null);
    setPendingInput(null);
    setPendingStepConfirmation(null);
    setStepProgress(null);
    setDecisions([]);
    setError(null);
    setIsStarted(true);
    setIsGenerating(true);
    currentSectionRef.current = null;

    const callbacks = createCallbacks();
    const newSessionId = await startInteractiveSession(taskId, callbacks);

    if (newSessionId) {
      setSessionId(newSessionId);
    }
  }, [taskId, createCallbacks]);

  // セッション再開
  const handleResume = useCallback(async () => {
    setTimeline([]);
    setPendingChoice(null);
    setPendingInput(null);
    setPendingStepConfirmation(null);
    setStepProgress(null);
    setDecisions([]);  // クリアしてからonRestoredDecisionsで再設定
    setError(null);
    setIsStarted(true);
    setIsGenerating(true);
    currentSectionRef.current = null;

    const callbacks = createCallbacks();
    const newSessionId = await resumeInteractiveSession(taskId, callbacks);

    if (newSessionId) {
      setSessionId(newSessionId);
    }
  }, [taskId, createCallbacks]);

  // 選択肢送信
  const handleChoiceSubmit = useCallback(async () => {
    if (!sessionId || !pendingChoice) return;

    const selectedOptionId = selectedChoice === 'custom' ? customInput : selectedChoice;
    if (!selectedOptionId) return;

    // 選択したラベルを取得（option IDではなく実際のラベルを送る）
    const selectedOption = pendingChoice.options.find(opt => opt.id === selectedChoice);
    const displayText = selectedChoice === 'custom'
      ? customInput
      : selectedOption?.label || selectedOptionId;

    // タイムラインにユーザー応答を追加
    setTimeline(prev => [...prev, {
      type: 'user_response',
      responseType: 'choice',
      displayText,
    }]);

    // UI状態をクリア（送信前にクリアして即座に消す）
    const choiceToSend = pendingChoice;
    setPendingChoice(null);
    setSelectedChoice(null);
    setCustomInput('');
    setUserNote('');
    setIsGenerating(true);

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'choice',
      choice_id: choiceToSend.choice_id,
      selected: displayText,  // ラベルを送る
      user_note: userNote || undefined,
    }, callbacks);
  }, [sessionId, pendingChoice, selectedChoice, customInput, userNote, createCallbacks]);

  // 入力送信
  const handleInputSubmit = useCallback(async () => {
    if (!sessionId || !pendingInput || !customInput) return;

    const inputText = customInput;

    // タイムラインにユーザー応答を追加
    setTimeline(prev => [...prev, {
      type: 'user_response',
      responseType: 'input',
      displayText: inputText,
    }]);

    // UI状態をクリア
    setPendingInput(null);
    setCustomInput('');
    setIsGenerating(true);

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'input',
      user_input: inputText,
    }, callbacks);
  }, [sessionId, pendingInput, customInput, createCallbacks]);

  // オプション選択（ボタン形式）
  const handleOptionSelect = useCallback(async (selectedOption: string) => {
    if (!sessionId || !pendingInput) return;

    // タイムラインにユーザー応答を追加
    setTimeline(prev => [...prev, {
      type: 'user_response',
      responseType: 'input',
      displayText: selectedOption,
    }]);

    // UI状態をクリア
    setPendingInput(null);
    setIsGenerating(true);

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'input',
      user_input: selectedOption,
    }, callbacks);
  }, [sessionId, pendingInput, createCallbacks]);

  // ステップ確認選択
  const handleStepConfirmationSelect = useCallback(async (selectedOption: string) => {
    if (!sessionId || !pendingStepConfirmation) return;

    // タイムラインにユーザー応答を追加
    setTimeline(prev => [...prev, {
      type: 'user_response',
      responseType: 'step_confirmation',
      displayText: selectedOption,
    }]);

    // UI状態をクリア
    setPendingStepConfirmation(null);
    setIsGenerating(true);

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'input',
      user_input: selectedOption,
    }, callbacks);
  }, [sessionId, pendingStepConfirmation, createCallbacks]);

  // スキップ
  const handleSkip = useCallback(async () => {
    if (!sessionId) return;

    // タイムラインにユーザー応答を追加
    setTimeline(prev => [...prev, {
      type: 'user_response',
      responseType: 'skip',
      displayText: 'スキップ',
    }]);

    // UI状態をクリア
    setPendingChoice(null);
    setPendingInput(null);
    setIsGenerating(true);

    const callbacks = createCallbacks();
    await sendUserResponse(sessionId, {
      response_type: 'skip',
    }, callbacks);
  }, [sessionId, createCallbacks]);

  // 開始前の表示
  if (!isStarted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Bot className="w-16 h-16 text-cyan-500 mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
          {taskTitle}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6 max-w-md">
          インタラクティブハンズオンを開始します。
          AIがステップバイステップでガイドし、必要に応じて質問や選択肢を提示します。
        </p>

        {isCheckingProgress ? (
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        ) : (
          <div className="flex flex-col gap-3">
            {existingProgress?.can_resume && (
              <>
                <div className="text-xs text-amber-600 dark:text-amber-400 text-center mb-2">
                  中断されたセッションがあります
                  <br />
                  ({existingProgress.progress?.completed_steps}/{existingProgress.progress?.total_steps} ステップ完了)
                </div>
                <button
                  onClick={handleResume}
                  className="px-6 py-3 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  続きから再開
                </button>
              </>
            )}
            <button
              onClick={handleStart}
              className="px-6 py-3 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {existingProgress?.can_resume ? '最初から開始' : 'ハンズオンを開始'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ステップ進捗 */}
      {stepProgress && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              ステップ {stepProgress.currentStep}/{stepProgress.totalSteps}: {stepProgress.currentStepTitle}
            </span>
            <span className="text-xs text-slate-500">
              {stepProgress.completedSteps.length}/{stepProgress.totalSteps} 完了
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(stepProgress.completedSteps.length / stepProgress.totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 決定事項バナー */}
      {decisions.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
            <CheckCircle2 className="w-3 h-3" />
            <span>採用済み: {decisions.map(d => d.description).join(', ')}</span>
          </div>
        </div>
      )}

      {/* タイムライン（コンテンツエリア） */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {timeline.map((event, index) => {
          if (event.type === 'position') {
            return (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">
                    タスクの位置づけ
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{event.description}</p>
                  {(event.dependencies.length > 0 || event.dependents.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {event.dependencies.map((dep, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          前提: {dep}
                        </span>
                      ))}
                      {event.dependents.map((dep, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          次: {dep}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (event.type === 'section') {
            return (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="flex-1 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400 uppercase">
                      {event.section}
                    </span>
                    {event.isStreaming && (
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-500" />
                    )}
                  </div>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeHighlight]}>
                      {event.content || '...'}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          }

          if (event.type === 'user_response') {
            return (
              <div key={index} className="flex gap-3 justify-end">
                <div className="max-w-[80%] p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">あなた</span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {event.displayText}
                  </p>
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* 選択肢パネル */}
        {pendingChoice && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-500/30">
              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3">
                {pendingChoice.question}
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
                    className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedChoice === option.id
                        ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40'
                        : 'border-slate-200 dark:border-slate-600 hover:border-purple-300'
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
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{option.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{option.description}</div>
                      {option.pros && option.pros.length > 0 && (
                        <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                          + {option.pros.join(', ')}
                        </div>
                      )}
                      {option.cons && option.cons.length > 0 && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          - {option.cons.join(', ')}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
                {pendingChoice.allow_custom && (
                  <label
                    className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedChoice === 'custom'
                        ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40'
                        : 'border-slate-200 dark:border-slate-600 hover:border-purple-300'
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
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200">その他</div>
                      {selectedChoice === 'custom' && (
                        <input
                          type="text"
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          placeholder="入力..."
                          className="mt-2 w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
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
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg mb-3 bg-white dark:bg-slate-800"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleChoiceSubmit}
                  disabled={!selectedChoice || isGenerating}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : '送信'}
                </button>
                {pendingChoice.skip_allowed && (
                  <button
                    onClick={handleSkip}
                    disabled={isGenerating}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    スキップ
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 入力パネル */}
        {pendingInput && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="flex-1 p-4 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-500/30">
              <h4 className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 mb-3">
                {pendingInput.question}
              </h4>
              {pendingInput.options && pendingInput.options.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {pendingInput.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleOptionSelect(option)}
                      disabled={isGenerating}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                        option === 'OK' || option === 'できた' || option === '採用する'
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : option === '質問がある' || option === '別の選択肢を検討' || option === 'まだ質問がある'
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : option === 'スキップ' || option === '採用しない'
                          ? 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          : 'bg-slate-500 text-white hover:bg-slate-600'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder={pendingInput.placeholder || '入力...'}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg mb-3 bg-white dark:bg-slate-800"
                    onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
                  />
                  <button
                    onClick={handleInputSubmit}
                    disabled={!customInput || isGenerating}
                    className="px-4 py-2 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : '送信'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ステップ確認パネル */}
        {pendingStepConfirmation && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-3">
                {pendingStepConfirmation.question}
              </h4>
              <div className="flex flex-wrap gap-2">
                {pendingStepConfirmation.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleStepConfirmationSelect(option)}
                    disabled={isGenerating}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                      option === 'できた'
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : option === '質問がある'
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 生成中インジケーター */}
        {isGenerating && !pendingChoice && !pendingInput && !pendingStepConfirmation && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600 dark:text-slate-400" />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">生成中...</span>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div ref={contentEndRef} />
      </div>
    </div>
  );
}

export default InteractiveHandsOnView;
