"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight, Terminal, Users, Plus, X, Trash2, User, Mail, Code, Github } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import { getProjectMembersByProjectId, postProjectMember, deleteProjectMember } from "@/libs/modelAPI/project_member";
import { postMember, getMemberById, deleteMemberById } from "@/libs/modelAPI/member";
import { ProjectMemberType, MemberType } from "@/types/modelTypes";
import Loading from "@/components/PageLoading";

interface MemberWithDetails extends ProjectMemberType {
  email?: string;
  member_skill?: string;
  github_name?: string;
}

export default function MemberPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({
    member_name: "",
    member_skill: "",
    github_name: "",
    email: ""
  });
  const [processingNext, setProcessingNext] = useState(false);
  const { darkMode } = useDarkMode();
  const projectId = pathname.split("/")[2];

  useEffect(() => {
    const fetchMembers = async () => {
      if (!projectId) return;

      try {
        setLoading(true);

        // プロジェクトメンバーを取得
        const projectMembers = await getProjectMembersByProjectId(projectId);

        // 各メンバーの詳細情報を取得
        const membersWithDetails = await Promise.all(
          projectMembers.map(async (projectMember) => {
            try {
              const memberDetails = await getMemberById(projectMember.member_id);
              return {
                ...projectMember,
                email: memberDetails.email,
                member_skill: memberDetails.member_skill,
                github_name: memberDetails.github_name
              };
            } catch (error) {
              console.error(`Failed to fetch member details for ${projectMember.member_id}:`, error);
              return projectMember;
            }
          })
        );

        setMembers(membersWithDetails);
      } catch (error) {
        console.error("メンバーの取得に失敗:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [projectId]);

  const handleAddMember = async () => {
    if (!newMember.member_name.trim() || !newMember.github_name.trim()) {
      alert("メンバー名とGitHubユーザー名は必須です");
      return;
    }

    try {
      // メンバーを作成
      const memberData: MemberType = {
        member_name: newMember.member_name.trim(),
        member_skill: newMember.member_skill.trim(),
        github_name: newMember.github_name.trim(),
        email: newMember.email.trim() || undefined
      };

      const memberId = await postMember(memberData);

      // プロジェクトメンバーとして追加
      const projectMemberData: ProjectMemberType = {
        project_id: projectId,
        member_id: memberId,
        member_name: newMember.member_name.trim()
      };

      const projectMemberId = await postProjectMember(projectMemberData);

      // リストを更新
      const newMemberWithDetails: MemberWithDetails = {
        project_member_id: projectMemberId,
        project_id: projectId,
        member_id: memberId,
        member_name: newMember.member_name.trim(),
        email: newMember.email.trim() || undefined,
        member_skill: newMember.member_skill.trim(),
        github_name: newMember.github_name.trim()
      };

      setMembers([...members, newMemberWithDetails]);

      // フォームをリセット
      setNewMember({
        member_name: "",
        member_skill: "",
        github_name: "",
        email: ""
      });
      setShowAddMember(false);
    } catch (error) {
      console.error("メンバーの追加に失敗:", error);
      alert("メンバーの追加に失敗しました");
    }
  };

  const handleDeleteMember = async (projectMemberId: string, memberId: string) => {
    try {
      // プロジェクトメンバーから削除
      await deleteProjectMember(projectMemberId);

      // メンバーも削除（他のプロジェクトで使用されていない場合のみ）
      try {
        await deleteMemberById(memberId);
      } catch (error) {
        // メンバーが他のプロジェクトで使用されている場合は削除しない
        console.log("Member is used in other projects, keeping member data");
      }

      // リストを更新
      setMembers(members.filter(member => member.project_member_id !== projectMemberId));
    } catch (error) {
      console.error("メンバーの削除に失敗:", error);
      alert("メンバーの削除に失敗しました");
    }
  };

  const handleNext = () => {
    setProcessingNext(true);
    router.push(`/hackSetUp/project/${projectId}/flow`);
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      <main className="relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4 mt-5">
              <Terminal
                className={`mr-2 ${darkMode ? "text-cyan-400" : "text-purple-600"}`}
              />
              <h1
                className={`text-3xl font-bold tracking-wider ${darkMode ? "text-cyan-400" : "text-purple-700"}`}
              >
                チーム
                <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
                  _メンバー
                </span>
              </h1>
            </div>
            <p
              className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              プロジェクトに参加するメンバーを管理しましょう
            </p>
          </div>

          <div
            className={`backdrop-blur-lg rounded-xl p-8 shadow-xl border transition-all ${
              darkMode
                ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
            }`}
          >
            {/* メンバー一覧 */}
            <div className="mb-8">
              <h2
                className={`text-xl font-medium mb-6 flex items-center ${
                  darkMode ? "text-cyan-400" : "text-purple-700"
                }`}
              >
                <Users
                  size={20}
                  className={`mr-2 ${
                    darkMode ? "text-pink-500" : "text-blue-600"
                  }`}
                />
                現在のメンバー ({members.length})
              </h2>

              {members.length > 0 ? (
                <div className="grid gap-4">
                  {members.map((member) => (
                    <div
                      key={member.project_member_id}
                      className={`p-6 rounded-lg border transition-all group ${
                        darkMode
                          ? "bg-gray-700/40 border-cyan-500/30 hover:border-cyan-500/50 hover:bg-gray-700/60"
                          : "bg-purple-50/70 border-purple-300/50 hover:border-purple-400 hover:bg-purple-50/90"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-grow">
                          <div className="flex items-center mb-3">
                            <User
                              size={18}
                              className={`mr-2 ${
                                darkMode ? "text-cyan-400" : "text-purple-600"
                              }`}
                            />
                            <h3
                              className={`text-lg font-semibold ${
                                darkMode ? "text-cyan-300" : "text-purple-700"
                              }`}
                            >
                              {member.member_name}
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {member.github_name && (
                              <div className="flex items-center">
                                <Github
                                  size={14}
                                  className={`mr-2 ${
                                    darkMode ? "text-pink-400" : "text-blue-500"
                                  }`}
                                />
                                <span
                                  className={`${
                                    darkMode ? "text-gray-300" : "text-gray-600"
                                  }`}
                                >
                                  @{member.github_name}
                                </span>
                              </div>
                            )}

                            {member.email && (
                              <div className="flex items-center">
                                <Mail
                                  size={14}
                                  className={`mr-2 ${
                                    darkMode ? "text-pink-400" : "text-blue-500"
                                  }`}
                                />
                                <span
                                  className={`${
                                    darkMode ? "text-gray-300" : "text-gray-600"
                                  }`}
                                >
                                  {member.email}
                                </span>
                              </div>
                            )}

                            {member.member_skill && (
                              <div className="flex items-center md:col-span-2">
                                <Code
                                  size={14}
                                  className={`mr-2 ${
                                    darkMode ? "text-pink-400" : "text-blue-500"
                                  }`}
                                />
                                <span
                                  className={`${
                                    darkMode ? "text-gray-300" : "text-gray-600"
                                  }`}
                                >
                                  {member.member_skill}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteMember(member.project_member_id!, member.member_id)}
                          className={`opacity-0 group-hover:opacity-100 ml-4 p-2 rounded-lg transition-all hover:bg-red-500/20 ${
                            darkMode ? "text-red-400 hover:text-red-300" : "text-red-500 hover:text-red-600"
                          }`}
                          title="削除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users
                    size={48}
                    className={`mx-auto mb-4 ${
                      darkMode ? "text-gray-500" : "text-gray-400"
                    }`}
                  />
                  <p
                    className={`mb-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                  >
                    まだメンバーが追加されていません
                  </p>
                </div>
              )}
            </div>

            {/* メンバー追加セクション */}
            {showAddMember ? (
              <div
                className={`p-6 rounded-lg border-2 border-dashed transition-all ${
                  darkMode
                    ? "bg-gray-700/30 border-cyan-500/50"
                    : "bg-purple-50/50 border-purple-400/50"
                }`}
              >
                <h3
                  className={`text-lg font-semibold mb-4 flex items-center ${
                    darkMode ? "text-cyan-400" : "text-purple-700"
                  }`}
                >
                  <Plus
                    size={18}
                    className={`mr-2 ${
                      darkMode ? "text-pink-500" : "text-blue-600"
                    }`}
                  />
                  新しいメンバーを追加
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label
                      className={`block mb-2 text-sm font-medium ${
                        darkMode ? "text-cyan-300" : "text-purple-600"
                      }`}
                    >
                      メンバー名 *
                    </label>
                    <input
                      type="text"
                      value={newMember.member_name}
                      onChange={(e) => setNewMember({ ...newMember, member_name: e.target.value })}
                      className={`w-full p-3 rounded-lg border transition-all ${
                        darkMode
                          ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                          : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                      } focus:outline-none focus:ring-2 ${
                        darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                      }`}
                      placeholder="田中太郎"
                    />
                  </div>

                  <div>
                    <label
                      className={`block mb-2 text-sm font-medium ${
                        darkMode ? "text-cyan-300" : "text-purple-600"
                      }`}
                    >
                      GitHubユーザー名 *
                    </label>
                    <input
                      type="text"
                      value={newMember.github_name}
                      onChange={(e) => setNewMember({ ...newMember, github_name: e.target.value })}
                      className={`w-full p-3 rounded-lg border transition-all ${
                        darkMode
                          ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                          : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                      } focus:outline-none focus:ring-2 ${
                        darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                      }`}
                      placeholder="tanaka_taro"
                    />
                  </div>

                  <div>
                    <label
                      className={`block mb-2 text-sm font-medium ${
                        darkMode ? "text-cyan-300" : "text-purple-600"
                      }`}
                    >
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      className={`w-full p-3 rounded-lg border transition-all ${
                        darkMode
                          ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                          : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                      } focus:outline-none focus:ring-2 ${
                        darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                      }`}
                      placeholder="tanaka@example.com"
                    />
                  </div>

                  <div>
                    <label
                      className={`block mb-2 text-sm font-medium ${
                        darkMode ? "text-cyan-300" : "text-purple-600"
                      }`}
                    >
                      スキル・専門分野
                    </label>
                    <input
                      type="text"
                      value={newMember.member_skill}
                      onChange={(e) => setNewMember({ ...newMember, member_skill: e.target.value })}
                      className={`w-full p-3 rounded-lg border transition-all ${
                        darkMode
                          ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                          : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                      } focus:outline-none focus:ring-2 ${
                        darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                      }`}
                      placeholder="React, Node.js, UI/UX Design"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowAddMember(false);
                      setNewMember({
                        member_name: "",
                        member_skill: "",
                        github_name: "",
                        email: ""
                      });
                    }}
                    className={`px-4 py-2 rounded-lg transition-all ${
                      darkMode
                        ? "bg-gray-600 hover:bg-gray-700 text-gray-300"
                        : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                    }`}
                  >
                    <X size={16} className="inline mr-1" />
                    キャンセル
                  </button>
                  <button
                    onClick={handleAddMember}
                    className={`px-4 py-2 rounded-lg transition-all ${
                      darkMode
                        ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900"
                        : "bg-purple-500 hover:bg-purple-600 text-white"
                    }`}
                  >
                    <Plus size={16} className="inline mr-1" />
                    追加
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddMember(true)}
                className={`w-full p-4 rounded-lg border-2 border-dashed transition-all group ${
                  darkMode
                    ? "border-cyan-500/30 hover:border-cyan-500/50 hover:bg-gray-700/30"
                    : "border-purple-300/50 hover:border-purple-400 hover:bg-purple-50/30"
                }`}
              >
                <div className="flex items-center justify-center">
                  <Plus
                    size={20}
                    className={`mr-2 ${
                      darkMode ? "text-cyan-400" : "text-purple-600"
                    }`}
                  />
                  <span
                    className={`font-medium ${
                      darkMode ? "text-cyan-400" : "text-purple-600"
                    }`}
                  >
                    新しいメンバーを追加
                  </span>
                </div>
              </button>
            )}

            {/* 次へ進むボタン */}
            <div className="flex justify-end mt-8">
              <button
                onClick={handleNext}
                className={`px-8 py-3 flex items-center rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                  darkMode
                    ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400"
                    : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
                }`}
                disabled={processingNext}
              >
                {processingNext ? (
                  <div className="flex items-center">
                    <div
                      className={`animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 ${
                        darkMode ? "border-gray-900" : "border-white"
                      } mr-2`}
                    ></div>
                    処理中...
                  </div>
                ) : (
                  <>
                    <span>次へ進む</span>
                    <ChevronRight size={18} className="ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>

          <HackthonSupportAgent />
        </div>
      </main>
    </>
  );
}