"use client";
import Header from '@/components/Session/Header';
import { useState, useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './cyber-flow.css';

import { TaskFlow } from './TaskFlow';


const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'textUpdater',
    position: { x: 50, y: 300 },
    data: {
      label: 'プロジェクト開始',
      category: 'default',
      startTime: '09:00',
      estimatedHours: 0,
      completed: false,
      assignee: 'チーム全体'
    },
  },
  {
    id: 'n1',
    type: 'textUpdater',
    position: { x: 300, y: 100 },
    data: {
      label: '環境構築とセットアップ',
      category: '環境構築',
      startTime: '09:00',
      estimatedHours: 2,
      completed: false,
      assignee: 'エンジニア'
    },
  },
  {
    id: 'n2',
    type: 'textUpdater',
    position: { x: 550, y: 200 },
    data: {
      label: 'データベース設計',
      category: 'DB設計',
      startTime: '11:00',
      estimatedHours: 3,
      completed: false,
      assignee: 'バックエンド担当'
    },
  },
  {
    id: 'n3',
    type: 'textUpdater',
    position: { x: 800, y: 100 },
    data: {
      label: 'API設計とスキーマ定義',
      category: 'バックエンド',
      startTime: '14:00',
      estimatedHours: 4,
      completed: false,
      assignee: 'バックエンド担当'
    },
  },
  {
    id: 'n4',
    type: 'textUpdater',
    position: { x: 800, y: 300 },
    data: {
      label: 'フロントエンド実装',
      category: 'フロントエンド',
      startTime: '14:00',
      estimatedHours: 6,
      completed: false,
      assignee: 'フロントエンド担当'
    },
  },
  {
    id: 'n5',
    type: 'textUpdater',
    position: { x: 1050, y: 200 },
    data: {
      label: 'AI機能実装',
      category: 'AI設計',
      startTime: '18:00',
      estimatedHours: 4,
      completed: false,
      assignee: 'AI担当'
    },
  },
  {
    id: 'n6',
    type: 'textUpdater',
    position: { x: 1300, y: 100 },
    data: {
      label: 'デプロイとテスト',
      category: 'デプロイ',
      startTime: '22:00',
      estimatedHours: 2,
      completed: false,
      assignee: 'DevOps担当'
    },
  },
  {
    id: 'n7',
    type: 'textUpdater',
    position: { x: 1300, y: 300 },
    data: {
      label: 'プレゼン資料作成',
      category: 'スライド資料作成',
      startTime: '22:00',
      estimatedHours: 3,
      completed: false,
      assignee: 'デザイナー'
    },
  }
];

const initialEdges: Edge[] = [
  {
    id: 'start-n1',
    source: 'start',
    target: 'n1',
    type: 'custom-edge',
    data: { animated: true, isNextDay: false }
  },
  {
    id: 'n1-n2',
    source: 'n1',
    target: 'n2',
    type: 'custom-edge',
    data: { animated: true, isNextDay: false }
  },
  {
    id: 'n1-n4',
    source: 'n1',
    target: 'n4',
    type: 'custom-edge',
    data: { animated: true, isNextDay: false }
  },
  {
    id: 'n2-n3',
    source: 'n2',
    target: 'n3',
    type: 'custom-edge',
    data: { animated: true, isNextDay: false }
  },
  {
    id: 'n3-n5',
    source: 'n3',
    target: 'n5',
    type: 'custom-edge',
    data: { animated: true, isNextDay: false }
  },
  {
    id: 'n4-n5',
    source: 'n4',
    target: 'n5',
    type: 'custom-edge',
    data: { animated: true, isNextDay: false }
  },
  {
    id: 'n5-n6',
    source: 'n5',
    target: 'n6',
    type: 'custom-edge',
    data: { animated: true, isNextDay: false }
  },
  {
    id: 'n5-n7',
    source: 'n5',
    target: 'n7',
    type: 'custom-edge',
    data: { animated: true, isNextDay: false }
  },
];

export default function TestPage() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const handleNodesChange = useCallback((updatedNodes: Node[]) => {
    setNodes(updatedNodes);
  }, []);

  const handleEdgesChange = useCallback((updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
  }, []);

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