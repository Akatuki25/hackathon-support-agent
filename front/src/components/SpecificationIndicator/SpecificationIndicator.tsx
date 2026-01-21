"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, RefreshCw, Info } from "lucide-react";
import { SpecificationFeedback } from "@/types/modelTypes";
import SpecificationFeedbackModal from "@/components/SpecificationFeedbackModal/SpecificationFeedbackModal";

interface SpecificationIndicatorProps {
  feedback: SpecificationFeedback | null;
  onRefresh: () => void;
  refreshing: boolean;
  compact?: boolean;
}

export default function SpecificationIndicator({
  feedback,
  onRefresh,
  refreshing,
  compact = false,
}: SpecificationIndicatorProps) {
  const [showModal, setShowModal] = useState(false);

  if (!feedback) {
    if (compact) {
      return (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
            <Info size={14} />
            <span>未評価</span>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-1 rounded transition-colors ${
              refreshing
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            title="仕様書を評価"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      );
    }

    return (
      <div className="fixed top-20 right-4 p-3 rounded-lg shadow-lg border bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info size={16} />
            <span className="text-sm">評価待ち</span>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-1 rounded transition-colors ${
              refreshing
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
            title="仕様書を評価"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="mt-1 text-xs opacity-70">
          分析を開始するにはボタンをクリック
        </div>
      </div>
    );
  }

  const hasHighPriorityIssues = feedback.missing_info.some(
    (info) => info.priority === "high",
  );
  const missingInfoCount = feedback.missing_info.length;

  // Helper function to get status color classes
  const getStatusColorClass = () => {
    if (hasHighPriorityIssues) {
      return "text-red-600 dark:text-red-400";
    }
    if (missingInfoCount === 0) {
      return "text-green-600 dark:text-green-400";
    }
    return "text-yellow-600 dark:text-yellow-400";
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-1 text-xs cursor-pointer ${getStatusColorClass()}`}
            onClick={() => setShowModal(true)}
          >
            {missingInfoCount === 0 ? (
              <>
                <CheckCircle size={14} />
                <span>評価完了</span>
              </>
            ) : (
              <>
                <AlertCircle size={14} />
                <span>{missingInfoCount}件の不足情報</span>
              </>
            )}
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-1 rounded transition-colors ${
              refreshing
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            title="仕様書を再評価"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {showModal && (
          <SpecificationFeedbackModal
            feedback={feedback}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={`${compact ? "fixed top-20 right-4" : ""} ${compact ? "p-4" : "p-3"} rounded-lg ${compact ? "shadow-lg" : "shadow"} border ${compact ? "backdrop-blur-sm" : ""} bg-white/90 border-purple-500/30 dark:bg-gray-800/90 dark:border-cyan-500/30`}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-purple-700 dark:text-cyan-400">
            仕様書評価
          </h3>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-1 rounded transition-colors ${
              refreshing
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
            title="仕様書を再評価"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="cursor-pointer" onClick={() => setShowModal(true)}>
          <div
            className={`flex items-center space-x-2 mb-2 ${getStatusColorClass()}`}
          >
            {missingInfoCount === 0 ? (
              <>
                <CheckCircle size={16} />
                <span className="text-sm font-bold">評価完了</span>
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                <span className="text-sm font-bold">
                  {missingInfoCount}件の不足情報
                </span>
              </>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <div className="text-gray-600 dark:text-gray-300">
              {feedback.summary}
            </div>
            {feedback.strengths.length > 0 && (
              <div className="text-green-600 dark:text-green-400">
                強み: {feedback.strengths.length}件
              </div>
            )}
            {feedback.suggestions.length > 0 && (
              <div className="text-blue-600 dark:text-blue-400">
                改善提案: {feedback.suggestions.length}件
              </div>
            )}
          </div>

          <div className="mt-2 text-xs text-center opacity-70">
            詳細を見るにはクリック
          </div>
        </div>
      </div>

      {showModal && (
        <SpecificationFeedbackModal
          feedback={feedback}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
