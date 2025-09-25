"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Lightbulb,
  Clock,
  Search,
} from "lucide-react";
import { ProjectType } from "@/types/modelTypes";
import { getAllProjects } from "@/libs/modelAPI/project";
import { useDarkMode } from "@/hooks/useDarkMode";

export default function AllProjectPage() {
  const router = useRouter();
  const { darkMode } = useDarkMode();
  const [allprojects, setAllProjects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<ProjectType[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // プロジェクト一覧を取得するAPIを呼び出す
      const fetchProjects = async () => {
        try {
          setLoading(true);
          const allProjects = await getAllProjects();
          setAllProjects(allProjects);
          setFilteredProjects(allProjects);
        } catch (error) {
          console.error("プロジェクトの取得エラー:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchProjects();
    }
  }, []);

  // 検索フィルタリング
  useEffect(() => {
    const filtered = allprojects.filter(
      (project) =>
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.idea.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredProjects(filtered);
  }, [searchTerm, allprojects]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "未設定";
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const calculateDuration = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getProjectStatus = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return "未設定";
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return "準備中";
    if (now > end) return "完了";
    return "進行中";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "進行中":
        return darkMode
          ? "text-green-400 border-green-400/50"
          : "text-green-600 border-green-500/50";
      case "完了":
        return darkMode
          ? "text-blue-400 border-blue-400/50"
          : "text-blue-600 border-blue-500/50";
      case "準備中":
        return darkMode
          ? "text-yellow-400 border-yellow-400/50"
          : "text-yellow-600 border-yellow-500/50";
      default:
        return darkMode
          ? "text-gray-400 border-gray-400/50"
          : "text-gray-600 border-gray-500/50";
    }
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          darkMode
            ? "bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900"
            : "bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50"
        }`}
      >
        <div
          className={`relative px-8 py-6 rounded-lg backdrop-blur-sm border ${
            darkMode
              ? "bg-gray-900/50 border-cyan-500/30 text-cyan-400"
              : "bg-white/50 border-purple-300/30 text-purple-600"
          } shadow-lg overflow-hidden`}
        >
          {/* Scanning line effect */}
          <div
            className={`absolute inset-0 ${
              darkMode
                ? "bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"
                : "bg-gradient-to-r from-transparent via-purple-400/10 to-transparent"
            } translate-x-[-100%] animate-pulse`}
          ></div>
          <div className="flex items-center space-x-4 relative">
            <div
              className={`animate-spin rounded-full h-6 w-6 border-2 ${
                darkMode
                  ? "border-cyan-400 border-t-transparent"
                  : "border-purple-600 border-t-transparent"
              }`}
            ></div>
            <span className="text-lg font-mono font-bold tracking-wider">
              LOADING_PROJECTS...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen p-6 ${
        darkMode
          ? "bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900"
          : "bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50"
      }`}
    >
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div
            className={`inline-block px-4 py-2 rounded-lg font-mono text-sm mb-6 ${
              darkMode
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "bg-purple-500/10 text-purple-600 border border-purple-300/30"
            }`}
          >
          {/* PROJECT_DATABASE_ACCESS */}
          </div>

          <h1
            className={`text-4xl md:text-5xl font-bold font-mono tracking-wider mb-4 ${
              darkMode
                ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400"
                : "text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600"
            }`}
          >
            ALL_PROJECTS_OVERVIEW
          </h1>

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

        {/* Controls */}
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
              placeholder="プロジェクトを検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-12 pr-4 py-3 rounded-lg font-mono text-sm backdrop-blur-sm border transition-all duration-300 ${
                darkMode
                  ? "bg-gray-900/50 border-cyan-500/30 text-white placeholder-gray-400 focus:border-cyan-400/50"
                  : "bg-white/50 border-purple-300/30 text-gray-900 placeholder-gray-500 focus:border-purple-400/50"
              } shadow-lg focus:shadow-xl outline-none`}
            />
          </div>

          {/* Stats */}
          <div className="flex items-center space-x-4">
            <div
              className={`px-4 py-3 rounded-lg backdrop-blur-sm border ${
                darkMode
                  ? "bg-gray-900/50 border-cyan-500/30"
                  : "bg-white/50 border-purple-300/30"
              }`}
            >
              <span
                className={`text-sm font-mono ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                総数:
              </span>
              <span
                className={`ml-2 font-bold font-mono ${
                  darkMode ? "text-cyan-400" : "text-purple-600"
                }`}
              >
                {allprojects.length}
              </span>
            </div>
            <div
              className={`px-4 py-3 rounded-lg backdrop-blur-sm border ${
                darkMode
                  ? "bg-gray-900/50 border-cyan-500/30"
                  : "bg-white/50 border-purple-300/30"
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
                {filteredProjects.length}
              </span>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div
            className={`text-center p-12 rounded-lg backdrop-blur-sm border ${
              darkMode
                ? "bg-gray-900/50 border-cyan-500/30"
                : "bg-white/50 border-purple-300/30"
            }`}
          >
            <div
              className={`w-20 h-20 mx-auto mb-6 rounded-full border-2 flex items-center justify-center ${
                darkMode
                  ? "border-cyan-500/50 text-cyan-400"
                  : "border-purple-500/50 text-purple-600"
              }`}
            >
              <Lightbulb className="w-10 h-10" />
            </div>
            <h3
              className={`text-2xl font-mono font-bold mb-3 ${
                darkMode ? "text-white" : "text-gray-900"
              }`}
            >
              {searchTerm ? "NO_SEARCH_RESULTS" : "NO_PROJECTS_FOUND"}
            </h3>
            <p
              className={`${darkMode ? "text-gray-400" : "text-gray-500"} font-mono`}
            >
              {searchTerm
                ? `// "${searchTerm}" に一致するプロジェクトが見つかりません`
                : "// まだプロジェクトが登録されていません"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project, index) => {
              const status = getProjectStatus(
                project.start_date,
                project.end_date,
              );
              const statusColor = getStatusColor(status);

              return (
                <div
                  key={index}
                  className={`relative p-6 rounded-lg backdrop-blur-sm border transition-all duration-300 hover:scale-105 group overflow-hidden ${
                    darkMode
                      ? "bg-gray-900/50 border-cyan-500/30 hover:border-cyan-400/50"
                      : "bg-white/50 border-purple-300/30 hover:border-purple-400/50"
                  } shadow-lg hover:shadow-xl cursor-pointer`}
                  onClick={() => router.push(`/projects/${index}`)}
                >
                  {/* Cyber scan line */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-px ${
                      darkMode
                        ? "bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
                        : "bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
                    } translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000`}
                  ></div>

                  {/* Project Number & Status */}
                  <div className="absolute top-4 right-4 flex items-center space-x-2">
                    <div
                      className={`px-2 py-1 rounded text-xs font-mono font-bold border ${statusColor}`}
                    >
                      {status}
                    </div>
                    <div
                      className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-mono font-bold ${
                        darkMode
                          ? "border-cyan-500/50 text-cyan-400 bg-gray-900/50"
                          : "border-purple-500/50 text-purple-600 bg-white/50"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </div>
                  </div>

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
                    {/* Title */}
                    <h2
                      className={`text-xl font-bold mb-4 font-mono tracking-wider line-clamp-2 pr-20 ${
                        darkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {project.title || "UNTITLED_PROJECT"}
                    </h2>

                    {/* Idea */}
                    <div className="mb-6">
                      <div className="flex items-center mb-2">
                        <Lightbulb
                          className={`w-4 h-4 mr-2 ${
                            darkMode ? "text-cyan-400" : "text-purple-600"
                          }`}
                        />
                        <span
                          className={`text-xs font-mono font-bold ${
                            darkMode ? "text-cyan-400" : "text-purple-600"
                          }`}
                        >
                          {/* PROJECT_CONCEPT */}
                        </span>
                      </div>
                      <p
                        className={`text-sm leading-relaxed line-clamp-3 ${
                          darkMode ? "text-gray-300" : "text-gray-600"
                        }`}
                      >
                        {project.idea || "アイデアが設定されていません"}
                      </p>
                    </div>

                    {/* Project Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Duration */}
                      <div
                        className={`p-3 rounded border ${
                          darkMode
                            ? "bg-gray-800/50 border-gray-600/50"
                            : "bg-gray-50/50 border-gray-300/50"
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <Clock
                            className={`w-3 h-3 mr-1 ${
                              darkMode ? "text-gray-400" : "text-gray-500"
                            }`}
                          />
                          <span
                            className={`text-xs font-mono ${
                              darkMode ? "text-gray-400" : "text-gray-500"
                            }`}
                          >
                            期間
                          </span>
                        </div>
                        <span
                          className={`text-sm font-mono font-bold ${
                            darkMode ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {calculateDuration(
                            project.start_date?.toString?.() ?? "",
                            project.end_date?.toString?.() ?? "",
                          )}
                          日間
                        </span>
                      </div>

                      {/* Team Size */}
                      <div
                        className={`p-3 rounded border ${
                          darkMode
                            ? "bg-gray-800/50 border-gray-600/50"
                            : "bg-gray-50/50 border-gray-300/50"
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <Users
                            className={`w-3 h-3 mr-1 ${
                              darkMode ? "text-gray-400" : "text-gray-500"
                            }`}
                          />
                          <span
                            className={`text-xs font-mono ${
                              darkMode ? "text-gray-400" : "text-gray-500"
                            }`}
                          >
                            チーム
                          </span>
                        </div>
                        <span
                          className={`text-sm font-mono font-bold ${
                            darkMode ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {project.num_people || 0}人
                        </span>
                      </div>
                    </div>

                    {/* Dates */}
                    <div
                      className={`mt-4 p-3 rounded border ${
                        darkMode
                          ? "bg-gray-800/30 border-gray-600/30"
                          : "bg-gray-50/30 border-gray-300/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-mono ${
                            darkMode ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          開始日
                        </span>
                        <span
                          className={`text-xs font-mono ${
                            darkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          {formatDate(project.start_date?.toString?.() ?? "")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-mono ${
                            darkMode ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          終了日
                        </span>
                        <span
                          className={`text-xs font-mono ${
                            darkMode ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          {formatDate(project.end_date?.toString?.() ?? "")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
