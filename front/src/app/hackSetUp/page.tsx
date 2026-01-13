"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Clock, ChevronRight, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

import { useDarkMode } from "@/hooks/useDarkMode";
import { postProject } from "@/libs/modelAPI/project";
import { getMemberByGithubName } from "@/libs/modelAPI/member";
import Header from "@/components/Session/Header";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";

export default function Home() {
  const { darkMode } = useDarkMode();
  const { data: session } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toTimeString().split(":").slice(0, 2).join(":"); // 現在時刻 "HH:MM"
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [endTime, setEndTime] = useState(now);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // endDateとendTimeを結合してDateオブジェクトを作成
    const endDateTime = `${endDate}T${endTime}:00`;
    try {
      // 作成者のmember_idを取得
      let creatorMemberId: string | undefined;
      if (session?.user?.name) {
        try {
          const member = await getMemberByGithubName(session.user.name);
          creatorMemberId = member.member_id;
        } catch (err) {
          console.error('メンバー情報取得エラー:', err);
        }
      }

      // 入力データを整形（作成者IDを含む）
      const projectData = {
        title: title,
        idea: idea,
        start_date: startDate,
        end_date: endDateTime,
        creator_member_id: creatorMemberId,
      };

      const projectId = await postProject(projectData);

      // プロジェクト作成後、すぐにhackQAページへ遷移
      // 質問の生成はhackQAページで行う（new=trueクエリパラメータで通知）
      router.push(`/hackSetUp/${projectId}/hackQA?new=true`);
    } catch (error) {
      console.error("API呼び出しエラー:", error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Fixed at top, full width */}
      <div className="w-full top-0 left-0 right-0 z-1 absolute">
        <Header />
      </div>

      {/* Main Content - Adjusted for fixed header */}
      <div className="flex-1 flex items-center justify-center px-6 pt-24">
        <div className="w-full max-w-2xl">
          {/* Project Form */}
          <div
            className={`relative backdrop-blur-md rounded-xl shadow-xl p-8 w-full border transition-all ${
              darkMode
                ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
            }`}
          >
            <div className="flex items-center justify-center mb-6 mt-5 w-xl">
              <Zap
                className={`mr-2 ${darkMode ? "text-cyan-400" : "text-purple-600"}`}
              />
              <h1
                className={`text-2xl font-bold tracking-wider ${darkMode ? "text-cyan-400" : "text-purple-700"}`}
              >
                プロジェクト
                <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
                  _作成
                </span>
              </h1>
            </div>

            {/* User info in form header */}
            {session && (
              <div
                className={`mb-6 p-4 rounded-lg border ${
                  darkMode
                    ? "bg-gray-700/30 border-cyan-500/20 text-cyan-300"
                    : "bg-purple-50/50 border-purple-300/20 text-purple-700"
                }`}
              >
                <p className="text-sm">
                  <span className="font-medium">プロジェクト作成者:</span>{" "}
                  {session.user?.name}
                </p>
              </div>
            )}

            {/* input space  */}
            <div className="mb-5">
              <label
                className={`flex items-center ${darkMode ? "text-gray-300" : "text-gray-700"} mb-2`}
              >
                <Zap
                  size={16}
                  className={`mr-2 ${darkMode ? "text-pink-500" : "text-blue-600"}`}
                />
                <span>プロジェクトタイトル</span>
              </label>
              <input
                value={title}
                onChange={(e) => {
                  // これ入れないとサイズが変わったあとに内容を削除したときなど動きがおかしい
                  e.target.style.height = "auto";
                  // 改行に合わせて高さを変える
                  e.target.style.height = e.target.scrollHeight + "px";
                  setTitle(e.target.value);
                }}
                placeholder="例: AIXプロジェクト"
                required
                className={`w-full p-3 rounded border-l-4 focus:outline-none transition-all ${
                  darkMode
                    ? "bg-gray-700 text-gray-100 border-pink-500 focus:ring-1 focus:ring-cyan-400"
                    : "bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400"
                }`}
              />
            </div>
            {/* input space  */}
            <div className="mb-5">
              <label
                className={`flex items-center ${darkMode ? "text-gray-300" : "text-gray-700"} mb-2`}
              >
                <Zap
                  size={16}
                  className={`mr-2 ${darkMode ? "text-pink-500" : "text-blue-600"}`}
                />
                <span>プロジェクトアイディア（詳しく書いてください）</span>
              </label>
              <textarea
                value={idea}
                onChange={(e) => {
                  // これ入れないとサイズが変わったあとに内容を削除したときなど動きがおかしい
                  e.target.style.height = "auto";
                  // 改行に合わせて高さを変える
                  e.target.style.height = e.target.scrollHeight + "px";
                  setIdea(e.target.value);
                }}
                placeholder="例: AIを活用したプロジェクト"
                required
                className={`w-full p-3 rounded border-l-4 focus:outline-none transition-all ${
                  darkMode
                    ? "bg-gray-700 text-gray-100 border-pink-500 focus:ring-1 focus:ring-cyan-400"
                    : "bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400"
                }`}
              />
            </div>

            <div className="mb-5">
              <label
                className={`flex items-center ${darkMode ? "text-gray-300" : "text-gray-700"} mb-2`}
              >
                <Clock
                  size={16}
                  className={`mr-2 ${darkMode ? "text-pink-500" : "text-blue-600"}`}
                />
                <span>期間</span>
              </label>

              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0">
                {/* 開始日（date のみ） */}
                <div className="flex items-center space-x-2 w-full">
                  <input
                    type="date"
                    value={startDate}
                    min={today}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full p-3 rounded border-l-4 focus:outline-none transition-all ${
                      darkMode
                        ? "bg-gray-700 text-gray-100 border-pink-500 focus:ring-1 focus:ring-cyan-400"
                        : "bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400"
                    }`}
                  />
                </div>

                {/* 〜 */}
                <div
                  className={`${darkMode ? "text-gray-300" : "text-gray-700"} text-center`}
                >
                  〜
                </div>

                {/* 終了日＋終了時刻 */}
                <div className="flex items-center space-x-2 w-full">
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-2/3 p-3 rounded border-l-4 focus:outline-none transition-all ${
                      darkMode
                        ? "bg-gray-700 text-gray-100 border-pink-500 focus:ring-1 focus:ring-cyan-400"
                        : "bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400"
                    }`}
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`w-1/2 p-3 rounded border-l-4 focus:outline-none transition-all ${
                      darkMode
                        ? "bg-gray-700 text-gray-100 border-pink-500 focus:ring-1 focus:ring-cyan-400"
                        : "bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400"
                    }`}
                  />
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center font-bold py-3 px-6 rounded transition-all ${
                  darkMode
                    ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 disabled:bg-gray-600 disabled:text-gray-400"
                    : "bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-400 disabled:text-gray-600"
                }`}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 size={20} className="animate-spin" />
                    <span>プロジェクト作成中...</span>
                  </div>
                ) : (
                  <>
                    <span>質問に答える</span>
                    <ChevronRight size={18} className="ml-2" />
                  </>
                )}
              </button>
            </form>

            <HackthonSupportAgent />
          </div>
        </div>
      </div>
    </div>
  );
}