"use client";

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Monitor, Server, Package, Database, Cloud, Copy, RefreshCw, CheckCircle, AlertCircle, Check, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import Header from '@/components/Session/Header';
import { AgentChatWidget } from '../AgentChatWidget';
import {
  getEnvSetupOrNull,
  generateEnvSetup,
  regenerateEnvSetup,
  EnvGetResponse
} from '@/libs/service/envSetupService';

// コードブロックのコピー状態を管理するためのカスタムコンポーネント
interface CodeBlockProps {
  children: string;
  className?: string;
}

const CodeBlock = ({ children, className }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  // 言語を抽出 (className は "language-xxx" の形式)
  const language = className?.replace('language-', '') || '';

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
        className="flex items-center justify-between px-4 py-2 rounded-t-lg border border-b-0 bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-cyan-500/30"
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
              : 'bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-purple-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-400 dark:hover:text-cyan-400'
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
        className="rounded-b-lg overflow-hidden border border-t-0 border-gray-300 dark:border-cyan-500/30"
        style={{ width: '100%' }}
      >
        <pre
          className="p-4 m-0 overflow-x-auto bg-gray-900"
          style={{ fontSize: '14px', lineHeight: '1.5', margin: 0, width: '100%' }}
        >
          <code
            className="font-mono whitespace-pre block text-green-400 dark:text-cyan-300"
            style={{ fontSize: '14px' }}
          >
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
};

// インラインコード用コンポーネント
interface InlineCodeProps {
  children: React.ReactNode;
}

const InlineCode = ({ children }: InlineCodeProps) => {
  return (
    <code className="px-1.5 py-0.5 rounded text-sm font-mono bg-purple-100 text-purple-700 border border-purple-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30">
      {children}
    </code>
  );
};

// タブタイプ定義
type TabType = 'front' | 'backend' | 'devcontainer' | 'database' | 'deploy';

// タブ設定
const tabs: { id: TabType; title: string; icon: typeof Monitor; color: string }[] = [
  { id: 'front', title: 'フロントエンド', icon: Monitor, color: 'cyan' },
  { id: 'backend', title: 'バックエンド', icon: Server, color: 'purple' },
  { id: 'devcontainer', title: 'DevContainer', icon: Package, color: 'pink' },
  { id: 'database', title: 'データベース', icon: Database, color: 'green' },
  { id: 'deploy', title: 'デプロイ', icon: Cloud, color: 'blue' },
];

export default function EnvSetupPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [envData, setEnvData] = useState<EnvGetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('front');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Extract userName and projectId from pathname: /[userName]/[projectId]/env
  const userName = pathname?.split('/')[1];
  const projectId = pathname?.split('/')[2];

  // タスクページに戻る
  const handleBackToTasks = () => {
    router.push(`/${userName}/${projectId}`);
  };

  // データ取得
  const fetchEnvData = useCallback(async () => {
    if (!projectId) {
      setError('プロジェクトIDが見つかりません');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // まず既存データを取得
      const existingData = await getEnvSetupOrNull(projectId);

      if (existingData) {
        setEnvData(existingData);
        setLoading(false);
      } else {
        // データがなければ自動生成
        setGenerating(true);
        setLoading(false);
        const generatedData = await generateEnvSetup(projectId);
        setEnvData({
          env_id: generatedData.env_id,
          project_id: generatedData.project_id,
          front: generatedData.front,
          backend: generatedData.backend,
          devcontainer: generatedData.devcontainer,
          database: generatedData.database,
          deploy: generatedData.deploy,
          created_at: null,
        });
        setGenerating(false);
      }
    } catch (err) {
      console.error('Error fetching env data:', err);
      setError('環境構築情報の取得に失敗しました');
      setLoading(false);
      setGenerating(false);
    }
  }, [projectId]);

  // 再生成
  const handleRegenerate = async () => {
    if (!projectId) return;

    try {
      setGenerating(true);
      setError(null);
      const regeneratedData = await regenerateEnvSetup(projectId);
      setEnvData({
        env_id: regeneratedData.env_id,
        project_id: regeneratedData.project_id,
        front: regeneratedData.front,
        backend: regeneratedData.backend,
        devcontainer: regeneratedData.devcontainer,
        database: regeneratedData.database,
        deploy: regeneratedData.deploy,
        created_at: null,
      });
    } catch (err) {
      console.error('Error regenerating env data:', err);
      setError('環境構築情報の再生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  // コピー機能
  const handleCopy = async (content: string, section: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // マウント時にデータ取得
  useEffect(() => {
    fetchEnvData();
  }, [fetchEnvData]);

  // 現在のタブのコンテンツを取得
  const getCurrentContent = (): string | null => {
    if (!envData) return null;
    return envData[activeTab] || null;
  };

  // 現在のタブ情報を取得
  const getCurrentTab = () => {
    return tabs.find(tab => tab.id === activeTab);
  };

  // ローディング/生成中表示
  if (loading || generating) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          {/* Background grid animation - Light mode */}
          <div className="absolute inset-0 opacity-20 dark:hidden">
            <div className="absolute inset-0" style={{
              backgroundImage: `linear-gradient(rgba(147, 51, 234, 0.1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(147, 51, 234, 0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px',
            }} />
          </div>
          {/* Background grid animation - Dark mode */}
          <div className="absolute inset-0 opacity-20 hidden dark:block">
            <div className="absolute inset-0" style={{
              backgroundImage: `linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px',
            }} />
          </div>

          <div className="relative z-10 text-center px-4">
            {/* AI Agent Icon */}
            <div className="mb-8 relative">
              <div className="w-32 h-32 mx-auto relative">
                {/* Outer rotating rings */}
                <div className="absolute inset-0 border-4 rounded-full opacity-20 animate-spin border-purple-500 dark:border-cyan-500" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-2 border-4 rounded-full opacity-30 border-blue-500 dark:border-purple-500" style={{ animation: 'spin 4s linear infinite reverse' }} />
                <div className="absolute inset-4 border-4 rounded-full opacity-40 animate-pulse border-purple-400 dark:border-cyan-400" />

                {/* Center core */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full animate-pulse bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-600 dark:from-cyan-400 dark:via-purple-500 dark:to-pink-600">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white font-bold text-2xl">AI</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status text */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-purple-400 dark:to-pink-400">
                {generating ? '環境構築情報を生成中...' : '読み込み中...'}
              </h2>

              <div className="text-sm font-mono space-y-2 text-purple-600 dark:text-cyan-300">
                <div className="flex items-center justify-center gap-2 animate-pulse">
                  <span className="inline-block w-2 h-2 rounded-full bg-purple-500 dark:bg-cyan-400" />
                  <span>{generating ? '> AIがプロジェクト構成を分析中...' : '> データを取得中...'}</span>
                </div>
                {generating && (
                  <>
                    <div className="flex items-center justify-center gap-2 animate-pulse" style={{ animationDelay: '0.3s' }}>
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 dark:bg-purple-400" />
                      <span>&gt; 最適な開発環境を構築中...</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 animate-pulse" style={{ animationDelay: '0.6s' }}>
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 dark:bg-pink-400" />
                      <span>&gt; セットアップ手順を作成中...</span>
                    </div>
                  </>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-6 w-80 max-w-full mx-auto">
                <div className="h-2 rounded-full overflow-hidden bg-purple-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500 dark:from-cyan-500 dark:via-purple-500 dark:to-pink-500" style={{ animation: 'progress 2s ease-in-out infinite', width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </main>
    );
  }

  // エラー表示
  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="text-center max-w-md px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-500/20">
              <AlertCircle size={40} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">
              エラーが発生しました
            </h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              {error}
            </p>
            <button
              onClick={fetchEnvData}
              className="px-6 py-3 rounded-lg font-mono font-bold transition-all duration-300 bg-purple-600 hover:bg-purple-700 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700"
            >
              再試行
            </button>
          </div>
        </div>
        {projectId && <AgentChatWidget projectId={projectId} />}
      </main>
    );
  }

  // メインUI
  const currentTab = getCurrentTab();
  const currentContent = getCurrentContent();

  return (
    <main className="h-screen w-screen overflow-hidden fixed inset-0">

      <Header />

      <div className="relative z-10 flex h-[calc(100vh-80px)] pt-20 overflow-hidden container mx-auto px-6">
        {/* サイドバー */}
        <aside className="w-80 flex-shrink-0 flex-grow-0 border-r border-purple-200/50 bg-white/30 dark:border-cyan-500/20 dark:bg-gray-900/50 backdrop-blur-sm flex flex-col">
          {/* 概要カード */}
          <div className="p-6 border-b border-purple-200/50 dark:border-cyan-500/20">
            <div className="p-4 rounded-lg border bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-300/30 dark:from-cyan-500/10 dark:to-purple-500/10 dark:border-cyan-500/30">
              <h2 className="text-lg font-bold font-mono mb-2 text-purple-600 dark:text-cyan-400">
                ENV_SETUP
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AIが生成した開発環境構築ガイド
              </p>
            </div>
          </div>

          {/* タブナビゲーション */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-all duration-200 ${
                    isActive
                      ? 'bg-purple-500/20 border border-purple-400/50 text-purple-600 dark:bg-cyan-500/20 dark:border-cyan-500/50 dark:text-cyan-400'
                      : 'hover:bg-purple-50 text-gray-600 hover:text-purple-600 dark:hover:bg-gray-800/50 dark:text-gray-400 dark:hover:text-cyan-400'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-mono font-bold text-sm">{tab.title}</span>
                  {envData && envData[tab.id] && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-green-500 dark:bg-green-400" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* ボタンエリア */}
          <div className="p-4 border-t space-y-3 border-purple-200/50 dark:border-cyan-500/20">
            {/* タスクに戻るボタン */}
            <button
              onClick={handleBackToTasks}
              className="w-full px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-mono font-bold text-sm transition-all duration-200 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 hover:border-purple-400 dark:bg-gray-800/50 dark:hover:bg-gray-700/70 dark:text-gray-300 dark:border-gray-600/50 dark:hover:border-cyan-500/50"
            >
              <ArrowLeft size={16} />
              <span>タスクに戻る</span>
            </button>

            {/* 再生成ボタン（小さく） */}
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className={`w-full px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all duration-200 ${
                generating
                  ? 'opacity-50 cursor-not-allowed'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-purple-600 border border-gray-200 dark:bg-gray-700/50 dark:hover:bg-gray-600/70 dark:text-gray-400 dark:hover:text-cyan-400 dark:border-gray-600/30'
              }`}
            >
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
              <span>{generating ? '再生成中...' : '再生成'}</span>
            </button>
          </div>
        </aside>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-hidden p-6 min-w-0">
          {currentContent ? (
            <div className="rounded-xl border h-full overflow-hidden flex flex-col bg-white/70 border-purple-200/50 dark:bg-gray-900/50 dark:border-cyan-500/20 backdrop-blur-sm">
              {/* コンテンツヘッダー */}
              <div className="px-6 py-4 border-b flex items-center justify-between border-purple-200/50 dark:border-cyan-500/20">
                <div className="flex items-center gap-3">
                  {currentTab && <currentTab.icon size={24} className="text-purple-600 dark:text-cyan-400" />}
                  <h2 className="text-xl font-bold font-mono text-purple-600 dark:text-cyan-400">
                    {currentTab?.title}
                  </h2>
                </div>
                <button
                  onClick={() => handleCopy(currentContent, activeTab)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 ${
                    copiedSection === activeTab
                      ? 'bg-green-100 text-green-600 border border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/50'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-purple-600 border border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-cyan-400 dark:border-gray-700'
                  }`}
                >
                  {copiedSection === activeTab ? (
                    <>
                      <CheckCircle size={16} />
                      <span className="text-sm font-mono">コピー済み</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span className="text-sm font-mono">コピー</span>
                    </>
                  )}
                </button>
              </div>

              {/* Markdownコンテンツ */}
              <div className="p-6 flex-1 overflow-y-auto overflow-x-hidden">
                <div className="prose prose-base max-w-none prose-purple prose-headings:text-purple-700 prose-a:text-purple-600 prose-strong:text-gray-800 dark:prose-invert dark:prose-headings:text-cyan-400 dark:prose-a:text-cyan-400 dark:prose-strong:text-white" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                  <ReactMarkdown
                    components={{
                      // コードブロック (pre > code)
                      pre: ({ children }) => {
                        return <>{children}</>;
                      },
                      code: ({ className, children }) => {
                        const isInline = !className;
                        const codeString = String(children ?? '').replace(/\n$/, '');

                        if (isInline) {
                          return <InlineCode>{codeString}</InlineCode>;
                        }

                        return (
                          <CodeBlock className={className}>
                            {codeString}
                          </CodeBlock>
                        );
                      },
                    } as Components}
                  >
                    {String(currentContent ?? '')}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                  {currentTab && <currentTab.icon size={40} className="text-gray-400 dark:text-gray-600" />}
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-600 dark:text-gray-400">
                  コンテンツがありません
                </h3>
                <p className="text-sm text-gray-500">
                  「環境情報を再生成」ボタンを押して生成してください
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {projectId && <AgentChatWidget projectId={projectId} />}
    </main>
  );
}
