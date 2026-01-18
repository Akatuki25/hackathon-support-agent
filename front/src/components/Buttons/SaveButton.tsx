import React from "react";
import { Save, ChevronRight } from "lucide-react";

export default function SaveButton({
  handleSave,
  title,
}: {
  handleSave: () => void;
  title: string;
}) {
  return (
    <button
      onClick={handleSave}
      className="px-8 py-3 flex items-center justify-center rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400 dark:bg-cyan-500 dark:hover:bg-cyan-600 dark:text-gray-900 dark:focus:ring-2 dark:focus:ring-cyan-400 dark:from-cyan-500 dark:to-cyan-500"
      aria-label="仕様書を保存して次へ進む"
    >
      <Save size={20} className="mr-2" />
      <span>{title}</span>
      <ChevronRight size={20} className="ml-2" />
    </button>
  );
}
