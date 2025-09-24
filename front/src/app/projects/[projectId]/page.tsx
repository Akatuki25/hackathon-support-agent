"use client";

import React, { useState, useEffect } from "react";
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
  arrayMove,
} from "@dnd-kit/sortable";
import {
  Kanban,
  Plus,
  Clock,
  Zap,
  GitBranch,
  BookOpen,
  Eye,
  Settings,
  Activity,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Filter,
  ArrowUpDown,
  Calendar,
  BarChart3,
  FileText,
} from "lucide-react";
import { EnhancedTasksService, Task } from "@/libs/service/enhancedTasksService";
import TaskCard from "@/components/TaskCard/TaskCard";
import CompletedTasksModal from "@/components/CompletedTasksModal/CompletedTasksModal";

interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  tasks: Task[];
  color: string;
  icon: React.ComponentType<any>;
}

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
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [hasGeneratedTasks, setHasGeneratedTasks] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load tasks on component mount and check if we need to generate tasks
  useEffect(() => {
    initializeProject();
  }, [projectId]);

  const initializeProject = async () => {
    try {
      setLoading(true);
      const response = await EnhancedTasksService.getBasicProjectTasks(projectId, {
        sort_by: "topological_order",
        limit: 1000
      });

      // If no tasks exist, automatically generate them
      if (response.tasks.length === 0 && !hasGeneratedTasks) {
        await generateTasksWithProgress();
      } else {
        // Group tasks by status
        const newColumns = columns.map(column => ({
          ...column,
          tasks: response.tasks.filter(task => task.status === column.status)
        }));
        setColumns(newColumns);
        setHasGeneratedTasks(true);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to initialize project:", err);
      setError("プロジェクトの初期化に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await EnhancedTasksService.getBasicProjectTasks(projectId, {
        sort_by: "topological_order",
        limit: 1000
      });

      // Group tasks by status
      const newColumns = columns.map(column => ({
        ...column,
        tasks: response.tasks.filter(task => task.status === column.status)
      }));

      setColumns(newColumns);
      setError(null);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError("タスクの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const generateTasksWithProgress = async () => {
    try {
      setIsGeneratingTasks(true);
      setGenerationProgress(0);

      // Simulate progressive task generation with status updates
      const steps = [
        { progress: 10, status: "プロジェクト仕様を分析中..." },
        { progress: 25, status: "機能要件を分析中..." },
        { progress: 40, status: "技術スタックを確認中..." },
        { progress: 55, status: "タスクを生成中..." },
        { progress: 70, status: "依存関係を分析中..." },
        { progress: 85, status: "優先度を算出中..." },
        { progress: 95, status: "最終調整中..." },
      ];

      for (const step of steps) {
        setGenerationProgress(step.progress);
        setGenerationStatus(step.status);
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate processing time
      }

      // Actually generate tasks
      await EnhancedTasksService.generateTasks(projectId, {
        hackathon_mode: true,
        use_parallel_processing: true,
        use_full_workflow: true
      });

      setGenerationProgress(100);
      setGenerationStatus("タスク生成完了！");
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reload tasks after generation
      await loadTasks();
      setHasGeneratedTasks(true);
    } catch (err) {
      console.error("Failed to generate tasks:", err);
      setError("タスク生成に失敗しました");
    } finally {
      setIsGeneratingTasks(false);
      setGenerationProgress(0);
      setGenerationStatus("");
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
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Kanban className="h-8 w-8 text-cyan-400" />
              <h1 className="text-2xl font-bold text-white">プロジェクト Kanban</h1>
            </div>

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
                disabled={isGeneratingTasks}
                className="px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>{isGeneratingTasks ? "生成中..." : "タスク生成"}</span>
              </button>

              {/* Future Navigation */}
              <div className="flex items-center space-x-2 pl-4 border-l border-slate-700">
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