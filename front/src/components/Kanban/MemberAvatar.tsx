import { ProjectMemberType } from "@/types/modelTypes";

type MemberAvatarProps = {
  member: ProjectMemberType;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
};

/**
 * メンバーアバター表示コンポーネント
 * - イニシャルを表示
 * - ホバーで名前をツールチップ表示
 * - サイズとダークモードに対応
 */
export function MemberAvatar({
  member,
  size = "sm",
  showName = false,
}: MemberAvatarProps) {
  // イニシャルを生成（最大2文字）
  const initials = member.member_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // サイズに応じたクラス
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

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
        className="
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
          bg-gray-800 dark:bg-slate-800
          text-white dark:text-cyan-200
          dark:border dark:border-cyan-500/30
          rounded
          whitespace-nowrap
          z-50
          shadow-lg
        "
      >
        {member.member_name}
        {/* Light mode arrow */}
        <div
          className="
            absolute
            top-full
            left-1/2
            -translate-x-1/2
            border-4
            border-transparent
            border-t-gray-800
            dark:hidden
          "
        />
        {/* Dark mode arrow */}
        <div
          className="
            absolute
            top-full
            left-1/2
            -translate-x-1/2
            border-4
            border-transparent
            border-t-slate-800
            hidden dark:block
          "
        />
      </div>

      {/* 名前を横に表示（オプション） */}
      {showName && (
        <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">
          {member.member_name}
        </span>
      )}
    </div>
  );
}
