"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, Loader2, MessageSquare, FileText } from "lucide-react";
import useSWR from "swr";
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
  regenerateFunctionalRequirements,
} from "@/libs/service/function";
import { QAType, ChatAction } from "@/types/modelTypes";
import { AgentChatWidget } from "@/components/chat";

type FocusMode = 'questions' | 'document';

interface FunctionData {
  functionDocument: string | null;
  requirements: FunctionalRequirement[];
  overallConfidence: number;
  qaList: QAType[];
}

export default function FunctionSummary() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[2];
  const { darkMode } = useDarkMode();

  const [processingNext, setProcessingNext] = useState(false);
  // 追加質問がある場合は質問フォーカス、なければ機能要件フォーカス
  const [focusMode, setFocusMode] = useState<FocusMode>('document');

  // SWRで機能要件データを取得（キャッシュ有効）
  const { data, mutate, isLoading } = useSWR<FunctionData>(
    projectId ? `function-${projectId}` : null,
    async () => {
      const doc = await getFunctionalRequirements(projectId);
      
      // 既存の機能要件が無い場合のみ自動生成
      if (!doc.has_requirements || !doc.function_doc || doc.function_doc.trim() === '') {
        console.log("機能要件が見つからないため、自動生成します...");
        const result = await generateAndSaveAll(projectId);

        // 生成された要件をMarkdown形式に変換
        const markdownContent = formatRequirementsAsMarkdown(result.requirements);

        // Q&AをQAType形式に変換
        const convertedQAs: QAType[] = result.clarification_questions.map(q => ({
          qa_id: q.qa_id,
          project_id: q.project_id,
          question: q.question,
          answer: q.answer || null,
          is_ai: q.is_ai,
          importance: q.importance,
          source_doc_id: null,
          follows_qa_id: null,
          created_at: new Date().toISOString()
        }));

        // 追加質問があればフォーカスを切り替え
        if (convertedQAs.length > 0) {
          setFocusMode('questions');
        }

        return {
          functionDocument: markdownContent,
          requirements: result.requirements,
          overallConfidence: result.overall_confidence,
          qaList: convertedQAs
        };
      } else {
        // 既存のドキュメントが存在する場合はそれを使用
        console.log("既存の機能要件ドキュメントを読み込みます");
        return {
          functionDocument: doc.function_doc,
          requirements: [],
          overallConfidence: 0.8,
          qaList: []
        };
      }
    },
    { revalidateOnFocus: false }
  );

  // データから各値を取得
  const functionDocument = data?.functionDocument ?? null;
  const requirements = data?.requirements ?? [];
  const overallConfidence = data?.overallConfidence ?? 0;
  const qaList = data?.qaList ?? [];

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
    // QAType形式に変換
    const convertedQAs: QAType[] = updatedQuestions.map(q => ({
      qa_id: q.qa_id,
      project_id: q.project_id,
      question: q.question,
      answer: q.answer || null,
      is_ai: q.is_ai,
      importance: q.importance,
      source_doc_id: null,
      follows_qa_id: null,
      created_at: new Date().toISOString()
    }));
    if (data) {
      mutate({ ...data, qaList: convertedQAs }, false);
    }
  };

  // QAListの更新処理（QASection用）
  const handleQAListUpdate = (updatedQAList: QAType[]) => {
    if (data) {
      mutate({ ...data, qaList: updatedQAList }, false);
    }
  };

  // 要件更新時の処理
  const handleRequirementsUpdate = (updatedRequirements: FunctionalRequirement[]) => {
    if (data) {
      mutate({ ...data, requirements: updatedRequirements }, false);
    }
  };

  // 確信度更新時の処理
  const handleConfidenceUpdate = (newConfidence: number) => {
    if (data) {
      mutate({ ...data, overallConfidence: newConfidence }, false);
    }
  };

  // ドキュメント更新時の処理
  const handleDocumentUpdate = (newDocument: string | null) => {
    if (data) {
      mutate({ ...data, functionDocument: newDocument }, false);
    }
  };

  // AIチャットアクションのハンドラー
  const handleChatAction = async (action: ChatAction) => {
    if (action.action_type === 'regenerate_questions') {
      try {
        // 機能要件と追加質問を再生成
        const result = await regenerateFunctionalRequirements(projectId);

        // Q&AをQAType形式に変換
        const convertedQAs: QAType[] = result.clarification_questions.map(q => ({
          qa_id: q.qa_id,
          project_id: q.project_id,
          question: q.question,
          answer: q.answer || null,
          is_ai: q.is_ai,
          importance: q.importance,
          source_doc_id: null,
          follows_qa_id: null,
          created_at: new Date().toISOString()
        }));

        // SWRキャッシュを更新
        if (data) {
          mutate({
            ...data,
            qaList: convertedQAs,
            overallConfidence: result.overall_confidence
          }, false);
        }

        // 新しい追加質問があればフォーカスを切り替え
        if (convertedQAs.length > 0) {
          setFocusMode('questions');
        }
      } catch (error) {
        console.error('追加質問の再生成に失敗:', error);
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
                機能要件
                <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
                  _編集
                </span>
              </h1>
            </div>
            <p
              className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              {focusMode === 'questions'
                ? '追加質問に回答すると、機能要件がより具体的になります'
                : '機能要件を確認・編集してください'}
            </p>
          </div>

          {/* フォーカス切り替えタブ */}
          <div className="flex justify-center mb-6">
            <div className={`inline-flex rounded-lg p-1 ${
              darkMode ? "bg-gray-800" : "bg-gray-100"
            }`}>
              <button
                onClick={() => setFocusMode('document')}
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  focusMode === 'document'
                    ? darkMode
                      ? "bg-cyan-600 text-white"
                      : "bg-purple-600 text-white"
                    : darkMode
                      ? "text-gray-400 hover:text-gray-200"
                      : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <FileText size={18} className="mr-2" />
                機能要件
              </button>
              <button
                onClick={() => qaList.length > 0 && setFocusMode('questions')}
                disabled={qaList.length === 0}
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  qaList.length === 0
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
                {qaList.length > 0 ? (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    focusMode === 'questions'
                      ? "bg-white/20"
                      : darkMode
                        ? "bg-cyan-600 text-white"
                        : "bg-purple-600 text-white"
                  }`}>
                    {qaList.filter(q => !q.answer).length}件未回答
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
            {/* 機能要件編集エリア（左側） */}
            <div
              className={`transition-all duration-300 ${
                focusMode === 'document'
                  ? 'flex-[1_1_65%] opacity-100'
                  : 'flex-[0_0_320px] opacity-70 hover:opacity-100'
              }`}
            >
              <FunctionEditor
                projectId={projectId}
                functionDocument={functionDocument}
                requirements={requirements}
                overallConfidence={overallConfidence}
                onDocumentUpdate={handleDocumentUpdate}
                onRequirementsUpdate={handleRequirementsUpdate}
                onQuestionsUpdate={handleQuestionsUpdate}
                onConfidenceUpdate={handleConfidenceUpdate}
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
                  機能要件の確認と質問への回答が完了したら、次のステップに進みましょう。
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

      {/* AI Chat Widget */}
      {projectId && (
        <AgentChatWidget
          projectId={projectId}
          pageContext="functionSummary"
          onAction={handleChatAction}
        />
      )}
    </>
  );
}
