'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEventHandler,
} from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { patchTask } from '@/libs/modelAPI/task';
import { TaskType } from '@/types/modelTypes';
import { startHandsOnGeneration } from '@/libs/service/taskHandsOnService';
import {
  useKanbanData,
  buildMemberBoard,
  buildColumnDefinitions,
  moveTaskToMember,
  type ColumnDefinition,
} from '@/hooks/useKanbanData';
import CyberHeader from '@/components/Session/Header';
import { mutate } from 'swr';

const triggeredHandsOnProjects = new Set<string>();

type ThemeVariant = {
  light: string;
  dark: string;
};

type ColumnTheme = {
  column: ThemeVariant;
  label: ThemeVariant;
  count: ThemeVariant;
  card: ThemeVariant;
  title: ThemeVariant;
  description: ThemeVariant;
  meta: ThemeVariant;
  priority: ThemeVariant;
  empty: ThemeVariant;
};

const MEMBER_THEME: ColumnTheme = {
  column: {
    light: 'border-gray-200 bg-gray-50 shadow-sm',
    dark: 'border-purple-500/40 bg-slate-950/70 shadow-[0_0_18px_rgba(168,85,247,0.2)]',
  },
  label: {
    light: 'text-gray-700',
    dark: 'text-purple-200',
  },
  count: {
    light: 'bg-white text-gray-500',
    dark: 'border border-purple-500/40 bg-slate-900/80 text-purple-200',
  },
  card: {
    light: 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md',
    dark: 'border-purple-500/30 bg-slate-900/80 hover:border-purple-400/60 shadow-[0_0_16px_rgba(168,85,247,0.25)]',
  },
  title: {
    light: 'text-gray-800',
    dark: 'text-slate-100',
  },
  description: {
    light: 'text-gray-500',
    dark: 'text-slate-300',
  },
  meta: {
    light: 'text-gray-500',
    dark: 'text-slate-300',
  },
  priority: {
    light: 'bg-gray-100 text-gray-600',
    dark: 'border border-purple-400/50 bg-purple-500/10 text-purple-200',
  },
  empty: {
    light: 'text-gray-400',
    dark: 'text-slate-500',
  },
};

type ComputedColumnStyle = {
  column: string;
  label: string;
  count: string;
  card: string;
  title: string;
  description: string;
  meta: string;
  priority: string;
  empty: string;
};

const pickVariant = (variant: ThemeVariant, darkMode: boolean) =>
  darkMode ? variant.dark : variant.light;

type CompletionBarProps = {
  tasks: TaskType[];
  darkMode: boolean;
};

function CompletionBar({ tasks, darkMode }: CompletionBarProps) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  if (completionRate === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={darkMode ? 'text-slate-400' : 'text-gray-500'}>
          完了: {completedTasks}/{totalTasks}
        </span>
        <span className={darkMode ? 'text-purple-300' : 'text-purple-600'}>
          {completionRate}%
        </span>
      </div>
      <div className={`w-full h-1.5 rounded-full ${
        darkMode ? 'bg-slate-800' : 'bg-gray-200'
      }`}>
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${
            darkMode ? 'bg-purple-500' : 'bg-purple-500'
          }`}
          style={{ width: `${completionRate}%` }}
        />
      </div>
    </div>
  );
}

type TaskCardProps = {
  task: TaskType;
  styles: ComputedColumnStyle;
  darkMode: boolean;
  onDragStart: (taskId?: string) => void;
  onDragEnd: () => void;
  onSelect: (taskId?: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
};

function TaskCard({ task, styles, darkMode, onDragStart, onDragEnd, onSelect, onToggleComplete }: TaskCardProps) {
  const canDrag = Boolean(task.task_id);

  const handleDragStart = () => {
    if (canDrag) {
      onDragStart(task.task_id);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // チェックボックスのクリックは無視
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (canDrag) {
      onSelect(task.task_id);
    }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    if (!canDrag) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(task.task_id);
    }
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.task_id) {
      onToggleComplete(task.task_id, !task.completed);
    }
  };

  return (
    <article
      className={`rounded border p-3 text-sm shadow-sm transition cursor-pointer relative ${styles.card} ${
        task.completed ? 'opacity-60' : ''
      }`}
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={canDrag ? 0 : -1}
    >
      {/* 完了チェックボタン */}
      <button
        onClick={handleToggleComplete}
        className={`absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
          task.completed
            ? darkMode
              ? 'bg-green-500/20 border-green-500 text-green-400'
              : 'bg-green-500/20 border-green-500 text-green-600'
            : darkMode
            ? 'border-purple-500/40 hover:border-purple-400 hover:bg-purple-500/10'
            : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
        }`}
        title={task.completed ? '完了を解除' : '完了にする'}
      >
        {task.completed && (
          <span className="text-xs font-bold">✓</span>
        )}
      </button>

      <h3 className={`font-semibold pr-6 ${styles.title} ${task.completed ? 'line-through' : ''}`}>
        {task.title}
      </h3>
      {task.description && (
        <p className={`mt-2 text-xs ${styles.description} ${task.completed ? 'line-through' : ''}`}>
          {task.description}
        </p>
      )}
      <div className={`mt-2 flex items-center gap-2 text-xs ${styles.meta}`}>
        {task.priority && (
          <span className={`rounded px-2 py-0.5 ${styles.priority}`}>{task.priority}</span>
        )}
        {task.assignee && <span>👤 {task.assignee}</span>}
      </div>
    </article>
  );
}

type KanbanColumnProps = {
  column: ColumnDefinition;
  tasks: TaskType[];
  styles: ComputedColumnStyle;
  darkMode: boolean;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (taskId?: string) => void;
  onDragEnd: () => void;
  onSelect: (taskId?: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
};

function KanbanColumn({
  column,
  tasks,
  styles,
  darkMode,
  onDrop,
  onDragStart,
  onDragEnd,
  onSelect,
  onToggleComplete,
}: KanbanColumnProps) {
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <section
      className={`min-w-[280px] flex-shrink-0 flex flex-col rounded border h-full ${styles.column}`}
      data-column-id={column.key}
      onDragOver={handleDragOver}
      onDrop={onDrop}
    >
      {/* カラムヘッダー - sticky固定 */}
      <div className={`sticky top-0 z-10 px-4 py-3 border-b backdrop-blur-sm ${
        darkMode ? 'bg-slate-950/90 border-purple-500/20' : 'bg-white/90 border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* メンバーアバター（メンバーカラムの場合） */}
            {column.memberInfo && (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                darkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-500/20 text-purple-700'
              }`}>
                {column.label.charAt(0).toUpperCase()}
              </div>
            )}
            <span className={`font-semibold text-sm ${styles.label}`}>
              {column.label}
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded ${styles.count}`}>
            {tasks.length}
          </span>
        </div>

        {/* 完了率バー */}
        {tasks.length > 0 && (
          <CompletionBar tasks={tasks} darkMode={darkMode} />
        )}
      </div>

      {/* タスクリスト - スクロール可能 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {tasks.length === 0 ? (
          <div className={`text-center py-8 text-xs ${styles.empty}`}>
            タスクなし
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.task_id}
              task={task}
              styles={styles}
              darkMode={darkMode}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onSelect={onSelect}
              onToggleComplete={onToggleComplete}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function KanbanBoardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string | undefined;
  const userName = params?.userName as string | undefined;
  const { darkMode } = useDarkMode();

  const { tasks, members, isLoading, isError } = useKanbanData(projectId);
  const [isUpdating, setIsUpdating] = useState(false);
  const draggingTaskIdRef = useRef<string | null>(null);

  // tasksとmembersが変更された時のみボードとカラムを再構築
  const board = useMemo(() => {
    if (tasks.length === 0 && members.length === 0) {
      return {};
    }
    return buildMemberBoard(tasks, members);
  }, [tasks, members]);

  const columns = useMemo(() => {
    if (members.length === 0) {
      return [];
    }
    return buildColumnDefinitions(members);
  }, [members]);

  const columnStyles = useMemo(() => {
    const theme = MEMBER_THEME;
    return {
      column: pickVariant(theme.column, darkMode),
      label: pickVariant(theme.label, darkMode),
      count: pickVariant(theme.count, darkMode),
      card: pickVariant(theme.card, darkMode),
      title: pickVariant(theme.title, darkMode),
      description: pickVariant(theme.description, darkMode),
      meta: pickVariant(theme.meta, darkMode),
      priority: pickVariant(theme.priority, darkMode),
      empty: pickVariant(theme.empty, darkMode),
    };
  }, [darkMode]);

  useEffect(() => {
    if (!projectId || triggeredHandsOnProjects.has(projectId)) {
      return;
    }
    triggeredHandsOnProjects.add(projectId);
    // Hands-on generation is optional - silently fail if Redis/Celery is unavailable
    startHandsOnGeneration({ project_id: projectId }).catch((error) => {
      // Only log if it's not a connection error (development environment may not have Redis)
      if (!error?.response?.data?.detail?.includes('connecting to')) {
        console.error('Failed to start hands-on generation job:', error);
      }
    });
  }, [projectId]);

  const handleCardDragStart = useCallback((taskId?: string) => {
    if (taskId) {
      draggingTaskIdRef.current = taskId;
    }
  }, []);

  const handleCardDragEnd = useCallback(() => {
    draggingTaskIdRef.current = null;
  }, []);

  const handleColumnDrop = useCallback(
    (newMemberId: string) => async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const taskId = draggingTaskIdRef.current;
      if (!taskId) {
        return;
      }

      const { moved, task } = moveTaskToMember(board, taskId, newMemberId);
      if (!moved || !task) {
        draggingTaskIdRef.current = null;
        return;
      }

      // 楽観的更新: tasksを直接更新してUIを即座に更新
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const tasksCacheKey = `${apiUrl}/task/project/${projectId}`;

      setIsUpdating(true);

      try {
        // 楽観的更新: キャッシュを即座に更新
        await mutate(
          tasksCacheKey,
          async (currentTasks: TaskType[] | undefined) => {
            if (!currentTasks) return currentTasks;

            return currentTasks.map(t =>
              t.task_id === taskId
                ? { ...t, assignee: newMemberId === 'unassigned' ? undefined : newMemberId }
                : t
            );
          },
          false // 再検証しない（楽観的更新）
        );

        // バックエンドを更新
        await patchTask(taskId, {
          assignee: newMemberId === 'unassigned' ? undefined : newMemberId,
        });

        // 成功したら再検証
        await mutate(tasksCacheKey);
      } catch (error) {
        console.error('Failed to update task assignee:', error);
        // エラーの場合はロールバック（再検証）
        await mutate(tasksCacheKey);
        alert('タスクの更新に失敗しました');
      } finally {
        setIsUpdating(false);
        draggingTaskIdRef.current = null;
      }
    },
    [board, projectId],
  );

  const handleTaskSelect = useCallback(
    (taskId?: string) => {
      if (!taskId || !userName || !projectId) {
        return;
      }
      if (draggingTaskIdRef.current) {
        return;
      }
      router.push(`/${userName}/${projectId}/${taskId}`);
    },
    [router, userName, projectId],
  );

  const handleToggleComplete = useCallback(
    async (taskId: string, completed: boolean) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const tasksCacheKey = `${apiUrl}/task/project/${projectId}`;

      setIsUpdating(true);

      try {
        // 楽観的更新: キャッシュを即座に更新
        await mutate(
          tasksCacheKey,
          async (currentTasks: TaskType[] | undefined) => {
            if (!currentTasks) return currentTasks;

            return currentTasks.map(t =>
              t.task_id === taskId
                ? { ...t, completed }
                : t
            );
          },
          false // 再検証しない（楽観的更新）
        );

        // バックエンドを更新
        await patchTask(taskId, { completed });

        // 成功したら再検証
        await mutate(tasksCacheKey);
      } catch (error) {
        console.error('Failed to update task completion:', error);
        // エラーの場合はロールバック（再検証）
        await mutate(tasksCacheKey);
        alert('タスクの更新に失敗しました');
      } finally {
        setIsUpdating(false);
      }
    },
    [projectId],
  );

  const loadingContainerClass = darkMode
    ? 'flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900'
    : 'flex min-h-screen items-center justify-center bg-gray-100';

  const loadingTextClass = darkMode ? 'text-sm text-cyan-200' : 'text-sm text-gray-600';

  const errorTextClass = darkMode ? 'text-sm text-rose-300' : 'text-sm text-red-600';

  if (isLoading) {
    return (
      <div className={loadingContainerClass}>
        <p className={loadingTextClass}>読み込み中...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={loadingContainerClass}>
        <p className={errorTextClass}>データの取得に失敗しました</p>
      </div>
    );
  }

  const overviewHref = projectId ? `../${projectId}` : '..';

  return (
    <>
      {/* 固定ヘッダー */}
      <CyberHeader />

      {/* メインコンテンツ - Headerの高さ分のpadding */}
      <div className={`min-h-screen pt-20 ${
        darkMode
          ? 'bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900'
          : 'bg-gray-100'
      }`}>
        <main className="h-[calc(100vh-80px)] flex flex-col overflow-hidden">
          {/* カンバンヘッダー */}
          <div className={`px-6 py-4 border-b ${
            darkMode ? 'border-purple-500/20' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-2xl font-bold tracking-wide ${
                  darkMode ? 'text-purple-200' : 'text-gray-800'
                }`}>
                  Kanban Board
                </h1>
                {projectId && (
                  <p className={`text-xs ${
                    darkMode ? 'text-slate-300' : 'text-gray-500'
                  }`}>
                    Project ID: <span className="font-mono">{projectId}</span>
                  </p>
                )}
              </div>

              {/* ナビゲーションボタン */}
              <div className="flex items-center gap-2">
                <Link
                  href={overviewHref}
                  className={`inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold transition ${
                    darkMode
                      ? 'border border-cyan-500/40 bg-slate-950/60 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.35)] hover:border-cyan-300/60 hover:text-cyan-100'
                      : 'border border-blue-200 bg-white/80 text-blue-600 shadow-sm hover:border-blue-400 hover:text-blue-700'
                  }`}
                >
                  プロジェクト概要
                </Link>
                <Link
                  href="./kanban"
                  className={`inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold transition ${
                    darkMode
                      ? 'border border-purple-500/40 bg-slate-950/60 text-purple-200 shadow-[0_0_16px_rgba(168,85,247,0.35)] hover:border-purple-300/60 hover:text-purple-100'
                      : 'border border-purple-200 bg-white/80 text-purple-600 shadow-sm hover:border-purple-400 hover:text-purple-700'
                  }`}
                >
                  カンバン
                </Link>
              </div>
            </div>

            {isUpdating && (
              <p className={`text-xs mt-2 ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                更新中...
              </p>
            )}
          </div>

          {/* カラムコンテナ - 横スクロール改善 */}
          <div className="flex-1 overflow-hidden px-6 py-4">
            <div className="flex gap-4 overflow-x-auto overflow-y-hidden h-full scrollbar-thin pb-2" style={{ scrollBehavior: 'smooth' }}>
              {columns.map(column => (
                <KanbanColumn
                  key={column.key}
                  column={column}
                  tasks={board[column.key] || []}
                  styles={columnStyles}
                  darkMode={darkMode}
                  onDrop={handleColumnDrop(column.key)}
                  onDragStart={handleCardDragStart}
                  onDragEnd={handleCardDragEnd}
                  onSelect={handleTaskSelect}
                  onToggleComplete={handleToggleComplete}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
