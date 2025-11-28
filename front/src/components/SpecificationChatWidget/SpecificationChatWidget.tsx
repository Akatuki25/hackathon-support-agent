"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, FileText, Loader2, GripVertical } from 'lucide-react';
import { chatAboutSpecification } from '@/libs/service/specificationChat';
import { useDarkMode } from '@/hooks/useDarkMode';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SpecificationChatWidgetProps {
  projectId: string;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const DEFAULT_WIDTH = 384;
const DEFAULT_HEIGHT = 500;

export function SpecificationChatWidget({ projectId }: SpecificationChatWidgetProps) {
  const { darkMode } = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !chatWindowRef.current) return;

      const rect = chatWindowRef.current.getBoundingClientRect();
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rect.right - e.clientX));
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rect.bottom - e.clientY));

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Build chat history string from messages
  const buildChatHistory = (): string => {
    return messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const chatHistory = buildChatHistory();
      const response = await chatAboutSpecification(projectId, userMessage.content, chatHistory);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'エラーが発生しました。もう一度お試しください。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter で送信
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-300 z-50 border-2 animate-pulse hover:animate-none ${
            darkMode
              ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-pink-700 shadow-purple-500/50 border-purple-300/30'
              : 'bg-gradient-to-br from-purple-500 via-blue-500 to-blue-700 shadow-purple-300/50 border-purple-300/30'
          }`}
          aria-label="Open specification chat"
        >
          <div className="relative">
            <FileText size={32} className="text-white" />
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white animate-ping ${
              darkMode ? 'bg-pink-400' : 'bg-purple-400'
            }`}></span>
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
              darkMode ? 'bg-pink-400' : 'bg-purple-400'
            }`}></span>
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          style={{ width: size.width, height: size.height }}
          className={`fixed bottom-6 right-6 backdrop-blur-xl rounded-2xl shadow-2xl border-2 flex flex-col z-50 overflow-hidden ${
            darkMode
              ? 'bg-gradient-to-br from-slate-900/95 to-gray-950/95 shadow-purple-500/20 border-purple-500/40'
              : 'bg-gradient-to-br from-white/95 to-gray-50/95 shadow-purple-300/30 border-purple-400/40'
          }`}
        >
          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className={`absolute top-0 left-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center transition-colors z-10 ${
              darkMode ? 'text-gray-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-600'
            }`}
            title="ドラッグしてサイズ変更"
          >
            <GripVertical size={14} className="rotate-45" />
          </div>

          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${
            darkMode
              ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/30'
              : 'bg-gradient-to-r from-purple-100/50 to-blue-100/50 border-purple-300/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  darkMode
                    ? 'bg-gradient-to-br from-purple-400 to-pink-500'
                    : 'bg-gradient-to-br from-purple-500 to-blue-500'
                }`}>
                  <FileText size={24} className="text-white" />
                </div>
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                  darkMode ? 'bg-purple-400 border-gray-900' : 'bg-purple-500 border-white'
                }`}></span>
              </div>
              <div>
                <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  仕様書アシスタント
                </h3>
                <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                  仕様についての質問に回答
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode
                  ? 'hover:bg-gray-800/50 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-200/50 text-gray-500 hover:text-gray-800'
              }`}
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <FileText size={48} className={`mx-auto mb-4 ${
                  darkMode ? 'text-purple-400/50' : 'text-purple-500/50'
                }`} />
                <p className="text-sm">こんにちは！</p>
                <p className="text-sm">仕様書の内容について質問してください。</p>
                <p className="text-xs mt-2 opacity-70">
                  例：「なぜこの機能を選んだのですか？」
                </p>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    message.role === 'user'
                      ? darkMode
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-600/20 text-white rounded-br-sm border border-purple-400/50 backdrop-blur-sm'
                        : 'bg-gradient-to-r from-purple-500/20 to-blue-600/20 text-gray-800 rounded-br-sm border border-purple-400/50 backdrop-blur-sm'
                      : darkMode
                        ? 'bg-gray-800/80 text-gray-200 border border-purple-500/20 rounded-bl-sm'
                        : 'bg-white/80 text-gray-700 border border-purple-300/30 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className={`text-base leading-relaxed tracking-wide prose prose-base max-w-none ${
                      darkMode
                        ? 'prose-invert prose-p:my-3 prose-p:text-base prose-ul:my-3 prose-ol:my-3 prose-li:my-1.5 prose-li:text-base prose-headings:text-purple-200 prose-headings:font-bold prose-headings:border-b prose-headings:border-purple-500/30 prose-headings:pb-2 prose-headings:mb-3 prose-headings:mt-4 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-purple-400 prose-strong:text-purple-300 prose-strong:font-bold [&_code]:text-purple-300 [&_code]:bg-gray-900/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono'
                        : 'prose-p:my-3 prose-p:text-base prose-ul:my-3 prose-ol:my-3 prose-li:my-1.5 prose-li:text-base prose-headings:text-purple-800 prose-headings:font-bold prose-headings:border-b prose-headings:border-purple-300/50 prose-headings:pb-2 prose-headings:mb-3 prose-headings:mt-4 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-purple-600 prose-strong:text-purple-700 prose-strong:font-bold [&_code]:text-purple-700 [&_code]:bg-purple-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono'
                    }`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match;
                            return !isInline ? (
                              <SyntaxHighlighter
                                style={darkMode ? oneDark : oneLight}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{
                                  margin: '0.75rem 0',
                                  borderRadius: '0.5rem',
                                  fontSize: '0.875rem',
                                  padding: '1rem',
                                }}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-base whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                  <p className={`text-xs mt-1 ${
                    message.role === 'user'
                      ? darkMode ? 'text-purple-300' : 'text-purple-600'
                      : darkMode ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className={`p-3 rounded-2xl rounded-bl-sm ${
                  darkMode
                    ? 'bg-gray-800/80 text-gray-200 border border-purple-500/20'
                    : 'bg-white/80 text-gray-700 border border-purple-300/30 shadow-sm'
                }`}>
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className={`animate-spin ${
                      darkMode ? 'text-purple-400' : 'text-purple-500'
                    }`} />
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      考え中...
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className={`p-4 border-t ${
            darkMode
              ? 'border-purple-500/30 bg-gray-900/50'
              : 'border-purple-300/30 bg-gray-50/50'
          }`}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="仕様について質問... (Ctrl+Enterで送信)"
                disabled={isLoading}
                rows={2}
                className={`flex-1 rounded-xl px-4 py-3 transition-all disabled:opacity-50 resize-none ${
                  darkMode
                    ? 'bg-gray-800/80 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50'
                    : 'bg-white/80 border border-purple-300/50 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50'
                }`}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className={`p-3 rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  darkMode
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 hover:shadow-lg hover:shadow-purple-500/30'
                    : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-400 hover:to-blue-500 hover:shadow-lg hover:shadow-purple-300/30'
                }`}
                aria-label="Send message"
              >
                <Send size={20} />
              </button>
            </div>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Ctrl+Enter で送信
            </p>
          </div>
        </div>
      )}
    </>
  );
}
