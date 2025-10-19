"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Clock, Lightbulb, Trash2, PlayCircle } from "lucide-react";
import { ProjectType } from "@/types/modelTypes";
import { getPagePathForPhase, getPhaseLabel } from "@/libs/service/phaseService";

interface ProjectCardProps {
  project: ProjectType;
  index: number;
  darkMode: boolean;
  onDelete: (e: React.MouseEvent, projectId: string, projectTitle: string) => void;
  userName?: string;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  index,
  darkMode,
  onDelete,
  userName,
}) => {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    if (!dateString) return "未設定";
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const calculateRemainingDays = (endDate: string) => {
    if (!endDate) return 0;
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getProjectStatus = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return "未設定";
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return "準備中";
    if (now > end) return "完了";
    return "進行中";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "進行中":
        return darkMode
          ? "text-green-400 border-green-400/50"
          : "text-green-600 border-green-500/50";
      case "完了":
        return darkMode
          ? "text-blue-400 border-blue-400/50"
          : "text-blue-600 border-blue-500/50";
      case "準備中":
        return darkMode
          ? "text-yellow-400 border-yellow-400/50"
          : "text-yellow-600 border-yellow-500/50";
      default:
        return darkMode
          ? "text-gray-400 border-gray-400/50"
          : "text-gray-600 border-gray-500/50";
    }
  };

  const status = getProjectStatus(project.start_date, project.end_date);
  const statusColor = getStatusColor(status);

  // フェーズリカバリー用のパスを取得
  const handleResumeProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.current_phase && project.current_phase !== "initial") {
      const phasePath = getPagePathForPhase(
        project.current_phase,
        project.project_id || "",
        userName
      );
      router.push(phasePath);
    } else {
      // 初期状態またはフェーズ情報がない場合は通常の遷移
      router.push(`/projects/${project.project_id}`);
    }
  };

  return (
    <div
      className={`relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden ${
        status === "完了"
          ? darkMode
            ? "bg-gray-800/20 border-gray-600/20 opacity-60 shadow-lg shadow-gray-500/10"
            : "bg-white/40 border-gray-300/20 opacity-60"
          : status === "進行中"
          ? darkMode
            ? "bg-blue-900/30 border-blue-500/40 hover:border-blue-400/60 shadow-lg shadow-blue-500/30"
            : "bg-blue-100/60 border-blue-400/40 hover:border-blue-500/60"
          : darkMode
          ? "bg-gray-800/30 border-cyan-500/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
          : "bg-white/60 border-purple-300/30 hover:border-purple-400/50"
      } shadow-lg hover:shadow-2xl`}
    >
      {/* サイバースキャンライン */}
      <div
        className={`absolute top-0 left-0 right-0 h-px ${
          darkMode
            ? "bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
            : "bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
        } translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000`}
      ></div>

      {/* プロジェクト番号 & ステータス */}
      <div className="absolute top-4 right-4 flex items-center space-x-2">
        <div
          className={`px-2 py-1 rounded text-xs font-mono font-bold border backdrop-blur-md ${statusColor}`}
        >
          {status}
        </div>
        <div
          className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-mono font-bold backdrop-blur-md ${
            darkMode
              ? "border-cyan-500/50 text-cyan-400 bg-gray-800/50"
              : "border-purple-500/50 text-purple-600 bg-white/50"
          }`}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>

      {/* サイバーコーナー */}
      <div
        className={`absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 ${
          darkMode ? "border-cyan-400/50" : "border-purple-400/50"
        } opacity-0 group-hover:opacity-100 transition-opacity`}
      ></div>
      <div
        className={`absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 ${
          darkMode ? "border-pink-400/50" : "border-blue-400/50"
        } opacity-0 group-hover:opacity-100 transition-opacity`}
      ></div>

      {/* コンテンツ */}
      <div className="relative">
        {/* タイトル */}
        <h2
          className={`text-xl font-bold mb-4 font-mono tracking-wider line-clamp-2 pr-20 ${
            darkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {project.title || "UNTITLED_PROJECT"}
        </h2>

        {/* アイデア */}
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <Lightbulb
              className={`w-4 h-4 mr-2 ${
                darkMode ? "text-cyan-400" : "text-purple-600"
              }`}
            />
            <span
              className={`text-xs font-mono font-bold ${
                darkMode ? "text-cyan-400" : "text-purple-600"
              }`}
            >
              PROJECT_CONCEPT
            </span>
          </div>
          <p
            className={`text-sm leading-relaxed line-clamp-3 ${
              darkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {project.idea || "アイデアが設定されていません"}
          </p>
        </div>

        {/* フェーズ進行状況（新規） */}
        {project.current_phase && (
          <div
            className={`mb-4 p-3 rounded border backdrop-blur-md ${
              darkMode
                ? "bg-gray-800/40 border-gray-600/50"
                : "bg-gray-50/50 border-gray-300/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-mono ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                現在のフェーズ
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  darkMode ? "text-cyan-400" : "text-purple-600"
                }`}
              >
                {getPhaseLabel(project.current_phase)}
              </span>
            </div>
            {/* プログレスバー */}
            <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  darkMode ? "bg-cyan-400" : "bg-purple-600"
                }`}
                style={{
                  width: `${project.phase_progress_percentage || 0}%`,
                }}
              ></div>
            </div>
          </div>
        )}

        {/* プロジェクト情報グリッド */}
        <div className="grid grid-cols-2 gap-4">
          {/* 残り日数 */}
          <div
            className={`p-3 rounded border backdrop-blur-md ${
              darkMode
                ? "bg-gray-800/40 border-gray-600/50"
                : "bg-gray-50/50 border-gray-300/50"
            }`}
          >
            <div className="flex items-center mb-1">
              <Clock
                className={`w-3 h-3 mr-1 ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              />
              <span
                className={`text-xs font-mono ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {status === "完了"
                  ? "終了"
                  : status === "進行中"
                  ? "残り日数"
                  : "開始まで"}
              </span>
            </div>
            <span
              className={`text-sm font-mono font-bold ${
                status === "完了"
                  ? darkMode
                    ? "text-gray-500"
                    : "text-gray-600"
                  : status === "進行中"
                  ? darkMode
                    ? "text-blue-400"
                    : "text-blue-600"
                  : darkMode
                  ? "text-white"
                  : "text-gray-900"
              }`}
            >
              {status === "完了"
                ? "完了済み"
                : status === "進行中"
                ? `${calculateRemainingDays(project.end_date)}日`
                : `${Math.ceil(
                    (new Date(project.start_date).getTime() -
                      new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}日`}
            </span>
          </div>
        </div>

        {/* 日付 */}
        <div
          className={`mt-4 p-3 rounded border backdrop-blur-md ${
            darkMode
              ? "bg-gray-800/30 border-gray-600/30"
              : "bg-gray-50/30 border-gray-300/30"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs font-mono ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              開始日
            </span>
            <span
              className={`text-xs font-mono ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {formatDate(project.start_date)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-mono ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              終了日
            </span>
            <span
              className={`text-xs font-mono ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {formatDate(project.end_date)}
            </span>
          </div>
        </div>

        {/* アクションボタン（新規） */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* 続きから再開ボタン */}
          {project.current_phase && project.current_phase !== "task_management" && (
            <button
              onClick={handleResumeProject}
              className={`py-2 px-3 rounded border backdrop-blur-md transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 ${
                darkMode
                  ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400"
                  : "bg-purple-50 border-purple-500/50 text-purple-600 hover:bg-purple-100 hover:border-purple-600"
              }`}
              title="フェーズから再開"
            >
              <PlayCircle className="w-4 h-4" />
              <span className="text-xs font-mono">続きから</span>
            </button>
          )}

          {/* 削除ボタン */}
          <button
            onClick={(e) => onDelete(e, String(project.project_id), project.title)}
            className={`py-2 px-3 rounded border backdrop-blur-md transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 ${
              project.current_phase && project.current_phase !== "task_management"
                ? ""
                : "col-span-2"
            } ${
              darkMode
                ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-400"
                : "bg-red-50 border-red-500/50 text-red-600 hover:bg-red-100 hover:border-red-600"
            }`}
            title="プロジェクトを削除"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-mono">削除</span>
          </button>
        </div>
      </div>
    </div>
  );
};
