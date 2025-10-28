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
  type ReactNode,
} from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useTasksByProjectId, patchTask } from '@/libs/modelAPI/task';
import { TaskType } from '@/types/modelTypes';
import { startHandsOnGeneration, fetchTaskHandsOn } from '@/libs/service/taskHandsOnService';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const triggeredHandsOnProjects = new Set<string>();

type BoardState = Record<string, TaskType[]>; // key = member_name or 'unassigned'

type MoveResult = {
  board: BoardState;
  moved: boolean;
};

const UNASSIGNED_KEY = 'unassigned' as const;

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

// Unified theme for member columns
const MEMBER_COLUMN_THEME: ColumnTheme = {
  column: {
    light: 'border-gray-200 bg-gray-50 shadow-sm',
    dark: 'border-cyan-500/40 bg-slate-950/70 shadow-[0_0_18px_rgba(6,182,212,0.2)]',
  },
  label: {
    light: 'text-gray-700',
    dark: 'text-cyan-200',
  },
  count: {
    light: 'bg-white text-gray-500',
    dark: 'border border-cyan-500/40 bg-slate-900/80 text-cyan-200',
  },
  card: {
    light: 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md',
    dark: 'border-cyan-500/30 bg-slate-900/80 hover:border-cyan-400/60 shadow-[0_0_16px_rgba(6,182,212,0.25)]',
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
    dark: 'border border-cyan-400/50 bg-cyan-500/10 text-cyan-200',
  },
  empty: {
    light: 'text-gray-400',
    dark: 'text-slate-500',
  },
};

// Theme for unassigned column
const UNASSIGNED_COLUMN_THEME: ColumnTheme = {
  column: {
    light: 'border-amber-200 bg-amber-50 shadow-sm',
    dark: 'border-amber-500/40 bg-slate-950/70 shadow-[0_0_18px_rgba(245,158,11,0.2)]',
  },
  label: {
    light: 'text-amber-700',
    dark: 'text-amber-200',
  },
  count: {
    light: 'bg-white text-amber-600',
    dark: 'border border-amber-500/40 bg-slate-900/80 text-amber-200',
  },
  card: {
    light: 'border-amber-200 bg-white hover:border-amber-300 hover:shadow-md',
    dark: 'border-amber-500/30 bg-slate-900/80 hover:border-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.25)]',
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
    light: 'text-amber-600/80',
    dark: 'text-amber-200',
  },
  priority: {
    light: 'bg-amber-100 text-amber-700',
    dark: 'border border-amber-400/50 bg-amber-500/10 text-amber-200',
  },
  empty: {
    light: 'text-amber-400',
    dark: 'text-amber-300',
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

const computeColumnStyle = (theme: ColumnTheme, darkMode: boolean): ComputedColumnStyle => ({
  column: pickVariant(theme.column, darkMode),
  label: pickVariant(theme.label, darkMode),
  count: pickVariant(theme.count, darkMode),
  card: pickVariant(theme.card, darkMode),
  title: pickVariant(theme.title, darkMode),
  description: pickVariant(theme.description, darkMode),
  meta: pickVariant(theme.meta, darkMode),
  priority: pickVariant(theme.priority, darkMode),
  empty: pickVariant(theme.empty, darkMode),
});

type HeaderProps = {
  containerClass: string;
  headerClass: string;
  titleClass: string;
  projectId?: string;
  projectIdClass: string;
  isUpdating: boolean;
  updatingClass: string;
  primaryButtonClass: string;
  primaryButtonHoverClass: string;
  kanbanButtonClass: string;
  kanbanButtonHoverClass: string;
  overviewHref: string;
  children: ReactNode;
};

function Header({
  containerClass,
  headerClass,
  titleClass,
  projectId,
  projectIdClass,
  isUpdating,
  updatingClass,
  primaryButtonClass,
  primaryButtonHoverClass,
  kanbanButtonClass,
  kanbanButtonHoverClass,
  overviewHref,
  children,
}: HeaderProps) {
  return (
    <div className={containerClass}>
      <header className={`${headerClass} flex items-center justify-between gap-4`}
      >
        <div>
          <h1 className={titleClass}>Kanban Board</h1>
          {projectId && (
            <p className={projectIdClass}>
              Project ID: <span className="font-mono">{projectId}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={overviewHref}
            className={`${primaryButtonClass} ${primaryButtonHoverClass} inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold transition`}
          >
            プロジェクト概要
          </Link>
          <Link
            href="./kanban"
            className={`${kanbanButtonClass} ${kanbanButtonHoverClass} inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold transition`}
          >
            カンバン
          </Link>
        </div>
      </header>

      {isUpdating && <p className={updatingClass}>更新中...</p>}

      {children}
    </div>
  );
}

const createEmptyBoard = (memberNames: string[]): BoardState => {
  const board: BoardState = {};
  memberNames.forEach(name => {
    board[name] = [];
  });
  board[UNASSIGNED_KEY] = [];
  return board;
};

const buildBoardFromTasks = (tasks?: TaskType[], memberNames: string[] = []): BoardState => {
  const board = createEmptyBoard(memberNames);
  tasks?.forEach((task) => {
    const assignee = task.assignee || UNASSIGNED_KEY;
    if (board[assignee]) {
      board[assignee].push(task);
    } else {
      // If assignee doesn't match any member, put in unassigned
      board[UNASSIGNED_KEY].push(task);
    }
  });
  return board;
};

const moveTaskToMember = (
  state: BoardState,
  taskId: string,
  newAssignee: string,
): MoveResult => {
  const next: BoardState = {};
  for (const key in state) {
    next[key] = [...state[key]];
  }

  let sourceAssignee: string | null = null;
  let task: TaskType | undefined;

  for (const assignee in next) {
    const index = next[assignee].findIndex((item) => item.task_id === taskId);
    if (index !== -1) {
      sourceAssignee = assignee;
      task = next[assignee][index];
      next[assignee].splice(index, 1);
      break;
    }
  }

  if (!task || sourceAssignee === newAssignee) {
    return { board: state, moved: false };
  }

  const updatedTask: TaskType = {
    ...task,
    assignee: newAssignee === UNASSIGNED_KEY ? undefined : newAssignee
  };
  next[newAssignee] = [updatedTask, ...next[newAssignee]];

  return { board: next, moved: true };
};

type TaskCardProps = {
  task: TaskType;
  styles: ComputedColumnStyle;
  onDragStart: (taskId?: string) => void;
  onDragEnd: () => void;
  onSelect: (taskId?: string) => void;
  onToggleComplete: (taskId?: string) => void;
};

function TaskCard({ task, styles, onDragStart, onDragEnd, onSelect, onToggleComplete }: TaskCardProps) {
  const canDrag = Boolean(task.task_id);

  const handleDragStart = () => {
    if (canDrag) {
      onDragStart(task.task_id);
    }
  };

  const handleClick = () => {
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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleComplete(task.task_id);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <article
      className={`rounded border p-3 text-sm shadow-sm transition ${styles.card}`}
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={canDrag ? 0 : -1}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={task.completed ?? false}
          onChange={handleCheckboxChange}
          onClick={handleCheckboxClick}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0"
        />
        <div className="flex-1">
          <h3 className={`font-semibold ${task.completed ? 'line-through opacity-60' : ''} ${styles.title}`}>
            {task.title}
          </h3>
          {task.description && (
            <p className={`mt-2 text-xs ${task.completed ? 'opacity-60' : ''} ${styles.description}`}>
              {task.description}
            </p>
          )}
          <div className={`mt-2 flex items-center gap-2 text-xs ${styles.meta}`}>
            {task.priority && (
              <span className={`rounded px-2 py-0.5 ${styles.priority}`}>{task.priority}</span>
            )}
            {task.status && (
              <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {task.status}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

type TaskColumnProps = {
  memberKey: string;
  label: string;
  tasks: TaskType[];
  styles: ComputedColumnStyle;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (taskId?: string) => void;
  onDragEnd: () => void;
  onSelect: (taskId?: string) => void;
  onToggleComplete: (taskId?: string) => void;
};

function TaskColumn({ memberKey, label, tasks, styles, onDrop, onDragStart, onDragEnd, onSelect, onToggleComplete }: TaskColumnProps) {
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <section
      aria-label={`${label} column`}
      className={`flex min-w-[220px] flex-1 flex-col gap-3 rounded border p-4 transition backdrop-blur-sm ${styles.column}`}
      data-member={memberKey}
      onDragOver={handleDragOver}
      onDrop={onDrop}
    >
      <header className={`flex items-center justify-between text-xs font-semibold transition ${styles.label}`}>
        <span>{label}</span>
        <span className={`rounded px-2 py-0.5 text-[10px] ${styles.count}`}>{tasks.length}</span>
      </header>
      <div className="flex flex-col gap-3">
        {tasks.length === 0 ? (
          <p className={`mt-8 text-center text-xs ${styles.empty}`}>タスクなし</p>
        ) : (
          tasks.map((task, index) => (
            <TaskCard
              key={task.task_id ?? `${memberKey}-${index}`}
              task={task}
              styles={styles}
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

  const { tasks, isLoading, isError } = useTasksByProjectId(projectId);
  const { members, isLoading: membersLoading, isError: membersError } = useProjectMembers(projectId);
  const [board, setBoard] = useState<BoardState>(() => ({}));
  const [isUpdating, setIsUpdating] = useState(false);
  const draggingTaskIdRef = useRef<string | null>(null);

  const memberNames = useMemo(() => {
    return members?.map(m => m.member_name) ?? [];
  }, [members]);

  const memberColumns = useMemo(() => {
    const columns = memberNames.map(name => ({ key: name, label: name }));
    columns.push({ key: UNASSIGNED_KEY, label: '未割り当て' });
    return columns;
  }, [memberNames]);

  const columnStyles = useMemo(() => {
    const styles: Record<string, ComputedColumnStyle> = {};
    memberNames.forEach(name => {
      styles[name] = computeColumnStyle(MEMBER_COLUMN_THEME, darkMode);
    });
    styles[UNASSIGNED_KEY] = computeColumnStyle(UNASSIGNED_COLUMN_THEME, darkMode);
    return styles;
  }, [memberNames, darkMode]);

  useEffect(() => {
    if (tasks && members) {
      setBoard(buildBoardFromTasks(tasks, memberNames));
    }
  }, [tasks, members, memberNames]);

  useEffect(() => {
    if (!projectId || triggeredHandsOnProjects.has(projectId)) {
      return;
    }

    const checkAndStartHandsOnGeneration = async () => {
      try {
        // Step 1: タスクを取得
        const tasksResponse = await axios.get<TaskType[]>(`${API_URL}/task/project/${projectId}`);
        const tasks = tasksResponse.data;

        if (tasks.length === 0) {
          console.log('[HandsOn] No tasks found, skipping hands-on generation');
          return;
        }

        // Step 2: 最初のタスクのハンズオンが既に存在するかチェック
        const firstTask = tasks[0];
        const handsOnResponse = await fetchTaskHandsOn(firstTask.task_id!);

        if (handsOnResponse.has_hands_on) {
          console.log('[HandsOn] Hands-on already exists, skipping generation');
          triggeredHandsOnProjects.add(projectId);
          return;
        }

        // Step 3: ハンズオン生成を開始
        console.log('[HandsOn] Starting hands-on generation for project:', projectId);
        await startHandsOnGeneration({ project_id: projectId });
        triggeredHandsOnProjects.add(projectId);
      } catch (error) {
        console.error('[HandsOn] Failed to check/start hands-on generation:', error);
        // エラーが発生してもSetに追加して、無限ループを防ぐ
        triggeredHandsOnProjects.add(projectId);
      }
    };

    checkAndStartHandsOnGeneration();
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
    (newAssignee: string) => async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const taskId = draggingTaskIdRef.current;
      if (!taskId) {
        return;
      }

      const snapshot: BoardState = {};
      for (const key in board) {
        snapshot[key] = [...board[key]];
      }

      const { board: nextBoard, moved } = moveTaskToMember(board, taskId, newAssignee);
      if (!moved) {
        draggingTaskIdRef.current = null;
        return;
      }

      setBoard(nextBoard);
      setIsUpdating(true);

      try {
        const assigneeValue = newAssignee === UNASSIGNED_KEY ? null : newAssignee;
        await patchTask(taskId, { assignee: assigneeValue ?? undefined });
      } catch (error) {
        console.error('Failed to update task assignee:', error);
        setBoard(snapshot);
        alert('タスクの更新に失敗しました');
      } finally {
        setIsUpdating(false);
        draggingTaskIdRef.current = null;
      }
    },
    [board],
  );

  const handleToggleComplete = useCallback(
    async (taskId?: string) => {
      if (!taskId) return;

      const task = Object.values(board)
        .flat()
        .find(t => t.task_id === taskId);

      if (!task) return;

      const newCompletedState = !task.completed;

      setBoard((prevBoard) => {
        const nextBoard: BoardState = {};
        for (const memberName in prevBoard) {
          nextBoard[memberName] = prevBoard[memberName].map(t =>
            t.task_id === taskId ? { ...t, completed: newCompletedState } : t
          );
        }
        return nextBoard;
      });

      try {
        await patchTask(taskId, { completed: newCompletedState });
      } catch (error) {
        console.error('Failed to update task completion:', error);
        setBoard((prevBoard) => {
          const nextBoard: BoardState = {};
          for (const memberName in prevBoard) {
            nextBoard[memberName] = prevBoard[memberName].map(t =>
              t.task_id === taskId ? { ...t, completed: !newCompletedState } : t
            );
          }
          return nextBoard;
        });
        alert('タスクの完了状態の更新に失敗しました');
      }
    },
    [board]
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

  const loadingContainerClass = darkMode
    ? 'flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900'
    : 'flex min-h-screen items-center justify-center bg-gray-100';

  const loadingTextClass = darkMode ? 'text-sm text-cyan-200' : 'text-sm text-gray-600';

  const errorTextClass = darkMode ? 'text-sm text-rose-300' : 'text-sm text-red-600';

  if (isLoading || membersLoading) {
    return (
      <div className={loadingContainerClass}>
        <p className={loadingTextClass}>読み込み中...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={loadingContainerClass}>
        <p className={errorTextClass}>タスクの取得に失敗しました</p>
      </div>
    );
  }

  if (membersError) {
    return (
      <div className={loadingContainerClass}>
        <p className={errorTextClass}>メンバー情報の取得に失敗しました</p>
      </div>
    );
  }

  const pageBackgroundClass = darkMode
    ? 'min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6'
    : 'min-h-screen bg-gray-100 p-6';

  const panelClass = darkMode
    ? 'mx-auto flex max-w-5xl flex-col gap-4 rounded-lg border border-cyan-500/20 bg-slate-950/60 p-4 shadow-[0_0_40px_rgba(6,182,212,0.12)] backdrop-blur'
    : 'mx-auto flex max-w-5xl flex-col gap-4 rounded-lg border border-transparent bg-white/70 p-4 shadow-sm backdrop-blur';

  const headerClass = darkMode ? 'space-y-1 text-slate-100' : 'space-y-1 text-gray-800';
  const titleClass = darkMode ? 'text-2xl font-bold tracking-wide text-cyan-200' : 'text-2xl font-bold text-gray-800';
  const projectIdClass = darkMode ? 'text-xs text-slate-300' : 'text-xs text-gray-500';
  const updatingClass = darkMode ? 'text-xs text-cyan-300' : 'text-xs text-blue-600';
  const primaryButtonClass = darkMode
    ? 'border border-cyan-500/40 bg-slate-950/60 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.35)]'
    : 'border border-blue-200 bg-white/80 text-blue-600 shadow-sm';
  const primaryButtonHoverClass = darkMode ? 'hover:border-cyan-300/60 hover:text-cyan-100' : 'hover:border-blue-400 hover:text-blue-700';
  const kanbanButtonClass = darkMode
    ? 'border border-fuchsia-500/40 bg-slate-950/60 text-fuchsia-200 shadow-[0_0_16px_rgba(217,70,239,0.35)]'
    : 'border border-purple-200 bg-white/80 text-purple-600 shadow-sm';
  const kanbanButtonHoverClass = darkMode ? 'hover:border-fuchsia-300/60 hover:text-fuchsia-100' : 'hover:border-purple-400 hover:text-purple-700';

  const overviewHref = projectId ? `../${projectId}` : '..';

  return (
    <div className={pageBackgroundClass}>
      <Header
        containerClass={panelClass}
        headerClass={headerClass}
        titleClass={titleClass}
        projectId={projectId}
        projectIdClass={projectIdClass}
        isUpdating={isUpdating}
        updatingClass={updatingClass}
        primaryButtonClass={primaryButtonClass}
        primaryButtonHoverClass={primaryButtonHoverClass}
        kanbanButtonClass={kanbanButtonClass}
        kanbanButtonHoverClass={kanbanButtonHoverClass}
        overviewHref={overviewHref}
      >
        <div className="flex gap-4 overflow-x-auto">
          {memberColumns.map(({ key, label }) => (
            <TaskColumn
              key={key}
              memberKey={key}
              label={label}
              tasks={board[key] ?? []}
              styles={columnStyles[key] ?? columnStyles[UNASSIGNED_KEY]}
              onDrop={handleColumnDrop(key)}
              onDragStart={handleCardDragStart}
              onDragEnd={handleCardDragEnd}
              onSelect={handleTaskSelect}
              onToggleComplete={handleToggleComplete}
            />
          ))}
        </div>
      </Header>
    </div>
  );
}
