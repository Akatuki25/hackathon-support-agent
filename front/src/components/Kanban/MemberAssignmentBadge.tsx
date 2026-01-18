import { useState } from 'react';
import { ProjectMemberType, TaskAssignmentType } from '@/types/modelTypes';
import { MemberAvatar } from './MemberAvatar';
import { MemberDropdown } from './MemberDropdown';
import { UserPlus } from 'lucide-react';

type MemberAssignmentBadgeProps = {
  assignments: TaskAssignmentType[];
  projectMembers: ProjectMemberType[];
  onAssign: (memberId: string) => Promise<void>;
  onRemove: (assignmentId: string) => Promise<void>;
};

/**
 * メンバー割り当てバッジコンポーネント
 * - 割り当て済みメンバーのアバターを表示（最大3名）
 * - 4名以上の場合は「+N」を表示
 * - 「追加」ボタンクリックでドロップダウン表示
 */
export function MemberAssignmentBadge({
  assignments,
  projectMembers,
  onAssign,
  onRemove,
}: MemberAssignmentBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  // アバター表示用のメンバー情報を取得
  const assignedMembers = assignments
    .map((assignment) =>
      projectMembers.find((m) => m.project_member_id === assignment.project_member_id)
    )
    .filter((m): m is ProjectMemberType => m !== undefined);

  // 最大3名まで表示、それ以降は「+N」
  const displayedMembers = assignedMembers.slice(0, 3);
  const remainingCount = Math.max(0, assignedMembers.length - 3);

  return (
    <div className="relative">
      {/* アバターとボタンの表示 */}
      <div
        className="flex items-center gap-1"
        onClick={(e) => {
          e.stopPropagation(); // タスクカードのクリックイベントを防ぐ
          setIsOpen(!isOpen);
        }}
      >
        {/* 割り当て済みメンバーのアバター */}
        <div className="flex items-center -space-x-2">
          {displayedMembers.map((member, index) => (
            <div
              key={member.project_member_id}
              className="relative"
              style={{ zIndex: displayedMembers.length - index }}
            >
              <MemberAvatar member={member} size="sm" />
            </div>
          ))}
        </div>

        {/* 残りの人数表示 */}
        {remainingCount > 0 && (
          <span
            className="
              px-1.5 py-0.5 text-xs font-semibold rounded-full border
              bg-purple-100 dark:bg-cyan-900/30
              border-purple-300 dark:border-cyan-500/40
              text-purple-700 dark:text-cyan-200
            "
          >
            +{remainingCount}
          </span>
        )}

        {/* 追加ボタン */}
        <button
          className="
            flex items-center gap-1 px-2 py-1 text-xs font-medium
            rounded border transition-all
            bg-purple-50 dark:bg-cyan-500/10
            border-purple-200 dark:border-cyan-500/30
            text-purple-600 dark:text-cyan-300
            hover:bg-purple-100 dark:hover:bg-cyan-500/20
          "
          title="メンバーを追加"
        >
          <UserPlus size={12} />
          {assignedMembers.length === 0 && <span>追加</span>}
        </button>
      </div>

      {/* ドロップダウン */}
      {isOpen && (
        <MemberDropdown
          projectMembers={projectMembers}
          currentAssignments={assignments}
          onAssign={onAssign}
          onRemove={onRemove}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
