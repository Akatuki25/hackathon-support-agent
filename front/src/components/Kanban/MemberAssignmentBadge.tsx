import { useState } from 'react';
import { ProjectMemberType, TaskAssignmentType } from '@/types/modelTypes';
import { MemberAvatar } from './MemberAvatar';
import { MemberDropdown } from './MemberDropdown';
import { UserPlus } from 'lucide-react';

type MemberAssignmentBadgeProps = {
  taskId: string;
  assignments: TaskAssignmentType[];
  projectMembers: ProjectMemberType[];
  onAssign: (memberId: string) => Promise<void>;
  onRemove: (assignmentId: string) => Promise<void>;
  darkMode?: boolean;
};

/**
 * メンバー割り当てバッジコンポーネント
 * - 割り当て済みメンバーのアバターを表示（最大3名）
 * - 4名以上の場合は「+N」を表示
 * - 「追加」ボタンクリックでドロップダウン表示
 */
export function MemberAssignmentBadge({
  taskId,
  assignments,
  projectMembers,
  onAssign,
  onRemove,
  darkMode = false
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

  const buttonClass = darkMode
    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
    : 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100';

  const badgeClass = darkMode
    ? 'bg-cyan-900/30 border-cyan-500/40 text-cyan-200'
    : 'bg-purple-100 border-purple-300 text-purple-700';

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
              <MemberAvatar member={member} size="sm" darkMode={darkMode} />
            </div>
          ))}
        </div>

        {/* 残りの人数表示 */}
        {remainingCount > 0 && (
          <span
            className={`
              px-1.5 py-0.5 text-xs font-semibold rounded-full border
              ${badgeClass}
            `}
          >
            +{remainingCount}
          </span>
        )}

        {/* 追加ボタン */}
        <button
          className={`
            flex items-center gap-1 px-2 py-1 text-xs font-medium
            rounded border transition-all
            ${buttonClass}
          `}
          title="メンバーを追加"
        >
          <UserPlus size={12} />
          {assignedMembers.length === 0 && <span>追加</span>}
        </button>
      </div>

      {/* ドロップダウン */}
      {isOpen && (
        <MemberDropdown
          taskId={taskId}
          projectMembers={projectMembers}
          currentAssignments={assignments}
          onAssign={onAssign}
          onRemove={onRemove}
          onClose={() => setIsOpen(false)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}
