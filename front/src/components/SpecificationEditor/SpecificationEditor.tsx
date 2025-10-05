"use client";

import { useCallback, useState } from "react";
import { RefreshCcw, Loader2, Edit3, TrendingUp } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { ProjectDocumentType, ConfidenceFeedback as ConfidenceFeedbackType } from "@/types/modelTypes";
import { patchProjectDocument } from "@/libs/modelAPI/document";
import { evaluateSummary, getConfidenceFeedback, generateSummaryWithFeedback } from "@/libs/service/summary";
import { QAType } from "@/types/modelTypes";
import ConfidenceFeedback from "@/components/ConfidenceFeedback/ConfidenceFeedback";
import { BaseEditor } from "@/components/BaseEditor";

const sanitizeSpecificationContent = (input: string) =>
  input
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[：]/g, ":")
    .replace(/[、]/g, ",")
    .trim();


interface SpecificationEditorProps {
  projectId: string;
  projectDocument: ProjectDocumentType | null;
  score: number;
  mvpFeasible: boolean;
  onDocumentUpdate: (document: ProjectDocumentType) => void;
  onEvaluationUpdate: (evaluation: { qa: QAType[]; score_0_100: number; mvp_feasible: boolean }) => void;
}

export default function SpecificationEditor({
  projectId,
  projectDocument,
  score,
  mvpFeasible,
  onDocumentUpdate,
  onEvaluationUpdate
}: SpecificationEditorProps) {
  const { darkMode } = useDarkMode();
  const [regenerating, setRegenerating] = useState(false);
  const [isContentInitialized, setIsContentInitialized] = useState(false);
  const [loadingConfidenceFeedback, setLoadingConfidenceFeedback] = useState(false);
  const [confidenceFeedback, setConfidenceFeedback] = useState<ConfidenceFeedbackType | null>(null);
  const [showConfidenceFeedback, setShowConfidenceFeedback] = useState(false);

  // 再生成と評価
  const regenerateAndEvaluate = async () => {
    if (!projectId) return;
    setRegenerating(true);
    try {
      const result = await generateSummaryWithFeedback(projectId);

      const updatedDocument = projectDocument ? { ...projectDocument, specification: result.summary } : null;
      if (updatedDocument) {
        onDocumentUpdate(updatedDocument);
      }

      setConfidenceFeedback(result.confidence_feedback);

      const evaluation = await evaluateSummary(projectId);
      onEvaluationUpdate(evaluation);

      setIsContentInitialized(false);
    } catch (error) {
      console.error("評価の取得に失敗:", error);
    } finally {
      setRegenerating(false);
    }
  };

  // 確信度フィードバック取得
  const handleGetConfidenceFeedback = async () => {
    if (!projectDocument?.specification) {
      alert("仕様書が存在しません。先に仕様書を生成してください。");
      return;
    }

    setLoadingConfidenceFeedback(true);
    try {
      const feedback = await getConfidenceFeedback(projectId);
      setConfidenceFeedback(feedback);
      setShowConfidenceFeedback(true);
    } catch (error) {
      console.error("確信度フィードバックの取得に失敗:", error);
      if (error instanceof Error) {
        alert(`確信度フィードバックの取得に失敗しました: ${error.message}`);
      } else {
        alert("確信度フィードバックの取得に失敗しました");
      }
    } finally {
      setLoadingConfidenceFeedback(false);
    }
  };

  // コンテンツ変更処理
  const handleContentChange = useCallback(async (markdown: string) => {
    if (!projectDocument) return;

    try {
      await patchProjectDocument(projectId, {
        specification: markdown
      });

      const updatedDocument = { ...projectDocument, specification: markdown };
      onDocumentUpdate(updatedDocument);
    } catch (error) {
      console.error("仕様書の更新に失敗:", error);
    }
  }, [projectDocument, projectId, onDocumentUpdate]);


  // ヘッダーアクション
  const headerActions = (
    <button
      onClick={handleGetConfidenceFeedback}
      disabled={loadingConfidenceFeedback}
      className={`p-1 rounded transition-colors ${
        loadingConfidenceFeedback
          ? "cursor-not-allowed opacity-50"
          : darkMode
            ? "text-cyan-400 hover:bg-cyan-500/10"
            : "text-purple-700 hover:bg-purple-500/10"
      }`}
      title="確信度を再分析"
    >
      {loadingConfidenceFeedback ? (
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
      ) : (
        <RefreshCcw size={12} />
      )}
    </button>
  );

  // フッターアクション
  const footerActions = (
    <div className="flex justify-center">
      <button
        onClick={regenerateAndEvaluate}
        disabled={regenerating}
        className={`px-6 py-2 flex items-center rounded-lg shadow focus:outline-none transform transition ${
          regenerating
            ? "cursor-not-allowed opacity-70"
            : "hover:-translate-y-0.5"
        } ${
          darkMode
            ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400"
            : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
        } ${
          regenerating && (darkMode ? "bg-cyan-600" : "from-purple-600 to-blue-700")
        }`}
      >
        {regenerating ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            再生成中...
          </>
        ) : (
          <>
            <RefreshCcw size={16} className="mr-2" />
            仕様書を再生成・評価
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="h-full flex gap-4">
      {/* 左サイドバー - 確信度フィードバック */}
      <div
        className={`flex-shrink-0 w-64 backdrop-blur-lg rounded-xl p-3 shadow-xl border transition-all ${
          darkMode
            ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
            : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3
            className={`text-base font-medium flex items-center ${
              darkMode ? "text-cyan-400" : "text-purple-700"
            }`}
          >
            <TrendingUp size={16} className="mr-1" />
            確信度分析
          </h3>
          {confidenceFeedback && headerActions}
        </div>

        {/* 確信度フィードバック詳細表示エリア */}
        {confidenceFeedback ? (
          <div className="space-y-3">
            {/* 総合確信度 */}
            <div className={`p-2 rounded-lg ${
              darkMode ? "bg-gray-700/50" : "bg-gray-50"
            }`}>
              <h4 className={`text-xs font-semibold mb-1 ${
                darkMode ? "text-cyan-300" : "text-purple-600"
              }`}>
                総合確信度
              </h4>
              <div className={`text-xl font-bold ${
                confidenceFeedback.overall_confidence >= 0.8
                  ? darkMode ? "text-green-400" : "text-green-600"
                  : confidenceFeedback.overall_confidence >= 0.6
                  ? darkMode ? "text-yellow-400" : "text-yellow-600"
                  : darkMode ? "text-red-400" : "text-red-600"
              }`}>
                {(confidenceFeedback.overall_confidence * 100).toFixed(0)}%
              </div>
              <p className={`text-xs mt-1 line-clamp-2 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                {confidenceFeedback.confidence_reason}
              </p>
            </div>

            {/* 詳細スコア */}
            <div className="space-y-1">
              <h4 className={`text-xs font-semibold ${
                darkMode ? "text-cyan-300" : "text-purple-600"
              }`}>
                詳細評価
              </h4>
              {[
                { key: 'clarity_score', label: '明確性', feedback: confidenceFeedback.clarity_feedback },
                { key: 'feasibility_score', label: '実現可能性', feedback: confidenceFeedback.feasibility_feedback },
                { key: 'scope_score', label: 'スコープ適切性', feedback: confidenceFeedback.scope_feedback },
                { key: 'value_score', label: 'ユーザー価値', feedback: confidenceFeedback.value_feedback },
                { key: 'completeness_score', label: '完全性', feedback: confidenceFeedback.completeness_feedback },
              ].map((item) => {
                const score = confidenceFeedback[item.key as keyof typeof confidenceFeedback] as number;
                return (
                  <div
                    key={item.key}
                    className={`p-2 rounded border ${
                      darkMode
                        ? "bg-gray-700/30 border-gray-600"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        {item.label}
                      </span>
                      <span className={`text-xs font-bold ${
                        score >= 0.8
                          ? darkMode ? "text-green-400" : "text-green-600"
                          : score >= 0.6
                          ? darkMode ? "text-yellow-400" : "text-yellow-600"
                          : darkMode ? "text-red-400" : "text-red-600"
                      }`}>
                        {(score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className={`w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mb-1`}>
                      <div
                        className={`h-1 rounded-full ${
                          score >= 0.8 ? "bg-green-500" :
                          score >= 0.6 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${score * 100}%` }}
                      />
                    </div>
                    <p className={`text-xs line-clamp-2 ${
                      darkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      {item.feedback}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* 改善提案 */}
            {confidenceFeedback.improvement_suggestions.length > 0 && (
              <div className={`p-2 rounded-lg border ${
                darkMode
                  ? "bg-blue-900/20 border-blue-500/30"
                  : "bg-blue-50 border-blue-200"
              }`}>
                <h4 className={`text-xs font-semibold mb-1 ${
                  darkMode ? "text-blue-400" : "text-blue-700"
                }`}>
                  改善提案
                </h4>
                <ul className="space-y-1">
                  {confidenceFeedback.improvement_suggestions.slice(0, 2).map((suggestion, index) => (
                    <li
                      key={index}
                      className={`text-xs flex items-start ${
                        darkMode ? "text-blue-300" : "text-blue-600"
                      }`}
                    >
                      <span className="mr-1">•</span>
                      <span className="flex-1 line-clamp-2">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 詳細フィードバックボタン */}
            <button
              onClick={() => setShowConfidenceFeedback(true)}
              className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors ${
                darkMode
                  ? "border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  : "border-purple-500/30 text-purple-700 hover:bg-purple-500/10"
              }`}
            >
              詳細フィードバックを表示
            </button>
          </div>
        ) : (
          <div className={`p-3 text-center ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            <div className="mb-2">
              <TrendingUp size={24} className="mx-auto opacity-50" />
            </div>
            <p className="text-xs mb-2">確信度分析がまだ行われていません</p>
            <button
              onClick={handleGetConfidenceFeedback}
              disabled={loadingConfidenceFeedback || !projectDocument?.specification}
              className={`w-full px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center ${
                loadingConfidenceFeedback || !projectDocument?.specification
                  ? "cursor-not-allowed opacity-50"
                  : darkMode
                    ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              {loadingConfidenceFeedback ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                  分析中...
                </>
              ) : (
                <>
                  <TrendingUp size={12} className="mr-1" />
                  分析を開始
                </>
              )}
            </button>
          </div>
        )}

        {/* MVP実現可能性とスコア */}
        <div className="mt-3 space-y-2">
          <div className={`px-2 py-1.5 rounded text-xs ${
            mvpFeasible
              ? darkMode ? "bg-green-900/50 text-green-400" : "bg-green-100 text-green-700"
              : darkMode ? "bg-red-900/50 text-red-400" : "bg-red-100 text-red-700"
          }`}>
            MVP実現性: {mvpFeasible ? "実現可能" : "要改善"}
          </div>
          <div className={`px-2 py-1.5 rounded text-xs ${
            darkMode ? "bg-cyan-900/50 text-cyan-400" : "bg-purple-100 text-purple-700"
          }`}>
            評価スコア: {score}/100
          </div>
        </div>
      </div>

      {/* メイン編集エリア */}
      <div className="flex-1 flex flex-col max-w-none">
        <BaseEditor
          content={projectDocument?.specification}
          placeholder="仕様書を記述してください..."
          onContentChange={handleContentChange}
          title="仕様書編集"
          icon={Edit3}
          sanitizeContent={sanitizeSpecificationContent}
          isContentInitialized={isContentInitialized}
          onContentInitialized={() => setIsContentInitialized(true)}
          footerActions={footerActions}
        />
      </div>

      {/* Confidence Feedback Modal */}
      {showConfidenceFeedback && confidenceFeedback && (
        <ConfidenceFeedback
          feedback={confidenceFeedback}
          onClose={() => setShowConfidenceFeedback(false)}
        />
      )}
    </div>
  );
}