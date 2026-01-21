'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import hljs from 'highlight.js';

interface CodeBlockProps {
  children: string;
  className?: string;
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  // 言語を抽出 (className は "language-xxx" の形式)
  const language = className?.replace('language-', '') || '';

  // シンタックスハイライトを適用
  useEffect(() => {
    if (codeRef.current && language) {
      // 既存のハイライトをリセット
      codeRef.current.removeAttribute('data-highlighted');
      try {
        hljs.highlightElement(codeRef.current);
      } catch {
        // 言語が認識されない場合は無視
      }
    }
  }, [children, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative group my-4 not-prose" style={{ width: '100%', maxWidth: '100%' }}>
      {/* 言語ラベルとコピーボタン */}
      <div
        className="flex items-center justify-between px-4 py-2 rounded-t-lg border border-b-0 bg-gray-100 border-gray-300 dark:bg-slate-800 dark:border-slate-600"
        style={{ width: '100%' }}
      >
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-cyan-400">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-all duration-200 ${
            copied
              ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-purple-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-400 dark:hover:text-cyan-400'
          }`}
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>コピー済み</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>コピー</span>
            </>
          )}
        </button>
      </div>
      {/* コードコンテンツ */}
      <div
        className="rounded-b-lg overflow-hidden border border-t-0 border-gray-300 dark:border-slate-600"
        style={{ width: '100%' }}
      >
        <pre
          className="p-4 m-0 overflow-x-auto bg-gray-50 dark:bg-slate-900"
          style={{
            fontSize: '14px',
            lineHeight: '1.5',
            margin: 0,
            width: '100%',
          }}
        >
          <code
            ref={codeRef}
            className={`font-mono whitespace-pre block ${language ? `language-${language}` : ''}`}
            style={{ fontSize: '14px' }}
          >
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}

interface InlineCodeProps {
  children: React.ReactNode;
}

export function InlineCode({ children }: InlineCodeProps) {
  return (
    <code className="px-1.5 py-0.5 rounded text-sm font-mono bg-purple-100 text-purple-700 border border-purple-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30">
      {children}
    </code>
  );
}
