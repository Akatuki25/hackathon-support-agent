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

// Helper function to get priority badge classes
const getPriorityBadgeClass = (priority: string) => {
  switch (priority) {
    case 'Must':
      return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300";
    case 'Should':
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300";
    default:
      return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300";
  }
};

export default function EditableFunctionCard({
  functionId,
  functionCode,
  functionName,
  description,
  category,
  priority,
  extractionConfidence,
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
    <div className={`p-4 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-600 ${isDeleting ? 'opacity-50' : ''}`}>
      {/* ヘッダー（機能コードとアクションボタン） */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-mono px-2 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {functionCode}
        </span>

        <div className="flex gap-1">
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                disabled={isDeleting}
                className="p-1.5 rounded transition-colors hover:bg-gray-100 text-gray-600 hover:text-blue-600 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-blue-400"
                title="編集"
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 rounded transition-colors hover:bg-gray-100 text-gray-600 hover:text-red-600 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-red-400"
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
                className="p-1.5 rounded transition-colors hover:bg-gray-100 text-gray-600 hover:text-green-600 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-green-400"
                title="保存"
              >
                <Save size={16} />
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="p-1.5 rounded transition-colors hover:bg-gray-100 text-gray-600 hover:text-red-600 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-red-400"
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
        <h4 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">
          {functionName}
        </h4>
      ) : (
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          className="w-full px-3 py-2 rounded border mb-2 text-lg font-bold bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          placeholder="機能名"
        />
      )}

      {/* 説明 */}
      {!isEditing ? (
        <p className="text-sm mb-3 text-gray-700 dark:text-gray-300">
          {description}
        </p>
      ) : (
        <textarea
          value={editedDescription}
          onChange={(e) => setEditedDescription(e.target.value)}
          className="w-full px-3 py-2 rounded border mb-3 text-sm resize-y bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          rows={3}
          placeholder="機能説明"
        />
      )}

      {/* カテゴリと優先度 */}
      <div className="flex flex-wrap gap-2 text-sm">
        {!isEditing ? (
          <>
            <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              {CATEGORY_OPTIONS.find(c => c.value === category)?.label || category}
            </span>
            <span className={`px-2 py-1 rounded ${getPriorityBadgeClass(priority)}`}>
              {priority}
            </span>
          </>
        ) : (
          <>
            <select
              value={editedCategory}
              onChange={(e) => setEditedCategory(e.target.value)}
              className="px-2 py-1 rounded border bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={editedPriority}
              onChange={(e) => setEditedPriority(e.target.value)}
              className="px-2 py-1 rounded border bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              {PRIORITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </>
        )}

        {/* 信頼度表示（常に表示） */}
        <span className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          信頼度: {Math.round(extractionConfidence * 100)}%
        </span>
      </div>
    </div>
  );
}
