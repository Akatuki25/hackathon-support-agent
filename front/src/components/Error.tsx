import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  darkMode,
}: {
  error: string;
  darkMode: boolean;
}) {
  return (
    <div
      className={`min-h-screen font-mono transition-all duration-500 flex items-center justify-center ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"
      }`}
    >
      <div
        className={`p-6 rounded-lg max-w-md ${
          darkMode
            ? "bg-red-900/30 border border-red-700 text-red-300"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}
      >
        <div className="flex items-center mb-2">
          <AlertTriangle className="mr-2" size={20} />
          <h3 className="font-bold">エラーが発生しました</h3>
        </div>
        <p>{error}</p>
      </div>
    </div>
  );
}
