"use client";

import { useState, useRef, useEffect } from "react";
import { AlertTriangle, CheckCircle, Loader2, Plus, X, Trash2, Edit2 } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { QAType } from "@/types/modelTypes";
import { patchQA, postQA, deleteQA, getQAsByProjectId } from "@/libs/modelAPI/qa";
import axios from "axios";

interface QASectionProps {
  projectId: string;
  questions: QAType[];
  onQuestionsUpdate: (questions: QAType[]) => void;
}

export default function QASection({
  projectId,
  questions,
  onQuestionsUpdate
}: QASectionProps) {
  const { darkMode } = useDarkMode();
  const [savingQA, setSavingQA] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddQA, setShowAddQA] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editingQA, setEditingQA] = useState<{id: string, field: 'question' | 'answer', value: string} | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // textareaの自動高さ調整
  const autoResizeTextarea = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  };

  // QA保存
  const saveQA = async (updatedQA: QAType[]) => {
    if (!projectId) return;
    setSavingQA(true);
    setSaveSuccess(false);
    try {
      // 順次処理
      for (const qa of updatedQA) {
        await patchQA(qa.qa_id, {
          answer: qa.answer,
        });
      }
      onQuestionsUpdate(updatedQA);
      setSaveSuccess(true);
      // 3秒後にチェックマークを非表示
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Q&Aの保存に失敗:", error);
      alert("Q&Aの保存に失敗しました");
    } finally {
      setSavingQA(false);
    }
  };

  // 編集開始
  const handleStartEdit = (id: string, field: 'question' | 'answer', currentValue: string) => {
    setEditingQA({ id, field, value: currentValue });
  };

  // 編集終了・保存
  const handleEndEdit = async () => {
    if (!editingQA) return;

    try {
      await patchQA(editingQA.id, {
        [editingQA.field]: editingQA.value,
      });

      // ローカルステートを更新
      const updatedQuestions = questions.map(qa =>
        qa.qa_id === editingQA.id
          ? { ...qa, [editingQA.field]: editingQA.value }
          : qa
      );
      onQuestionsUpdate(updatedQuestions);
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

    console.log("[QA追加] 開始 - プロジェクトID:", projectId);
    console.log("[QA追加] 現在のQA数:", questions.length);

    setIsAdding(true);
    setAddSuccess(false);

    try {
      const newQA: Omit<QAType, 'qa_id' | 'created_at'> = {
        project_id: projectId,
        question: newQuestion.trim(),
        answer: newAnswer.trim() || null,
        is_ai: false,
        importance: 1,
        source_doc_id: null,
        follows_qa_id: questions.length > 0 ? questions[questions.length - 1].qa_id : null,
      };

      console.log("[QA追加] 送信データ:", newQA);

      const newQaId = await postQA(newQA);
      console.log("[QA追加] 作成成功 - 新しいQA ID:", newQaId);

      if (!newQaId) {
        throw new Error("QAの作成に失敗しました（IDが返されませんでした）");
      }

      // 最新のQ&Aリストを直接取得（改善版）
      console.log("[QA追加] getQAsByProjectId呼び出し中...");
      const updatedQAs = await getQAsByProjectId(projectId);
      console.log("[QA追加] 取得されたQA数:", updatedQAs?.length || 0);

      if (!updatedQAs || updatedQAs.length === 0) {
        console.warn("[QA追加] 警告: QAリストが空です");
        // 空でも更新は続行（初回追加の可能性）
      }

      onQuestionsUpdate(updatedQAs);

      // 成功フィードバック
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 2000);

      setNewQuestion("");
      setNewAnswer("");
      setShowAddQA(false);
      console.log("[QA追加] 完了");
    } catch (error) {
      console.error("[QA追加] エラー詳細:", error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        console.error(`[QA追加] HTTPエラー (${status}):`, message);
        alert(`Q&Aの追加に失敗しました (${status}): ${message}`);
      } else if (error instanceof Error) {
        console.error("[QA追加] エラーメッセージ:", error.message);
        console.error("[QA追加] スタックトレース:", error.stack);
        alert(`Q&Aの追加に失敗しました: ${error.message}`);
      } else {
        console.error("[QA追加] 不明なエラー:", error);
        alert("Q&Aの追加に失敗しました: 不明なエラー");
      }
    } finally {
      setIsAdding(false);
    }
  };

  // Q&Aを削除
  const handleDeleteQA = async (qaId: string) => {
    try {
      await deleteQA(qaId);

      // ローカルステートを更新
      const updatedQuestions = questions.filter(qa => qa.qa_id !== qaId);
      onQuestionsUpdate(updatedQuestions);
    } catch (error) {
      console.error("Q&Aの削除に失敗:", error);
      alert("Q&Aの削除に失敗しました");
    }
  };

  return (
    <div
      className={`h-full backdrop-blur-lg rounded-xl p-4 shadow-xl border transition-all flex flex-col ${
        darkMode
          ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
          : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h2
          className={`text-lg font-medium flex items-center ${
            darkMode ? "text-cyan-400" : "text-purple-700"
          }`}
        >
          <AlertTriangle size={18} className="mr-2" />
          追加質問
        </h2>
        <div className="flex items-center space-x-2">
          {/* 保存状態インジケーター */}
          {savingQA && (
            <Loader2
              size={14}
              className={`animate-spin ${darkMode ? "text-cyan-400" : "text-purple-600"}`}
            />
          )}
          {saveSuccess && (
            <CheckCircle
              size={14}
              className="text-green-500 animate-pulse"
            />
          )}
          <div className={`px-2 py-1 rounded text-xs ${
            darkMode ? "bg-cyan-900/50 text-cyan-400" : "bg-purple-100 text-purple-700"
          }`}>
            {questions.length}件
          </div>
          <button
            onClick={() => setShowAddQA(true)}
            className={`p-1.5 rounded-lg hover:scale-105 transition-all ${
              darkMode
                ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                : "bg-purple-500 hover:bg-purple-600 text-white"
            }`}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        {/* 新しいQ&A追加フォーム */}
        {showAddQA && (
          <div className={`p-4 rounded-lg border-2 border-dashed ${
            darkMode
              ? "border-cyan-500/50 bg-gray-700/20"
              : "border-purple-300/50 bg-purple-50/30"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-medium ${
                darkMode ? "text-cyan-300" : "text-purple-600"
              }`}>
                新しい質問を追加
              </h3>
              <button
                onClick={() => setShowAddQA(false)}
                className={`p-1 rounded-full hover:scale-110 transition-all ${
                  darkMode
                    ? "text-gray-400 hover:text-gray-300"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? "text-cyan-300" : "text-purple-600"
                }`}>
                  質問
                </label>
                <textarea
                  value={newQuestion}
                  onChange={(e) => {
                    setNewQuestion(e.target.value);
                    autoResizeTextarea(e.target);
                  }}
                  onFocus={(e) => autoResizeTextarea(e.target)}
                  className={`w-full p-3 rounded-lg border transition-all resize-none ${
                    darkMode
                      ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                      : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                  } focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                  }`}
                  style={{ minHeight: '50px' }}
                  placeholder="質問を入力してください..."
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  darkMode ? "text-cyan-300" : "text-purple-600"
                }`}>
                  回答（任意）
                </label>
                <textarea
                  value={newAnswer}
                  onChange={(e) => {
                    setNewAnswer(e.target.value);
                    autoResizeTextarea(e.target);
                  }}
                  onFocus={(e) => autoResizeTextarea(e.target)}
                  className={`w-full p-2 text-sm rounded-lg border transition-all resize-none ${
                    darkMode
                      ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                      : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                  } focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                  }`}
                  style={{ minHeight: '60px' }}
                  placeholder="回答を入力してください..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowAddQA(false)}
                  disabled={isAdding}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    isAdding ? "opacity-50 cursor-not-allowed" : ""
                  } ${
                    darkMode
                      ? "border-gray-600 text-gray-400 hover:text-gray-300"
                      : "border-gray-300 text-gray-600 hover:text-gray-700"
                  }`}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddNewQA}
                  disabled={isAdding}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center ${
                    isAdding ? "opacity-70 cursor-not-allowed" : ""
                  } ${
                    addSuccess
                      ? "bg-green-600 text-white"
                      : darkMode
                      ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                      : "bg-purple-500 hover:bg-purple-600 text-white"
                  }`}
                >
                  {isAdding ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      追加中...
                    </>
                  ) : addSuccess ? (
                    <>
                      <CheckCircle size={16} className="mr-2" />
                      追加完了
                    </>
                  ) : (
                    "追加"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {questions.length > 0 ? (
          questions.map((qa, index) => (
            <div key={qa.qa_id} className={`p-3 rounded-lg border ${
              darkMode
                ? "bg-gray-700/40 border-cyan-500/30"
                : "bg-purple-50/70 border-purple-300/50"
            }`}>
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  {editingQA?.id === qa.qa_id && editingQA.field === 'question' ? (
                    <textarea
                      value={editingQA.value}
                      onChange={(e) => {
                        setEditingQA({...editingQA, value: e.target.value});
                        autoResizeTextarea(e.target);
                      }}
                      onBlur={handleEndEdit}
                      onFocus={(e) => autoResizeTextarea(e.target)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleEndEdit();
                        }
                      }}
                      className={`w-full p-2 rounded border text-sm font-medium resize-none ${
                        darkMode
                          ? "bg-gray-800 border-cyan-500/50 text-cyan-300"
                          : "bg-white border-purple-300 text-purple-600"
                      } focus:outline-none`}
                      style={{ minHeight: '40px' }}
                      autoFocus
                    />
                  ) : (
                    <label
                      className={`block text-sm font-medium cursor-pointer hover:bg-opacity-20 p-1 rounded ${
                        darkMode ? "text-cyan-300 hover:bg-cyan-500" : "text-purple-600 hover:bg-purple-500"
                      }`}
                      onClick={() => handleStartEdit(qa.qa_id, 'question', qa.question)}
                    >
                      Q{index + 1}: {qa.question}
                      <Edit2 size={12} className="inline ml-1 opacity-50" />
                    </label>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteQA(qa.qa_id)}
                  className={`ml-2 p-1 rounded-full hover:scale-110 transition-all ${
                    darkMode
                      ? "text-red-400 hover:text-red-300"
                      : "text-red-500 hover:text-red-700"
                  }`}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {editingQA?.id === qa.qa_id && editingQA.field === 'answer' ? (
                <textarea
                  value={editingQA.value}
                  onChange={(e) => {
                    setEditingQA({...editingQA, value: e.target.value});
                    autoResizeTextarea(e.target);
                  }}
                  onBlur={handleEndEdit}
                  onFocus={(e) => autoResizeTextarea(e.target)}
                  className={`w-full p-2 text-sm rounded-lg border transition-all resize-none ${
                    darkMode
                      ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                      : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                  } focus:outline-none focus:ring-2 ${
                    darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                  }`}
                  style={{ minHeight: '60px' }}
                  autoFocus
                />
              ) : (
                <div
                  onClick={() => handleStartEdit(qa.qa_id, 'answer', qa.answer || '')}
                  className={`w-full p-2 text-sm rounded-lg border transition-all resize-none cursor-pointer hover:bg-opacity-50 ${
                    darkMode
                      ? "bg-gray-800 border-cyan-500/50 text-cyan-100 hover:bg-cyan-500"
                      : "bg-white border-purple-300 text-gray-800 hover:bg-purple-500"
                  } min-h-[60px] flex items-center`}
                >
                  {qa.answer || (
                    <span className={darkMode ? "text-gray-500" : "text-gray-400"}>
                      回答を入力してください...
                      <Edit2 size={12} className="inline ml-2 opacity-50" />
                    </span>
                  )}
                  {qa.answer && <Edit2 size={12} className="ml-auto opacity-50" />}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className={`p-6 text-center ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            <CheckCircle className="mx-auto mb-2" size={32} />
            <p>追加質問はありません</p>
          </div>
        )}
      </div>

      {questions.length > 0 && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => saveQA(questions)}
            disabled={savingQA}
            className={`px-4 py-1.5 text-sm flex items-center rounded-lg shadow focus:outline-none transform transition ${
              savingQA || saveSuccess
                ? "cursor-not-allowed"
                : "hover:-translate-y-0.5"
            } ${
              saveSuccess
                ? darkMode
                  ? "bg-green-700 text-white"
                  : "bg-green-600 text-white"
                : darkMode
                  ? "bg-green-600 hover:bg-green-700 text-white focus:ring-2 focus:ring-green-400"
                  : "bg-green-500 hover:bg-green-600 text-white focus:ring-2 focus:ring-green-400"
            } ${
              savingQA && (darkMode ? "bg-green-700 opacity-70" : "bg-green-600 opacity-70")
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircle size={14} className="mr-1 text-white" />
                保存完了
              </>
            ) : savingQA ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <CheckCircle size={14} className="mr-1" />
                回答を保存
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}