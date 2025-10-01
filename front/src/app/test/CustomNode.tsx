"use client";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Plus, Check } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useDarkMode } from "@/hooks/useDarkMode";

type NodeCategory = '環境構築' | 'フロントエンド' | 'バックエンド' | 'DB設計' | 'AI設計' | 'デプロイ' | 'スライド資料作成' | 'default';

interface NodeData {
  label: string;
  category?: NodeCategory;
  startTime?: string;
  estimatedHours?: number;
  completed?: boolean;
  assignee?: string;
}

export function TextUpdaterNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const [label, setLabel] = useState(nodeData?.label || 'Node');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddButton, setShowAddButton] = useState(false);
  const [completed, setCompleted] = useState(nodeData?.completed || false);
  const [category, setCategory] = useState<NodeCategory>(nodeData?.category || 'default');
  const [startTime, setStartTime] = useState(nodeData?.startTime || '');
  const [estimatedHours, setEstimatedHours] = useState(nodeData?.estimatedHours || 1);
  const [assignee, setAssignee] = useState(nodeData?.assignee || '');
  const { darkMode } = useDarkMode();
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

  const getCategoryColors = () => {
    switch (category) {
      case '環境構築':
        return {
          bg: darkMode ? 'bg-gray-600/60' : 'bg-gray-300/80',
          border: darkMode ? 'border-gray-400/60' : 'border-gray-500/60',
          text: darkMode ? 'text-gray-200' : 'text-gray-700',
          glow: darkMode ? 'shadow-gray-400/30' : 'shadow-gray-500/30'
        };
      case 'フロントエンド':
        return {
          bg: darkMode ? 'bg-cyan-600/60' : 'bg-cyan-300/80',
          border: darkMode ? 'border-cyan-400/60' : 'border-cyan-500/60',
          text: darkMode ? 'text-cyan-200' : 'text-cyan-700',
          glow: darkMode ? 'shadow-cyan-400/30' : 'shadow-cyan-500/30'
        };
      case 'バックエンド':
        return {
          bg: darkMode ? 'bg-blue-600/60' : 'bg-blue-300/80',
          border: darkMode ? 'border-blue-400/60' : 'border-blue-500/60',
          text: darkMode ? 'text-blue-200' : 'text-blue-700',
          glow: darkMode ? 'shadow-blue-400/30' : 'shadow-blue-500/30'
        };
      case 'DB設計':
        return {
          bg: darkMode ? 'bg-teal-600/60' : 'bg-teal-300/80',
          border: darkMode ? 'border-teal-400/60' : 'border-teal-500/60',
          text: darkMode ? 'text-teal-200' : 'text-teal-700',
          glow: darkMode ? 'shadow-teal-400/30' : 'shadow-teal-500/30'
        };
      case 'AI設計':
        return {
          bg: darkMode ? 'bg-purple-600/60' : 'bg-purple-300/80',
          border: darkMode ? 'border-purple-400/60' : 'border-purple-500/60',
          text: darkMode ? 'text-purple-200' : 'text-purple-700',
          glow: darkMode ? 'shadow-purple-400/30' : 'shadow-purple-500/30'
        };
      case 'デプロイ':
        return {
          bg: darkMode ? 'bg-yellow-600/60' : 'bg-yellow-300/80',
          border: darkMode ? 'border-yellow-400/60' : 'border-yellow-500/60',
          text: darkMode ? 'text-yellow-200' : 'text-yellow-700',
          glow: darkMode ? 'shadow-yellow-400/30' : 'shadow-yellow-500/30'
        };
      case 'スライド資料作成':
        return {
          bg: darkMode ? 'bg-emerald-600/60' : 'bg-emerald-300/80',
          border: darkMode ? 'border-emerald-400/60' : 'border-emerald-500/60',
          text: darkMode ? 'text-emerald-200' : 'text-emerald-700',
          glow: darkMode ? 'shadow-emerald-400/30' : 'shadow-emerald-500/30'
        };
      default:
        return {
          bg: darkMode ? 'bg-gray-700/60' : 'bg-purple-50/80',
          border: darkMode ? 'border-cyan-500/60' : 'border-purple-300/60',
          text: darkMode ? 'text-gray-200' : 'text-gray-700',
          glow: darkMode ? 'shadow-cyan-500/30' : 'shadow-purple-500/30'
        };
    }
  };

  const colors = getCategoryColors();

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
          ? darkMode
            ? 'bg-green-900/50 border-green-400/50 hover:border-green-300/70 shadow-md shadow-green-500/20'
            : 'bg-green-50/70 border-green-400/50 hover:border-green-500/70 shadow-md shadow-green-500/20'
          : `${colors.bg} ${colors.border} hover:${colors.border.replace('/60', '/80')} shadow-sm ${colors.glow}`
        }
        ${selected
          ? completed
            ? darkMode
              ? 'border-green-300 shadow-lg shadow-green-400/30 ring-1 ring-green-400/20'
              : 'border-green-500 shadow-lg shadow-green-500/30 ring-1 ring-green-500/20'
            : `border-current shadow-lg ${colors.glow.replace('/30', '/40')} ring-1 ring-current/20`
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
            className={`
              w-6 h-6 rounded-full border transition-all duration-300
              flex items-center justify-center hover:scale-110 active:scale-95
              backdrop-blur-md text-xs
              ${darkMode
                ? 'bg-cyan-500/20 border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30 hover:border-cyan-300/50'
                : 'bg-blue-500/20 border-blue-400/30 text-blue-600 hover:bg-blue-400/30 hover:border-blue-300/50'
              }
            `}
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
              ? darkMode
                ? 'bg-green-500 border-green-400 text-white'
                : 'bg-green-500 border-green-400 text-white'
              : darkMode
                ? 'border-cyan-400/50 hover:border-cyan-400 bg-gray-800/50'
                : 'border-purple-400/50 hover:border-purple-400 bg-white/50'
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
          className={`w-full p-1 text-xs rounded border transition-all resize-none break-words min-h-[24px] max-h-[60px] overflow-hidden ${
            darkMode
              ? 'bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400'
              : 'bg-white border-purple-300 text-gray-800 focus:border-purple-500'
          } focus:outline-none nodrag`}
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
              ? 'line-through opacity-70'
              : ''
          } ${
            completed
              ? darkMode
                ? 'text-green-300 hover:bg-green-900/30'
                : 'text-green-700 hover:bg-green-100/50'
              : `${colors.text} hover:${colors.bg.replace('/60', '/80')}`
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
          className={`text-[9px] px-1 py-0 rounded-full font-medium border cursor-pointer appearance-none ${colors.bg} ${colors.border} ${colors.text} bg-opacity-80`}
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
        className={`
          w-2 h-2 !border-2 hover:scale-125 transition-all
          ${darkMode
            ? '!bg-cyan-400 !border-cyan-300 hover:!bg-cyan-300'
            : '!bg-purple-500 !border-purple-400 hover:!bg-purple-400'
          }
        `}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={`
          w-2 h-2 !border-2 hover:scale-125 transition-all
          ${darkMode
            ? '!bg-purple-400 !border-purple-300 hover:!bg-purple-300'
            : '!bg-blue-500 !border-blue-400 hover:!bg-blue-400'
          }
        `}
      />

    </div>
  );
}