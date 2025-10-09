"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  Clock,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import { ProjectType } from "@/types/modelTypes";
import { getAllProjects, deleteProject } from "@/libs/modelAPI/project";
import { useDarkMode } from "@/hooks/useDarkMode";
import Header from "@/components/Session/Header";

export default function AllProjectPage() {
  const router = useRouter();
  const { darkMode } = useDarkMode();
  const [allprojects, setAllProjects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<ProjectType[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; title: string } | null>(null);
  const [confirmationText, setConfirmationText] = useState("");

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

  const calculateRemainingDays = (endDate: string) => {
    if (!endDate) return 0;
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
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

  const handleDeleteClick = (e: React.MouseEvent, projectId: string, projectTitle: string) => {
    e.stopPropagation();
    setProjectToDelete({ id: projectId, title: projectTitle });
    setDeleteModalOpen(true);
    setConfirmationText("");
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete || confirmationText !== projectToDelete.title) {
      return;
    }

    try {
      await deleteProject(projectToDelete.id);
      // プロジェクト一覧を再取得
      const updatedProjects = await getAllProjects();
      setAllProjects(updatedProjects);
      setFilteredProjects(updatedProjects);
      setDeleteModalOpen(false);
      setProjectToDelete(null);
      setConfirmationText("");
    } catch (error) {
      console.error("プロジェクトの削除エラー:", error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setProjectToDelete(null);
    setConfirmationText("");
  };

  if (loading) {
    return (
      <>
        <Header />
        <div
          className={`min-h-screen flex items-center justify-center ${
            darkMode
              ? "bg-gradient-to-br from-gray-900 via-black to-gray-900"
              : "bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200"
          }`}
        >
          <div
            className={`relative px-8 py-6 rounded-lg backdrop-blur-xl border ${
              darkMode
                ? "bg-gray-800/30 border-cyan-500/40 text-cyan-400 shadow-cyan-500/30"
                : "bg-white/60 border-purple-300/30 text-purple-600"
            } shadow-2xl overflow-hidden`}
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
      </>
    );
  }

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
          {/* Header */}
          <div className="text-center mb-12">
            <div
              className={`inline-block px-4 py-2 rounded-lg font-mono text-sm mb-6 backdrop-blur-md ${
                darkMode
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-300/30"
              }`}
            >
              // PROJECT_DATABASE_ACCESS
            </div>

            <h1
              className={`text-4xl md:text-5xl font-bold font-mono tracking-wider mb-4 ${
                darkMode
                  ? "text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]"
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
                className={`w-full pl-12 pr-4 py-3 rounded-lg font-mono text-sm backdrop-blur-xl border transition-all duration-300 ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 text-white placeholder-gray-400 focus:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                    : "bg-white/60 border-purple-300/30 text-gray-900 placeholder-gray-500 focus:border-purple-400/50"
                } shadow-lg focus:shadow-xl outline-none`}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-4">
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
                  {filteredProjects.length}
                </span>
              </div>
            </div>
          </div>

          {/* Projects Grid */}
          {filteredProjects.length === 0 ? (
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
              {/* Create New Project Card */}
              <div
                onClick={() => router.push("/hackSetUp")}
                className={`relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden cursor-pointer ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                    : "bg-white/60 border-purple-300/30 hover:border-purple-400/50"
                } shadow-lg hover:shadow-2xl flex items-center justify-center min-h-[320px]`}
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

                <div className="text-center">
                  <div
                    className={`w-20 h-20 mx-auto mb-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      darkMode
                        ? "border-cyan-500/50 text-cyan-400 group-hover:border-cyan-400 group-hover:text-cyan-300"
                        : "border-purple-500/50 text-purple-600 group-hover:border-purple-600 group-hover:text-purple-700"
                    }`}
                  >
                    <Plus className="w-10 h-10" />
                  </div>
                  <h3
                    className={`text-xl font-mono font-bold ${
                      darkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    新規プロジェクト作成
                  </h3>
                  <p
                    className={`mt-2 text-sm font-mono ${
                      darkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    // CREATE_NEW_PROJECT
                  </p>
                </div>
              </div>

              {/* Existing Projects */}
              {filteredProjects.map((project, index) => {
                const status = getProjectStatus(
                  project.start_date,
                  project.end_date,
                );
                const statusColor = getStatusColor(status);

                return (
                  <div
                    key={index}
                    className={`relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden ${
                      status === "完了"
                        ? darkMode
                          ? "bg-gray-800/20 border-gray-600/20 opacity-60 shadow-lg shadow-gray-500/10"
                          : "bg-white/40 border-gray-300/20 opacity-60"
                        : status === "進行中"
                        ? darkMode
                          ? "bg-blue-900/30 border-blue-500/40 hover:border-blue-400/60 shadow-lg shadow-blue-500/30"
                          : "bg-blue-100/60 border-blue-400/40 hover:border-blue-500/60"
                        : darkMode
                        ? "bg-gray-800/30 border-cyan-500/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                        : "bg-white/60 border-purple-300/30 hover:border-purple-400/50"
                    } shadow-lg hover:shadow-2xl cursor-pointer`}
                    onClick={() => router.push(`/projects/${project.project_id}`)}
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
                        className={`px-2 py-1 rounded text-xs font-mono font-bold border backdrop-blur-md ${statusColor}`}
                      >
                        {status}
                      </div>
                      <div
                        className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-mono font-bold backdrop-blur-md ${
                          darkMode
                            ? "border-cyan-500/50 text-cyan-400 bg-gray-800/50"
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
                            // PROJECT_CONCEPT
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
                        {/* Remaining Days */}
                        <div
                          className={`p-3 rounded border backdrop-blur-md ${
                            darkMode
                              ? "bg-gray-800/40 border-gray-600/50"
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
                              {status === "完了" ? "終了" : status === "進行中" ? "残り日数" : "開始まで"}
                            </span>
                          </div>
                          <span
                            className={`text-sm font-mono font-bold ${
                              status === "完了"
                                ? darkMode ? "text-gray-500" : "text-gray-600"
                                : status === "進行中"
                                ? darkMode ? "text-blue-400" : "text-blue-600"
                                : darkMode ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {status === "完了"
                              ? "完了済み"
                              : status === "進行中"
                              ? `${calculateRemainingDays(project.end_date?.toString?.() ?? "")}日`
                              : `${Math.ceil((new Date(project.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}日`
                            }
                          </span>
                        </div>
                      </div>

                      {/* Dates */}
                      <div
                        className={`mt-4 p-3 rounded border backdrop-blur-md ${
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

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteClick(e, String(project.project_id), project.title)}
                        className={`mt-3 w-full py-2 px-3 rounded border backdrop-blur-md transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 ${
                          darkMode
                            ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-400"
                            : "bg-red-50 border-red-500/50 text-red-600 hover:bg-red-100 hover:border-red-600"
                        }`}
                        title="プロジェクトを削除"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-xs font-mono">削除</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`relative max-w-md w-full rounded-lg backdrop-blur-xl border shadow-2xl p-6 ${
              darkMode
                ? "bg-gray-800/90 border-red-500/50 shadow-red-500/30"
                : "bg-white/90 border-red-500/50 shadow-red-300/30"
            }`}
          >
            {/* Cyber corners */}
            <div
              className={`absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 ${
                darkMode ? "border-red-400/50" : "border-red-500/50"
              }`}
            ></div>
            <div
              className={`absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 ${
                darkMode ? "border-red-400/50" : "border-red-500/50"
              }`}
            ></div>

            {/* Warning Icon */}
            <div className="flex items-center justify-center mb-4">
              <div
                className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                  darkMode
                    ? "border-red-500/50 text-red-400 bg-red-500/10"
                    : "border-red-500/50 text-red-600 bg-red-50"
                }`}
              >
                <Trash2 className="w-8 h-8" />
              </div>
            </div>

            {/* Title */}
            <h2
              className={`text-xl font-bold font-mono text-center mb-2 ${
                darkMode ? "text-white" : "text-gray-900"
              }`}
            >
              PROJECT_DELETE_CONFIRMATION
            </h2>

            {/* Warning Message */}
            <p
              className={`text-center mb-4 ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              本当にプロジェクト「
              <span className={`font-bold ${darkMode ? "text-red-400" : "text-red-600"}`}>
                {projectToDelete.title}
              </span>
              」を削除しますか？
            </p>

            <p
              className={`text-sm text-center mb-6 ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              この操作は取り消せません。削除するには、プロジェクト名を入力してください。
            </p>

            {/* Confirmation Input */}
            <div className="mb-6">
              <label
                className={`block text-sm font-mono mb-2 ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                プロジェクト名を入力:
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder={projectToDelete.title}
                className={`w-full p-3 rounded border-l-4 focus:outline-none transition-all ${
                  darkMode
                    ? "bg-gray-700 text-gray-100 border-red-500 focus:ring-1 focus:ring-red-400 placeholder-gray-500"
                    : "bg-white text-gray-800 border-red-500 focus:ring-1 focus:ring-red-400 placeholder-gray-400"
                }`}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteCancel}
                className={`flex-1 py-3 px-4 rounded font-bold transition-all ${
                  darkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={confirmationText !== projectToDelete.title}
                className={`flex-1 py-3 px-4 rounded font-bold transition-all ${
                  confirmationText === projectToDelete.title
                    ? darkMode
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-gray-400 text-gray-600 cursor-not-allowed"
                }`}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
