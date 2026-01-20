'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTask } from '@/libs/modelAPI/task';
import {
  fetchTaskHandsOn,
  updateTaskHandsOn,
  type TaskHandsOnResponse,
  type HandsOnContent,
  type HandsOnMetadata,
  type UpdateHandsOnRequest
} from '@/libs/service/taskHandsOnService';
import type { ChatAction } from '@/types/modelTypes';
import { AgentChatWidget } from '@/components/chat';

type HandsOnSuccessPayload = TaskHandsOnResponse<HandsOnContent, HandsOnMetadata> & {
  hands_on: HandsOnContent;
};

type HandsOnState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; payload: HandsOnSuccessPayload }
  | { status: 'empty'; message: string }
  | { status: 'error'; message: string };

const NOT_READY_MESSAGE = '生成中です、しばらくお待ちください...';

export default function TaskHandsOnPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const taskId = params?.taskId as string | undefined;
  const userName = params?.userName as string | undefined;

  const [handsOnState, setHandsOnState] = useState<HandsOnState>({ status: 'idle' });

  const { task, isLoading: isTaskLoading, isError: isTaskError } = useTask(taskId);

  // ハンズオンを再取得する関数
  const refreshHandsOn = async () => {
    if (!taskId) return;
    try {
      const response = await fetchTaskHandsOn(taskId);
      if (response.success && response.hands_on) {
        setHandsOnState({
          status: 'success',
          payload: { ...response, hands_on: response.hands_on },
        });
      }
    } catch (error) {
      console.error('Failed to refresh hands-on:', error);
    }
  };

  // AIアクションハンドラー
  const handleChatAction = async (action: ChatAction) => {
    if (action.action_type === 'adjust_hands_on' && taskId) {
      try {
        const payload = action.payload as { field: string; content: string };
        if (payload.field && payload.content) {
          await updateTaskHandsOn(taskId, {
            field: payload.field as UpdateHandsOnRequest['field'],
            content: payload.content,
          });
          // 更新後にハンズオンを再取得
          await refreshHandsOn();
        }
      } catch (error) {
        console.error('Failed to update hands-on:', error);
      }
    }
  };

  useEffect(() => {
    if (!taskId) {
      return;
    }

    let ignore = false;
    setHandsOnState({ status: 'loading' });

    fetchTaskHandsOn(taskId)
      .then((response) => {
        if (ignore) {
          return;
        }

        if (response.success && response.hands_on) {
          setHandsOnState({
            status: 'success',
            payload: { ...response, hands_on: response.hands_on },
          });
          return;
        }

        setHandsOnState({ status: 'empty', message: NOT_READY_MESSAGE });
      })
      .catch((error) => {
        console.error('Failed to fetch hands-on data:', error);
        if (!ignore) {
          setHandsOnState({ status: 'error', message: NOT_READY_MESSAGE });
        }
      });

    return () => {
      ignore = true;
    };
  }, [taskId]);

  const pageBackgroundClass = 'min-h-screen bg-gray-100 text-gray-800 dark:bg-gradient-to-br dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-slate-100';

  const containerClass = 'container mx-auto px-6 py-6 overflow-hidden';

  const panelClass = 'flex flex-col gap-6 rounded-lg border border-slate-100 bg-white p-6 shadow-sm min-w-0 dark:border-cyan-500/20 dark:bg-slate-950/60 dark:shadow-[0_0_32px_rgba(6,182,212,0.18)] dark:backdrop-blur';

  const sectionTitleClass = 'text-lg font-semibold text-blue-700 dark:text-cyan-200';
  const sectionBodyClass = 'text-sm text-gray-700 dark:text-slate-200';
  const badgeClass = 'rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-600 dark:border-cyan-500/40 dark:bg-slate-900/70 dark:text-cyan-200';
  const backLinkClass = 'inline-flex items-center gap-1 text-sm text-blue-600 underline-offset-4 hover:text-blue-500 hover:underline dark:text-cyan-200 dark:hover:text-cyan-100';

  // Style classes for hands-on content (combined light dark: dark)
  const contentBgClass = 'bg-gray-50 border border-gray-200 overflow-hidden dark:bg-slate-900/80 dark:border-cyan-500/20';
  const textClass = 'text-gray-700 dark:text-slate-200';
  const headingClass = 'text-blue-700 font-semibold dark:text-cyan-300';
  const codeBlockClass = 'bg-gray-800 text-green-300 dark:bg-black/60 dark:text-green-200';
  const listClass = 'text-gray-600 dark:text-slate-300';
  const linkClass = 'text-blue-600 hover:text-blue-700 dark:text-cyan-400 dark:hover:text-cyan-300';

  const handsOnContent = (() => {
    switch (handsOnState.status) {
      case 'idle':
      case 'loading':
        return <p className={sectionBodyClass}>ハンズオンコンテンツを読み込み中...</p>;
      case 'success': {
        const { payload } = handsOnState;
        const handsOn = payload.hands_on;

        return (
          <div className="space-y-6">
            {/* Overview */}
            {handsOn.overview && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-2`}>
                <h3 className={headingClass}>概要</h3>
                <p className={`${textClass} text-sm leading-relaxed`}>{handsOn.overview}</p>
              </div>
            )}

            {/* Prerequisites */}
            {handsOn.prerequisites && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-2`}>
                <h3 className={headingClass}>前提条件</h3>
                <p className={`${textClass} text-sm whitespace-pre-wrap`}>{handsOn.prerequisites}</p>
              </div>
            )}

            {/* Target Files */}
            {handsOn.target_files && handsOn.target_files.length > 0 && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-2`}>
                <h3 className={headingClass}>対象ファイル</h3>
                <ul className={`${listClass} text-sm space-y-1 list-disc list-inside`}>
                  {handsOn.target_files.map((file, index) => (
                    <li key={index}>
                      <code className="font-mono text-xs">{file.path}</code> - {file.description} ({file.action})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Implementation Steps */}
            {handsOn.implementation_steps && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-2`}>
                <h3 className={headingClass}>実装手順</h3>
                <div className={`${textClass} text-sm prose prose-sm max-w-none whitespace-pre-wrap`}>
                  {handsOn.implementation_steps}
                </div>
              </div>
            )}

            {/* Code Examples */}
            {handsOn.code_examples && handsOn.code_examples.length > 0 && (
              <div className="space-y-4">
                <h3 className={headingClass}>コード例</h3>
                {handsOn.code_examples.map((example, index) => (
                  <div key={index} className={`${contentBgClass} rounded-lg p-4 space-y-2`}>
                    <div className="flex items-center justify-between">
                      <p className={`${textClass} text-sm font-mono`}>{example.file}</p>
                      <span className={`${badgeClass} text-xs`}>{example.language}</span>
                    </div>
                    <pre className={`${codeBlockClass} rounded p-3 text-xs overflow-x-auto`}>
                      <code>{example.code}</code>
                    </pre>
                    {example.explanation && (
                      <p className={`${listClass} text-xs italic`}>{example.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Verification */}
            {handsOn.verification && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-2`}>
                <h3 className={headingClass}>動作確認</h3>
                <p className={`${textClass} text-sm whitespace-pre-wrap`}>{handsOn.verification}</p>
              </div>
            )}

            {/* Common Errors */}
            {handsOn.common_errors && handsOn.common_errors.length > 0 && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-3`}>
                <h3 className={headingClass}>よくあるエラー</h3>
                <div className="space-y-3">
                  {handsOn.common_errors.map((error, index) => (
                    <div key={index} className="space-y-1">
                      <p className={`${textClass} text-sm font-semibold`}>エラー: {error.error}</p>
                      <p className={`${listClass} text-xs`}>原因: {error.cause}</p>
                      <p className={`${listClass} text-xs`}>解決策: {error.solution}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technical Context */}
            {handsOn.technical_context && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-2`}>
                <h3 className={headingClass}>技術的背景</h3>
                <p className={`${textClass} text-sm whitespace-pre-wrap`}>{handsOn.technical_context}</p>
              </div>
            )}

            {/* Implementation Tips */}
            {handsOn.implementation_tips && handsOn.implementation_tips.length > 0 && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-3`}>
                <h3 className={headingClass}>実装のヒント</h3>
                <div className="space-y-2">
                  {handsOn.implementation_tips.map((tip, index) => (
                    <div key={index} className="space-y-1">
                      <p className={`${textClass} text-sm font-semibold`}>
                        {tip.type === 'best_practice' ? '✓ ベストプラクティス' : '✗ アンチパターン'}
                      </p>
                      <p className={`${textClass} text-xs`}>{tip.tip}</p>
                      <p className={`${listClass} text-xs italic`}>理由: {tip.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* References */}
            {handsOn.references && handsOn.references.length > 0 && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-2`}>
                <h3 className={headingClass}>参考資料</h3>
                <ul className={`${listClass} text-sm space-y-1`}>
                  {handsOn.references.map((ref, index) => (
                    <li key={index}>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${linkClass} hover:underline`}
                      >
                        {ref.title}
                      </a>
                      {ref.type && <span className="text-xs ml-1">({ref.type})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata */}
            {payload.metadata && (
              <div className={`${contentBgClass} rounded-lg p-4 space-y-2`}>
                <h3 className={headingClass}>生成情報</h3>
                <div className={`${listClass} text-xs space-y-1`}>
                  {payload.metadata.quality_score !== undefined && (
                    <p>品質スコア: {payload.metadata.quality_score}</p>
                  )}
                  {payload.metadata.generated_at && (
                    <p>生成日時: {new Date(payload.metadata.generated_at).toLocaleString('ja-JP')}</p>
                  )}
                  {payload.metadata.generation_model && (
                    <p>使用モデル: {payload.metadata.generation_model}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'empty':
      case 'error':
        return <p className={sectionBodyClass}>{handsOnState.message}</p>;
      default:
        return null;
    }
  })();

  const taskContent = (() => {
    if (isTaskLoading) {
      return <p className={sectionBodyClass}>タスク情報を読み込み中...</p>;
    }
    if (isTaskError) {
      return <p className={sectionBodyClass}>タスク情報の取得に失敗しました。</p>;
    }
    if (!task) {
      return <p className={sectionBodyClass}>タスク情報が見つかりません。</p>;
    }

    return (
      <div className="space-y-2">
        <p className={sectionBodyClass}>
          <span className={badgeClass}>ID</span> <span className="font-mono">{task.task_id}</span>
        </p>
        <p className={`${sectionBodyClass} text-base font-semibold`}>{task.title}</p>
        {task.description && <p className={sectionBodyClass}>{task.description}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          {task.priority && (
            <span className={badgeClass}>優先度: {task.priority}</span>
          )}
          {task.status && <span className={badgeClass}>ステータス: {task.status}</span>}
          {task.assignee && <span className={badgeClass}>担当: {task.assignee}</span>}
        </div>
      </div>
    );
  })();

  return (
    <div className={pageBackgroundClass}>
      <div className={containerClass}>
        <div className={panelClass}>
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">タスク詳細</h1>
            {projectId && userName && (
              <Link href={`/${userName}/${projectId}/kanban`} className={backLinkClass}>
                ← カンバンボードへ戻る
              </Link>
            )}
          </header>

          <section className="space-y-3">
            <h2 className={sectionTitleClass}>タスク情報</h2>
            {taskContent}
          </section>

          <section className="space-y-3">
            <h2 className={sectionTitleClass}>ハンズオン詳細</h2>
            {handsOnContent}
          </section>
        </div>
      </div>

      {/* AI Chat Widget */}
      {projectId && taskId && (
        <AgentChatWidget
          projectId={projectId}
          pageContext="taskDetail"
          pageSpecificContext={{ task_id: taskId }}
          onAction={handleChatAction}
        />
      )}
    </div>
  );
}
