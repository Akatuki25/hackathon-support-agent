"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, Loader2, BarChart3 } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import FunctionEditor from "@/components/FunctionEditor/FunctionEditor";
import QASection from "@/components/QASection/QASection";
import ConfidenceFeedback from "@/components/ConfidenceFeedback/ConfidenceFeedback";
import ConfidenceIndicator from "@/components/ConfidenceIndicator/ConfidenceIndicator";
import {
  FunctionalRequirement,
  QAForRequirement,
  getFunctionalRequirements,
  generateAndSaveAll
} from "@/libs/service/function";
import { QAType, ConfidenceFeedback as ConfidenceFeedbackType } from "@/types/modelTypes";

type FlowState = 'loading' | 'ready';

export default function FunctionSummary() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[2];
  const { darkMode } = useDarkMode();

  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [processingNext, setProcessingNext] = useState(false);
  const [functionDocument, setFunctionDocument] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<FunctionalRequirement[]>([]);
  const [overallConfidence, setOverallConfidence] = useState<number>(0);
  const [qaList, setQAList] = useState<QAType[]>([]);
  const [confidenceFeedback, setConfidenceFeedback] = useState<ConfidenceFeedbackType | null>(null);
  const [showConfidenceFeedback, setShowConfidenceFeedback] = useState(false);

  // 初期処理：機能要件とQ&Aを取得
  useEffect(() => {
    const initializeFlow = async () => {
      if (!projectId) return;

      try {
        // 既存の機能要件ドキュメントを取得
        try {
          const doc = await getFunctionalRequirements(projectId);
          setFunctionDocument(doc.function_doc || null);

          // 既存の機能要件が無い場合のみ自動生成
          if (!doc.has_requirements || !doc.function_doc || doc.function_doc.trim() === '') {
            console.log("機能要件が見つからないため、自動生成します...");
            const result = await generateAndSaveAll(projectId);

            // 生成された要件をMarkdown形式に変換
            const markdownContent = formatRequirementsAsMarkdown(result.requirements);
            setFunctionDocument(markdownContent);
            setRequirements(result.requirements);
            setOverallConfidence(result.overall_confidence);

            // Q&AをQAType形式に変換
            const convertedQAs: QAType[] = result.clarification_questions.map(q => ({
              qa_id: q.qa_id,
              project_id: q.project_id,
              question: q.question,
              answer: q.answer || null, // undefinedをnullに変換
              is_ai: q.is_ai,
              importance: q.importance,
              source_doc_id: null,
              follows_qa_id: null,
              created_at: new Date().toISOString()
            }));
            setQAList(convertedQAs);

            // 確信度フィードバックを生成
            generateConfidenceFeedback(result.requirements, result.overall_confidence);
          } else {
            // 既存のドキュメントが存在する場合はそれを使用
            console.log("既存の機能要件ドキュメントを読み込みます");
            setFunctionDocument(doc.function_doc);
            setRequirements([]); // 既存文書から要件を解析したい場合は後で実装
            setOverallConfidence(0.8); // デフォルト値
            setQAList([]);

            // デフォルトの確信度フィードバックを生成
            generateDefaultConfidenceFeedback(0.8);
          }
        } catch (error) {
          console.warn("機能要件の取得に失敗:", error);
          setFunctionDocument(null);
          setRequirements([]);
          setOverallConfidence(0);
          setQAList([]);
        }

        setFlowState('ready');
      } catch (error) {
        console.error("初期処理に失敗:", error);
        setFlowState('ready');
      }
    };

    initializeFlow();
  }, [projectId]);

  // 確信度フィードバックを生成
  const generateConfidenceFeedback = (reqs: FunctionalRequirement[], confidence: number) => {
    // 要件の品質を分析
    const clarity = calculateClarityScore(reqs);
    const feasibility = calculateFeasibilityScore(reqs);
    const scope = calculateScopeScore(reqs);
    const value = calculateValueScore(reqs);
    const completeness = calculateCompletenessScore(reqs);

    const feedback: ConfidenceFeedbackType = {
      overall_confidence: confidence,
      clarity_score: clarity,
      feasibility_score: feasibility,
      scope_score: scope,
      value_score: value,
      completeness_score: completeness,
      clarity_feedback: getClarityFeedback(clarity, reqs),
      feasibility_feedback: getFeasibilityFeedback(feasibility, reqs),
      scope_feedback: getScopeFeedback(scope, reqs),
      value_feedback: getValueFeedback(value, reqs),
      completeness_feedback: getCompletenessFeedback(completeness, reqs),
      improvement_suggestions: getImprovementSuggestions(reqs, clarity, feasibility, scope, value, completeness),
      confidence_reason: getConfidenceReason(confidence, clarity, feasibility, scope, value, completeness)
    };

    setConfidenceFeedback(feedback);
  };

  // デフォルトの確信度フィードバックを生成
  const generateDefaultConfidenceFeedback = (confidence: number) => {
    const feedback: ConfidenceFeedbackType = {
      overall_confidence: confidence,
      clarity_score: 0.8,
      feasibility_score: 0.7,
      scope_score: 0.75,
      value_score: 0.8,
      completeness_score: 0.7,
      clarity_feedback: "既存の機能要件ドキュメントは基本的な要件が明確に記載されています。",
      feasibility_feedback: "提案された機能は技術的に実現可能と判断されます。",
      scope_feedback: "プロジェクトのスコープは適切に設定されているようです。",
      value_feedback: "ユーザーにとって価値のある機能が含まれています。",
      completeness_feedback: "機能要件は概ね完全ですが、詳細な仕様の追加を検討してください。",
      improvement_suggestions: [
        "より詳細な受入基準の追加を検討してください",
        "非機能要件の明確化が推奨されます",
        "ユーザーストーリーの具体化を検討してください"
      ],
      confidence_reason: "既存のドキュメントに基づく分析結果です。より正確な評価のため、詳細な要件分析を実施することを推奨します。"
    };

    setConfidenceFeedback(feedback);
  };

  // スコア計算関数群
  const calculateClarityScore = (reqs: FunctionalRequirement[]): number => {
    if (reqs.length === 0) return 0.5;

    const scores = reqs.map(req => {
      let score = 0.5;
      if (req.description && req.description.length > 50) score += 0.2;
      if (req.acceptance_criteria && req.acceptance_criteria.length > 0) score += 0.2;
      if (req.title && req.title.length > 10) score += 0.1;
      return Math.min(score, 1.0);
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  };

  const calculateFeasibilityScore = (reqs: FunctionalRequirement[]): number => {
    if (reqs.length === 0) return 0.6;

    const scores = reqs.map(req => {
      let score = 0.6;
      if (req.priority === "LOW" || req.priority === "MEDIUM") score += 0.2;
      if (req.confidence_level && req.confidence_level > 0.7) score += 0.2;
      return Math.min(score, 1.0);
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  };

  const calculateScopeScore = (reqs: FunctionalRequirement[]): number => {
    if (reqs.length === 0) return 0.5;
    if (reqs.length > 20) return 0.4; // スコープが大きすぎる
    if (reqs.length < 3) return 0.6; // スコープが小さすぎる
    return 0.8; // 適切なスコープ
  };

  const calculateValueScore = (reqs: FunctionalRequirement[]): number => {
    if (reqs.length === 0) return 0.5;

    const highPriorityCount = reqs.filter(req => req.priority === "HIGH" || req.priority === "CRITICAL").length;
    const ratio = highPriorityCount / reqs.length;

    return Math.min(0.5 + ratio * 0.5, 1.0);
  };

  const calculateCompletenessScore = (reqs: FunctionalRequirement[]): number => {
    if (reqs.length === 0) return 0.3;

    const completeReqs = reqs.filter(req =>
      req.description &&
      req.acceptance_criteria &&
      req.acceptance_criteria.length > 0 &&
      req.priority
    ).length;

    return completeReqs / reqs.length;
  };

  // フィードバック生成関数群
  const getClarityFeedback = (score: number, reqs: FunctionalRequirement[]): string => {
    if (score >= 0.8) return "要件の記述が非常に明確で、理解しやすい内容になっています。";
    if (score >= 0.6) return "要件の記述は概ね明確ですが、一部詳細化が必要な項目があります。";
    return "要件の記述をより詳細にし、曖昧さを排除することを推奨します。";
  };

  const getFeasibilityFeedback = (score: number, reqs: FunctionalRequirement[]): string => {
    if (score >= 0.8) return "提案された機能は技術的に実現可能性が高く、リスクも低いと判断されます。";
    if (score >= 0.6) return "機能の実現可能性は中程度です。一部の機能について技術的検証が必要です。";
    return "実現可能性に懸念があります。技術的な検証と代替案の検討を推奨します。";
  };

  const getScopeFeedback = (score: number, reqs: FunctionalRequirement[]): string => {
    if (score >= 0.8) return "プロジェクトのスコープは適切に設定されており、期間内での実現が期待できます。";
    if (score >= 0.6) return "スコープは概ね適切ですが、優先度の見直しを検討してください。";
    return "スコープの調整が必要です。機能を絞り込むか、期間の延長を検討してください。";
  };

  const getValueFeedback = (score: number, reqs: FunctionalRequirement[]): string => {
    if (score >= 0.8) return "ユーザーにとって高い価値を提供する機能が適切に含まれています。";
    if (score >= 0.6) return "ユーザー価値は中程度です。より価値の高い機能の追加を検討してください。";
    return "ユーザー価値の向上が必要です。ユーザーニーズの再検討を推奨します。";
  };

  const getCompletenessFeedback = (score: number, reqs: FunctionalRequirement[]): string => {
    if (score >= 0.8) return "要件の記述が完全で、開発に必要な情報が十分に含まれています。";
    if (score >= 0.6) return "要件は概ね完全ですが、一部の項目で詳細化が必要です。";
    return "要件の完全性を向上させる必要があります。受入基準や詳細仕様の追加を推奨します。";
  };

  const getImprovementSuggestions = (
    reqs: FunctionalRequirement[],
    clarity: number,
    feasibility: number,
    scope: number,
    value: number,
    completeness: number
  ): string[] => {
    const suggestions: string[] = [];

    if (clarity < 0.7) suggestions.push("要件の記述をより具体的にしてください");
    if (feasibility < 0.7) suggestions.push("技術的なリスク評価を実施してください");
    if (scope < 0.7) suggestions.push("機能の優先度を見直し、スコープを調整してください");
    if (value < 0.7) suggestions.push("ユーザー価値の高い機能を追加検討してください");
    if (completeness < 0.7) suggestions.push("受入基準や詳細仕様を追加してください");

    if (suggestions.length === 0) {
      suggestions.push("現在の要件は良好な状態です。継続的な見直しを行ってください");
    }

    return suggestions;
  };

  const getConfidenceReason = (
    confidence: number,
    clarity: number,
    feasibility: number,
    scope: number,
    value: number,
    completeness: number
  ): string => {
    const avgScore = (clarity + feasibility + scope + value + completeness) / 5;

    if (avgScore >= 0.8) {
      return "要件の品質が高く、プロジェクトの成功可能性が高いと判断されます。";
    } else if (avgScore >= 0.6) {
      return "要件の品質は中程度です。いくつかの改善点がありますが、プロジェクトは実現可能と考えられます。";
    } else {
      return "要件の品質向上が必要です。詳細な分析と改善を行うことで、プロジェクトの成功可能性を高めることができます。";
    }
  };

  // 要件をMarkdown形式に変換
  const formatRequirementsAsMarkdown = (reqs: FunctionalRequirement[]): string => {
    let md = "# 機能要件書\n\n";

    // カテゴリ別にグループ化
    const categories: { [key: string]: FunctionalRequirement[] } = {};
    reqs.forEach(req => {
      const category = req.category || "その他";
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(req);
    });

    Object.entries(categories).forEach(([category, categoryReqs]) => {
      md += `## ${category}\n\n`;

      categoryReqs.forEach(req => {
        md += `### ${req.title}\n\n`;
        md += `**要件ID:** ${req.requirement_id}\n\n`;
        md += `**優先度:** ${req.priority}\n\n`;
        md += `**確信度:** ${req.confidence_level?.toFixed(2) || "N/A"}\n\n`;
        md += `**説明:**\n${req.description}\n\n`;

        if (req.acceptance_criteria && req.acceptance_criteria.length > 0) {
          md += "**受入基準:**\n";
          req.acceptance_criteria.forEach(criteria => {
            md += `- ${criteria}\n`;
          });
          md += "\n";
        }

        if (req.dependencies && req.dependencies.length > 0) {
          md += `**依存関係:** ${req.dependencies.join(", ")}\n\n`;
        }

        md += "---\n\n";
      });
    });

    return md;
  };

  // 次へ進む
  const handleNext = async () => {
    setProcessingNext(true);
    setTimeout(() => {
      router.push(`/hackSetUp/${projectId}/selectFramework`);
    }, 1000);
  };

  // Q&Aの更新処理（FunctionEditor用）
  const handleQuestionsUpdate = (updatedQuestions: QAForRequirement[]) => {
    // QAType形式に変換してセット
    const convertedQAs: QAType[] = updatedQuestions.map(q => ({
      qa_id: q.qa_id,
      project_id: q.project_id,
      question: q.question,
      answer: q.answer || null, // undefinedをnullに変換
      is_ai: q.is_ai,
      importance: q.importance,
      source_doc_id: null,
      follows_qa_id: null,
      created_at: new Date().toISOString()
    }));
    setQAList(convertedQAs);
  };

  // QAListの更新処理（QASection用）
  const handleQAListUpdate = (updatedQAList: QAType[]) => {
    setQAList(updatedQAList);
  };

  // 要件更新時の確信度再計算
  const handleRequirementsUpdate = (updatedRequirements: FunctionalRequirement[]) => {
    setRequirements(updatedRequirements);
    if (updatedRequirements.length > 0) {
      generateConfidenceFeedback(updatedRequirements, overallConfidence);
    }
  };

  // 確信度更新時の処理
  const handleConfidenceUpdate = (newConfidence: number) => {
    setOverallConfidence(newConfidence);
    if (requirements.length > 0) {
      generateConfidenceFeedback(requirements, newConfidence);
    }
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
                機能要件
                <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
                  _編集
                </span>
              </h1>
            </div>
            <p
              className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              機能要件を確認・編集し、追加質問に回答してください
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[70vh]">
            {/* 機能要件編集部分 */}
            <div className="xl:col-span-5">
              <FunctionEditor
                projectId={projectId}
                functionDocument={functionDocument}
                requirements={requirements}
                overallConfidence={overallConfidence}
                onDocumentUpdate={setFunctionDocument}
                onRequirementsUpdate={handleRequirementsUpdate}
                onQuestionsUpdate={handleQuestionsUpdate}
                onConfidenceUpdate={handleConfidenceUpdate}
              />
            </div>

            {/* 確信度評価部分 */}
            <div className="xl:col-span-3">
              {confidenceFeedback && (
                <div className={`h-full rounded-xl border-2 overflow-hidden ${
                  darkMode
                    ? "bg-gray-800/50 border-cyan-500/30"
                    : "bg-white/50 border-purple-500/30"
                } backdrop-blur-sm`}>
                  {/* ヘッダー */}
                  <div className={`p-4 border-b ${
                    darkMode ? "border-gray-700 bg-gray-800/80" : "border-gray-200 bg-gray-50/80"
                  }`}>
                    <h3 className={`text-lg font-bold flex items-center ${
                      darkMode ? "text-cyan-300" : "text-purple-700"
                    }`}>
                      <BarChart3 size={20} className="mr-2" />
                      確信度評価
                    </h3>
                  </div>

                  {/* 総合確信度 */}
                  <div className="p-4 space-y-4">
                    <div className="text-center">
                      <ConfidenceIndicator
                        confidence={confidenceFeedback.overall_confidence}
                        size="lg"
                      />
                      <p className={`mt-2 text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                        総合確信度
                      </p>
                    </div>

                    {/* 詳細スコア */}
                    <div className="space-y-3">
                      {[
                        { key: 'clarity_score', label: '明確性', score: confidenceFeedback.clarity_score },
                        { key: 'feasibility_score', label: '実現可能性', score: confidenceFeedback.feasibility_score },
                        { key: 'scope_score', label: 'スコープ', score: confidenceFeedback.scope_score },
                        { key: 'value_score', label: 'ユーザー価値', score: confidenceFeedback.value_score },
                        { key: 'completeness_score', label: '完全性', score: confidenceFeedback.completeness_score },
                      ].map((item) => (
                        <div key={item.key} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                              {item.label}
                            </span>
                            <span className={`text-sm font-bold ${
                              item.score >= 0.8 ? "text-green-500" :
                              item.score >= 0.6 ? "text-yellow-500" : "text-red-500"
                            }`}>
                              {(item.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2`}>
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                item.score >= 0.8 ? "bg-green-500" :
                                item.score >= 0.6 ? "bg-yellow-500" : "bg-red-500"
                              }`}
                              style={{ width: `${item.score * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 詳細分析ボタン */}
                    <button
                      onClick={() => setShowConfidenceFeedback(true)}
                      className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
                        darkMode
                          ? "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30"
                          : "bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300"
                      }`}
                    >
                      詳細分析を見る
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Q&A部分 */}
            <div className="xl:col-span-4">
              <QASection
                projectId={projectId}
                questions={qaList}
                onQuestionsUpdate={handleQAListUpdate}
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
                  機能要件の編集と質問への回答が完了したら、次のステップに進みましょう。
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

      {/* 確信度フィードバックモーダル */}
      {showConfidenceFeedback && confidenceFeedback && (
        <ConfidenceFeedback
          feedback={confidenceFeedback}
          onClose={() => setShowConfidenceFeedback(false)}
        />
      )}
    </>
  );
}