"use client";

import React from "react";
import { Check, Star, Clock, BarChart } from "lucide-react";

interface Task {
  task_name: string;
  priority: "Must" | "Should" | "Could";
  content: string;
}

interface TaskCardProps {
  task: Task;
  isDarkMode?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, isDarkMode = true }) => {
  // 優先度に基づいて色を設定
  const getPriorityStyles = () => {
    if (isDarkMode) {
      switch (task.priority) {
        case "Must":
          return "border-red-500 text-red-300 bg-red-900/20";
        case "Should":
          return "border-yellow-500 text-yellow-300 bg-yellow-900/20";
        case "Could":
          return "border-blue-500 text-blue-300 bg-blue-900/20";
        default:
          return "border-gray-500 text-gray-300 bg-gray-900/20";
      }
    } else {
      switch (task.priority) {
        case "Must":
          return "border-red-500 text-red-700 bg-red-50";
        case "Should":
          return "border-yellow-600 text-yellow-700 bg-yellow-50";
        case "Could":
          return "border-blue-500 text-blue-700 bg-blue-50";
        default:
          return "border-gray-400 text-gray-700 bg-gray-50";
      }
    }
  };

  // 優先度に応じたアイコンを取得
  const getPriorityIcon = () => {
    switch (task.priority) {
      case "Must":
        return <Star size={16} className="mr-1" />;
      case "Should":
        return <Clock size={16} className="mr-1" />;
      case "Could":
        return <BarChart size={16} className="mr-1" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`rounded-lg transition-all border-l-4 shadow-lg ${getPriorityStyles()} ${
        isDarkMode
          ? "bg-gray-800/80 hover:bg-gray-700/80"
          : "bg-white hover:bg-gray-50"
      }`}
    >
      <div className="p-5 relative overflow-hidden">
        {/* 背景装飾 */}
        <div className="absolute top-0 right-0 w-16 h-16 opacity-5">
          <svg viewBox="0 0 100 100" fill={isDarkMode ? "#ffffff" : "#000000"}>
            <path d="M0,50 L50,0 L100,50 L50,100 Z" />
          </svg>
        </div>

        {/* タイトルと優先度 */}
        <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
          <h2
            className={`text-xl font-bold ${
              isDarkMode ? "text-cyan-300" : "text-blue-700"
            }`}
          >
            {task.task_name}
          </h2>

          <div
            className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
              isDarkMode ? "bg-gray-700" : "bg-gray-100"
            }`}
          >
            {getPriorityIcon()}
            <span>優先度: {task.priority}</span>
          </div>
        </div>

        {/* タスク内容 */}
        <div
          className={`mt-3 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
        >
          <div className="flex items-start">
            <Check
              size={18}
              className={`mt-1 mr-2 flex-shrink-0 ${
                isDarkMode ? "text-pink-500" : "text-purple-600"
              }`}
            />
            <p>{task.content}</p>
          </div>
        </div>

        {/* 下部デコレーション */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-px opacity-20 ${
            isDarkMode
              ? "bg-gradient-to-r from-cyan-500 via-transparent to-pink-500"
              : "bg-gradient-to-r from-blue-500 via-transparent to-purple-500"
          }`}
        ></div>
      </div>
    </div>
  );
};

export default TaskCard;
