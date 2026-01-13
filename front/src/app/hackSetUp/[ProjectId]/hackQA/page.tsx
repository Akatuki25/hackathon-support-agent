"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ChevronRight, Terminal, Database, Cpu, Plus, X, Edit2, Trash2, Loader2 } from "lucide-react";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import { getProject } from "@/libs/modelAPI/project";
import Header from "@/components/Session/Header";
import { getQAsByProjectId, patchQA, postQA, deleteQA } from "@/libs/modelAPI/qa";
import { QAType, ChatAction } from "@/types/modelTypes";
import Loading from "@/components/PageLoading";
import { useSession } from "next-auth/react";
import { AgentChatWidget } from "@/components/chat";
import {
  streamGenerateQuestions,
  saveQuestions,
  convertStreamingItemsToPayload,
  StreamingQAItem,
} from "@/libs/service/qa";

export default function HackQA() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [processingNext, setProcessingNext] = useState(false);
  const [showAddQA, setShowAddQA] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editingQA, setEditingQA] = useState<{id: string, field: 'question' | 'answer', value: string} | null>(null);
  const projectId = pathname.split("/")[2];

  // ストリーミング関連のstate
  const [streamingQAs, setStreamingQAs] = useState<StreamingQAItem[]>([]);
  const [streamingStatus, setStreamingStatus] = useState<'idle' | 'streaming' | 'saving' | 'done' | 'error'>('idle');
  const streamingStarted = useRef(false);
  const streamingQAsRef = useRef<StreamingQAItem[]>([]);

  // streamingQAsが更新されたらrefも更新
  useEffect(() => {
    streamingQAsRef.current = streamingQAs;
  }, [streamingQAs]);

  // SWR: プロジェクトデータ取得（キャッシュ有効）
  const { data: projectData, error: projectError } = useSWR(
    projectId ? `project-${projectId}` : null,
    () => getProject(projectId),
    { revalidateOnFocus: false }
  );

  // SWR: QAデータ取得（キャッシュ有効）
  const { data: qas, mutate: mutateQAs } = useSWR(
    projectId ? `qas-${projectId}` : null,
    () => getQAsByProjectId(projectId),
    { revalidateOnFocus: false }
  );

  const idea = projectData?.idea || "";
  const title = projectData?.title || "";
  const startDate = projectData?.start_date || "";
  const endDate = projectData?.end_date || "";
  const loading = !projectData && !projectError;

  // 新規プロジェクトの場合はストリーミングで質問を生成
  useEffect(() => {
    const isNew = searchParams.get('new') === 'true';

    if (isNew && projectId && projectData && !streamingStarted.current) {
      streamingStarted.current = true;
      startStreamingGeneration();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, projectId, projectData]);

  // ストリーミング生成を開始
  const startStreamingGeneration = async () => {
    setStreamingStatus('streaming');
    setStreamingQAs([]);
    streamingQAsRef.current = [];

    const questionData = `プロジェクトタイトル: ${title}\nプロジェクトアイディア: ${idea}\n期間: ${startDate} 〜 ${endDate}`;

    try {
      await streamGenerateQuestions(
        projectId,
        questionData,
        {
          onStart: () => {
            console.log('Streaming started');
          },
          onQA: (item) => {
            // 質問が1件届くたびにUIを更新
            setStreamingQAs((prev) => [...prev, item]);
          },
          onDone: async (data) => {
            console.log(`Streaming done: ${data.count} questions`);

            // 少し待ってから保存（stateの更新が反映されるのを待つ）
            await new Promise(resolve => setTimeout(resolve, 100));

            // 質問を保存（ユーザーが編集した内容を含むrefの最新値を使用）
            setStreamingStatus('saving');

            try {
              const payload = convertStreamingItemsToPayload(streamingQAsRef.current);
              await saveQuestions(payload, projectId);

              setStreamingStatus('done');

              // SWRを再検証してDBから最新データを取得
              mutateQAs();

              // URLからnewパラメータを削除（ブラウザバックで再生成されないように）
              router.replace(pathname);
            } catch (error) {
              console.error('Save error:', error);
              setStreamingStatus('error');
            }
          },
          onError: (error) => {
            console.error('Streaming error:', error);
            setStreamingStatus('error');
          },
        }
      );
    } catch (error) {
      console.error('Streaming error:', error);
      setStreamingStatus('error');
    }
  };

  // ログインユーザーをプロジェクトメンバーに自動追加（初回のみ）
  useEffect(() => {
    if (projectId && session?.user?.name) {
      ensureUserIsProjectMember(projectId, session.user.name);
    }
  }, [projectId, session?.user?.name]);

  // ログインユーザーがプロジェクトメンバーに登録されているか確認し、未登録なら追加
  const ensureUserIsProjectMember = async (projectId: string, githubName: string) => {
    try {
      const { getProjectMembersByProjectId, postProjectMember } = await import("@/libs/modelAPI/project_member");
      const { getMemberByGithubName } = await import("@/libs/modelAPI/member");
      const axios = (await import("axios")).default;

      // プロジェクトメンバーを取得
      let projectMembers: { member_id: string }[] = [];
      try {
        projectMembers = await getProjectMembersByProjectId(projectId);
      } catch (error) {
        // 404エラーの場合は空配列（メンバーがいない）
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          projectMembers = [];
        } else {
          throw error;
        }
      }

      // ログインユーザーのメンバー情報を取得
      const currentMember = await getMemberByGithubName(githubName);

      // 既にメンバーに含まれているかチェック
      const isAlreadyMember = projectMembers.some(
        (pm) => pm.member_id === currentMember.member_id
      );

      if (!isAlreadyMember) {
        // プロジェクトメンバーに追加
        await postProjectMember({
          project_id: projectId,
          member_id: currentMember.member_id,
          member_name: currentMember.member_name,
        });
        console.log(`ユーザー ${githubName} をプロジェクトメンバーに追加しました`);
      }
    } catch (error) {
      console.error("プロジェクトメンバー追加エラー:", error);
      // エラーが発生しても処理は継続
    }
  };

  // 編集開始
  const handleStartEdit = (qaId: string, field: 'question' | 'answer', currentValue: string) => {
    setEditingQA({ id: qaId, field, value: currentValue || "" });
  };

  // 編集内容の更新
  const handleEditChange = (value: string) => {
    if (editingQA) {
      setEditingQA({ ...editingQA, value });
    }
  };

  // 編集終了時に自動保存
  const handleEndEdit = async () => {
    if (!editingQA) return;

    // ストリーミング中はローカルステートのみ更新（まだDBに保存されていないため）
    if (streamingStatus === 'streaming' || streamingStatus === 'saving') {
      const updatedQAs = streamingQAs.map((qa) =>
        qa.qa_id === editingQA.id
          ? { ...qa, [editingQA.field]: editingQA.value }
          : qa
      );
      setStreamingQAs(updatedQAs);
      streamingQAsRef.current = updatedQAs; // refも更新
      setEditingQA(null);
      return;
    }

    try {
      // APIで更新
      await patchQA(editingQA.id, { [editingQA.field]: editingQA.value });

      // 楽観的更新：ローカルキャッシュを即時更新
      mutateQAs(
        (currentQAs) => currentQAs?.map(qa =>
          qa.qa_id === editingQA.id
            ? { ...qa, [editingQA.field]: editingQA.value }
            : qa
        ),
        { revalidate: false }
      );
    } catch (error) {
      console.error("保存に失敗:", error);
      alert("保存に失敗しました");
      // エラー時は再取得
      mutateQAs();
    } finally {
      setEditingQA(null);
    }
  };

  // 新しいQ&Aを追加
  const handleAddNewQA = async () => {
    if (!newQuestion.trim()) {
      alert("質問を入力してください");
      return;
    }

    try {
      const newQA: Omit<QAType, 'qa_id' | 'created_at'> = {
        project_id: projectId,
        question: newQuestion.trim(),
        answer: newAnswer.trim() || null,
        is_ai: false,
        importance: 1,
        source_doc_id: null,
        follows_qa_id: qas && qas.length > 0 ? qas[qas.length - 1].qa_id : null,
      };

      await postQA(newQA);
      
      // SWRキャッシュを再検証して最新データを取得
      mutateQAs();
      
      setNewQuestion("");
      setNewAnswer("");
      setShowAddQA(false);
    } catch (error) {
      console.error("Q&Aの追加に失敗:", error);
      alert("Q&Aの追加に失敗しました");
    }
  };

  // 次へ進む
  const handleNext = async () => {
    setProcessingNext(true);
    
    // 編集中のものがあれば保存
    if (editingQA) {
      await handleEndEdit();
    }
    
    // すぐにsummaryQAへ移動（生成処理はsummaryQA側で行う）
    router.push(`/hackSetUp/${projectId}/summaryQA`);
  };

  const handleDeleteQA = async (qaId: string) => {
    try {
      await deleteQA(qaId);
      
      // 楽観的更新：ローカルキャッシュから即時削除
      mutateQAs(
        (currentQAs) => currentQAs?.filter(qa => qa.qa_id !== qaId),
        { revalidate: false }
      );
    }
    catch (error) {
      console.error("Q&Aの削除に失敗:", error);
      alert("Q&Aの削除に失敗しました");
      // エラー時は再取得
      mutateQAs();
    }
  }
  // ストリーミング中のQAをQAType形式に変換（編集可能にするため）
  const streamingQAsAsQAType: QAType[] = streamingQAs.map((item) => ({
    qa_id: item.qa_id,
    question: item.question,
    answer: item.answer,
    importance: item.importance,
    is_ai: item.is_ai,
    source_doc_id: item.source_doc_id || undefined,
    project_id: item.project_id,
    follows_qa_id: item.follows_qa_id || undefined,
  }));

  // 表示するQAリスト
  // ストリーミング中、または保存完了直後（SWRがまだ再フェッチ中）はストリーミングデータを表示
  // SWRのデータが揃ったら切り替え（点滅防止）
  const shouldShowStreamingData =
    streamingStatus === 'streaming' ||
    streamingStatus === 'saving' ||
    (streamingStatus === 'done' && streamingQAs.length > 0 && (!qas || qas.length === 0));

  const displayQAs = shouldShowStreamingData
    ? streamingQAsAsQAType
    : qas || [];

  // 新規プロジェクト遷移時はローディング画面を表示せず、レイアウトを維持
  const isNewProjectFlow = searchParams.get('new') === 'true';

  if (loading && !isNewProjectFlow) {
    return <Loading />;
  }

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      <main className="relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4 mt-5">
              <Terminal
                className="mr-2 text-purple-600 dark:text-cyan-400"
              />
              <h1
                className="text-3xl font-bold tracking-wider text-purple-700 dark:text-cyan-400"
              >
                プロジェクト
                <span className="text-blue-600 dark:text-pink-500">
                  _分析
                </span>
              </h1>
            </div>
            <p
              className="text-lg text-gray-700 dark:text-gray-300"
            >
              以下の質問に回答することで、プロダクトの方向性を明確にしましょう
            </p>
          </div>

          <div
            className="backdrop-blur-lg rounded-xl p-8 shadow-xl border transition-all bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20 dark:bg-gray-800 dark:bg-opacity-70 dark:border-cyan-500/30 dark:shadow-cyan-500/20"
          >
            
              <>
                {/* プロジェクトのアイデア表示 */}
                <div className="mb-6">
                  <h2
                    className="text-xl font-medium mb-4 flex items-center text-purple-700 dark:text-cyan-400"
                  >
                    <Database
                      size={18}
                      className="mr-2 text-blue-600 dark:text-pink-500"
                    />
                    あなたの作りたいもの：
                  </h2>
                  {idea ? (
                    <p
                      className="bg-purple-100 text-gray-800 dark:bg-gray-700 dark:text-cyan-300 p-4 rounded-lg border-l-4 border-blue-500 dark:border-pink-500"
                    >
                      {idea}
                    </p>
                  ) : (
                    <div
                      className="p-4 rounded-lg border-l-4 animate-pulse bg-purple-100 border-blue-500 dark:bg-gray-700 dark:border-pink-500"
                    >
                      <div className="h-4 rounded w-full mb-2 bg-purple-200 dark:bg-gray-600" />
                      <div className="h-4 rounded w-2/3 bg-purple-200 dark:bg-gray-600" />
                    </div>
                  )}
                </div>

                {/* Q&Aセクション */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2
                      className="text-xl font-medium flex items-center text-purple-700 dark:text-cyan-400"
                    >
                      <Cpu
                        size={18}
                        className="mr-2 text-blue-600 dark:text-pink-500"
                      />
                      以下の質問に回答してください：
                    </h2>
                    {/* ストリーミングステータス表示 */}
                    {(streamingStatus === 'streaming' || streamingStatus === 'saving') && (
                      <div className="flex items-center text-sm text-purple-600 dark:text-cyan-300">
                        <Loader2 size={16} className="animate-spin mr-2" />
                        <span>
                          {streamingStatus === 'streaming' && `質問を生成中... (${displayQAs.length}件)`}
                          {streamingStatus === 'saving' && '保存中...'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {displayQAs.length > 0 ? (
                      <>
                        {/* Q&Aリスト */}
                        {displayQAs.map((qa) => (
                          <div
                            key={qa.qa_id}
                            className="p-5 rounded-lg border transition-all animate-fadeIn bg-purple-50/70 border-purple-300/50 hover:border-purple-400 dark:bg-gray-700/40 dark:border-cyan-500/30 dark:hover:border-cyan-500/50"
                          >
                            {/* 質問と削除ボタン */}
                            <div className="mb-3 flex items-start justify-between">
                              {editingQA?.id === qa.qa_id && editingQA.field === 'question' ? (
                                <input
                                  type="text"
                                  value={editingQA.value}
                                  onChange={(e) => handleEditChange(e.target.value)}
                                  onBlur={handleEndEdit}
                                  autoFocus
                                  className="flex-grow p-2 rounded-lg border transition-all font-semibold text-lg bg-white border-purple-300 text-purple-700 focus:border-purple-500 dark:bg-gray-800 dark:border-cyan-500/50 dark:text-cyan-300 dark:focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-cyan-500/20"
                                />
                              ) : (
                                <h3
                                  onClick={() => !qa.is_ai && handleStartEdit(qa.qa_id, 'question', qa.question)}
                                  className={`font-semibold text-lg group flex items-start flex-grow text-purple-700 dark:text-cyan-300 ${!qa.is_ai ? "cursor-pointer hover:opacity-80" : ""}`}
                                >
                                  <span className="flex-grow">Q: {qa.question}</span>
                                  {!qa.is_ai && (
                                    <Edit2
                                      size={16}
                                      className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-purple-600 dark:text-cyan-400"
                                    />
                                  )}
                                </h3>
                              )}
                              {/* ユーザー作成のQ&Aのみ削除ボタンを表示 */}
                              {!qa.is_ai && (
                                <button
                                  onClick={() => handleDeleteQA(qa.qa_id)}
                                  className="ml-2 p-1.5 rounded-lg transition-all hover:bg-red-500/20 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                  title="削除"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>

                            {/* 回答 */}
                            {editingQA?.id === qa.qa_id && editingQA.field === 'answer' ? (
                              <textarea
                                value={editingQA.value}
                                onChange={(e) => handleEditChange(e.target.value)}
                                onBlur={handleEndEdit}
                                autoFocus
                                rows={4}
                                className="w-full p-3 rounded-lg border transition-all resize-none bg-white border-purple-300 text-gray-800 focus:border-purple-500 dark:bg-gray-800 dark:border-cyan-500/50 dark:text-cyan-100 dark:focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-cyan-500/20"
                                placeholder="回答を入力してください..."
                              />
                            ) : (
                              <div
                                onClick={() => handleStartEdit(qa.qa_id, 'answer', qa.answer || "")}
                                className="p-3 rounded-lg border cursor-pointer transition-all group bg-white/50 border-purple-200 hover:bg-purple-50 hover:border-purple-400 dark:bg-gray-750/50 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-cyan-500/50"
                              >
                                <div className="flex items-start justify-between">
                                  <p
                                    className={qa.answer
                                      ? "text-gray-700 dark:text-gray-200"
                                      : "text-gray-400 italic dark:text-gray-500"
                                    }
                                  >
                                    A: {qa.answer || "クリックして回答を入力..."}
                                  </p>
                                  <Edit2
                                    size={16}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-600 dark:text-cyan-400"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* 新しいQ&A追加セクション */}
                        {/* ストリーミング中は新規追加を非表示 */}
                        {(streamingStatus === 'streaming' || streamingStatus === 'saving') ? null : showAddQA ? (
                          <div
                            className="p-5 rounded-lg border-2 border-dashed transition-all bg-purple-50/50 border-purple-400/50 dark:bg-gray-700/30 dark:border-cyan-500/50"
                          >
                            <h3
                              className="text-lg font-semibold mb-4 text-purple-700 dark:text-cyan-400"
                            >
                              新しいQ&Aを追加
                            </h3>
                            <div className="space-y-4">
                              <div>
                                <label
                                  className="block mb-2 text-sm font-medium text-purple-600 dark:text-cyan-300"
                                >
                                  質問:
                                </label>
                                <input
                                  type="text"
                                  value={newQuestion}
                                  onChange={(e) => setNewQuestion(e.target.value)}
                                  className="w-full p-3 rounded-lg border transition-all bg-white border-purple-300 text-gray-800 focus:border-purple-500 dark:bg-gray-800 dark:border-cyan-500/50 dark:text-cyan-100 dark:focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-cyan-500/20"
                                  placeholder="質問を入力してください"
                                />
                              </div>
                              <div>
                                <label
                                  className="block mb-2 text-sm font-medium text-purple-600 dark:text-cyan-300"
                                >
                                  回答 (オプション):
                                </label>
                                <textarea
                                  value={newAnswer}
                                  onChange={(e) => setNewAnswer(e.target.value)}
                                  rows={3}
                                  className="w-full p-3 rounded-lg border transition-all resize-none bg-white border-purple-300 text-gray-800 focus:border-purple-500 dark:bg-gray-800 dark:border-cyan-500/50 dark:text-cyan-100 dark:focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-cyan-500/20"
                                  placeholder="回答を入力してください（後で入力することもできます）"
                                />
                              </div>
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setShowAddQA(false);
                                    setNewQuestion("");
                                    setNewAnswer("");
                                  }}
                                  className="px-4 py-2 rounded-lg transition-all bg-gray-300 hover:bg-gray-400 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
                                >
                                  <X size={16} className="inline mr-1" />
                                  キャンセル
                                </button>
                                <button
                                  onClick={handleAddNewQA}
                                  className="px-4 py-2 rounded-lg transition-all bg-purple-500 hover:bg-purple-600 text-white dark:bg-cyan-500 dark:hover:bg-cyan-600 dark:text-gray-900"
                                >
                                  <Plus size={16} className="inline mr-1" />
                                  追加
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowAddQA(true)}
                            className="w-full p-4 rounded-lg border-2 border-dashed transition-all group border-purple-300/50 hover:border-purple-400 hover:bg-purple-50/30 dark:border-cyan-500/30 dark:hover:border-cyan-500/50 dark:hover:bg-gray-700/30"
                          >
                            <div className="flex items-center justify-center">
                              <Plus
                                size={20}
                                className="mr-2 text-purple-600 dark:text-cyan-400"
                              />
                              <span
                                className="font-medium text-purple-600 dark:text-cyan-400"
                              >
                                新しい質問を追加
                              </span>
                            </div>
                          </button>
                        )}
                      </>
                    ) : (
                      // 新規プロジェクトで生成待ち中はスケルトン表示
                      isNewProjectFlow || streamingStatus === 'streaming' ? (
                        <div className="space-y-4">
                          {/* スケルトンプレースホルダー */}
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="p-5 rounded-lg border animate-pulse bg-purple-50/50 border-purple-300/30 dark:bg-gray-700/40 dark:border-cyan-500/20"
                            >
                              <div className="h-5 rounded w-3/4 mb-4 bg-purple-200 dark:bg-gray-600" />
                              <div className="h-16 rounded w-full bg-purple-100 dark:bg-gray-600/50" />
                            </div>
                          ))}
                          <div className="text-center pt-2">
                            <div className="flex items-center justify-center text-sm text-purple-600 dark:text-cyan-300">
                              <Loader2 size={16} className="animate-spin mr-2" />
                              <span>質問を生成中...</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p
                            className="mb-4 text-gray-600 dark:text-gray-400"
                          >
                            まだ質問がありません
                          </p>
                          <button
                            onClick={() => setShowAddQA(true)}
                            className="px-6 py-3 rounded-lg transition-all bg-purple-500 hover:bg-purple-600 text-white dark:bg-cyan-500 dark:hover:bg-cyan-600 dark:text-gray-900"
                          >
                            <Plus size={18} className="inline mr-2" />
                            最初の質問を追加
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* 次へ進むボタン */}
                <div className="flex justify-end">
                  <button
                    onClick={handleNext}
                    className="px-8 py-3 flex items-center rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400 disabled:from-gray-400 disabled:to-gray-500 dark:bg-cyan-500 dark:hover:bg-cyan-600 dark:text-gray-900 dark:focus:ring-cyan-400 dark:from-cyan-500 dark:to-cyan-500 dark:hover:from-cyan-600 dark:hover:to-cyan-600 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
                    disabled={processingNext || streamingStatus === 'streaming' || streamingStatus === 'saving'}
                  >
                    {processingNext ? (
                      <div className="flex items-center">
                        <div
                          className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white dark:border-gray-900 mr-2"
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
              </>
          </div>

          <HackthonSupportAgent />
        </div>
      </main>

      {/* AI Chat Widget */}
      <AgentChatWidget
        projectId={projectId}
        pageContext="hackQA"
        pageSpecificContext={{
          qas: qas || [],
          idea: idea,
        }}
        onAction={async (action: ChatAction) => {
          if (action.action_type === 'add_question') {
            const payload = action.payload as { question?: string };
            if (payload.question) {
              await postQA({
                project_id: projectId,
                question: payload.question,
                answer: null,
                is_ai: false,
                importance: 0,
              });
              // SWRキャッシュを再検証
              mutateQAs();
            }
          }
        }}
      />
    </>
  );
}