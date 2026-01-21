"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  X,
  Send,
  Lightbulb,
  Loader2,
  GripVertical,
  Sparkles,
} from "lucide-react";
import {
  chatWithIdeaSupportStream,
  ChatMessage,
  IdeaProposal,
} from "@/libs/service/ideaSupport";
import { IdeaProposalCard } from "./IdeaProposalCard";

interface IdeaSupportChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onIdeaSelected: (title: string, idea: string) => void;
  onOpen: () => void;
  showIdleHint?: boolean;
  onDismissHint?: () => void;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 520;

const INITIAL_MESSAGE = `ハッカソンのアイデア、一緒に考えよう！
最近、何か困ってることや不便に感じてることある？
あるいは、興味ある分野や使ってみたい技術があれば教えて！`;

export default function IdeaSupportChatWidget({
  isOpen,
  onClose,
  onIdeaSelected,
  onOpen,
  showIdleHint = false,
  onDismissHint,
}: IdeaSupportChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentProposal, setCurrentProposal] = useState<IdeaProposal | null>(null);
  const [size, setSize] = useState({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [isResizing, setIsResizing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !chatWindowRef.current) return;

      const rect = chatWindowRef.current.getBoundingClientRect();
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, rect.right - e.clientX)
      );
      const newHeight = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, rect.bottom - e.clientY)
      );

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setCurrentProposal(null); // 新しいメッセージ送信時に前の提案をクリア

    // Add user message
    const newUserMessage: ChatMessage = { role: "user", content: userMessage };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);
    setStreamingContent("");

    // Get AI response via streaming
    let fullContent = "";
    await chatWithIdeaSupportStream(
      userMessage,
      messages,
      // onChunk
      (chunk) => {
        fullContent += chunk;
        setStreamingContent(fullContent);
      },
      // onProposal
      (proposal) => {
        setCurrentProposal(proposal);
      },
      // onDone
      () => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fullContent },
        ]);
        setStreamingContent("");
        setIsLoading(false);
      },
      // onError
      (error) => {
        console.error("Chat error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "申し訳ありません。エラーが発生しました。もう一度お試しください。",
          },
        ]);
        setStreamingContent("");
        setIsLoading(false);
      }
    );
  }, [inputValue, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 提案を受け入れてフォームに反映
  const handleAcceptProposal = useCallback(() => {
    if (!currentProposal) return;

    setIsAccepting(true);
    try {
      onIdeaSelected(currentProposal.title, currentProposal.description);
      onClose();
      // Reset state
      setMessages([{ role: "assistant", content: INITIAL_MESSAGE }]);
      setCurrentProposal(null);
    } finally {
      setIsAccepting(false);
    }
  }, [currentProposal, onIdeaSelected, onClose]);

  // 提案を継続して対話を続ける
  const handleContinueProposal = useCallback(() => {
    setCurrentProposal(null);
    // 入力欄にフォーカス
    inputRef.current?.focus();
  }, []);

  // ヒントをクリックしてモーダルを開く
  const handleHintClick = useCallback(() => {
    onDismissHint?.();
    onOpen();
  }, [onDismissHint, onOpen]);

  return (
    <>
      {/* Idle Hint Bubble - 独立した要素として最前面に配置 */}
      {!isOpen && showIdleHint && (
        <div
          onClick={handleHintClick}
          className="fixed bottom-28 right-6 z-[9999] cursor-pointer animate-bounce"
        >
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-purple-400 dark:border-cyan-400 px-4 py-3 max-w-[220px]">
            <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">
              アイデアが思いつかない？
              <br />
              <span className="text-purple-600 dark:text-cyan-400">
                ここをクリック！
              </span>
            </p>
            {/* Speech bubble tail */}
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white dark:bg-gray-800 border-r-2 border-b-2 border-purple-400 dark:border-cyan-400 transform rotate-45"></div>
          </div>
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismissHint?.();
            }}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors shadow-md"
            aria-label="ヒントを閉じる"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Floating Agent Button */}
      {!isOpen && (
        <button
          onClick={onOpen}
          className="fixed bottom-6 right-6 z-[9998] w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 shadow-2xl shadow-purple-500/50 flex items-center justify-center hover:scale-110 transition-all duration-300 border-2 border-purple-300/30 animate-pulse hover:animate-none dark:from-cyan-500 dark:via-blue-500 dark:to-purple-600 dark:shadow-cyan-500/50 dark:border-cyan-300/30"
          aria-label="アイデア発想サポートを開く"
        >
          <div className="relative">
            <Lightbulb size={32} className="text-white" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-ping dark:bg-cyan-400"></span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white dark:bg-cyan-400"></span>
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          style={{ width: size.width, height: size.height }}
          className="fixed bottom-6 right-6 bg-gradient-to-br from-slate-900/95 to-gray-950/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-purple-500/20 border-2 border-purple-500/40 flex flex-col z-50 overflow-hidden dark:shadow-cyan-500/20 dark:border-cyan-500/40"
        >
          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center text-gray-500 hover:text-purple-400 transition-colors z-10 dark:hover:text-cyan-400"
            title="ドラッグしてサイズ変更"
          >
            <GripVertical size={14} className="rotate-45" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-purple-500/30 dark:from-cyan-600/20 dark:to-blue-600/20 dark:border-cyan-500/30">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center dark:from-cyan-400 dark:to-blue-500">
                  <Lightbulb size={24} className="text-white" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-yellow-400 rounded-full border-2 border-gray-900 dark:bg-cyan-400"></span>
              </div>
              <div>
                <h3 className="font-bold text-white">アイデア出しアシスタント</h3>
                <p className="text-xs text-purple-300 dark:text-cyan-300">
                  あなたの作るもののアイデア出しをサポートします。
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors text-gray-400 hover:text-white"
              aria-label="閉じる"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-purple-500/20 to-pink-600/20 text-white rounded-br-sm border border-purple-400/50 backdrop-blur-sm dark:from-cyan-500/20 dark:to-blue-600/20 dark:border-cyan-400/50"
                      : "bg-gray-800/80 text-gray-200 border border-purple-500/20 rounded-bl-sm dark:border-cyan-500/20"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <>
                      <div className="flex items-center gap-1 mb-1 text-purple-400 dark:text-cyan-400">
                        <Sparkles size={12} />
                        <span className="text-xs font-medium">AI</span>
                      </div>
                      <div className="text-sm prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-purple-200 dark:prose-headings:text-cyan-200 prose-a:text-purple-400 dark:prose-a:text-cyan-400 prose-strong:text-white">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {message.content}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-2xl bg-gray-800/80 text-gray-200 border border-purple-500/20 rounded-bl-sm dark:border-cyan-500/20">
                  <div className="flex items-center gap-1 mb-1 text-purple-400 dark:text-cyan-400">
                    <Sparkles size={12} />
                    <span className="text-xs font-medium">AI</span>
                  </div>
                  <div className="text-sm prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-purple-200 dark:prose-headings:text-cyan-200 prose-a:text-purple-400 dark:prose-a:text-cyan-400 prose-strong:text-white">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-gray-800/80 text-gray-200 border border-purple-500/20 p-3 rounded-2xl rounded-bl-sm dark:border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <Loader2
                      size={16}
                      className="animate-spin text-purple-400 dark:text-cyan-400"
                    />
                    <span className="text-sm text-gray-400">考え中...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Proposal Card - AIが提案を行った時に表示 */}
            {currentProposal && !isLoading && (
              <div className="my-3">
                <IdeaProposalCard
                  proposal={currentProposal}
                  onAccept={handleAcceptProposal}
                  onContinue={handleContinueProposal}
                  isLoading={isAccepting}
                />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-purple-500/30 bg-gray-900/50 dark:border-cyan-500/30">
            {/* Message Input */}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力..."
                disabled={isLoading}
                className="flex-1 bg-gray-800/80 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition-all disabled:opacity-50 dark:border-cyan-500/30 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-400 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/30 dark:from-cyan-500 dark:to-blue-600 dark:hover:from-cyan-400 dark:hover:to-blue-500 dark:hover:shadow-cyan-500/30"
                aria-label="送信"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
