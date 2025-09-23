"use client";

import React, { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DndProvider, useDragLayer } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Sun, Moon, FolderTree, Terminal, Save, Info, CalendarCheck, CloudUpload, Sparkles, Cpu } from "lucide-react";

import type { Task, ProjectData, EnhancedTaskDetail } from "../../../types/taskTypes";
import Column from "@/components/Column";
import Loading from "@/components/Loading";
import ErrorShow from "@/components/Error";
import EnhancedTaskCard from "@/components/EnhancedTaskCard";
import { generateTaskDetailsFromProjectDocument, generateEnhancedTaskDetails } from "@/libs/service/enhancedTaskDetailService";

const UNASSIGNED = "";
const DONE = "done";

// Enhanced Task Modal Component
interface TaskModalProps {
  task: EnhancedTaskDetail | null;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, isOpen, onClose, isDarkMode }) => {
  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg ${
        isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
      }`}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className={`text-2xl font-bold ${isDarkMode ? "text-cyan-400" : "text-blue-700"}`}>
              {task.task_name}
            </h2>
            <button
              onClick={onClose}
              className={`text-2xl font-bold ${isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"}`}
            >
              ×
            </button>
          </div>

          <EnhancedTaskCard
            task={task}
            isDarkMode={isDarkMode}
            onTaskClick={() => {}} // Disable click in modal
          />
        </div>
      </div>
    </div>
  );
};

// Enhanced Task Generation Panel
interface TaskGenerationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  projectId: string;
  onTasksGenerated: (tasks: EnhancedTaskDetail[]) => void;
}

const TaskGenerationPanel: React.FC<TaskGenerationPanelProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  projectId,
  onTasksGenerated
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<EnhancedTaskDetail[]>([]);
  const [error, setError] = useState<string>("");

  const handleGenerateFromProjectDocument = async () => {
    setIsGenerating(true);
    setError("");

    try {
      // Mock tasks for demonstration - in real implementation, this would come from existing project tasks
      const mockTasks = [
        {
          task_name: "ユーザー認証システムの実装",
          priority: "Must" as const,
          content: "JWT認証を使用したログイン・ログアウト・ユーザー登録機能を実装する"
        },
        {
          task_name: "データベース設計",
          priority: "Must" as const,
          content: "ユーザー、プロジェクト、タスクのテーブル設計とリレーション構築"
        },
        {
          task_name: "APIエンドポイント作成",
          priority: "Should" as const,
          content: "RESTful APIエンドポイントの設計と実装"
        }
      ];

      const response = await generateTaskDetailsFromProjectDocument({
        project_id: projectId,
        tasks: mockTasks
      });

      setGeneratedTasks(response.tasks);
      onTasksGenerated(response.tasks);
    } catch (err: any) {
      setError(err.message || "タスク生成に失敗しました");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg ${
        isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
      }`}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className={`text-2xl font-bold ${isDarkMode ? "text-cyan-400" : "text-blue-700"}`}>
              <Sparkles className="inline mr-2" />
              拡張タスク詳細生成
            </h2>
            <button
              onClick={onClose}
              className={`text-2xl font-bold ${isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"}`}
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <p className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
              AI検索とRAG処理を使用して、教育的で詳細なタスク情報を生成します。
            </p>

            {error && (
              <div className="p-3 rounded bg-red-900/20 text-red-400 border border-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerateFromProjectDocument}
              disabled={isGenerating}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-all ${
                isGenerating
                  ? "opacity-50 cursor-not-allowed"
                  : isDarkMode
                    ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isGenerating ? (
                <div className="flex items-center justify-center">
                  <Cpu className="animate-spin mr-2" size={20} />
                  AI処理中...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Sparkles className="mr-2" size={20} />
                  ProjectDocumentから生成
                </div>
              )}
            </button>

            {generatedTasks.length > 0 && (
              <div className="mt-6">
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? "text-cyan-400" : "text-blue-700"}`}>
                  生成されたタスク ({generatedTasks.length}件)
                </h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {generatedTasks.map((task, index) => (
                    <div key={index} className={`p-3 rounded border ${
                      isDarkMode ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50"
                    }`}>
                      <h4 className="font-medium">{task.task_name}</h4>
                      <p className="text-sm opacity-80 mt-1">{task.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          task.priority === 'Must' ? 'bg-red-900/30 text-red-400' :
                          task.priority === 'Should' ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-blue-900/30 text-blue-400'
                        }`}>
                          {task.priority}
                        </span>
                        <span className="text-xs opacity-60">
                          技術: {task.technologies_used.length}件
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Auto-scroll DnD component
function KanbanBoardContent({
  darkMode,
  members,
  tasks,
  unassignedTasks,
  doneTasks,
  handleDropTask,
  handleMemberNameChange,
  handleTaskDetail,
  handleSaveMembers,
  savingMembers
}: {
  darkMode: boolean;
  project: ProjectData;
  members: string[];
  tasks: Task[];
  unassignedTasks: Task[];
  doneTasks: Task[];
  handleDropTask: (dragIndex: number, newAssignment: string) => void;
  handleMemberNameChange: (colIndex: number, newName: string) => void;
  handleTaskDetail: (taskId: string) => void;
  handleSaveMembers: () => void;
  savingMembers: boolean;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);

  const { isDragging, currentOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getSourceClientOffset(),
  }));

  useEffect(() => {
    if (!isDragging || !currentOffset || !scrollContainerRef.current) {
      return;
    }

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    let scrollInterval: NodeJS.Timeout | null = null;

    const calculateScrollSpeed = (position: number, edge: number, threshold: number): number => {
      const distance = Math.abs(position - edge);
      if (distance > threshold) return 0;
      return Math.round(20 * (1 - distance / threshold));
    };

    const handleScroll = (): void => {
      const { x } = currentOffset;
      const scrollThreshold = 150;

      const leftSpeed = calculateScrollSpeed(x, containerRect.left, scrollThreshold);
      const rightSpeed = calculateScrollSpeed(x, containerRect.right, scrollThreshold);

      if (leftSpeed > 0) {
        container.scrollLeft -= leftSpeed;
        setIsScrolling(true);
      } else if (rightSpeed > 0) {
        container.scrollLeft += rightSpeed;
        setIsScrolling(true);
      } else {
        setIsScrolling(false);
      }
    };

    scrollInterval = setInterval(handleScroll, 16);

    return () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
      setIsScrolling(false);
    };
  }, [isDragging, currentOffset]);

  return (
    <div className="container mx-auto px-4 py-6 relative z-10 flex flex-col" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <div
        ref={scrollContainerRef}
        className={`overflow-x-auto cyber-scrollbar pb-4 flex-grow relative ${isScrolling ? 'auto-scrolling' : 'scrolling-active'}`}
      >
        <div className="scroll-guide-left"></div>
        <div className="scroll-guide-right"></div>

        <div className="flex space-x-6 py-2 px-2" style={{ minWidth: 'max-content' }}>
          <div className="flex-shrink-0" style={{ width: '380px' }}>
            <Column
              assignmentKey={UNASSIGNED}
              columnTitle="未定"
              tasks={unassignedTasks}
              onDropTask={handleDropTask}
              isMemberColumn={false}
              onTaskDetail={handleTaskDetail}
              isDarkMode={darkMode}
            />
          </div>

          {members.map((memberName, colIndex) => {
            const assignedTasks = tasks.filter((t) => t.assignment === memberName);
            return (
              <div key={colIndex} className="flex-shrink-0" style={{ width: '380px' }}>
                <Column
                  assignmentKey={memberName}
                  columnTitle={memberName}
                  tasks={assignedTasks}
                  onDropTask={handleDropTask}
                  isMemberColumn={true}
                  onMemberNameChange={(newName: string) => handleMemberNameChange(colIndex, newName)}
                  onTaskDetail={handleTaskDetail}
                  isDarkMode={darkMode}
                />
              </div>
            );
          })}

          <div className="flex-shrink-0" style={{ width: '380px' }}>
            <Column
              assignmentKey={DONE}
              columnTitle="完了"
              tasks={doneTasks}
              onDropTask={handleDropTask}
              isMemberColumn={false}
              onTaskDetail={handleTaskDetail}
              isDarkMode={darkMode}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-center mb-8 mt-6">
        <button
          onClick={handleSaveMembers}
          disabled={savingMembers}
          className={`px-6 py-3 rounded-full shadow-lg flex items-center justify-center transition-all ${
            savingMembers ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-1'
          } ${
            darkMode
              ? 'bg-cyan-500 hover:bg-cyan-600 text-gray-900'
              : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white'
          }`}
        >
          {savingMembers ? (
            <div className="flex items-center">
              <div className={`animate-spin rounded-full h-4 w-4 border-2 ${
                darkMode ? 'border-gray-900 border-t-transparent' : 'border-white border-t-transparent'
              } mr-2`}></div>
              <span>保存中...</span>
            </div>
          ) : (
            <>
              <Save size={18} className="mr-2" />
              <span>参加者名の変更を保存</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default function ProjectBoardPage({ params }: PageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { projectId } = use(params); // Next.js 15 async params
  const [darkMode, setDarkMode] = useState<boolean>(true);

  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [members, setMembers] = useState<string[]>([]);
  const [savingMembers, setSavingMembers] = useState<boolean>(false);

  // Enhanced Task Modal State
  const [selectedTask, setSelectedTask] = useState<EnhancedTaskDetail | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isGenerationPanelOpen, setIsGenerationPanelOpen] = useState(false);
  const [enhancedTasks, setEnhancedTasks] = useState<EnhancedTaskDetail[]>([]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setError("プロジェクトIDが指定されていません");
      return;
    }

    const fetchProject = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`);
        if (!res.ok) throw new Error("プロジェクト取得エラー");
        const data: ProjectData = await res.json();

        const allTasks: Task[] = [];
        data.task_info.forEach((taskStr, idx) => {
          try {
            const parsed = JSON.parse(taskStr);
            allTasks.push({ ...parsed, __index: idx });
          } catch (parseErr) {
            console.error("タスク情報パース失敗:", parseErr);
          }
        });

        setProject(data);
        setTasks(allTasks);
        setMembers(data.menber_info ?? []);
      } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  const handleDropTask = useCallback(
    async (dragIndex: number, newAssignment: string) => {
      if (!project) return;
      const updatedTasks = tasks.map((t) =>
        t.__index === dragIndex ? { ...t, assignment: newAssignment } : t
      );
      setTasks(updatedTasks);

      const updatedTaskInfo = updatedTasks.map((t) =>
        JSON.stringify({
          task_id: t.task_id,
          task_name: t.task_name,
          priority: t.priority,
          content: t.content,
          detail: t.detail,
          assignment: t.assignment,
        })
      );

      const reqBody = {
        ...project,
        task_info: updatedTaskInfo,
        menber_info: members,
      };

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${project.project_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqBody),
          }
        );
        if (!res.ok) {
          console.error("プロジェクト更新失敗:", res.statusText);
        }
      } catch (updErr) {
        console.error("プロジェクト更新エラー:", updErr);
      }
    },
    [tasks, project, members]
  );

  const handleMemberNameChange = (colIndex: number, newName: string) => {
    const newArr = [...members];
    newArr[colIndex] = newName;
    setMembers(newArr);
  };

  const handleSaveMembers = async () => {
    if (!project) return;
    setSavingMembers(true);

    const updatedTaskInfo = tasks.map((t) =>
      JSON.stringify({
        task_id: t.task_id,
        task_name: t.task_name,
        priority: t.priority,
        content: t.content,
        detail: t.detail,
        assignment: t.assignment,
      })
    );

    const reqBody = {
      ...project,
      menber_info: members,
      task_info: updatedTaskInfo,
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${project.project_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        }
      );
      if (!res.ok) {
        console.error("参加者名更新失敗:", res.statusText);
      } else {
        console.log("参加者名更新成功");
      }
    } catch (err) {
      console.error("参加者名更新エラー:", err);
    } finally {
      setSavingMembers(false);
    }
  };

  const handleTaskDetail = (taskId: string) => {
    console.log("タスク詳細ページへ遷移:", taskId);
    router.push(`/projects/${projectId}/tasks/${taskId}`);
  };

  const handleEnhancedTaskClick = (task: EnhancedTaskDetail) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleTasksGenerated = (newTasks: EnhancedTaskDetail[]) => {
    setEnhancedTasks(newTasks);
  };

  if (loading) {
    return (
      <div className={`min-h-screen font-mono transition-all duration-500 flex items-center justify-center ${
        darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-900'
      }`}>
        <Loading darkMode={darkMode} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorShow
        error={error}
        darkMode={darkMode}
      />
    );
  }

  if (!project) return <p>プロジェクト情報がありません。</p>;

  const unassignedTasks = tasks.filter((t) => t.assignment === UNASSIGNED);
  const doneTasks = tasks.filter((t) => t.assignment === DONE);

  return (
    <div className={`min-h-screen font-mono transition-all duration-500 ${
      darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-900'
    }`}>
      {/* Animated background grid */}
      <div className={`fixed inset-0 overflow-hidden pointer-events-none ${darkMode ? 'opacity-10' : 'opacity-5'}`}>
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(${darkMode ? '#00ffe1' : '#8a2be2'} 1px, transparent 1px),
                          linear-gradient(90deg, ${darkMode ? '#00ffe1' : '#8a2be2'} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          backgroundPosition: '-1px -1px'
        }}></div>
      </div>

      {/* Cyberpunk scrollbar styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .cyber-scrollbar::-webkit-scrollbar {
          height: 10px;
          width: 10px;
        }

        .cyber-scrollbar::-webkit-scrollbar-track {
          background: ${darkMode ? 'rgba(0, 255, 225, 0.1)' : 'rgba(138, 43, 226, 0.1)'};
          border-radius: 5px;
        }

        .cyber-scrollbar::-webkit-scrollbar-thumb {
          background: ${darkMode ? 'rgba(0, 255, 225, 0.5)' : 'rgba(138, 43, 226, 0.5)'};
          border-radius: 5px;
          box-shadow: ${darkMode ? '0 0 5px #00ffe1, 0 0 8px #00ffe1' : '0 0 5px #8a2be2, 0 0 8px #8a2be2'};
        }

        .cyber-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${darkMode ? 'rgba(0, 255, 225, 0.8)' : 'rgba(138, 43, 226, 0.8)'};
        }

        .cyber-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: ${darkMode ? 'rgba(0, 255, 225, 0.5) rgba(0, 0, 0, 0.3)' : 'rgba(138, 43, 226, 0.5) rgba(255, 255, 255, 0.3)'};
        }

        @keyframes borderGlow {
          0% {
            box-shadow: 0 0 5px ${darkMode ? 'rgba(0, 255, 225, 0.3)' : 'rgba(138, 43, 226, 0.3)'};
          }
          50% {
            box-shadow: 0 0 15px ${darkMode ? 'rgba(0, 255, 225, 0.7)' : 'rgba(138, 43, 226, 0.7)'};
          }
          100% {
            box-shadow: 0 0 5px ${darkMode ? 'rgba(0, 255, 225, 0.3)' : 'rgba(138, 43, 226, 0.3)'};
          }
        }

        .scrolling-active .cyber-scrollbar::-webkit-scrollbar-thumb,
        .auto-scrolling .cyber-scrollbar::-webkit-scrollbar-thumb {
          animation: borderGlow 2s infinite;
        }

        .scroll-guide-left,
        .scroll-guide-right {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 150px;
          pointer-events: none;
          z-index: 20;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .scroll-guide-left {
          left: 0;
          background: linear-gradient(90deg,
            ${darkMode ? 'rgba(0, 255, 225, 0.2)' : 'rgba(138, 43, 226, 0.2)'} 0%,
            transparent 100%);
        }

        .scroll-guide-right {
          right: 0;
          background: linear-gradient(-90deg,
            ${darkMode ? 'rgba(0, 255, 225, 0.2)' : 'rgba(138, 43, 226, 0.2)'} 0%,
            transparent 100%);
        }

        .auto-scrolling .scroll-guide-left,
        .auto-scrolling .scroll-guide-right {
          opacity: 1;
        }
      ` }} />

      {/* Theme toggle button */}
      <button
        onClick={toggleDarkMode}
        className={`fixed top-6 right-6 p-3 rounded-full transition-all z-30 ${
          darkMode
            ? 'bg-gray-800 hover:bg-gray-700 text-yellow-300'
            : 'bg-gray-200 hover:bg-gray-300 text-indigo-600'
        }`}
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Header */}
      <header className={`p-4 md:p-6 transition-all duration-300 z-10 relative ${
        darkMode
          ? 'bg-gray-800/80 border-b border-cyan-800/50 shadow-lg shadow-cyan-900/20'
          : 'bg-white/80 backdrop-blur-sm border-b border-purple-200 shadow-lg shadow-purple-200/20'
      }`}>
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className={`text-2xl md:text-3xl font-bold mb-2 ${
                darkMode ? 'text-cyan-400' : 'text-purple-700'
              }`}>
                プロジェクト: <span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>{project.idea}</span>
              </h1>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                ID: {project.project_id} / 人数: {project.num_people}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
              {/* Enhanced Task Generation Button */}
              <button
                onClick={() => setIsGenerationPanelOpen(true)}
                className={`px-4 py-2 rounded-md flex items-center transition-all ${
                  darkMode
                    ? 'bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                }`}
              >
                <Sparkles size={16} className="mr-2" />
                AI拡張タスク生成
              </button>

              <button
                onClick={() => router.push(`/projects/${projectId}/ganttChart`)}
                className={`px-4 py-2 rounded-md flex items-center transition-all ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-cyan-400 border border-cyan-900'
                    : 'bg-gray-200 hover:bg-gray-300 text-purple-700 border border-purple-200'
                }`}
              >
                <CalendarCheck size={16} className="mr-2" />
                スケジュール
              </button>

              <button
                onClick={() => router.push(`/projects/${projectId}/directory`)}
                className={`px-4 py-2 rounded-md flex items-center transition-all ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-cyan-400 border border-cyan-900'
                    : 'bg-gray-200 hover:bg-gray-300 text-purple-700 border border-purple-200'
                }`}
              >
                <FolderTree size={16} className="mr-2" />
                ディレクトリ表示
              </button>

              <button
                onClick={() => router.push(`/projects/${projectId}/envHanson`)}
                className={`px-4 py-2 rounded-md flex items-center transition-all ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-cyan-400 border border-cyan-900'
                    : 'bg-gray-200 hover:bg-gray-300 text-purple-700 border border-purple-200'
                }`}
              >
                <Terminal size={16} className="mr-2" />
                環境構築
              </button>

              <button
                onClick={() => router.push(`/projects/${projectId}/specification`)}
                className={`px-4 py-2 rounded-md flex items-center transition-all ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-cyan-400 border border-cyan-900'
                    : 'bg-gray-200 hover:bg-gray-300 text-purple-700 border border-purple-200'
                }`}
              >
                <Info size={16} className="mr-2" />
                仕様書確認
              </button>

              <button
                onClick={() => router.push(`/projects/${projectId}/deploy`)}
                className={`px-4 py-2 rounded-md flex items-center transition-all ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-cyan-400 border border-cyan-900'
                    : 'bg-gray-200 hover:bg-gray-300 text-purple-700 border border-purple-200'
                }`}
              >
                <CloudUpload size={16} className="mr-2" />
                デプロイ
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Tasks Display Section */}
      {enhancedTasks.length > 0 && (
        <div className="container mx-auto px-4 py-6">
          <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-cyan-400' : 'text-blue-700'}`}>
            <Sparkles className="inline mr-2" />
            AI生成拡張タスク ({enhancedTasks.length}件)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {enhancedTasks.map((task, index) => (
              <EnhancedTaskCard
                key={index}
                task={task}
                isDarkMode={darkMode}
                onTaskClick={handleEnhancedTaskClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* DndProvider with auto-scroll functionality */}
      <DndProvider backend={HTML5Backend}>
        <KanbanBoardContent
          darkMode={darkMode}
          project={project}
          members={members}
          tasks={tasks}
          unassignedTasks={unassignedTasks}
          doneTasks={doneTasks}
          handleDropTask={handleDropTask}
          handleMemberNameChange={handleMemberNameChange}
          handleTaskDetail={handleTaskDetail}
          handleSaveMembers={handleSaveMembers}
          savingMembers={savingMembers}
        />
      </DndProvider>

      {/* Modals */}
      <TaskModal
        task={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        isDarkMode={darkMode}
      />

      <TaskGenerationPanel
        isOpen={isGenerationPanelOpen}
        onClose={() => setIsGenerationPanelOpen(false)}
        isDarkMode={darkMode}
        projectId={projectId}
        onTasksGenerated={handleTasksGenerated}
      />

      {/* Footer */}
      <footer className={`p-4 text-center ${darkMode ? 'text-gray-500' : 'text-gray-600'} text-xs relative z-10`}>
        <div className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
          <span className={darkMode ? 'text-cyan-400' : 'text-purple-600'}>CYBER</span>
          <span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>DREAM</span> v2.4.7 - Enhanced with AI
        </div>
      </footer>
    </div>
  );
}