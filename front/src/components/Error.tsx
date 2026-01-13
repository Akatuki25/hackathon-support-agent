import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
}: {
  error: string;
}) {
  return (
    <div
      className="min-h-screen font-mono transition-all duration-500 flex items-center justify-center bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
    >
      <div
        className="p-6 rounded-lg max-w-md bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
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
