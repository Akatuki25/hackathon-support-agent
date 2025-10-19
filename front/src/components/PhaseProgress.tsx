"use client";

import React from "react";

interface PhaseProgressProps {
  currentPhase: string;
}

const PHASE_STEPS = [
  { key: "initial", label: "プロジェクト作成" },
  { key: "qa_editing", label: "Q&A編集" },
  { key: "summary_review", label: "要約確認" },
  { key: "function_review", label: "機能確認" },
  { key: "framework_selection", label: "技術選定" },
  { key: "function_structuring", label: "機能構造化" },
  { key: "task_management", label: "タスク管理" },
];

/**
 * プロジェクトのフェーズ進行状況を表示するコンポーネント
 *
 * 現在のフェーズに基づいて、プロジェクトの進行状況をステッパー形式で可視化します
 */
export const PhaseProgress: React.FC<PhaseProgressProps> = ({ currentPhase }) => {
  // 現在のステップインデックスを取得
  const currentStepIndex = PHASE_STEPS.findIndex((step) =>
    currentPhase.includes(step.key)
  );

  return (
    <div className="w-full px-4 py-6">
      <div className="flex items-center justify-between">
        {PHASE_STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <React.Fragment key={step.key}>
              {/* ステップ */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    font-semibold transition-all duration-300
                    ${
                      isCompleted
                        ? "bg-green-500 text-white shadow-lg shadow-green-500/50"
                        : isCurrent
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50 animate-pulse"
                        : "bg-gray-300 text-gray-600"
                    }
                  `}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>
                <p
                  className={`
                    mt-2 text-sm text-center transition-all duration-300
                    ${
                      isCurrent
                        ? "font-bold text-blue-600 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400"
                    }
                  `}
                >
                  {step.label}
                </p>
              </div>

              {/* コネクター */}
              {index < PHASE_STEPS.length - 1 && (
                <div
                  className={`
                    flex-1 h-1 mx-2 transition-all duration-500
                    ${isCompleted ? "bg-green-500" : "bg-gray-300"}
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 進行状況の割合表示 */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          進行状況: {currentStepIndex + 1} / {PHASE_STEPS.length} ステップ (
          {Math.round(((currentStepIndex + 1) / PHASE_STEPS.length) * 100)}%)
        </p>
      </div>
    </div>
  );
};
