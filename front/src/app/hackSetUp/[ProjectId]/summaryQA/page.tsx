"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, Loader2, MessageSquare, FileText } from "lucide-react";
import useSWR from "swr";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import SpecificationEditor from "@/components/SpecificationEditor/SpecificationEditor";
import QASection from "@/components/QASection/QASection";
import { getProjectDocument } from "@/libs/modelAPI/document";
import { ProjectDocumentType, QAType, ChatAction } from "@/types/modelTypes";
import { evaluateSummary, generateSummaryWithFeedback } from "@/libs/service/summary";
import { AgentChatWidget } from "@/components/chat";

type FocusMode = 'questions' | 'specification';

export default function SummaryQA() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[2];
  const { darkMode } = useDarkMode();

  const [processingNext, setProcessingNext] = useState(false);
  // 追加質問がある場合は質問フォーカス、なければ仕様書フォーカス
  const [focusMode, setFocusMode] = useState<FocusMode>('questions');

  // SWRでプロジェクトドキュメント取得（なければ生成）
  const { data: projectDocument, mutate: mutateDocument, isLoading: isDocLoading } = useSWR(
    projectId ? `document-${projectId}` : null,
    async () => {
      try {
        const doc = await getProjectDocument(projectId);
        // specificationがあればそのまま返す
        if (doc?.specification) {
          return doc;
        }
      } catch {
        // ドキュメントがない場合は生成
      }
      // 仕様書を生成
      await generateSummaryWithFeedback(projectId);
      // 生成後にドキュメントを再取得
      return await getProjectDocument(projectId);
    },
    { revalidateOnFocus: false }
  );

  // SWRで評価データ取得（ドキュメントがあれば）
  const { data: evaluation, mutate: mutateEvaluation, isLoading: isEvalLoading } = useSWR(
    projectDocument?.specification ? `evaluation-${projectId}` : null,
    async () => {
      const result = await evaluateSummary(projectId);
      // 追加質問がなければ仕様書フォーカスに
      if (!result.qa || result.qa.length === 0) {
        setFocusMode('specification');
      }
      return result;
    },
    { revalidateOnFocus: false }
  );

  const isLoading = isDocLoading || isEvalLoading;

  // 評価データから各値を取得
  const question = evaluation?.qa || [];
  const score = evaluation?.score_0_100 || 0;
  const mvpFeasible = evaluation?.mvp_feasible || false;


  // 次へ進む
  const handleNext = async () => {
    setProcessingNext(true);
    // TODO: 次のページへの遷移（モック）
    setTimeout(() => {
      router.push(`/hackSetUp/${projectId}/functionSummary`);
    }, 1000);
  };

  // 評価更新のハンドラー
  const handleEvaluationUpdate = (newEvaluation: { qa: QAType[]; score_0_100: number; mvp_feasible: boolean }) => {
    mutateEvaluation({
      confidence: evaluation?.confidence ?? 0,
      ...evaluation,
      ...newEvaluation
    }, false);
  };

  // ドキュメント更新のハンドラー
  const handleDocumentUpdate = async (document: ProjectDocumentType) => {
    mutateDocument(document, false);
  };

  // 質問更新のハンドラー
  const handleQuestionsUpdate = (updatedQuestions: QAType[]) => {
    if (evaluation) {
      mutateEvaluation({ ...evaluation, qa: updatedQuestions }, false);
    }
  };

  // AIチャットアクションのハンドラー
  const handleChatAction = async (action: ChatAction) => {
    if (action.action_type === 'regenerate_questions') {
      // 追加質問を再生成（SWRでrevalidate）
      const newEvaluation = await evaluateSummary(projectId);
      mutateEvaluation(newEvaluation, false);

      // 新しい追加質問があればフォーカスを切り替え
      if (newEvaluation.qa && newEvaluation.qa.length > 0) {
        setFocusMode('questions');
      }
    }
  };

  // ローディング状態の処理
  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-8">
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
                  _仕様書編集
                </span>
              </h1>
            </div>
            <p
              className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              {focusMode === 'questions'
                ? '追加質問に回答すると、仕様書がより具体的になります'
                : '仕様書を確認・編集してください'}
            </p>
          </div>

          {/* フォーカス切り替えタブ */}
          <div className="flex justify-center mb-6">
            <div className={`inline-flex rounded-lg p-1 ${
              darkMode ? "bg-gray-800" : "bg-gray-100"
            }`}>
              <button
                onClick={() => setFocusMode('specification')}
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  focusMode === 'specification'
                    ? darkMode
                      ? "bg-cyan-600 text-white"
                      : "bg-purple-600 text-white"
                    : darkMode
                      ? "text-gray-400 hover:text-gray-200"
                      : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <FileText size={18} className="mr-2" />
                仕様書
              </button>
              <button
                onClick={() => question.length > 0 && setFocusMode('questions')}
                disabled={question.length === 0}
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  question.length === 0
                    ? darkMode
                      ? "text-gray-600 cursor-not-allowed"
                      : "text-gray-400 cursor-not-allowed"
                    : focusMode === 'questions'
                      ? darkMode
                        ? "bg-cyan-600 text-white"
                        : "bg-purple-600 text-white"
                      : darkMode
                        ? "text-gray-400 hover:text-gray-200"
                        : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <MessageSquare size={18} className="mr-2" />
                追加質問
                {question.length > 0 ? (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    focusMode === 'questions'
                      ? "bg-white/20"
                      : darkMode
                        ? "bg-cyan-600 text-white"
                        : "bg-purple-600 text-white"
                  }`}>
                    {question.filter(q => !q.answer).length}件未回答
                  </span>
                ) : (
                  <span className={`ml-2 text-xs ${darkMode ? "text-gray-600" : "text-gray-400"}`}>
                    (なし)
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* フォーカスに応じたレイアウト */}
          <div className="flex gap-6 min-h-[70vh]">
            {/* 仕様書編集エリア（左側） */}
            <div
              className={`transition-all duration-300 ${
                focusMode === 'specification'
                  ? 'flex-[1_1_65%] opacity-100'
                  : 'flex-[0_0_320px] opacity-70 hover:opacity-100'
              }`}
            >
              <SpecificationEditor
                projectId={projectId}
                projectDocument={projectDocument ?? null}
                score={score}
                mvpFeasible={mvpFeasible}
                onDocumentUpdate={handleDocumentUpdate}
                onEvaluationUpdate={handleEvaluationUpdate}
              />
            </div>

            {/* 追加質問エリア（右側） */}
            <div
              className={`transition-all duration-300 ${
                focusMode === 'questions'
                  ? 'flex-[1_1_65%] opacity-100'
                  : 'flex-[0_0_320px] opacity-70 hover:opacity-100'
              }`}
            >
              <QASection
                projectId={projectId}
                questions={question}
                onQuestionsUpdate={handleQuestionsUpdate}
              />
            </div>
          </div>

          {/* 次へ進むボタン */}
          <div className="mt-8">
            <div
              className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
                darkMode
                  ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                  : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
              }`}
            >
              <div className="text-center py-4">
                <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  仕様書の編集と質問への回答が完了したら、次のステップに進みましょう。
                </p>
                
                <button
                  onClick={handleNext}
                  className={`px-8 py-3 flex items-center mx-auto rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                    darkMode
                      ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400"
                      : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
                  }`}
                  disabled={processingNext}
                >
                  {processingNext ? (
                    <div className="flex items-center">
                      <Loader2 className="animate-spin mr-2" size={18} />
                      処理中...
                    </div>
                  ) : (
                    <>
                      <span>機能要件の作成へ</span>
                      <ChevronRight size={18} className="ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <HackthonSupportAgent />
        </div>
      </main>

      {/* AI Chat Widget */}
      {projectId && (
        <AgentChatWidget
          projectId={projectId}
          pageContext="summaryQA"
          pageSpecificContext={{
            focus_mode: focusMode,
            unanswered_count: question.filter(q => !q.answer).length,
            total_questions: question.length,
            specification: projectDocument?.specification || '',
          }}
          onAction={handleChatAction}
        />
      )}
    </>
  );
}
