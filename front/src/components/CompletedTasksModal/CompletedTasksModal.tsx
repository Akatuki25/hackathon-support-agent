"use client";

import React from "react";
import { X, CheckCircle2, Calendar, Clock, Star, Zap, Filter } from "lucide-react";
import { Task } from "@/libs/service/enhancedTasksService";

interface CompletedTasksModalProps {
  tasks: Task[];
  onClose: () => void;
  onTaskClick: (task: Task) => void;
}

export default function CompletedTasksModal({
  tasks,
  onClose,
  onTaskClick,
}: CompletedTasksModalProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "text-red-400 bg-red-600/20";
      case "HIGH": return "text-orange-400 bg-orange-600/20";
      case "MEDIUM": return "text-yellow-400 bg-yellow-600/20";
      case "LOW": return "text-green-400 bg-green-600/20";
      default: return "text-slate-400 bg-slate-600/20";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900/95 border border-cyan-500/30 rounded-xl max-w-4xl w-full max-h-[80vh] mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cyan-500/20">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
            <h2 className="text-xl font-semibold text-white">
              完了済みタスク ({tasks.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 text-lg">まだ完了したタスクはありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div
                  key={task.task_id}
                  onClick={() => onTaskClick(task)}
                  className="group backdrop-blur-lg bg-slate-800/60 border border-green-500/20 rounded-lg p-4 hover:border-green-400/40 hover:bg-slate-800/80 transition-all duration-300 cursor-pointer"
                >
                  {/* Task Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                        <h3 className="text-white font-medium group-hover:text-green-300 transition-colors">
                          {task.title}
                        </h3>
                      </div>

                      {task.description && (
                        <p className="text-slate-400 text-sm line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {task.mvp_critical && (
                        <Star className="h-4 w-4 text-yellow-400" />
                      )}
                      {task.critical_path && (
                        <Zap className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                  </div>

                  {/* Task Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    {/* Category & Priority */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400">カテゴリ</span>
                        <span className="px-2 py-1 bg-cyan-600/20 text-cyan-400 text-xs rounded">
                          {task.category || "General"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400">優先度</span>
                        <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>

                    {/* Progress & Hours */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400">進捗</span>
                        <span className="text-xs text-green-400">
                          {task.progress_percentage}%
                        </span>
                      </div>
                      {task.estimated_hours && (
                        <div className="flex items-center space-x-2">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span className="text-xs text-slate-400">
                            {task.estimated_hours}時間
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="space-y-2">
                      {task.actual_start_date && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-400">開始</span>
                          <span className="text-xs text-blue-400">
                            {formatDate(task.actual_start_date)}
                          </span>
                        </div>
                      )}
                      {task.actual_end_date && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-400">完了</span>
                          <span className="text-xs text-green-400">
                            {formatDate(task.actual_end_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Moscow Priority & Complexity */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {task.moscow_priority && (
                        <span className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded">
                          {task.moscow_priority}
                        </span>
                      )}

                      {task.complexity_level && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-slate-400">複雑度</span>
                          <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div
                                key={i}
                                className={`h-2 w-1 rounded ${
                                  i <= task.complexity_level! ? "bg-cyan-400" : "bg-slate-600"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {task.topological_order !== undefined && (
                      <span className="text-xs text-slate-500">
                        順序 #{task.topological_order}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-cyan-500/20">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">
              {tasks.length > 0 && (
                <>
                  総実行時間: {tasks.reduce((total, task) => total + (task.estimated_hours || 0), 0)}時間
                  {tasks.filter(t => t.mvp_critical).length > 0 && (
                    <>
                      {" "}• MVP重要タスク: {tasks.filter(t => t.mvp_critical).length}件
                    </>
                  )}
                </>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}