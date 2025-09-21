"use client";

import { useCallback, useEffect, useState } from "react";
import { Code, Save, Loader2, RefreshCcw } from "lucide-react";
import { blocksToMarkdown, markdownToBlocks } from "@blocknote/core";
import type { Block as BlockType, PartialBlock as PartialBlockType } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import { useDarkMode } from "@/hooks/useDarkMode";

const sanitizeTechnologyContent = (input: string) => {
  let content = input
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[：]/g, ":")
    .replace(/[、]/g, ",")
    // コードブロック内の問題文字を修正
    .replace(/　/g, " ") // 全角スペースを半角スペースに
    .replace(/'/g, "'") // 特殊な引用符を標準に
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    // 改行コードの正規化
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  // 深いネストを防ぐため、見出しレベルを制限
  content = content.replace(/^#{4,}/gm, '###'); // 4レベル以上の見出しを3レベルに

  // 深いリストネストを制限（3階層以上を2階層に）
  const lines = content.split('\n');
  const processedLines = lines.map(line => {
    const indentMatch = line.match(/^(\s*)([-*+]|\d+\.)\s/);
    if (indentMatch) {
      const indent = indentMatch[1];
      // 8スペース以上（3階層以上）のインデントを4スペース（2階層）に制限
      if (indent.length >= 8) {
        return line.replace(/^\s+/, '    ');
      }
    }
    return line;
  });

  return processedLines.join('\n');
};

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

interface TechnologyEditorProps {
  initialContent?: string;
  onContentChange: (content: string) => void;
  onSave?: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export default function TechnologyEditor({
  initialContent = "",
  onContentChange,
  onSave,
  onRegenerate,
  isRegenerating = false
}: TechnologyEditorProps) {
  const { darkMode } = useDarkMode();
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // BlockNote エディターの初期化
  const editor = useCreateBlockNote({
    initialContent: [createPlainParagraphBlock("技術ドキュメントを記述してください...")],
    domAttributes: {
      editor: {
        class: "focus:outline-none",
      },
    },
    trailingBlock: false,
    defaultStyles: true,
    uploadFile: undefined,
    // ブロックタイプを制限してシンプルに
    blockSpecs: {
      // 基本的なブロックのみ許可
      paragraph: true,
      heading: true,
      bulletListItem: true,
      numberedListItem: true,
      codeBlock: true,
      // 複雑なブロックは無効化
      table: false,
      file: false,
      image: false,
    },
  });

  // エディターのコンテンツを初期化・更新
  useEffect(() => {
    const loadTechnologyContent = async () => {
      if (!initialContent || !editor || !editor.document || !initialContent.trim()) {
        return;
      }

      try {
        // Markdownの内容をサニタイズして問題のある文字を修正
        const sanitizedContent = sanitizeTechnologyContent(initialContent);

        // コードブロックを特別に処理
        const processedContent = sanitizedContent.replace(
          /```(\w+)?\n([\s\S]*?)```/g,
          (match, lang, code) => {
            // コードブロック内の特殊文字をエスケープ
            const cleanCode = code
              .replace(/\u00A0/g, " ") // non-breaking space
              .replace(/[\u2000-\u200A]/g, " ") // various spaces
              .replace(/[\u2028\u2029]/g, "\n") // line separators
              .trim();
            return `\`\`\`${lang || ""}\n${cleanCode}\n\`\`\``;
          }
        );

        const parsedBlocks = await markdownToBlocks(processedContent, editor.pmSchema);

        if (parsedBlocks && parsedBlocks.length > 0) {
          editor.replaceBlocks(
            editor.document,
            convertBlocksToPartial(parsedBlocks as unknown as BlockType[])
          );
        } else {
          console.warn("Markdown解析結果が空です。プレーンテキストとして設定します。");
          editor.replaceBlocks(editor.document, [createPlainParagraphBlock(processedContent)]);
        }
      } catch (error) {
        console.warn("マークダウン解析に失敗:", error);

        // より安全なフォールバック処理
        try {
          const fallbackContent = initialContent
            .replace(/```[\s\S]*?```/g, (match) => {
              // コードブロックをプレーンテキストに変換
              return match.replace(/```(\w+)?\n?/, "").replace(/```$/, "");
            });

          editor.replaceBlocks(editor.document, [createPlainParagraphBlock(fallbackContent)]);
        } catch (fallbackError) {
          console.error("フォールバック処理も失敗:", fallbackError);
          // 最後の手段として空のブロックを作成
          editor.replaceBlocks(editor.document, [createPlainParagraphBlock("技術ドキュメントを記述してください...")]);
        }
      }
    };

    void loadTechnologyContent();
  }, [initialContent, editor]); // isContentInitializedを依存配列から削除してコンテンツ更新を許可


  // BlockNote エディターの変更処理
  const handleBlockNoteChange = useCallback(async () => {
    if (!editor || !editor.document) return;

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

        // 親コンポーネントに変更を通知
        onContentChange(markdown);
      } catch (error) {
        console.error("技術ドキュメントの更新に失敗:", error);
      }
    }, 1000);

    setSaveTimer(newTimer);
  }, [editor, saveTimer, onContentChange]);

  // キーボードイベントハンドラー
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Tabキーのデフォルト動作を確保
    if (event.key === 'Tab') {
      // BlockNoteにTabキーイベントを委譲
      return true;
    }
    return true;
  }, []);

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
    };
  }, [saveTimer]);

  return (
    <div className="flex flex-col">
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
            <Code size={20} className="mr-2" />
            技術ドキュメント編集
          </h2>

          {/* アクションボタン */}
          <div className="flex gap-2">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className={`px-4 py-2 flex items-center rounded-lg shadow focus:outline-none transition ${
                  isRegenerating
                    ? "cursor-not-allowed opacity-70"
                    : darkMode
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isRegenerating ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    再生成中...
                  </>
                ) : (
                  <>
                    <RefreshCcw size={16} className="mr-2" />
                    再生成
                  </>
                )}
              </button>
            )}

            {onSave && (
              <button
                onClick={onSave}
                className={`px-4 py-2 flex items-center rounded-lg shadow focus:outline-none transition ${
                  darkMode
                    ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                }`}
              >
                <Save size={16} className="mr-2" />
                保存
              </button>
            )}
          </div>
        </div>
      </div>

      {/* エディターエリア */}
      <div
        className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
          darkMode
            ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
            : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
        }`}
      >
        <div className="custom-blocknote" onKeyDown={handleKeyDown}>
          <style jsx global>{`
            .custom-blocknote .bn-container {
              background-color: ${darkMode ? '#1f2937' : '#f8fafc'} !important;
              border: 1px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
              border-radius: 0.5rem !important;
              min-height: 500px !important;
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
              --bn-border-radius: 0.5rem;
              --bn-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            }

            .custom-blocknote .ProseMirror {
              padding: 1rem !important;
              min-height: 460px !important;
              color: ${darkMode ? '#e2e8f0' : '#1f2937'} !important;
              outline: none !important;
              overflow-y: auto !important;
              max-height: none !important;
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
              margin: 0 0 1em 0 !important;
              padding-left: 1.5em !important;
              list-style-position: outside !important;
            }

            .custom-blocknote .ProseMirror li {
              margin: 0.25em 0 !important;
              padding-left: 0.25em !important;
              position: relative !important;
            }

            /* シンプルなネストリストのスタイル（最大2階層） */
            .custom-blocknote .ProseMirror li > ul,
            .custom-blocknote .ProseMirror li > ol {
              margin-top: 0.25em !important;
              margin-bottom: 0.25em !important;
              padding-left: 1.2em !important;
            }

            /* 3階層以上のネストを制限 */
            .custom-blocknote .ProseMirror li li > ul,
            .custom-blocknote .ProseMirror li li > ol {
              display: none !important; /* 3階層目以降は非表示 */
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

            /* フォーカス時のアウトライン調整 */
            .custom-blocknote .ProseMirror:focus-visible {
              outline: 2px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
              outline-offset: 2px !important;
            }

            /* 選択範囲のスタイル調整 */
            .custom-blocknote .ProseMirror ::selection {
              background-color: ${darkMode ? '#0369a1' : '#a855f7'} !important;
              color: white !important;
            }

            /* Tabキーによるインデント処理の改善 */
            .custom-blocknote .ProseMirror .ProseMirror-selectednode {
              outline: 2px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
            }

            /* リストアイテムの選択状態 */
            .custom-blocknote .bn-block.bn-is-selected {
              background-color: ${darkMode ? 'rgba(6, 182, 212, 0.1)' : 'rgba(147, 51, 234, 0.1)'} !important;
            }
          `}</style>
          <BlockNoteView
            key="technology-blocknote-editor"
            editor={editor}
            editable={true}
            onChange={handleBlockNoteChange}
            data-testid="technology-blocknote-editor"
            sideMenu={true}
            slashMenu={true}
            formattingToolbar={true}
            linkToolbar={false}
            filePanel={false}
            tableHandles={false}
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
      </div>
    </div>
  );
}