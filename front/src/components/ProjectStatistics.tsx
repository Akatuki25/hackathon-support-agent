"use client";

import React from "react";
import { ProjectType } from "@/types/modelTypes";
import { TrendingUp, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface ProjectStatisticsProps {
  projects: ProjectType[];
  darkMode: boolean;
}

export const ProjectStatistics: React.FC<ProjectStatisticsProps> = ({
  projects,
  darkMode,
}) => {
  // ステータス判定関数
  const getProjectStatus = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return "未設定";
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return "準備中";
    if (now > end) return "完了";
    return "進行中";
  };

  // 統計計算
  const totalProjects = projects.length;
  const inProgressCount = projects.filter((p) => {
    const status = getProjectStatus(p.start_date, p.end_date);
    return status === "進行中";
  }).length;

  const completedCount = projects.filter((p) => {
    const status = getProjectStatus(p.start_date, p.end_date);
    return status === "完了";
  }).length;

  const preparingCount = projects.filter((p) => {
    const status = getProjectStatus(p.start_date, p.end_date);
    return status === "準備中";
  }).length;

  const averageProgress =
    projects.reduce((sum, p) => sum + (p.phase_progress_percentage || 0), 0) /
    (totalProjects || 1);

  const stats = [
    {
      label: "進行中",
      value: inProgressCount,
      icon: TrendingUp,
      color: darkMode ? "text-green-400" : "text-green-600",
      bgColor: darkMode ? "bg-green-500/10" : "bg-green-50",
      borderColor: darkMode ? "border-green-500/50" : "border-green-500/30",
    },
    {
      label: "完了",
      value: completedCount,
      icon: CheckCircle,
      color: darkMode ? "text-blue-400" : "text-blue-600",
      bgColor: darkMode ? "bg-blue-500/10" : "bg-blue-50",
      borderColor: darkMode ? "border-blue-500/50" : "border-blue-500/30",
    },
    {
      label: "準備中",
      value: preparingCount,
      icon: Clock,
      color: darkMode ? "text-yellow-400" : "text-yellow-600",
      bgColor: darkMode ? "bg-yellow-500/10" : "bg-yellow-50",
      borderColor: darkMode ? "border-yellow-500/50" : "border-yellow-500/30",
    },
    {
      label: "平均進捗",
      value: `${Math.round(averageProgress)}%`,
      icon: AlertCircle,
      color: darkMode ? "text-purple-400" : "text-purple-600",
      bgColor: darkMode ? "bg-purple-500/10" : "bg-purple-50",
      borderColor: darkMode ? "border-purple-500/50" : "border-purple-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg backdrop-blur-xl border ${stat.bgColor} ${stat.borderColor} transition-all hover:scale-105 shadow-lg`}
        >
          <div className="flex items-center justify-between mb-2">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <span
              className={`text-2xl font-bold font-mono ${stat.color}`}
            >
              {stat.value}
            </span>
          </div>
          <p
            className={`text-sm font-mono ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
};
