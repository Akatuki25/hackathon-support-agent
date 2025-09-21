"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, Loader2, Edit3, TrendingUp } from "lucide-react";
import { blocksToMarkdown, markdownToBlocks } from "@blocknote/core";
import type { Block as BlockType, PartialBlock as PartialBlockType } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import { useDarkMode } from "@/hooks/useDarkMode";
import { ProjectDocumentType, ConfidenceFeedback as ConfidenceFeedbackType } from "@/types/modelTypes";
import { patchProjectDocument } from "@/libs/modelAPI/document";
import { evaluateSummary, getConfidenceFeedback, generateSummaryWithFeedback } from "@/libs/service/summary";
import { QAType } from "@/types/modelTypes";
import ConfidenceFeedback from "@/components/ConfidenceFeedback/ConfidenceFeedback";

const sanitizeSpecificationContent = (input: string) =>
  input
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[：]/g, ":")
    .replace(/[、]/g, ",")
    .trim();

const createPlainParagraphBlock = (text: string) => ({
  type: "paragraph" as const,
  content: text ? [text] : [],
});

const convertBlocksToPartial = (blocks: BlockType[]): PartialBlockType[] =>
  blocks.map((block) => {
    const partial = {
      id: block.id,
      type: block.type,
      props: block.props,
      content: block.content,
      children:
        block.children && block.children.length > 0
          ? convertBlocksToPartial(block.children as BlockType[])
          : undefined,
    } as unknown as PartialBlockType;

    return partial;
  });

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
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [loadingConfidenceFeedback, setLoadingConfidenceFeedback] = useState(false);
  const [confidenceFeedback, setConfidenceFeedback] = useState<ConfidenceFeedbackType | null>(null);
  const [showConfidenceFeedback, setShowConfidenceFeedback] = useState(false);

  // BlockNote エディターの初期化
  const editor = useCreateBlockNote({
    initialContent: [createPlainParagraphBlock("仕様書を記述してください...")],
    domAttributes: {
      editor: {
        class: "focus:outline-none",
      },
    },
  });

  // エディターのコンテンツを初期化
  useEffect(() => {
    const loadSpecificationContent = async () => {
      if (!projectDocument?.specification || !editor || !editor.document || !projectDocument.specification.trim() || isContentInitialized) {
        return;
      }

      try {
        // Markdownの内容をサニタイズして問題のある文字を修正
        const sanitizedContent = sanitizeSpecificationContent(projectDocument.specification);
        const parsedBlocks = await markdownToBlocks(sanitizedContent, editor.pmSchema);

        if (parsedBlocks && parsedBlocks.length > 0) {
          editor.replaceBlocks(
            editor.document,
            convertBlocksToPartial(parsedBlocks as unknown as BlockType[])
          );
        } else {
          console.warn("Markdown解析結果が空です。プレーンテキストとして設定します。");
          editor.replaceBlocks(editor.document, [createPlainParagraphBlock(sanitizedContent)]);
        }
      } catch (error) {
        console.warn("マークダウン解析に失敗:", error);
        try {
          editor.replaceBlocks(editor.document, [createPlainParagraphBlock(projectDocument.specification)]);
        } catch (fallbackError) {
          console.error("フォールバック処理も失敗:", fallbackError);
        }
      } finally {
        setIsContentInitialized(true);
      }
    };

    void loadSpecificationContent();
  }, [projectDocument?.specification, editor, isContentInitialized]);

  // 再生成と評価
  const regenerateAndEvaluate = async () => {
    if (!projectId) return;
    setRegenerating(true);
    try {
      // 新しいAPIを使用して要約とフィードバックを同時に取得
      const result = await generateSummaryWithFeedback(projectId);

      const updatedDocument = projectDocument ? { ...projectDocument, specification: result.summary } : null;
      if (updatedDocument) {
        onDocumentUpdate(updatedDocument);
      }

      // フィードバックを保存
      setConfidenceFeedback(result.confidence_feedback);

      const evaluation = await evaluateSummary(projectId);
      onEvaluationUpdate(evaluation);

      // エディターの内容を再初期化
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
      // エラーメッセージをより詳しく表示
      if (error instanceof Error) {
        alert(`確信度フィードバックの取得に失敗しました: ${error.message}`);
      } else {
        alert("確信度フィードバックの取得に失敗しました");
      }
    } finally {
      setLoadingConfidenceFeedback(false);
    }
  };

  // BlockNote エディターの変更処理
  const handleBlockNoteChange = useCallback(async () => {
    if (!projectDocument || !editor || !editor.document) return;

    // 前のタイマーをクリア
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    // 新しいタイマーを設定（デバウンス処理）
    const newTimer = setTimeout(async () => {
      try {
        if (!editor.document) return;

        const markdown = await blocksToMarkdown(
          editor.document,
          editor.pmSchema,
          editor,
          { document: typeof document === "undefined" ? undefined : document }
        );

        // 内容が変わっていない場合は保存しない
        if (markdown === projectDocument.specification) {
          return;
        }

        await patchProjectDocument(projectId, {
          specification: markdown
        });

        const updatedDocument = projectDocument ? { ...projectDocument, specification: markdown } : null;
        if (updatedDocument) {
          onDocumentUpdate(updatedDocument);
        }
      } catch (error) {
        console.error("サマリーの更新に失敗:", error);
      }
    }, 1000);

    setSaveTimer(newTimer);
  }, [projectDocument, editor, projectId, saveTimer, onDocumentUpdate]);

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
    };
  }, [saveTimer]);

  return (
    <div className="h-full flex gap-4">
      {/* 左サイドバー - 確信度フィードバック (1/7比率) */}
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
          {confidenceFeedback && (
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
          )}
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

      {/* メイン編集エリア - 仕様書編集 (4/7比率) */}
      <div className="flex-1 flex flex-col max-w-none">
        {/* ヘッダー */}
        <div
          className={`backdrop-blur-lg rounded-xl p-4 shadow-xl border transition-all mb-4 ${
            darkMode
              ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
              : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
          }`}
        >
          <h2
            className={`text-xl font-medium flex items-center ${
              darkMode ? "text-cyan-400" : "text-purple-700"
            }`}
          >
            <Edit3 size={20} className="mr-2" />
            仕様書編集
          </h2>
        </div>

        {/* エディターエリア */}
        <div
          className={`flex-1 backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
            darkMode
              ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
              : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
          }`}
        >

      {projectDocument ? (
        <div className="custom-blocknote">
          <style jsx global>{`
            .custom-blocknote .bn-container {
              background-color: ${darkMode ? '#1f2937' : '#f8fafc'} !important;
              border: 1px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
              border-radius: 0.5rem !important;
              min-height: 400px !important;
            }

            .custom-blocknote .bn-container[data-color-scheme="${darkMode ? 'dark' : 'light'}"] {
              --bn-colors-editor-text: ${darkMode ? '#e2e8f0' : '#1f2937'};
              --bn-colors-editor-background: ${darkMode ? '#1f2937' : '#f8fafc'};
              --bn-colors-menu-background: ${darkMode ? '#111827' : '#ffffff'};
              --bn-colors-menu-text: ${darkMode ? '#e2e8f0' : '#1f2937'};
              --bn-colors-tooltip-background: ${darkMode ? '#111827' : '#ffffff'};
              --bn-colors-tooltip-text: ${darkMode ? '#e2e8f0' : '#1f2937'};
              --bn-colors-hovered: ${darkMode ? '#0f766e' : '#c4b5fd'};
              --bn-colors-selected: ${darkMode ? '#06b6d4' : '#9333ea'};
              --bn-colors-border: ${darkMode ? '#06b6d4' : '#9333ea'};
              --bn-colors-side-menu: ${darkMode ? '#e2e8f0' : '#1f2937'};
              --bn-colors-highlights-gray-background: ${darkMode ? '#374151' : '#f3f4f6'};
              --bn-colors-highlights-gray-text: ${darkMode ? '#e2e8f0' : '#1f2937'};
              --bn-colors-highlights-red-background: ${darkMode ? '#dc2626' : '#fca5a5'};
              --bn-colors-highlights-red-text: ${darkMode ? '#ffffff' : '#7f1d1d'};
              --bn-colors-highlights-orange-background: ${darkMode ? '#ea580c' : '#fdba74'};
              --bn-colors-highlights-orange-text: ${darkMode ? '#ffffff' : '#9a3412'};
              --bn-colors-highlights-yellow-background: ${darkMode ? '#ca8a04' : '#fde047'};
              --bn-colors-highlights-yellow-text: ${darkMode ? '#ffffff' : '#a16207'};
              --bn-colors-highlights-green-background: ${darkMode ? '#16a34a' : '#86efac'};
              --bn-colors-highlights-green-text: ${darkMode ? '#ffffff' : '#166534'};
              --bn-colors-highlights-blue-background: ${darkMode ? '#2563eb' : '#93c5fd'};
              --bn-colors-highlights-blue-text: ${darkMode ? '#ffffff' : '#1e40af'};
              --bn-colors-highlights-purple-background: ${darkMode ? '#9333ea' : '#c4b5fd'};
              --bn-colors-highlights-purple-text: ${darkMode ? '#ffffff' : '#6b21a8'};
              --bn-colors-highlights-pink-background: ${darkMode ? '#ec4899' : '#f9a8d4'};
              --bn-colors-highlights-pink-text: ${darkMode ? '#ffffff' : '#be185d'};
              --bn-border-radius: 0.5rem;
              --bn-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            }

            .custom-blocknote .ProseMirror {
              padding: 1rem !important;
              min-height: 360px !important;
              color: ${darkMode ? '#e2e8f0' : '#1f2937'} !important;
              outline: none !important;
            }

            .custom-blocknote .ProseMirror:focus {
              outline: none !important;
              box-shadow: none !important;
            }

            /* スラッシュメニュー修正 */
            .custom-blocknote .bn-suggestion-menu {
              z-index: 1000 !important;
              background-color: ${darkMode ? '#111827' : '#ffffff'} !important;
              border: 1px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
              border-radius: 0.5rem !important;
            }

            .custom-blocknote .bn-suggestion-menu-item {
              color: ${darkMode ? '#e2e8f0' : '#1f2937'} !important;
            }

            .custom-blocknote .bn-suggestion-menu-item[aria-selected="true"] {
              background-color: ${darkMode ? '#0f766e' : '#c4b5fd'} !important;
              color: #ffffff !important;
            }

            .custom-blocknote .ProseMirror h1 {
              color: ${darkMode ? '#f472b6' : '#3b82f6'} !important;
              border-bottom: 1px solid ${darkMode ? '#f472b6' : '#3b82f6'} !important;
              padding-bottom: 0.3em !important;
              margin-top: 1.5em !important;
              margin-bottom: 0.5em !important;
              font-weight: bold !important;
            }

            .custom-blocknote .ProseMirror h2,
            .custom-blocknote .ProseMirror h3 {
              color: ${darkMode ? '#5eead4' : '#7c3aed'} !important;
              border-bottom: 1px solid ${darkMode ? '#0f766e' : '#c4b5fd'} !important;
              padding-bottom: 0.3em !important;
              margin-top: 1.5em !important;
              margin-bottom: 0.5em !important;
              font-weight: bold !important;
            }

            .custom-blocknote .ProseMirror code {
              background-color: ${darkMode ? '#1f2937' : '#f3f4f6'} !important;
              color: ${darkMode ? '#5eead4' : '#7c3aed'} !important;
              padding: 0.2em 0.4em !important;
              border-radius: 3px !important;
              font-family: monospace !important;
            }

            .custom-blocknote .ProseMirror pre {
              background-color: ${darkMode ? '#1f2937' : '#f3f4f6'} !important;
              border-left: 3px solid ${darkMode ? '#f472b6' : '#3b82f6'} !important;
              padding: 1em !important;
              border-radius: 5px !important;
              margin: 1em 0 !important;
              overflow: auto !important;
            }

            .custom-blocknote .ProseMirror pre code {
              background-color: transparent !important;
              padding: 0 !important;
              border-radius: 0 !important;
            }

            .custom-blocknote .ProseMirror p {
              margin: 0 0 1em !important;
              line-height: 1.6 !important;
            }

            .custom-blocknote .ProseMirror li p {
              margin: 0 !important;
            }

            .custom-blocknote .ProseMirror li p + p {
              margin-top: 0.5em !important;
            }

            /* リスト要素のベーススタイル */
            .custom-blocknote .ProseMirror ul,
            .custom-blocknote .ProseMirror ol {
              margin: 0 0 1em 1.5em !important;
              padding-inline-start: 1em !important;
            }

            .custom-blocknote .ProseMirror li {
              margin: 0.25em 0 !important;
            }

            .custom-blocknote .bn-tooltip {
              z-index: 9999 !important;
            }

            .custom-blocknote .ProseMirror a {
              color: ${darkMode ? '#f472b6' : '#3b82f6'} !important;
              text-decoration: none !important;
              border-bottom: 1px dashed ${darkMode ? '#f472b6' : '#3b82f6'} !important;
            }

            .custom-blocknote .ProseMirror blockquote {
              border-left: 4px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
              margin: 1em 0 !important;
              padding-left: 1em !important;
              font-style: italic !important;
              color: ${darkMode ? '#94a3b8' : '#64748b'} !important;
            }
          `}</style>
          <BlockNoteView
            key="blocknote-editor"
            editor={editor}
            editable={true}
            onChange={handleBlockNoteChange}
            data-testid="blocknote-editor"
            theme={{
              colors: {
                editor: {
                  text: darkMode ? '#e2e8f0' : '#1f2937',
                  background: darkMode ? '#1f2937' : '#f8fafc',
                },
                menu: {
                  text: darkMode ? '#e2e8f0' : '#1f2937',
                  background: darkMode ? '#111827' : '#ffffff',
                },
                tooltip: {
                  text: darkMode ? '#e2e8f0' : '#1f2937',
                  background: darkMode ? '#111827' : '#ffffff',
                },
                hovered: {
                  text: darkMode ? '#ffffff' : '#ffffff',
                  background: darkMode ? '#0f766e' : '#c4b5fd',
                },
                selected: {
                  text: darkMode ? '#ffffff' : '#ffffff',
                  background: darkMode ? '#06b6d4' : '#9333ea',
                },
                disabled: {
                  text: darkMode ? '#6b7280' : '#9ca3af',
                  background: 'transparent'
                },
                shadow: darkMode ? '#00000040' : '#00000020',
                border: darkMode ? '#06b6d4' : '#9333ea',
                sideMenu: darkMode ? '#e2e8f0' : '#1f2937',
                highlights: {
                  gray: { background: darkMode ? '#374151' : '#f3f4f6', text: darkMode ? '#e2e8f0' : '#1f2937' },
                  brown: { background: darkMode ? '#a16207' : '#fbbf24', text: darkMode ? '#ffffff' : '#92400e' },
                  red: { background: darkMode ? '#dc2626' : '#fca5a5', text: darkMode ? '#ffffff' : '#7f1d1d' },
                  orange: { background: darkMode ? '#ea580c' : '#fdba74', text: darkMode ? '#ffffff' : '#9a3412' },
                  yellow: { background: darkMode ? '#ca8a04' : '#fde047', text: darkMode ? '#ffffff' : '#a16207' },
                  green: { background: darkMode ? '#16a34a' : '#86efac', text: darkMode ? '#ffffff' : '#166534' },
                  blue: { background: darkMode ? '#2563eb' : '#93c5fd', text: darkMode ? '#ffffff' : '#1e40af' },
                  purple: { background: darkMode ? '#9333ea' : '#c4b5fd', text: darkMode ? '#ffffff' : '#6b21a8' },
                  pink: { background: darkMode ? '#ec4899' : '#f9a8d4', text: darkMode ? '#ffffff' : '#be185d' },
                },
              },
              borderRadius: 8,
              fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
            }}
          />
        </div>
      ) : (
        <div className={`p-4 rounded-lg border min-h-40 flex items-center justify-center ${
          darkMode
            ? "bg-gray-700/50 border-cyan-500/30 text-gray-300"
            : "bg-purple-50/70 border-purple-300/50 text-gray-700"
        }`}>
          <p>仕様書を読み込み中...</p>
        </div>
      )}

        {/* アクションボタン */}
        <div className="mt-4 flex justify-center gap-3">
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
      </div>

      {/* Confidence Feedback Modal */}
      {showConfidenceFeedback && confidenceFeedback && (
        <ConfidenceFeedback
          feedback={confidenceFeedback}
          onClose={() => setShowConfidenceFeedback(false)}
        />
      )}
    </div>
  </div>
  );
}
