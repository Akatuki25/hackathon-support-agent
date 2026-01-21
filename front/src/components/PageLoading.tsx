import React from "react";

export default function PageLoading() {
  return (
    <div className="min-h-screen font-mono transition-all duration-500 flex items-center justify-center bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10 dark:opacity-20">
        {/* Light mode grid */}
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            backgroundImage: `linear-gradient(#8a2be2 1px, transparent 1px),
                              linear-gradient(90deg, #8a2be2 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            backgroundPosition: "-1px -1px",
          }}
        ></div>
        {/* Dark mode grid */}
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundImage: `linear-gradient(#00ffe1 1px, transparent 1px),
                              linear-gradient(90deg, #00ffe1 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            backgroundPosition: "-1px -1px",
          }}
        ></div>
      </div>

      {/* Glowing edges */}
      <div className="fixed bottom-0 left-0 right-0 h-1 z-20">
        <div className="h-full bg-purple-500 dark:bg-cyan-500 animate-pulse"></div>
      </div>
      <div className="fixed top-0 bottom-0 right-0 w-1 z-20">
        <div className="w-full bg-blue-500 dark:bg-pink-500 animate-pulse"></div>
      </div>
      <div className="flex flex-col justify-center items-center py-16">
        {/* サイバーパンク風ローディングアニメーション */}
        <div className="relative w-24 h-24">
          {/* 回転する外側リング */}
          <div className="absolute inset-0 border-4 border-transparent border-t-purple-600 border-r-blue-500 dark:border-t-cyan-500 dark:border-r-pink-400 rounded-full animate-spin"></div>

          {/* パルスする内側サークル */}
          <div className="absolute inset-3 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center">
            <div className="w-10 h-10 bg-purple-500/20 dark:bg-cyan-500/20 rounded-full animate-ping"></div>
          </div>

          {/* 文字 */}
          <div className="absolute inset-0 flex items-center justify-center text-xs text-purple-700 dark:text-cyan-400 font-bold">
            LOADING
          </div>
        </div>

        {/* ローディングテキスト */}
        <div className="mt-6 text-purple-700 dark:text-cyan-400 font-bold tracking-wider flex flex-col items-center">
          <p className="text-sm mb-2">情報分析中</p>
          <div className="flex space-x-1">
            <span className="inline-block w-2 h-2 bg-blue-500 dark:bg-pink-500 rounded-full animate-pulse"></span>
            <span
              className="inline-block w-2 h-2 bg-blue-500 dark:bg-pink-500 rounded-full animate-pulse"
              style={{ animationDelay: "0.2s" }}
            ></span>
            <span
              className="inline-block w-2 h-2 bg-blue-500 dark:bg-pink-500 rounded-full animate-pulse"
              style={{ animationDelay: "0.4s" }}
            ></span>
          </div>
        </div>
      </div>
    </div>
  );
}
