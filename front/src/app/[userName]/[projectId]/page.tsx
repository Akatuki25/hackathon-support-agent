"use client";
import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Node, Edge } from '@xyflow/react';
import axios from 'axios';
import '@xyflow/react/dist/style.css';
import './cyber-flow.css';

import { TaskFlow } from './TaskFlow';
import { generateCompleteTaskSet } from '@/libs/service/completeTaskGenerationService';

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
      <main className="relative z-10 flex items-center justify-center h-screen w-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden">
        {/* Background grid animation */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'gridScroll 20s linear infinite'
          }} />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full"
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

        {/* Main content */}
        <div className="relative z-10 text-center">
          {/* AI Agent Icon */}
          <div className="mb-8 relative">
            <div className="w-32 h-32 mx-auto relative">
              {/* Outer rotating ring */}
              <div className="absolute inset-0 border-4 border-cyan-500 rounded-full opacity-20 animate-spin-slow" />
              <div className="absolute inset-2 border-4 border-purple-500 rounded-full opacity-30 animate-spin-reverse" />
              <div className="absolute inset-4 border-4 border-cyan-400 rounded-full opacity-40 animate-pulse" />

              {/* Center core */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-full animate-pulse-glow relative">
                  {/* AI symbol */}
                  <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl">
                    AI
                  </div>
                </div>
              </div>

              {/* Orbiting dots */}
              <div className="absolute inset-0">
                <div className="absolute top-0 left-1/2 w-3 h-3 bg-cyan-400 rounded-full -ml-1.5 animate-orbit-1" />
                <div className="absolute top-0 left-1/2 w-3 h-3 bg-purple-400 rounded-full -ml-1.5 animate-orbit-2" />
                <div className="absolute top-0 left-1/2 w-3 h-3 bg-blue-400 rounded-full -ml-1.5 animate-orbit-3" />
              </div>
            </div>
          </div>

          {/* Status text */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
              {generating ? 'AI AGENT PROCESSING' : 'INITIALIZING SYSTEM'}
            </h2>

            <div className="text-cyan-300 text-sm font-mono space-y-2">
              <div className="animate-pulse-text">
                {generating ? '> Analyzing functions and dependencies...' : '> Loading task data...'}
              </div>
              <div className="animate-pulse-text" style={{ animationDelay: '0.5s' }}>
                {generating ? '> Generating task structure...' : '> Connecting to database...'}
              </div>
              <div className="animate-pulse-text" style={{ animationDelay: '1s' }}>
                {generating ? '> Optimizing workflow graph...' : '> Preparing visualization...'}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6 w-64 mx-auto">
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full animate-progress" />
              </div>
            </div>

            {/* Binary code rain effect */}
            <div className="text-cyan-500 text-xs font-mono opacity-30 mt-4 overflow-hidden h-8">
              <div className="animate-scroll-up">
                01001001 01101110 01101001 01110100
              </div>
            </div>
          </div>
        </div>

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-cyan-500 opacity-50" />
        <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-purple-500 opacity-50" />
        <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-purple-500 opacity-50" />
        <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-cyan-500 opacity-50" />

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
            0%, 100% { box-shadow: 0 0 20px rgba(34, 211, 238, 0.5); }
            50% { box-shadow: 0 0 40px rgba(168, 85, 247, 0.8); }
          }
          @keyframes orbit-1 {
            from { transform: rotate(0deg) translateX(64px) rotate(0deg); }
            to { transform: rotate(360deg) translateX(64px) rotate(-360deg); }
          }
          @keyframes orbit-2 {
            from { transform: rotate(120deg) translateX(64px) rotate(-120deg); }
            to { transform: rotate(480deg) translateX(64px) rotate(-480deg); }
          }
          @keyframes orbit-3 {
            from { transform: rotate(240deg) translateX(64px) rotate(-240deg); }
            to { transform: rotate(600deg) translateX(64px) rotate(-600deg); }
          }
          @keyframes gradient-x {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes pulse-text {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes progress {
            0% { width: 0%; }
            100% { width: 100%; }
          }
          @keyframes scroll-up {
            0% { transform: translateY(0); }
            100% { transform: translateY(-100%); }
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
            animation: orbit-2 3s linear infinite;
          }
          .animate-orbit-3 {
            animation: orbit-3 3s linear infinite;
          }
          .animate-gradient-x {
            background-size: 200% auto;
            animation: gradient-x 3s ease infinite;
          }
          .animate-pulse-text {
            animation: pulse-text 2s ease-in-out infinite;
          }
          .animate-progress {
            animation: progress 2s ease-in-out infinite;
          }
          .animate-scroll-up {
            animation: scroll-up 3s linear infinite;
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