"use client";

import { useCallback, useState, useEffect } from "react";
import { RefreshCcw, Loader2, FileText, TrendingUp, GitBranch, Save } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { SpecificationFeedback } from "@/types/modelTypes";
import SpecificationFeedbackModal from "@/components/SpecificationFeedbackModal/SpecificationFeedbackModal";
import {
  FunctionalRequirement,
  QAForRequirement,
  regenerateFunctionalRequirements,
  updateFunctionDocument,
  getFunctionSpecificationFeedback,
  saveFunctionDocument,
  updateFunctionDocWithSpec
} from "@/libs/service/function";
import { BaseEditor } from "@/components/BaseEditor";

const sanitizeFunctionContent = (input: string) =>
  input
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[：]/g, ":")
    .replace(/[、]/g, ",")
    .trim();

interface FunctionEditorProps {
  projectId: string;
  functionDocument: string | null;
  requirements: FunctionalRequirement[];
  overallConfidence: number;
  onDocumentUpdate: (document: string) => void;
  onRequirementsUpdate: (requirements: FunctionalRequirement[]) => void;
  onQuestionsUpdate: (questions: QAForRequirement[]) => void;
  onConfidenceUpdate: (confidence: number) => void;
}

export default function FunctionEditor({
  projectId,
  functionDocument,
  requirements,
  overallConfidence,
  onDocumentUpdate,
  onRequirementsUpdate,
  onQuestionsUpdate,
  onConfidenceUpdate
}: FunctionEditorProps) {
  const { darkMode } = useDarkMode();
  const [regenerating, setRegenerating] = useState(false);
  const [isContentInitialized, setIsContentInitialized] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [specificationFeedback, setSpecificationFeedback] = useState<SpecificationFeedback | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hasSpecificationChanged, setHasSpecificationChanged] = useState(false);
  const [updatingDiff, setUpdatingDiff] = useState(false);
  const [saving, setSaving] = useState(false);

  // 再生成
  const regenerateAndEvaluate = async () => {
    if (!projectId) return;
    setRegenerating(true);
    try {
      const result = await regenerateFunctionalRequirements(projectId, 0.7);

      // ドキュメントを更新
      if (result.requirements && result.requirements.length > 0) {
        // 要件をMarkdown形式に変換
        const markdownContent = formatRequirementsAsMarkdown(result.requirements);
        onDocumentUpdate(markdownContent);
        setIsContentInitialized(false); // エディターを再初期化
      }

      // 状態を更新
      onRequirementsUpdate(result.requirements);
      onConfidenceUpdate(result.overall_confidence);
      onQuestionsUpdate(result.clarification_questions);

    } catch (error) {
      console.error("機能要件の再生成に失敗:", error);
      alert("機能要件の再生成に失敗しました");
    } finally {
      setRegenerating(false);
    }
  };

  // 仕様書フィードバック取得
  const handleGetFeedback = async () => {
    setLoadingFeedback(true);
    try {
      const feedback = await getFunctionSpecificationFeedback(projectId);
      setSpecificationFeedback(feedback);
      setShowFeedbackModal(true);
    } catch (error) {
      console.error("仕様書フィードバックの取得に失敗:", error);
      alert("仕様書フィードバックの取得に失敗しました");
    } finally {
      setLoadingFeedback(false);
    }
  };

  // 差分更新
  const handleDifferentialUpdate = async () => {
    if (!projectId) return;
    setUpdatingDiff(true);
    try {
      const result = await updateFunctionDocWithSpec(projectId);
      onDocumentUpdate(result.function_doc);
      setHasSpecificationChanged(false);
      setIsContentInitialized(false);
      alert("差分更新が完了しました");
    } catch (error) {
      console.error("差分更新に失敗:", error);
      alert("差分更新に失敗しました");
    } finally {
      setUpdatingDiff(false);
    }
  };

  // 保存
  const handleSave = async () => {
    if (!functionDocument) return;
    setSaving(true);
    try {
      await saveFunctionDocument(projectId, functionDocument);
      setIsDirty(false);
      alert("保存が完了しました");
    } catch (error) {
      console.error("保存に失敗:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 仕様書の変更を検知
  useEffect(() => {
    // TODO: 実装時にproject_documentから仕様書と機能要件の更新日時を比較
    // 現在は手動でトリガーする想定
    setHasSpecificationChanged(false);
  }, [projectId]);

  // コンテンツ変更の検知
  useEffect(() => {
    if (functionDocument) {
      setIsDirty(true);
    }
  }, [functionDocument]);

  // 要件をMarkdown形式に変換
  const formatRequirementsAsMarkdown = (reqs: FunctionalRequirement[]): string => {
    let md = "# 機能要件書\n\n";

    // カテゴリ別にグループ化
    const categories: { [key: string]: FunctionalRequirement[] } = {};
    reqs.forEach(req => {
      const category = req.category || "その他";
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(req);
    });

    Object.entries(categories).forEach(([category, categoryReqs]) => {
      md += `## ${category}\n\n`;

      categoryReqs.forEach(req => {
        md += `### ${req.title}\n\n`;
        md += `**要件ID:** ${req.requirement_id}\n\n`;
        md += `**優先度:** ${req.priority}\n\n`;
        md += `**確信度:** ${req.confidence_level?.toFixed(2) || "N/A"}\n\n`;
        md += `**説明:**\n${req.description}\n\n`;

        if (req.acceptance_criteria && req.acceptance_criteria.length > 0) {
          md += "**受入基準:**\n";
          req.acceptance_criteria.forEach(criteria => {
            md += `- ${criteria}\n`;
          });
          md += "\n";
        }

        if (req.dependencies && req.dependencies.length > 0) {
          md += `**依存関係:** ${req.dependencies.join(", ")}\n\n`;
        }

        md += "---\n\n";
      });
    });

    return md;
  };

  // コンテンツ変更処理
  const handleContentChange = useCallback(async (markdown: string) => {
    if (!functionDocument) return;

    try {
      await updateFunctionDocument(projectId, markdown);
      onDocumentUpdate(markdown);
    } catch (error) {
      console.error("機能要件ドキュメントの更新に失敗:", error);
    }
  }, [functionDocument, projectId, onDocumentUpdate]);

  // ヘッダーアクション
  const headerActions = (
    <div className="flex items-center space-x-2">
      <div className={`px-3 py-1 rounded-full text-sm ${
        overallConfidence >= 0.8
          ? darkMode ? "bg-green-900/50 text-green-400" : "bg-green-100 text-green-700"
          : overallConfidence >= 0.6
          ? darkMode ? "bg-yellow-900/50 text-yellow-400" : "bg-yellow-100 text-yellow-700"
          : darkMode ? "bg-red-900/50 text-red-400" : "bg-red-100 text-red-700"
      }`}>
        {overallConfidence >= 0.8 ? "高確信" : overallConfidence >= 0.6 ? "中確信" : "要改善"}
      </div>
      <div className={`px-3 py-1 rounded-full text-sm ${
        darkMode ? "bg-cyan-900/50 text-cyan-400" : "bg-purple-100 text-purple-700"
      }`}>
        確信度: {(overallConfidence * 100).toFixed(0)}%
      </div>
      <div className={`px-3 py-1 rounded-full text-sm ${
        darkMode ? "bg-blue-900/50 text-blue-400" : "bg-blue-100 text-blue-700"
      }`}>
        要件数: {requirements.length}
      </div>
    </div>
  );

  // フッターアクション
  const footerActions = (
    <div className="flex justify-center gap-3">
      <button
        onClick={handleDifferentialUpdate}
        disabled={!hasSpecificationChanged || updatingDiff}
        className={`px-6 py-2 flex items-center rounded-lg shadow focus:outline-none transform transition ${
          !hasSpecificationChanged || updatingDiff
            ? "cursor-not-allowed opacity-70 bg-gray-300"
            : "hover:-translate-y-0.5"
        } ${
          hasSpecificationChanged && !updatingDiff
            ? darkMode
              ? "bg-blue-500 hover:bg-blue-600 text-white focus:ring-2 focus:ring-blue-400"
              : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white focus:ring-2 focus:ring-blue-400"
            : ""
        }`}
      >
        {updatingDiff ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            更新中...
          </>
        ) : (
          <>
            <GitBranch size={16} className="mr-2" />
            差分更新
          </>
        )}
      </button>

      <button
        onClick={handleSave}
        disabled={!isDirty || saving || !functionDocument}
        className={`px-6 py-2 flex items-center rounded-lg shadow focus:outline-none transform transition ${
          !isDirty || saving || !functionDocument
            ? "cursor-not-allowed opacity-70 bg-gray-300"
            : "hover:-translate-y-0.5"
        } ${
          isDirty && !saving && functionDocument
            ? darkMode
              ? "bg-green-500 hover:bg-green-600 text-white focus:ring-2 focus:ring-green-400"
              : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white focus:ring-2 focus:ring-green-400"
            : ""
        }`}
      >
        {saving ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            保存中...
          </>
        ) : (
          <>
            <Save size={16} className="mr-2" />
            保存
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
            機能要件を再生成
          </>
        )}
      </button>

      <button
        onClick={handleGetFeedback}
        disabled={loadingFeedback || !functionDocument}
        className={`px-6 py-2 flex items-center rounded-lg shadow focus:outline-none transform transition ${
          loadingFeedback || !functionDocument
            ? "cursor-not-allowed opacity-70"
            : "hover:-translate-y-0.5"
        } ${
          darkMode
            ? "bg-teal-500 hover:bg-teal-600 text-gray-900 focus:ring-2 focus:ring-teal-400"
            : "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white focus:ring-2 focus:ring-teal-400"
        } ${
          loadingFeedback && (darkMode ? "bg-teal-600" : "from-teal-600 to-emerald-700")
        }`}
      >
        {loadingFeedback ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            分析中...
          </>
        ) : (
          <>
            <TrendingUp size={16} className="mr-2" />
            確信度分析
          </>
        )}
      </button>
    </div>
  );

  return (
    <div
      className={`flex-1 backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
        darkMode
          ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
          : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
      }`}
    >
      <BaseEditor
        content={functionDocument}
        placeholder="機能要件を記述してください..."
        onContentChange={handleContentChange}
        title="機能要件編集"
        icon={FileText}
        headerActions={headerActions}
        footerActions={footerActions}
        sanitizeContent={sanitizeFunctionContent}
        isContentInitialized={isContentInitialized}
        onContentInitialized={() => setIsContentInitialized(true)}
        containerClassName="p-0"
        className="p-0"
      />

      {/* Confidence Feedback Modal */}
      {showFeedbackModal && specificationFeedback && (
        <SpecificationFeedbackModal
          feedback={specificationFeedback}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </div>
  );
}