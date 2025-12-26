"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  Lightbulb,
  Clock,
  Search,
  Plus,
} from "lucide-react";
import { ProjectType } from "@/types/modelTypes";
import { getProject } from "@/libs/modelAPI/project";
import { getProjectMembersByMemberId } from "@/libs/modelAPI/project_member";
import { getMemberByGithubName } from "@/libs/modelAPI/member";
import Header from "@/components/Session/Header";

// メンバーのプロジェクト一覧を取得するfetcher
const fetchMemberProjects = async (githubName: string): Promise<ProjectType[]> => {
  // 1. GitHubNameからmember_idを取得
  const member = await getMemberByGithubName(githubName);
  if (!member?.member_id) return [];

  // 2. member_idからproject_member一覧を取得
  const projectMembers = await getProjectMembersByMemberId(member.member_id);
  if (!projectMembers || projectMembers.length === 0) return [];

  // 3. 各project_idからプロジェクト詳細を取得
  const projectPromises = projectMembers.map(pm =>
    getProject(String(pm.project_id)).catch(() => null)
  );
  const projects = await Promise.all(projectPromises);

  // nullを除外
  return projects.filter((p): p is ProjectType => p !== null);
};

export default function MemberProjectPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [searchTerm, setSearchTerm] = useState("");

  // SWRでプロジェクト一覧を取得（キャッシュ有効）
  const { data: memberProjects = [], isLoading } = useSWR(
    session?.user?.name ? `member-projects-${session.user.name}` : null,
    () => fetchMemberProjects(session!.user!.name!),
    { revalidateOnFocus: false }
  );

  // 検索フィルタリング（useMemoで最適化）
  const filteredProjects = useMemo(() => {
    if (!searchTerm) return memberProjects;
    return memberProjects.filter(
      (project) =>
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.idea.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm, memberProjects]);

  const loading = status === "loading" || isLoading;

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
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/10 to-transparent dark:via-cyan-400/10 translate-x-[-100%] animate-pulse"
            ></div>
            <div className="flex items-center space-x-4 relative">
              <div
                className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent dark:border-cyan-400 dark:border-t-transparent"
              ></div>
              <span className="text-lg font-mono font-bold tracking-wider">
                LOADING_MY_PROJECTS...
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
          <div className="text-center mb-12">
            <div
              className="inline-block px-4 py-2 rounded-lg font-mono text-sm mb-6 backdrop-blur-md bg-purple-500/10 text-purple-600 border border-purple-300/30 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30"
            >
            </div>

            <h1
              className="text-4xl md:text-5xl font-bold font-mono tracking-wider mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:text-cyan-400 dark:drop-shadow-[0_0_20px_rgba(34,211,238,0.5)] dark:bg-none"
            >
              MY_PROJECTS
            </h1>

            <p
              className="text-sm font-mono mb-4 text-gray-600 dark:text-gray-400"
            >
              {session?.user?.name ? `// ${session.user.name} が参加しているプロジェクト` : "// ログインしてください"}
            </p>

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

          <div className="flex flex-col md:flex-row gap-4 mb-8">
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

            <div className="flex items-center space-x-4">
              <div
                className="px-4 py-3 rounded-lg backdrop-blur-xl border bg-white/60 border-purple-300/30 dark:bg-gray-800/30 dark:border-cyan-500/30 dark:shadow-lg dark:shadow-cyan-500/20"
              >
                <span
                  className="text-sm font-mono text-gray-500 dark:text-gray-400"
                >
                  参加中:
                </span>
                <span
                  className="ml-2 font-bold font-mono text-purple-600 dark:text-cyan-400"
                >
                  {memberProjects.length}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* 新規プロジェクト作成カード */}
              <div
                onClick={() => router.push("/hackSetUp")}
                className="relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden cursor-pointer flex flex-col items-center justify-center min-h-[280px] bg-white/60 border-dashed border-purple-400/50 hover:border-purple-500/80 hover:bg-purple-500/10 dark:bg-gray-800/30 dark:border-dashed dark:border-cyan-500/50 dark:hover:border-cyan-400/80 dark:hover:bg-cyan-500/10 dark:shadow-lg dark:shadow-cyan-500/10 shadow-lg hover:shadow-2xl"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent dark:via-cyan-400/50 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"
                ></div>

                <div
                  className="w-16 h-16 rounded-full border-2 flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 border-purple-500/50 text-purple-600 group-hover:border-purple-500 group-hover:bg-purple-500/20 dark:border-cyan-500/50 dark:text-cyan-400 dark:group-hover:border-cyan-400 dark:group-hover:bg-cyan-500/20"
                >
                  <Plus className="w-8 h-8" />
                </div>

                <h2
                  className="text-xl font-bold font-mono tracking-wider mb-2 text-purple-600 dark:text-cyan-400"
                >
                  NEW_PROJECT
                </h2>

                <p
                  className="text-sm font-mono text-center text-gray-500 dark:text-gray-400"
                >
                  {/* 新しいプロジェクトを作成 */}
                </p>
              </div>

              {filteredProjects.map((project, index) => {
                const projectStatus = getProjectStatus(
                  project.start_date,
                  project.end_date,
                );
                const statusColor = getStatusColor(projectStatus);

                return (
                  <div
                    key={index}
                    className={`relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden shadow-lg hover:shadow-2xl cursor-pointer ${
                      projectStatus === "完了"
                        ? "bg-white/40 border-gray-300/20 opacity-60 dark:bg-gray-800/20 dark:border-gray-600/20 dark:shadow-gray-500/10"
                        : projectStatus === "進行中"
                        ? "bg-blue-100/60 border-blue-400/40 hover:border-blue-500/60 dark:bg-blue-900/30 dark:border-blue-500/40 dark:hover:border-blue-400/60 dark:shadow-blue-500/30"
                        : "bg-white/60 border-purple-300/30 hover:border-purple-400/50 dark:bg-gray-800/30 dark:border-cyan-500/30 dark:hover:border-cyan-400/50 dark:shadow-cyan-500/20"
                    }`}
                    onClick={() => router.push(`/projects/${project.project_id}`)}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent dark:via-cyan-400/50 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"
                    ></div>

                    <div className="absolute top-4 right-4 flex items-center space-x-2">
                      <div
                        className={`px-2 py-1 rounded text-xs font-mono font-bold border backdrop-blur-md ${statusColor}`}
                      >
                        {projectStatus}
                      </div>
                      <div
                        className="w-8 h-8 rounded border flex items-center justify-center text-xs font-mono font-bold backdrop-blur-md border-purple-500/50 text-purple-600 bg-white/50 dark:border-cyan-500/50 dark:text-cyan-400 dark:bg-gray-800/50"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </div>
                    </div>

                    <div
                      className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-purple-400/50 dark:border-cyan-400/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    ></div>
                    <div
                      className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-blue-400/50 dark:border-pink-400/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    ></div>

                    <div className="relative">
                      <h2
                        className="text-xl font-bold mb-4 font-mono tracking-wider line-clamp-2 pr-20 text-gray-900 dark:text-white"
                      >
                        {project.title || "UNTITLED_PROJECT"}
                      </h2>

                      <div className="mb-6">
                        <div className="flex items-center mb-2">
                          <Lightbulb
                            className="w-4 h-4 mr-2 text-purple-600 dark:text-cyan-400"
                          />
                          <span
                            className="text-xs font-mono font-bold text-purple-600 dark:text-cyan-400"
                          >
                          </span>
                        </div>
                        <p
                          className="text-sm leading-relaxed line-clamp-3 text-gray-600 dark:text-gray-300"
                        >
                          {project.idea || "アイデアが設定されていません"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
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
                              {projectStatus === "完了" ? "終了" : projectStatus === "進行中" ? "残り日数" : "開始まで"}
                            </span>
                          </div>
                          <span
                            className={`text-sm font-mono font-bold ${
                              projectStatus === "完了"
                                ? "text-gray-600 dark:text-gray-500"
                                : projectStatus === "進行中"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {projectStatus === "完了"
                              ? "完了済み"
                              : projectStatus === "進行中"
                              ? `${calculateRemainingDays(project.end_date?.toString?.() ?? "")}日`
                              : `${Math.ceil((new Date(project.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}日`
                            }
                          </span>
                        </div>
                      </div>

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
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </>
  );
}
