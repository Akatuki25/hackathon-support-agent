"use client";

import { useCallback, useState, useEffect } from "react";
import { RefreshCcw, Loader2, Edit3 } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { ProjectDocumentType, SpecificationFeedback } from "@/types/modelTypes";
import { patchProjectDocument } from "@/libs/modelAPI/document";
import { evaluateSummary, getSpecificationFeedback, generateSummaryWithFeedback } from "@/libs/service/summary";
import { QAType } from "@/types/modelTypes";
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
  score?: number;
  mvpFeasible?: boolean;
  onDocumentUpdate: (document: ProjectDocumentType) => void;
  onEvaluationUpdate: (evaluation: { qa: QAType[]; score_0_100: number; mvp_feasible: boolean }) => void;
}

export default function SpecificationEditor({
  projectId,
  projectDocument,
  onDocumentUpdate,
  onEvaluationUpdate
}: SpecificationEditorProps) {
  const { darkMode } = useDarkMode();
  const [regenerating, setRegenerating] = useState(false);
  const [isContentInitialized, setIsContentInitialized] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [specificationFeedback, setSpecificationFeedback] = useState<SpecificationFeedback | null>(null);

  // 初回ロード時にフィードバックを取得
  useEffect(() => {
    const loadInitialFeedback = async () => {
      if (projectDocument?.specification && !specificationFeedback) {
        try {
          const feedback = await getSpecificationFeedback(projectId);
          setSpecificationFeedback(feedback);
        } catch (error) {
          console.log("初回フィードバック取得をスキップ:", error);
        }
      }
    };
    loadInitialFeedback();
  }, [projectDocument?.specification, projectId]);

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

      setSpecificationFeedback(result.specification_feedback);

      const evaluation = await evaluateSummary(projectId);
      onEvaluationUpdate(evaluation);

      setIsContentInitialized(false);
    } catch (error) {
      console.error("評価の取得に失敗:", error);
    } finally {
      setRegenerating(false);
    }
  };

  // 仕様書フィードバック取得（再分析）
  const handleGetFeedback = async () => {
    if (!projectDocument?.specification) {
      alert("仕様書が存在しません。先に仕様書を生成してください。");
      return;
    }

    setLoadingFeedback(true);
    try {
      const feedback = await getSpecificationFeedback(projectId);
      setSpecificationFeedback(feedback);
    } catch (error) {
      console.error("仕様書フィードバックの取得に失敗:", error);
      if (error instanceof Error) {
        alert(`仕様書フィードバックの取得に失敗しました: ${error.message}`);
      } else {
        alert("仕様書フィードバックの取得に失敗しました");
      }
    } finally {
      setLoadingFeedback(false);
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


  // フッターアクション
  const footerActions = (
    <div className="flex justify-between items-center">
      <button
        onClick={handleGetFeedback}
        disabled={loadingFeedback || !projectDocument?.specification}
        className={`px-4 py-2 flex items-center rounded-lg text-sm transition ${
          loadingFeedback || !projectDocument?.specification
            ? "cursor-not-allowed opacity-50"
            : darkMode
              ? "bg-gray-700 hover:bg-gray-600 text-cyan-400"
              : "bg-gray-100 hover:bg-gray-200 text-purple-700"
        }`}
      >
        {loadingFeedback ? (
          <>
            <Loader2 size={14} className="mr-2 animate-spin" />
            分析中...
          </>
        ) : (
          <>
            <RefreshCcw size={14} className="mr-2" />
            仕様書を分析
          </>
        )}
      </button>

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
    <div className="h-full flex flex-col gap-4">
      {/* メイン編集エリア */}
      <div className="flex-1">
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

      {/* インラインフィードバック表示 */}
      {specificationFeedback && (
        <div className={`rounded-lg border p-6 space-y-4 ${
          darkMode
            ? "bg-gray-800/50 border-cyan-500/30"
            : "bg-white/80 border-purple-500/30"
        }`}>
          <h3 className={`text-lg font-bold flex items-center ${
            darkMode ? "text-cyan-300" : "text-purple-700"
          }`}>
            📊 仕様書ガイドライン
          </h3>

          {/* 総合評価 */}
          <div className="space-y-2">
            <h4 className={`font-semibold ${darkMode ? "text-cyan-400" : "text-purple-600"}`}>
              総合評価
            </h4>
            <p className={darkMode ? "text-gray-300" : "text-gray-700"}>
              {specificationFeedback.summary}
            </p>
          </div>

          {/* 強み */}
          {specificationFeedback.strengths && specificationFeedback.strengths.length > 0 && (
            <div className="space-y-2">
              <h4 className={`font-semibold ${darkMode ? "text-green-400" : "text-green-600"}`}>
                ✅ 強み
              </h4>
              <ul className={`list-disc list-inside space-y-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                {specificationFeedback.strengths.map((strength, index) => (
                  <li key={index}>{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 改善提案 */}
          {specificationFeedback.suggestions && specificationFeedback.suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className={`font-semibold ${darkMode ? "text-yellow-400" : "text-yellow-600"}`}>
                💡 改善提案
              </h4>
              <ul className={`list-disc list-inside space-y-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                {specificationFeedback.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}