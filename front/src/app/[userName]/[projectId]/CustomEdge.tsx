"use client";
import { BaseEdge, getStraightPath, EdgeProps } from '@xyflow/react';

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
      {/* Outer glow - Light mode */}
      <path
        d={edgePath}
        fill="none"
        stroke={isNextDay ? '#ea580c' : '#3b82f6'}
        strokeWidth={selected ? 8 : 5}
        opacity={0.3}
        filter="blur(3px)"
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''} dark:hidden`}
      />
      {/* Outer glow - Dark mode */}
      <path
        d={edgePath}
        fill="none"
        stroke={isNextDay ? '#f97316' : '#06b6d4'}
        strokeWidth={selected ? 8 : 5}
        opacity={0.3}
        filter="blur(3px)"
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''} hidden dark:block`}
      />

      {/* Middle glow - Light mode */}
      <path
        d={edgePath}
        fill="none"
        stroke={isNextDay ? '#f97316' : '#60a5fa'}
        strokeWidth={selected ? 5 : 3}
        opacity={0.6}
        filter="blur(1px)"
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''} dark:hidden`}
      />
      {/* Middle glow - Dark mode */}
      <path
        d={edgePath}
        fill="none"
        stroke={isNextDay ? '#fb923c' : '#67e8f9'}
        strokeWidth={selected ? 5 : 3}
        opacity={0.6}
        filter="blur(1px)"
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''} hidden dark:block`}
      />

      {/* Core line - Light mode */}
      <BaseEdge
        id={`${id}-light`}
        path={edgePath}
        style={{
          stroke: '#ffffff',
          strokeWidth: selected ? 2 : 1.5,
          fill: 'none',
          filter: isNextDay
            ? 'drop-shadow(0 0 2px #ea580c)'
            : 'drop-shadow(0 0 2px #3b82f6)',
        }}
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''} cursor-pointer dark:hidden`}
      />
      {/* Core line - Dark mode */}
      <BaseEdge
        id={`${id}-dark`}
        path={edgePath}
        style={{
          stroke: isNextDay ? '#fed7aa' : '#a7f3d0',
          strokeWidth: selected ? 2 : 1.5,
          fill: 'none',
          filter: isNextDay
            ? 'drop-shadow(0 0 2px #f97316)'
            : 'drop-shadow(0 0 2px #06b6d4)',
        }}
        className={`transition-all duration-300 ${isAnimated ? 'animate-pulse' : ''} cursor-pointer hidden dark:block`}
      />

      {/* Flowing particle - Light mode */}
      {isAnimated && (
        <circle
          r="2"
          fill={isNextDay ? '#f97316' : '#60a5fa'}
          filter={`drop-shadow(0 0 4px ${isNextDay ? '#ea580c' : '#3b82f6'})`}
          className="dark:hidden"
        >
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}
      {/* Flowing particle - Dark mode */}
      {isAnimated && (
        <circle
          r="2"
          fill={isNextDay ? '#fb923c' : '#67e8f9'}
          filter={`drop-shadow(0 0 4px ${isNextDay ? '#f97316' : '#06b6d4'})`}
          className="hidden dark:block"
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
          <div className="
            text-xs px-2 py-1 rounded-full text-center font-semibold
            bg-orange-400/20 dark:bg-orange-500/20
            text-orange-700 dark:text-orange-300
            border border-orange-500/30 dark:border-orange-400/30
          ">
            翌日
          </div>
        </foreignObject>
      )}
    </>
  );
}
