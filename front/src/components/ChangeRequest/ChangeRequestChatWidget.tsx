"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, Loader2, GripVertical } from 'lucide-react';
import { ChangeProposalCard } from './ChangeProposalCard';
import { useChangeRequest } from '@/hooks/useChangeRequest';
import type { ChangeProposal, ChangeProposalUI } from '@/types/modelTypes';

interface ChangeRequestChatWidgetProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onApproved?: () => void;
}

// チャットメッセージの型
type ChatMessage = {
  id: string;
  type: 'user' | 'assistant' | 'proposal';
  content?: string;
  proposal?: ChangeProposal | ChangeProposalUI;
  timestamp: Date;
};

const MIN_WIDTH = 380;
const MIN_HEIGHT = 500;
const MAX_WIDTH = 700;
const MAX_HEIGHT = 800;
const DEFAULT_WIDTH = 450;
const DEFAULT_HEIGHT = 600;

/**
 * 仕様変更リクエスト専用チャットウィジェット
 *
 * フロー:
 * 1. ユーザーが変更要望を入力
 * 2. AIが提案を生成（チャット履歴内にカードで表示）
 * 3. 修正要求があれば履歴を保持しつつ新しい提案を追加
 */
export function ChangeRequestChatWidget({
  projectId,
  isOpen,
  onClose,
  onApproved,
}: ChangeRequestChatWidgetProps) {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  const {
    requestId,
    proposal,
    isLoading,
    error,
    propose,
    revise,
    approve,
    cancel,
    reset,
  } = useChangeRequest();

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // proposalが更新されたらメッセージに追加
  useEffect(() => {
    if (proposal && isLoading === false) {
      // 既存の提案メッセージを確認して、重複を避ける
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.type !== 'proposal' || lastMessage.proposal !== proposal) {
        setMessages(prev => [
          ...prev,
          {
            id: `proposal-${Date.now()}`,
            type: 'proposal',
            proposal: proposal,
            timestamp: new Date(),
          }
        ]);
      }
    }
  }, [proposal, isLoading]);

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

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue('');

    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      if (!requestId) {
        // 初回: 変更提案を作成
        await propose(projectId, message);
      } else {
        // 修正要求を送信
        await revise(message);
      }
    } catch (err) {
      console.error('Change request error:', err);
      // エラーメッセージを追加
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: 'assistant',
          content: 'エラーが発生しました。もう一度お試しください。',
          timestamp: new Date(),
        }
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApprove = async () => {
    try {
      await approve();
      // 成功メッセージを追加
      setMessages(prev => [
        ...prev,
        {
          id: `success-${Date.now()}`,
          type: 'assistant',
          content: '変更が適用されました。タスクと依存関係が更新されています。',
          timestamp: new Date(),
        }
      ]);
      onApproved?.();
      // 少し待ってから閉じる
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  const handleCancel = async () => {
    try {
      await cancel();
      handleClose();
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  const handleClose = () => {
    reset();
    setInputValue('');
    setMessages([]);
    onClose();
  };

  const renderMessage = (msg: ChatMessage) => {
    if (msg.type === 'proposal' && msg.proposal) {
      return (
        <div key={msg.id} className="my-3">
          <ChangeProposalCard
            proposal={msg.proposal}
            onApprove={handleApprove}
            onRevise={() => inputRef.current?.focus()}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        </div>
      );
    }

    const isUser = msg.type === 'user';
    return (
      <div
        key={msg.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`max-w-[85%] p-3 rounded-2xl ${
            isUser
              ? 'bg-gradient-to-r from-purple-500/20 to-pink-600/20 text-white rounded-br-sm border border-purple-400/50'
              : 'bg-gray-800/80 text-gray-200 border border-purple-500/20 rounded-bl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          <p className={`text-xs mt-1 ${isUser ? 'text-purple-300' : 'text-gray-500'}`}>
            {msg.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      ref={chatWindowRef}
      style={{ width: size.width, height: size.height }}
      className="fixed bottom-6 right-6 bg-gradient-to-br from-slate-900/95 to-gray-950/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-purple-500/20 border-2 border-purple-500/40 flex flex-col z-50 overflow-hidden"
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center text-gray-500 hover:text-purple-400 transition-colors z-10"
        title="ドラッグしてサイズ変更"
      >
        <GripVertical size={14} className="rotate-45" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-purple-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
            <Sparkles size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">仕様変更アシスタント</h3>
            <p className="text-xs text-purple-300">
              {requestId ? '提案を確認中 - 修正があれば入力' : '変更要望を入力してください'}
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors text-gray-400 hover:text-white"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <Sparkles size={48} className="mx-auto mb-4 text-purple-400/50" />
            <p className="text-sm mb-2">どのような変更をしたいですか？</p>
            <p className="text-xs text-gray-500">
              例: 「LINE Botベースにしたい」<br />
              「ランキング機能を追加したい」
            </p>
          </div>
        )}

        {messages.map(renderMessage)}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800/80 text-gray-200 border border-purple-500/20 p-3 rounded-2xl rounded-bl-sm">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-purple-400" />
                <span className="text-sm text-gray-400">提案を生成中...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-purple-500/30 bg-gray-900/50">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              requestId
                ? '修正内容を入力...'
                : '変更したい内容を入力...'
            }
            disabled={isLoading}
            className="flex-1 bg-gray-800/80 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-400 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/30"
            aria-label="Send message"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangeRequestChatWidget;
