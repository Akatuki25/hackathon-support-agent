"use client";
import { BaseEdge, getStraightPath, EdgeProps } from '@xyflow/react';
import { useDarkMode } from '@/hooks/useDarkMode';

interface CustomEdgeProps extends EdgeProps {
  data?: {
    animated?: boolean;
    glowColor?: string;
    isNextDay?: boolean;
  };
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected
}: CustomEdgeProps) {
  const { darkMode } = useDarkMode();
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const isAnimated = false;
  const isNextDay = data?.isNextDay || false;

  return (
    <>
      {/* Outer glow */}
      <path
        d={edgePath}
        fill="none"
        stroke={isNextDay
          ? (darkMode ? '#f97316' : '#ea580c')
          : (darkMode ? '#06b6d4' : '#3b82f6')
        }
        strokeWidth={selected ? 8 : 5}
        opacity={0.3}
        filter={`blur(3px)`}
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''}`}
      />

      {/* Middle glow */}
      <path
        d={edgePath}
        fill="none"
        stroke={isNextDay
          ? (darkMode ? '#fb923c' : '#f97316')
          : (darkMode ? '#67e8f9' : '#60a5fa')
        }
        strokeWidth={selected ? 5 : 3}
        opacity={0.6}
        filter={`blur(1px)`}
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''}`}
      />

      {/* Core line */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isNextDay
            ? (darkMode ? '#fed7aa' : '#ffffff')
            : (darkMode ? '#a7f3d0' : '#ffffff'),
          strokeWidth: selected ? 2 : 1.5,
          fill: 'none',
          filter: isNextDay
            ? (darkMode ? 'drop-shadow(0 0 2px #f97316)' : 'drop-shadow(0 0 2px #ea580c)')
            : (darkMode ? 'drop-shadow(0 0 2px #06b6d4)' : 'drop-shadow(0 0 2px #3b82f6)'),
        }}
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''} cursor-pointer`}
        onClick={() => {
          // Toggle next day status
          console.log('Edge clicked, toggling next day status');
        }}
      />

      {/* Flowing particle */}
      {isAnimated && (
        <circle
          r="2"
          fill={isNextDay
            ? (darkMode ? '#fb923c' : '#f97316')
            : (darkMode ? '#67e8f9' : '#60a5fa')
          }
          filter={`drop-shadow(0 0 4px ${
            isNextDay
              ? (darkMode ? '#f97316' : '#ea580c')
              : (darkMode ? '#06b6d4' : '#3b82f6')
          })`}
        >
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}

      {/* Next Day Label */}
      {isNextDay && (
        <foreignObject
          x={labelX - 20}
          y={labelY - 10}
          width={40}
          height={20}
          className="pointer-events-none"
        >
          <div className={`
            text-xs px-2 py-1 rounded-full text-center font-semibold
            ${darkMode
              ? 'bg-orange-500/20 text-orange-300 border border-orange-400/30'
              : 'bg-orange-400/20 text-orange-700 border border-orange-500/30'
            }
          `}>
            翌日
          </div>
        </foreignObject>
      )}
    </>
  );
}