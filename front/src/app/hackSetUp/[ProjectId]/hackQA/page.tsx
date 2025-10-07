"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight, Terminal, Database, Cpu, Plus, X, Edit2,Trash2 } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import { getProject } from "@/libs/modelAPI/project";
import Header from "@/components/Session/Header";
import { getQAsByProjectId, patchQA, postQA,deleteQA} from "@/libs/modelAPI/qa";
import { QAType } from "@/types/modelTypes";
import Loading from "@/components/PageLoading";
import {generateSummary , saveSummary} from "@/libs/service/summary";
import { useSession } from "next-auth/react";

export default function HackQA() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [idea, setIdea] = useState<string>("");
  const [qas, setQas] = useState<QAType[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingNext, setProcessingNext] = useState(false);
  const [showAddQA, setShowAddQA] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editingQA, setEditingQA] = useState<{id: string, field: 'question' | 'answer', value: string} | null>(null);
  const { darkMode } = useDarkMode();
  const projectId = pathname.split("/")[2];

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) return;

      try {
        setLoading(true);

        // プロジェクトデータの取得
        const projectData = await getProject(projectId);
        setIdea(projectData.idea || "");

        // Q&Aデータの取得
        const qaData = await getQAsByProjectId(projectId);
        console.log("Fetched QAs:", qaData);
        setQas(qaData || []);

        // ログインユーザーをプロジェクトメンバーに自動追加
        if (session?.user?.name) {
          await ensureUserIsProjectMember(projectId, session.user.name);
        }
      } catch (error) {
        console.error("データの取得に失敗:", error);
        setIdea("プロジェクトのアイデアが取得できませんでした");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, session]);

  // ログインユーザーがプロジェクトメンバーに登録されているか確認し、未登録なら追加
  const ensureUserIsProjectMember = async (projectId: string, githubName: string) => {
    try {
      const { getProjectMembersByProjectId, postProjectMember } = await import("@/libs/modelAPI/project_member");
      const { getMemberByGithubName } = await import("@/libs/modelAPI/member");
      const axios = (await import("axios")).default;

      // プロジェクトメンバーを取得
      let projectMembers;
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

    try {
      // APIで更新
      await patchQA(editingQA.id, { [editingQA.field]: editingQA.value });
      
      // ローカルステートを更新
      setQas(qas.map(qa => 
        qa.qa_id === editingQA.id 
          ? { ...qa, [editingQA.field]: editingQA.value }
          : qa
      ));
    } catch (error) {
      console.error("保存に失敗:", error);
      alert("保存に失敗しました");
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
        follows_qa_id: qas.length > 0 ? qas[qas.length - 1].qa_id : null, // 直前のQ&AのIDを設定
      };

      await postQA(newQA);
      
      // 作成されたQ&Aを取得して表示を更新
      const qaData = await getQAsByProjectId(projectId);
      setQas(qaData);
      
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
    // summaryを作成する。
    const summary = await generateSummary(projectId);
    await saveSummary(projectId,summary);
    setProcessingNext(false);
    // summaryQAへ移動

    router.push(`/hackSetUp/${projectId}/summaryQA`);
  };

  const handleDeleteQA = async (qaId: string) => {
    try {
      await deleteQA(qaId);
      
      // ローカルステートを更新
      setQas(qas.filter(qa => qa.qa_id !== qaId));
    }
    catch (error) {
      console.error("Q&Aの削除に失敗:", error);
      alert("Q&Aの削除に失敗しました");
    }
  }
  if (loading) {
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
                className={`mr-2 ${darkMode ? "text-cyan-400" : "text-purple-600"}`}
              />
              <h1
                className={`text-3xl font-bold tracking-wider ${darkMode ? "text-cyan-400" : "text-purple-700"}`}
              >
                プロジェクト
                <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
                  _分析
                </span>
              </h1>
            </div>
            <p
              className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              以下の質問に回答することで、プロダクトの方向性を明確にしましょう
            </p>
          </div>

          <div
            className={`backdrop-blur-lg rounded-xl p-8 shadow-xl border transition-all ${
              darkMode
                ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
            }`}
          >
            
              <>
                {/* プロジェクトのアイデア表示 */}
                <div className="mb-6">
                  <h2
                    className={`text-xl font-medium mb-4 flex items-center ${
                      darkMode ? "text-cyan-400" : "text-purple-700"
                    }`}
                  >
                    <Database
                      size={18}
                      className={`mr-2 ${
                        darkMode ? "text-pink-500" : "text-blue-600"
                      }`}
                    />
                    あなたの作りたいもの：
                  </h2>
                  <p
                    className={`${
                      darkMode
                        ? "bg-gray-700 text-cyan-300"
                        : "bg-purple-100 text-gray-800"
                    } p-4 rounded-lg border-l-4 ${
                      darkMode ? "border-pink-500" : "border-blue-500"
                    }`}
                  >
                    {idea}
                  </p>
                </div>

                {/* Q&Aセクション */}
                <div className="mb-8">
                  <h2
                    className={`text-xl font-medium mb-4 flex items-center ${
                      darkMode ? "text-cyan-400" : "text-purple-700"
                    }`}
                  >
                    <Cpu
                      size={18}
                      className={`mr-2 ${
                        darkMode ? "text-pink-500" : "text-blue-600"
                      }`}
                    />
                    以下の質問に回答してください：
                  </h2>
                  
                  <div className="space-y-4">
                    {qas && qas.length > 0 ? (
                      <>
                        {/* 既存のQ&A */}
                        {qas.map((qa) => (
                          <div
                            key={qa.qa_id}
                            className={`p-5 rounded-lg border transition-all ${
                              darkMode
                                ? "bg-gray-700/40 border-cyan-500/30 hover:border-cyan-500/50"
                                : "bg-purple-50/70 border-purple-300/50 hover:border-purple-400"
                            }`}
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
                                  className={`flex-grow p-2 rounded-lg border transition-all font-semibold text-lg ${
                                    darkMode
                                      ? "bg-gray-800 border-cyan-500/50 text-cyan-300 focus:border-cyan-400"
                                      : "bg-white border-purple-300 text-purple-700 focus:border-purple-500"
                                  } focus:outline-none focus:ring-2 ${
                                    darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                                  }`}
                                />
                              ) : (
                                <h3
                                  onClick={() => !qa.is_ai && handleStartEdit(qa.qa_id, 'question', qa.question)}
                                  className={`font-semibold text-lg group flex items-start flex-grow ${
                                    darkMode ? "text-cyan-300" : "text-purple-700"
                                  } ${!qa.is_ai ? "cursor-pointer hover:opacity-80" : ""}`}
                                >
                                  <span className="flex-grow">Q: {qa.question}</span>
                                  {!qa.is_ai && (
                                    <Edit2
                                      size={16}
                                      className={`ml-2 opacity-0 group-hover:opacity-100 transition-opacity ${
                                        darkMode ? "text-cyan-400" : "text-purple-600"
                                      }`}
                                    />
                                  )}
                                </h3>
                              )}
                              {/* ユーザー作成のQ&Aのみ削除ボタンを表示 */}
                              {!qa.is_ai && (
                                <button
                                  onClick={() => handleDeleteQA(qa.qa_id)}
                                  className={`ml-2 p-1.5 rounded-lg transition-all hover:bg-red-500/20 ${
                                    darkMode ? "text-red-400 hover:text-red-300" : "text-red-500 hover:text-red-600"
                                  }`}
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
                                className={`w-full p-3 rounded-lg border transition-all resize-none ${
                                  darkMode
                                    ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                                    : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                                } focus:outline-none focus:ring-2 ${
                                  darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                                }`}
                                placeholder="回答を入力してください..."
                              />
                            ) : (
                              <div
                                onClick={() => handleStartEdit(qa.qa_id, 'answer', qa.answer || "")}
                                className={`p-3 rounded-lg border cursor-pointer transition-all group ${
                                  darkMode
                                    ? "bg-gray-750/50 border-gray-600 hover:bg-gray-700 hover:border-cyan-500/50"
                                    : "bg-white/50 border-purple-200 hover:bg-purple-50 hover:border-purple-400"
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <p
                                    className={`${
                                      qa.answer
                                        ? darkMode ? "text-gray-200" : "text-gray-700"
                                        : darkMode ? "text-gray-500 italic" : "text-gray-400 italic"
                                    }`}
                                  >
                                    A: {qa.answer || "クリックして回答を入力..."}
                                  </p>
                                  <Edit2
                                    size={16}
                                    className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                                      darkMode ? "text-cyan-400" : "text-purple-600"
                                    }`}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* 新しいQ&A追加セクション */}
                        {showAddQA ? (
                          <div
                            className={`p-5 rounded-lg border-2 border-dashed transition-all ${
                              darkMode
                                ? "bg-gray-700/30 border-cyan-500/50"
                                : "bg-purple-50/50 border-purple-400/50"
                            }`}
                          >
                            <h3
                              className={`text-lg font-semibold mb-4 ${
                                darkMode ? "text-cyan-400" : "text-purple-700"
                              }`}
                            >
                              新しいQ&Aを追加
                            </h3>
                            <div className="space-y-4">
                              <div>
                                <label
                                  className={`block mb-2 text-sm font-medium ${
                                    darkMode ? "text-cyan-300" : "text-purple-600"
                                  }`}
                                >
                                  質問:
                                </label>
                                <input
                                  type="text"
                                  value={newQuestion}
                                  onChange={(e) => setNewQuestion(e.target.value)}
                                  className={`w-full p-3 rounded-lg border transition-all ${
                                    darkMode
                                      ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                                      : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                                  } focus:outline-none focus:ring-2 ${
                                    darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                                  }`}
                                  placeholder="質問を入力してください"
                                />
                              </div>
                              <div>
                                <label
                                  className={`block mb-2 text-sm font-medium ${
                                    darkMode ? "text-cyan-300" : "text-purple-600"
                                  }`}
                                >
                                  回答 (オプション):
                                </label>
                                <textarea
                                  value={newAnswer}
                                  onChange={(e) => setNewAnswer(e.target.value)}
                                  rows={3}
                                  className={`w-full p-3 rounded-lg border transition-all resize-none ${
                                    darkMode
                                      ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                                      : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                                  } focus:outline-none focus:ring-2 ${
                                    darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                                  }`}
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
                                  onClick={handleAddNewQA}
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
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowAddQA(true)}
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
                                新しい質問を追加
                              </span>
                            </div>
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p
                          className={`mb-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                        >
                          まだ質問がありません
                        </p>
                        <button
                          onClick={() => setShowAddQA(true)}
                          className={`px-6 py-3 rounded-lg transition-all ${
                            darkMode
                              ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900"
                              : "bg-purple-500 hover:bg-purple-600 text-white"
                          }`}
                        >
                          <Plus size={18} className="inline mr-2" />
                          最初の質問を追加
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 次へ進むボタン */}
                <div className="flex justify-end">
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
              </>
          </div>

          <HackthonSupportAgent />
        </div>
      </main>
    </>
  );
}