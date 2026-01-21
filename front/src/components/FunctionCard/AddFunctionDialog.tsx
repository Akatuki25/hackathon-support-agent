import { useState } from "react";
import { Plus, X } from "lucide-react";

interface AddFunctionDialogProps {
  projectId: string;
  onAdd: (data: {
    project_id: string;
    function_name: string;
    description: string;
    category: string;
    priority: string;
  }) => Promise<void>;
  onClose: () => void;
}

const CATEGORY_OPTIONS = [
  { value: "auth", label: "認証・権限" },
  { value: "data", label: "データ管理" },
  { value: "logic", label: "ビジネスロジック" },
  { value: "ui", label: "UI・画面" },
  { value: "api", label: "API・通信" },
  { value: "deployment", label: "デプロイ・インフラ" },
];

const PRIORITY_OPTIONS = [
  { value: "Must", label: "Must (必須)" },
  { value: "Should", label: "Should (重要)" },
  { value: "Could", label: "Could (できれば)" },
  { value: "Wont", label: "Wont (不要)" },
];

export default function AddFunctionDialog({
  projectId,
  onAdd,
  onClose,
}: AddFunctionDialogProps) {
  const [functionName, setFunctionName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("logic");
  const [priority, setPriority] = useState("Should");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!functionName.trim() || !description.trim()) {
      alert("機能名と説明を入力してください");
      return;
    }

    setIsSaving(true);
    try {
      await onAdd({
        project_id: projectId,
        function_name: functionName.trim(),
        description: description.trim(),
        category,
        priority,
      });
      onClose();
    } catch (error) {
      console.error("Failed to add function:", error);
      alert("追加に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl rounded-lg shadow-xl bg-white dark:bg-gray-800">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold flex items-center text-gray-900 dark:text-gray-100">
            <Plus size={24} className="mr-2" />
            新しい機能を追加
          </h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded transition-colors hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 機能名 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              機能名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value)}
              className="w-full px-3 py-2 rounded border bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              placeholder="例: ユーザー登録機能"
              required
            />
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              機能説明 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded border resize-y bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              rows={4}
              placeholder="例: ユーザーが新規アカウントを作成できる機能。メールアドレスとパスワードで登録する。"
              required
            />
          </div>

          {/* カテゴリと優先度 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                カテゴリ
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded border bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                優先度
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded border bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded transition-colors bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-4 py-2 rounded transition-colors bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700 ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isSaving ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
