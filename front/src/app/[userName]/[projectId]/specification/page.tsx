"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import ReactMarkdown from 'react-markdown';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { getProjectDocument } from '@/libs/modelAPI/frameworkService';

export default function SpecificationPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  const userName = params?.userName as string;

  // プロジェクトドキュメントを取得
  const { data: projectDocument, error, isLoading } = useSWR(
    projectId ? `project-document-${projectId}` : null,
    () => projectId ? getProjectDocument(projectId) : null
  );

  const handleBack = () => {
    router.push(`/${userName}/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Header */}
      <div className="border-b border-purple-500/30 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/50 text-purple-300 rounded-lg transition-all duration-300 hover:scale-105"
            >
              <ArrowLeft size={18} />
              戻る
            </button>
            <div className="flex items-center gap-3 flex-1">
              <FileText className="text-pink-400" size={32} />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                仕様書
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-2xl border-2 border-pink-500/40 shadow-2xl p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="text-pink-400 animate-spin mb-4" size={48} />
              <p className="text-gray-400">読み込み中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <FileText size={64} className="mx-auto mb-4 text-red-400 opacity-50" />
              <p className="text-red-400 mb-2">エラーが発生しました</p>
              <p className="text-gray-500 text-sm">{error.message}</p>
            </div>
          ) : projectDocument?.specification ? (
            <div className="prose prose-invert max-w-none text-gray-300">
              <ReactMarkdown
                components={{
                  h1: ({ ...props }) => <h1 className="text-4xl font-bold text-pink-400 mb-6 pb-4 border-b-2 border-pink-500/30" {...props} />,
                  h2: ({ ...props }) => <h2 className="text-3xl font-bold text-pink-300 mb-4 mt-8" {...props} />,
                  h3: ({ ...props }) => <h3 className="text-2xl font-bold text-pink-200 mb-3 mt-6" {...props} />,
                  h4: ({ ...props }) => <h4 className="text-xl font-bold text-pink-200 mb-2 mt-4" {...props} />,
                  p: ({ ...props }) => <p className="text-gray-300 mb-4 leading-relaxed text-base" {...props} />,
                  ul: ({ ...props }) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2 ml-4" {...props} />,
                  ol: ({ ...props }) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-2 ml-4" {...props} />,
                  li: ({ ...props }) => <li className="text-gray-300 leading-relaxed" {...props} />,
                  code: ({ inline, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) =>
                    inline ? (
                      <code className="bg-pink-900/30 text-pink-300 px-2 py-1 rounded text-sm font-mono" {...props} />
                    ) : (
                      <code className="block bg-gray-800/70 text-gray-200 p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm" {...props} />
                    ),
                  pre: ({ ...props }) => <pre className="bg-gray-800/70 rounded-lg overflow-hidden mb-4" {...props} />,
                  blockquote: ({ ...props }) => (
                    <blockquote className="border-l-4 border-pink-500/50 pl-6 py-2 my-4 italic text-gray-400 bg-pink-900/10 rounded-r-lg" {...props} />
                  ),
                  strong: ({ ...props }) => <strong className="font-bold text-pink-300" {...props} />,
                  em: ({ ...props }) => <em className="italic text-gray-300" {...props} />,
                  a: ({ ...props }) => <a className="text-pink-400 hover:text-pink-300 underline transition-colors" {...props} />,
                  table: ({ ...props }) => (
                    <div className="overflow-x-auto mb-4">
                      <table className="min-w-full border-collapse border border-pink-500/30" {...props} />
                    </div>
                  ),
                  thead: ({ ...props }) => <thead className="bg-pink-900/30" {...props} />,
                  th: ({ ...props }) => <th className="border border-pink-500/30 px-4 py-2 text-left text-pink-300 font-bold" {...props} />,
                  td: ({ ...props }) => <td className="border border-pink-500/30 px-4 py-2 text-gray-300" {...props} />,
                  hr: ({ ...props }) => <hr className="border-pink-500/30 my-8" {...props} />,
                }}
              >
                {projectDocument.specification}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-16">
              <FileText size={64} className="mx-auto mb-4 text-pink-400 opacity-50" />
              <p className="text-gray-400 text-lg mb-2">仕様書がまだ作成されていません</p>
              <p className="text-gray-500 text-sm">プロジェクトセットアップを完了してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
