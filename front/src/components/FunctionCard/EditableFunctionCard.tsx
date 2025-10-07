"use client";

import { useState } from "react";
import { Edit3, Save, X, Trash2 } from "lucide-react";

interface EditableFunctionCardProps {
  functionId: string;
  functionCode: string;
  functionName: string;
  description: string;
  category: string;
  priority: string;
  extractionConfidence: number;
  darkMode: boolean;
  onUpdate: (functionId: string, updates: {
    function_name?: string;
    description?: string;
    category?: string;
    priority?: string;
  }) => Promise<void>;
  onDelete: (functionId: string) => Promise<void>;
}

const CATEGORY_OPTIONS = [
  { value: 'auth', label: '認証・権限' },
  { value: 'data', label: 'データ管理' },
  { value: 'logic', label: 'ビジネスロジック' },
  { value: 'ui', label: 'UI・画面' },
  { value: 'api', label: 'API・通信' },
  { value: 'deployment', label: 'デプロイ・インフラ' },
];

const PRIORITY_OPTIONS = [
  { value: 'Must', label: 'Must (必須)' },
  { value: 'Should', label: 'Should (重要)' },
  { value: 'Could', label: 'Could (できれば)' },
  { value: 'Wont', label: 'Wont (不要)' },
];

export default function EditableFunctionCard({
  functionId,
  functionCode,
  functionName,
  description,
  category,
  priority,
  extractionConfidence,
  darkMode,
  onUpdate,
  onDelete,
}: EditableFunctionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(functionName);
  const [editedDescription, setEditedDescription] = useState(description);
  const [editedCategory, setEditedCategory] = useState(category);
  const [editedPriority, setEditedPriority] = useState(priority);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onUpdate(functionId, {
        function_name: editedName !== functionName ? editedName : undefined,
        description: editedDescription !== description ? editedDescription : undefined,
        category: editedCategory !== category ? editedCategory : undefined,
        priority: editedPriority !== priority ? editedPriority : undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update function:', error);
      alert('更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedName(functionName);
    setEditedDescription(description);
    setEditedCategory(category);
    setEditedPriority(priority);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`機能「${functionName}」を削除しますか？`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(functionId);
    } catch (error) {
      console.error('Failed to delete function:', error);
      alert('削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${
      darkMode 
        ? "bg-gray-800 border-gray-600" 
        : "bg-white border-gray-200"
    } ${isDeleting ? 'opacity-50' : ''}`}>
      {/* ヘッダー（機能コードとアクションボタン） */}
      <div className="flex items-start justify-between mb-2">
        <span className={`text-xs font-mono px-2 py-1 rounded ${
          darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
        }`}>
          {functionCode}
        </span>
        
        <div className="flex gap-1">
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                disabled={isDeleting}
                className={`p-1.5 rounded transition-colors ${
                  darkMode 
                    ? "hover:bg-gray-700 text-gray-400 hover:text-blue-400" 
                    : "hover:bg-gray-100 text-gray-600 hover:text-blue-600"
                }`}
                title="編集"
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={`p-1.5 rounded transition-colors ${
                  darkMode 
                    ? "hover:bg-gray-700 text-gray-400 hover:text-red-400" 
                    : "hover:bg-gray-100 text-gray-600 hover:text-red-600"
                }`}
                title="削除"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`p-1.5 rounded transition-colors ${
                  darkMode 
                    ? "hover:bg-gray-700 text-gray-400 hover:text-green-400" 
                    : "hover:bg-gray-100 text-gray-600 hover:text-green-600"
                }`}
                title="保存"
              >
                <Save size={16} />
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className={`p-1.5 rounded transition-colors ${
                  darkMode 
                    ? "hover:bg-gray-700 text-gray-400 hover:text-red-400" 
                    : "hover:bg-gray-100 text-gray-600 hover:text-red-600"
                }`}
                title="キャンセル"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 機能名 */}
      {!isEditing ? (
        <h4 className={`text-lg font-bold mb-2 ${
          darkMode ? "text-gray-100" : "text-gray-900"
        }`}>
          {functionName}
        </h4>
      ) : (
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          className={`w-full px-3 py-2 rounded border mb-2 text-lg font-bold ${
            darkMode 
              ? "bg-gray-700 border-gray-600 text-gray-100" 
              : "bg-white border-gray-300 text-gray-900"
          }`}
          placeholder="機能名"
        />
      )}

      {/* 説明 */}
      {!isEditing ? (
        <p className={`text-sm mb-3 ${
          darkMode ? "text-gray-300" : "text-gray-700"
        }`}>
          {description}
        </p>
      ) : (
        <textarea
          value={editedDescription}
          onChange={(e) => setEditedDescription(e.target.value)}
          className={`w-full px-3 py-2 rounded border mb-3 text-sm resize-y ${
            darkMode 
              ? "bg-gray-700 border-gray-600 text-gray-300" 
              : "bg-white border-gray-300 text-gray-700"
          }`}
          rows={3}
          placeholder="機能説明"
        />
      )}

      {/* カテゴリと優先度 */}
      <div className="flex flex-wrap gap-2 text-sm">
        {!isEditing ? (
          <>
            <span className={`px-2 py-1 rounded ${
              darkMode ? "bg-blue-900/20 text-blue-300" : "bg-blue-100 text-blue-700"
            }`}>
              {CATEGORY_OPTIONS.find(c => c.value === category)?.label || category}
            </span>
            <span className={`px-2 py-1 rounded ${
              priority === 'Must' 
                ? darkMode ? "bg-red-900/20 text-red-300" : "bg-red-100 text-red-700"
                : priority === 'Should'
                ? darkMode ? "bg-yellow-900/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"
                : darkMode ? "bg-green-900/20 text-green-300" : "bg-green-100 text-green-700"
            }`}>
              {priority}
            </span>
          </>
        ) : (
          <>
            <select
              value={editedCategory}
              onChange={(e) => setEditedCategory(e.target.value)}
              className={`px-2 py-1 rounded border ${
                darkMode 
                  ? "bg-gray-700 border-gray-600 text-gray-300" 
                  : "bg-white border-gray-300 text-gray-700"
              }`}
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={editedPriority}
              onChange={(e) => setEditedPriority(e.target.value)}
              className={`px-2 py-1 rounded border ${
                darkMode 
                  ? "bg-gray-700 border-gray-600 text-gray-300" 
                  : "bg-white border-gray-300 text-gray-700"
              }`}
            >
              {PRIORITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </>
        )}
        
        {/* 信頼度表示（常に表示） */}
        <span className={`px-2 py-1 rounded text-xs ${
          darkMode ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-600"
        }`}>
          信頼度: {Math.round(extractionConfidence * 100)}%
        </span>
      </div>
    </div>
  );
}

