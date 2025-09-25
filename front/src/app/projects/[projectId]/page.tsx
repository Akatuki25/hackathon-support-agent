"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Kanban,
  Plus,
  Clock,
  GitBranch,
  Eye,
  Settings,
  Activity,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  FileText,
} from "lucide-react";
import { EnhancedTasksService, Task, LLMUsageMetrics, LLMUsageResponse } from "@/libs/service/enhancedTasksService";
import TaskCard from "@/components/TaskCard/TaskCard";
import CompletedTasksModal from "@/components/CompletedTasksModal/CompletedTasksModal";

type IconProps = { className?: string };

interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  tasks: Task[];
  color: string;
  icon: React.ComponentType<IconProps>;
}

type StageKey = "stage1" | "stage2" | "stage3" | "stage4" | "stage5";
type StageStatus = "idle" | "queued" | "running" | "completed" | "error";
type BackgroundStage = "stage3" | "stage4" | "stage5" | "completed";

const initialStageStatuses: Record<StageKey, StageStatus> = {
  stage1: "idle",
  stage2: "idle",
  stage3: "idle",
  stage4: "idle",
  stage5: "idle"
};

const pipelineStages: { key: StageKey; label: string }[] = [
  { key: "stage1", label: "Stage1: タスク分割" },
  { key: "stage2", label: "Stage2: ディレクトリ設計" },
  { key: "stage3", label: "Stage3: 学習詳細" },
  { key: "stage4", label: "Stage4: 依存分析" },
  { key: "stage5", label: "Stage5: タイムライン" }
];

const stageStatusConfig: Record<StageStatus, { className: string; icon: React.ComponentType<IconProps> }> = {
  idle: {
    className: "bg-slate-800/40 border-slate-700 text-slate-500",
    icon: Circle
  },
  queued: {
    className: "bg-slate-800/50 border-slate-700 text-slate-300",
    icon: Clock
  },
  running: {
    className: "bg-cyan-600/30 border-cyan-500/40 text-cyan-200",
    icon: Activity
  },
  completed: {
    className: "bg-green-600/25 border-green-500/40 text-green-200",
    icon: CheckCircle2
  },
  error: {
    className: "bg-red-600/25 border-red-500/40 text-red-200",
    icon: AlertTriangle
  }
};

const backgroundStageLabels: Record<BackgroundStage, string> = {
  stage3: "Stage3: 教育的タスク詳細を生成中",
  stage4: "Stage4: 依存関係とグラフを解析中",
  stage5: "Stage5: タイムラインを構築中",
  completed: "Stage3-5 完了"
};

export default function ProjectKanbanPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  // State management
  const [columns, setColumns] = useState<KanbanColumn[]>([
    { id: "todo", title: "TODO", status: "TODO", tasks: [], color: "bg-slate-600/20 border-slate-500/30", icon: Circle },
    { id: "doing", title: "進行中", status: "DOING", tasks: [], color: "bg-blue-600/20 border-blue-500/30", icon: Activity },
    { id: "done", title: "完了", status: "DONE", tasks: [], color: "bg-green-600/20 border-green-500/30", icon: CheckCircle2 },
  ]);

  const [loading, setLoading] = useState(true);
  const [isRefreshingTasks, setIsRefreshingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [stageStatuses, setStageStatuses] = useState<Record<StageKey, StageStatus>>({ ...initialStageStatuses });
  const [backgroundProcessing, setBackgroundProcessing] = useState(false);
  const [backgroundStage, setBackgroundStage] = useState<BackgroundStage | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [llmUsage, setLlmUsage] = useState<Record<string, LLMUsageMetrics>>({});
  const llmUsageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateStageStatus = (stage: StageKey, status: StageStatus) => {
    setStageStatuses((prev) => ({ ...prev, [stage]: status }));
  };

  const stopLlmUsagePolling = () => {
    if (llmUsageIntervalRef.current) {
      clearInterval(llmUsageIntervalRef.current);
      llmUsageIntervalRef.current = null;
    }
  };

  const fetchLlmUsage = async () => {
    if (!projectId) return;
    try {
      const response: LLMUsageResponse = await EnhancedTasksService.getLLMUsage(projectId);
      setLlmUsage(response.llm_usage || {});
    } catch {
      // LLM使用状況はステージ処理中以外は存在しない可能性があるため、エラーは静かに無視
    }
  };

  const startLlmUsagePolling = () => {
    stopLlmUsagePolling();
    void fetchLlmUsage();
    llmUsageIntervalRef.current = setInterval(() => {
      void fetchLlmUsage();
    }, 2500);
  };

  useEffect(() => {
    return () => {
      stopLlmUsagePolling();
    };
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const initializeProject = useCallback(async () => {
    if (!projectId) return;
    try {
      stopLlmUsagePolling();
      setStageStatuses({ ...initialStageStatuses });
      setBackgroundProcessing(false);
      setBackgroundStage(null);
      setBackgroundError(null);
      setLlmUsage({});
      setLoading(true);
      const response = await EnhancedTasksService.getBasicProjectTasks(projectId, {
        sort_by: "topological_order",
        limit: 1000
      });

      // Group tasks by status
      setColumns((prevColumns) =>
        prevColumns.map(column => ({
          ...column,
          tasks: response.tasks.filter(task => task.status === column.status)
        }))
      );
      setError(null);
    } catch (err) {
      console.error("Failed to initialize project:", err);
      setError("プロジェクトの初期化に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load tasks on component mount and check if we need to generate tasks
  useEffect(() => {
    void initializeProject();
  }, [initializeProject]);

  const loadTasks = async (options: { showOverlay?: boolean } = {}) => {
    if (!projectId) return;
    const { showOverlay = false } = options;
    try {
      if (showOverlay) {
        setLoading(true);
      } else {
        setIsRefreshingTasks(true);
      }

      const response = await EnhancedTasksService.getBasicProjectTasks(projectId, {
        sort_by: "topological_order",
        limit: 1000
      });

      setColumns((prevColumns) =>
        prevColumns.map(column => ({
          ...column,
          tasks: response.tasks.filter(task => task.status === column.status)
        }))
      );

      setError(null);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError("タスクの読み込みに失敗しました");
    } finally {
      if (showOverlay) {
        setLoading(false);
      } else {
        setIsRefreshingTasks(false);
      }
    }
  };

  const runBackgroundStages = async () => {
    if (!projectId) return;
    if (backgroundProcessing) return;

    setBackgroundProcessing(true);
    setBackgroundError(null);
    setBackgroundStage("stage3");
    setLlmUsage({});
    updateStageStatus("stage3", "running");
    updateStageStatus("stage4", "queued");
    updateStageStatus("stage5", "queued");
    startLlmUsagePolling();

    let currentStage: BackgroundStage = "stage3";

    try {
      await EnhancedTasksService.runStage3(projectId);
      updateStageStatus("stage3", "completed");
      updateStageStatus("stage4", "running");
      currentStage = "stage4";
      setBackgroundStage("stage4");

      await EnhancedTasksService.runStage4(projectId);
      updateStageStatus("stage4", "completed");
      updateStageStatus("stage5", "running");
      currentStage = "stage5";
      setBackgroundStage("stage5");

      await EnhancedTasksService.runStage5(projectId);
      updateStageStatus("stage5", "completed");
      setBackgroundStage("completed");

      await loadTasks();
    } catch (err) {
      console.error("Failed to complete background stages:", err);
      const message = axios.isAxiosError(err) && err.message === "Network Error"
        ? "バックエンドと通信できず、Stage3-5 を実行できませんでした"
        : "高度なタスク生成ステージでエラーが発生しました";
      setBackgroundError(message);
      setError((prev) => prev ?? message);
      updateStageStatus(currentStage, "error");
    } finally {
      stopLlmUsagePolling();
      setBackgroundProcessing(false);
      setTimeout(() => {
        setBackgroundStage(null);
      }, 2000);
    }
  };

  const generateTasksWithProgress = async () => {
    if (!projectId) return;
    try {
      setIsGeneratingTasks(true);
      setGenerationProgress(0);
      setGenerationStatus("");
      setBackgroundError(null);
      setLlmUsage({});
      setStageStatuses({
        stage1: "running",
        stage2: "queued",
        stage3: "queued",
        stage4: "queued",
        stage5: "queued"
      });

      setGenerationProgress(12);
      setGenerationStatus("Stage1: プロジェクト仕様を解析中...");

      await EnhancedTasksService.runStage1(projectId);
      updateStageStatus("stage1", "completed");
      updateStageStatus("stage2", "running");
      setGenerationProgress(45);
      setGenerationStatus("Stage2: ディレクトリ計画を構築中...");

      await EnhancedTasksService.runStage2(projectId);
      updateStageStatus("stage2", "completed");
      setGenerationProgress(80);
      setGenerationStatus("初期タスク生成完了。ボードを更新しています...");

      await loadTasks();
      setGenerationProgress(100);
      setGenerationStatus("Stage1-2 完了");

      void runBackgroundStages();
    } catch (err) {
      console.error("Failed to generate tasks:", err);
      const message = axios.isAxiosError(err) && err.message === "Network Error"
        ? "バックエンドに接続できませんでした。APIサーバーの起動状態とCORS設定を確認してください。"
        : "タスク生成に失敗しました";
      setError(message);
      setStageStatuses({
        stage1: "error",
        stage2: "error",
        stage3: "idle",
        stage4: "idle",
        stage5: "idle"
      });
    } finally {
      setTimeout(() => {
        setIsGeneratingTasks(false);
        setGenerationProgress(0);
        setGenerationStatus("");
      }, 600);
    }
  };

  const generateTasks = async () => {
    await generateTasksWithProgress();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = findTaskById(active.id as string);
    setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveTask(null);
      return;
    }

    const activeTask = findTaskById(active.id as string);
    const overColumn = findColumnById(over.id as string);

    if (!activeTask || !overColumn) {
      setActiveTask(null);
      return;
    }

    // If status changed, update the task
    if (activeTask.status !== overColumn.status) {
      try {
        await EnhancedTasksService.updateTask(activeTask.task_id, {
          status: overColumn.status,
          progress_percentage: overColumn.status === "DONE" ? 100 :
                              overColumn.status === "DOING" ? 50 : 0,
          actual_start_date: overColumn.status === "DOING" && !activeTask.actual_start_date ?
                           new Date().toISOString() : activeTask.actual_start_date,
          actual_end_date: overColumn.status === "DONE" && !activeTask.actual_end_date ?
                         new Date().toISOString() : activeTask.actual_end_date
        });

        // Update local state
        const newColumns = columns.map(column => ({
          ...column,
          tasks: column.id === overColumn.id
            ? [...column.tasks, { ...activeTask, status: overColumn.status }]
            : column.tasks.filter(task => task.task_id !== activeTask.task_id)
        }));

        setColumns(newColumns);
      } catch (err) {
        console.error("Failed to update task status:", err);
        setError("タスクの更新に失敗しました");
      }
    }

    setActiveTask(null);
  };

  const findTaskById = (id: string): Task | null => {
    for (const column of columns) {
      const task = column.tasks.find(task => task.task_id === id);
      if (task) return task;
    }
    return null;
  };

  const findColumnById = (id: string): KanbanColumn | null => {
    return columns.find(column => column.id === id) || null;
  };

  const completedTasks = columns.find(col => col.id === "done")?.tasks || [];

  const backgroundProgress = (() => {
    const backgroundStages: StageKey[] = ["stage3", "stage4", "stage5"];
    let completedCount = 0;
    let runningCount = 0;

    backgroundStages.forEach((stage) => {
      const status = stageStatuses[stage];
      if (status === "completed") {
        completedCount += 1;
      } else if (status === "running") {
        runningCount += 1;
      }
    });

    const progress = ((completedCount + runningCount * 0.5) / backgroundStages.length) * 100;
    return Math.min(100, Math.round(progress));
  })();

  const llmUsageEntries = Object.entries(llmUsage || {});
  const llmUsageTotals = llmUsageEntries.reduce(
    (acc, [, metrics]) => {
      const calls = Number(metrics?.calls ?? 0);
      const tokens = Number(metrics?.tokens ?? 0);
      return {
        calls: acc.calls + (Number.isFinite(calls) ? calls : 0),
        tokens: acc.tokens + (Number.isFinite(tokens) ? tokens : 0)
      };
    },
    { calls: 0, tokens: 0 }
  );

  const activeBackgroundLabel = backgroundStage ? backgroundStageLabels[backgroundStage] : "Stage3-5 待機中";
  const showBackgroundPanel = backgroundProcessing || backgroundStage === "completed" || !!backgroundError;

  if (loading || isGeneratingTasks) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        {/* Cyber Grid Background */}
        <div className="absolute inset-0 opacity-10">
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

        <div className="relative z-10 text-center max-w-md mx-auto px-4">
          {/* Animated Logo/Icon */}
          <div className="relative mb-8">
            <div className="absolute inset-0 animate-ping">
              <Kanban className="h-16 w-16 text-cyan-400/30 mx-auto" />
            </div>
            <Kanban className="h-16 w-16 text-cyan-400 mx-auto relative z-10" />
          </div>

          {/* Progress Indicator */}
          {isGeneratingTasks && (
            <div className="mb-6">
              <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-6 border border-cyan-500/30">
                <h3 className="text-xl font-bold text-white mb-4">タスクを生成中...</h3>

                {/* Progress Bar */}
                <div className="bg-slate-700 rounded-full h-2 mb-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  ></div>
                </div>

                {/* Progress Percentage */}
                <div className="flex justify-between text-sm text-slate-400 mb-3">
                  <span>進行状況</span>
                  <span>{generationProgress}%</span>
                </div>

                {/* Current Status */}
                <p className="text-cyan-400 text-sm animate-pulse">
                  {generationStatus || "初期化中..."}
                </p>
              </div>
            </div>
          )}

          {/* Loading animation when not generating tasks */}
          {!isGeneratingTasks && (
            <div className="mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
              <p className="text-cyan-400 text-lg">プロジェクトを読み込み中...</p>
            </div>
          )}

          {/* Decorative Elements */}
          <div className="flex justify-center space-x-2 opacity-50">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Cyber Grid Background */}
      <div className="absolute inset-0 opacity-10">
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
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-4">
              <Kanban className="h-8 w-8 text-cyan-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">プロジェクト Kanban</h1>
                <p className="text-sm text-slate-400">LLMエージェントによるステージ別タスク生成をリアルタイムで追跡</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:space-x-3">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowCompletedModal(true)}
                  className="px-4 py-2 bg-green-600/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-600/30 transition-all duration-300 flex items-center space-x-2"
                >
                  <Eye className="h-4 w-4" />
                  <span>完了済み ({completedTasks.length})</span>
                </button>

                <button
                onClick={generateTasks}
                disabled={isGeneratingTasks || backgroundProcessing}
                className="px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>{isGeneratingTasks ? "生成中..." : backgroundProcessing ? "高度処理中" : "タスク生成"}</span>
              </button>
              </div>

              <div className="flex items-center space-x-2 md:pl-4 md:border-l border-slate-700">
                <button className="p-2 text-slate-500 hover:text-cyan-400 transition-colors">
                  <ArrowUpDown className="h-5 w-5" />
                </button>
                <button className="p-2 text-slate-500 hover:text-cyan-400 transition-colors">
                  <Clock className="h-5 w-5" />
                </button>
                <button className="p-2 text-slate-500 hover:text-cyan-400 transition-colors">
                  <GitBranch className="h-5 w-5" />
                </button>
                <button className="p-2 text-slate-500 hover:text-cyan-400 transition-colors">
                  <BarChart3 className="h-5 w-5" />
                </button>
                <button className="p-2 text-slate-500 hover:text-cyan-400 transition-colors">
                  <FileText className="h-5 w-5" />
                </button>
                <button className="p-2 text-slate-500 hover:text-cyan-400 transition-colors">
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {pipelineStages.map(({ key, label }) => {
                const status = stageStatuses[key];
                const StageIcon = stageStatusConfig[status].icon;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg border text-xs font-medium ${stageStatusConfig[status].className}`}
                  >
                    <StageIcon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-400">
              {isRefreshingTasks ? (
                <>
                  <div className="h-3 w-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                  <span>ボードを更新中...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                  <span>ボードは最新の状態です</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {showBackgroundPanel && (
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <div className="bg-slate-900/60 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Activity className={`h-6 w-6 ${backgroundError ? "text-red-400" : "text-cyan-400"} animate-pulse`} />
              <div>
                <p className={`text-sm font-medium ${backgroundError ? "text-red-300" : "text-white"}`}>
                  {backgroundError
                    ? "Stage3-5 でエラーが発生しました"
                    : backgroundProcessing
                      ? "Stage3-5: LLM連携処理を実行中"
                      : "Stage3-5: 高度な処理が完了しました"}
                </p>
                <p className="text-xs text-slate-400">{backgroundError ?? activeBackgroundLabel}</p>
              </div>
            </div>

            <div className="w-full md:flex-1 md:px-6">
              <div className="bg-slate-800/60 h-2 w-full rounded-full overflow-hidden">
                <div
                  className={`${backgroundError ? "bg-red-500" : "bg-gradient-to-r from-cyan-500 to-blue-500"} h-2 transition-all duration-500`}
                  style={{ width: `${backgroundError ? 100 : backgroundProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-2">
                <span>進捗</span>
                <span>{backgroundError ? "エラー" : `${backgroundProgress}%`}</span>
              </div>
            </div>

            <div className="min-w-[170px] text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">LLM呼び出し</span>
                <span className="text-cyan-300">{llmUsageTotals.calls.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">累計トークン</span>
                <span className="text-cyan-300">{llmUsageTotals.tokens.toLocaleString()}</span>
              </div>
              {llmUsageEntries.slice(0, 2).map(([model, metrics]) => (
                <div key={model} className="flex items-center justify-between text-slate-500">
                  <span className="truncate pr-2">{model}</span>
                  <span>{Number(metrics?.calls ?? 0).toLocaleString()} calls</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-4">
          <div className="bg-red-600/20 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                onTaskClick={(task) => router.push(`/tasks/${task.task_id}`)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="transform rotate-3">
                <TaskCard
                  task={activeTask}
                  onClick={() => {}}
                  isDragging={true}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Completed Tasks Modal */}
      {showCompletedModal && (
        <CompletedTasksModal
          tasks={completedTasks}
          onClose={() => setShowCompletedModal(false)}
          onTaskClick={(task) => {
            setShowCompletedModal(false);
            router.push(`/tasks/${task.task_id}`);
          }}
        />
      )}
    </div>
  );
}

// Kanban Column Component
interface KanbanColumnProps {
  column: KanbanColumn;
  onTaskClick: (task: Task) => void;
}

function KanbanColumn({ column, onTaskClick }: KanbanColumnProps) {
  const Icon = column.icon;

  return (
    <div className={`backdrop-blur-lg rounded-xl p-4 border transition-all duration-300 ${column.color}`}>
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon className="h-5 w-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">{column.title}</h3>
          <span className="bg-cyan-600/20 text-cyan-400 text-xs px-2 py-1 rounded-full">
            {column.tasks.length}
          </span>
        </div>
      </div>

      {/* Task List */}
      <SortableContext items={column.tasks.map(task => task.task_id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 min-h-[200px]">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.task_id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}

          {column.tasks.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Circle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>タスクがありません</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
