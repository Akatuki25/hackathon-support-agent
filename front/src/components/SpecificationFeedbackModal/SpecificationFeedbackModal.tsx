import { X, AlertCircle, CheckCircle, Lightbulb, Star } from "lucide-react";
import { SpecificationFeedback } from "@/types/modelTypes";

interface SpecificationFeedbackModalProps {
  feedback: SpecificationFeedback;
  onClose: () => void;
}

export default function SpecificationFeedbackModal({
  feedback,
  onClose
}: SpecificationFeedbackModalProps) {

  const getPriorityColor = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
      case "medium":
        return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20";
      case "low":
        return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20";
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
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h2 className="text-xl font-bold">仕様書評価レポート</h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-purple-700 dark:text-cyan-400">
              <CheckCircle size={20} />
              総合評価
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              {feedback.summary}
            </p>
          </section>

          {/* Strengths */}
          {feedback.strengths.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                <Star size={20} />
                仕様書の強み
              </h3>
              <ul className="space-y-2">
                {feedback.strengths.map((strength, index) => (
                  <li
                    key={index}
                    className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20"
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
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertCircle size={20} />
                不足している情報 ({feedback.missing_info.length}件)
              </h3>
              <div className="space-y-3">
                {feedback.missing_info.map((info, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-gray-200 dark:bg-gray-600">
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">
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
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Lightbulb size={20} />
                改善提案
              </h3>
              <ul className="space-y-2">
                {feedback.suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20"
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
        <div className="sticky bottom-0 flex justify-end p-4 border-t bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
