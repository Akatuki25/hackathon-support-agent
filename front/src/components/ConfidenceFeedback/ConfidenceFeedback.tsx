"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Info, CheckCircle, AlertCircle } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { ConfidenceFeedback as ConfidenceFeedbackType } from "@/types/modelTypes";

interface ConfidenceFeedbackProps {
  feedback: ConfidenceFeedbackType;
  onClose: () => void;
}

export default function ConfidenceFeedback({ feedback, onClose }: ConfidenceFeedbackProps) {
  const { darkMode } = useDarkMode();
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return darkMode ? "text-green-400" : "text-green-600";
    if (score >= 0.6) return darkMode ? "text-yellow-400" : "text-yellow-600";
    return darkMode ? "text-red-400" : "text-red-600";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 0.7) return <TrendingUp size={16} />;
    return <TrendingDown size={16} />;
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return "優秀";
    if (score >= 0.6) return "良好";
    if (score >= 0.4) return "改善要";
    return "要大幅改善";
  };

  const scoreItems = [
    { key: 'clarity_score', label: '明確性', score: feedback.clarity_score, feedback: feedback.clarity_feedback },
    { key: 'feasibility_score', label: '実現可能性', score: feedback.feasibility_score, feedback: feedback.feasibility_feedback },
    { key: 'scope_score', label: 'スコープ適切性', score: feedback.scope_score, feedback: feedback.scope_feedback },
    { key: 'value_score', label: 'ユーザー価値', score: feedback.value_score, feedback: feedback.value_feedback },
    { key: 'completeness_score', label: '完全性', score: feedback.completeness_score, feedback: feedback.completeness_feedback },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border ${
        darkMode
          ? "bg-gray-800 border-cyan-500/30"
          : "bg-white border-purple-500/30"
      }`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className={`text-2xl font-bold flex items-center ${
              darkMode ? "text-cyan-400" : "text-purple-700"
            }`}>
              <Info size={24} className="mr-2" />
              確信度フィードバック
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                darkMode
                  ? "hover:bg-gray-700 text-gray-300"
                  : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              ✕
            </button>
          </div>

          {/* Overall Confidence */}
          <div className="mt-4 p-6 rounded-lg relative overflow-hidden border-2 border-cyan-400/20 dark:border-cyan-400/40 bg-gradient-to-r from-slate-900/80 via-slate-800/60 to-slate-900/80 dark:from-gray-900/90 dark:via-gray-800/70 dark:to-gray-900/90 backdrop-blur-sm">
            {/* Cyberpunk glow effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/10 to-blue-500/5 dark:from-cyan-400/10 dark:via-purple-400/15 dark:to-blue-400/10"></div>
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-40"></div>

            <div className="relative flex items-center justify-between">
              <div className="space-y-2">
                <h3 className={`text-xl font-bold tracking-wide ${darkMode ? "text-cyan-300" : "text-slate-100"} drop-shadow-lg`}>
                  総合確信度
                </h3>
                <div className="h-px w-16 bg-gradient-to-r from-cyan-400 to-purple-400 opacity-70"></div>
                <p className={`text-sm leading-relaxed max-w-md ${darkMode ? "text-cyan-100/80" : "text-slate-200/90"}`}>
                  {feedback.confidence_reason}
                </p>
              </div>
              <div className="text-right space-y-2">
                <div className={`text-4xl font-black flex items-center justify-end ${getScoreColor(feedback.overall_confidence)} drop-shadow-xl filter brightness-110`}>
                  {getScoreIcon(feedback.overall_confidence)}
                  <span className="ml-3 tabular-nums tracking-tight">{(feedback.overall_confidence * 100).toFixed(0)}%</span>
                </div>
                <div className={`text-sm font-semibold tracking-wider uppercase ${getScoreColor(feedback.overall_confidence)} opacity-90`}>
                  {getScoreLabel(feedback.overall_confidence)}
                </div>
                {/* Progress bar */}
                <div className="w-32 h-2 bg-slate-700/50 dark:bg-gray-600/50 rounded-full overflow-hidden border border-cyan-400/30">
                  <div
                    className={`h-full transition-all duration-1000 ease-out ${
                      feedback.overall_confidence >= 0.8 ? "bg-gradient-to-r from-green-400 to-emerald-500" :
                      feedback.overall_confidence >= 0.6 ? "bg-gradient-to-r from-yellow-400 to-amber-500" :
                      "bg-gradient-to-r from-red-400 to-red-500"
                    } shadow-lg`}
                    style={{ width: `${feedback.overall_confidence * 100}%` }}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 animate-pulse`}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'overview'
                ? darkMode
                  ? "border-b-2 border-cyan-400 text-cyan-400"
                  : "border-b-2 border-purple-600 text-purple-600"
                : darkMode
                  ? "text-gray-300 hover:text-cyan-400"
                  : "text-gray-600 hover:text-purple-600"
            }`}
          >
            概要
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'details'
                ? darkMode
                  ? "border-b-2 border-cyan-400 text-cyan-400"
                  : "border-b-2 border-purple-600 text-purple-600"
                : darkMode
                  ? "text-gray-300 hover:text-cyan-400"
                  : "text-gray-600 hover:text-purple-600"
            }`}
          >
            詳細分析
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Score Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scoreItems.map((item) => (
                  <div
                    key={item.key}
                    className={`p-4 rounded-lg border ${
                      darkMode
                        ? "bg-gray-700/50 border-gray-600"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`font-medium ${darkMode ? "text-white" : "text-gray-800"}`}>
                        {item.label}
                      </h4>
                      <div className={`flex items-center ${getScoreColor(item.score)}`}>
                        {getScoreIcon(item.score)}
                        <span className="ml-1 font-bold">
                          {(item.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className={`w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2`}>
                      <div
                        className={`h-2 rounded-full ${
                          item.score >= 0.8 ? "bg-green-500" :
                          item.score >= 0.6 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${item.score * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Improvement Suggestions */}
              <div className={`p-4 rounded-lg border ${
                darkMode
                  ? "bg-blue-900/20 border-blue-500/30"
                  : "bg-blue-50 border-blue-200"
              }`}>
                <h4 className={`font-semibold mb-3 flex items-center ${
                  darkMode ? "text-blue-400" : "text-blue-700"
                }`}>
                  <CheckCircle size={18} className="mr-2" />
                  改善提案
                </h4>
                <ul className="space-y-2">
                  {feedback.improvement_suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className={`flex items-start ${
                        darkMode ? "text-blue-300" : "text-blue-600"
                      }`}
                    >
                      <span className="mr-2">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              {scoreItems.map((item) => (
                <div
                  key={item.key}
                  className={`p-4 rounded-lg border ${
                    darkMode
                      ? "bg-gray-700/50 border-gray-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-800"}`}>
                      {item.label}
                    </h4>
                    <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      item.score >= 0.8
                        ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400"
                        : item.score >= 0.6
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400"
                    }`}>
                      {getScoreIcon(item.score)}
                      <span className="ml-1">{(item.score * 100).toFixed(0)}% - {getScoreLabel(item.score)}</span>
                    </div>
                  </div>
                  <p className={`text-sm leading-relaxed ${
                    darkMode ? "text-gray-300" : "text-gray-600"
                  }`}>
                    {item.feedback}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}