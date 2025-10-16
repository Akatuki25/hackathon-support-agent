import { useTasksByProjectId } from '@/libs/modelAPI/task';
import { useProjectMembers } from '@/libs/modelAPI/project_member';
import type { TaskType, ProjectMemberType } from '@/types/modelTypes';

/**
 * カンバンボードに必要なデータを統合して取得するカスタムフック
 * タスクとプロジェクトメンバーの情報を並行して取得
 *
 * @param projectId - プロジェクトID
 * @returns タスク、メンバー、ローディング状態、エラー状態
 */
export const useKanbanData = (projectId?: string) => {
  const { tasks, isLoading: tasksLoading, isError: tasksError } = useTasksByProjectId(projectId);
  const { members, isLoading: membersLoading, isError: membersError } = useProjectMembers(projectId);

  return {
    tasks: tasks || [],
    members: members || [],
    isLoading: tasksLoading || membersLoading,
    isError: tasksError || membersError,
    error: tasksError || membersError,
  };
};

/**
 * メンバーベースのボード状態の型定義
 */
export type MemberBoardState = Record<string, TaskType[]>;

/**
 * カラム定義の型
 */
export type ColumnDefinition = {
  key: string;              // member_id or "unassigned"
  label: string;            // member_name or "未割り当て"
  memberInfo?: ProjectMemberType;
};

/**
 * タスクをメンバーごとに振り分けてボード状態を構築
 *
 * @param tasks - タスクリスト
 * @param members - メンバーリスト
 * @returns メンバーベースのボード状態
 */
export const buildMemberBoard = (
  tasks: TaskType[],
  members: ProjectMemberType[]
): MemberBoardState => {
  const board: MemberBoardState = {
    unassigned: [],
  };

  // メンバーごとの空配列を初期化
  members.forEach(member => {
    board[member.member_id] = [];
  });

  // タスクを振り分け
  tasks.forEach(task => {
    const assigneeId = task.assignee || 'unassigned';
    if (board[assigneeId]) {
      board[assigneeId].push(task);
    } else {
      // assigneeがメンバーリストにない場合は未割り当てに
      board['unassigned'].push(task);
    }
  });

  return board;
};

/**
 * メンバー情報からカラム定義を生成
 *
 * @param members - メンバーリスト
 * @returns カラム定義リスト
 */
export const buildColumnDefinitions = (
  members: ProjectMemberType[]
): ColumnDefinition[] => {
  const columns: ColumnDefinition[] = [
    {
      key: 'unassigned',
      label: '未割り当て',
    }
  ];

  members.forEach(member => {
    columns.push({
      key: member.member_id,
      label: member.member_name,
      memberInfo: member,
    });
  });

  return columns;
};

/**
 * タスクを別のメンバーに移動
 *
 * @param state - 現在のボード状態
 * @param taskId - 移動するタスクID
 * @param newMemberId - 移動先のメンバーID
 * @returns 新しいボード状態と移動成功フラグ、移動したタスク
 */
export const moveTaskToMember = (
  state: MemberBoardState,
  taskId: string,
  newMemberId: string
): { board: MemberBoardState; moved: boolean; task?: TaskType } => {
  // 状態をディープコピー
  const next: MemberBoardState = {};
  for (const key in state) {
    next[key] = [...state[key]];
  }

  let sourceMemberId: string | null = null;
  let task: TaskType | undefined;

  // タスクを現在の位置から見つけて削除
  for (const memberId in next) {
    const index = next[memberId].findIndex((t) => t.task_id === taskId);
    if (index !== -1) {
      sourceMemberId = memberId;
      task = next[memberId][index];
      next[memberId].splice(index, 1);
      break;
    }
  }

  // タスクが見つからない、または移動先が同じ場合
  if (!task || sourceMemberId === newMemberId) {
    return { board: state, moved: false };
  }

  // assigneeフィールドを更新
  const updatedTask: TaskType = {
    ...task,
    assignee: newMemberId === 'unassigned' ? undefined : newMemberId,
  };

  // 移動先のカラムが存在しない場合は作成
  if (!next[newMemberId]) {
    next[newMemberId] = [];
  }

  // 移動先のカラムの先頭に追加
  next[newMemberId] = [updatedTask, ...next[newMemberId]];

  return { board: next, moved: true, task: updatedTask };
};
