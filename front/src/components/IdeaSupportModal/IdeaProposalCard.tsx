"use client";

import React from "react";
import { Check, MessageSquare, Lightbulb, Loader2 } from "lucide-react";
import type { IdeaProposal } from "@/libs/service/ideaSupport";

interface IdeaProposalCardProps {
  proposal: IdeaProposal;
  onAccept: () => void;
  onContinue: () => void;
  isLoading?: boolean;
}

/**
 * AIが提案したアイデアを表示するカード
 * 「このアイデアで始める」と「もう少し考える」ボタンを表示
 */
export function IdeaProposalCard({
  proposal,
  onAccept,
  onContinue,
  isLoading = false,
}: IdeaProposalCardProps) {
  return (
    <div className="bg-gradient-to-br from-slate-900/95 to-gray-950/95 backdrop-blur-xl rounded-2xl border-2 border-green-500/40 overflow-hidden shadow-xl shadow-green-500/10 dark:border-cyan-500/40 dark:shadow-cyan-500/10">
      {/* ヘッダー */}
      <div className="p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-b border-green-500/30 dark:from-cyan-600/20 dark:to-blue-600/20 dark:border-cyan-500/30">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-green-400 dark:text-cyan-400" />
          <h3 className="font-bold text-white">アイデア提案</h3>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4 space-y-3">
        {/* タイトル */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-green-500/20 dark:border-cyan-500/20">
          <p className="text-xs text-green-400 dark:text-cyan-400 mb-1">タイトル案</p>
          <p className="text-white font-medium text-lg">『{proposal.title}』</p>
        </div>

        {/* 説明 */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-green-500/20 dark:border-cyan-500/20">
          <p className="text-xs text-green-400 dark:text-cyan-400 mb-1">アイデア内容</p>
          <p className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
            {proposal.description}
          </p>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="p-4 border-t border-green-500/30 dark:border-cyan-500/30 bg-gray-900/50 flex gap-2">
        <button
          onClick={onAccept}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-green-500/30 font-medium"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" />
              このアイデアで始める
            </>
          )}
        </button>

        <button
          onClick={onContinue}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600/50"
        >
          <MessageSquare className="w-4 h-4" />
          もう少し考える
        </button>
      </div>
    </div>
  );
}

export default IdeaProposalCard;
