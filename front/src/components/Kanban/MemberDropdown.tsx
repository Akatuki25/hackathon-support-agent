import { useState, useRef, useEffect } from 'react';
import { ProjectMemberType, TaskAssignmentType } from '@/types/modelTypes';
import { MemberAvatar } from './MemberAvatar';
import { X } from 'lucide-react';

type MemberDropdownProps = {
  projectMembers: ProjectMemberType[];
  currentAssignments: TaskAssignmentType[];
  onAssign: (memberId: string) => Promise<void>;
  onRemove: (assignmentId: string) => Promise<void>;
  onClose: () => void;
};

/**
 * メンバー選択ドロップダウンコンポーネント
 * - プロジェクトメンバーのリスト表示
 * - チェックボックスで選択/解除
 * - 割り当て済みメンバーはチェック済み状態
 */
export function MemberDropdown({
  projectMembers,
  currentAssignments,
  onAssign,
  onRemove,
  onClose,
}: MemberDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

  // クリック外部でドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // メンバーが割り当て済みかチェック
  const isAssigned = (memberId: string) => {
    return currentAssignments.some((a) => a.project_member_id === memberId);
  };

  // 割り当てIDを取得
  const getAssignmentId = (memberId: string) => {
    const assignment = currentAssignments.find((a) => a.project_member_id === memberId);
    return assignment?.task_assignment_id;
  };

  // メンバー選択/解除のトグル
  const handleToggleMember = async (member: ProjectMemberType) => {
    if (!member.project_member_id) return;

    setProcessingMemberId(member.project_member_id);

    try {
      if (isAssigned(member.project_member_id)) {
        // 削除
        const assignmentId = getAssignmentId(member.project_member_id);
        if (assignmentId) {
          await onRemove(assignmentId);
        }
      } else {
        // 追加
        await onAssign(member.project_member_id);
      }
    } catch (error) {
      console.error('Failed to toggle member assignment:', error);
    } finally {
      setProcessingMemberId(null);
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="
        absolute
        z-50
        mt-2
        w-72
        rounded-lg
        border
        border-gray-200 dark:border-cyan-500/30
        bg-white dark:bg-slate-900/95
        shadow-xl dark:shadow-[0_0_24px_rgba(6,182,212,0.3)]
        backdrop-blur-lg
      "
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-cyan-500/20 hover:bg-gray-100 dark:hover:bg-cyan-500/10">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
          メンバーを割り当て
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:scale-110 transition-transform text-gray-500 dark:text-slate-400"
        >
          <X size={16} />
        </button>
      </div>

      {/* メンバーリスト */}
      <div className="max-h-64 overflow-y-auto p-2">
        {projectMembers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <p className="text-sm">プロジェクトメンバーがいません</p>
          </div>
        ) : (
          projectMembers
            .filter((member) => member.project_member_id)
            .map((member) => {
              const memberId = member.project_member_id!;
              const assigned = isAssigned(memberId);
              const processing = processingMemberId === memberId;

            return (
              <label
                key={memberId}
                className={`
                  flex items-center gap-3 p-2 rounded-lg cursor-pointer
                  transition-all
                  border-gray-200 dark:border-cyan-500/20
                  hover:bg-gray-100 dark:hover:bg-cyan-500/10
                  ${processing ? 'opacity-50 cursor-wait' : ''}
                `}
              >
                <input
                  type="checkbox"
                  checked={assigned}
                  onChange={() => handleToggleMember(member)}
                  disabled={processing}
                  className="w-4 h-4 rounded accent-purple-500 dark:accent-cyan-500"
                />
                <MemberAvatar member={member} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                    {member.member_name}
                  </p>
                </div>
                {processing && (
                  <div className="animate-spin">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                )}
              </label>
            );
          })
        )}
      </div>

      {/* フッター（割り当て済み数表示） */}
      {currentAssignments.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-cyan-500/20 text-gray-500 dark:text-slate-400">
          <p className="text-xs">
            {currentAssignments.length}名が割り当て済み
          </p>
        </div>
      )}
    </div>
  );
}
