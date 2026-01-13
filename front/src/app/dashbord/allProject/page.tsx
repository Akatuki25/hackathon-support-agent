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
import Header from "@/components/Session/Header";

export default function AllProjectPage() {
  const router = useRouter();
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
        return "text-green-600 border-green-500/50 dark:text-green-400 dark:border-green-400/50";
      case "完了":
        return "text-blue-600 border-blue-500/50 dark:text-blue-400 dark:border-blue-400/50";
      case "準備中":
        return "text-yellow-600 border-yellow-500/50 dark:text-yellow-400 dark:border-yellow-400/50";
      default:
        return "text-gray-600 border-gray-500/50 dark:text-gray-400 dark:border-gray-400/50";
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
          className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-black dark:to-gray-900"
        >
          <div
            className="relative px-8 py-6 rounded-lg backdrop-blur-xl border bg-white/60 border-purple-300/30 text-purple-600 dark:bg-gray-800/30 dark:border-cyan-500/40 dark:text-cyan-400 dark:shadow-cyan-500/30 shadow-2xl overflow-hidden"
          >
            {/* Scanning line effect */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/10 to-transparent dark:via-cyan-400/10 translate-x-[-100%] animate-pulse"
            ></div>
            <div className="flex items-center space-x-4 relative">
              <div
                className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent dark:border-cyan-400 dark:border-t-transparent"
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
        className="min-h-screen pt-24 p-6 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-black dark:to-gray-900"
      >
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div
              className="inline-block px-4 py-2 rounded-lg font-mono text-sm mb-6 backdrop-blur-md bg-purple-500/10 text-purple-600 border border-purple-300/30 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30"
            >
              {/* PROJECT_DATABASE_ACCESS */}
            </div>

            <h1
              className="text-4xl md:text-5xl font-bold font-mono tracking-wider mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:text-cyan-400 dark:drop-shadow-[0_0_20px_rgba(34,211,238,0.5)] dark:bg-none"
            >
              ALL_PROJECTS_OVERVIEW
            </h1>

            <div className="flex items-center justify-center mb-8">
              <div
                className="h-px w-16 bg-purple-500 dark:bg-cyan-500"
              ></div>
              <div
                className="mx-4 w-2 h-2 border border-purple-500 dark:border-cyan-500 rotate-45"
              ></div>
              <div
                className="h-px w-16 bg-blue-500 dark:bg-pink-500"
              ></div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            {/* Search */}
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-600 dark:text-cyan-400"
              />
              <input
                type="text"
                placeholder="プロジェクトを検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-lg font-mono text-sm backdrop-blur-xl border transition-all duration-300 bg-white/60 border-purple-300/30 text-gray-900 placeholder-gray-500 focus:border-purple-400/50 dark:bg-gray-800/30 dark:border-cyan-500/30 dark:text-white dark:placeholder-gray-400 dark:focus:border-cyan-400/50 dark:shadow-lg dark:shadow-cyan-500/20 shadow-lg focus:shadow-xl outline-none"
              />
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-4">
              <div
                className="px-4 py-3 rounded-lg backdrop-blur-xl border bg-white/60 border-purple-300/30 dark:bg-gray-800/30 dark:border-cyan-500/30 dark:shadow-lg dark:shadow-cyan-500/20"
              >
                <span
                  className="text-sm font-mono text-gray-500 dark:text-gray-400"
                >
                  総数:
                </span>
                <span
                  className="ml-2 font-bold font-mono text-purple-600 dark:text-cyan-400"
                >
                  {allprojects.length}
                </span>
              </div>
              <div
                className="px-4 py-3 rounded-lg backdrop-blur-xl border bg-white/60 border-purple-300/30 dark:bg-gray-800/30 dark:border-cyan-500/30 dark:shadow-lg dark:shadow-cyan-500/20"
              >
                <span
                  className="text-sm font-mono text-gray-500 dark:text-gray-400"
                >
                  表示:
                </span>
                <span
                  className="ml-2 font-bold font-mono text-purple-600 dark:text-cyan-400"
                >
                  {filteredProjects.length}
                </span>
              </div>
            </div>
          </div>

          {/* Projects Grid */}
          {filteredProjects.length === 0 ? (
            <div
              className="text-center p-12 rounded-lg backdrop-blur-xl border bg-white/60 border-purple-300/30 dark:bg-gray-800/30 dark:border-cyan-500/30 dark:shadow-lg dark:shadow-cyan-500/20"
            >
              <div
                className="w-20 h-20 mx-auto mb-6 rounded-full border-2 flex items-center justify-center border-purple-500/50 text-purple-600 dark:border-cyan-500/50 dark:text-cyan-400"
              >
                <Lightbulb className="w-10 h-10" />
              </div>
              <h3
                className="text-2xl font-mono font-bold mb-3 text-gray-900 dark:text-white"
              >
                {searchTerm ? "NO_SEARCH_RESULTS" : "NO_PROJECTS_FOUND"}
              </h3>
              <p
                className="text-gray-500 dark:text-gray-400 font-mono"
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
                className="relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden cursor-pointer bg-white/60 border-purple-300/30 hover:border-purple-400/50 dark:bg-gray-800/30 dark:border-cyan-500/30 dark:hover:border-cyan-400/50 dark:shadow-lg dark:shadow-cyan-500/20 shadow-lg hover:shadow-2xl flex items-center justify-center min-h-[320px]"
              >
                {/* Cyber scan line */}
                <div
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent dark:via-cyan-400/50 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"
                ></div>

                {/* Cyber corners */}
                <div
                  className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-purple-400/50 dark:border-cyan-400/50 opacity-0 group-hover:opacity-100 transition-opacity"
                ></div>
                <div
                  className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-blue-400/50 dark:border-pink-400/50 opacity-0 group-hover:opacity-100 transition-opacity"
                ></div>

                <div className="text-center">
                  <div
                    className="w-20 h-20 mx-auto mb-4 rounded-full border-2 flex items-center justify-center transition-all border-purple-500/50 text-purple-600 group-hover:border-purple-600 group-hover:text-purple-700 dark:border-cyan-500/50 dark:text-cyan-400 dark:group-hover:border-cyan-400 dark:group-hover:text-cyan-300"
                  >
                    <Plus className="w-10 h-10" />
                  </div>
                  <h3
                    className="text-xl font-mono font-bold text-gray-900 dark:text-white"
                  >
                    新規プロジェクト作成
                  </h3>
                  <p
                    className="mt-2 text-sm font-mono text-gray-500 dark:text-gray-400"
                  >
                    {/* CREATE_NEW_PROJECT */}
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
                    className={`relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden shadow-lg hover:shadow-2xl cursor-pointer ${
                      status === "完了"
                        ? "bg-white/40 border-gray-300/20 opacity-60 dark:bg-gray-800/20 dark:border-gray-600/20 dark:shadow-gray-500/10"
                        : status === "進行中"
                        ? "bg-blue-100/60 border-blue-400/40 hover:border-blue-500/60 dark:bg-blue-900/30 dark:border-blue-500/40 dark:hover:border-blue-400/60 dark:shadow-blue-500/30"
                        : "bg-white/60 border-purple-300/30 hover:border-purple-400/50 dark:bg-gray-800/30 dark:border-cyan-500/30 dark:hover:border-cyan-400/50 dark:shadow-cyan-500/20"
                    }`}
                    onClick={() => router.push(`/projects/${project.project_id}`)}
                  >
                    {/* Cyber scan line */}
                    <div
                      className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent dark:via-cyan-400/50 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"
                    ></div>

                    {/* Project Number & Status */}
                    <div className="absolute top-4 right-4 flex items-center space-x-2">
                      <div
                        className={`px-2 py-1 rounded text-xs font-mono font-bold border backdrop-blur-md ${statusColor}`}
                      >
                        {status}
                      </div>
                      <div
                        className="w-8 h-8 rounded border flex items-center justify-center text-xs font-mono font-bold backdrop-blur-md border-purple-500/50 text-purple-600 bg-white/50 dark:border-cyan-500/50 dark:text-cyan-400 dark:bg-gray-800/50"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </div>
                    </div>

                    {/* Cyber corners */}
                    <div
                      className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-purple-400/50 dark:border-cyan-400/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    ></div>
                    <div
                      className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-blue-400/50 dark:border-pink-400/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    ></div>

                    {/* Content */}
                    <div className="relative">
                      {/* Title */}
                      <h2
                        className="text-xl font-bold mb-4 font-mono tracking-wider line-clamp-2 pr-20 text-gray-900 dark:text-white"
                      >
                        {project.title || "UNTITLED_PROJECT"}
                      </h2>

                      {/* Idea */}
                      <div className="mb-6">
                        <div className="flex items-center mb-2">
                          <Lightbulb
                            className="w-4 h-4 mr-2 text-purple-600 dark:text-cyan-400"
                          />
                          <span
                            className="text-xs font-mono font-bold text-purple-600 dark:text-cyan-400"
                          >
                            {/* PROJECT_CONCEPT */}
                          </span>
                        </div>
                        <p
                          className="text-sm leading-relaxed line-clamp-3 text-gray-600 dark:text-gray-300"
                        >
                          {project.idea || "アイデアが設定されていません"}
                        </p>
                      </div>

                      {/* Project Info Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Remaining Days */}
                        <div
                          className="p-3 rounded border backdrop-blur-md bg-gray-50/50 border-gray-300/50 dark:bg-gray-800/40 dark:border-gray-600/50"
                        >
                          <div className="flex items-center mb-1">
                            <Clock
                              className="w-3 h-3 mr-1 text-gray-500 dark:text-gray-400"
                            />
                            <span
                              className="text-xs font-mono text-gray-500 dark:text-gray-400"
                            >
                              {status === "完了" ? "終了" : status === "進行中" ? "残り日数" : "開始まで"}
                            </span>
                          </div>
                          <span
                            className={`text-sm font-mono font-bold ${
                              status === "完了"
                                ? "text-gray-600 dark:text-gray-500"
                                : status === "進行中"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-900 dark:text-white"
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
                        className="mt-4 p-3 rounded border backdrop-blur-md bg-gray-50/30 border-gray-300/30 dark:bg-gray-800/30 dark:border-gray-600/30"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-xs font-mono text-gray-500 dark:text-gray-400"
                          >
                            開始日
                          </span>
                          <span
                            className="text-xs font-mono text-gray-600 dark:text-gray-300"
                          >
                            {formatDate(project.start_date?.toString?.() ?? "")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs font-mono text-gray-500 dark:text-gray-400"
                          >
                            終了日
                          </span>
                          <span
                            className="text-xs font-mono text-gray-600 dark:text-gray-300"
                          >
                            {formatDate(project.end_date?.toString?.() ?? "")}
                          </span>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteClick(e, String(project.project_id), project.title)}
                        className="mt-3 w-full py-2 px-3 rounded border backdrop-blur-md transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 bg-red-50 border-red-500/50 text-red-600 hover:bg-red-100 hover:border-red-600 dark:bg-red-500/10 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/20 dark:hover:border-red-400"
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
            className="relative max-w-md w-full rounded-lg backdrop-blur-xl border shadow-2xl p-6 bg-white/90 border-red-500/50 shadow-red-300/30 dark:bg-gray-800/90 dark:border-red-500/50 dark:shadow-red-500/30"
          >
            {/* Cyber corners */}
            <div
              className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-red-500/50 dark:border-red-400/50"
            ></div>
            <div
              className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-red-500/50 dark:border-red-400/50"
            ></div>

            {/* Warning Icon */}
            <div className="flex items-center justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full border-2 flex items-center justify-center border-red-500/50 text-red-600 bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:bg-red-500/10"
              >
                <Trash2 className="w-8 h-8" />
              </div>
            </div>

            {/* Title */}
            <h2
              className="text-xl font-bold font-mono text-center mb-2 text-gray-900 dark:text-white"
            >
              PROJECT_DELETE_CONFIRMATION
            </h2>

            {/* Warning Message */}
            <p
              className="text-center mb-4 text-gray-600 dark:text-gray-300"
            >
              本当にプロジェクト「
              <span className="font-bold text-red-600 dark:text-red-400">
                {projectToDelete.title}
              </span>
              」を削除しますか？
            </p>

            <p
              className="text-sm text-center mb-6 text-gray-500 dark:text-gray-400"
            >
              この操作は取り消せません。削除するには、プロジェクト名を入力してください。
            </p>

            {/* Confirmation Input */}
            <div className="mb-6">
              <label
                className="block text-sm font-mono mb-2 text-gray-700 dark:text-gray-300"
              >
                プロジェクト名を入力:
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder={projectToDelete.title}
                className="w-full p-3 rounded border-l-4 focus:outline-none transition-all bg-white text-gray-800 border-red-500 focus:ring-1 focus:ring-red-400 placeholder-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:border-red-500 dark:focus:ring-1 dark:focus:ring-red-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 py-3 px-4 rounded font-bold transition-all bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={confirmationText !== projectToDelete.title}
                className={`flex-1 py-3 px-4 rounded font-bold transition-all ${
                  confirmationText === projectToDelete.title
                    ? "bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600"
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
