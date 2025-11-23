import { ProjectMemberType } from '@/types/modelTypes';

type MemberAvatarProps = {
  member: ProjectMemberType;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  darkMode?: boolean;
};

/**
 * メンバーアバター表示コンポーネント
 * - イニシャルを表示
 * - ホバーで名前をツールチップ表示
 * - サイズとダークモードに対応
 */
export function MemberAvatar({
  member,
  size = 'sm',
  showName = false,
  darkMode = false
}: MemberAvatarProps) {
  // イニシャルを生成（最大2文字）
  const initials = member.member_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // サイズに応じたクラス
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  // ダークモードに応じたツールチップクラス
  const tooltipClass = darkMode
    ? 'bg-slate-800 text-cyan-200 border border-cyan-500/30'
    : 'bg-gray-800 text-white';

  return (
    <div className="relative group">
      {/* アバター本体 */}
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full
          bg-gradient-to-br from-purple-500 to-blue-600
          flex items-center justify-center
          text-white font-semibold
          shadow-sm
          cursor-pointer
          transition-transform
          hover:scale-110
        `}
        title={member.member_name}
      >
        {initials}
      </div>

      {/* ツールチップ */}
      <div
        className={`
          absolute
          hidden
          group-hover:block
          bottom-full
          left-1/2
          -translate-x-1/2
          mb-2
          px-2
          py-1
          text-xs
          ${tooltipClass}
          rounded
          whitespace-nowrap
          z-50
          shadow-lg
        `}
      >
        {member.member_name}
        <div
          className={`
            absolute
            top-full
            left-1/2
            -translate-x-1/2
            border-4
            border-transparent
            ${darkMode ? 'border-t-slate-800' : 'border-t-gray-800'}
          `}
        />
      </div>

      {/* 名前を横に表示（オプション） */}
      {showName && (
        <span className={`ml-2 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
          {member.member_name}
        </span>
      )}
    </div>
  );
}
