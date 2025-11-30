"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Wrench, Search, Clock, ArrowLeft } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import Header from "@/components/Session/Header";
import { tools, categories, Tool, Category } from "./toolsData";

export default function ToolsPage() {
  const router = useRouter();
  const { darkMode } = useDarkMode();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const handleGoBack = () => {
    router.back();
  };

  const filteredTools = tools.filter((tool) => {
    const matchesCategory =
      selectedCategory === "all" || tool.category === selectedCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      <div
        className={`min-h-screen pt-24 p-6 ${
          darkMode
            ? "bg-gradient-to-br from-gray-900 via-black to-gray-900"
            : "bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200"
        }`}
      >
        <div className="container mx-auto max-w-7xl">
          {/* Back Button */}
          <button
            onClick={handleGoBack}
            className={`mb-6 flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all duration-300 border ${
              darkMode
                ? "bg-gray-800/30 border-cyan-500/30 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10"
                : "bg-white/60 border-purple-300/30 text-purple-600 hover:border-purple-400 hover:bg-purple-500/10"
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>戻る</span>
          </button>

          {/* Header */}
          <div className="text-center mb-12">
            <div
              className={`inline-block px-4 py-2 rounded-lg font-mono text-sm mb-6 backdrop-blur-md ${
                darkMode
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-300/30"
              }`}
            >
              HACKATHON_TOOLS_DIRECTORY
            </div>

            <h1
              className={`text-4xl md:text-5xl font-bold font-mono tracking-wider mb-4 ${
                darkMode
                  ? "text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                  : "text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600"
              }`}
            >
              EXTERNAL_TOOLS
            </h1>

            <p
              className={`text-lg mb-6 ${
                darkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              ハッカソンの開発を加速させる便利な外部ツール集
            </p>

            <div className="flex items-center justify-center mb-8">
              <div
                className={`h-px w-16 ${darkMode ? "bg-cyan-500" : "bg-purple-500"}`}
              ></div>
              <div
                className={`mx-4 w-2 h-2 border ${darkMode ? "border-cyan-500" : "border-purple-500"} rotate-45`}
              ></div>
              <div
                className={`h-px w-16 ${darkMode ? "bg-pink-500" : "bg-blue-500"}`}
              ></div>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            {/* Search */}
            <div className="flex-1 relative">
              <Search
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  darkMode ? "text-cyan-400" : "text-purple-600"
                }`}
              />
              <input
                type="text"
                placeholder="ツールを検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-12 pr-4 py-3 rounded-lg font-mono text-sm backdrop-blur-xl border transition-all duration-300 ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 text-white placeholder-gray-400 focus:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                    : "bg-white/60 border-purple-300/30 text-gray-900 placeholder-gray-500 focus:border-purple-400/50"
                } shadow-lg focus:shadow-xl outline-none`}
              />
            </div>

            {/* Stats */}
            <div
              className={`px-4 py-3 rounded-lg backdrop-blur-xl border ${
                darkMode
                  ? "bg-gray-800/30 border-cyan-500/30 shadow-lg shadow-cyan-500/20"
                  : "bg-white/60 border-purple-300/30"
              }`}
            >
              <span
                className={`text-sm font-mono ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                表示:
              </span>
              <span
                className={`ml-2 font-bold font-mono ${
                  darkMode ? "text-cyan-400" : "text-purple-600"
                }`}
              >
                {filteredTools.length}
              </span>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((category: Category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-mono text-sm transition-all duration-300 border ${
                  selectedCategory === category.id
                    ? darkMode
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-lg shadow-cyan-500/30"
                      : "bg-purple-500/20 border-purple-500 text-purple-600"
                    : darkMode
                      ? "bg-gray-800/30 border-gray-600/50 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400"
                      : "bg-white/60 border-gray-300/50 text-gray-600 hover:border-purple-400/50 hover:text-purple-600"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Tools Grid */}
          {filteredTools.length === 0 ? (
            <div
              className={`text-center p-12 rounded-lg backdrop-blur-xl border ${
                darkMode
                  ? "bg-gray-800/30 border-cyan-500/30 shadow-lg shadow-cyan-500/20"
                  : "bg-white/60 border-purple-300/30"
              }`}
            >
              <div
                className={`w-20 h-20 mx-auto mb-6 rounded-full border-2 flex items-center justify-center ${
                  darkMode
                    ? "border-cyan-500/50 text-cyan-400"
                    : "border-purple-500/50 text-purple-600"
                }`}
              >
                <Wrench className="w-10 h-10" />
              </div>
              <h3
                className={`text-2xl font-mono font-bold mb-3 ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}
              >
                NO_TOOLS_FOUND
              </h3>
              <p
                className={`${darkMode ? "text-gray-400" : "text-gray-500"} font-mono`}
              >
                検索条件に一致するツールが見つかりません
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTools.map((tool: Tool) => (
                <a
                  key={tool.id}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden ${
                    darkMode
                      ? "bg-gray-800/30 border-cyan-500/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                      : "bg-white/60 border-purple-300/30 hover:border-purple-400/50"
                  } shadow-lg hover:shadow-2xl`}
                >
                  {/* Cyber scan line */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-px ${
                      darkMode
                        ? "bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
                        : "bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
                    } translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000`}
                  ></div>

                  {/* Cyber corners */}
                  <div
                    className={`absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 ${
                      darkMode ? "border-cyan-400/50" : "border-purple-400/50"
                    } opacity-0 group-hover:opacity-100 transition-opacity`}
                  ></div>
                  <div
                    className={`absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 ${
                      darkMode ? "border-pink-400/50" : "border-blue-400/50"
                    } opacity-0 group-hover:opacity-100 transition-opacity`}
                  ></div>

                  {/* Content */}
                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h3
                        className={`text-xl font-bold font-mono ${
                          darkMode ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {tool.name}
                      </h3>
                      <ExternalLink
                        className={`w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 ${
                          darkMode ? "text-cyan-400" : "text-purple-600"
                        }`}
                      />
                    </div>

                    {/* Description */}
                    <p
                      className={`text-sm leading-relaxed ${
                        darkMode ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      {tool.description}
                    </p>

                    {/* Phase Tag */}
                    <div
                      className={`mt-4 flex items-center gap-2 text-xs ${
                        darkMode ? "text-cyan-400" : "text-purple-600"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span className="font-mono">{tool.phase}</span>
                    </div>

                    {/* Category Tag */}
                    <div className="mt-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-mono ${
                          darkMode
                            ? "bg-gray-700/50 text-gray-400 border border-gray-600/50"
                            : "bg-gray-100 text-gray-600 border border-gray-300/50"
                        }`}
                      >
                        {categories.find((c) => c.id === tool.category)?.name ||
                          tool.category}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
