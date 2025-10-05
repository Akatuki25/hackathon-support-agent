"use client";

import React from "react";
import { Code, Save, Loader2, RefreshCcw, ArrowRight } from "lucide-react";
import { BaseEditor } from "@/components/BaseEditor";

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

interface TechnologyEditorProps {
  initialContent?: string;
  onContentChange: (content: string) => void;
  onSave?: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  onNext?: () => void;
}

export default function TechnologyEditor({
  initialContent = "",
  onContentChange,
  onSave,
  onRegenerate,
  isRegenerating = false,
  onNext
}: TechnologyEditorProps) {

  // ヘッダーアクション
  const headerActions = (
    <div className="flex gap-2">
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className={`px-4 py-2 flex items-center rounded-lg shadow focus:outline-none transition ${
            isRegenerating
              ? "cursor-not-allowed opacity-70"
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
          className="px-4 py-2 flex items-center rounded-lg shadow focus:outline-none transition bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          <Save size={16} className="mr-2" />
          保存
        </button>
      )}
    </div>
  );

  return (
    <div>
      <BaseEditor
        content={initialContent}
        placeholder="技術ドキュメントを記述してください..."
        onContentChange={onContentChange}
        title="技術ドキュメント編集"
        icon={Code}
        headerActions={headerActions}
        sanitizeContent={sanitizeTechnologyContent}
        editorConfig={{
          minHeight: 500,
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
          trailingBlock: false,
          defaultStyles: true,
        }}
        saveDelay={1000}
      />

      {onNext && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={onNext}
            className="px-6 py-3 flex items-center rounded-lg shadow-lg focus:outline-none transition bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            次のページへ
            <ArrowRight size={20} className="ml-2" />
          </button>
        </div>
      )}
    </div>
  );
}