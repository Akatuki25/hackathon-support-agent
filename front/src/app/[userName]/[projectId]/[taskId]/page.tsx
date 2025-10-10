'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useTask } from '@/libs/modelAPI/task';
import { fetchTaskHandsOn, type TaskHandsOnResponse } from '@/libs/service/taskHandsOnService';

type HandsOnSuccessPayload = TaskHandsOnResponse & {
  hands_on: NonNullable<TaskHandsOnResponse['hands_on']>;
};

type HandsOnState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; payload: HandsOnSuccessPayload }
  | { status: 'empty'; message: string }
  | { status: 'error'; message: string };

const NOT_READY_MESSAGE = 'まだできていないです';

export default function TaskHandsOnPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const taskId = params?.taskId as string | undefined;
  const userName = params?.userName as string | undefined;
  const { darkMode } = useDarkMode();

  const [handsOnState, setHandsOnState] = useState<HandsOnState>({ status: 'idle' });

  const { task, isLoading: isTaskLoading, isError: isTaskError } = useTask(taskId);

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

  const pageBackgroundClass = useMemo(
    () =>
      darkMode
        ? 'min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-slate-100'
        : 'min-h-screen bg-gray-100 p-6 text-gray-800',
    [darkMode],
  );

  const panelClass = useMemo(
    () =>
      darkMode
        ? 'mx-auto flex max-w-4xl flex-col gap-6 rounded-lg border border-cyan-500/20 bg-slate-950/60 p-6 shadow-[0_0_32px_rgba(6,182,212,0.18)] backdrop-blur'
        : 'mx-auto flex max-w-4xl flex-col gap-6 rounded-lg border border-slate-100 bg-white p-6 shadow-sm',
    [darkMode],
  );

  const sectionTitleClass = darkMode ? 'text-lg font-semibold text-cyan-200' : 'text-lg font-semibold text-blue-700';
  const sectionBodyClass = darkMode ? 'text-sm text-slate-200' : 'text-sm text-gray-700';
  const badgeClass = darkMode
    ? 'rounded border border-cyan-500/40 bg-slate-900/70 px-2 py-1 text-xs text-cyan-200'
    : 'rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-600';
  const backLinkClass = darkMode
    ? 'inline-flex items-center gap-1 text-sm text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline'
    : 'inline-flex items-center gap-1 text-sm text-blue-600 underline-offset-4 hover:text-blue-500 hover:underline';

  const handsOnContent = (() => {
    switch (handsOnState.status) {
      case 'idle':
      case 'loading':
        return <p className={sectionBodyClass}>ハンズオンコンテンツを読み込み中...</p>;
      case 'success': {
        const { payload } = handsOnState;
        return (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className={`${sectionBodyClass} font-semibold`}>タスク: {payload.task_title}</p>
              <p className={sectionBodyClass}>ハンズオンが利用可能です。</p>
            </div>
            <div>
              <h2 className={`${sectionTitleClass} mb-2`}>Hands-on 内容</h2>
              <pre className="max-h-[420px] overflow-auto rounded bg-black/60 p-4 text-xs leading-relaxed text-green-200">
                {JSON.stringify(payload.hands_on, null, 2)}
              </pre>
            </div>
            {payload.metadata && (
              <div>
                <h2 className={`${sectionTitleClass} mb-2`}>メタデータ</h2>
                <pre className="max-h-[320px] overflow-auto rounded bg-black/60 p-4 text-xs leading-relaxed text-cyan-200">
                  {JSON.stringify(payload.metadata, null, 2)}
                </pre>
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
  );
}
