"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Info } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { ConfidenceFeedback } from "@/types/modelTypes";
import ConfidenceFeedbackModal from "@/components/ConfidenceFeedback/ConfidenceFeedback";

interface ConfidenceIndicatorProps {
  feedback: ConfidenceFeedback | null;
  onRefresh: () => void;
  refreshing: boolean;
  compact?: boolean;
}

export default function ConfidenceIndicator({
  feedback,
  onRefresh,
  refreshing,
  compact = false
}: ConfidenceIndicatorProps) {
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
            title="確信度を評価"
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
            title="確信度を評価"
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

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return darkMode ? "text-green-400" : "text-green-600";
    if (score >= 0.6) return darkMode ? "text-yellow-400" : "text-yellow-600";
    return darkMode ? "text-red-400" : "text-red-600";
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 0.7) return <TrendingUp size={16} />;
    return <TrendingDown size={16} />;
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.8) return "優秀";
    if (score >= 0.6) return "良好";
    if (score >= 0.4) return "改善要";
    return "要改善";
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-1 text-xs cursor-pointer ${getConfidenceColor(feedback.overall_confidence)}`}
            onClick={() => setShowModal(true)}
          >
            {getConfidenceIcon(feedback.overall_confidence)}
            <span className="font-medium">
              {(feedback.overall_confidence * 100).toFixed(0)}%
            </span>
            <span>
              {getConfidenceLabel(feedback.overall_confidence)}
            </span>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-1 rounded transition-colors ${
              refreshing ? "opacity-50 cursor-not-allowed" :
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
            }`}
            title="確信度を再評価"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {showModal && (
          <ConfidenceFeedbackModal
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
            確信度
          </h3>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`p-1 rounded transition-colors ${
              refreshing ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
            title="確信度を再評価"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <div
          className="cursor-pointer"
          onClick={() => setShowModal(true)}
        >
          <div className={`flex items-center space-x-2 mb-2 ${getConfidenceColor(feedback.overall_confidence)}`}>
            {getConfidenceIcon(feedback.overall_confidence)}
            <span className="text-lg font-bold">
              {(feedback.overall_confidence * 100).toFixed(0)}%
            </span>
            <span className="text-sm">
              {getConfidenceLabel(feedback.overall_confidence)}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className={darkMode ? "text-gray-300" : "text-gray-600"}>明確性</span>
              <span className={getConfidenceColor(feedback.clarity_score)}>
                {(feedback.clarity_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={darkMode ? "text-gray-300" : "text-gray-600"}>実現性</span>
              <span className={getConfidenceColor(feedback.feasibility_score)}>
                {(feedback.feasibility_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={darkMode ? "text-gray-300" : "text-gray-600"}>スコープ</span>
              <span className={getConfidenceColor(feedback.scope_score)}>
                {(feedback.scope_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={darkMode ? "text-gray-300" : "text-gray-600"}>価値</span>
              <span className={getConfidenceColor(feedback.value_score)}>
                {(feedback.value_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={darkMode ? "text-gray-300" : "text-gray-600"}>完全性</span>
              <span className={getConfidenceColor(feedback.completeness_score)}>
                {(feedback.completeness_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="mt-2 text-xs text-center opacity-70">
            詳細を見るにはクリック
          </div>
        </div>
      </div>

      {showModal && (
        <ConfidenceFeedbackModal
          feedback={feedback}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}