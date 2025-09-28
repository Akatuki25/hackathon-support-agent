"use client";
import { BaseEdge, getStraightPath, EdgeProps } from '@xyflow/react';
import { useDarkMode } from '@/hooks/useDarkMode';

interface CustomEdgeProps extends EdgeProps {
  data?: {
    animated?: boolean;
    glowColor?: string;
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
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const isAnimated = data?.animated || false;

  return (
    <>
      {/* Outer glow */}
      <path
        d={edgePath}
        fill="none"
        stroke={darkMode ? '#06b6d4' : '#3b82f6'}
        strokeWidth={selected ? 8 : 5}
        opacity={0.3}
        filter={`blur(3px)`}
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''}`}
      />

      {/* Middle glow */}
      <path
        d={edgePath}
        fill="none"
        stroke={darkMode ? '#67e8f9' : '#60a5fa'}
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
          stroke: darkMode ? '#a7f3d0' : '#ffffff',
          strokeWidth: selected ? 2 : 1.5,
          fill: 'none',
          filter: darkMode
            ? 'drop-shadow(0 0 2px #06b6d4)'
            : 'drop-shadow(0 0 2px #3b82f6)',
        }}
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''}`}
      />

      {/* Flowing particle */}
      {isAnimated && (
        <circle
          r="2"
          fill={darkMode ? '#67e8f9' : '#60a5fa'}
          filter={`drop-shadow(0 0 4px ${darkMode ? '#06b6d4' : '#3b82f6'})`}
        >
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}
    </>
  );
}