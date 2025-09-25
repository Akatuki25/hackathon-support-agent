"use client";

import React, { useState } from "react";
import {
  Check, Star, Clock, BarChart, ChevronDown, ChevronRight,
  ExternalLink, BookOpen, Code, Lightbulb, Link2, Globe
} from "lucide-react";
import { EnhancedTaskDetail } from "@/types/taskTypes";

interface EnhancedTaskCardProps {
  task: EnhancedTaskDetail;
  isDarkMode?: boolean;
  onTaskClick?: (task: EnhancedTaskDetail) => void;
}

const EnhancedTaskCard: React.FC<EnhancedTaskCardProps> = ({
  task,
  isDarkMode = true,
  onTaskClick
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'technologies' | 'resources'>('detail');
  const tabs = ['detail', 'technologies', 'resources'] as const;

  // 優先度に基づいて色を設定
  const getPriorityStyles = () => {
    if (isDarkMode) {
      switch (task.priority) {
        case "Must":
          return "border-red-500 text-red-300 bg-red-900/20";
        case "Should":
          return "border-yellow-500 text-yellow-300 bg-yellow-900/20";
        case "Could":
          return "border-blue-500 text-blue-300 bg-blue-900/20";
        default:
          return "border-gray-500 text-gray-300 bg-gray-900/20";
      }
    } else {
      switch (task.priority) {
        case "Must":
          return "border-red-500 text-red-700 bg-red-50";
        case "Should":
          return "border-yellow-600 text-yellow-700 bg-yellow-50";
        case "Could":
          return "border-blue-500 text-blue-700 bg-blue-50";
        default:
          return "border-gray-400 text-gray-700 bg-gray-50";
      }
    }
  };

  // 優先度に応じたアイコンを取得
  const getPriorityIcon = () => {
    switch (task.priority) {
      case "Must":
        return <Star size={16} className="mr-1" />;
      case "Should":
        return <Clock size={16} className="mr-1" />;
      case "Could":
        return <BarChart size={16} className="mr-1" />;
      default:
        return null;
    }
  };

  // 学習リソースを分類
  const categorizeResources = (resources: string[]) => {
    const categories = {
      official: [] as string[],
      documentation: [] as string[],
      tutorials: [] as string[],
      other: [] as string[]
    };

    resources.forEach(url => {
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('official') || lowerUrl.includes('.org') || lowerUrl.includes('.io')) {
        categories.official.push(url);
      } else if (lowerUrl.includes('docs') || lowerUrl.includes('documentation')) {
        categories.documentation.push(url);
      } else if (lowerUrl.includes('tutorial') || lowerUrl.includes('getting-started') || lowerUrl.includes('guide')) {
        categories.tutorials.push(url);
      } else {
        categories.other.push(url);
      }
    });

    return categories;
  };

  const resourceCategories = categorizeResources(task.learning_resources);

  return (
    <div
      className={`rounded-lg transition-all border-l-4 shadow-lg cursor-pointer ${getPriorityStyles()} ${
        isDarkMode
          ? "bg-gray-800/80 hover:bg-gray-700/80"
          : "bg-white hover:bg-gray-50"
      }`}
      onClick={() => onTaskClick?.(task)}
    >
      <div className="p-5 relative overflow-hidden">
        {/* 背景装飾 */}
        <div className="absolute top-0 right-0 w-16 h-16 opacity-5">
          <svg viewBox="0 0 100 100" fill={isDarkMode ? "#ffffff" : "#000000"}>
            <path d="M0,50 L50,0 L100,50 L50,100 Z" />
          </svg>
        </div>

        {/* タイトルと優先度 */}
        <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
          <h2
            className={`text-xl font-bold ${
              isDarkMode ? "text-cyan-300" : "text-blue-700"
            }`}
          >
            {task.task_name}
          </h2>

          <div className="flex items-center gap-2">
            <div
              className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
                isDarkMode ? "bg-gray-700" : "bg-gray-100"
              }`}
            >
              {getPriorityIcon()}
              <span>優先度: {task.priority}</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={`p-1 rounded transition-colors ${
                isDarkMode ? "hover:bg-gray-600" : "hover:bg-gray-200"
              }`}
            >
              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>

        {/* タスク内容 */}
        <div
          className={`mt-3 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
        >
          <div className="flex items-start">
            <Check
              size={18}
              className={`mt-1 mr-2 flex-shrink-0 ${
                isDarkMode ? "text-pink-500" : "text-purple-600"
              }`}
            />
            <p>{task.content}</p>
          </div>
        </div>

        {/* 技術タグ */}
        {task.technologies_used.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {task.technologies_used.map((tech, index) => (
              <span
                key={index}
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isDarkMode
                    ? "bg-cyan-900/30 text-cyan-300 border border-cyan-700"
                    : "bg-blue-100 text-blue-700 border border-blue-200"
                }`}
              >
                <Code size={12} className="inline mr-1" />
                {tech.name}
              </span>
            ))}
          </div>
        )}

        {/* 教育的ノート */}
        {task.educational_notes && (
          <div className={`mt-3 p-2 rounded text-sm ${
            isDarkMode ? "bg-purple-900/20 text-purple-300" : "bg-purple-50 text-purple-700"
          }`}>
            <Lightbulb size={14} className="inline mr-1" />
            {task.educational_notes}
          </div>
        )}

        {/* 展開可能なセクション */}
        {isExpanded && (
          <div className="mt-4 border-t border-gray-600 pt-4">
            {/* タブ */}
            <div className="flex gap-2 mb-3">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab(tab);
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? isDarkMode
                        ? "bg-cyan-600 text-white"
                        : "bg-blue-600 text-white"
                      : isDarkMode
                        ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {tab === 'detail' && <BookOpen size={14} className="inline mr-1" />}
                  {tab === 'technologies' && <Code size={14} className="inline mr-1" />}
                  {tab === 'resources' && <Link2 size={14} className="inline mr-1" />}
                  {tab === 'detail' ? '詳細' : tab === 'technologies' ? '技術' : 'リソース'}
                </button>
              ))}
            </div>

            {/* タブコンテンツ */}
            <div className={`${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              {activeTab === 'detail' && (
                <div className="space-y-3">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: task.detail.replace(/\n/g, '<br />') }}
                  />
                  {task.dependency_explanation && (
                    <div className={`p-2 rounded text-sm ${
                      isDarkMode ? "bg-orange-900/20 text-orange-300" : "bg-orange-50 text-orange-700"
                    }`}>
                      <strong>依存関係:</strong> {task.dependency_explanation}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'technologies' && (
                <div className="space-y-3">
                  {task.technologies_used.map((tech, index) => (
                    <div key={index} className={`border rounded p-3 ${
                      isDarkMode ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50"
                    }`}>
                      <h4 className="font-semibold text-lg mb-2">{tech.name}</h4>
                      <p className="text-sm mb-2">{tech.why_needed}</p>

                      <div className="mb-2">
                        <strong className="text-xs">主要概念:</strong>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tech.key_concepts.map((concept, idx) => (
                            <span key={idx} className={`px-2 py-1 rounded text-xs ${
                              isDarkMode ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-700"
                            }`}>
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 text-xs">
                        <a
                          href={tech.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center hover:underline ${
                            isDarkMode ? "text-cyan-400" : "text-blue-600"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe size={12} className="mr-1" />
                          公式
                        </a>
                        <a
                          href={tech.documentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center hover:underline ${
                            isDarkMode ? "text-cyan-400" : "text-blue-600"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <BookOpen size={12} className="mr-1" />
                          ドキュメント
                        </a>
                        <a
                          href={tech.tutorial_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center hover:underline ${
                            isDarkMode ? "text-cyan-400" : "text-blue-600"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <BookOpen size={12} className="mr-1" />
                          チュートリアル
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="space-y-3">
                  {Object.entries(resourceCategories).map(([category, urls]) =>
                    urls.length > 0 && (
                      <div key={category}>
                        <h4 className="font-semibold mb-2 capitalize">
                          {category === 'official' ? '公式サイト' :
                           category === 'documentation' ? 'ドキュメント' :
                           category === 'tutorials' ? 'チュートリアル' : 'その他'}
                        </h4>
                        <div className="space-y-1">
                          {urls.map((url, index) => (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center text-sm hover:underline ${
                                isDarkMode ? "text-cyan-400" : "text-blue-600"
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={14} className="mr-2" />
                              {url.length > 60 ? `${url.substring(0, 60)}...` : url}
                            </a>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 下部デコレーション */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-px opacity-20 ${
            isDarkMode
              ? "bg-gradient-to-r from-cyan-500 via-transparent to-pink-500"
              : "bg-gradient-to-r from-blue-500 via-transparent to-purple-500"
          }`}
        ></div>
      </div>
    </div>
  );
};

export default EnhancedTaskCard;
