"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, GitBranch, ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSession } from 'next-auth/react';
import { useTasksByProjectId, postTaskAssignment, deleteTaskAssignment } from '@/libs/modelAPI/task';
import { TaskType, TaskStatusEnum, TaskAssignmentType, ProjectMemberType } from '@/types/modelTypes';
import { getProjectMembersByProjectId, postProjectMember } from '@/libs/modelAPI/project_member';
import { getMemberByGithubName } from '@/libs/modelAPI/member';
// NOTE: 旧一括生成は廃止。各タスクページでインタラクティブ生成を使用
// import { startHandsOnGeneration, fetchTaskHandsOn } from '@/libs/service/taskHandsOnService';
import CyberHeader from '@/components/Session/Header';
import axios from 'axios';
import { AgentChatWidget } from '@/components/chat';
import { ChangeRequestChatWidget } from '@/components/ChangeRequest';

// dnd-kit imports
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
// NOTE: 旧一括生成用の重複防止Setは廃止
// const triggeredHandsOnProjects = new Set<string>();

// TaskType with assignments
type TaskWithAssignments = TaskType & {
  assignments?: TaskAssignmentType[];
};

// ユーザーベースのボード状態（メンバーIDまたは"unassigned"をキーとする）
type BoardState = Record<string, TaskWithAssignments[]>;

type MoveResult = {
  board: BoardState;
  moved: boolean;
};

// 未割り当てタスク用の定数
const UNASSIGNED_KEY = "unassigned" as const;

// メンバーカラムのスタイル（ユーザーごとに異なる色）
type ColumnStyle = {
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

// カラムのカラーバリエーション (combined light dark: dark classes)
const COLUMN_COLORS = [
  {
    column:
      "border-purple-200 bg-purple-50 shadow-sm dark:border-purple-500/40 dark:bg-slate-950/70 dark:shadow-[0_0_18px_rgba(168,85,247,0.2)]",
    label: "text-purple-700 dark:text-purple-200",
    count:
      "bg-white text-purple-600 dark:border dark:border-purple-500/40 dark:bg-slate-900/80 dark:text-purple-200",
    card: "border-purple-200 bg-white hover:border-purple-300 hover:shadow-md dark:border-purple-500/30 dark:bg-slate-900/80 dark:hover:border-purple-400/60 dark:shadow-[0_0_16px_rgba(168,85,247,0.25)]",
  },
  {
    column:
      "border-blue-200 bg-blue-50 shadow-sm dark:border-cyan-500/40 dark:bg-slate-950/70 dark:shadow-[0_0_18px_rgba(6,182,212,0.2)]",
    label: "text-blue-700 dark:text-cyan-200",
    count:
      "bg-white text-blue-600 dark:border dark:border-cyan-500/40 dark:bg-slate-900/80 dark:text-cyan-200",
    card: "border-blue-200 bg-white hover:border-blue-300 hover:shadow-md dark:border-cyan-500/30 dark:bg-slate-900/80 dark:hover:border-cyan-400/60 dark:shadow-[0_0_16px_rgba(6,182,212,0.25)]",
  },
  {
    column:
      "border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-500/40 dark:bg-slate-950/70 dark:shadow-[0_0_18px_rgba(16,185,129,0.2)]",
    label: "text-emerald-700 dark:text-emerald-200",
    count:
      "bg-white text-emerald-600 dark:border dark:border-emerald-500/40 dark:bg-slate-900/80 dark:text-emerald-200",
    card: "border-emerald-200 bg-white hover:border-emerald-300 hover:shadow-md dark:border-emerald-500/30 dark:bg-slate-900/80 dark:hover:border-emerald-400/60 dark:shadow-[0_0_16px_rgba(16,185,129,0.25)]",
  },
  {
    column:
      "border-pink-200 bg-pink-50 shadow-sm dark:border-pink-500/40 dark:bg-slate-950/70 dark:shadow-[0_0_18px_rgba(236,72,153,0.2)]",
    label: "text-pink-700 dark:text-pink-200",
    count:
      "bg-white text-pink-600 dark:border dark:border-pink-500/40 dark:bg-slate-900/80 dark:text-pink-200",
    card: "border-pink-200 bg-white hover:border-pink-300 hover:shadow-md dark:border-pink-500/30 dark:bg-slate-900/80 dark:hover:border-pink-400/60 dark:shadow-[0_0_16px_rgba(236,72,153,0.25)]",
  },
  {
    column:
      "border-orange-200 bg-orange-50 shadow-sm dark:border-orange-500/40 dark:bg-slate-950/70 dark:shadow-[0_0_18px_rgba(249,115,22,0.2)]",
    label: "text-orange-700 dark:text-orange-200",
    count:
      "bg-white text-orange-600 dark:border dark:border-orange-500/40 dark:bg-slate-900/80 dark:text-orange-200",
    card: "border-orange-200 bg-white hover:border-orange-300 hover:shadow-md dark:border-orange-500/30 dark:bg-slate-900/80 dark:hover:border-orange-400/60 dark:shadow-[0_0_16px_rgba(249,115,22,0.25)]",
  },
];

// 未割り当てカラムのスタイル (combined light dark: dark classes)
const UNASSIGNED_COLORS = {
  column:
    "border-gray-300 bg-gray-100 shadow-sm dark:border-slate-600/40 dark:bg-slate-950/70 dark:shadow-[0_0_18px_rgba(100,116,139,0.2)]",
  label: "text-gray-600 dark:text-slate-300",
  count:
    "bg-white text-gray-500 dark:border dark:border-slate-600/40 dark:bg-slate-900/80 dark:text-slate-300",
  card: "border-gray-300 bg-white hover:border-gray-400 hover:shadow-md dark:border-slate-600/30 dark:bg-slate-900/80 dark:hover:border-slate-500/60 dark:shadow-[0_0_16px_rgba(100,116,139,0.25)]",
};

// 共通スタイル (combined light dark: dark classes)
const COMMON_STYLES = {
  title: "text-gray-800 dark:text-slate-100",
  description: "text-gray-500 dark:text-slate-300",
  meta: "text-gray-500 dark:text-slate-300",
  priority:
    "bg-gray-100 text-gray-600 dark:border dark:border-slate-400/50 dark:bg-slate-500/10 dark:text-slate-200",
  empty: "text-gray-400 dark:text-slate-500",
};

// メンバーIDに基づいて色を取得
const getColumnColor = (memberIndex: number): ColumnStyle => {
  const colorIndex = memberIndex % COLUMN_COLORS.length;
  const color = COLUMN_COLORS[colorIndex];

  return {
    ...color,
    ...COMMON_STYLES,
  };
};

// 未割り当てカラムのスタイルを取得
const getUnassignedColumnStyle = (): ColumnStyle => {
  return {
    ...UNASSIGNED_COLORS,
    ...COMMON_STYLES,
  };
};

// カンバンボード固有のナビゲーション
type KanbanNavigationProps = {
  projectId?: string;
  userName?: string;
  isUpdating: boolean;
  onChangeRequest?: () => void;
};


function KanbanNavigation({ projectId, userName, isUpdating, onChangeRequest }: KanbanNavigationProps) {
  const overviewHref = projectId && userName ? `/${userName}/${projectId}` : '#';

  return (
    <div className="mb-6 rounded-lg border border-purple-300/20 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-cyan-500/20 dark:bg-slate-950/60 dark:shadow-[0_0_20px_rgba(6,182,212,0.12)]">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-purple-600 dark:tracking-wide dark:text-cyan-200">
            Kanban Board
          </h1>
          {projectId && (
            <p className="text-xs text-gray-500 dark:text-slate-300">
              Project ID: <span className="font-mono">{projectId}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* 仕様変更ボタン */}
          {onChangeRequest && (
            <button
              onClick={onChangeRequest}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 border-2 border-purple-500 bg-white text-purple-600 shadow-md hover:bg-purple-50 hover:border-purple-600 dark:border-purple-400 dark:bg-purple-500/20 dark:text-purple-100 dark:shadow-[0_0_20px_rgba(168,85,247,0.3)] dark:hover:bg-purple-500/30 dark:hover:border-purple-300"
            >
              <span>仕様変更</span>
            </button>
          )}

          {/* 戻るボタン */}
          <Link
            href={overviewHref}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 border-2 border-purple-500 bg-purple-500 text-white shadow-lg hover:bg-purple-600 hover:border-purple-600 dark:border-cyan-400 dark:bg-cyan-500/20 dark:text-cyan-100 dark:shadow-[0_0_20px_rgba(6,182,212,0.4)] dark:hover:bg-cyan-500/30 dark:hover:border-cyan-300 dark:hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]"
          >
            <ArrowLeft size={18} />
            <GitBranch size={16} />
            <span>依存グラフに戻る</span>
          </Link>
        </div>
      </header>

      {isUpdating && (
        <p className="mt-2 text-xs text-purple-600 animate-pulse dark:text-cyan-300">
          更新中...
        </p>
      )}
    </div>
  );
}

// メンバーごとの空ボードを作成
const createEmptyBoard = (members: ProjectMemberType[]): BoardState => {
  const board: BoardState = {
    [UNASSIGNED_KEY]: [],
  };

  members.forEach((member) => {
    if (member.project_member_id) {
      board[member.project_member_id] = [];
    }
  });

  return board;
};

// タスクとアサインメント情報からボードを構築
const buildBoardFromTasks = (
  tasks: TaskWithAssignments[] | undefined,
  members: ProjectMemberType[],
  taskAssignments: Record<string, TaskAssignmentType[]>,
): BoardState => {
  const board = createEmptyBoard(members);

  tasks?.forEach((task) => {
    const taskWithAssignments: TaskWithAssignments = {
      ...task,
      assignments: task.task_id ? taskAssignments[task.task_id] || [] : [],
    };

    // タスクの割り当て情報を取得
    const assignments = task.task_id ? taskAssignments[task.task_id] || [] : [];

    if (assignments.length === 0) {
      // 未割り当てタスク
      board[UNASSIGNED_KEY].push(taskWithAssignments);
    } else {
      // 各アサインメントのメンバーカラムに追加
      assignments.forEach((assignment) => {
        const memberId = assignment.project_member_id;
        if (board[memberId]) {
          // 重複を避けるため、既に追加されていないかチェック
          const alreadyAdded = board[memberId].some(
            (t) => t.task_id === task.task_id,
          );
          if (!alreadyAdded) {
            board[memberId].push(taskWithAssignments);
          }
        }
      });
    }
  });

  return board;
};

// タスクを別のメンバーカラムに移動
const moveTaskToMember = (
  state: BoardState,
  taskId: string,
  targetMemberId: string,
): MoveResult => {
  const next: BoardState = {};

  // すべてのカラムをコピー
  Object.keys(state).forEach((key) => {
    next[key] = [...state[key]];
  });

  let sourceColumnKey: string | null = null;
  let task: TaskWithAssignments | undefined;

  // タスクを見つけて元のカラムから削除
  for (const columnKey of Object.keys(next)) {
    const index = next[columnKey].findIndex((item) => item.task_id === taskId);
    if (index !== -1) {
      sourceColumnKey = columnKey;
      task = next[columnKey][index];
      next[columnKey].splice(index, 1);
      break;
    }
  }

  if (!task || sourceColumnKey === targetMemberId) {
    return { board: state, moved: false };
  }

  // ターゲットカラムに追加
  if (!next[targetMemberId]) {
    next[targetMemberId] = [];
  }
  next[targetMemberId] = [task, ...next[targetMemberId]];

  return { board: next, moved: true };
};

// ステータスのバッジ色を取得 (combined light dark: dark classes)
const getStatusBadgeClass = (status?: TaskStatusEnum) => {
  if (!status) return "";

  const statusColors = {
    TODO: "bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-500/20 dark:text-pink-200 dark:border-pink-500/40",
    DOING:
      "bg-blue-100 text-blue-700 border-blue-300 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-500/40",
    DONE: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/40",
  };

  return statusColors[status] || "";
};

// SortableTaskCard - dnd-kit対応のドラッグ可能なタスクカード
type SortableTaskCardProps = {
  task: TaskWithAssignments;
  styles: ColumnStyle;
  showStatus?: boolean;
  onSelect: (taskId?: string) => void;
};

function SortableTaskCard({
  task,
  styles,
  showStatus = false,
  onSelect,
}: SortableTaskCardProps) {
  const taskId = task.task_id || `temp-${Math.random()}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: taskId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto' as const,
  };

  const handleClick = (e: React.MouseEvent) => {
    // ドラッグ中はクリックを無視
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (task.task_id) {
      onSelect(task.task_id);
    }
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded border p-3 text-sm shadow-sm transition-all cursor-grab active:cursor-grabbing ${styles.card} ${isDragging ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={task.task_id ? 0 : -1}
    >
      <h3 className={`font-semibold truncate ${styles.title}`}>{task.title}</h3>
      {task.description && (
        <p className={`mt-2 text-xs line-clamp-2 ${styles.description}`}>{task.description}</p>
      )}
      <div
        className={`mt-2 flex items-center justify-between gap-2 text-xs ${styles.meta}`}
      >
        <div className="flex items-center gap-2">
          {task.priority && (
            <span className={`rounded px-2 py-0.5 ${styles.priority}`}>
              {task.priority}
            </span>
          )}
          {showStatus && task.status && (
            <span
              className={`rounded px-2 py-0.5 border text-xs ${getStatusBadgeClass(task.status)}`}
            >
              {task.status}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// TaskCardOverlay - ドラッグ中のオーバーレイ表示用
type TaskCardOverlayProps = {
  task: TaskWithAssignments;
  styles: ColumnStyle;
  showStatus?: boolean;
};

function TaskCardOverlay({
  task,
  styles,
  showStatus = false,
}: TaskCardOverlayProps) {
  return (
    <article
      className={`rounded border p-3 text-sm shadow-xl transition ${styles.card} cursor-grabbing ring-2 ring-blue-500 rotate-3`}
      style={{ width: '280px' }}
    >
      <h3 className={`font-semibold truncate ${styles.title}`}>{task.title}</h3>
      {task.description && (
        <p className={`mt-2 text-xs line-clamp-2 ${styles.description}`}>{task.description}</p>
      )}
      <div
        className={`mt-2 flex items-center justify-between gap-2 text-xs ${styles.meta}`}
      >
        <div className="flex items-center gap-2">
          {task.priority && (
            <span className={`rounded px-2 py-0.5 ${styles.priority}`}>
              {task.priority}
            </span>
          )}
          {showStatus && task.status && (
            <span
              className={`rounded px-2 py-0.5 border text-xs ${getStatusBadgeClass(task.status)}`}
            >
              {task.status}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// カテゴリの定義と表示設定
const TASK_CATEGORIES = [
  { key: 'フロントエンド', label: 'フロントエンド', icon: '🎨', color: 'text-blue-600 dark:text-cyan-300' },
  { key: 'バックエンド', label: 'バックエンド', icon: '⚙️', color: 'text-green-600 dark:text-emerald-300' },
  { key: 'DB設計', label: 'DB設計', icon: '🗄️', color: 'text-purple-600 dark:text-purple-300' },
  { key: 'other', label: 'その他', icon: '📋', color: 'text-gray-600 dark:text-slate-300' },
] as const;

// カテゴリセクション（トグル付き）
type CategorySectionProps = {
  categoryKey: string;
  label: string;
  icon: string;
  color: string;
  tasks: TaskWithAssignments[];
  styles: ColumnStyle;
  onSelect: (taskId?: string) => void;
};

function CategorySection({
  categoryKey,
  label,
  icon,
  color,
  tasks,
  styles,
  onSelect,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (tasks.length === 0) return null;

  const taskIds = tasks.map(t => t.task_id || `temp-${Math.random()}`);

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* カテゴリヘッダー（クリックでトグル） */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-1.5 text-xs font-medium ${color} hover:opacity-80 transition-opacity w-full text-left`}
      >
        <ChevronDown
          size={14}
          className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`}
        />
        <span>{icon}</span>
        <span>{label}</span>
        <span className="text-[10px] opacity-70">({tasks.length})</span>
      </button>
      {/* カテゴリ内のタスク */}
      {isExpanded && (
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 pl-1 w-full">
            {tasks.map((task, index) => (
              <SortableTaskCard
                key={task.task_id ?? `category-${categoryKey}-${index}`}
                task={task}
                styles={styles}
                showStatus={true}
                onSelect={onSelect}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

type MemberColumnProps = {
  memberId: string;
  memberName: string;
  tasks: TaskWithAssignments[];
  styles: ColumnStyle;
  isUnassigned?: boolean;
  onSelect: (taskId?: string) => void;
};

function MemberColumn({
  memberId,
  memberName,
  tasks,
  styles,
  isUnassigned = false,
  onSelect,
}: MemberColumnProps) {
  // dnd-kitのドロップ対象として登録
  const { isOver, setNodeRef } = useDroppable({
    id: memberId,
  });

  // タスクをカテゴリ別にグループ化
  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskWithAssignments[]> = {
      'フロントエンド': [],
      'バックエンド': [],
      'DB設計': [],
      'other': [],
    };

    tasks.forEach((task) => {
      const category = task.category || 'other';
      if (groups[category]) {
        groups[category].push(task);
      } else {
        groups['other'].push(task);
      }
    });

    return groups;
  }, [tasks]);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${memberName} column`}
      className={`flex flex-col gap-3 rounded border p-4 transition-all duration-200 backdrop-blur-sm h-fit min-w-[320px] w-[320px] flex-shrink-0 overflow-hidden ${styles.column} ${isOver ? 'ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-900/20 scale-[1.02]' : ''}`}
      data-member-id={memberId}
    >
      <header
        className={`flex items-center justify-between text-xs font-semibold transition ${styles.label}`}
      >
        <div className="flex items-center gap-2">
          {!isUnassigned && (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {memberName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
          )}
          <span className="truncate">{memberName}</span>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-[10px] shrink-0 ${styles.count}`}
        >
          {tasks.length}
        </span>
      </header>
      <div className="flex flex-col gap-4 min-h-[150px] w-full">
        {tasks.length === 0 ? (
          <p className={`mt-4 text-center text-xs ${styles.empty}`}>
            タスクなし
          </p>
        ) : (
          TASK_CATEGORIES.map(({ key, label, icon, color }) => (
            <CategorySection
              key={key}
              categoryKey={key}
              label={label}
              icon={icon}
              color={color}
              tasks={groupedTasks[key] || []}
              styles={styles}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </section>
  );
}

// 未割り当てタスクをカテゴリ別に表示するコンポーネント
type UnassignedColumnProps = {
  tasks: TaskWithAssignments[];
  styles: ColumnStyle;
  onSelect: (taskId?: string) => void;
};

function UnassignedColumn({
  tasks,
  styles,
  onSelect,
}: UnassignedColumnProps) {
  // dnd-kitのドロップ対象として登録
  const { isOver, setNodeRef } = useDroppable({
    id: UNASSIGNED_KEY,
  });

  // タスクをカテゴリ別にグループ化
  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskWithAssignments[]> = {
      'フロントエンド': [],
      'バックエンド': [],
      'DB設計': [],
      'other': [],
    };

    tasks.forEach((task) => {
      const category = task.category || 'other';
      if (groups[category]) {
        groups[category].push(task);
      } else {
        groups['other'].push(task);
      }
    });

    return groups;
  }, [tasks]);

  return (
    <section
      ref={setNodeRef}
      aria-label="未割り当て column"
      className={`flex flex-col gap-3 rounded border p-4 transition-all duration-200 backdrop-blur-sm h-fit min-w-[320px] w-[320px] flex-shrink-0 overflow-hidden ${styles.column} ${isOver ? 'ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-900/20 scale-[1.02]' : ''}`}
      data-member-id={UNASSIGNED_KEY}
    >
      <header className={`flex items-center justify-between text-xs font-semibold transition ${styles.label}`}>
        <span className="truncate">未割り当て</span>
        <span className={`rounded px-2 py-0.5 text-[10px] shrink-0 ${styles.count}`}>{tasks.length}</span>
      </header>

      <div className="flex flex-col gap-4 min-h-[400px] w-full">
        {tasks.length === 0 ? (
          <p className={`mt-4 text-center text-xs ${styles.empty}`}>タスクなし</p>
        ) : (
          TASK_CATEGORIES.map(({ key, label, icon, color }) => (
            <CategorySection
              key={key}
              categoryKey={key}
              label={label}
              icon={icon}
              color={color}
              tasks={groupedTasks[key] || []}
              styles={styles}
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
  const { data: session } = useSession();
  const projectId = params?.projectId as string | undefined;
  const userName = params?.userName as string | undefined;

  const { tasks, isLoading, isError, mutate: mutateTasks } = useTasksByProjectId(projectId);
  const [board, setBoard] = useState<BoardState>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberType[]>([]);

  const [taskAssignments, setTaskAssignments] = useState<Record<string, TaskAssignmentType[]>>({});
  const [isChangeRequestOpen, setIsChangeRequestOpen] = useState(false);

  // dnd-kit: ドラッグ中のタスク状態
  const [activeTask, setActiveTask] = useState<TaskWithAssignments | null>(null);
  const [activeTaskColumnId, setActiveTaskColumnId] = useState<string | null>(null);

  // dnd-kit: センサーの設定（8px以上動かしたらドラッグ開始）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ログインユーザーをプロジェクトメンバーに自動追加
  const ensureUserIsProjectMember = useCallback(
    async (projectId: string, githubName: string) => {
      try {
        // プロジェクトメンバーを取得
        const members = await getProjectMembersByProjectId(projectId);

        // ログインユーザーのメンバー情報を取得
        const currentMember = await getMemberByGithubName(githubName);

        // 既にメンバーに含まれているかチェック
        const isAlreadyMember = members.some(
          (pm) => pm.member_id === currentMember.member_id,
        );

        if (!isAlreadyMember) {
          // プロジェクトメンバーに追加
          await postProjectMember({
            project_id: projectId,
            member_id: currentMember.member_id,
            member_name: currentMember.member_name,
          });
          console.log(
            `ユーザー ${githubName} をプロジェクトメンバーに追加しました`,
          );

          // メンバーリストを再取得
          const updatedMembers = await getProjectMembersByProjectId(projectId);
          setProjectMembers(updatedMembers);
        }
      } catch (error) {
        console.error("プロジェクトメンバー追加エラー:", error);
      }
    },
    [],
  );

  // ログインユーザーをプロジェクトメンバーに追加（初回のみ）
  useEffect(() => {
    if (projectId && session?.user?.name) {
      ensureUserIsProjectMember(projectId, session.user.name);
    }
  }, [projectId, session?.user?.name, ensureUserIsProjectMember]);

  // メンバーごとのスタイルを生成
  const columnStyles = useMemo(() => {
    const styles: Record<string, ColumnStyle> = {};

    // 未割り当てカラムのスタイル
    styles[UNASSIGNED_KEY] = getUnassignedColumnStyle();

    // 各メンバーのスタイル
    projectMembers.forEach((member, index) => {
      if (member.project_member_id) {
        styles[member.project_member_id] = getColumnColor(index);
      }
    });

    return styles;
  }, [projectMembers]);

  // ボードを再構築
  useEffect(() => {
    if (projectMembers.length > 0) {
      setBoard(buildBoardFromTasks(tasks, projectMembers, taskAssignments));
    }
  }, [tasks, projectMembers, taskAssignments]);

  // プロジェクトメンバーの取得
  useEffect(() => {
    if (!projectId) return;

    const fetchMembers = async () => {
      try {
        const members = await getProjectMembersByProjectId(projectId);
        setProjectMembers(members);
      } catch (error) {
        console.error("Failed to fetch project members:", error);
      }
    };

    fetchMembers();
  }, [projectId]);

  // タスク割り当て情報の取得
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    const fetchAssignments = async () => {
      try {
        const assignmentsMap: Record<string, TaskAssignmentType[]> = {};

        await Promise.all(
          tasks.map(async (task) => {
            if (!task.task_id) return;
            try {
              const response = await axios.get<TaskAssignmentType[]>(
                `${API_URL}/task_assignment/task/${task.task_id}`,
              );
              assignmentsMap[task.task_id] = response.data || [];
            } catch {
              // 割り当てがない場合は空配列
              assignmentsMap[task.task_id] = [];
            }
          }),
        );

        setTaskAssignments(assignmentsMap);
      } catch (error) {
        console.error("Failed to fetch task assignments:", error);
      }
    };

    fetchAssignments();
  }, [tasks]);


  // NOTE: 旧一括生成トリガーは廃止。インタラクティブハンズオンは各タスクページで個別に生成される
  // useEffect(() => {
  //   if (!projectId || triggeredHandsOnProjects.has(projectId)) {
  //     return;
  //   }
  //   const checkAndStartHandsOnGeneration = async () => { ... };
  //   checkAndStartHandsOnGeneration();
  // }, [projectId]);

  // タスクIDからタスクを検索する関数
  const findTaskById = useCallback((taskId: string): TaskWithAssignments | null => {
    for (const columnKey of Object.keys(board)) {
      const task = board[columnKey].find(t => t.task_id === taskId);
      if (task) {
        return task;
      }
    }
    return null;
  }, [board]);

  // タスクIDからカラムIDを検索する関数
  const findColumnByTaskId = useCallback((taskId: string): string | null => {
    for (const columnKey of Object.keys(board)) {
      const task = board[columnKey].find(t => t.task_id === taskId);
      if (task) {
        return columnKey;
      }
    }
    return null;
  }, [board]);

  // dnd-kit: ドラッグ開始ハンドラー
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = findTaskById(taskId);
    const columnId = findColumnByTaskId(taskId);
    setActiveTask(task);
    setActiveTaskColumnId(columnId);
  }, [findTaskById, findColumnByTaskId]);

  // IDがカラムID（メンバーID or UNASSIGNED_KEY）かどうかを判定
  const isColumnId = useCallback((id: string): boolean => {
    // UNASSIGNED_KEYの場合はカラムID
    if (id === UNASSIGNED_KEY) return true;
    // boardのキーに存在すればカラムID
    return Object.keys(board).includes(id);
  }, [board]);

  // dnd-kit: ドラッグ終了ハンドラー
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveTaskColumnId(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // over.idがカラムIDか、タスクIDかを判定
    // タスクIDの場合は、そのタスクが属するカラムを探す
    let targetMemberId: string;
    if (isColumnId(overId)) {
      targetMemberId = overId;
    } else {
      // over.idがタスクIDの場合、そのタスクが属するカラムを取得
      const targetColumn = findColumnByTaskId(overId);
      if (!targetColumn) return;
      targetMemberId = targetColumn;
    }

    // 同じカラム内のドロップは無視
    const sourceColumnId = findColumnByTaskId(taskId);
    if (!sourceColumnId || sourceColumnId === targetMemberId) {
      return;
    }

    // ボードのスナップショットを保存
    const snapshot: BoardState = {};
    Object.keys(board).forEach((key) => {
      snapshot[key] = [...board[key]];
    });

    const { board: nextBoard, moved } = moveTaskToMember(
      board,
      taskId,
      targetMemberId,
    );
    if (!moved) {
      return;
    }

    // UIを即座に更新
    setBoard(nextBoard);
    setIsUpdating(true);

    try {
      // 既存の割り当てを削除
      const currentAssignments = taskAssignments[taskId] || [];
      await Promise.all(
        currentAssignments.map((assignment) =>
          deleteTaskAssignment(assignment.task_assignment_id!, taskId),
        ),
      );

      // 新しい割り当てを追加（未割り当て以外）
      if (targetMemberId !== UNASSIGNED_KEY) {
        const assignment: TaskAssignmentType = {
          task_id: taskId,
          project_member_id: targetMemberId,
        };
        await postTaskAssignment(assignment);

        // 割り当て情報を更新
        const response = await axios.get<TaskAssignmentType[]>(
          `${API_URL}/task_assignment/task/${taskId}`,
        );
        setTaskAssignments((prev) => ({
          ...prev,
          [taskId]: response.data || [],
        }));
      } else {
        // 未割り当ての場合は空配列に設定
        setTaskAssignments((prev) => ({
          ...prev,
          [taskId]: [],
        }));
      }
    } catch (error) {
      console.error("Failed to update task assignment:", error);
      setBoard(snapshot);
      alert("タスクの割り当て変更に失敗しました");
    } finally {
      setIsUpdating(false);
    }
  }, [board, taskAssignments, findColumnByTaskId, isColumnId]);

  const handleTaskSelect = useCallback(
    (taskId?: string) => {
      if (!taskId || !userName || !projectId) {
        return;
      }
      // ドラッグ中はクリックを無視
      if (activeTask) {
        return;
      }
      router.push(`/${userName}/${projectId}/${taskId}`);
    },
    [router, userName, projectId, activeTask],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gradient-to-br dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900">
        <p className="text-sm text-gray-600 dark:text-cyan-200">
          読み込み中...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gradient-to-br dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900">
        <p className="text-sm text-red-600 dark:text-rose-300">
          タスクの取得に失敗しました
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* グローバルヘッダー */}
      <CyberHeader />

      {/* メインコンテンツ */}
      <div className="min-h-screen bg-gray-100 dark:bg-gradient-to-br dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900">
        <div className="container mx-auto px-6 pt-28 pb-12">
          {/* カンバンボード固有のナビゲーション */}
          <KanbanNavigation
            projectId={projectId}
            userName={userName}
            isUpdating={isUpdating}
            onChangeRequest={() => setIsChangeRequestOpen(true)}
          />

          {/* カンバンボード - dnd-kit でラップ */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 pb-4 overflow-x-auto items-start">
              {/* 未割り当てカラム（カテゴリ別表示） */}
              <UnassignedColumn
                key={UNASSIGNED_KEY}
                tasks={board[UNASSIGNED_KEY] || []}
                styles={columnStyles[UNASSIGNED_KEY] || getUnassignedColumnStyle()}
                onSelect={handleTaskSelect}
              />

              {/* メンバーごとのカラム */}
              {projectMembers
                .filter((member) => member.project_member_id)
                .map((member, index) => {
                  const memberId = member.project_member_id!;
                  return (
                    <MemberColumn
                      key={memberId}
                      memberId={memberId}
                      memberName={member.member_name}
                      tasks={board[memberId] || []}
                      styles={columnStyles[memberId] || getColumnColor(index)}
                      onSelect={handleTaskSelect}
                    />
                  );
                })}
            </div>

            {/* ドラッグ中のオーバーレイ */}
            <DragOverlay dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            }}>
              {activeTask && activeTaskColumnId && (
                <TaskCardOverlay
                  task={activeTask}
                  styles={columnStyles[activeTaskColumnId] || getUnassignedColumnStyle()}
                  showStatus={true}
                />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* AI Chat Widget */}
      {projectId && (
        <AgentChatWidget projectId={projectId} pageContext="kanban" />
      )}

      {/* Change Request Chat Widget */}
      {projectId && (
        <ChangeRequestChatWidget
          projectId={projectId}
          isOpen={isChangeRequestOpen}
          onClose={() => setIsChangeRequestOpen(false)}
          onApproved={() => {
            // タスクを再取得してカンバンを更新
            mutateTasks();
          }}
        />
      )}
    </div>
  );
}
