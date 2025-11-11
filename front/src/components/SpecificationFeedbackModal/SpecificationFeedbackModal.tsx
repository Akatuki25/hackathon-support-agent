"use client";

import { X, AlertCircle, CheckCircle, Lightbulb, Star } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { SpecificationFeedback } from "@/types/modelTypes";

interface SpecificationFeedbackModalProps {
  feedback: SpecificationFeedback;
  onClose: () => void;
}

export default function SpecificationFeedbackModal({
  feedback,
  onClose
}: SpecificationFeedbackModalProps) {
  const { darkMode } = useDarkMode();

  const getPriorityColor = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return darkMode ? "text-red-400 bg-red-900/20" : "text-red-600 bg-red-100";
      case "medium":
        return darkMode ? "text-yellow-400 bg-yellow-900/20" : "text-yellow-600 bg-yellow-100";
      case "low":
        return darkMode ? "text-blue-400 bg-blue-900/20" : "text-blue-600 bg-blue-100";
    }
  };

  const getPriorityLabel = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return "高";
      case "medium":
        return "中";
      case "low":
        return "低";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl ${
          darkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
        }`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}>
          <h2 className="text-xl font-bold">仕様書評価レポート</h2>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary */}
          <section>
            <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
              darkMode ? "text-cyan-400" : "text-purple-700"
            }`}>
              <CheckCircle size={20} />
              総合評価
            </h3>
            <p className={darkMode ? "text-gray-300" : "text-gray-700"}>
              {feedback.summary}
            </p>
          </section>

          {/* Strengths */}
          {feedback.strengths.length > 0 && (
            <section>
              <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                darkMode ? "text-green-400" : "text-green-600"
              }`}>
                <Star size={20} />
                仕様書の強み
              </h3>
              <ul className="space-y-2">
                {feedback.strengths.map((strength, index) => (
                  <li
                    key={index}
                    className={`p-3 rounded-lg ${
                      darkMode ? "bg-green-900/20" : "bg-green-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle size={16} className="mt-1 flex-shrink-0" />
                      <span>{strength}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Missing Information */}
          {feedback.missing_info.length > 0 && (
            <section>
              <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                darkMode ? "text-yellow-400" : "text-yellow-600"
              }`}>
                <AlertCircle size={20} />
                不足している情報 ({feedback.missing_info.length}件)
              </h3>
              <div className="space-y-3">
                {feedback.missing_info.map((info, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      darkMode
                        ? "bg-gray-700/50 border-gray-600"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          darkMode ? "bg-gray-600" : "bg-gray-200"
                        }`}>
                          {info.category}
                        </span>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          getPriorityColor(info.priority)
                        }`}>
                          優先度: {getPriorityLabel(info.priority)}
                        </span>
                      </div>
                    </div>
                    <h4 className="font-semibold mb-2">{info.question}</h4>
                    <p className={`text-sm ${
                      darkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      {info.why_needed}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Suggestions */}
          {feedback.suggestions.length > 0 && (
            <section>
              <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                darkMode ? "text-blue-400" : "text-blue-600"
              }`}>
                <Lightbulb size={20} />
                改善提案
              </h3>
              <ul className="space-y-2">
                {feedback.suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className={`p-3 rounded-lg ${
                      darkMode ? "bg-blue-900/20" : "bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb size={16} className="mt-1 flex-shrink-0" />
                      <span>{suggestion}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 flex justify-end p-4 border-t ${
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              darkMode
                ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
