"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Terminal,
  ChevronRight,
  Loader2,
  MessageSquare,
  FileText,
} from "lucide-react";
import useSWR from "swr";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import SpecificationEditor from "@/components/SpecificationEditor/SpecificationEditor";
import QASection from "@/components/QASection/QASection";
import { getProjectDocument } from "@/libs/modelAPI/document";
import {
  ProjectDocumentType,
  QAType,
  ChatAction,
  SpecificationFeedback,
} from "@/types/modelTypes";
import { evaluateSummary, streamGenerateSummary } from "@/libs/service/summary";
import { AgentChatWidget } from "@/components/chat";

type FocusMode = "questions" | "specification";

export default function SummaryQA() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[2];

  const [processingNext, setProcessingNext] = useState(false);
  // 追加質問がある場合は質問フォーカス、なければ仕様書フォーカス
  const [focusMode, setFocusMode] = useState<FocusMode>("questions");

  // ストリーミング用の状態
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingSpec, setStreamingSpec] = useState("");
  const streamingStartedRef = useRef(false);

  // 仕様書フィードバック
  const [specificationFeedback, setSpecificationFeedback] =
    useState<SpecificationFeedback | null>(null);

  // SWRでプロジェクトドキュメント取得のみ（生成は別途）
  const {
    data: projectDocument,
    mutate: mutateDocument,
    isLoading: isDocLoading,
  } = useSWR(
    projectId ? `document-${projectId}` : null,
    async () => {
      try {
        const doc = await getProjectDocument(projectId);
        if (doc?.specification) {
          return doc;
        }
      } catch {
        // ドキュメントがない場合
      }
      return null;
    },
    { revalidateOnFocus: false },
  );

  // ドキュメントがない場合にストリーミング生成を開始
  useEffect(() => {
    if (isDocLoading || streamingStartedRef.current) return;
    if (projectDocument?.specification) return;

    // ストリーミング生成開始
    streamingStartedRef.current = true;
    setIsStreaming(true);
    setStreamingSpec("");

    streamGenerateSummary(projectId, {
      onChunk: (chunk, accumulated) => {
        setStreamingSpec(accumulated);
      },
      onSpecDone: async () => {
        const doc = await getProjectDocument(projectId);
        mutateDocument(doc, false);
      },
      onDone: () => {
        setIsStreaming(false);
      },
      onError: () => {
        setIsStreaming(false);
      },
    });
  }, [projectId, projectDocument, isDocLoading, mutateDocument]);

  // SWRで評価データ取得（ドキュメントがあれば）
  const { data: evaluation, mutate: mutateEvaluation } = useSWR(
    projectDocument?.specification ? `evaluation-${projectId}` : null,
    async () => {
      const result = await evaluateSummary(projectId);
      // 追加質問がなければ仕様書フォーカスに
      if (!result.qa || result.qa.length === 0) {
        setFocusMode("specification");
      }
      return result;
    },
    { revalidateOnFocus: false },
  );

  // ストリーミング中はローディングではなく、部分的な仕様書を表示
  const isLoading =
    isDocLoading || (!isStreaming && !projectDocument && !streamingSpec);

  // 評価データから各値を取得
  const question = evaluation?.qa || [];
  const score = evaluation?.score_0_100 || 0;
  const mvpFeasible = evaluation?.mvp_feasible || false;

  // ストリーミング中は一時的なドキュメントオブジェクトを使用
  const displayDocument: ProjectDocumentType | null =
    projectDocument ??
    (streamingSpec
      ? {
          doc_id: "",
          project_id: projectId,
          specification: streamingSpec,
          function_doc: "",
          frame_work_doc: "",
          directory_info: "",
        }
      : null);

  // 次へ進む
  const handleNext = async () => {
    setProcessingNext(true);
    // TODO: 次のページへの遷移（モック）
    setTimeout(() => {
      router.push(`/hackSetUp/${projectId}/functionSummary`);
    }, 1000);
  };

  // 評価更新のハンドラー
  const handleEvaluationUpdate = (newEvaluation: {
    qa: QAType[];
    score_0_100: number;
    mvp_feasible: boolean;
  }) => {
    mutateEvaluation(
      {
        confidence: evaluation?.confidence ?? 0,
        ...evaluation,
        ...newEvaluation,
      },
      false,
    );
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
    if (action.action_type === "regenerate_questions") {
      // 追加質問を再生成（SWRでrevalidate）
      const newEvaluation = await evaluateSummary(projectId);
      mutateEvaluation(newEvaluation, false);

      // 新しい追加質問があればフォーカスを切り替え
      if (newEvaluation.qa && newEvaluation.qa.length > 0) {
        setFocusMode("questions");
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
              <Terminal className="mr-2 text-purple-600 dark:text-cyan-400" />
              <h1 className="text-3xl font-bold tracking-wider text-purple-700 dark:text-cyan-400">
                プロジェクト
                <span className="text-blue-600 dark:text-pink-500">
                  _仕様書編集
                </span>
              </h1>
            </div>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              {focusMode === "questions"
                ? "追加質問に回答すると、仕様書がより具体的になります"
                : "仕様書を確認・編集してください"}
            </p>
          </div>

          {/* フォーカス切り替えタブ */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg p-1 bg-gray-100 dark:bg-gray-800">
              <button
                onClick={() => setFocusMode("specification")}
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  focusMode === "specification"
                    ? "bg-purple-600 text-white dark:bg-cyan-600"
                    : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <FileText size={18} className="mr-2" />
                仕様書
              </button>
              <button
                onClick={() => question.length > 0 && setFocusMode("questions")}
                disabled={question.length === 0}
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  question.length === 0
                    ? "text-gray-400 cursor-not-allowed dark:text-gray-600"
                    : focusMode === "questions"
                      ? "bg-purple-600 text-white dark:bg-cyan-600"
                      : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <MessageSquare size={18} className="mr-2" />
                追加質問
                {question.length > 0 ? (
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      focusMode === "questions"
                        ? "bg-white/20"
                        : "bg-purple-600 text-white dark:bg-cyan-600"
                    }`}
                  >
                    {question.filter((q) => !q.answer).length}件未回答
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-600">
                    (なし)
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* フォーカスに応じたレイアウト */}
          <div className="flex gap-6 min-h-[70vh]">
            {/* 仕様書編集エリア（左側） - ストリーミング中は常に広げる */}
            <div
              className={`transition-all duration-300 ${
                isStreaming || focusMode === "specification"
                  ? "flex-[1_1_65%] opacity-100"
                  : "flex-[0_0_320px] opacity-70 hover:opacity-100"
              }`}
            >
              <SpecificationEditor
                projectId={projectId}
                projectDocument={displayDocument}
                score={score}
                mvpFeasible={mvpFeasible}
                onDocumentUpdate={handleDocumentUpdate}
                onEvaluationUpdate={handleEvaluationUpdate}
                isStreaming={isStreaming}
                onFeedbackUpdate={setSpecificationFeedback}
              />
            </div>

            {/* 追加質問エリア（右側） - ストリーミング中は小さく */}
            <div
              className={`transition-all duration-300 ${
                !isStreaming && focusMode === "questions"
                  ? "flex-[1_1_65%] opacity-100"
                  : "flex-[0_0_320px] opacity-70 hover:opacity-100"
              }`}
            >
              <QASection
                projectId={projectId}
                questions={question}
                onQuestionsUpdate={handleQuestionsUpdate}
              />
            </div>
          </div>

          {/* 仕様書ガイドライン（全幅表示） */}
          {specificationFeedback && (
            <div className="mt-6 rounded-lg border p-6 space-y-4 bg-white/80 border-purple-500/30 dark:bg-gray-800/50 dark:border-cyan-500/30">
              <h3 className="text-lg font-bold flex items-center text-purple-700 dark:text-cyan-300">
                📊 仕様書ガイドライン
              </h3>

              {/* 総合評価 */}
              <div className="space-y-2">
                <h4 className="font-semibold text-purple-600 dark:text-cyan-400">
                  総合評価
                </h4>
                <p className="text-gray-700 dark:text-gray-300">
                  {specificationFeedback.summary}
                </p>
              </div>

              {/* 強み */}
              {specificationFeedback.strengths &&
                specificationFeedback.strengths.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-green-600 dark:text-green-400">
                      ✅ 強み
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                      {specificationFeedback.strengths.map(
                        (strength, index) => (
                          <li key={index}>{strength}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              {/* 改善提案 */}
              {specificationFeedback.suggestions &&
                specificationFeedback.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-yellow-600 dark:text-yellow-400">
                      💡 改善提案
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                      {specificationFeedback.suggestions.map(
                        (suggestion, index) => (
                          <li key={index}>{suggestion}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {/* 次へ進むボタン */}
          <div className="mt-8">
            <div className="backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20 dark:bg-gray-800 dark:bg-opacity-70 dark:border-cyan-500/30 dark:shadow-cyan-500/20">
              <div className="text-center py-4">
                <p className="mb-6 text-gray-700 dark:text-gray-300">
                  仕様書の編集と質問への回答が完了したら、次のステップに進みましょう。
                </p>

                <button
                  onClick={handleNext}
                  className="px-8 py-3 flex items-center mx-auto rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400 dark:bg-cyan-500 dark:hover:bg-cyan-600 dark:text-gray-900 dark:focus:ring-cyan-400 dark:from-cyan-500 dark:to-cyan-500 dark:hover:from-cyan-600 dark:hover:to-cyan-600"
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
            unanswered_count: question.filter((q) => !q.answer).length,
            total_questions: question.length,
            specification: projectDocument?.specification || "",
          }}
          onAction={handleChatAction}
        />
      )}
    </>
  );
}
