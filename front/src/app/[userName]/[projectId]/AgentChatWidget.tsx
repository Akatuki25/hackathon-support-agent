"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, Loader2, GripVertical } from "lucide-react";
import { chatWithHanson } from "@/libs/service/chatHanson";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AgentChatWidgetProps {
  projectId: string;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const DEFAULT_WIDTH = 384;
const DEFAULT_HEIGHT = 500;

export function AgentChatWidget({ projectId }: AgentChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [size, setSize] = useState({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, rect.right - e.clientX),
      );
      const newHeight = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, rect.bottom - e.clientY),
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

  // Build chat history string from messages
  const buildChatHistory = (): string => {
    return messages
      .map(
        (msg) =>
          `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`,
      )
      .join("\n");
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const chatHistory = buildChatHistory();
      const response = await chatWithHanson(
        projectId,
        userMessage.content,
        chatHistory,
        false,
      );

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "エラーが発生しました。もう一度お試しください。",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Agent Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-700 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 transition-all duration-300 z-50 border-2 border-cyan-300/30 animate-pulse hover:animate-none"
          aria-label="Open chat"
        >
          <div className="relative">
            <Bot size={32} className="text-white" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full border-2 border-white animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full border-2 border-white"></span>
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          style={{ width: size.width, height: size.height }}
          className="fixed bottom-6 right-6 bg-gradient-to-br from-slate-900/95 to-gray-950/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-cyan-500/20 border-2 border-cyan-500/40 flex flex-col z-50 overflow-hidden"
        >
          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center text-gray-500 hover:text-cyan-400 transition-colors z-10"
            title="ドラッグしてサイズ変更"
          >
            <GripVertical size={14} className="rotate-45" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-cyan-500/30">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                  <Bot size={24} className="text-white" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-cyan-400 rounded-full border-2 border-gray-900"></span>
              </div>
              <div>
                <h3 className="font-bold text-white">Hanson AI</h3>
                <p className="text-xs text-cyan-300">
                  開発サポートエージェント
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors text-gray-400 hover:text-white"
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <Bot size={48} className="mx-auto mb-4 text-cyan-400/50" />
                <p className="text-sm">こんにちは！</p>
                <p className="text-sm">
                  ハッカソン開発について何でも聞いてください。
                </p>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white rounded-br-sm border border-cyan-400/50 backdrop-blur-sm"
                      : "bg-gray-800/80 text-gray-200 border border-cyan-500/20 rounded-bl-sm"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="text-sm prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-cyan-200 prose-a:text-cyan-400 prose-strong:text-white [&_pre]:bg-gray-950 [&_pre]:border [&_pre]:border-cyan-500/40 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:relative [&_pre]:before:content-['CODE'] [&_pre]:before:absolute [&_pre]:before:top-0 [&_pre]:before:right-0 [&_pre]:before:bg-cyan-500/30 [&_pre]:before:text-cyan-300 [&_pre]:before:text-[10px] [&_pre]:before:px-2 [&_pre]:before:py-0.5 [&_pre]:before:rounded-bl-md [&_pre]:before:rounded-tr-lg [&_pre]:before:font-mono [&_code]:text-cyan-300 [&_code]:bg-gray-900/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-sm [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-all">
                      <ReactMarkdown>
                        {String(message.content ?? "")}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  )}
                  <p
                    className={`text-xs mt-1 ${message.role === "user" ? "text-cyan-300" : "text-gray-500"}`}
                  >
                    {message.timestamp.toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800/80 text-gray-200 border border-cyan-500/20 p-3 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-cyan-400" />
                    <span className="text-sm text-gray-400">考え中...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-cyan-500/30 bg-gray-900/50">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力..."
                disabled={isLoading}
                className="flex-1 bg-gray-800/80 border border-cyan-500/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/30"
                aria-label="Send message"
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
