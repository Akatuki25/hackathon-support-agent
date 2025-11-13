"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, RefreshCw, Info } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
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
  compact = false
}: SpecificationIndicatorProps) {
  const { darkMode } = useDarkMode();
  const [showModal, setShowModal] = useState(false);

  if (!feedback) {
    if (compact) {
      return (
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-1 text-xs ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            <Info size={14} />
            <span>未評価</span>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-1 rounded transition-colors ${
              refreshing ? "opacity-50 cursor-not-allowed" :
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
            }`}
            title="仕様書を評価"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      );
    }

    return (
      <div className={`fixed top-20 right-4 p-3 rounded-lg shadow-lg border ${
        darkMode
          ? "bg-gray-800 border-gray-600 text-gray-300"
          : "bg-white border-gray-200 text-gray-600"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info size={16} />
            <span className="text-sm">評価待ち</span>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-1 rounded transition-colors ${
              refreshing ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200 dark:hover:bg-gray-600"
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

  const hasHighPriorityIssues = feedback.missing_info.some(info => info.priority === "high");
  const missingInfoCount = feedback.missing_info.length;

  if (compact) {
    return (
      <>
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-1 text-xs cursor-pointer ${
              hasHighPriorityIssues
                ? (darkMode ? "text-red-400" : "text-red-600")
                : missingInfoCount === 0
                  ? (darkMode ? "text-green-400" : "text-green-600")
                  : (darkMode ? "text-yellow-400" : "text-yellow-600")
            }`}
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
              refreshing ? "opacity-50 cursor-not-allowed" :
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
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
      <div className={`${compact ? 'fixed top-20 right-4' : ''} ${compact ? 'p-4' : 'p-3'} rounded-lg ${compact ? 'shadow-lg' : 'shadow'} border ${compact ? 'backdrop-blur-sm' : ''} ${
        darkMode
          ? "bg-gray-800/90 border-cyan-500/30"
          : "bg-white/90 border-purple-500/30"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-sm font-semibold ${
            darkMode ? "text-cyan-400" : "text-purple-700"
          }`}>
            仕様書評価
          </h3>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-1 rounded transition-colors ${
              refreshing ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
            title="仕様書を再評価"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <div
          className="cursor-pointer"
          onClick={() => setShowModal(true)}
        >
          <div className={`flex items-center space-x-2 mb-2 ${
            hasHighPriorityIssues
              ? (darkMode ? "text-red-400" : "text-red-600")
              : missingInfoCount === 0
                ? (darkMode ? "text-green-400" : "text-green-600")
                : (darkMode ? "text-yellow-400" : "text-yellow-600")
          }`}>
            {missingInfoCount === 0 ? (
              <>
                <CheckCircle size={16} />
                <span className="text-sm font-bold">評価完了</span>
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                <span className="text-sm font-bold">{missingInfoCount}件の不足情報</span>
              </>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <div className={darkMode ? "text-gray-300" : "text-gray-600"}>
              {feedback.summary}
            </div>
            {feedback.strengths.length > 0 && (
              <div className={darkMode ? "text-green-400" : "text-green-600"}>
                強み: {feedback.strengths.length}件
              </div>
            )}
            {feedback.suggestions.length > 0 && (
              <div className={darkMode ? "text-blue-400" : "text-blue-600"}>
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
