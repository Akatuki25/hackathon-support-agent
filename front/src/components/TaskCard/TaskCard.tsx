"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  Flag,
  User,
  Zap,
  GitBranch,
  BookOpen,
  Star,
  Calendar,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Task } from "@/libs/service/enhancedTasksService";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
}

export default function TaskCard({ task, onClick, isDragging = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({
    id: task.task_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "text-red-400 bg-red-600/20 border-red-500/30";
      case "HIGH": return "text-orange-400 bg-orange-600/20 border-orange-500/30";
      case "MEDIUM": return "text-yellow-400 bg-yellow-600/20 border-yellow-500/30";
      case "LOW": return "text-green-400 bg-green-600/20 border-green-500/30";
      default: return "text-slate-400 bg-slate-600/20 border-slate-500/30";
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case "frontend": return <User className="h-4 w-4" />;
      case "backend": return <GitBranch className="h-4 w-4" />;
      case "database": return <Activity className="h-4 w-4" />;
      case "testing": return <CheckCircle2 className="h-4 w-4" />;
      case "documentation": return <BookOpen className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getComplexityBars = (level?: number) => {
    if (!level) return null;
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-2 w-1 rounded ${
              i <= level ? "bg-cyan-400" : "bg-slate-600"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group cursor-pointer transition-all duration-300 ${
        sortableIsDragging || isDragging
          ? "opacity-50 transform rotate-2 scale-105"
          : "hover:scale-[1.02]"
      }`}
    >
      <div className="backdrop-blur-lg bg-slate-800/60 border border-cyan-500/20 rounded-lg p-4 hover:border-cyan-400/40 hover:bg-slate-800/80 transition-all duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {getCategoryIcon(task.category)}
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              {task.category || "General"}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {task.mvp_critical && (
              <Star className="h-4 w-4 text-yellow-400" />
            )}
            {task.critical_path && (
              <Zap className="h-4 w-4 text-red-400" />
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-white font-medium mb-2 line-clamp-2 group-hover:text-cyan-300 transition-colors">
          {task.title}
        </h4>

        {/* Description */}
        {task.description && (
          <p className="text-slate-400 text-sm mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Metadata Row */}
        <div className="flex items-center justify-between mb-3">
          {/* Priority */}
          <div className={`px-2 py-1 rounded text-xs border ${getPriorityColor(task.priority)}`}>
            <Flag className="h-3 w-3 inline mr-1" />
            {task.priority}
          </div>

          {/* Moscow Priority */}
          {task.moscow_priority && (
            <div className="px-2 py-1 bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded text-xs">
              {task.moscow_priority}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">進捗</span>
            <span className="text-xs text-cyan-400">{task.progress_percentage}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${task.progress_percentage}%` }}
            />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          {/* Complexity */}
          <div className="flex items-center space-x-2">
            <span>複雑度</span>
            {getComplexityBars(task.complexity_level)}
          </div>

          {/* Estimated Hours */}
          {task.estimated_hours && (
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{task.estimated_hours}h</span>
            </div>
          )}
        </div>

        {/* Due Date */}
        {task.due_at && (
          <div className="mt-2 flex items-center space-x-1 text-xs text-orange-400">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(task.due_at).toLocaleDateString("ja-JP", {
                month: "short",
                day: "numeric"
              })}
            </span>
          </div>
        )}

        {/* Topological Order Indicator */}
        {task.topological_order !== undefined && (
          <div className="absolute top-2 right-2 bg-slate-900/80 text-cyan-400 text-xs px-2 py-1 rounded">
            #{task.topological_order}
          </div>
        )}
      </div>
    </div>
  );
}