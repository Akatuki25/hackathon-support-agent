"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Clock,
  Flag,
  Zap,
  GitBranch,
  BookOpen,
  Star,
  Calendar,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Target,
  BarChart3,
  Link,
  Brain,
  Code,
  Database,
  Monitor,
  FileText,
  Settings,
  Timer,
  Edit,
  Eye,
} from "lucide-react";
import BaseEditor from "@/components/BaseEditor/BaseEditor";
import { EnhancedTasksService, Task } from "@/libs/service/enhancedTasksService";

type EditMode = "view" | "edit";

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  // State management
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>("view");
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});

  // Load task data
  const loadTask = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const taskData = await EnhancedTasksService.getTask(taskId);
      setTask(taskData);
      setEditedTask(taskData);
      setError(null);
    } catch (err) {
      console.error("Failed to load task:", err);
      setError("タスクの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  const saveTask = async () => {
    if (!task) return;

    try {
      setSaving(true);
      const updatedTask = await EnhancedTasksService.updateTask(taskId, editedTask);
      setTask(updatedTask);
      setEditMode("view");
      setError(null);
    } catch (err) {
      console.error("Failed to save task:", err);
      setError("タスクの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = <K extends keyof Task>(field: K, value: Task[K]) => {
    setEditedTask(prev => ({ ...prev, [field]: value }));
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
      case "frontend": return <Monitor className="h-5 w-5" />;
      case "backend": return <Database className="h-5 w-5" />;
      case "database": return <Database className="h-5 w-5" />;
      case "devops": return <Settings className="h-5 w-5" />;
      case "testing": return <CheckCircle2 className="h-5 w-5" />;
      case "documentation": return <FileText className="h-5 w-5" />;
      default: return <Code className="h-5 w-5" />;
    }
  };

  const resolveTechnologyLabel = (entry: string | Record<string, unknown>): string => {
    if (typeof entry === "string") {
      return entry;
    }

    const candidate = entry as { name?: unknown; label?: unknown; title?: unknown };
    if (typeof candidate.name === "string") {
      return candidate.name;
    }
    if (typeof candidate.label === "string") {
      return candidate.label;
    }
    if (typeof candidate.title === "string") {
      return candidate.title;
    }

    return "Unknown";
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "未設定";
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const ScoreBar = ({ value, max, color = "cyan" }: { value?: number; max: number; color?: string }) => {
    const percentage = value ? (value / max) * 100 : 0;
    const colorClasses = {
      cyan: "bg-cyan-500",
      red: "bg-red-500",
      orange: "bg-orange-500",
      yellow: "bg-yellow-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      blue: "bg-blue-500"
    };

    return (
      <div className="flex items-center space-x-2">
        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorClasses[color as keyof typeof colorClasses]} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-slate-400 min-w-[2rem]">
          {value || 0}/{max}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-cyan-400 text-lg">タスクを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-lg">{error || "タスクが見つかりません"}</p>
        </div>
      </div>
    );
  }

  const displayTask = editMode === "edit" ? { ...task, ...editedTask } : task;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Cyber Grid Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0"
             style={{
               backgroundImage: `
                 linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px)
               `,
               backgroundSize: '50px 50px'
             }}>
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 backdrop-blur-lg bg-slate-900/50 border-b border-cyan-500/30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/projects/${task.project_id}`)}
                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 rounded-lg transition-all"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-3">
                {getCategoryIcon(displayTask.category)}
                <h1 className="text-2xl font-bold text-white">タスク詳細</h1>
                {displayTask.topological_order && (
                  <span className="px-3 py-1 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 rounded-lg text-sm">
                    #{displayTask.topological_order}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {editMode === "edit" ? (
                <>
                  <button
                    onClick={() => {
                      setEditMode("view");
                      setEditedTask(task);
                    }}
                    className="px-4 py-2 bg-slate-600/20 border border-slate-500/30 text-slate-400 rounded-lg hover:bg-slate-600/30 transition-all"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveTask}
                    disabled={saving}
                    className="px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-all disabled:opacity-50 flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? "保存中..." : "保存"}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditMode("edit")}
                  className="px-4 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all flex items-center space-x-2"
                >
                  <Edit className="h-4 w-4" />
                  <span>編集</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-4">
          <div className="bg-red-600/20 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Main Info */}
          <div className="xl:col-span-2 space-y-6">
            {/* Task Header Card */}
            <div className="backdrop-blur-lg bg-slate-800/60 border border-cyan-500/20 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {editMode === "edit" ? (
                    <input
                      type="text"
                      value={editedTask.title || displayTask.title}
                      onChange={(e) => handleFieldChange("title", e.target.value)}
                      className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white text-xl font-bold focus:border-cyan-500/50 focus:outline-none"
                    />
                  ) : (
                    <h2 className="text-2xl font-bold text-white mb-2">{displayTask.title}</h2>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {displayTask.mvp_critical && <Star className="h-6 w-6 text-yellow-400" />}
                  {displayTask.critical_path && <Zap className="h-6 w-6 text-red-400" />}
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm text-slate-400 mb-2">概要</label>
                {editMode === "edit" ? (
                  <textarea
                    value={editedTask.description || displayTask.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    rows={3}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white focus:border-cyan-500/50 focus:outline-none resize-none"
                    placeholder="タスクの概要を入力..."
                  />
                ) : (
                  <p className="text-slate-300 leading-relaxed">
                    {displayTask.description || "概要が設定されていません"}
                  </p>
                )}
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">ステータス</label>
                  {editMode === "edit" ? (
                    <select
                      value={editedTask.status || displayTask.status}
                      onChange={(e) => handleFieldChange("status", e.target.value)}
                      className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-4 py-2 text-white focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="TODO">TODO</option>
                      <option value="DOING">進行中</option>
                      <option value="DONE">完了</option>
                    </select>
                  ) : (
                    <div className={`px-4 py-2 rounded-lg border ${
                      displayTask.status === "DONE" ? "bg-green-600/20 border-green-500/30 text-green-400" :
                      displayTask.status === "DOING" ? "bg-blue-600/20 border-blue-500/30 text-blue-400" :
                      "bg-slate-600/20 border-slate-500/30 text-slate-400"
                    }`}>
                      {displayTask.status === "TODO" ? "TODO" :
                       displayTask.status === "DOING" ? "進行中" : "完了"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">優先度</label>
                  {editMode === "edit" ? (
                    <select
                      value={editedTask.priority || displayTask.priority}
                      onChange={(e) => handleFieldChange("priority", e.target.value)}
                      className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-4 py-2 text-white focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  ) : (
                    <div className={`px-4 py-2 rounded-lg border ${getPriorityColor(displayTask.priority)}`}>
                      <Flag className="h-4 w-4 inline mr-2" />
                      {displayTask.priority}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Task Detail Editor */}
            <BaseEditor
              content={displayTask.detail || ""}
              onContentChange={(content) => handleFieldChange("detail", content)}
              title="実装詳細"
              icon={Code}
              placeholder="実装の詳細手順や技術的な詳細を記述してください..."
              editorConfig={{ minHeight: 300 }}
              className={editMode === "edit" ? "" : "pointer-events-none"}
              headerActions={
                editMode === "view" ? (
                  <div className="flex items-center text-sm text-slate-400">
                    <Eye className="h-4 w-4 mr-1" />
                    読み取り専用
                  </div>
                ) : undefined
              }
            />

            {/* Completion Criteria */}
            <div className="backdrop-blur-lg bg-slate-800/60 border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Target className="h-5 w-5 mr-2 text-green-400" />
                完了基準
              </h3>
              {editMode === "edit" ? (
                <textarea
                  value={editedTask.completion_criteria || displayTask.completion_criteria || ""}
                  onChange={(e) => handleFieldChange("completion_criteria", e.target.value)}
                  rows={4}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white focus:border-cyan-500/50 focus:outline-none resize-none"
                  placeholder="このタスクが完了とみなされる条件を記述してください..."
                />
              ) : (
                <p className="text-slate-300 leading-relaxed">
                  {displayTask.completion_criteria || "完了基準が設定されていません"}
                </p>
              )}
            </div>

            {/* Educational Resources */}
            {(displayTask.learning_resources?.length || displayTask.technology_stack?.length || displayTask.reference_links?.length) && (
              <div className="backdrop-blur-lg bg-slate-800/60 border border-cyan-500/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <BookOpen className="h-5 w-5 mr-2 text-purple-400" />
                  学習リソース
                </h3>

                <div className="space-y-4">
                  {/* Learning Resources */}
                  {displayTask.learning_resources && displayTask.learning_resources.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-cyan-400 mb-2">学習資料</h4>
                      <ul className="space-y-2">
                        {displayTask.learning_resources.map((resource, index) => (
                          <li key={index} className="text-slate-300 flex items-center">
                            <Brain className="h-4 w-4 mr-2 text-blue-400" />
                            {resource}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Technology Stack */}
                  {displayTask.technology_stack && displayTask.technology_stack.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-cyan-400 mb-2">使用技術</h4>
                      <div className="flex flex-wrap gap-2">
                        {displayTask.technology_stack.map((tech, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-lg text-sm"
                          >
                            {resolveTechnologyLabel(tech)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reference Links */}
                  {displayTask.reference_links && displayTask.reference_links.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-cyan-400 mb-2">参考リンク</h4>
                      <ul className="space-y-2">
                        {displayTask.reference_links.map((link, index) => (
                          <li key={index} className="text-blue-400 hover:text-blue-300 flex items-center">
                            <Link className="h-4 w-4 mr-2" />
                            <a href={link} target="_blank" rel="noopener noreferrer" className="underline">
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Metadata & Stats */}
          <div className="space-y-6">
            {/* Progress Card */}
            <div className="backdrop-blur-lg bg-slate-800/60 border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-cyan-400" />
                進捗状況
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">進捗率</span>
                    <span className="text-lg font-bold text-cyan-400">
                      {displayTask.progress_percentage}%
                    </span>
                  </div>
                  {editMode === "edit" ? (
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedTask.progress_percentage ?? displayTask.progress_percentage}
                      onChange={(e) => handleFieldChange("progress_percentage", parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                  ) : (
                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${displayTask.progress_percentage}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Estimated Hours */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">見積時間</span>
                  {editMode === "edit" ? (
                    <input
                      type="number"
                      min="0"
                      value={editedTask.estimated_hours ?? displayTask.estimated_hours ?? ""}
                      onChange={(e) => handleFieldChange("estimated_hours", parseInt(e.target.value) || 0)}
                      className="w-20 bg-slate-700/50 border border-slate-600/50 rounded px-2 py-1 text-white text-sm focus:border-cyan-500/50 focus:outline-none"
                    />
                  ) : (
                    <span className="text-white flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {displayTask.estimated_hours || 0}時間
                    </span>
                  )}
                </div>

                {/* Blocking Reason */}
                {(displayTask.blocking_reason || editMode === "edit") && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">ブロッキング理由</label>
                    {editMode === "edit" ? (
                      <textarea
                        value={editedTask.blocking_reason || displayTask.blocking_reason || ""}
                        onChange={(e) => handleFieldChange("blocking_reason", e.target.value)}
                        rows={2}
                        className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500/50 focus:outline-none resize-none"
                        placeholder="ブロッキング要因があれば記述..."
                      />
                    ) : displayTask.blocking_reason ? (
                      <p className="text-red-300 text-sm bg-red-600/10 border border-red-500/20 rounded p-2">
                        {displayTask.blocking_reason}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {/* Schedule Card */}
            <div className="backdrop-blur-lg bg-slate-800/60 border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-green-400" />
                スケジュール
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">計画開始</span>
                  <span className="text-blue-400">{formatDate(displayTask.planned_start_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">計画終了</span>
                  <span className="text-blue-400">{formatDate(displayTask.planned_end_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">実際開始</span>
                  <span className="text-green-400">{formatDate(displayTask.actual_start_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">実際終了</span>
                  <span className="text-green-400">{formatDate(displayTask.actual_end_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">期限</span>
                  <span className="text-orange-400">{formatDate(displayTask.due_at)}</span>
                </div>
              </div>
            </div>

            {/* Category & Classification */}
            <div className="backdrop-blur-lg bg-slate-800/60 border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <GitBranch className="h-5 w-5 mr-2 text-purple-400" />
                分類・属性
              </h3>

              <div className="space-y-4">
                {/* Category */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">カテゴリ</span>
                  <div className="flex items-center space-x-2">
                    {getCategoryIcon(displayTask.category)}
                    <span className="text-cyan-400">{displayTask.category || "未設定"}</span>
                  </div>
                </div>

                {/* Execution Phase */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">実行フェーズ</span>
                  <span className="text-purple-400">{displayTask.execution_phase || "未設定"}</span>
                </div>

                {/* Moscow Priority */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">MoSCoW</span>
                  <span className={`px-2 py-1 rounded text-sm ${
                    displayTask.moscow_priority === "Must" ? "bg-red-600/20 text-red-400" :
                    displayTask.moscow_priority === "Should" ? "bg-orange-600/20 text-orange-400" :
                    displayTask.moscow_priority === "Could" ? "bg-yellow-600/20 text-yellow-400" :
                    displayTask.moscow_priority === "Won't" ? "bg-slate-600/20 text-slate-400" :
                    "bg-slate-600/20 text-slate-400"
                  }`}>
                    {displayTask.moscow_priority || "未設定"}
                  </span>
                </div>

                {/* Parallel Group */}
                {displayTask.parallel_group_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">並列グループ</span>
                    <span className="text-blue-400">{displayTask.parallel_group_id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Card */}
            <div className="backdrop-blur-lg bg-slate-800/60 border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-orange-400" />
                評価指標
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 text-sm">複雑度</span>
                    <span className="text-cyan-400 text-sm">{displayTask.complexity_level || 0}/5</span>
                  </div>
                  <ScoreBar value={displayTask.complexity_level} max={5} color="cyan" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 text-sm">ビジネス価値</span>
                    <span className="text-green-400 text-sm">{displayTask.business_value_score || 0}/10</span>
                  </div>
                  <ScoreBar value={displayTask.business_value_score} max={10} color="green" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 text-sm">技術リスク</span>
                    <span className="text-red-400 text-sm">{displayTask.technical_risk_score || 0}/10</span>
                  </div>
                  <ScoreBar value={displayTask.technical_risk_score} max={10} color="red" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 text-sm">実装難易度</span>
                    <span className="text-orange-400 text-sm">{displayTask.implementation_difficulty || 0}/10</span>
                  </div>
                  <ScoreBar value={displayTask.implementation_difficulty} max={10} color="orange" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 text-sm">ユーザー影響度</span>
                    <span className="text-blue-400 text-sm">{displayTask.user_impact_score || 0}/10</span>
                  </div>
                  <ScoreBar value={displayTask.user_impact_score} max={10} color="blue" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 text-sm">依存関係重み</span>
                    <span className="text-purple-400 text-sm">{displayTask.dependency_weight || 0}/10</span>
                  </div>
                  <ScoreBar value={displayTask.dependency_weight} max={10} color="purple" />
                </div>
              </div>
            </div>

            {/* Metadata Card */}
            <div className="backdrop-blur-lg bg-slate-800/60 border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Timer className="h-5 w-5 mr-2 text-slate-400" />
                メタデータ
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">作成日時</span>
                  <span className="text-slate-300">{formatDate(displayTask.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">更新日時</span>
                  <span className="text-slate-300">{formatDate(displayTask.updated_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">タスクID</span>
                  <span className="text-slate-500 text-xs font-mono break-all">
                    {displayTask.task_id}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
