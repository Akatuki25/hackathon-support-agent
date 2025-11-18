"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlow, Controls, applyEdgeChanges, applyNodeChanges, NodeChange, EdgeChange, addEdge, MiniMap, Panel, Node, Edge, useNodesState, useEdgesState, Connection } from '@xyflow/react';
import { Clock, Timer, Play, Pause, RotateCcw, Keyboard, Info, LayoutGrid, FileText, BookOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import '@xyflow/react/dist/style.css';

import { TextUpdaterNode } from './CustomNode';
import { CustomEdge } from './CustomEdge';

interface TaskFlowProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

const nodeTypes = {
  textUpdater: TextUpdaterNode,
};

const edgeTypes = {
  'custom-edge': CustomEdge,
};

// Time calculation utilities
const parseTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Removed unused function addMinutesToTime

export function TaskFlow({ initialNodes, initialEdges, onNodesChange, onEdgesChange }: TaskFlowProps) {
  const pathname = usePathname();
  const [nodes, setNodes, onNodesStateChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesStateChange] = useEdgesState(initialEdges);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [projectStartTime, setProjectStartTime] = useState('09:00');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Auto-calculate task times based on dependencies
  const calculateTaskTimes = useCallback(() => {
    const nodeMap = new Map(nodes.map(node => [node.id, { ...node }]));
    const edgeMap = new Map<string, string[]>();

    // Build dependency graph
    edges.forEach(edge => {
      if (!edgeMap.has(edge.target)) {
        edgeMap.set(edge.target, []);
      }
      edgeMap.get(edge.target)!.push(edge.source);
    });

    // Topological sort to process nodes in dependency order
    const visited = new Set<string>();
    const processing = new Set<string>();
    const processedOrder: string[] = [];

    const dfs = (nodeId: string) => {
      if (processing.has(nodeId)) return; // Cycle detected
      if (visited.has(nodeId)) return;

      processing.add(nodeId);
      const dependencies = edgeMap.get(nodeId) || [];
      dependencies.forEach(depId => dfs(depId));
      processing.delete(nodeId);
      visited.add(nodeId);
      processedOrder.push(nodeId);
    };

    nodes.forEach(node => dfs(node.id));

    let hasChanges = false;

    // Calculate start times
    processedOrder.forEach(nodeId => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

      const dependencies = edgeMap.get(nodeId) || [];
      let newStartTime = node.data?.startTime;

      if (dependencies.length === 0) {
        // Start node - use project start time
        if (node.id === 'start') {
          newStartTime = projectStartTime;
        }
      } else {
        // Calculate based on latest dependency completion
        let latestEndTime = 0;
        dependencies.forEach(depId => {
          const depNode = nodeMap.get(depId);
          if (depNode?.data?.startTime && typeof depNode.data.estimatedHours === 'number') {
            const depStartMinutes = parseTime(depNode.data.startTime as string);
            const depDurationMinutes = (depNode.data.estimatedHours as number) * 60;
            const depEndMinutes = depStartMinutes + depDurationMinutes;
            latestEndTime = Math.max(latestEndTime, depEndMinutes);
          }
        });

        // Check if it goes to next day (after 24:00)
        if (latestEndTime >= 24 * 60) {
          // Next day - start at 9:00 AM
          latestEndTime = 9 * 60; // 9:00 AM next day
        }

        newStartTime = formatTime(latestEndTime);
      }

      // Only update if time has changed
      if (node.data?.startTime !== newStartTime) {
        node.data = { ...node.data, startTime: newStartTime };
        hasChanges = true;
      }
    });

    // Only update nodes if there are actual changes
    if (hasChanges) {
      const updatedNodes = Array.from(nodeMap.values());
      setNodes(updatedNodes);
      onNodesChange?.(updatedNodes);
    }
  }, [projectStartTime, setNodes, onNodesChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalculate when project start time changes
  useEffect(() => {
    calculateTaskTimes();
  }, [calculateTaskTimes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 's':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            calculateTaskTimes();
          }
          break;
        case ' ':
          event.preventDefault();
          setIsTimerRunning(!isTimerRunning);
          break;
        case 'r':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setIsTimerRunning(false);
            setCurrentTime(new Date());
          }
          break;
        case '?':
        case 'h':
          setShowKeyboardHelp(!showKeyboardHelp);
          break;
        case 'escape':
          setShowKeyboardHelp(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTimerRunning, showKeyboardHelp, calculateTaskTimes]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        type: 'custom-edge',
        data: { animated: true, isNextDay: false }
      };
      const updatedEdges = addEdge(newEdge, edges);
      setEdges(updatedEdges);
      onEdgesChange?.(updatedEdges);
    },
    [edges, setEdges, onEdgesChange],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      onNodesStateChange(changes);
      const updatedNodes = applyNodeChanges(changes, nodes);
      onNodesChange?.(updatedNodes);
    },
    [onNodesStateChange, nodes, onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      onEdgesStateChange(changes);
      const updatedEdges = applyEdgeChanges(changes, edges);
      onEdgesChange?.(updatedEdges);
    },
    [onEdgesStateChange, edges, onEdgesChange],
  );

  // Calculate project stats
  const completedTasks = nodes.filter(node => node.data?.completed).length;
  const totalTasks = nodes.length;
  const totalEstimatedHours = nodes.reduce((sum, node) => sum + (typeof node.data?.estimatedHours === 'number' ? node.data.estimatedHours : 0), 0);
  const completedHours = nodes
    .filter(node => node.data?.completed)
    .reduce((sum, node) => sum + (typeof node.data?.estimatedHours === 'number' ? node.data.estimatedHours : 0), 0);

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        fitView
        colorMode="dark"
        className="cyber-flow"
        style={{ background: 'transparent' }}
      >

        {/* Enhanced Project Stats Panel */}
        <Panel position="top-right" className="space-y-3">
          <div className="backdrop-blur-xl rounded-2xl p-5 shadow-2xl border-2 bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-purple-500/40 hover:border-purple-400/60 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 animate-pulse"></div>
              <h3 className="font-bold text-lg bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                📊 プロジェクト進捗
              </h3>
            </div>

            <div className="space-y-4">
              {/* Task Progress */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-gray-900/60 to-black/40 border border-cyan-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">✅ 完了タスク</span>
                  <span className="font-mono font-bold text-lg bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                    {completedTasks}/{totalTasks}
                  </span>
                </div>
                <div className="w-full bg-gray-700/60 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-3 rounded-full transition-all duration-500 shadow-lg shadow-cyan-500/30"
                    style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-center">
                  {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% 完了
                </div>
              </div>

              {/* Time Progress */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-gray-900/60 to-black/40 border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">⏱️ 作業時間</span>
                  <span className="font-mono font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {completedHours}h/{totalEstimatedHours}h
                  </span>
                </div>
                <div className="w-full bg-gray-700/60 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-400 to-pink-400 h-3 rounded-full transition-all duration-500 shadow-lg shadow-purple-500/30"
                    style={{ width: `${totalEstimatedHours > 0 ? (completedHours / totalEstimatedHours) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-center">
                  {totalEstimatedHours > 0 ? Math.round((completedHours / totalEstimatedHours) * 100) : 0}% 完了
                </div>
              </div>

              {/* Overall Progress */}
              <div className="text-center p-2 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                <div className="text-xs text-gray-400 mb-1">総合進捗</div>
                <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                  {totalTasks > 0 && totalEstimatedHours > 0 ? Math.round(((completedTasks / totalTasks) + (completedHours / totalEstimatedHours)) / 2 * 100) : 0}%
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* Kanban Board Navigation Button */}
        <Panel position="bottom-left" className="space-y-2">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                const userName = pathname?.split('/')[1];
                const projectId = pathname?.split('/')[2];
                window.location.href = `/${userName}/${projectId}/kanban`;
              }}
              className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-cyan-500/30 to-purple-500/30 hover:from-cyan-400/40 hover:to-purple-400/40 border-2 border-cyan-400/60 text-cyan-300 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105 active:scale-95 backdrop-blur-sm"
            >
              <LayoutGrid size={18} />
              📋 カンバンボード
            </button>
            <button
              onClick={calculateTaskTimes}
              className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-500/30 to-indigo-500/30 hover:from-blue-400/40 hover:to-indigo-400/40 border-2 border-blue-400/60 text-blue-300 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-95 backdrop-blur-sm"
            >
              <Clock size={18} className="animate-spin" />
              ⚡ 時間再計算
            </button>

            <button
              onClick={() => {
                // Add gantt chart view toggle functionality
                console.log('Gantt chart view toggle');
              }}
              className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-emerald-500/30 to-teal-500/30 hover:from-emerald-400/40 hover:to-teal-400/40 border-2 border-emerald-400/60 text-emerald-300 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-105 active:scale-95 backdrop-blur-sm"
            >
              <Timer size={18} />
              📊 ガントビュー
            </button>

            <button
              onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
              className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-violet-500/30 to-purple-500/30 hover:from-violet-400/40 hover:to-purple-400/40 border-2 border-violet-400/60 text-violet-300 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30 hover:scale-105 active:scale-95 backdrop-blur-sm"
            >
              <Keyboard size={18} />
              ⌨️ ショートカット
            </button>

            <button
              onClick={() => {
                const userName = pathname?.split('/')[1];
                const projectId = pathname?.split('/')[2];
                window.location.href = `/${userName}/${projectId}/specification`;
              }}
              className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-pink-500/30 to-rose-500/30 hover:from-pink-400/40 hover:to-rose-400/40 border-2 border-pink-400/60 text-pink-300 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/30 hover:scale-105 active:scale-95 backdrop-blur-sm"
            >
              <FileText size={18} />
              📄 仕様書
            </button>

            <button
              onClick={() => {
                const userName = pathname?.split('/')[1];
                const projectId = pathname?.split('/')[2];
                window.location.href = `/${userName}/${projectId}/function-requirements`;
              }}
              className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 hover:from-amber-400/40 hover:to-yellow-400/40 border-2 border-amber-400/60 text-amber-300 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/30 hover:scale-105 active:scale-95 backdrop-blur-sm"
            >
              <BookOpen size={18} />
              📋 機能要件定義書
            </button>
          </div>
        </Panel>

        {/* Keyboard Help Modal */}
        {showKeyboardHelp && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
            <div className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-6 border-2 border-purple-500/40 shadow-2xl max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <Keyboard className="text-purple-400" size={24} />
                <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  キーボードショートカット
                </h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-800/50">
                  <span className="text-gray-300">タイマー スタート/ポーズ</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-cyan-300 font-mono">スペース</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-800/50">
                  <span className="text-gray-300">時間再計算</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-cyan-300 font-mono">Ctrl+S</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-800/50">
                  <span className="text-gray-300">タイマーリセット</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-cyan-300 font-mono">Ctrl+R</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-800/50">
                  <span className="text-gray-300">ヘルプ表示</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-cyan-300 font-mono">H または ?</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-800/50">
                  <span className="text-gray-300">ヘルプを閉じる</span>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-cyan-300 font-mono">ESC</kbd>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Info size={14} />
                  <span>ノードをクリックして編集、エッジをドラッグで接続</span>
                </div>
              </div>

              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="mt-4 w-full px-4 py-2 bg-gradient-to-r from-purple-500/30 to-cyan-500/30 hover:from-purple-400/40 hover:to-cyan-400/40 border border-purple-400/50 text-purple-300 rounded-lg transition-all duration-300"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* Themed Controls */}
        <Controls className="!bg-gray-900/50 !border-cyan-400/30 !rounded-lg" />

        {/* Themed MiniMap */}
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-gray-900/50 !border-cyan-400/30 !rounded-lg"
          nodeColor={(node) => {
            const category = node.data?.category;
            switch (category) {
              case '環境構築': return '#6b7280';
              case 'フロントエンド': return '#06b6d4';
              case 'バックエンド': return '#3b82f6';
              case 'DB設計': return '#14b8a6';
              case 'AI設計': return '#8b5cf6';
              case 'デプロイ': return '#f59e0b';
              case 'スライド資料作成': return '#10b981';
              default: return '#06b6d4';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}