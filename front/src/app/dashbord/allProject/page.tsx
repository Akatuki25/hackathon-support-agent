"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Lightbulb,
  Search,
  Plus,
  Users,
  Trash2,
} from "lucide-react";
import { ProjectType } from "@/types/modelTypes";
import { getAllProjectsWithPhase, deleteProject } from "@/libs/modelAPI/project";
import { getMemberByGithubName } from "@/libs/modelAPI/member";
import { getProjectsByMemberId } from "@/libs/modelAPI/project_member";
import { useDarkMode } from "@/hooks/useDarkMode";
import Header from "@/components/Session/Header";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectStatistics } from "@/components/ProjectStatistics";

type SortOption = "date-desc" | "date-asc" | "title" | "progress";
type FilterOption = "all" | "in-progress" | "completed" | "preparing";

export default function AllProjectPage() {
  const router = useRouter();
  const { darkMode } = useDarkMode();
  const { data: session } = useSession();

  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");
  const [showOnlyMyProjects, setShowOnlyMyProjects] = useState(true); // デフォルトで自分のプロジェクトのみ
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  // 削除モーダル用のステート
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [confirmationText, setConfirmationText] = useState("");

  // 現在のログインユーザーのメンバーIDを取得
  useEffect(() => {
    const fetchCurrentMember = async () => {
      if (session?.user?.name) {
        try {
          const member = await getMemberByGithubName(session.user.name);
          setCurrentMemberId(member.member_id);
        } catch (error) {
          console.error("メンバー情報の取得エラー:", error);
        }
      }
    };
    fetchCurrentMember();
  }, [session]);

  // プロジェクト一覧を取得
  useEffect(() => {
    if (typeof window !== "undefined") {
      const fetchProjects = async () => {
        try {
          setLoading(true);
          const allProjectsData = await getAllProjectsWithPhase();

          // メンバーフィルタリング
          if (showOnlyMyProjects && currentMemberId) {
            // メンバーが参加しているプロジェクトメンバー情報を取得
            const memberProjects = await getProjectsByMemberId(currentMemberId);
            const memberProjectIds = memberProjects.map((pm) => pm.project_id);

            // プロジェクトIDでフィルタリング
            const filtered = allProjectsData.filter((p) =>
              memberProjectIds.includes(p.project_id || "")
            );
            setAllProjects(filtered);
            setFilteredProjects(filtered);
          } else {
            setAllProjects(allProjectsData);
            setFilteredProjects(allProjectsData);
          }
        } catch (error) {
          console.error("プロジェクトの取得エラー:", error);
          setAllProjects([]);
          setFilteredProjects([]);
        } finally {
          setLoading(false);
        }
      };
      fetchProjects();
    }
  }, [showOnlyMyProjects, currentMemberId]);

  // ステータス判定関数
  const getProjectStatus = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return "未設定";
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return "準備中";
    if (now > end) return "完了";
    return "進行中";
  };

  // 検索、ソート、フィルタリング
  useEffect(() => {
    let result = [...allProjects];

    // 検索フィルタ
    if (searchTerm) {
      result = result.filter(
        (project) =>
          project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          project.idea.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // ステータスフィルタ
    if (filterOption !== "all") {
      result = result.filter((project) => {
        const status = getProjectStatus(project.start_date, project.end_date);
        if (filterOption === "in-progress") return status === "進行中";
        if (filterOption === "completed") return status === "完了";
        if (filterOption === "preparing") return status === "準備中";
        return true;
      });
    }

    // ソート
    result.sort((a, b) => {
      if (sortOption === "date-desc") {
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      } else if (sortOption === "date-asc") {
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      } else if (sortOption === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortOption === "progress") {
        return (b.phase_progress_percentage || 0) - (a.phase_progress_percentage || 0);
      }
      return 0;
    });

    setFilteredProjects(result);
  }, [searchTerm, sortOption, filterOption, allProjects]);

  const handleDeleteClick = (
    e: React.MouseEvent,
    projectId: string,
    projectTitle: string
  ) => {
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
      const updatedProjects = await getAllProjectsWithPhase();

      // メンバーフィルタリングを適用
      if (showOnlyMyProjects && currentMemberId) {
        const memberProjects = await getProjectsByMemberId(currentMemberId);
        const memberProjectIds = memberProjects.map((pm) => pm.project_id);
        const filtered = updatedProjects.filter((p) =>
          memberProjectIds.includes(p.project_id || "")
        );
        setAllProjects(filtered);
        setFilteredProjects(filtered);
      } else {
        setAllProjects(updatedProjects);
        setFilteredProjects(updatedProjects);
      }

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
          {/* ヘッダー */}
          <div className="text-center mb-12">
            <div
              className={`inline-block px-4 py-2 rounded-lg font-mono text-sm mb-6 backdrop-blur-md ${
                darkMode
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-300/30"
              }`}
            >
              PROJECT_DATABASE_ACCESS
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
                className={`mx-4 w-2 h-2 border ${
                  darkMode ? "border-cyan-500" : "border-purple-500"
                } rotate-45`}
              ></div>
              <div
                className={`h-px w-16 ${darkMode ? "bg-pink-500" : "bg-blue-500"}`}
              ></div>
            </div>
          </div>

          {/* プロジェクト統計ダッシュボード */}
          <ProjectStatistics projects={allProjects} darkMode={darkMode} />

          {/* コントロール */}
          <div className="flex flex-col gap-4 mb-8">
            {/* 検索バー */}
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

            {/* フィルタ & ソート */}
            <div className="flex flex-wrap gap-4 items-center">
              {/* マイプロジェクトトグル */}
              <button
                onClick={() => setShowOnlyMyProjects(!showOnlyMyProjects)}
                className={`px-4 py-2 rounded-lg backdrop-blur-xl border transition-all ${
                  showOnlyMyProjects
                    ? darkMode
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                      : "bg-purple-500/20 border-purple-500/50 text-purple-600"
                    : darkMode
                    ? "bg-gray-800/30 border-gray-600/30 text-gray-400"
                    : "bg-white/60 border-gray-300/30 text-gray-600"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-mono">マイプロジェクト</span>
                </div>
              </button>

              {/* ステータスフィルタ */}
              <select
                value={filterOption}
                onChange={(e) => setFilterOption(e.target.value as FilterOption)}
                className={`px-4 py-2 rounded-lg backdrop-blur-xl border font-mono text-sm ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 text-white"
                    : "bg-white/60 border-purple-300/30 text-gray-900"
                }`}
              >
                <option value="all">全てのステータス</option>
                <option value="in-progress">進行中</option>
                <option value="completed">完了</option>
                <option value="preparing">準備中</option>
              </select>

              {/* ソートオプション */}
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className={`px-4 py-2 rounded-lg backdrop-blur-xl border font-mono text-sm ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 text-white"
                    : "bg-white/60 border-purple-300/30 text-gray-900"
                }`}
              >
                <option value="date-desc">日付（新しい順）</option>
                <option value="date-asc">日付（古い順）</option>
                <option value="title">タイトル順</option>
                <option value="progress">進捗順</option>
              </select>

              {/* 統計 */}
              <div className="flex items-center space-x-4 ml-auto">
                <div
                  className={`px-4 py-2 rounded-lg backdrop-blur-xl border ${
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
                    {allProjects.length}
                  </span>
                </div>
                <div
                  className={`px-4 py-2 rounded-lg backdrop-blur-xl border ${
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
          </div>

          {/* プロジェクトグリッド */}
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
                className={`${
                  darkMode ? "text-gray-400" : "text-gray-500"
                } font-mono`}
              >
                {searchTerm
                  ? `// "${searchTerm}" に一致するプロジェクトが見つかりません`
                  : "// まだプロジェクトが登録されていません"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* 新規プロジェクト作成カード */}
              <div
                onClick={() => router.push("/hackSetUp")}
                className={`relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden cursor-pointer ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                    : "bg-white/60 border-purple-300/30 hover:border-purple-400/50"
                } shadow-lg hover:shadow-2xl flex items-center justify-center min-h-[320px]`}
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-px ${
                    darkMode
                      ? "bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
                      : "bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
                  } translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000`}
                ></div>

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
                    CREATE_NEW_PROJECT
                  </p>
                </div>
              </div>

              {/* 既存プロジェクト */}
              {filteredProjects.map((project, index) => (
                <ProjectCard
                  key={project.project_id}
                  project={project}
                  index={index}
                  darkMode={darkMode}
                  onDelete={handleDeleteClick}
                  userName={session?.user?.name || undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 削除確認モーダル */}
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
