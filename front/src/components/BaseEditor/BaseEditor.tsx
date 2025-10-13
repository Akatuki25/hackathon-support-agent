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
import { useDarkMode } from "@/hooks/useDarkMode";

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
  const { darkMode } = useDarkMode();
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

  return (
    <div className={`flex flex-col ${containerClassName}`}>
      {/* ヘッダー */}
      <div
        className={`backdrop-blur-lg rounded-xl p-4 shadow-xl border transition-all mb-4 ${
          darkMode
            ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
            : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2
            className={`text-xl font-medium flex items-center ${
              darkMode ? "text-cyan-400" : "text-purple-700"
            }`}
          >
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
      <div
        className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
          darkMode
            ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
            : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
        } ${className}`}
      >
        {content !== null ? (
          <div className="custom-blocknote">
            <style jsx global>{`
              .custom-blocknote .bn-container {
                background-color: ${darkMode ? '#1f2937' : '#f8fafc'} !important;
                border: 1px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
                border-radius: 0.5rem !important;
                min-height: ${minHeight}px !important;
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
                min-height: ${minHeight - 40}px !important;
                color: ${darkMode ? '#e2e8f0' : '#1f2937'} !important;
                outline: none !important;
              }

              .custom-blocknote .ProseMirror:focus {
                outline: none !important;
                box-shadow: none !important;
              }

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
              editor={editor}
              editable={true}
              onChange={handleBlockNoteChange}
              formattingToolbar={false}
              slashMenu={false}
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
        ) : (
          <div className={`p-4 rounded-lg border min-h-40 flex items-center justify-center ${
            darkMode
              ? "bg-gray-700/50 border-cyan-500/30 text-gray-300"
              : "bg-purple-50/70 border-purple-300/50 text-gray-700"
          }`}>
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
