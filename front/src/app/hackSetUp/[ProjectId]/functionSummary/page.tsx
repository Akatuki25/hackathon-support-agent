"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, Loader2 } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import FunctionEditor from "@/components/FunctionEditor/FunctionEditor";
import QASection from "@/components/QASection/QASection";
import {
  FunctionalRequirement,
  QAForRequirement,
  getFunctionalRequirements,
  generateAndSaveAll,
} from "@/libs/service/function";
import { QAType } from "@/types/modelTypes";

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
          } else {
            // 既存のドキュメントが存在する場合はそれを使用
            console.log("既存の機能要件ドキュメントを読み込みます");
            setFunctionDocument(doc.function_doc);
            setRequirements([]); // 既存文書から要件を解析したい場合は後で実装
            setOverallConfidence(0.8); // デフォルト値
            setQAList([]);
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
        md += `**優先度:** ${req.priority}\n\n`;
        md += `**説明:**\n${req.description}\n\n`;

        if (req.acceptance_criteria && req.acceptance_criteria.length > 0) {
          md += "**詳細機能:**\n";
          req.acceptance_criteria.forEach(criteria => {
            md += `- ${criteria}\n`;
          });
          md += "\n";
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

  // 要件更新時の処理
  const handleRequirementsUpdate = (updatedRequirements: FunctionalRequirement[]) => {
    setRequirements(updatedRequirements);
  };

  // 確信度更新時の処理
  const handleConfidenceUpdate = (newConfidence: number) => {
    setOverallConfidence(newConfidence);
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
        <div className="max-w-[2000px] mx-auto px-8 py-8">
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

          <div className="flex gap-6 min-h-[85vh]">
            {/* 機能要件編集部分 */}
            <div className="flex-1" style={{ flexBasis: '75%' }}>
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

            {/* Q&A部分 */}
            <div className="flex-shrink-0" style={{ flexBasis: '25%' }}>
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
    </>
  );
}
