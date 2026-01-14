"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, Loader2, MessageSquare, FileText } from "lucide-react";
import useSWR from "swr";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import FunctionEditor from "@/components/FunctionEditor/FunctionEditor";
import QASection from "@/components/QASection/QASection";
import {
  FunctionalRequirement,
  getFunctionalRequirements,
  streamGenerateFunctionalRequirements,
  StreamingQA,
} from "@/libs/service/function";
import { QAType, ChatAction } from "@/types/modelTypes";
import { AgentChatWidget } from "@/components/chat";

type FocusMode = 'questions' | 'document';

export default function FunctionSummary() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[2];

  const [processingNext, setProcessingNext] = useState(false);
  // 追加質問がある場合は質問フォーカス、なければ機能要件フォーカス
  const [focusMode, setFocusMode] = useState<FocusMode>('document');

  // ストリーミング用の状態
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingDoc, setStreamingDoc] = useState('');
  const streamingStartedRef = useRef(false);

  // Q&Aリスト
  const [qaList, setQaList] = useState<QAType[]>([]);

  // SWRでプロジェクトドキュメント取得のみ（生成は別途）
  const { data: existingDoc, mutate: mutateDocument, isLoading: isDocLoading } = useSWR(
    projectId ? `function-doc-${projectId}` : null,
    async () => {
      try {
        const doc = await getFunctionalRequirements(projectId);
        if (doc?.function_doc && doc.function_doc.trim() !== '') {
          return doc;
        }
      } catch {
        // ドキュメントがない場合
      }
      return null;
    },
    { revalidateOnFocus: false }
  );

  // ドキュメントがない場合にストリーミング生成を開始
  useEffect(() => {
    if (isDocLoading || streamingStartedRef.current) return;
    if (existingDoc?.function_doc && existingDoc.function_doc.trim() !== '') return;

    // ストリーミング生成開始
    streamingStartedRef.current = true;
    setIsStreaming(true);
    setStreamingDoc('');

    streamGenerateFunctionalRequirements(projectId, {
      onChunk: (chunk, accumulated) => {
        setStreamingDoc(accumulated);
      },
      onDocDone: async (data) => {
        // ドキュメント完了時にSWRを更新
        const doc = await getFunctionalRequirements(projectId);
        mutateDocument(doc, false);
      },
      onQuestions: (questions: StreamingQA[]) => {
        // 追加質問を受信
        const convertedQAs: QAType[] = questions.map(q => ({
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
        setQaList(convertedQAs);

        // 追加質問があればフォーカスを切り替え
        if (convertedQAs.length > 0) {
          setFocusMode('questions');
        }
      },
      onDone: () => {
        setIsStreaming(false);
      },
      onError: () => {
        setIsStreaming(false);
      },
    });
  }, [projectId, existingDoc, isDocLoading, mutateDocument]);

  // ストリーミング中はローディングではなく、部分的なドキュメントを表示
  const isLoading = isDocLoading || (!isStreaming && !existingDoc && !streamingDoc);

  // 表示用のドキュメント
  const displayDocument = existingDoc?.function_doc || streamingDoc || null;

  // 次へ進む
  const handleNext = async () => {
    setProcessingNext(true);
    setTimeout(() => {
      router.push(`/hackSetUp/${projectId}/selectFramework`);
    }, 1000);
  };

  // QAListの更新処理（QASection用）
  const handleQAListUpdate = (updatedQAList: QAType[]) => {
    setQaList(updatedQAList);
  };

  // ドキュメント更新時の処理
  const handleDocumentUpdate = (newDocument: string | null) => {
    if (existingDoc) {
      mutateDocument({ ...existingDoc, function_doc: newDocument || '' }, false);
    }
  };

  // AIチャットアクションのハンドラー
  const handleChatAction = async (action: ChatAction) => {
    if (action.action_type === 'regenerate_questions') {
      // 追加質問を再生成（ストリーミングを再実行）
      streamingStartedRef.current = false;
      setIsStreaming(true);
      setStreamingDoc('');
      setQaList([]);

      streamGenerateFunctionalRequirements(projectId, {
        onChunk: (chunk, accumulated) => {
          setStreamingDoc(accumulated);
        },
        onDocDone: async () => {
          const doc = await getFunctionalRequirements(projectId);
          mutateDocument(doc, false);
        },
        onQuestions: (questions: StreamingQA[]) => {
          const convertedQAs: QAType[] = questions.map(q => ({
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
          setQaList(convertedQAs);

          if (convertedQAs.length > 0) {
            setFocusMode('questions');
          }
        },
        onDone: () => {
          setIsStreaming(false);
          streamingStartedRef.current = true;
        },
        onError: () => {
          setIsStreaming(false);
          streamingStartedRef.current = true;
        },
      });
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
                className="mr-2 text-purple-600 dark:text-cyan-400"
              />
              <h1
                className="text-3xl font-bold tracking-wider text-purple-700 dark:text-cyan-400"
              >
                機能要件
                <span className="text-blue-600 dark:text-pink-500">
                  _編集
                </span>
              </h1>
            </div>
            <p
              className="text-lg text-gray-700 dark:text-gray-300"
            >
              {isStreaming
                ? '機能要件を生成中...'
                : focusMode === 'questions'
                  ? '追加質問に回答すると、機能要件がより具体的になります'
                  : '機能要件を確認・編集してください'}
            </p>
          </div>

          {/* フォーカス切り替えタブ */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg p-1 bg-gray-100 dark:bg-gray-800">
              <button
                onClick={() => setFocusMode('document')}
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  focusMode === 'document'
                    ? "bg-purple-600 text-white dark:bg-cyan-600"
                    : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
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
                    ? "text-gray-400 cursor-not-allowed dark:text-gray-600"
                    : focusMode === 'questions'
                      ? "bg-purple-600 text-white dark:bg-cyan-600"
                      : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <MessageSquare size={18} className="mr-2" />
                追加質問
                {qaList.length > 0 ? (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    focusMode === 'questions'
                      ? "bg-white/20"
                      : "bg-purple-600 text-white dark:bg-cyan-600"
                  }`}>
                    {qaList.filter(q => !q.answer).length}件未回答
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
            {/* 機能要件編集エリア（左側） - ストリーミング中は常に広げる */}
            <div
              className={`transition-all duration-300 ${
                isStreaming || focusMode === 'document'
                  ? 'flex-[1_1_65%] opacity-100'
                  : 'flex-[0_0_320px] opacity-70 hover:opacity-100'
              }`}
            >
              <FunctionEditor
                projectId={projectId}
                functionDocument={displayDocument}
                requirements={[]}
                overallConfidence={0.8}
                onDocumentUpdate={handleDocumentUpdate}
                onRequirementsUpdate={() => {}}
                onQuestionsUpdate={() => {}}
                onConfidenceUpdate={() => {}}
                isStreaming={isStreaming}
              />
            </div>

            {/* 追加質問エリア（右側） - ストリーミング中は小さく */}
            <div
              className={`transition-all duration-300 ${
                !isStreaming && focusMode === 'questions'
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
              className="backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20 dark:bg-gray-800 dark:bg-opacity-70 dark:border-cyan-500/30 dark:shadow-cyan-500/20"
            >
              <div className="text-center py-4">
                <p className="mb-6 text-gray-700 dark:text-gray-300">
                  機能要件の確認と質問への回答が完了したら、次のステップに進みましょう。
                </p>

                <button
                  onClick={handleNext}
                  className="px-8 py-3 flex items-center mx-auto rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400 dark:bg-cyan-500 dark:hover:bg-cyan-600 dark:text-gray-900 dark:focus:ring-cyan-400 dark:from-cyan-500 dark:to-cyan-500 dark:hover:from-cyan-600 dark:hover:to-cyan-600"
                  disabled={processingNext || isStreaming}
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
