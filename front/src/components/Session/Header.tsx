"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  Terminal,
  Shield,
  Settings,
  LogOut,
  ChevronDown,
  X,
  UserPlus,
  Edit,
  FolderOpen,
} from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { useRouter, usePathname } from "next/navigation";
import { listMembers, getMemberByGithubName, patchMemberById } from "@/libs/modelAPI/member";
import { getProjectMembersByProjectId, postProjectMember, deleteProjectMember } from "@/libs/modelAPI/project_member";
import axios from "axios";

export default function CyberHeader() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsMode, setSettingsMode] = useState<"profile" | "member">("profile");
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // URLからprojectIDを取得（プロジェクト関連のパスからのみ取得）
  const getProjectIdFromPath = (path: string): string | null => {
    const segments = path.split("/").filter(Boolean);

    // UUIDまたは数字のみのIDかチェック
    // UUIDパターン: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const numberPattern = /^\d+$/;

    // パターン1: /hackSetUp/[ProjectId]/*, /projects/[ProjectId]/* など
    const projectPaths = ["hackSetUp", "projects", "project"];
    if (segments.length >= 2 && projectPaths.includes(segments[0])) {
      const potentialId = segments[1];
      if (uuidPattern.test(potentialId) || numberPattern.test(potentialId)) {
        return potentialId;
      }
    }

    // パターン2: /[userName]/[projectId]/* の形式
    // セグメントが2つ以上あり、2番目のセグメントがUUID/数字パターンの場合
    if (segments.length >= 2) {
      const potentialId = segments[1];
      if (uuidPattern.test(potentialId) || numberPattern.test(potentialId)) {
        return potentialId;
      }
    }

    return null;
  };

  const projectId = getProjectIdFromPath(pathname);
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  const handleSignIn = () => {
    // ★ 新規
    const callbackUrl = pathname === "/" ? "/hackSetUp" : pathname;
    signIn("github", { callbackUrl });
  };

  const handleLogout = () => {
    setIsMenuOpen(false);
    signOut({ callbackUrl: "/" });
  };

  const handleSettings = (mode: "profile" | "member") => {
    setIsMenuOpen(false);
    setSettingsMode(mode);
    setIsSettingsOpen(true);
  };

  // Settingsモーダルコンポーネント
  const SettingsModal = () => {
    if (!isSettingsOpen) return null;

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div
          className="relative w-full max-w-2xl mx-4 rounded-lg border shadow-2xl bg-white/95 border-purple-300/30 dark:bg-gray-900/95 dark:border-cyan-500/30"
        >
          {/* Header */}
          <div
            className="px-6 py-4 border-b flex items-center justify-between border-purple-300/20 dark:border-cyan-500/20"
          >
            <div className="flex items-center space-x-3">
              <Settings className="text-purple-600 dark:text-cyan-400" size={24} />
              <h2 className="text-xl font-bold text-purple-600 dark:text-cyan-400">
                {settingsMode === "member" ? "プロジェクトメンバー追加" : "プロフィール編集"}
              </h2>
            </div>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="p-2 rounded-lg transition hover:bg-purple-500/10 text-gray-600 hover:text-purple-600 dark:hover:bg-cyan-500/10 dark:text-gray-300 dark:hover:text-cyan-400"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Navigation - Only show when projectId exists */}
          {projectId && (
            <div className="px-6 pt-4 flex space-x-2 border-b border-purple-300/20 dark:border-cyan-500/20">
              <button
                onClick={() => setSettingsMode("profile")}
                className={`px-4 py-2 font-mono font-bold text-sm rounded-t-lg transition ${
                  settingsMode === "profile"
                    ? "bg-purple-500/20 text-purple-600 border-b-2 border-purple-600 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-400"
                    : "text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-cyan-400"
                }`}
              >
                プロフィール編集
              </button>
              <button
                onClick={() => setSettingsMode("member")}
                className={`px-4 py-2 font-mono font-bold text-sm rounded-t-lg transition ${
                  settingsMode === "member"
                    ? "bg-purple-500/20 text-purple-600 border-b-2 border-purple-600 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-400"
                    : "text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-cyan-400"
                }`}
              >
                メンバー追加
              </button>
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-6">
            {settingsMode === "member" && projectId ? (
              <ProjectMemberForm projectId={projectId} onClose={() => setIsSettingsOpen(false)} />
            ) : (
              <MemberEditForm onClose={() => setIsSettingsOpen(false)} session={session} />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="absolute z-100 w-full">
        {/* Cyber glow effect */}
        <div className="absolute inset-0"></div>

        <div className="container mx-auto px-6 py-6 relative">
          <div className="flex items-center justify-between">
            {/* Cyber Logo */}
            <button
              onClick={() => router.push("/")}
              className="flex items-center space-x-4 group cursor-pointer"
            >
              <div
                className="relative w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-500 dark:from-cyan-500 dark:via-purple-500 dark:to-pink-500 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
              >
                {/* Inner glow effect */}
                <div
                  className="absolute inset-1 rounded bg-gradient-to-br from-purple-400/20 to-blue-400/20 dark:from-cyan-400/20 dark:to-pink-400/20 blur-sm"
                ></div>
                <Terminal
                  className="text-white font-bold text-lg relative z-10"
                  size={24}
                />
                {/* Corner brackets */}
                <div
                  className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 border-purple-300 dark:border-cyan-400"
                ></div>
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 border-blue-300 dark:border-pink-400"
                ></div>
                <div
                  className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-blue-300 dark:border-pink-400"
                ></div>
                <div
                  className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-purple-300 dark:border-cyan-400"
                ></div>
              </div>

              <div className="flex flex-col">
                <span
                  className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 dark:from-cyan-400 dark:to-pink-400 filter drop-shadow-lg"
                >
                  Hackathon
                </span>
                <span
                  className="text-1xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 dark:from-cyan-400 dark:to-pink-400 filter drop-shadow-lg"
                >
                  SupportAgent
                </span>
                <span
                  className="text-xs font-mono tracking-wider text-purple-500/70 dark:text-cyan-300/70"
                >
                  {"// SYSTEM_ONLINE"}
                </span>
              </div>
            </button>

            {/* Cyber Authentication Section */}
            <div className="flex items-center space-x-4">
              {status === "loading" && (
                <div
                  className="relative px-6 py-3 rounded-lg backdrop-blur-sm border bg-white/50 border-purple-300/30 text-purple-600 dark:bg-gray-900/50 dark:border-cyan-500/30 dark:text-cyan-400 shadow-lg overflow-hidden"
                >
                  {/* Scanning line effect */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/10 to-transparent dark:via-cyan-400/10 translate-x-[-100%] animate-pulse"
                  ></div>
                  <div className="flex items-center space-x-3 relative">
                    <div
                      className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent dark:border-cyan-400 dark:border-t-transparent"
                    ></div>
                    <span className="text-sm font-mono font-bold tracking-wider">
                      LOADING...
                    </span>
                  </div>
                </div>
              )}

              {!session && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleSignIn}
                    className="group relative px-6 py-3 rounded-lg font-mono font-bold text-sm tracking-wider transition-all duration-300 overflow-hidden bg-white/50 hover:bg-gray-50/70 text-gray-600 hover:text-purple-600 border border-gray-300/50 hover:border-purple-400/70 dark:bg-gray-900/50 dark:hover:bg-gray-800/70 dark:text-gray-300 dark:hover:text-cyan-400 dark:border-gray-600/50 dark:hover:border-cyan-500/70 backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {/* Cyber scan line */}
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/20 to-transparent dark:via-cyan-400/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                    ></div>
                    <div className="flex items-center space-x-2 relative">
                      <Shield className="w-4 h-4" />
                      <span>ACCESS</span>
                    </div>
                    {/* Corner brackets */}
                    <div
                      className="absolute top-1 left-1 w-2 h-2 border-l border-t border-purple-400/50 dark:border-cyan-400/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    ></div>
                    <div
                      className="absolute top-1 right-1 w-2 h-2 border-r border-t border-purple-400/50 dark:border-cyan-400/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    ></div>
                  </button>
                </div>
              )}

              {session && (
                <div
                  className="flex items-center space-x-4 relative"
                  ref={menuRef}
                >
                  <button
                    onClick={handleMenuToggle}
                    className="relative px-6 py-3 rounded-lg backdrop-blur-sm border transition-all duration-300 bg-white/50 border-purple-300/30 hover:border-purple-400/50 dark:bg-gray-900/50 dark:border-cyan-500/30 dark:hover:border-cyan-400/50 shadow-lg overflow-hidden hover:shadow-xl group"
                  >
                    {/* Status indicator */}
                    <div
                      className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 animate-pulse"
                    ></div>
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Image
                          src={session.user?.image ?? "/window.svg"}
                          alt="Profile"
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-lg border-2 transition-all duration-300 border-purple-500/50 group-hover:border-purple-400 dark:border-cyan-500/50 dark:group-hover:border-cyan-400"
                        />
                        {/* Cyber frame */}
                        <div
                          className="absolute -inset-1 border transition-all duration-300 border-purple-400/30 group-hover:border-purple-400/50 dark:border-cyan-400/30 dark:group-hover:border-cyan-400/50 rounded-lg"
                        ></div>
                      </div>
                      <div className="hidden sm:block">
                        <p
                          className="text-sm font-mono font-bold tracking-wider text-purple-600 dark:text-cyan-400"
                        >
                          USER_
                          {session.user?.name
                            ?.toUpperCase()
                            .replace(/\s+/g, "_")}
                        </p>
                        <div className="flex items-center space-x-1">
                          <span
                            className="text-xs font-mono text-gray-500 dark:text-gray-400"
                          >
                            {"// ONLINE"}
                          </span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform duration-300 ${
                              isMenuOpen ? "rotate-180" : ""
                            } text-purple-600 dark:text-cyan-400`}
                          />
                        </div>
                      </div>
                      <div className="sm:hidden">
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-300 ${
                            isMenuOpen ? "rotate-180" : ""
                          } text-purple-600 dark:text-cyan-400`}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div
                      className="absolute top-full right-0 mt-2 w-64 rounded-lg backdrop-blur-md border shadow-xl z-50 overflow-hidden bg-white/90 border-purple-300/30 dark:bg-gray-900/90 dark:border-cyan-500/30"
                    >
                      {/* Menu Header */}
                      <div
                        className="px-4 py-3 border-b border-purple-300/20 dark:border-cyan-500/20"
                      >
                        <div className="flex items-center space-x-3">
                          <Image
                            src={session.user?.image ?? "/window.svg"}
                            alt="Profile"
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded border border-purple-500/50 dark:border-cyan-500/50"
                          />
                          <div>
                            <p
                              className="text-sm font-mono font-bold text-purple-600 dark:text-cyan-400"
                            >
                              {session.user?.name}
                            </p>
                            <p
                              className="text-xs font-mono text-gray-500 dark:text-gray-400"
                            >
                              {session.user?.email}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            router.push("/dashbord/memberProject");
                          }}
                          className="w-full px-4 py-3 text-left flex items-center space-x-3 transition-all duration-200 hover:bg-purple-500/10 text-gray-600 hover:text-purple-600 dark:hover:bg-cyan-500/10 dark:text-gray-300 dark:hover:text-cyan-400"
                        >
                          <div className="relative">
                            <FolderOpen className="w-5 h-5" />
                            {/* Cyber brackets */}
                            <div
                              className="absolute -top-1 -left-1 w-2 h-2 border-l border-t border-purple-400/50 dark:border-cyan-400/50"
                            ></div>
                            <div
                              className="absolute -bottom-1 -right-1 w-2 h-2 border-r border-b border-purple-400/50 dark:border-cyan-400/50"
                            ></div>
                          </div>
                          <div>
                            <span className="font-mono font-bold text-sm tracking-wider">
                              ALL_PROJECTS
                            </span>
                            <p
                              className="text-xs font-mono text-gray-400 dark:text-gray-500"
                            >
                              {"// View all projects"}
                            </p>
                          </div>
                        </button>

                        <button
                          onClick={() => handleSettings("profile")}
                          className="w-full px-4 py-3 text-left flex items-center space-x-3 transition-all duration-200 hover:bg-purple-500/10 text-gray-600 hover:text-purple-600 dark:hover:bg-cyan-500/10 dark:text-gray-300 dark:hover:text-cyan-400"
                        >
                          <div className="relative">
                            <Edit className="w-5 h-5" />
                            {/* Cyber brackets */}
                            <div
                              className="absolute -top-1 -left-1 w-2 h-2 border-l border-t border-purple-400/50 dark:border-cyan-400/50"
                            ></div>
                            <div
                              className="absolute -bottom-1 -right-1 w-2 h-2 border-r border-b border-purple-400/50 dark:border-cyan-400/50"
                            ></div>
                          </div>
                          <div>
                            <span className="font-mono font-bold text-sm tracking-wider">
                              PROFILE
                            </span>
                            <p
                              className="text-xs font-mono text-gray-400 dark:text-gray-500"
                            >
                              {"// Edit profile"}
                            </p>
                          </div>
                        </button>

                        {projectId && (
                          <button
                            onClick={() => handleSettings("member")}
                            className="w-full px-4 py-3 text-left flex items-center space-x-3 transition-all duration-200 hover:bg-purple-500/10 text-gray-600 hover:text-purple-600 dark:hover:bg-cyan-500/10 dark:text-gray-300 dark:hover:text-cyan-400"
                          >
                            <div className="relative">
                              <UserPlus className="w-5 h-5" />
                              {/* Cyber brackets */}
                              <div
                                className="absolute -top-1 -left-1 w-2 h-2 border-l border-t border-purple-400/50 dark:border-cyan-400/50"
                              ></div>
                              <div
                                className="absolute -bottom-1 -right-1 w-2 h-2 border-r border-b border-purple-400/50 dark:border-cyan-400/50"
                              ></div>
                            </div>
                            <div>
                              <span className="font-mono font-bold text-sm tracking-wider">
                                ADD_MEMBER
                              </span>
                              <p
                                className="text-xs font-mono text-gray-400 dark:text-gray-500"
                              >
                                {"// Add project member"}
                              </p>
                            </div>
                          </button>
                        )}

                        <div
                          className="mx-4 my-2 h-px bg-purple-300/20 dark:bg-cyan-500/20"
                        ></div>

                        <button
                          onClick={handleLogout}
                          className="w-full px-4 py-3 text-left flex items-center space-x-3 transition-all duration-200 hover:bg-red-500/10 text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400"
                        >
                          <div className="relative">
                            <LogOut className="w-5 h-5" />
                            {/* Warning brackets */}
                            <div
                              className="absolute -top-1 -left-1 w-2 h-2 border-l border-t border-red-500/50 dark:border-red-400/50"
                            ></div>
                            <div
                              className="absolute -bottom-1 -right-1 w-2 h-2 border-r border-b border-red-500/50 dark:border-red-400/50"
                            ></div>
                          </div>
                          <div>
                            <span className="font-mono font-bold text-sm tracking-wider">
                              LOGOUT
                            </span>
                            <p
                              className="text-xs font-mono text-gray-400 dark:text-gray-500"
                            >
                              {"// End session"}
                            </p>
                          </div>
                        </button>
                      </div>

                      {/* Menu Footer */}
                      <div
                        className="px-4 py-2 border-t border-purple-300/20 bg-gray-50/50 dark:border-cyan-500/20 dark:bg-gray-800/50"
                      >
                        <p
                          className="text-xs font-mono text-center text-gray-400 dark:text-gray-500"
                        >
                          {"// SYSTEM_ACCESS_GRANTED"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal />
    </>
  );
}

// ProjectMemberForm コンポーネント
const ProjectMemberForm = ({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) => {
  const [githubNames, setGithubNames] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allMembers, setAllMembers] = useState<string[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [existingMembers, setExistingMembers] = useState<Array<{ project_member_id: string; member_name: string; github_name: string }>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // 全メンバーとプロジェクトメンバーを取得
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const members = await listMembers();
        setAllMembers(members.map(m => m.github_name));

        // プロジェクトメンバーを取得
        try {
          const projectMembers = await getProjectMembersByProjectId(projectId);
          // member_idからgithub_nameを取得
          const membersWithGithub = await Promise.all(
            projectMembers.map(async (pm) => {
              const member = members.find(m => m.member_id === pm.member_id);
              return {
                project_member_id: pm.project_member_id || "",
                member_name: pm.member_name,
                github_name: member?.github_name || pm.member_name,
              };
            })
          );
          setExistingMembers(membersWithGithub);
        } catch (error) {
          // 404エラーの場合は空配列（メンバーがいない）
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            setExistingMembers([]);
          } else {
            console.error("プロジェクトメンバー取得エラー:", error);
            setExistingMembers([]);
          }
        }
      } catch (error) {
        console.error("メンバー取得エラー:", error);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    void fetchMembers();
  }, [projectId]);

  // 既存メンバーを削除
  const removeExistingMember = async (projectMemberId: string) => {
    try {
      await deleteProjectMember(projectMemberId);
      setExistingMembers(existingMembers.filter(m => m.project_member_id !== projectMemberId));
    } catch (error) {
      console.error("メンバー削除エラー:", error);
      alert("メンバーの削除に失敗しました");
    }
  };

  // サジェスト機能（既存メンバーを除外）
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.trim()) {
      const existingGithubNames = existingMembers.map(m => m.github_name);
      const filtered = allMembers.filter(
        name =>
          name.toLowerCase().includes(value.toLowerCase()) &&
          !githubNames.includes(name) &&
          !existingGithubNames.includes(name)
      );
      setSuggestions(filtered.slice(0, 5)); // 最大5件
    } else {
      setSuggestions([]);
    }
  };

  // チップを追加
  const addGithubName = (name: string) => {
    if (name.trim() && !githubNames.includes(name.trim())) {
      setGithubNames([...githubNames, name.trim()]);
      setInputValue("");
      setSuggestions([]);
    }
  };

  // Enterキーで追加
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addGithubName(inputValue);
    }
  };

  // チップを削除
  const removeGithubName = (nameToRemove: string) => {
    setGithubNames(githubNames.filter(name => name !== nameToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (githubNames.length === 0) return;

    setLoading(true);

    try {
      const failedMembers: string[] = [];
      const successMembers: string[] = [];

      console.log(`[メンバー追加] プロジェクトID: ${projectId}, 追加予定: ${githubNames.join(', ')}`);

      // 各GitHubネームごとにメンバーを追加
      for (const githubName of githubNames) {
        try {
          let member;

          // 既存メンバーを検索
          try {
            member = await getMemberByGithubName(githubName);
            console.log(`[メンバー検索成功] ${githubName} -> member_id: ${member.member_id}`);
          } catch (error) {
            // 404エラーの場合は、そのユーザーにGitHubログインを促す必要がある
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              console.warn(`[メンバー未登録] ${githubName} はシステムに未登録です`);
              failedMembers.push(`${githubName} (未登録ユーザー - GitHubログインが必要)`);
              continue;
            } else {
              throw error;
            }
          }

          // 重複チェック（既にプロジェクトメンバーに含まれているか）
          const isDuplicate = existingMembers.some(
            existing => existing.github_name === githubName || existing.member_name === member.member_name
          );

          if (isDuplicate) {
            console.warn(`[重複検出] ${githubName} は既にプロジェクトメンバーです`);
            failedMembers.push(`${githubName} (既にメンバーです)`);
            continue;
          }

          // プロジェクトメンバーに追加
          console.log(`[DB登録開始] project_id: ${projectId}, member_id: ${member.member_id}, member_name: ${member.member_name}`);

          const projectMemberData = {
            project_id: projectId,
            member_id: member.member_id,
            member_name: member.member_name,
          };

          const projectMemberId = await postProjectMember(projectMemberData);
          console.log(`[DB登録成功] project_member_id: ${projectMemberId}, GitHubユーザー: ${githubName}`);

          successMembers.push(githubName);
        } catch (error) {
          console.error(`[メンバー追加エラー] ${githubName}:`, error);

          // エラー詳細を取得
          let errorDetail = "追加失敗";
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 409) {
              errorDetail = "既に登録済み";
            } else if (error.response?.data?.detail) {
              errorDetail = error.response.data.detail;
            }
          }

          failedMembers.push(`${githubName} (${errorDetail})`);
        }
      }

      console.log(`[追加処理完了] 成功: ${successMembers.length}件, 失敗: ${failedMembers.length}件`);

      // 結果を表示
      if (failedMembers.length > 0) {
        alert(
          `以下のメンバーの追加に失敗しました:\n${failedMembers.join("\n")}\n\n成功: ${successMembers.length}件`
        );
      }

      if (successMembers.length > 0) {
        // 既存メンバーリストを更新
        try {
          console.log(`[メンバーリスト再取得開始] プロジェクトID: ${projectId}`);
          const projectMembers = await getProjectMembersByProjectId(projectId);
          const members = await listMembers();

          const membersWithGithub = await Promise.all(
            projectMembers.map(async (pm) => {
              const member = members.find(m => m.member_id === pm.member_id);
              return {
                project_member_id: pm.project_member_id || "",
                member_name: pm.member_name,
                github_name: member?.github_name || pm.member_name,
              };
            })
          );

          console.log(`[メンバーリスト更新] 現在のメンバー数: ${membersWithGithub.length}`);
          setExistingMembers(membersWithGithub);
        } catch (error) {
          console.error("[メンバーリスト再取得エラー]", error);
        }

        setShowSuccessMessage(true);
        setTimeout(() => {
          setShowSuccessMessage(false);
          setGithubNames([]);
        }, 2000);
      } else if (failedMembers.length > 0) {
        // 全て失敗した場合
        setGithubNames([]);
      }
    } catch (error) {
      console.error("[プロジェクトメンバー追加 全体エラー]", error);
      alert("プロジェクトメンバーの追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 既存メンバー表示 */}
        {isLoadingMembers ? (
          <div className="text-center py-4 text-purple-600 dark:text-cyan-400">
            読み込み中...
          </div>
        ) : existingMembers.length > 0 ? (
          <div>
            <label
              className="block text-sm font-mono font-bold mb-2 text-purple-600 dark:text-cyan-400"
            >
              現在のメンバー
            </label>
            <div className="min-h-[50px] p-2 rounded-lg border mb-4 flex flex-wrap gap-2 bg-white/50 border-purple-300/20 dark:bg-gray-800/50 dark:border-cyan-500/20">
              {existingMembers.map((member) => (
                <div
                  key={member.project_member_id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-mono bg-green-500/20 text-green-700 border border-green-400/50 dark:text-green-300 dark:border-green-500/50"
                >
                  <span>{member.github_name}</span>
                  <button
                    type="button"
                    onClick={() => removeExistingMember(member.project_member_id)}
                    className="ml-2 hover:opacity-70 text-green-600 dark:text-green-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="relative">
          <label
            className="block text-sm font-mono font-bold mb-2 text-purple-600 dark:text-cyan-400"
          >
            メンバーを追加
          </label>

          {/* 追加予定のチップ表示エリア */}
          <div className="min-h-[50px] p-2 rounded-lg border mb-2 flex flex-wrap gap-2 bg-white border-purple-300/30 dark:bg-gray-800 dark:border-cyan-500/30">
            {githubNames.map((name, index) => (
              <div
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-mono bg-purple-500/20 text-purple-700 border border-purple-400/50 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/50"
              >
                <span>{name}</span>
                <button
                  type="button"
                  onClick={() => removeGithubName(name)}
                  className="ml-2 hover:opacity-70 text-purple-600 dark:text-cyan-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* 入力フィールド */}
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="GitHubユーザー名を入力してEnter"
            className="w-full px-4 py-2 rounded-lg border bg-white border-purple-300/30 text-gray-600 focus:border-purple-400 placeholder-gray-400 dark:bg-gray-800 dark:border-cyan-500/30 dark:text-gray-300 dark:focus:border-cyan-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50 dark:focus:ring-cyan-400/50"
          />

          {/* サジェスト */}
          {suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 rounded-lg border shadow-lg bg-white border-purple-300/30 dark:bg-gray-800 dark:border-cyan-500/30">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => addGithubName(suggestion)}
                  className={`w-full px-4 py-2 text-left font-mono text-sm transition hover:bg-purple-500/10 text-gray-600 hover:text-purple-600 dark:hover:bg-cyan-500/10 dark:text-gray-300 dark:hover:text-cyan-400 ${index === 0 ? "rounded-t-lg" : ""} ${
                    index === suggestions.length - 1 ? "rounded-b-lg" : ""
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-lg font-mono font-bold transition bg-gray-200 hover:bg-gray-300 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading || githubNames.length === 0}
            className={`px-6 py-2 rounded-lg font-mono font-bold flex items-center space-x-2 transition ${
              loading || githubNames.length === 0
                ? "opacity-50 cursor-not-allowed"
                : ""
            } bg-purple-600 hover:bg-purple-700 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700`}
          >
            <UserPlus size={16} />
            <span>{loading ? "追加中..." : `追加 (${githubNames.length})`}</span>
          </button>
        </div>
      </form>

      {/* Success Message */}
      {showSuccessMessage && (
        <div
          className="fixed top-20 right-4 px-6 py-4 rounded-lg border shadow-lg backdrop-blur-sm animate-slide-in-right z-[300] bg-green-100/90 border-green-400/50 text-green-800 dark:bg-green-900/90 dark:border-green-500/50 dark:text-green-300"
        >
          <div className="flex items-center space-x-3">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500/20"
            >
              <span className="text-xl">✓</span>
            </div>
            <span className="font-mono font-bold">メンバーを追加しました</span>
          </div>
        </div>
      )}
    </>
  );
};

// MemberEditForm コンポーネント
const MemberEditForm = ({
  onClose,
  session,
}: {
  onClose: () => void;
  session: Session | null;
}) => {
  const [memberName, setMemberName] = useState("");
  const [memberSkill, setMemberSkill] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [memberId, setMemberId] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    const loadMemberData = async () => {
      if (!session?.user?.name) return;

      try {
        const member = await getMemberByGithubName(session.user.name);
        setMemberName(member.member_name);
        setMemberSkill(member.member_skill);
        setMemberId(member.member_id);
      } catch (error) {
        console.error("メンバー情報取得エラー:", error);

        // 404エラーの場合は再ログインを促す
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          alert("メンバー情報が見つかりません。再度ログインしてください。");
          signOut({ callbackUrl: "/" });
        } else {
          // その他のエラーの場合はデフォルト値を設定
          setMemberName(session.user?.name || "");
          setMemberSkill("");
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadMemberData();
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await patchMemberById(memberId, {
        member_name: memberName,
        member_skill: memberSkill,
      });

      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error("プロフィール更新エラー:", error);
      alert("プロフィールの更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-purple-600 dark:text-cyan-400">読み込み中...</div>;
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="block text-sm font-mono font-bold mb-2 text-purple-600 dark:text-cyan-400"
          >
            名前
          </label>
          <input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg border bg-white border-purple-300/30 text-gray-600 focus:border-purple-400 dark:bg-gray-800 dark:border-cyan-500/30 dark:text-gray-300 dark:focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 dark:focus:ring-cyan-400/50"
          />
        </div>

        <div>
          <label
            className="block text-sm font-mono font-bold mb-2 text-purple-600 dark:text-cyan-400"
          >
            スキル
          </label>
          <textarea
            value={memberSkill}
            onChange={(e) => setMemberSkill(e.target.value)}
            required
            rows={4}
            className="w-full px-4 py-2 rounded-lg border bg-white border-purple-300/30 text-gray-600 focus:border-purple-400 dark:bg-gray-800 dark:border-cyan-500/30 dark:text-gray-300 dark:focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 dark:focus:ring-cyan-400/50"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-lg font-mono font-bold transition bg-gray-200 hover:bg-gray-300 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-2 rounded-lg font-mono font-bold flex items-center space-x-2 transition ${
              loading
                ? "opacity-50 cursor-not-allowed"
                : ""
            } bg-purple-600 hover:bg-purple-700 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700`}
          >
            <Edit size={16} />
            <span>{loading ? "更新中..." : "更新"}</span>
          </button>
        </div>
      </form>

      {/* Success Message */}
      {showSuccessMessage && (
        <div
          className="fixed top-20 right-4 px-6 py-4 rounded-lg border shadow-lg backdrop-blur-sm animate-slide-in-right z-[300] bg-green-100/90 border-green-400/50 text-green-800 dark:bg-green-900/90 dark:border-green-500/50 dark:text-green-300"
        >
          <div className="flex items-center space-x-3">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500/20"
            >
              <span className="text-xl">✓</span>
            </div>
            <span className="font-mono font-bold">プロフィールを更新しました</span>
          </div>
        </div>
      )}
    </>
  );
};
