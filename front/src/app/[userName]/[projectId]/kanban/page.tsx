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
import { TaskType, TaskStatusEnum } from '@/types/modelTypes';
import { startHandsOnGeneration, fetchTaskHandsOn } from '@/libs/service/taskHandsOnService';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const triggeredHandsOnProjects = new Set<string>();

type BoardState = Record<TaskStatusEnum, TaskType[]>;

type MoveResult = {
  board: BoardState;
  moved: boolean;
};

const STATUS_LIST: ReadonlyArray<{ key: TaskStatusEnum; label: string }> = [
  { key: 'TODO', label: 'TODO' },
  { key: 'DOING', label: 'DOING' },
  { key: 'DONE', label: 'DONE' },
] as const;

type ThemeVariant = {
  light: string;
  dark: string;
};

type StatusTheme = {
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

const STATUS_THEME: Record<TaskStatusEnum, StatusTheme> = {
  TODO: {
    column: {
      light: 'border-gray-200 bg-gray-50 shadow-sm',
      dark: 'border-pink-500/40 bg-slate-950/70 shadow-[0_0_18px_rgba(236,72,153,0.2)]',
    },
    label: {
      light: 'text-gray-700',
      dark: 'text-pink-200',
    },
    count: {
      light: 'bg-white text-gray-500',
      dark: 'border border-pink-500/40 bg-slate-900/80 text-pink-200',
    },
    card: {
      light: 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md',
      dark: 'border-pink-500/30 bg-slate-900/80 hover:border-pink-400/60 shadow-[0_0_16px_rgba(236,72,153,0.25)]',
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
      dark: 'border border-pink-400/50 bg-pink-500/10 text-pink-200',
    },
    empty: {
      light: 'text-gray-400',
      dark: 'text-slate-500',
    },
  },
  DOING: {
    column: {
      light: 'border-blue-200 bg-blue-50 shadow-sm',
      dark: 'border-cyan-500/40 bg-slate-950/70 shadow-[0_0_18px_rgba(6,182,212,0.2)]',
    },
    label: {
      light: 'text-blue-700',
      dark: 'text-cyan-200',
    },
    count: {
      light: 'bg-white text-blue-600',
      dark: 'border border-cyan-500/40 bg-slate-900/80 text-cyan-200',
    },
    card: {
      light: 'border-blue-200 bg-white hover:border-blue-300 hover:shadow-md',
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
      light: 'text-blue-600/80',
      dark: 'text-cyan-200',
    },
    priority: {
      light: 'bg-blue-100 text-blue-600',
      dark: 'border border-cyan-400/50 bg-cyan-500/10 text-cyan-200',
    },
    empty: {
      light: 'text-blue-400',
      dark: 'text-cyan-300',
    },
  },
  DONE: {
    column: {
      light: 'border-emerald-200 bg-emerald-50 shadow-sm',
      dark: 'border-emerald-500/40 bg-slate-950/70 shadow-[0_0_18px_rgba(16,185,129,0.2)]',
    },
    label: {
      light: 'text-emerald-700',
      dark: 'text-emerald-200',
    },
    count: {
      light: 'bg-white text-emerald-600',
      dark: 'border border-emerald-500/40 bg-slate-900/80 text-emerald-200',
    },
    card: {
      light: 'border-emerald-200 bg-white hover:border-emerald-300 hover:shadow-md',
      dark: 'border-emerald-500/30 bg-slate-900/80 hover:border-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.25)]',
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
      light: 'text-emerald-600/80',
      dark: 'text-emerald-200',
    },
    priority: {
      light: 'bg-emerald-100 text-emerald-700',
      dark: 'border border-emerald-400/50 bg-emerald-500/10 text-emerald-200',
    },
    empty: {
      light: 'text-emerald-400',
      dark: 'text-emerald-300',
    },
  },
};

type ComputedStatusStyle = {
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

const createEmptyBoard = (): BoardState => ({
  TODO: [],
  DOING: [],
  DONE: [],
});

const buildBoardFromTasks = (tasks?: TaskType[]): BoardState => {
  const board = createEmptyBoard();
  tasks?.forEach((task) => {
    const status: TaskStatusEnum = task.status ?? 'TODO';
    board[status].push(task);
  });
  return board;
};

const moveTaskToStatus = (
  state: BoardState,
  taskId: string,
  newStatus: TaskStatusEnum,
): MoveResult => {
  const next: BoardState = {
    TODO: [...state.TODO],
    DOING: [...state.DOING],
    DONE: [...state.DONE],
  };

  let sourceStatus: TaskStatusEnum | null = null;
  let task: TaskType | undefined;

  for (const { key } of STATUS_LIST) {
    const index = next[key].findIndex((item) => item.task_id === taskId);
    if (index !== -1) {
      sourceStatus = key;
      task = next[key][index];
      next[key].splice(index, 1);
      break;
    }
  }

  if (!task || sourceStatus === newStatus) {
    return { board: state, moved: false };
  }

  const updatedTask: TaskType = { ...task, status: newStatus };
  next[newStatus] = [updatedTask, ...next[newStatus]];

  return { board: next, moved: true };
};

type TaskCardProps = {
  task: TaskType;
  styles: ComputedStatusStyle;
  onDragStart: (taskId?: string) => void;
  onDragEnd: () => void;
  onSelect: (taskId?: string) => void;
};

function TaskCard({ task, styles, onDragStart, onDragEnd, onSelect }: TaskCardProps) {
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
      <h3 className={`font-semibold ${styles.title}`}>{task.title}</h3>
      {task.description && (
        <p className={`mt-2 text-xs ${styles.description}`}>{task.description}</p>
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

type TaskColumnProps = {
  status: TaskStatusEnum;
  label: string;
  tasks: TaskType[];
  styles: ComputedStatusStyle;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (taskId?: string) => void;
  onDragEnd: () => void;
  onSelect: (taskId?: string) => void;
};

function TaskColumn({ status, label, tasks, styles, onDrop, onDragStart, onDragEnd, onSelect }: TaskColumnProps) {
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <section
      aria-label={`${label} column`}
      className={`flex min-w-[220px] flex-1 flex-col gap-3 rounded border p-4 transition backdrop-blur-sm ${styles.column}`}
      data-status={status}
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
              key={task.task_id ?? `${status}-${index}`}
              task={task}
              styles={styles}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onSelect={onSelect}
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
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard());
  const [isUpdating, setIsUpdating] = useState(false);
  const draggingTaskIdRef = useRef<string | null>(null);

  const statusStyles = useMemo(() => {
    return STATUS_LIST.reduce((acc, { key }) => {
      const theme = STATUS_THEME[key];
      acc[key] = {
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
      return acc;
    }, {} as Record<TaskStatusEnum, ComputedStatusStyle>);
  }, [darkMode]);

  useEffect(() => {
    setBoard(buildBoardFromTasks(tasks));
  }, [tasks]);

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
    (newStatus: TaskStatusEnum) => async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const taskId = draggingTaskIdRef.current;
      if (!taskId) {
        return;
      }

      const snapshot: BoardState = {
        TODO: [...board.TODO],
        DOING: [...board.DOING],
        DONE: [...board.DONE],
      };

      const { board: nextBoard, moved } = moveTaskToStatus(board, taskId, newStatus);
      if (!moved) {
        draggingTaskIdRef.current = null;
        return;
      }

      setBoard(nextBoard);
      setIsUpdating(true);

      try {
        await patchTask(taskId, { status: newStatus });
      } catch (error) {
        console.error('Failed to update task status:', error);
        setBoard(snapshot);
        alert('タスクの更新に失敗しました');
      } finally {
        setIsUpdating(false);
        draggingTaskIdRef.current = null;
      }
    },
    [board],
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
        <p className={errorTextClass}>タスクの取得に失敗しました</p>
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
          {STATUS_LIST.map(({ key, label }) => (
            <TaskColumn
              key={key}
              status={key}
              label={label}
              tasks={board[key]}
              styles={statusStyles[key]}
              onDrop={handleColumnDrop(key)}
              onDragStart={handleCardDragStart}
              onDragEnd={handleCardDragEnd}
              onSelect={handleTaskSelect}
            />
          ))}
        </div>
      </Header>
    </div>
  );
}
