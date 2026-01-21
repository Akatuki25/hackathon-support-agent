"use client";

import React, { useState } from 'react';
import {
  Check,
  X,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  AlertCircle,
  Loader2,
  Layers,
  ListTodo,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type {
  ChangeProposal,
  ChangeProposalUI,
  ChangeItem,
  FunctionChange,
  FunctionModify,
  TaskChange,
  TaskModify,
} from '@/types/modelTypes';

interface ChangeProposalCardProps {
  proposal: ChangeProposal | ChangeProposalUI;
  onApprove?: () => void;
  onRevise?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

type TabType = 'functions' | 'tasks';

// 各項目の型を統一するためのユニオン型
type ChangeItemData = ChangeItem | FunctionChange | FunctionModify | TaskChange | TaskModify | string;

/**
 * 変更提案カードコンポーネント
 * タブ切り替えで機能/タスクの変更を表示
 */
export function ChangeProposalCard({
  proposal,
  onApprove,
  onRevise,
  onCancel,
  isLoading = false,
}: ChangeProposalCardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');

  // 機能の変更情報
  const functionsToDiscard = proposal.functions?.discard ?? [];
  const functionsToAdd = proposal.functions?.add ?? [];
  const functionsToModify = proposal.functions?.modify ?? [];

  // タスクの変更情報
  const tasksToDiscard = proposal.tasks?.discard ?? [];
  const tasksToAdd = proposal.tasks?.add ?? [];
  const tasksToModify = proposal.tasks?.modify ?? [];

  // 変更件数
  const functionChangeCount = functionsToDiscard.length + functionsToAdd.length + functionsToModify.length;
  const taskChangeCount = tasksToDiscard.length + tasksToAdd.length + tasksToModify.length;

  return (
    <div className="bg-gradient-to-br from-slate-900/95 to-gray-950/95 backdrop-blur-xl rounded-2xl border-2 border-cyan-500/40 overflow-hidden shadow-xl shadow-cyan-500/10">
      {/* ヘッダー */}
      <div className="p-4 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-cyan-500/30">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-white">変更提案</h3>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4 space-y-4">
        {/* アプローチ */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-cyan-500/20">
          <p className="text-gray-200 text-sm">{proposal.approach}</p>
        </div>

        {/* タブ切り替え */}
        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'tasks'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            タスク
            {taskChangeCount > 0 && (
              <span className="bg-cyan-500/30 text-cyan-300 text-xs px-1.5 py-0.5 rounded-full">
                {taskChangeCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('functions')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'functions'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            機能
            {functionChangeCount > 0 && (
              <span className="bg-cyan-500/30 text-cyan-300 text-xs px-1.5 py-0.5 rounded-full">
                {functionChangeCount}
              </span>
            )}
          </button>
        </div>

        {/* タブコンテンツ */}
        <div className="space-y-3">
          {activeTab === 'tasks' ? (
            // タスクの変更
            taskChangeCount > 0 ? (
              <>
                {tasksToDiscard.length > 0 && (
                  <ChangeList
                    icon={<Minus className="w-4 h-4" />}
                    label="削除"
                    items={tasksToDiscard}
                    color="red"
                    type="discard"
                  />
                )}
                {tasksToAdd.length > 0 && (
                  <ChangeList
                    icon={<Plus className="w-4 h-4" />}
                    label="追加"
                    items={tasksToAdd}
                    color="blue"
                    type="add"
                  />
                )}
                {tasksToModify.length > 0 && (
                  <ChangeList
                    icon={<RefreshCw className="w-4 h-4" />}
                    label="変更"
                    items={tasksToModify}
                    color="yellow"
                    type="modify"
                  />
                )}
              </>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">タスクの変更なし</p>
            )
          ) : (
            // 機能の変更
            functionChangeCount > 0 ? (
              <>
                {functionsToDiscard.length > 0 && (
                  <ChangeList
                    icon={<Minus className="w-4 h-4" />}
                    label="削除"
                    items={functionsToDiscard}
                    color="red"
                    type="discard"
                  />
                )}
                {functionsToAdd.length > 0 && (
                  <ChangeList
                    icon={<Plus className="w-4 h-4" />}
                    label="追加"
                    items={functionsToAdd}
                    color="blue"
                    type="add"
                  />
                )}
                {functionsToModify.length > 0 && (
                  <ChangeList
                    icon={<RefreshCw className="w-4 h-4" />}
                    label="変更"
                    items={functionsToModify}
                    color="yellow"
                    type="modify"
                  />
                )}
              </>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">機能の変更なし</p>
            )
          )}
        </div>
      </div>

      {/* アクションボタン */}
      <div className="p-4 border-t border-cyan-500/30 bg-gray-900/50 flex gap-2">
        {onApprove && (
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                この方針で進める
              </>
            )}
          </button>
        )}

        {onRevise && (
          <button
            onClick={onRevise}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600/50"
          >
            <ArrowRight className="w-4 h-4" />
            修正したい
          </button>
        )}

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// アイテムから名前を取得
function getItemName(item: ChangeItemData): string {
  if (typeof item === 'string') return item;
  if ('name' in item) return item.name;
  if ('function_name' in item) return item.function_name;
  if ('target_name' in item) return item.target_name;
  if ('title' in item) return item.title;
  if ('target_title' in item) return item.target_title;
  return '不明';
}

// アイテムから理由を取得
function getItemReason(item: ChangeItemData): string | undefined {
  if (typeof item === 'string') return undefined;
  if ('reason' in item) return item.reason;
  return undefined;
}

// アイテムから説明を取得（追加・変更時）
function getItemDescription(item: ChangeItemData): string | undefined {
  if (typeof item === 'string') return undefined;
  if ('description' in item) return item.description;
  return undefined;
}

// 変更リストコンポーネント
function ChangeList({
  icon,
  label,
  items,
  color,
  type,
}: {
  icon: React.ReactNode;
  label: string;
  items: ChangeItemData[];
  color: 'red' | 'blue' | 'yellow';
  type: 'discard' | 'add' | 'modify';
}) {
  const colorClasses = {
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  };

  return (
    <div className={`rounded-lg p-3 border ${colorClasses[color]}`}>
      <div className={`flex items-center gap-2 mb-2 ${colorClasses[color].split(' ')[0]}`}>
        {icon}
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs opacity-70">({items.length}件)</span>
      </div>
      <ul className="space-y-1 pl-2">
        {items.map((item, index) => (
          <ChangeListItem
            key={index}
            item={item}
            color={color}
            type={type}
          />
        ))}
      </ul>
    </div>
  );
}

// 個別のアイテムコンポーネント（トグル付き）
function ChangeListItem({
  item,
  color,
  type,
}: {
  item: ChangeItemData;
  color: 'red' | 'blue' | 'yellow';
  type: 'discard' | 'add' | 'modify';
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const name = getItemName(item);
  const reason = getItemReason(item);
  const description = getItemDescription(item);

  const hasDetails = reason || description;

  const dotColor = {
    red: 'text-red-400/60',
    blue: 'text-blue-400/60',
    yellow: 'text-yellow-400/60',
  };

  const reasonBg = {
    red: 'bg-red-500/5 border-red-500/10',
    blue: 'bg-blue-500/5 border-blue-500/10',
    yellow: 'bg-yellow-500/5 border-yellow-500/10',
  };

  return (
    <li className="text-gray-300 text-sm">
      <div
        className={`flex items-start gap-2 ${hasDetails ? 'cursor-pointer hover:bg-gray-800/30 rounded px-1 -mx-1' : ''}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        {hasDetails ? (
          isExpanded ? (
            <ChevronDown className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dotColor[color]}`} />
          ) : (
            <ChevronRight className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dotColor[color]}`} />
          )
        ) : (
          <span className={`${dotColor[color]} mt-0.5`}>•</span>
        )}
        <span className="flex-1">{name}</span>
      </div>

      {/* 詳細情報（トグル表示） */}
      {isExpanded && hasDetails && (
        <div className={`ml-6 mt-1 mb-2 p-2 rounded border ${reasonBg[color]} text-xs space-y-1`}>
          {type === 'modify' && description && (
            <div>
              <span className="text-gray-500">変更後: </span>
              <span className="text-gray-300">{description}</span>
            </div>
          )}
          {type === 'add' && description && (
            <div>
              <span className="text-gray-500">説明: </span>
              <span className="text-gray-300">{description}</span>
            </div>
          )}
          {reason && (
            <div>
              <span className="text-gray-500">理由: </span>
              <span className="text-gray-300">{reason}</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default ChangeProposalCard;
