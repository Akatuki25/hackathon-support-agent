"use client";
import { Handle, Position, NodeProps, useReactFlow } from "@xyflow/react";
import { Cpu, Zap, Database, Network, Plus, Check } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useDarkMode } from "@/hooks/useDarkMode";

interface NodeData {
  label: string;
  type?: 'default' | 'processor' | 'database' | 'network';
  dueDate?: string; // DD format
  dueTime?: string; // HH:MM format
  dueYear?: number; // YYYY format (hidden but settable)
  dueMonth?: number; // MM format (hidden but settable)
  completed?: boolean;
}

export function TextUpdaterNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const [label, setLabel] = useState(nodeData?.label || 'Node');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddButton, setShowAddButton] = useState(false);
  const [completed, setCompleted] = useState(nodeData?.completed || false);
  const [dueDate, setDueDate] = useState(nodeData?.dueDate || '');
  const [dueTime, setDueTime] = useState(nodeData?.dueTime || '');
  const [dueYear, setDueYear] = useState(nodeData?.dueYear || new Date().getFullYear());
  const [dueMonth, setDueMonth] = useState(nodeData?.dueMonth || new Date().getMonth() + 1);
  const [showYearMonth, setShowYearMonth] = useState(false);
  const { darkMode } = useDarkMode();
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [isEditing, label]);

  const getNodeIcon = () => {
    switch (nodeData?.type) {
      case 'processor': return <Cpu size={16} />;
      case 'database': return <Database size={16} />;
      case 'network': return <Network size={16} />;
      default: return <Zap size={16} />;
    }
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
        type: 'default',
        completed: false,
        dueDate: '',
        dueTime: '',
        dueYear: new Date().getFullYear(),
        dueMonth: new Date().getMonth() + 1
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
        relative group min-w-[160px] max-w-[280px] p-4 rounded-lg border transition-all
        ${completed
          ? darkMode
            ? 'bg-green-900/40 border-green-500/30 hover:border-green-500/50'
            : 'bg-green-50/70 border-green-300/50 hover:border-green-400'
          : darkMode
            ? 'bg-gray-700/40 border-cyan-500/30 hover:border-cyan-500/50'
            : 'bg-purple-50/70 border-purple-300/50 hover:border-purple-400'
        }
        ${selected
          ? completed
            ? darkMode
              ? 'border-green-400 shadow-lg shadow-green-500/20'
              : 'border-green-500 shadow-lg shadow-green-500/20'
            : darkMode
              ? 'border-cyan-400 shadow-lg shadow-cyan-500/20'
              : 'border-purple-500 shadow-lg shadow-purple-500/20'
          : ''
        }
      `}
      onClick={() => setShowAddButton(!showAddButton)}
    >


      {/* Add button */}
      {showAddButton && (
        <div className="absolute -top-3 -right-3 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addNewNode();
            }}
            className={`
              w-8 h-8 rounded-full border transition-all duration-300
              flex items-center justify-center hover:scale-110 active:scale-95
              backdrop-blur-md
              ${darkMode
                ? 'bg-cyan-500/20 border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30 hover:border-cyan-300/50 shadow-lg shadow-cyan-500/20'
                : 'bg-blue-500/20 border-blue-400/30 text-blue-600 hover:bg-blue-400/30 hover:border-blue-300/50 shadow-lg shadow-blue-500/20'
              }
            `}
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {/* Completion checkbox */}
      <div className="absolute top-2 left-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCompleted(!completed);
          }}
          className={`
            w-5 h-5 rounded border-2 transition-all duration-200
            flex items-center justify-center
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
      </div>

      {/* Simple editable label */}
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
          className={`w-full max-w-[248px] p-2 text-sm rounded border transition-all resize-none break-words min-h-[40px] max-h-[120px] overflow-hidden ${
            darkMode
              ? 'bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400'
              : 'bg-white border-purple-300 text-gray-800 focus:border-purple-500'
          } focus:outline-none nodrag`}
          placeholder="Enter label..."
          autoFocus
          rows={1}
        />
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className={`p-2 text-sm cursor-pointer rounded transition-all break-words whitespace-pre-wrap leading-relaxed ${
            completed
              ? 'line-through opacity-70'
              : ''
          } ${
            darkMode
              ? completed
                ? 'text-green-300 hover:bg-green-900/30'
                : 'text-gray-200 hover:bg-gray-600/30'
              : completed
                ? 'text-green-700 hover:bg-green-100/50'
                : 'text-gray-700 hover:bg-purple-100/50'
          }`}
        >
          {label || 'Click to edit'}
        </div>
      )}

      {/* Due date and time display */}
      <div className="absolute bottom-0.5 left-0.5">
        <div className="flex gap-0.5 items-center">
          <input
            type="text"
            value={dueDate}
            onChange={(e) => {
              e.stopPropagation();
              setDueDate(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className={`
              text-[8px] px-0.5 py-0 rounded border transition-all w-8 h-4 leading-none text-center
              ${darkMode
                ? 'bg-gray-800/30 border-gray-600/20 text-gray-500 focus:border-cyan-400'
                : 'bg-white/30 border-gray-300/20 text-gray-600 focus:border-purple-400'
              }
              focus:outline-none nodrag
            `}
            placeholder="DD"
            maxLength={2}
          />
          <input
            type="time"
            value={dueTime}
            onChange={(e) => {
              e.stopPropagation();
              setDueTime(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className={`
              text-[8px] px-0.5 py-0 rounded border transition-all w-12 h-4 leading-none
              ${darkMode
                ? 'bg-gray-800/30 border-gray-600/20 text-gray-500 focus:border-cyan-400'
                : 'bg-white/30 border-gray-300/20 text-gray-600 focus:border-purple-400'
              }
              focus:outline-none nodrag
            `}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowYearMonth(!showYearMonth);
            }}
            className={`
              text-[6px] w-3 h-4 rounded border transition-all leading-none
              ${darkMode
                ? 'bg-gray-800/30 border-gray-600/20 text-gray-500 hover:border-cyan-400'
                : 'bg-white/30 border-gray-300/20 text-gray-600 hover:border-purple-400'
              }
              flex items-center justify-center nodrag
            `}
          >
            ⚙
          </button>
        </div>

        {/* Year and Month settings (hidden by default) */}
        {showYearMonth && (
          <div className="flex gap-0.5 mt-0.5">
            <input
              type="number"
              value={dueYear}
              onChange={(e) => {
                e.stopPropagation();
                setDueYear(parseInt(e.target.value) || new Date().getFullYear());
              }}
              onClick={(e) => e.stopPropagation()}
              className={`
                text-[8px] px-0.5 py-0 rounded border transition-all w-12 h-4 leading-none text-center
                ${darkMode
                  ? 'bg-gray-800/30 border-gray-600/20 text-gray-500 focus:border-cyan-400'
                  : 'bg-white/30 border-gray-300/20 text-gray-600 focus:border-purple-400'
                }
                focus:outline-none nodrag
              `}
              placeholder="YYYY"
              min="2024"
              max="2030"
            />
            <input
              type="number"
              value={dueMonth}
              onChange={(e) => {
                e.stopPropagation();
                setDueMonth(parseInt(e.target.value) || 1);
              }}
              onClick={(e) => e.stopPropagation()}
              className={`
                text-[8px] px-0.5 py-0 rounded border transition-all w-8 h-4 leading-none text-center
                ${darkMode
                  ? 'bg-gray-800/30 border-gray-600/20 text-gray-500 focus:border-cyan-400'
                  : 'bg-white/30 border-gray-300/20 text-gray-600 focus:border-purple-400'
                }
                focus:outline-none nodrag
              `}
              placeholder="MM"
              min="1"
              max="12"
            />
          </div>
        )}
      </div>

      {/* Simple connection handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={`
          w-3 h-3 !border-2 hover:scale-125 transition-all
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
          w-3 h-3 !border-2 hover:scale-125 transition-all
          ${darkMode
            ? '!bg-purple-400 !border-purple-300 hover:!bg-purple-300'
            : '!bg-blue-500 !border-blue-400 hover:!bg-blue-400'
          }
        `}
      />

    </div>
  );
}