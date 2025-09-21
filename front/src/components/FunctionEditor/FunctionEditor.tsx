"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, Loader2, FileText, TrendingUp } from "lucide-react";
import { blocksToMarkdown, markdownToBlocks } from "@blocknote/core";
import type { Block as BlockType, PartialBlock as PartialBlockType } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import { useDarkMode } from "@/hooks/useDarkMode";
import { ConfidenceFeedback as ConfidenceFeedbackType } from "@/types/modelTypes";
import ConfidenceFeedback from "@/components/ConfidenceFeedback/ConfidenceFeedback";
import {
  FunctionalRequirement,
  QAForRequirement,
  regenerateFunctionalRequirements,
  updateFunctionDocument,
  getFunctionConfidenceFeedback
} from "@/libs/service/function";

const sanitizeFunctionContent = (input: string) =>
  input
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
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
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [loadingConfidenceFeedback, setLoadingConfidenceFeedback] = useState(false);
  const [confidenceFeedback, setConfidenceFeedback] = useState<ConfidenceFeedbackType | null>(null);
  const [showConfidenceFeedback, setShowConfidenceFeedback] = useState(false);

  // BlockNote エディターの初期化
  const editor = useCreateBlockNote({
    initialContent: [createPlainParagraphBlock("機能要件を記述してください...")],
    domAttributes: {
      editor: {
        class: "focus:outline-none",
      },
    },
  });

  // エディターのコンテンツを初期化
  useEffect(() => {
    const loadFunctionContent = async () => {
      if (!functionDocument || !editor || !editor.document || !functionDocument.trim() || isContentInitialized) {
        return;
      }

      try {
        // Markdownの内容をサニタイズして問題のある文字を修正
        const sanitizedContent = sanitizeFunctionContent(functionDocument);
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
          editor.replaceBlocks(editor.document, [createPlainParagraphBlock(functionDocument)]);
        } catch (fallbackError) {
          console.error("フォールバック処理も失敗:", fallbackError);
        }
      } finally {
        setIsContentInitialized(true);
      }
    };

    void loadFunctionContent();
  }, [functionDocument, editor, isContentInitialized]);

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

  // 確信度フィードバック取得
  const handleGetConfidenceFeedback = async () => {
    setLoadingConfidenceFeedback(true);
    try {
      const feedback = await getFunctionConfidenceFeedback(projectId);
      setConfidenceFeedback(feedback);
      setShowConfidenceFeedback(true);
    } catch (error) {
      console.error("確信度フィードバックの取得に失敗:", error);
      alert("確信度フィードバックの取得に失敗しました");
    } finally {
      setLoadingConfidenceFeedback(false);
    }
  };

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

  // BlockNote エディターの変更処理
  const handleBlockNoteChange = useCallback(async () => {
    if (!functionDocument || !editor || !editor.document) return;

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
        if (markdown === functionDocument) {
          return;
        }

        await updateFunctionDocument(projectId, markdown);
        onDocumentUpdate(markdown);
      } catch (error) {
        console.error("機能要件ドキュメントの更新に失敗:", error);
      }
    }, 1000);

    setSaveTimer(newTimer);
  }, [functionDocument, editor, projectId, saveTimer, onDocumentUpdate]);

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
    };
  }, [saveTimer]);

  return (
    <div
      className={`flex-1 backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
        darkMode
          ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
          : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          className={`text-xl font-medium flex items-center ${
            darkMode ? "text-cyan-400" : "text-purple-700"
          }`}
        >
          <FileText size={20} className="mr-2" />
          機能要件編集
        </h2>
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
      </div>

      {functionDocument !== null ? (
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
            key="function-blocknote-editor"
            editor={editor}
            editable={true}
            onChange={handleBlockNoteChange}
            data-testid="function-blocknote-editor"
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
          <p>機能要件を読み込み中...</p>
        </div>
      )}

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
              機能要件を再生成
            </>
          )}
        </button>

        <button
          onClick={handleGetConfidenceFeedback}
          disabled={loadingConfidenceFeedback || !functionDocument}
          className={`px-6 py-2 flex items-center rounded-lg shadow focus:outline-none transform transition ${
            loadingConfidenceFeedback || !functionDocument
              ? "cursor-not-allowed opacity-70"
              : "hover:-translate-y-0.5"
          } ${
            darkMode
              ? "bg-teal-500 hover:bg-teal-600 text-gray-900 focus:ring-2 focus:ring-teal-400"
              : "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white focus:ring-2 focus:ring-teal-400"
          } ${
            loadingConfidenceFeedback && (darkMode ? "bg-teal-600" : "from-teal-600 to-emerald-700")
          }`}
        >
          {loadingConfidenceFeedback ? (
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