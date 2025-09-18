"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, Loader2 } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import SpecificationEditor from "@/components/SpecificationEditor/SpecificationEditor";
import QASection from "@/components/QASection/QASection";
import { getProjectDocument } from "@/libs/modelAPI/document";
import { ProjectDocumentType, ConfidenceFeedback } from "@/types/modelTypes";
import { evaluateSummary, getConfidenceFeedback } from "@/libs/service/summary";
import { QAType } from "@/types/modelTypes";
 
type FlowState = 'loading' | 'ready';

export default function SummaryQA() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[2];
  const { darkMode } = useDarkMode();

  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [processingNext, setProcessingNext] = useState(false);
  const [projectDocument, setProjectDocument] = useState<ProjectDocumentType | null>(null);
  const [score, setScore] = useState<number>(0);
  const [question, setQuestion] = useState<QAType[]>([]);
  const [mvpFeasible, setMvpFeasible] = useState<boolean>(false);
  const [confidenceFeedback, setConfidenceFeedback] = useState<ConfidenceFeedback | null>(null);


  // 初期処理：document取得
  useEffect(() => {
    const initializeFlow = async () => {
      if (!projectId) return;
      
      try {
        // プロジェクトドキュメントを取得
        try {
          const document = await getProjectDocument(projectId);
          setProjectDocument(document);
        } catch (error) {
          console.warn("プロジェクトドキュメントが見つかりません:", error);
        }

        // 評価を取得
        try {
          const evaluation = await evaluateSummary(projectId);
          console.log("評価結果:", evaluation); // デバッグ用
          console.log("スコア:", evaluation.score_0_100); // デバッグ用
          console.log("MVP可能性:", evaluation.mvp_feasible); // デバッグ用

          setQuestion(evaluation.qa || []);
          setScore(evaluation.score_0_100 || 0);
          setMvpFeasible(evaluation.mvp_feasible || false);
        } catch (error) {
          console.warn("評価の取得に失敗:", error);
          // デフォルト値を設定
          setQuestion([]);
          setScore(0);
          setMvpFeasible(false);
        }

        // 確信度フィードバックを取得（存在する場合のみ）
        try {
          const projectDoc = await getProjectDocument(projectId);
          if (projectDoc && projectDoc.specification) {
            const feedback = await getConfidenceFeedback(projectId);
            setConfidenceFeedback(feedback);
          }
        } catch (error) {
          console.warn("確信度フィードバックの取得に失敗:", error);
          // エラーは無視（まだ生成されていない可能性がある）
        }
        setFlowState('ready');
      } catch (error) {
        console.error("初期処理に失敗:", error);
        setFlowState('ready');
      }
    };

    initializeFlow();
  }, [projectId]);


  // 次へ進む
  const handleNext = async () => {
    setProcessingNext(true);
    // TODO: 次のページへの遷移（モック）
    setTimeout(() => {
      router.push(`/hackSetUp/${projectId}/functionSummary`);
    }, 1000);
  };

  // 評価更新のハンドラー
  const handleEvaluationUpdate = (evaluation: { qa: QAType[]; score_0_100: number; mvp_feasible: boolean }) => {
    setQuestion(evaluation.qa);
    setScore(evaluation.score_0_100);
    setMvpFeasible(evaluation.mvp_feasible);
  };

  // ドキュメント更新のハンドラー（確信度フィードバックも更新）
  const handleDocumentUpdate = async (document: ProjectDocumentType) => {
    setProjectDocument(document);
    // ドキュメントが更新されたら確信度フィードバックをクリア（再評価が必要）
    setConfidenceFeedback(null);
  };

  // ローディング状態の処理
  if (flowState === 'loading') {
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
              仕様書を確認・編集し、追加質問に回答してください
            </p>
          </div>

          {/* 3分割レイアウト - 1:4:2比率最適化 */}
          <div className="flex gap-6 min-h-[80vh]">
            {/* 仕様書編集エリア - 確信度フィードバック含む（5/7幅） */}
            <div className="flex-1" style={{ flexBasis: '71%' }}>
              <SpecificationEditor
                projectId={projectId}
                projectDocument={projectDocument}
                score={score}
                mvpFeasible={mvpFeasible}
                onDocumentUpdate={handleDocumentUpdate}
                onEvaluationUpdate={handleEvaluationUpdate}
              />
            </div>

            {/* 右サイド - QAセクション（2/7幅） */}
            <div className="flex-shrink-0" style={{ flexBasis: '29%' }}>
              <QASection
                projectId={projectId}
                questions={question}
                onQuestionsUpdate={setQuestion}
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
                      <span>フレームワーク選択へ</span>
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
    </>
  );
}