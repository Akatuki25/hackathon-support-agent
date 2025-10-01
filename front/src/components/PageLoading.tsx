import React from "react";

import { useDarkMode } from "@/hooks/useDarkMode";

export default function PageLoading() {
  const { darkMode } = useDarkMode();
  return (
    <div
      className={`min-h-screen font-mono transition-all duration-500 flex items-center justify-center ${darkMode ? "bg-gray-900" : "bg-gray-100"} relative overflow-hidden`}
    >
      {/* Animated background grid */}
      <div
        className={`absolute inset-0 overflow-hidden pointer-events-none ${darkMode ? "opacity-20" : "opacity-10"}`}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${darkMode ? "#00ffe1" : "#8a2be2"} 1px, transparent 1px), 
                              linear-gradient(90deg, ${darkMode ? "#00ffe1" : "#8a2be2"} 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            backgroundPosition: "-1px -1px",
          }}
        ></div>
      </div>

      {/* Glowing edges */}
      <div className="fixed bottom-0 left-0 right-0 h-1 z-20">
        <div
          className={`h-full ${darkMode ? "bg-cyan-500" : "bg-purple-500"} animate-pulse`}
        ></div>
      </div>
      <div className="fixed top-0 bottom-0 right-0 w-1 z-20">
        <div
          className={`w-full ${darkMode ? "bg-pink-500" : "bg-blue-500"} animate-pulse`}
        ></div>
      </div>
      <div className="flex flex-col justify-center items-center py-16">
        {/* サイバーパンク風ローディングアニメーション */}
        <div className="relative w-24 h-24">
          {/* 回転する外側リング */}
          <div
            className={`absolute inset-0 border-4 border-transparent ${
              darkMode
                ? "border-t-cyan-500 border-r-pink-400"
                : "border-t-purple-600 border-r-blue-500"
            } rounded-full animate-spin`}
          ></div>

          {/* パルスする内側サークル */}
          <div
            className={`absolute inset-3 ${darkMode ? "bg-gray-900" : "bg-gray-100"} rounded-full flex items-center justify-center`}
          >
            <div
              className={`w-10 h-10 ${
                darkMode ? "bg-cyan-500/20" : "bg-purple-500/20"
              } rounded-full animate-ping`}
            ></div>
          </div>

          {/* 文字 */}
          <div
            className={`absolute inset-0 flex items-center justify-center text-xs ${
              darkMode ? "text-cyan-400" : "text-purple-700"
            } font-bold`}
          >
            LOADING
          </div>
        </div>

        {/* ローディングテキスト */}
        <div
          className={`mt-6 ${
            darkMode ? "text-cyan-400" : "text-purple-700"
          } font-bold tracking-wider flex flex-col items-center`}
        >
          <p className="text-sm mb-2">情報分析中</p>
          <div className="flex space-x-1">
            <span
              className={`inline-block w-2 h-2 ${
                darkMode ? "bg-pink-500" : "bg-blue-500"
              } rounded-full animate-pulse`}
            ></span>
            <span
              className={`inline-block w-2 h-2 ${
                darkMode ? "bg-pink-500" : "bg-blue-500"
              } rounded-full animate-pulse`}
              style={{ animationDelay: "0.2s" }}
            ></span>
            <span
              className={`inline-block w-2 h-2 ${
                darkMode ? "bg-pink-500" : "bg-blue-500"
              } rounded-full animate-pulse`}
              style={{ animationDelay: "0.4s" }}
            ></span>
          </div>
        </div>
      </div>
    </div>
  );
}
