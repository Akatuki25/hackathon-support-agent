"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Zap, Clock, ChevronRight, Loader2, AlertCircle, Lightbulb } from "lucide-react";
import { useSession } from "next-auth/react";
import axios from "axios";

import { postProject } from "@/libs/modelAPI/project";
import { getMemberByGithubName } from "@/libs/modelAPI/member";
import Header from "@/components/Session/Header";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import { IdeaSupportModal } from "@/components/IdeaSupportModal";
import { useIdleDetection } from "@/hooks/useIdleDetection";

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toTimeString().split(":").slice(0, 2).join(":"); // 現在時刻 "HH:MM"
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [endTime, setEndTime] = useState(now);

  // アイデア発想サポートモーダルの状態
  const [isIdeaSupportModalOpen, setIsIdeaSupportModalOpen] = useState(false);
  const [showIdleHint, setShowIdleHint] = useState(false);
  const [hasShownHint, setHasShownHint] = useState(false); // 一度だけ表示

  // アイドル検知: フォームが空の状態で1分放置すると吹き出しヒントを表示（一度だけ）
  const handleIdleDetected = useCallback(() => {
    // タイトルとアイデアが両方空で、モーダルが開いておらず、まだヒントを表示していない場合のみ
    if (!title.trim() && !idea.trim() && !isIdeaSupportModalOpen && !hasShownHint) {
      setShowIdleHint(true);
      setHasShownHint(true);
    }
  }, [title, idea, isIdeaSupportModalOpen, hasShownHint]);

  const { reset: resetIdleTimer, pause: pauseIdleDetection, resume: resumeIdleDetection } = useIdleDetection({
    timeout: 60000, // 1分
    onIdle: handleIdleDetected,
    enabled: !loading && !isIdeaSupportModalOpen,
  });

  // モーダルを開く
  const openIdeaSupportModal = useCallback(() => {
    pauseIdleDetection();
    setIsIdeaSupportModalOpen(true);
    setShowIdleHint(false); // ヒントを非表示に
  }, [pauseIdleDetection]);

  // モーダルを閉じる
  const closeIdeaSupportModal = useCallback(() => {
    setIsIdeaSupportModalOpen(false);
    resumeIdleDetection();
    resetIdleTimer();
  }, [resumeIdleDetection, resetIdleTimer]);

  // アイデアが選択されたときの処理
  const handleIdeaSelected = useCallback((selectedTitle: string, selectedIdea: string) => {
    setTitle(selectedTitle);
    setIdea(selectedIdea);
  }, []);

  // ヒントを閉じる
  const dismissIdleHint = useCallback(() => {
    setShowIdleHint(false);
  }, []);

  // バリデーション: 終了日時が現在より未来かチェック
  const isEndDateTimeValid = useMemo(() => {
    const endDateTime = new Date(`${endDate}T${endTime}:00`);
    const nowDateTime = new Date();
    return endDateTime > nowDateTime;
  }, [endDate, endTime]);

  // フォームが有効かどうか
  const isFormValid = useMemo(() => {
    return title.trim() !== "" && idea.trim() !== "" && isEndDateTimeValid;
  }, [title, idea, isEndDateTimeValid]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

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
          console.error("メンバー情報取得エラー:", err);
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

      // エラーメッセージを抽出
      let errorMsg = "プロジェクトの作成に失敗しました";

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const detail = error.response?.data?.detail;

        if (status === 422 && Array.isArray(detail)) {
          // Pydanticバリデーションエラーの場合
          const messages = detail
            .map(
              (err: { msg?: string; message?: string }) =>
                err.msg || err.message || String(err),
            )
            .join("\n");
          errorMsg = `入力内容に問題があります:\n${messages}`;
        } else if (typeof detail === "string") {
          // 単一のエラーメッセージの場合
          errorMsg = detail;
        } else if (error.response?.data?.message) {
          errorMsg = error.response.data.message;
        } else if (error.message) {
          errorMsg = error.message;
        }
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
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
          <div className="relative backdrop-blur-md rounded-xl shadow-xl p-8 w-full border transition-all bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20 dark:bg-gray-800 dark:bg-opacity-70 dark:border-cyan-500/30 dark:shadow-cyan-500/20">
            <div className="flex items-center justify-center mb-6 mt-5 w-xl">
              <Zap className="mr-2 text-purple-600 dark:text-cyan-400" />
              <h1 className="text-2xl font-bold tracking-wider text-purple-700 dark:text-cyan-400">
                プロジェクト
                <span className="text-blue-600 dark:text-pink-500">_作成</span>
              </h1>
            </div>

            {/* User info in form header */}
            {session && (
              <div className="mb-6 p-4 rounded-lg border bg-purple-50/50 border-purple-300/20 text-purple-700 dark:bg-gray-700/30 dark:border-cyan-500/20 dark:text-cyan-300">
                <p className="text-sm">
                  <span className="font-medium">プロジェクト作成者:</span>{" "}
                  {session.user?.name}
                </p>
              </div>
            )}

            <form id="project-form" onSubmit={handleSubmit}>
              {/* input space  */}
              <div className="mb-5">

                <div className="flex items-center justify-between mb-2">
                  <label
                    className="flex items-center text-gray-700 dark:text-gray-300"
                  >
                    <Zap
                      size={16}
                      className="mr-2 text-blue-600 dark:text-pink-500"
                    />
                    <span>プロジェクトタイトル</span>
                  </label>
                  <button
                    type="button"
                    onClick={openIdeaSupportModal}
                    className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
                  >
                    <Lightbulb size={14} />
                    <span>アイデアが思いつかない方へ</span>
                  </button>
                </div>
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
                  className="w-full p-3 rounded border-l-4 focus:outline-none transition-all bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400 dark:bg-gray-700 dark:text-gray-100 dark:border-pink-500 dark:focus:ring-1 dark:focus:ring-cyan-400"
                />
              </div>
              {/* input space  */}
              <div className="mb-5">
                <label className="flex items-center text-gray-700 dark:text-gray-300 mb-2">
                  <Zap
                    size={16}
                    className="mr-2 text-blue-600 dark:text-pink-500"
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
                  className="w-full p-3 rounded border-l-4 focus:outline-none transition-all bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400 dark:bg-gray-700 dark:text-gray-100 dark:border-pink-500 dark:focus:ring-1 dark:focus:ring-cyan-400"
                />
              </div>

              <div className="mb-5">
                <label className="flex items-center text-gray-700 dark:text-gray-300 mb-2">
                  <Clock
                    size={16}
                    className="mr-2 text-blue-600 dark:text-pink-500"
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
                      className="w-full p-3 rounded border-l-4 focus:outline-none transition-all bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400 dark:bg-gray-700 dark:text-gray-100 dark:border-pink-500 dark:focus:ring-1 dark:focus:ring-cyan-400"
                    />
                  </div>

                  {/* 〜 */}
                  <div className="text-gray-700 dark:text-gray-300 text-center">
                    〜
                  </div>

                  {/* 終了日＋終了時刻 */}
                  <div className="flex items-center space-x-2 w-full">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-2/3 p-3 rounded border-l-4 focus:outline-none transition-all bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400 dark:bg-gray-700 dark:text-gray-100 dark:border-pink-500 dark:focus:ring-1 dark:focus:ring-cyan-400"
                    />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-1/2 p-3 rounded border-l-4 focus:outline-none transition-all bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400 dark:bg-gray-700 dark:text-gray-100 dark:border-pink-500 dark:focus:ring-1 dark:focus:ring-cyan-400"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* クライアント側バリデーションエラー表示 */}
            {!isEndDateTimeValid && (
              <div className="mb-4 p-3 rounded-lg flex items-center bg-red-50 border border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">
                <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                <span className="text-sm">
                  終了日時は現在より未来の日時を設定してください
                </span>
              </div>
            )}

            {/* サーバー側バリデーションエラー表示 */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg flex items-start bg-red-50 border border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">
                <AlertCircle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-sm whitespace-pre-line">
                    {errorMessage}
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              form="project-form"
              disabled={loading || !isFormValid}
              className="w-full flex items-center justify-center font-bold py-3 px-6 rounded transition-all bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed dark:bg-cyan-500 dark:hover:bg-cyan-600 dark:text-gray-900 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
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

            <HackthonSupportAgent />
          </div>
        </div>
      </div>

      {/* アイデア発想サポートウィジェット */}
      <IdeaSupportModal
        isOpen={isIdeaSupportModalOpen}
        onOpen={openIdeaSupportModal}
        onClose={closeIdeaSupportModal}
        onIdeaSelected={handleIdeaSelected}
        showIdleHint={showIdleHint}
        onDismissHint={dismissIdleHint}
      />
    </div>
  );
}
