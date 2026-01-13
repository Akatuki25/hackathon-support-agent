"use client";

import { useCallback, useEffect, useState, ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { blocksToMarkdown, markdownToBlocks, filterSuggestionItems } from "@blocknote/core";
import type { Block as BlockType, PartialBlock as PartialBlockType } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote, FormattingToolbar, FormattingToolbarController, SuggestionMenuController, getDefaultReactSlashMenuItems, getFormattingToolbarItems } from "@blocknote/react";
import { AIMenuController, AIToolbarButton, createAIExtension, getAISlashMenuItems } from "@blocknote/xl-ai";
import { DefaultChatTransport } from "ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";

// 共通の utility 関数
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

// 基本的なサニタイズ関数
const defaultSanitize = (input: string) =>
  input
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[：]/g, ":")
    .replace(/[、]/g, ",")
    .trim();

// AI モデルの設定は不要（transportでバックエンドに委譲）

type BlockNoteEditorInstance = ReturnType<typeof useCreateBlockNote>;
type EditorDictionary = typeof en & { ai?: typeof aiEn };

export interface BaseEditorProps {
  // コンテンツ関連
  content?: string | null;
  placeholder?: string;
  onContentChange?: (content: string) => void;

  // UI関連
  title: string;
  icon: LucideIcon;
  headerActions?: ReactNode;
  footerActions?: ReactNode;

  // エディター設定
  sanitizeContent?: (input: string) => string;
  editorConfig?: {
    minHeight?: number;
    blockSpecs?: Record<string, boolean>;
    trailingBlock?: boolean;
    defaultStyles?: boolean;
  };

  // 動作制御
  saveDelay?: number;
  isContentInitialized?: boolean;
  onContentInitialized?: () => void;

  // スタイリング
  className?: string;
  containerClassName?: string;

  // AI機能
  enableAI?: boolean;
}

export default function BaseEditor({
  content,
  placeholder = "内容を記述してください...",
  onContentChange,
  title,
  icon: Icon,
  headerActions,
  footerActions,
  sanitizeContent = defaultSanitize,
  editorConfig = {},
  saveDelay = 1000,
  isContentInitialized,
  onContentInitialized,
  className = "",
  containerClassName = "",
  enableAI = true
}: BaseEditorProps) {
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [internalContentInitialized, setInternalContentInitialized] = useState(false);

  // 内部または外部の初期化状態を使用
  const contentInitialized = isContentInitialized ?? internalContentInitialized;
  const setContentInitialized = onContentInitialized ?? setInternalContentInitialized;

  const dictionary: EditorDictionary = enableAI ? { ...en, ai: aiEn } : en;
  // AI拡張の設定 - バックエンドの /api/blocknote-ai を使用
  const aiExtension = enableAI
    ? createAIExtension({
        transport: new DefaultChatTransport({
          api: "/api/blocknote-ai",
        }),
      })
    : null;

  // BlockNote エディターの初期化
  const editor = useCreateBlockNote({
    initialContent: [createPlainParagraphBlock(placeholder)],
    domAttributes: {
      editor: {
        class: "focus:outline-none",
      },
    },
    dictionary,
    trailingBlock: editorConfig.trailingBlock ?? true,
    defaultStyles: editorConfig.defaultStyles ?? true,
    uploadFile: undefined,
    ...(editorConfig.blockSpecs && { blockSpecs: editorConfig.blockSpecs }),
    // AI拡張を有効にする
    ...(enableAI && aiExtension && {
      extensions: [aiExtension],
    }),
  });

  // エディターのコンテンツを初期化
  useEffect(() => {
    const loadContent = async () => {
      if (!content || !editor || !editor.document || !content.trim() || contentInitialized) {
        return;
      }

      try {
        // Markdownの内容をサニタイズして問題のある文字を修正
        const sanitizedContent = sanitizeContent(content);
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
          editor.replaceBlocks(editor.document, [createPlainParagraphBlock(content)]);
        } catch (fallbackError) {
          console.error("フォールバック処理も失敗:", fallbackError);
        }
      } finally {
        setContentInitialized(true);
      }
    };

    void loadContent();
  }, [content, editor, contentInitialized, sanitizeContent, setContentInitialized]);

  // BlockNote エディターの変更処理
  const handleBlockNoteChange = useCallback(async () => {
    if (!editor || !editor.document || !onContentChange) return;

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
        if (markdown === content) {
          return;
        }

        onContentChange(markdown);
      } catch (error) {
        console.error("コンテンツの更新に失敗:", error);
      }
    }, saveDelay);

    setSaveTimer(newTimer);
  }, [editor, saveTimer, onContentChange, content, saveDelay]);

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
    };
  }, [saveTimer]);

  const minHeight = editorConfig.minHeight ?? 400;

  // Dark mode theme colors
  const darkTheme = {
    colors: {
      editor: {
        text: '#e2e8f0',
        background: '#1f2937',
      },
      menu: {
        text: '#e2e8f0',
        background: '#111827',
      },
      tooltip: {
        text: '#e2e8f0',
        background: '#111827',
      },
      hovered: {
        text: '#ffffff',
        background: '#0f766e',
      },
      selected: {
        text: '#ffffff',
        background: '#06b6d4',
      },
      disabled: {
        text: '#6b7280',
        background: 'transparent'
      },
      shadow: '#00000040',
      border: '#06b6d4',
      sideMenu: '#e2e8f0',
      highlights: {
        gray: { background: '#374151', text: '#e2e8f0' },
        brown: { background: '#a16207', text: '#ffffff' },
        red: { background: '#dc2626', text: '#ffffff' },
        orange: { background: '#ea580c', text: '#ffffff' },
        yellow: { background: '#ca8a04', text: '#ffffff' },
        green: { background: '#16a34a', text: '#ffffff' },
        blue: { background: '#2563eb', text: '#ffffff' },
        purple: { background: '#9333ea', text: '#ffffff' },
        pink: { background: '#ec4899', text: '#ffffff' },
      },
    },
    borderRadius: 8,
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  };

  // Light mode theme colors
  const lightTheme = {
    colors: {
      editor: {
        text: '#1f2937',
        background: '#f8fafc',
      },
      menu: {
        text: '#1f2937',
        background: '#ffffff',
      },
      tooltip: {
        text: '#1f2937',
        background: '#ffffff',
      },
      hovered: {
        text: '#ffffff',
        background: '#c4b5fd',
      },
      selected: {
        text: '#ffffff',
        background: '#9333ea',
      },
      disabled: {
        text: '#9ca3af',
        background: 'transparent'
      },
      shadow: '#00000020',
      border: '#9333ea',
      sideMenu: '#1f2937',
      highlights: {
        gray: { background: '#f3f4f6', text: '#1f2937' },
        brown: { background: '#fbbf24', text: '#92400e' },
        red: { background: '#fca5a5', text: '#7f1d1d' },
        orange: { background: '#fdba74', text: '#9a3412' },
        yellow: { background: '#fde047', text: '#a16207' },
        green: { background: '#86efac', text: '#166534' },
        blue: { background: '#93c5fd', text: '#1e40af' },
        purple: { background: '#c4b5fd', text: '#6b21a8' },
        pink: { background: '#f9a8d4', text: '#be185d' },
      },
    },
    borderRadius: 8,
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  };

  return (
    <div className={`flex flex-col ${containerClassName}`}>
      {/* ヘッダー */}
      <div className="backdrop-blur-lg rounded-xl p-4 shadow-xl border transition-all mb-4 bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20 dark:bg-gray-800 dark:bg-opacity-70 dark:border-cyan-500/30 dark:shadow-cyan-500/20">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium flex items-center text-purple-700 dark:text-cyan-400">
            <Icon size={20} className="mr-2" />
            {title}
          </h2>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      </div>

      {/* エディターエリア */}
      <div className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20 dark:bg-gray-800 dark:bg-opacity-70 dark:border-cyan-500/30 dark:shadow-cyan-500/20 ${className}`}>
        {content !== null ? (
          <>
            {/* Light mode editor */}
            <div className="custom-blocknote custom-blocknote-light dark:hidden">
              <style jsx global>{`
                .custom-blocknote-light .bn-container {
                  background-color: #f8fafc !important;
                  border: 1px solid #9333ea !important;
                  border-radius: 0.5rem !important;
                  min-height: ${minHeight}px !important;
                }

                .custom-blocknote-light .bn-container[data-color-scheme="light"] {
                  --bn-colors-editor-text: #1f2937;
                  --bn-colors-editor-background: #f8fafc;
                  --bn-colors-menu-background: #ffffff;
                  --bn-colors-menu-text: #1f2937;
                  --bn-colors-tooltip-background: #ffffff;
                  --bn-colors-tooltip-text: #1f2937;
                  --bn-colors-hovered: #c4b5fd;
                  --bn-colors-selected: #9333ea;
                  --bn-colors-border: #9333ea;
                  --bn-colors-side-menu: #1f2937;
                  --bn-colors-highlights-gray-background: #f3f4f6;
                  --bn-colors-highlights-gray-text: #1f2937;
                  --bn-colors-highlights-red-background: #fca5a5;
                  --bn-colors-highlights-red-text: #7f1d1d;
                  --bn-colors-highlights-orange-background: #fdba74;
                  --bn-colors-highlights-orange-text: #9a3412;
                  --bn-colors-highlights-yellow-background: #fde047;
                  --bn-colors-highlights-yellow-text: #a16207;
                  --bn-colors-highlights-green-background: #86efac;
                  --bn-colors-highlights-green-text: #166534;
                  --bn-colors-highlights-blue-background: #93c5fd;
                  --bn-colors-highlights-blue-text: #1e40af;
                  --bn-colors-highlights-purple-background: #c4b5fd;
                  --bn-colors-highlights-purple-text: #6b21a8;
                  --bn-colors-highlights-pink-background: #f9a8d4;
                  --bn-colors-highlights-pink-text: #be185d;
                  --bn-border-radius: 0.5rem;
                  --bn-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
                }

                .custom-blocknote-light .ProseMirror {
                  padding: 1rem !important;
                  min-height: ${minHeight - 40}px !important;
                  color: #1f2937 !important;
                  outline: none !important;
                }

                .custom-blocknote-light .ProseMirror:focus {
                  outline: none !important;
                  box-shadow: none !important;
                }

                .custom-blocknote-light .bn-suggestion-menu {
                  z-index: 1000 !important;
                  background-color: #ffffff !important;
                  border: 1px solid #9333ea !important;
                  border-radius: 0.5rem !important;
                }

                .custom-blocknote-light .bn-suggestion-menu-item {
                  color: #1f2937 !important;
                }

                .custom-blocknote-light .bn-suggestion-menu-item[aria-selected="true"] {
                  background-color: #c4b5fd !important;
                  color: #ffffff !important;
                }

                .custom-blocknote-light .ProseMirror h1 {
                  color: #3b82f6 !important;
                  border-bottom: 1px solid #3b82f6 !important;
                  padding-bottom: 0.3em !important;
                  margin-top: 1.5em !important;
                  margin-bottom: 0.5em !important;
                  font-weight: bold !important;
                }

                .custom-blocknote-light .ProseMirror h2,
                .custom-blocknote-light .ProseMirror h3 {
                  color: #7c3aed !important;
                  border-bottom: 1px solid #c4b5fd !important;
                  padding-bottom: 0.3em !important;
                  margin-top: 1.5em !important;
                  margin-bottom: 0.5em !important;
                  font-weight: bold !important;
                }

                .custom-blocknote-light .ProseMirror code {
                  background-color: #f3f4f6 !important;
                  color: #7c3aed !important;
                  padding: 0.2em 0.4em !important;
                  border-radius: 3px !important;
                  font-family: monospace !important;
                }

                .custom-blocknote-light .ProseMirror pre {
                  background-color: #f3f4f6 !important;
                  border-left: 3px solid #3b82f6 !important;
                  padding: 1em !important;
                  border-radius: 5px !important;
                  margin: 1em 0 !important;
                  overflow: auto !important;
                }

                .custom-blocknote-light .ProseMirror pre code {
                  background-color: transparent !important;
                  padding: 0 !important;
                  border-radius: 0 !important;
                }

                .custom-blocknote-light .ProseMirror p {
                  margin: 0 0 1em !important;
                  line-height: 1.6 !important;
                }

                .custom-blocknote-light .ProseMirror li p {
                  margin: 0 !important;
                }

                .custom-blocknote-light .ProseMirror li p + p {
                  margin-top: 0.5em !important;
                }

                .custom-blocknote-light .ProseMirror ul,
                .custom-blocknote-light .ProseMirror ol {
                  margin: 0 0 1em 1.5em !important;
                  padding-inline-start: 1em !important;
                }

                .custom-blocknote-light .ProseMirror li {
                  margin: 0.25em 0 !important;
                }

                .custom-blocknote-light .bn-tooltip {
                  z-index: 9999 !important;
                }

                .custom-blocknote-light .ProseMirror a {
                  color: #3b82f6 !important;
                  text-decoration: none !important;
                  border-bottom: 1px dashed #3b82f6 !important;
                }

                .custom-blocknote-light .ProseMirror blockquote {
                  border-left: 4px solid #9333ea !important;
                  margin: 1em 0 !important;
                  padding-left: 1em !important;
                  font-style: italic !important;
                  color: #64748b !important;
                }
              `}</style>
              <BlockNoteView
                editor={editor}
                editable={true}
                onChange={handleBlockNoteChange}
                formattingToolbar={false}
                slashMenu={false}
                theme={lightTheme}
              >
                {/* AI機能のUI要素 */}
                {enableAI && (
                  <>
                    <AIMenuController />
                    <FormattingToolbarWithAI />
                    <SuggestionMenuWithAI editor={editor} />
                  </>
                )}
              </BlockNoteView>
            </div>

            {/* Dark mode editor */}
            <div className="custom-blocknote custom-blocknote-dark hidden dark:block">
              <style jsx global>{`
                .custom-blocknote-dark .bn-container {
                  background-color: #1f2937 !important;
                  border: 1px solid #06b6d4 !important;
                  border-radius: 0.5rem !important;
                  min-height: ${minHeight}px !important;
                }

                .custom-blocknote-dark .bn-container[data-color-scheme="dark"] {
                  --bn-colors-editor-text: #e2e8f0;
                  --bn-colors-editor-background: #1f2937;
                  --bn-colors-menu-background: #111827;
                  --bn-colors-menu-text: #e2e8f0;
                  --bn-colors-tooltip-background: #111827;
                  --bn-colors-tooltip-text: #e2e8f0;
                  --bn-colors-hovered: #0f766e;
                  --bn-colors-selected: #06b6d4;
                  --bn-colors-border: #06b6d4;
                  --bn-colors-side-menu: #e2e8f0;
                  --bn-colors-highlights-gray-background: #374151;
                  --bn-colors-highlights-gray-text: #e2e8f0;
                  --bn-colors-highlights-red-background: #dc2626;
                  --bn-colors-highlights-red-text: #ffffff;
                  --bn-colors-highlights-orange-background: #ea580c;
                  --bn-colors-highlights-orange-text: #ffffff;
                  --bn-colors-highlights-yellow-background: #ca8a04;
                  --bn-colors-highlights-yellow-text: #ffffff;
                  --bn-colors-highlights-green-background: #16a34a;
                  --bn-colors-highlights-green-text: #ffffff;
                  --bn-colors-highlights-blue-background: #2563eb;
                  --bn-colors-highlights-blue-text: #ffffff;
                  --bn-colors-highlights-purple-background: #9333ea;
                  --bn-colors-highlights-purple-text: #ffffff;
                  --bn-colors-highlights-pink-background: #ec4899;
                  --bn-colors-highlights-pink-text: #ffffff;
                  --bn-border-radius: 0.5rem;
                  --bn-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
                }

                .custom-blocknote-dark .ProseMirror {
                  padding: 1rem !important;
                  min-height: ${minHeight - 40}px !important;
                  color: #e2e8f0 !important;
                  outline: none !important;
                }

                .custom-blocknote-dark .ProseMirror:focus {
                  outline: none !important;
                  box-shadow: none !important;
                }

                .custom-blocknote-dark .bn-suggestion-menu {
                  z-index: 1000 !important;
                  background-color: #111827 !important;
                  border: 1px solid #06b6d4 !important;
                  border-radius: 0.5rem !important;
                }

                .custom-blocknote-dark .bn-suggestion-menu-item {
                  color: #e2e8f0 !important;
                }

                .custom-blocknote-dark .bn-suggestion-menu-item[aria-selected="true"] {
                  background-color: #0f766e !important;
                  color: #ffffff !important;
                }

                .custom-blocknote-dark .ProseMirror h1 {
                  color: #f472b6 !important;
                  border-bottom: 1px solid #f472b6 !important;
                  padding-bottom: 0.3em !important;
                  margin-top: 1.5em !important;
                  margin-bottom: 0.5em !important;
                  font-weight: bold !important;
                }

                .custom-blocknote-dark .ProseMirror h2,
                .custom-blocknote-dark .ProseMirror h3 {
                  color: #5eead4 !important;
                  border-bottom: 1px solid #0f766e !important;
                  padding-bottom: 0.3em !important;
                  margin-top: 1.5em !important;
                  margin-bottom: 0.5em !important;
                  font-weight: bold !important;
                }

                .custom-blocknote-dark .ProseMirror code {
                  background-color: #1f2937 !important;
                  color: #5eead4 !important;
                  padding: 0.2em 0.4em !important;
                  border-radius: 3px !important;
                  font-family: monospace !important;
                }

                .custom-blocknote-dark .ProseMirror pre {
                  background-color: #1f2937 !important;
                  border-left: 3px solid #f472b6 !important;
                  padding: 1em !important;
                  border-radius: 5px !important;
                  margin: 1em 0 !important;
                  overflow: auto !important;
                }

                .custom-blocknote-dark .ProseMirror pre code {
                  background-color: transparent !important;
                  padding: 0 !important;
                  border-radius: 0 !important;
                }

                .custom-blocknote-dark .ProseMirror p {
                  margin: 0 0 1em !important;
                  line-height: 1.6 !important;
                }

                .custom-blocknote-dark .ProseMirror li p {
                  margin: 0 !important;
                }

                .custom-blocknote-dark .ProseMirror li p + p {
                  margin-top: 0.5em !important;
                }

                .custom-blocknote-dark .ProseMirror ul,
                .custom-blocknote-dark .ProseMirror ol {
                  margin: 0 0 1em 1.5em !important;
                  padding-inline-start: 1em !important;
                }

                .custom-blocknote-dark .ProseMirror li {
                  margin: 0.25em 0 !important;
                }

                .custom-blocknote-dark .bn-tooltip {
                  z-index: 9999 !important;
                }

                .custom-blocknote-dark .ProseMirror a {
                  color: #f472b6 !important;
                  text-decoration: none !important;
                  border-bottom: 1px dashed #f472b6 !important;
                }

                .custom-blocknote-dark .ProseMirror blockquote {
                  border-left: 4px solid #06b6d4 !important;
                  margin: 1em 0 !important;
                  padding-left: 1em !important;
                  font-style: italic !important;
                  color: #94a3b8 !important;
                }
              `}</style>
              <BlockNoteView
                editor={editor}
                editable={true}
                onChange={handleBlockNoteChange}
                formattingToolbar={false}
                slashMenu={false}
                theme={darkTheme}
              >
                {/* AI機能のUI要素 */}
                {enableAI && (
                  <>
                    <AIMenuController />
                    <FormattingToolbarWithAI />
                    <SuggestionMenuWithAI editor={editor} />
                  </>
                )}
              </BlockNoteView>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-lg border min-h-40 flex items-center justify-center bg-purple-50/70 border-purple-300/50 text-gray-700 dark:bg-gray-700/50 dark:border-cyan-500/30 dark:text-gray-300">
            <p>コンテンツを読み込み中...</p>
          </div>
        )}

        {/* フッターアクション */}
        {footerActions && (
          <div className="mt-4">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
}

// AI機能付きフォーマットツールバー
function FormattingToolbarWithAI() {
  return (
    <FormattingToolbarController
      formattingToolbar={() => (
        <FormattingToolbar>
          {getFormattingToolbarItems()}
          <AIToolbarButton />
        </FormattingToolbar>
      )}
    />
  );
}

// AI機能付きスラッシュメニュー
function SuggestionMenuWithAI(props: { editor: BlockNoteEditorInstance }) {
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) =>
        filterSuggestionItems(
          [
            ...getDefaultReactSlashMenuItems(props.editor),
            ...getAISlashMenuItems(props.editor),
          ],
          query,
        )
      }
    />
  );
}
