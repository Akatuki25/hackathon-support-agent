"use client";

import { useCallback, useState, useEffect } from "react";
import { RefreshCcw, Loader2, Edit3 } from "lucide-react";
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
  /** 仕様書がストリーミング生成中かどうか */
  isStreaming?: boolean;
  /** フィードバック更新時のコールバック */
  onFeedbackUpdate?: (feedback: SpecificationFeedback | null) => void;
}

export default function SpecificationEditor({
  projectId,
  projectDocument,
  onDocumentUpdate,
  onEvaluationUpdate,
  isStreaming = false,
  onFeedbackUpdate,
}: SpecificationEditorProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [isContentInitialized, setIsContentInitialized] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [specificationFeedback, setSpecificationFeedback] = useState<SpecificationFeedback | null>(null);

  // フィードバック更新のヘルパー
  const updateFeedback = (feedback: SpecificationFeedback | null) => {
    setSpecificationFeedback(feedback);
    onFeedbackUpdate?.(feedback);
  };

  // 初回ロード時にフィードバックを取得（ストリーミング中はスキップ）
  useEffect(() => {
    const loadInitialFeedback = async () => {
      // ストリーミング中またはdoc_idがない場合はスキップ
      if (isStreaming || !projectDocument?.doc_id) return;
      if (projectDocument?.specification && !specificationFeedback) {
        try {
          const feedback = await getSpecificationFeedback(projectId);
          updateFeedback(feedback);
        } catch (error) {
          console.log("初回フィードバック取得をスキップ:", error);
        }
      }
    };
    loadInitialFeedback();
    // specificationFeedbackを依存配列に含めると無限ループになるため除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDocument?.specification, projectId, isStreaming, projectDocument?.doc_id]);

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

      updateFeedback(result.specification_feedback);

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
      updateFeedback(feedback);
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
    // ストリーミング中またはドキュメントがない場合は保存しない
    if (!projectDocument || isStreaming || !projectDocument.doc_id) return;

    try {
      await patchProjectDocument(projectId, {
        specification: markdown
      });

      const updatedDocument = { ...projectDocument, specification: markdown };
      onDocumentUpdate(updatedDocument);
    } catch (error) {
      console.error("仕様書の更新に失敗:", error);
    }
  }, [projectDocument, projectId, onDocumentUpdate, isStreaming]);


  // フッターアクション
  const footerActions = (
    <div className="flex justify-between items-center">
      {isStreaming ? (
        <div className="flex items-center text-purple-600 dark:text-cyan-400">
          <Loader2 size={16} className="mr-2 animate-spin" />
          仕様書を生成中...
        </div>
      ) : (
        <>
          <button
            onClick={handleGetFeedback}
            disabled={loadingFeedback || !projectDocument?.specification}
            className={`px-4 py-2 flex items-center rounded-lg text-sm transition ${
              loadingFeedback || !projectDocument?.specification
                ? "cursor-not-allowed opacity-50"
                : "bg-gray-100 hover:bg-gray-200 text-purple-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-cyan-400"
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
            } bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400 dark:bg-cyan-500 dark:hover:bg-cyan-600 dark:text-gray-900 dark:focus:ring-cyan-400 dark:from-cyan-500 dark:to-cyan-500 ${
              regenerating ? "from-purple-600 to-blue-700 dark:bg-cyan-600" : ""
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
        </>
      )}
    </div>
  );

  return (
    <div className="h-full">
      <BaseEditor
        content={projectDocument?.specification}
        placeholder="仕様書を記述してください..."
        onContentChange={handleContentChange}
        title="仕様書編集"
        icon={Edit3}
        sanitizeContent={sanitizeSpecificationContent}
        isContentInitialized={isContentInitialized}
        onContentInitialized={() => setIsContentInitialized(true)}
        isStreaming={isStreaming}
        footerActions={footerActions}
      />
    </div>
  );
}
