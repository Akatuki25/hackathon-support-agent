"use client";
import Header from '@/components/Session/Header';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useState, useCallback } from 'react';
import { ReactFlow, Controls, applyEdgeChanges, applyNodeChanges, NodeChange, EdgeChange, addEdge, MiniMap, Panel, Node, Edge, Background } from '@xyflow/react';
import { Plus, Cpu, Database, Network, Zap, Trash2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './cyber-flow.css';

import { TextUpdaterNode } from './CustomNode';
import { CustomEdge } from './CustomEdge';

const initialNodes: Node[] = [
  {
    id: 'n1',
    type: 'textUpdater',
    position: { x: 100, y: 100 },
    data: {
      label: 'API設計とスキーマ定義',
      dueDate: '2025-01-15',
      completed: false
    },
  },
  {
    id: 'n2',
    type: 'textUpdater',
    position: { x: 300, y: 200 },
    data: {
      label: 'データベース設計',
      dueDate: '2025-01-10',
      completed: true
    },
  },
  {
    id: 'n3',
    type: 'textUpdater',
    position: { x: 500, y: 100 },
    data: {
      label: 'フロントエンド実装',
      dueDate: '2025-01-20',
      completed: false
    },
  }
];

const initialEdges: Edge[] = [
  {
    id: 'n1-n2',
    source: 'n1',
    target: 'n2',
    type: 'custom-edge',
    data: { label: 'Data Flow', animated: true, glowColor: 'cyan' }
  },
  {
    id: 'n2-n3',
    source: 'n2',
    target: 'n3',
    type: 'custom-edge',
    data: { label: 'Network', animated: true, glowColor: 'purple' }
  },
];

const nodeTypes = {
  textUpdater: TextUpdaterNode,
};

const edgeTypes = {
  'custom-edge': CustomEdge,
};

const nodeTypeOptions = [
  { type: 'default', label: 'Default', icon: Zap },
  { type: 'processor', label: 'Processor', icon: Cpu },
  { type: 'database', label: 'Database', icon: Database },
  { type: 'network', label: 'Network', icon: Network },
];

export default function TestPage() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeType, setSelectedNodeType] = useState('default');
  const { darkMode } = useDarkMode();

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );

  const onConnect = useCallback(
    (params: any) => setEdges((edgesSnapshot) => addEdge({
      ...params,
      type: 'custom-edge',
      data: { animated: true, glowColor: darkMode ? 'cyan' : 'purple' }
    }, edgesSnapshot)),
    [darkMode],
  );

  const addNode = useCallback(() => {
    const newId = `node_${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: 'textUpdater',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100
      },
      data: {
        label: `New ${selectedNodeType} Node`,
        type: selectedNodeType
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [selectedNodeType]);

  const deleteSelectedNodes = useCallback(() => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
  }, []);

  const clearAll = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      <main className="relative z-10">
        <div className="h-screen w-screen relative overflow-hidden">

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        fitView
        colorMode="dark"
        className="cyber-flow"
        style={{
          background: 'transparent',
        }}
      >

        {/* Stats panel */}
        <Panel position="top-right" className="space-y-2">
          <div className={`backdrop-blur-lg rounded-xl p-4 shadow-xl border transition-all ${
            darkMode
              ? "bg-gray-800 bg-opacity-70 border-purple-500/30 shadow-purple-500/20"
              : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
          }`}>
            <h3 className={`font-semibold mb-2 text-sm ${
              darkMode ? "text-purple-400" : "text-purple-700"
            }`}>Network Stats</h3>
            <div className="space-y-1 text-xs">
              <div className={`flex justify-between ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                <span>Nodes:</span>
                <span className={`font-mono ${
                  darkMode ? "text-cyan-400" : "text-cyan-600"
                }`}>{nodes.length}</span>
              </div>
              <div className={`flex justify-between ${
                darkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                <span>Connections:</span>
                <span className={`font-mono ${
                  darkMode ? "text-purple-400" : "text-purple-600"
                }`}>{edges.length}</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* Clear all button */}
        <Panel position="bottom-left">
          <button
            onClick={clearAll}
            className="
              px-4 py-2 bg-red-500/20 hover:bg-red-500/30
              border border-red-400/50 text-red-300 text-sm rounded-lg
              transition-all hover:shadow-lg hover:shadow-red-500/20
            "
          >
            Clear All
          </button>
        </Panel>

        {/* Themed MiniMap */}
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className={darkMode ? "!bg-gray-900/50 !border-cyan-400/30 !rounded-lg" : "!bg-white/50 !border-purple-400/30 !rounded-lg"}
          style={{
            backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            border: darkMode ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(147, 51, 234, 0.3)',
          }}
          nodeColor={(node) => {
            const nodeData = node.data as any;
            switch (nodeData?.type) {
              case 'processor': return darkMode ? '#06b6d4' : '#3b82f6';
              case 'database': return darkMode ? '#10b981' : '#059669';
              case 'network': return darkMode ? '#8b5cf6' : '#7c3aed';
              default: return darkMode ? '#06b6d4' : '#3b82f6';
            }
          }}
        />

        {/* Themed Controls */}
        <Controls
          className={darkMode ? "!bg-gray-900/50 !border-cyan-400/30 !rounded-lg" : "!bg-white/50 !border-purple-400/30 !rounded-lg"}
          style={{
            backgroundColor: darkMode ? 'rgba(17, 24, 39, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            border: darkMode ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(147, 51, 234, 0.3)',
          }}
        />
      </ReactFlow>
        </div>
      </main>
    </>
  );
}