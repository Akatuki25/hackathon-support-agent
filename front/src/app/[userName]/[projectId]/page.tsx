"use client";
import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Node, Edge } from '@xyflow/react';
import axios from 'axios';
import '@xyflow/react/dist/style.css';
import './cyber-flow.css';

import { TaskFlow } from './TaskFlow';
import { generateCompleteTaskSet } from '@/libs/service/completeTaskGenerationService';
import { useDarkMode } from '@/hooks/useDarkMode';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Backend Task and TaskDependency types
interface BackendTask {
  task_id: string;
  project_id: string;
  title: string;
  description?: string;
  detail?: string;
  priority?: string;
  status?: string;
  due_at?: string;
  node_id?: string;
  category?: string;
  start_time?: string;
  estimated_hours?: number;
  assignee?: string;
  completed?: boolean;
  position_x?: number;
  position_y?: number;
}

interface BackendTaskDependency {
  id: string;
  edge_id: string;
  source_task_id: string;
  target_task_id: string;
  source_node_id: string;
  target_node_id: string;
  is_animated: boolean;
  is_next_day: boolean;
}

export default function TaskVisualizationPage() {
  const pathname = usePathname();
  const { darkMode } = useDarkMode();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);

  // Extract projectId from pathname: /[userName]/[projectId]
  const projectId = pathname?.split('/')[2];

  const handleNodesChange = useCallback((updatedNodes: Node[]) => {
    setNodes(updatedNodes);
  }, []);

  const handleEdgesChange = useCallback((updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
  }, []);

  // Transform backend tasks to ReactFlow nodes
  const transformTasksToNodes = (tasks: BackendTask[]): Node[] => {
    return tasks.map(task => ({
      id: task.node_id || task.task_id,
      type: 'textUpdater',
      position: {
        x: task.position_x || 0,
        y: task.position_y || 0
      },
      data: {
        label: task.title,
        category: task.category || 'default',
        startTime: task.start_time || '',
        estimatedHours: task.estimated_hours || 0,
        completed: task.completed || false,
        assignee: task.assignee || ''
      }
    }));
  };

  // Transform backend dependencies to ReactFlow edges
  const transformDependenciesToEdges = (dependencies: BackendTaskDependency[]): Edge[] => {
    return dependencies.map(dep => ({
      id: dep.edge_id,
      source: dep.source_node_id,
      target: dep.target_node_id,
      type: 'custom-edge',
      data: {
        animated: dep.is_animated,
        isNextDay: dep.is_next_day
      }
    }));
  };

  // Load tasks and dependencies from backend
  const loadTaskData = async () => {
    if (!projectId) {
      setError('Project ID not found in URL');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch tasks
      const tasksResponse = await axios.get<BackendTask[]>(
        `${API_URL}/task/project/${projectId}`
      );

      // Fetch dependencies
      const dependenciesResponse = await axios.get<BackendTaskDependency[]>(
        `${API_URL}/api/task_dependencies/project/${projectId}`
      );

      const tasks = tasksResponse.data;
      const dependencies = dependenciesResponse.data;

      if (!tasks || tasks.length === 0) {
        // No tasks found - trigger generation
        await generateTasks();
        return;
      }

      // Transform and set data
      const transformedNodes = transformTasksToNodes(tasks);
      const transformedEdges = transformDependenciesToEdges(dependencies);

      setNodes(transformedNodes);
      setEdges(transformedEdges);
    } catch (err) {
      const error = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      if (error.response?.status === 404 || error.response?.data?.detail?.includes('not found')) {
        // No tasks found - trigger generation
        await generateTasks();
      } else {
        console.error('Error loading task data:', error);
        setError(
          `タスクデータの読み込みに失敗しました: ${error.response?.data?.detail || error.message}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Generate complete task set
  const generateTasks = async () => {
    if (!projectId) {
      setError('Project ID not found');
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const result = await generateCompleteTaskSet(projectId);

      if (result.success) {
        // Reload task data after successful generation
        await loadTaskData();
      } else {
        setError(`タスク生成に失敗しました: ${result.error || result.message}`);
      }
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      console.error('Error generating tasks:', error);
      setError(
        `タスク生成中にエラーが発生しました: ${error.response?.data?.detail || error.message}`
      );
    } finally {
      setGenerating(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (projectId) {
      loadTaskData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Render loading state - Cyber AI Agent Style
  if (loading || generating) {
    return (
      <main className={`relative z-10 flex items-center justify-center h-screen w-screen overflow-hidden ${
        darkMode
          ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900'
          : 'bg-gradient-to-br from-purple-50 via-white to-blue-50'
      }`}>
        {/* Background grid animation */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: darkMode
              ? `linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)`
              : `linear-gradient(rgba(147, 51, 234, 0.1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(147, 51, 234, 0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
            animation: 'gridScroll 20s linear infinite'
          }} />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-1 h-1 rounded-full ${
                darkMode
                  ? i % 3 === 0 ? 'bg-cyan-400' : i % 3 === 1 ? 'bg-purple-400' : 'bg-pink-400'
                  : i % 3 === 0 ? 'bg-purple-500' : i % 3 === 1 ? 'bg-blue-500' : 'bg-indigo-500'
              }`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
                opacity: 0.6
              }}
            />
          ))}
        </div>

        {/* Hexagonal pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hexagons" width="56" height="100" patternUnits="userSpaceOnUse">
                <polygon points="28,0 56,17 56,51 28,68 0,51 0,17"
                  fill="none"
                  stroke={darkMode ? '#00ffff' : '#9333ea'}
                  strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hexagons)" />
          </svg>
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center px-4">
          {/* AI Agent Icon */}
          <div className="mb-12 relative">
            <div className="w-40 h-40 mx-auto relative">
              {/* Outer rotating rings */}
              <div className={`absolute inset-0 border-4 rounded-full opacity-20 animate-spin-slow ${
                darkMode ? 'border-cyan-500' : 'border-purple-500'
              }`} />
              <div className={`absolute inset-2 border-4 rounded-full opacity-30 animate-spin-reverse ${
                darkMode ? 'border-purple-500' : 'border-blue-500'
              }`} />
              <div className={`absolute inset-4 border-4 rounded-full opacity-40 animate-pulse ${
                darkMode ? 'border-cyan-400' : 'border-purple-400'
              }`} />
              <div className={`absolute inset-6 border-2 rounded-full opacity-50 animate-spin-slow ${
                darkMode ? 'border-pink-400' : 'border-indigo-400'
              }`} style={{ animationDuration: '5s' }} />

              {/* Center core */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-20 h-20 rounded-full animate-pulse-glow relative ${
                  darkMode
                    ? 'bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-600'
                    : 'bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-600'
                }`}>
                  {/* AI symbol with glow */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <div className={`absolute inset-0 blur-md ${
                        darkMode ? 'text-cyan-300' : 'text-purple-300'
                      } font-bold text-3xl flex items-center justify-center`}>
                        AI
                      </div>
                      <div className="relative text-white font-bold text-3xl">
                        AI
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orbiting dots */}
              <div className="absolute inset-0">
                <div className={`absolute top-0 left-1/2 w-3 h-3 rounded-full -ml-1.5 animate-orbit-1 ${
                  darkMode ? 'bg-cyan-400' : 'bg-purple-500'
                }`} />
                <div className={`absolute top-0 left-1/2 w-3 h-3 rounded-full -ml-1.5 animate-orbit-2 ${
                  darkMode ? 'bg-purple-400' : 'bg-blue-500'
                }`} />
                <div className={`absolute top-0 left-1/2 w-3 h-3 rounded-full -ml-1.5 animate-orbit-3 ${
                  darkMode ? 'bg-pink-400' : 'bg-indigo-500'
                }`} />
                <div className={`absolute top-0 left-1/2 w-2 h-2 rounded-full -ml-1 animate-orbit-4 ${
                  darkMode ? 'bg-cyan-300' : 'bg-purple-400'
                }`} />
              </div>

              {/* Data stream lines */}
              <div className="absolute inset-0">
                {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2 w-1 h-16 origin-bottom"
                    style={{
                      transform: `rotate(${angle}deg) translateY(-80px)`,
                      animation: `dataStream ${2 + (i * 0.2)}s ease-in-out infinite`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  >
                    <div className={`w-full h-full ${
                      darkMode
                        ? 'bg-gradient-to-t from-cyan-400 to-transparent'
                        : 'bg-gradient-to-t from-purple-500 to-transparent'
                    } opacity-30`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status text */}
          <div className="space-y-6">
            <h2 className={`text-4xl font-bold bg-clip-text text-transparent animate-gradient-x ${
              darkMode
                ? 'bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400'
                : 'bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600'
            }`} style={{ backgroundSize: '200% auto' }}>
              {generating ? 'AI AGENT PROCESSING' : 'INITIALIZING SYSTEM'}
            </h2>

            <div className={`text-sm font-mono space-y-3 ${
              darkMode ? 'text-cyan-300' : 'text-purple-600'
            }`}>
              <div className="animate-pulse-text flex items-center justify-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  darkMode ? 'bg-cyan-400' : 'bg-purple-500'
                } animate-ping`} />
                <span>{generating ? '> Analyzing project structure and dependencies...' : '> Connecting to neural network...'}</span>
              </div>
              <div className="animate-pulse-text flex items-center justify-center gap-2" style={{ animationDelay: '0.3s' }}>
                <span className={`inline-block w-2 h-2 rounded-full ${
                  darkMode ? 'bg-purple-400' : 'bg-blue-500'
                } animate-ping`} style={{ animationDelay: '0.3s' }} />
                <span>{generating ? '> Generating optimized task breakdown...' : '> Loading task database...'}</span>
              </div>
              <div className="animate-pulse-text flex items-center justify-center gap-2" style={{ animationDelay: '0.6s' }}>
                <span className={`inline-block w-2 h-2 rounded-full ${
                  darkMode ? 'bg-pink-400' : 'bg-indigo-500'
                } animate-ping`} style={{ animationDelay: '0.6s' }} />
                <span>{generating ? '> Building intelligent workflow graph...' : '> Preparing visualization matrix...'}</span>
              </div>
              <div className="animate-pulse-text flex items-center justify-center gap-2" style={{ animationDelay: '0.9s' }}>
                <span className={`inline-block w-2 h-2 rounded-full ${
                  darkMode ? 'bg-cyan-300' : 'bg-purple-400'
                } animate-ping`} style={{ animationDelay: '0.9s' }} />
                <span>{generating ? '> Calculating task dependencies and timelines...' : '> Synchronizing data streams...'}</span>
              </div>
            </div>

            {/* Enhanced Progress bar with percentage */}
            <div className="mt-8 w-96 max-w-full mx-auto space-y-2">
              <div className={`h-2 rounded-full overflow-hidden relative ${
                darkMode ? 'bg-gray-800' : 'bg-purple-100'
              }`}>
                <div className={`h-full rounded-full animate-progress relative ${
                  darkMode
                    ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500'
                    : 'bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500'
                }`}>
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
                </div>
              </div>
              {/* Status indicators */}
              <div className="flex justify-between text-xs font-mono">
                <span className={darkMode ? 'text-cyan-400' : 'text-purple-600'}>PROCESSING...</span>
                <span className={darkMode ? 'text-purple-400' : 'text-blue-600'}>AI ACTIVE</span>
              </div>
            </div>

            {/* Binary code rain effect - enhanced */}
            <div className={`text-xs font-mono opacity-30 mt-6 overflow-hidden h-12 ${
              darkMode ? 'text-cyan-500' : 'text-purple-500'
            }`}>
              <div className="animate-scroll-up space-y-1">
                <div>01001000 01100001 01100011 01101011</div>
                <div>01010011 01110101 01110000 01110000</div>
                <div>01000001 01100111 01100101 01101110</div>
              </div>
            </div>
          </div>
        </div>

        {/* Corner accents with animation */}
        <div className={`absolute top-0 left-0 w-40 h-40 border-t-2 border-l-2 opacity-50 animate-corner-fade ${
          darkMode ? 'border-cyan-500' : 'border-purple-500'
        }`} />
        <div className={`absolute top-0 right-0 w-40 h-40 border-t-2 border-r-2 opacity-50 animate-corner-fade ${
          darkMode ? 'border-purple-500' : 'border-blue-500'
        }`} style={{ animationDelay: '0.2s' }} />
        <div className={`absolute bottom-0 left-0 w-40 h-40 border-b-2 border-l-2 opacity-50 animate-corner-fade ${
          darkMode ? 'border-purple-500' : 'border-blue-500'
        }`} style={{ animationDelay: '0.4s' }} />
        <div className={`absolute bottom-0 right-0 w-40 h-40 border-b-2 border-r-2 opacity-50 animate-corner-fade ${
          darkMode ? 'border-cyan-500' : 'border-purple-500'
        }`} style={{ animationDelay: '0.6s' }} />

        <style jsx>{`
          @keyframes gridScroll {
            0% { transform: translateY(0); }
            100% { transform: translateY(50px); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px) translateX(0px); }
            50% { transform: translateY(-20px) translateX(10px); }
          }
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes spin-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes pulse-glow {
            0%, 100% {
              box-shadow: ${darkMode
                ? '0 0 30px rgba(34, 211, 238, 0.6), 0 0 60px rgba(168, 85, 247, 0.4)'
                : '0 0 30px rgba(147, 51, 234, 0.6), 0 0 60px rgba(59, 130, 246, 0.4)'};
            }
            50% {
              box-shadow: ${darkMode
                ? '0 0 50px rgba(168, 85, 247, 0.8), 0 0 80px rgba(236, 72, 153, 0.6)'
                : '0 0 50px rgba(59, 130, 246, 0.8), 0 0 80px rgba(99, 102, 241, 0.6)'};
            }
          }
          @keyframes orbit-1 {
            from { transform: rotate(0deg) translateX(80px) rotate(0deg); }
            to { transform: rotate(360deg) translateX(80px) rotate(-360deg); }
          }
          @keyframes orbit-2 {
            from { transform: rotate(120deg) translateX(80px) rotate(-120deg); }
            to { transform: rotate(480deg) translateX(80px) rotate(-480deg); }
          }
          @keyframes orbit-3 {
            from { transform: rotate(240deg) translateX(80px) rotate(-240deg); }
            to { transform: rotate(600deg) translateX(80px) rotate(-600deg); }
          }
          @keyframes orbit-4 {
            from { transform: rotate(180deg) translateX(90px) rotate(-180deg); }
            to { transform: rotate(540deg) translateX(90px) rotate(-540deg); }
          }
          @keyframes gradient-x {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes pulse-text {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          @keyframes progress {
            0% { width: 0%; }
            100% { width: 100%; }
          }
          @keyframes scroll-up {
            0% { transform: translateY(0); }
            100% { transform: translateY(-100%); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
          @keyframes dataStream {
            0%, 100% { opacity: 0; transform: scaleY(0); }
            50% { opacity: 1; transform: scaleY(1); }
          }
          @keyframes corner-fade {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.7; }
          }
          .animate-spin-slow {
            animation: spin-slow 3s linear infinite;
          }
          .animate-spin-reverse {
            animation: spin-reverse 4s linear infinite;
          }
          .animate-pulse-glow {
            animation: pulse-glow 2s ease-in-out infinite;
          }
          .animate-orbit-1 {
            animation: orbit-1 3s linear infinite;
          }
          .animate-orbit-2 {
            animation: orbit-2 3.5s linear infinite;
          }
          .animate-orbit-3 {
            animation: orbit-3 4s linear infinite;
          }
          .animate-orbit-4 {
            animation: orbit-4 2.5s linear infinite;
          }
          .animate-gradient-x {
            background-size: 200% auto;
            animation: gradient-x 3s ease infinite;
          }
          .animate-pulse-text {
            animation: pulse-text 2s ease-in-out infinite;
          }
          .animate-progress {
            animation: progress 2.5s ease-in-out infinite;
          }
          .animate-scroll-up {
            animation: scroll-up 4s linear infinite;
          }
          .animate-shimmer {
            animation: shimmer 2s infinite;
          }
          .animate-corner-fade {
            animation: corner-fade 3s ease-in-out infinite;
          }
        `}</style>
      </main>
    );
  }

  // Render error state
  if (error) {
    return (
      <main className="relative z-10 flex items-center justify-center h-screen w-screen">
        <div className="text-center max-w-2xl px-4">
          <div className="text-2xl font-bold mb-4 text-red-600">エラー</div>
          <div className="text-sm text-gray-700 mb-6 whitespace-pre-line">{error}</div>
          <button
            onClick={loadTaskData}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            再試行
          </button>
        </div>
      </main>
    );
  }

  // Render empty state
  if (nodes.length === 0) {
    return (
      <main className="relative z-10 flex items-center justify-center h-screen w-screen">
        <div className="text-center">
          <div className="text-2xl font-bold mb-4">タスクが見つかりません</div>
          <div className="text-sm text-gray-600 mb-6">
            プロジェクトにタスクが存在しないか、まだ生成されていません。
          </div>
          <button
            onClick={generateTasks}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            タスクを生成
          </button>
        </div>
      </main>
    );
  }

  // Render TaskFlow
  return (
    <>
      <main className="relative z-10">
        <div className="h-screen w-screen relative overflow-hidden">
          <TaskFlow
            initialNodes={nodes}
            initialEdges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
          />
        </div>
      </main>
    </>
  );
}