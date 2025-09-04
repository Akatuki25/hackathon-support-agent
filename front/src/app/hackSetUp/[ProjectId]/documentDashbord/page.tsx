"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FileText, Code, FolderTree, Download, Copy, RefreshCw, Terminal, Database, Cpu } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import Header from "@/components/Session/Header";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import { getDocument } from "@/libs/modelAPI/document";

export type ProjectDocumentType = {
  document_id?: string;
  project_id: string;
  specification_doc: string;
  frame_work_doc: string;
  directory_info: string;
};

type TabType = 'specification' | 'framework' | 'directory';

export default function DocumentDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const { darkMode } = useDarkMode();
  const [documentData, setDocumentData] = useState<ProjectDocumentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [copiedSection, setCopiedSection] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabType>('specification');

  const projectId = pathname.split("/")[2]; // パスからプロジェクトIDを取得

  useEffect(() => {
    if (typeof window !== "undefined" && projectId) {
      fetchDocumentData();
    }
  }, [projectId]);

  const fetchDocumentData = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getDocument(projectId);
      setDocumentData(data);
    } catch (error) {
      console.error("ドキュメントデータの取得に失敗:", error);
      setError("ドキュメントの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(""), 2000);
    } catch (error) {
      console.error("コピーに失敗:", error);
    }
  };

  const formatDirectoryStructure = (directoryInfo: string) => {
    // ディレクトリ構造を見やすく整形
    return directoryInfo
      .split('\n')
      .map((line, index) => {
        const depth = (line.match(/^\s*/)?.[0].length || 0) / 2;
        const content = line.trim();
        if (!content) return null;
        
        return (
          <div 
            key={index} 
            className={`font-mono text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {content.startsWith('├') || content.startsWith('└') ? (
              <span className={darkMode ? 'text-cyan-400' : 'text-purple-600'}>
                {content.substring(0, 2)}
              </span>
            ) : null}
            <span className={content.includes('.') ? (darkMode ? 'text-pink-300' : 'text-blue-600') : ''}>
              {content.substring(2) || content}
            </span>
          </div>
        );
      })
      .filter(Boolean);
  };

  const tabs = [
    {
      id: 'specification' as TabType,
      title: '仕様書',
      icon: FileText,
      description: 'プロジェクトの詳細仕様とビジネス要件',
      content: documentData?.specification_doc || '',
      color: darkMode ? 'cyan' : 'purple'
    },
    {
      id: 'framework' as TabType,
      title: '技術要件',
      icon: Code,
      description: '選択されたフレームワークと技術スタック',
      content: documentData?.frame_work_doc || '',
      color: darkMode ? 'pink' : 'blue'
    },
    {
      id: 'directory' as TabType,
      title: 'ディレクトリ構成',
      icon: FolderTree,
      description: 'プロジェクトの推奨ディレクトリ構造',
      content: documentData?.directory_info || '',
      color: darkMode ? 'green' : 'indigo',
      isStructured: true
    }
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      cyan: darkMode ? 'text-cyan-400 border-cyan-500' : 'text-cyan-600 border-cyan-500',
      purple: darkMode ? 'text-purple-400 border-purple-500' : 'text-purple-600 border-purple-500',
      pink: darkMode ? 'text-pink-400 border-pink-500' : 'text-pink-600 border-pink-500',
      blue: darkMode ? 'text-blue-400 border-blue-500' : 'text-blue-600 border-blue-500',
      green: darkMode ? 'text-green-400 border-green-500' : 'text-green-600 border-green-500',
      indigo: darkMode ? 'text-indigo-400 border-indigo-500' : 'text-indigo-600 border-indigo-500'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.cyan;
  };

  const getCurrentTab = () => tabs.find(tab => tab.id === activeTab);

  if (loading) {
    return (
      <>
        <div className="w-full top-0 left-0 right-0 z-99 absolute">
          <Header />
        </div>
        <main className="relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col justify-center items-center py-32">
              <div className={`animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 mb-6 ${
                darkMode ? 'border-cyan-500' : 'border-purple-500'
              }`}></div>
              <p className={`text-xl ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`}>
                ドキュメントを読み込み中...
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="w-full top-0 left-0 right-0 z-99 absolute">
          <Header />
        </div>
        <main className="relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-32">
              <div className={`text-6xl mb-6 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                ⚠️
              </div>
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                エラーが発生しました
              </h2>
              <p className={`text-lg mb-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {error}
              </p>
              <button
                onClick={fetchDocumentData}
                className={`px-8 py-3 flex items-center justify-center mx-auto rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                  darkMode 
                    ? 'bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400' 
                    : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400'
                }`}
              >
                <RefreshCw size={18} className="mr-2" />
                再試行
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      <main className="relative z-10">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4 mt-5">
              <Database className={`mr-2 ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`} />
              <h1 className={`text-3xl font-bold tracking-wider ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
                プロジェクト<span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>_ドキュメント</span>
              </h1>
            </div>
            <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              生成されたプロジェクトドキュメントの一覧です
            </p>
          </div>

          {/* Overview Section */}
          <div className={`backdrop-blur-lg rounded-xl p-8 shadow-xl border mb-8 ${
            darkMode 
              ? 'bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20' 
              : 'bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20'
          }`}>
            <div className="flex items-center mb-6">
              <Cpu className={`mr-3 ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`} size={24} />
              <h2 className={`text-xl font-bold ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
                ドキュメント<span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>_概要</span>
              </h2>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className={`p-4 rounded-lg border-l-4 ${
                darkMode 
                  ? 'bg-gray-700/50 border-cyan-500' 
                  : 'bg-gray-50/50 border-purple-500'
              }`}>
                <div className="flex items-center mb-2">
                  <FileText className={`mr-2 ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`} size={20} />
                  <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>仕様書</h3>
                </div>
                <div className={`text-lg font-bold mb-1 ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`}>
                  {documentData?.specification_doc ? '✓ 完了' : '○ 未生成'}
                </div>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {documentData?.specification_doc ? `${documentData.specification_doc.length} 文字` : '0 文字'}
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border-l-4 ${
                darkMode 
                  ? 'bg-gray-700/50 border-pink-500' 
                  : 'bg-gray-50/50 border-blue-500'
              }`}>
                <div className="flex items-center mb-2">
                  <Code className={`mr-2 ${darkMode ? 'text-pink-400' : 'text-blue-600'}`} size={20} />
                  <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>技術要件</h3>
                </div>
                <div className={`text-lg font-bold mb-1 ${darkMode ? 'text-pink-400' : 'text-blue-600'}`}>
                  {documentData?.frame_work_doc ? '✓ 完了' : '○ 未生成'}
                </div>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {documentData?.frame_work_doc ? `${documentData.frame_work_doc.length} 文字` : '0 文字'}
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border-l-4 ${
                darkMode 
                  ? 'bg-gray-700/50 border-green-500' 
                  : 'bg-gray-50/50 border-indigo-500'
              }`}>
                <div className="flex items-center mb-2">
                  <FolderTree className={`mr-2 ${darkMode ? 'text-green-400' : 'text-indigo-600'}`} size={20} />
                  <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>ディレクトリ構成</h3>
                </div>
                <div className={`text-lg font-bold mb-1 ${darkMode ? 'text-green-400' : 'text-indigo-600'}`}>
                  {documentData?.directory_info ? '✓ 完了' : '○ 未生成'}
                </div>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {documentData?.directory_info ? `${documentData.directory_info.length} 文字` : '0 文字'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={fetchDocumentData}
                className={`px-4 py-2 rounded-lg transition-all hover:scale-105 ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                <RefreshCw size={16} className="inline mr-2" />
                ドキュメント更新
              </button>
              
              {documentData?.specification_doc && (
                <button
                  onClick={() => handleCopy(documentData.specification_doc, 'spec-quick')}
                  className={`px-4 py-2 rounded-lg transition-all hover:scale-105 ${
                    copiedSection === 'spec-quick'
                      ? 'bg-green-500 text-white'
                      : darkMode
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  <Copy size={16} className="inline mr-2" />
                  仕様書をコピー
                </button>
              )}
              
              {documentData?.frame_work_doc && (
                <button
                  onClick={() => handleCopy(documentData.frame_work_doc, 'framework-quick')}
                  className={`px-4 py-2 rounded-lg transition-all hover:scale-105 ${
                    copiedSection === 'framework-quick'
                      ? 'bg-green-500 text-white'
                      : darkMode
                        ? 'bg-pink-600 hover:bg-pink-500 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  <Copy size={16} className="inline mr-2" />
                  技術要件をコピー
                </button>
              )}
            </div>
          </div>

          {/* Document Tabs - Horizontal Layout */}
          <div className={`backdrop-blur-lg rounded-xl shadow-xl border ${
            darkMode 
              ? 'bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20' 
              : 'bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20'
          }`}>
            <div className="flex min-h-[400px]">
              {/* Left Sidebar - Tab Navigation */}
              <div className={`w-80 flex-shrink-0 border-r ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                <div className="p-4">
                  <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    ドキュメント一覧
                  </h3>
                  <div className="space-y-2">
                    {tabs.map((tab) => {
                      const IconComponent = tab.icon;
                      const isActive = activeTab === tab.id;
                      const colorClasses = getColorClasses(tab.color);
                      
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center p-4 rounded-lg transition-all text-left border-l-4 ${
                            isActive
                              ? `${colorClasses.split(' ')[1]} ${colorClasses.split(' ')[0]} ${
                                  darkMode ? 'bg-gray-700/50' : 'bg-gray-50/50'
                                }`
                              : `border-transparent hover:border-gray-300 dark:hover:border-gray-500 ${
                                  darkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-100/50'
                                }`
                          }`}
                        >
                          <IconComponent size={20} className="mr-3 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{tab.title}</div>
                            <div className={`text-xs mt-1 ${
                              darkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {tab.content ? `${tab.content.length} 文字` : '未生成'}
                            </div>
                          </div>
                          {tab.content && (
                            <div className={`ml-2 w-2 h-2 rounded-full ${
                              isActive 
                                ? colorClasses.split(' ')[0].replace('text-', 'bg-')
                                : darkMode ? 'bg-green-400' : 'bg-green-500'
                            }`}></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 flex flex-col">
                {(() => {
                  const currentTab = getCurrentTab();
                  if (!currentTab) return null;
                  
                  const colorClasses = getColorClasses(currentTab.color);
                  const IconComponent = currentTab.icon;
                  
                  return (
                    <>
                      {/* Content Header */}
                      <div className={`p-6 border-b flex-shrink-0 ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <IconComponent className={`mr-3 ${colorClasses.split(' ')[0]}`} size={24} />
                            <div>
                              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                {currentTab.title}
                              </h2>
                              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {currentTab.description}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCopy(currentTab.content, currentTab.id)}
                            className={`px-4 py-2 rounded-lg transition-all hover:scale-105 flex-shrink-0 ${
                              copiedSection === currentTab.id
                                ? 'bg-green-500 text-white'
                                : darkMode
                                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            }`}
                          >
                            <Copy size={16} className="inline mr-2" />
                            {copiedSection === currentTab.id ? 'コピー済み' : 'コピー'}
                          </button>
                        </div>
                      </div>
                      
                      {/* Content Body */}
                      <div className="overflow-hidden">
                        {currentTab.content ? (
                          <div className="max-h-[70vh] overflow-y-auto p-6">
                            {currentTab.isStructured ? (
                              <div className="space-y-1">
                                {formatDirectoryStructure(currentTab.content)}
                              </div>
                            ) : (
                              <pre className={`whitespace-pre-wrap text-sm leading-relaxed ${
                                darkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                {currentTab.content}
                              </pre>
                            )}
                          </div>
                        ) : (
                          <div className="min-h-[400px] flex items-center justify-center p-6">
                            <div className="text-center">
                              <IconComponent className={`mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} size={48} />
                              <p className={`${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {currentTab.title}がまだ生成されていません
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <HackthonSupportAgent />
          </div>
        </div>
      </main>
    </>
  );
}