"use client";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Plus, Check } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

type NodeCategory = '環境構築' | 'フロントエンド' | 'バックエンド' | 'DB設計' | 'AI設計' | 'デプロイ' | 'スライド資料作成' | 'default';

interface NodeData {
  label: string;
  category?: NodeCategory;
  startTime?: string;
  estimatedHours?: number;
  completed?: boolean;
  assignee?: string;
}

// Category color configurations for light and dark modes using Tailwind classes
const categoryColors: Record<NodeCategory, { bg: string; border: string; text: string; glow: string }> = {
  '環境構築': {
    bg: 'bg-gray-300/80 dark:bg-gray-600/60',
    border: 'border-gray-500/60 dark:border-gray-400/60',
    text: 'text-gray-700 dark:text-gray-200',
    glow: 'shadow-gray-500/30 dark:shadow-gray-400/30'
  },
  'フロントエンド': {
    bg: 'bg-cyan-300/80 dark:bg-cyan-600/60',
    border: 'border-cyan-500/60 dark:border-cyan-400/60',
    text: 'text-cyan-700 dark:text-cyan-200',
    glow: 'shadow-cyan-500/30 dark:shadow-cyan-400/30'
  },
  'バックエンド': {
    bg: 'bg-blue-300/80 dark:bg-blue-600/60',
    border: 'border-blue-500/60 dark:border-blue-400/60',
    text: 'text-blue-700 dark:text-blue-200',
    glow: 'shadow-blue-500/30 dark:shadow-blue-400/30'
  },
  'DB設計': {
    bg: 'bg-teal-300/80 dark:bg-teal-600/60',
    border: 'border-teal-500/60 dark:border-teal-400/60',
    text: 'text-teal-700 dark:text-teal-200',
    glow: 'shadow-teal-500/30 dark:shadow-teal-400/30'
  },
  'AI設計': {
    bg: 'bg-purple-300/80 dark:bg-purple-600/60',
    border: 'border-purple-500/60 dark:border-purple-400/60',
    text: 'text-purple-700 dark:text-purple-200',
    glow: 'shadow-purple-500/30 dark:shadow-purple-400/30'
  },
  'デプロイ': {
    bg: 'bg-yellow-300/80 dark:bg-yellow-600/60',
    border: 'border-yellow-500/60 dark:border-yellow-400/60',
    text: 'text-yellow-700 dark:text-yellow-200',
    glow: 'shadow-yellow-500/30 dark:shadow-yellow-400/30'
  },
  'スライド資料作成': {
    bg: 'bg-emerald-300/80 dark:bg-emerald-600/60',
    border: 'border-emerald-500/60 dark:border-emerald-400/60',
    text: 'text-emerald-700 dark:text-emerald-200',
    glow: 'shadow-emerald-500/30 dark:shadow-emerald-400/30'
  },
  'default': {
    bg: 'bg-purple-50/80 dark:bg-gray-700/60',
    border: 'border-purple-300/60 dark:border-cyan-500/60',
    text: 'text-gray-700 dark:text-gray-200',
    glow: 'shadow-purple-500/30 dark:shadow-cyan-500/30'
  }
};

export function TextUpdaterNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const [label, setLabel] = useState(nodeData?.label || 'Node');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddButton, setShowAddButton] = useState(false);
  const [completed, setCompleted] = useState(nodeData?.completed || false);
  const [category, setCategory] = useState<NodeCategory>(nodeData?.category || 'default');
  const [startTime] = useState(nodeData?.startTime || '');
  const [estimatedHours, setEstimatedHours] = useState(nodeData?.estimatedHours || 1);
  const [assignee] = useState(nodeData?.assignee || '');
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    }
  };

  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [isEditing, label]);

  const colors = categoryColors[category];

  // Calculate end time based on start time and estimated hours
  const getEndTime = () => {
    if (!startTime || !estimatedHours) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + (estimatedHours * 60);
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  const addNewNode = () => {
    const nodes = getNodes();
    const edges = getEdges();
    const currentNode = nodes.find(node => node.id === id);

    const newNodeId = `node-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: 'textUpdater',
      position: {
        x: (currentNode?.position.x || 0) + 200,
        y: (currentNode?.position.y || 0) - 50
      },
      data: {
        label: 'New Node',
        category: 'default',
        completed: false,
        startTime: '',
        estimatedHours: 1,
        assignee: ''
      }
    };

    const newEdge = {
      id: `edge-${id}-${newNodeId}`,
      source: id,
      target: newNodeId,
      type: 'custom-edge',
      data: { animated: true }
    };

    setNodes([...nodes, newNode]);
    setEdges([...edges, newEdge]);
    setShowAddButton(false);
  };

  return (
    <div
      className={`
        relative group min-w-[180px] max-w-[250px] p-2 rounded-lg border transition-all duration-300 cursor-pointer
        backdrop-blur-sm transform hover:scale-[1.02] hover:z-10
        ${completed
          ? 'bg-green-50/70 dark:bg-green-900/50 border-green-400/50 hover:border-green-500/70 dark:hover:border-green-300/70 shadow-md shadow-green-500/20'
          : `${colors.bg} ${colors.border} shadow-sm ${colors.glow}`
        }
        ${selected
          ? completed
            ? 'border-green-500 dark:border-green-300 shadow-lg shadow-green-500/30 dark:shadow-green-400/30 ring-1 ring-green-500/20 dark:ring-green-400/20'
            : `border-current shadow-lg ring-1 ring-current/20`
          : ''
        }
      `}
      onClick={() => setShowAddButton(!showAddButton)}
    >

      {/* Add button - smaller */}
      {showAddButton && (
        <div className="absolute -top-2 -right-2 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addNewNode();
            }}
            className="
              w-6 h-6 rounded-full border transition-all duration-300
              flex items-center justify-center hover:scale-110 active:scale-95
              backdrop-blur-md text-xs
              bg-blue-500/20 dark:bg-cyan-500/20
              border-blue-400/30 dark:border-cyan-400/30
              text-blue-600 dark:text-cyan-300
              hover:bg-blue-400/30 dark:hover:bg-cyan-400/30
              hover:border-blue-300/50 dark:hover:border-cyan-300/50
            "
          >
            <Plus size={12} />
          </button>
        </div>
      )}

      {/* Top row: Completion checkbox and estimated hours */}
      <div className="flex items-center justify-between mb-1.5">
        {/* Completion checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCompleted(!completed);
          }}
          className={`
            w-5 h-5 rounded border-2 transition-all duration-200
            flex items-center justify-center flex-shrink-0
            ${completed
              ? 'bg-green-500 border-green-400 text-white'
              : 'border-purple-400/50 dark:border-cyan-400/50 hover:border-purple-400 dark:hover:border-cyan-400 bg-white/50 dark:bg-gray-800/50'
            }
          `}
        >
          {completed && <Check size={12} />}
        </button>

        {/* Estimated hours select */}
        <select
          value={estimatedHours}
          onChange={(e) => {
            e.stopPropagation();
            setEstimatedHours(parseFloat(e.target.value));
          }}
          onClick={(e) => e.stopPropagation()}
          className={`
            text-xs px-1.5 py-0.5 rounded border bg-current/10 border-current/30
            text-center font-medium nodrag w-16 ml-2 mr-16
            ${colors.text} appearance-none cursor-pointer
          `}
          title="所要時間"
        >
          <option value="0.5">0.5h</option>
          <option value="1">1h</option>
          <option value="1.5">1.5h</option>
          <option value="2">2h</option>
          <option value="2.5">2.5h</option>
          <option value="3">3h</option>
          <option value="3.5">3.5h</option>
          <option value="4">4h</option>
          <option value="4.5">4.5h</option>
          <option value="5">5h</option>
          <option value="6">6h</option>
          <option value="7">7h</option>
          <option value="8">8h</option>
        </select>
      </div>

      {/* Label - more compact */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              setIsEditing(false);
            }
          }}
          onBlur={() => setIsEditing(false)}
          onClick={(e) => e.stopPropagation()}
          className="w-full p-1 text-xs rounded border transition-all resize-none break-words min-h-[24px] max-h-[60px] overflow-hidden
            bg-white dark:bg-gray-800
            border-purple-300 dark:border-cyan-500/50
            text-gray-800 dark:text-cyan-100
            focus:border-purple-500 dark:focus:border-cyan-400
            focus:outline-none nodrag"
          placeholder="タスク名..."
          autoFocus
          rows={1}
        />
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className={`p-1 text-xs cursor-pointer rounded transition-all break-words whitespace-pre-wrap leading-snug ${
            completed
              ? 'line-through opacity-70 text-green-700 dark:text-green-300 hover:bg-green-100/50 dark:hover:bg-green-900/30'
              : `${colors.text}`
          }`}
        >
          {label || 'クリックして編集'}
        </div>
      )}

      {/* Minimal time display */}
      <div className="flex items-center justify-between mt-1 text-[10px]">
        <div className="flex items-center gap-1">
          {startTime ? (
            <span className={`${colors.text} opacity-70`}>
              {startTime}
              {estimatedHours && `-${getEndTime()}`}
            </span>
          ) : (
            <span className={`${colors.text} opacity-40`}>--:--</span>
          )}
        </div>

        {/* Minimal assignee */}
        <div>
          {assignee}
        </div>
      </div>

      {/* Category badge - very small */}
      <div className="absolute -top-1 right-2">
        <select
          value={category}
          onChange={(e) => {
            e.stopPropagation();
            setCategory(e.target.value as NodeCategory);
          }}
          onClick={(e) => e.stopPropagation()}
          className={`text-[9px] px-1 py-0 rounded-full font-medium border cursor-pointer appearance-none text-center ${colors.bg} ${colors.border} ${colors.text} bg-opacity-80`}
          title="カテゴリー"
        >
          <option value="default">通常</option>
          <option value="環境構築">環境</option>
          <option value="フロントエンド">フロント</option>
          <option value="バックエンド">バック</option>
          <option value="DB設計">DB</option>
          <option value="AI設計">AI</option>
          <option value="デプロイ">デプロイ</option>
          <option value="スライド資料作成">スライド</option>
        </select>
      </div>

      {/* Connection handles - smaller */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="
          w-2 h-2 !border-2 hover:scale-125 transition-all
          !bg-purple-500 dark:!bg-cyan-400
          !border-purple-400 dark:!border-cyan-300
          hover:!bg-purple-400 dark:hover:!bg-cyan-300
        "
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="
          w-2 h-2 !border-2 hover:scale-125 transition-all
          !bg-blue-500 dark:!bg-purple-400
          !border-blue-400 dark:!border-purple-300
          hover:!bg-blue-400 dark:hover:!bg-purple-300
        "
      />

    </div>
  );
}
