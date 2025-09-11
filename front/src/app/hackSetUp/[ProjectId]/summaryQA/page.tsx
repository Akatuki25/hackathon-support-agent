"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, RefreshCcw, AlertTriangle, CheckCircle, Star, Loader2 } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import { generateSummaryAndEvaluate } from "@/libs/service/summary";
import { EvaluationResultType, MvpJudgeType } from "@/types/modelTypes";

type FlowState = 'initial' | 'generating' | 'evaluating' | 'proceed' | 'user_ask' | 'regenerating';

export default function SummaryQA() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[2];
  const { darkMode } = useDarkMode();

  const [flowState, setFlowState] = useState<FlowState>('initial');
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResultType | null>(null);
  const [qaAnswers, setQaAnswers] = useState<{[key: string]: string}>({});
  const [processingNext, setProcessingNext] = useState(false);

  // 初期処理：summary生成と評価
  useEffect(() => {
    const initializeFlow = async () => {
      if (!projectId) return;
      
      try {
        setFlowState('generating');
        
        // Q&Aから要約を生成・保存し、評価を実行
        const result = await generateSummaryAndEvaluate(projectId);
        setEvaluationResult(result);
        
        // 評価結果に基づいてフロー状態を設定
        if (result.action === 'proceed') {
          setFlowState('proceed');
        } else {
          setFlowState('user_ask');
        }
        
      } catch (error) {
        console.error("初期処理に失敗:", error);
        setFlowState('initial');
      }
    };

    initializeFlow();
  }, [projectId]);

  // Q&Aの回答更新
  const handleQaAnswerChange = (qaKey: string, answer: string) => {
    setQaAnswers(prev => ({ ...prev, [qaKey]: answer }));
  };

  // Q&A回答後の再生成・再評価
  const handleRegenerateAfterQA = async () => {
    if (!evaluationResult || evaluationResult.action !== 'ask_user') return;
    
    try {
      setFlowState('regenerating');
      
      // sectional_qaの回答をAPIの形式に変換
      const qaUpdates: Array<{ qa_id: string; answer: string }> = [];
      
      // Type guard: evaluationResult.action が 'ask_user' であることを確認
      if (evaluationResult.action === 'ask_user') {
        evaluationResult.sectional_qa?.forEach((section, sectionIndex) => {
          section.questions.forEach((_, qIndex) => {
            const qaKey = `${sectionIndex}-${qIndex}`;
            const answer = qaAnswers[qaKey];
            if (answer && answer.trim()) {
              // 実際のQA IDが必要だが、ここではダミーを使用
              // 実装時は適切なQA IDを取得する必要がある
              qaUpdates.push({
                qa_id: `${sectionIndex}-${qIndex}`, // 仮のID
                answer: answer.trim()
              });
            }
          });
        });
      }
      
      // 仮実装：QA更新の代わりに再評価のみ実行
      // const result = await updateQAAndRegenerate(projectId, qaUpdates);
      const result = await generateSummaryAndEvaluate(projectId);
      setEvaluationResult(result);
      
      if (result.action === 'proceed') {
        setFlowState('proceed');
      } else {
        setFlowState('user_ask');
      }
      
    } catch (error) {
      console.error("再生成・再評価に失敗:", error);
      setFlowState('user_ask');
    }
  };

  // 次へ進む
  const handleNext = async () => {
    setProcessingNext(true);
    // TODO: 次のページへの遷移（モック）
    setTimeout(() => {
      router.push(`/hackSetUp/${projectId}/selectFramework`);
    }, 1000);
  };

  // スコア表示用のコンポーネント
  const ScoreDisplay = ({ judge }: { judge: MvpJudgeType }) => (
    <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700/50 border-cyan-500/30' : 'bg-purple-50/70 border-purple-300/50'}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-semibold ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>評価スコア</h3>
        <div className="flex items-center space-x-2">
          <Star className={`${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} size={16} />
          <span className={`text-xl font-bold ${darkMode ? 'text-cyan-300' : 'text-purple-600'}`}>
            {judge.score_0_100}/100
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>実現可能性:</span>
          <div className="flex items-center">
            {judge.mvp_feasible ? (
              <CheckCircle className="text-green-500 mr-1" size={14} />
            ) : (
              <AlertTriangle className="text-red-500 mr-1" size={14} />
            )}
            <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {judge.mvp_feasible ? '実現可能' : '要検討'}
            </span>
          </div>
        </div>
        <div>
          <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>信頼度:</span>
          <span className={`ml-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {Math.round(judge.confidence * 100)}%
          </span>
        </div>
      </div>
    </div>
  );

  // ローディング状態の処理
  if (flowState === 'initial' || flowState === 'generating') {
    return <Loading />;
  }

  if (!evaluationResult) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className={`text-center ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <AlertTriangle className="mx-auto mb-4" size={48} />
          <p>評価結果の取得に失敗しました</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      <main className="relative z-10">
        <div className="max-w-7xl mx-auto">
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
                  _要約評価
                </span>
              </h1>
            </div>
            <p
              className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              {flowState === 'proceed' 
                ? 'AI評価に合格しました！次のステップに進みましょう'
                : 'より詳細な情報が必要です。追加の質問に回答してください'
              }
            </p>
          </div>

          <div className="space-y-6">
            {/* 評価スコア表示 */}
            <div
              className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
                darkMode
                  ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                  : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
              }`}
            >
              <ScoreDisplay judge={evaluationResult.judge} />
            </div>

            {flowState === 'proceed' ? (
              /* proceed の場合: 成功画面 */
              <div
                className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
                  darkMode
                    ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                    : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
                }`}
              >
                <div className="text-center py-8">
                  <CheckCircle 
                    className="mx-auto mb-4 text-green-500" 
                    size={64} 
                  />
                  <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
                    評価合格！
                  </h2>
                  <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    プロジェクトの要約が十分に詳細で実現可能と評価されました。<br />
                    次のステップに進んでフレームワークを選択しましょう。
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
                        <span>次へ進む</span>
                        <ChevronRight size={18} className="ml-2" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* user_ask の場合: Q&A画面 */
              <div
                className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
                  darkMode
                    ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                    : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
                }`}
              >
                <h2
                  className={`text-xl font-medium mb-6 flex items-center ${
                    darkMode ? "text-cyan-400" : "text-purple-700"
                  }`}
                >
                  <AlertTriangle
                    size={18}
                    className="mr-2 text-orange-500"
                  />
                  追加情報が必要です
                </h2>
                
                <div className="space-y-6 max-h-96 overflow-y-auto">
                  {/* 不足項目の表示 */}
                  {evaluationResult.action === 'ask_user' && evaluationResult.missing_items && evaluationResult.missing_items.length > 0 && (
                    <div className={`p-4 rounded-lg border-l-4 ${
                      darkMode
                        ? "bg-orange-900/20 border-orange-500 text-orange-300"
                        : "bg-orange-50 border-orange-500 text-orange-700"
                    }`}>
                      <h4 className="font-semibold mb-2">不足している項目:</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {evaluationResult.action === 'ask_user' && evaluationResult.missing_items.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ブロッカーの表示 */}
                  {evaluationResult.action === 'ask_user' && evaluationResult.blockers && evaluationResult.blockers.length > 0 && (
                    <div className={`p-4 rounded-lg border-l-4 ${
                      darkMode
                        ? "bg-red-900/20 border-red-500 text-red-300"
                        : "bg-red-50 border-red-500 text-red-700"
                    }`}>
                      <h4 className="font-semibold mb-2">解決が必要な問題:</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {evaluationResult.action === 'ask_user' && evaluationResult.blockers.map((blocker, index) => (
                          <li key={index}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* セクション別Q&A */}
                  {evaluationResult.action === 'ask_user' && evaluationResult.sectional_qa && evaluationResult.sectional_qa.map((section, sectionIndex) => (
                    <div key={sectionIndex} className={`p-4 rounded-lg border ${
                      darkMode
                        ? "bg-gray-700/40 border-cyan-500/30"
                        : "bg-purple-50/70 border-purple-300/50"
                    }`}>
                      <h4 className={`font-semibold mb-3 ${
                        darkMode ? "text-cyan-300" : "text-purple-700"
                      }`}>
                        {section.section_title}
                      </h4>
                      <div className="space-y-3">
                        {section.questions.map((question, qIndex) => {
                          const qaKey = `${sectionIndex}-${qIndex}`;
                          return (
                            <div key={qIndex}>
                              <label className={`block text-sm font-medium mb-2 ${
                                darkMode ? "text-cyan-300" : "text-purple-600"
                              }`}>
                                {question}
                              </label>
                              <textarea
                                value={qaAnswers[qaKey] || ''}
                                onChange={(e) => handleQaAnswerChange(qaKey, e.target.value)}
                                rows={3}
                                className={`w-full p-3 rounded-lg border transition-all resize-none ${
                                  darkMode
                                    ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                                    : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                                } focus:outline-none focus:ring-2 ${
                                  darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                                }`}
                                placeholder="回答を入力してください..."
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 再生成ボタン */}
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleRegenerateAfterQA}
                    className={`px-8 py-3 flex items-center rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                      darkMode
                        ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400"
                        : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
                    }`}
                    disabled={flowState === 'regenerating'}
                  >
                    {flowState === 'regenerating' ? (
                      <div className="flex items-center">
                        <Loader2 className="animate-spin mr-2" size={18} />
                        再生成中...
                      </div>
                    ) : (
                      <>
                        <RefreshCcw size={18} className="mr-2" />
                        <span>回答を反映して再評価</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <HackthonSupportAgent />
        </div>
      </main>
    </>
  );
}