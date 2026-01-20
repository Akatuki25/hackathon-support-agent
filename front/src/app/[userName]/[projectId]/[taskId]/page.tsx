'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { useTask } from '@/libs/modelAPI/task';
import { InteractiveHandsOnView } from '@/components/hands-on';
import type { ChatAction } from '@/types/modelTypes';
import { AgentChatWidget } from '@/components/chat';
import { updateTaskHandsOn, type UpdateHandsOnRequest } from '@/libs/service/taskHandsOnService';

export default function TaskHandsOnPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const taskId = params?.taskId as string | undefined;
  const userName = params?.userName as string | undefined;

  const { task, isLoading: isTaskLoading, isError: isTaskError } = useTask(taskId);

  // AIアクションハンドラー
  const handleChatAction = useCallback(async (action: ChatAction) => {
    if (action.action_type === 'adjust_hands_on' && taskId) {
      try {
        const payload = action.payload as { field: string; content: string };
        if (payload.field && payload.content) {
          await updateTaskHandsOn(taskId, {
            field: payload.field as UpdateHandsOnRequest['field'],
            content: payload.content,
          });
        }
      } catch (error) {
        console.error('Failed to update hands-on:', error);
      }
    }
  }, [taskId]);

  // ハンズオン完了ハンドラー
  const handleHandsOnComplete = useCallback((handsOnId: string) => {
    console.log('Hands-on completed:', handsOnId);
  }, []);

  // スタイルクラス
  const pageBackgroundClass = 'min-h-screen bg-gray-100 text-gray-800 dark:bg-gradient-to-br dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 dark:text-slate-100';
  const containerClass = 'container mx-auto px-6 py-6 overflow-hidden';
  const panelClass = 'flex flex-col gap-6 rounded-lg border border-slate-100 bg-white p-6 shadow-sm min-w-0 dark:border-cyan-500/20 dark:bg-slate-950/60 dark:shadow-[0_0_32px_rgba(6,182,212,0.18)] dark:backdrop-blur';
  const sectionTitleClass = 'text-lg font-semibold text-blue-700 dark:text-cyan-200';
  const sectionBodyClass = 'text-sm text-gray-700 dark:text-slate-200';
  const badgeClass = 'rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-600 dark:border-cyan-500/40 dark:bg-slate-900/70 dark:text-cyan-200';
  const backLinkClass = 'inline-flex items-center gap-1 text-sm text-blue-600 underline-offset-4 hover:text-blue-500 hover:underline dark:text-cyan-200 dark:hover:text-cyan-100';

  // タスク情報の表示
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
          <span className={badgeClass}>ID</span> <span className="font-mono text-xs">{task.task_id}</span>
        </p>
        <p className={`${sectionBodyClass} text-base font-semibold`}>{task.title}</p>
        {task.description && <p className={sectionBodyClass}>{task.description}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          {task.priority && (
            <span className={badgeClass}>優先度: {task.priority}</span>
          )}
          {task.status && <span className={badgeClass}>ステータス: {task.status}</span>}
          {task.category && <span className={badgeClass}>カテゴリ: {task.category}</span>}
          {task.assignee && <span className={badgeClass}>担当: {task.assignee}</span>}
          {task.estimated_hours && <span className={badgeClass}>見積: {task.estimated_hours}h</span>}
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

          {/* タスク情報セクション */}
          <section className="space-y-3">
            <h2 className={sectionTitleClass}>タスク情報</h2>
            {taskContent}
          </section>

          {/* インタラクティブハンズオンセクション */}
          <section className="space-y-3">
            <h2 className={sectionTitleClass}>ハンズオンガイド</h2>
            {taskId && task ? (
              <InteractiveHandsOnView
                taskId={taskId}
                taskTitle={task.title}
                onComplete={handleHandsOnComplete}
              />
            ) : (
              <p className={sectionBodyClass}>
                タスク情報を読み込んでいます...
              </p>
            )}
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
