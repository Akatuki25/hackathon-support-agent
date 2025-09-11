"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, RefreshCcw, AlertTriangle, CheckCircle, Loader2, Edit3, Plus, X, Trash2, Edit2 } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/mantine/style.css";
import { getProjectDocument, patchProjectDocument } from "@/libs/modelAPI/document";
import { ProjectDocumentType } from "@/types/modelTypes";
import { evaluateSummary, generateSummary } from "@/libs/service/summary";
import { QAType } from "@/types/modelTypes";
import { patchQA, postQA, deleteQA } from "@/libs/modelAPI/qa";
 
type FlowState = 'loading' | 'ready';

export default function SummaryQA() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[2];
  const { darkMode } = useDarkMode();

  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [processingNext, setProcessingNext] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [savingQA, setSavingQA] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [projectDocument, setProjectDocument] = useState<ProjectDocumentType | null>(null);
  const [score, setScore] = useState<number>(0);
  const [question, setQuestion] = useState<QAType[]>([]);
  const [mvpFeasible, setMvpFeasible] = useState<boolean>(false);
  const [showAddQA, setShowAddQA] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editingQA, setEditingQA] = useState<{id: string, field: 'question' | 'answer', value: string} | null>(null);

  // BlockNote エディターの初期化 - Hooks順序を固定
  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "paragraph",
        content: "仕様書を記述してください...",
      }
    ],
    domAttributes: {
      editor: {
        class: "focus:outline-none",
      },
    },
  });

  // コンテンツが初期化されたかどうかのフラグ
  const [isContentInitialized, setIsContentInitialized] = useState(false);

  // エディターのコンテンツを初期化 - 再レンダリングを防ぐ
  useEffect(() => {
    if (projectDocument?.specification && editor && editor.document && projectDocument.specification.trim() && !isContentInitialized) {
      try {
        editor.tryParseMarkdownToBlocks(projectDocument.specification)
          .then(blocks => {
            if (editor.document && blocks) {
              editor.replaceBlocks(editor.document, blocks);
              setIsContentInitialized(true);
            }
          })
          .catch(error => {
            console.warn("マークダウン解析に失敗:", error);
            setIsContentInitialized(true);
          });
      } catch (error) {
        console.warn("エディター初期化エラー:", error);
        setIsContentInitialized(true);
      }
    }
  }, [projectDocument?.specification, editor, isContentInitialized]);

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
      router.push(`/hackSetUp/${projectId}/selectFramework`);
    }, 1000);
  };

  const regenerateAndEvaluate = async () => {
    if (!projectId) return;
    setRegenerating(true);
    try {
      const summary = await generateSummary(projectId);
      setProjectDocument(prev => 
        prev ? { ...prev, specification: summary } : null
      );
      const evaluation = await evaluateSummary(projectId);
      setQuestion(evaluation.qa);
      setScore(evaluation.score_0_100);
      setMvpFeasible(evaluation.mvp_feasible);
      // エディターの内容を再初期化
      setIsContentInitialized(false);
    } catch (error) {
      console.error("評価の取得に失敗:", error);
    } finally {
      setRegenerating(false);
    }
  };

  // QAについて
  const saveQA = async (updatedQA: QAType[]) => {
    if (!projectId) return;
    setSavingQA(true);
    setSaveSuccess(false);
    try {
      // 並列処理ではなく順次処理に変更
      for (const qa of updatedQA) {
        await patchQA(qa.qa_id, {
          answer: qa.answer,
        });
      }
      setQuestion(updatedQA);
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
      setQuestion(question.map(qa => 
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
        follows_qa_id: question.length > 0 ? question[question.length - 1].qa_id : null,
      };

      await postQA(newQA);
      
      // 最新のQ&Aリストを再取得
      const evaluation = await evaluateSummary(projectId);
      setQuestion(evaluation.qa);
      
      setNewQuestion("");
      setNewAnswer("");
      setShowAddQA(false);
    } catch (error) {
      console.error("Q&Aの追加に失敗:", error);
      alert("Q&Aの追加に失敗しました");
    }
  };

  // Q&Aを削除
  const handleDeleteQA = async (qaId: string) => {
    try {
      await deleteQA(qaId);
      
      // ローカルステートを更新
      setQuestion(question.filter(qa => qa.qa_id !== qaId));
    } catch (error) {
      console.error("Q&Aの削除に失敗:", error);
      alert("Q&Aの削除に失敗しました");
    }
  };




  // デバウンス用のタイマー
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // BlockNote エディターの変更処理 - useCallbackで最適化
  const handleBlockNoteChange = useCallback(async () => {
    if (!projectDocument || !editor || !editor.document) return;

    // 前のタイマーをクリア
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    // 新しいタイマーを設定（デバウンス処理）
    const newTimer = setTimeout(async () => {
      try {
        if (!editor.document) return;
        
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        
        // 内容が変わっていない場合は保存しない
        if (markdown === projectDocument.specification) {
          return;
        }

        await patchProjectDocument(projectId, {
          specification: markdown
        });
        
        setProjectDocument(prev => 
          prev ? { ...prev, specification: markdown } : null
        );
      } catch (error) {
        console.error("サマリーの更新に失敗:", error);
      }
    }, 1000); // 1秒後に保存

    setSaveTimer(newTimer);
  }, [projectDocument, editor, projectId, saveTimer]);

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
    };
  }, [saveTimer]);

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

          <div className="flex flex-col lg:flex-row gap-6 min-h-[70vh]">
            {/* Edit部分 */}
            <div
              className={`flex-1 backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
                darkMode
                  ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                  : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2
                  className={`text-xl font-medium flex items-center ${
                    darkMode ? "text-cyan-400" : "text-purple-700"
                  }`}
                >
                  <Edit3 size={20} className="mr-2" />
                  仕様書編集
                </h2>
                <div className="flex items-center space-x-2">
                  <div className={`px-3 py-1 rounded-full text-sm ${
                    mvpFeasible
                      ? darkMode ? "bg-green-900/50 text-green-400" : "bg-green-100 text-green-700"
                      : darkMode ? "bg-red-900/50 text-red-400" : "bg-red-100 text-red-700"
                  }`}>
                    {mvpFeasible ? "実現可能" : "要改善"}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm ${
                    darkMode ? "bg-cyan-900/50 text-cyan-400" : "bg-purple-100 text-purple-700"
                  }`}>
                    スコア: {score}/100
                  </div>
                </div>
              </div>

              {projectDocument ? (
                <div className="custom-blocknote">
                  <style jsx global>{`
                    .custom-blocknote .bn-container {
                      background-color: ${darkMode ? '#1f2937' : '#f8fafc'} !important;
                      border: 1px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
                      border-radius: 0.5rem !important;
                      min-height: 400px !important;
                    }
                    
                    .custom-blocknote .bn-container[data-color-scheme="${darkMode ? 'dark' : 'light'}"] {
                      --bn-colors-editor-text: ${darkMode ? '#e2e8f0' : '#1f2937'};
                      --bn-colors-editor-background: ${darkMode ? '#1f2937' : '#f8fafc'};
                      --bn-colors-menu-background: ${darkMode ? '#111827' : '#ffffff'};
                      --bn-colors-menu-text: ${darkMode ? '#e2e8f0' : '#1f2937'};
                      --bn-colors-tooltip-background: ${darkMode ? '#111827' : '#ffffff'};
                      --bn-colors-tooltip-text: ${darkMode ? '#e2e8f0' : '#1f2937'};
                      --bn-colors-hovered: ${darkMode ? '#0f766e' : '#c4b5fd'};
                      --bn-colors-selected: ${darkMode ? '#06b6d4' : '#9333ea'};
                      --bn-colors-border: ${darkMode ? '#06b6d4' : '#9333ea'};
                      --bn-colors-side-menu: ${darkMode ? '#e2e8f0' : '#1f2937'};
                      --bn-colors-highlights-gray-background: ${darkMode ? '#374151' : '#f3f4f6'};
                      --bn-colors-highlights-gray-text: ${darkMode ? '#e2e8f0' : '#1f2937'};
                      --bn-colors-highlights-red-background: ${darkMode ? '#dc2626' : '#fca5a5'};
                      --bn-colors-highlights-red-text: ${darkMode ? '#ffffff' : '#7f1d1d'};
                      --bn-colors-highlights-orange-background: ${darkMode ? '#ea580c' : '#fdba74'};
                      --bn-colors-highlights-orange-text: ${darkMode ? '#ffffff' : '#9a3412'};
                      --bn-colors-highlights-yellow-background: ${darkMode ? '#ca8a04' : '#fde047'};
                      --bn-colors-highlights-yellow-text: ${darkMode ? '#ffffff' : '#a16207'};
                      --bn-colors-highlights-green-background: ${darkMode ? '#16a34a' : '#86efac'};
                      --bn-colors-highlights-green-text: ${darkMode ? '#ffffff' : '#166534'};
                      --bn-colors-highlights-blue-background: ${darkMode ? '#2563eb' : '#93c5fd'};
                      --bn-colors-highlights-blue-text: ${darkMode ? '#ffffff' : '#1e40af'};
                      --bn-colors-highlights-purple-background: ${darkMode ? '#9333ea' : '#c4b5fd'};
                      --bn-colors-highlights-purple-text: ${darkMode ? '#ffffff' : '#6b21a8'};
                      --bn-colors-highlights-pink-background: ${darkMode ? '#ec4899' : '#f9a8d4'};
                      --bn-colors-highlights-pink-text: ${darkMode ? '#ffffff' : '#be185d'};
                      --bn-border-radius: 0.5rem;
                      --bn-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
                    }
                    
                    .custom-blocknote .ProseMirror {
                      padding: 1rem !important;
                      min-height: 360px !important;
                      color: ${darkMode ? '#e2e8f0' : '#1f2937'} !important;
                      outline: none !important;
                    }
                    
                    .custom-blocknote .ProseMirror:focus {
                      outline: none !important;
                      box-shadow: none !important;
                    }
                    
                    /* スラッシュメニュー修正 */
                    .custom-blocknote .bn-suggestion-menu {
                      z-index: 1000 !important;
                      background-color: ${darkMode ? '#111827' : '#ffffff'} !important;
                      border: 1px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
                      border-radius: 0.5rem !important;
                    }
                    
                    .custom-blocknote .bn-suggestion-menu-item {
                      color: ${darkMode ? '#e2e8f0' : '#1f2937'} !important;
                    }
                    
                    .custom-blocknote .bn-suggestion-menu-item[aria-selected="true"] {
                      background-color: ${darkMode ? '#0f766e' : '#c4b5fd'} !important;
                      color: #ffffff !important;
                    }
                    
                    .custom-blocknote .ProseMirror h1 {
                      color: ${darkMode ? '#f472b6' : '#3b82f6'} !important;
                      border-bottom: 1px solid ${darkMode ? '#f472b6' : '#3b82f6'} !important;
                      padding-bottom: 0.3em !important;
                      margin-top: 1.5em !important;
                      margin-bottom: 0.5em !important;
                      font-weight: bold !important;
                    }
                    
                    .custom-blocknote .ProseMirror h2,
                    .custom-blocknote .ProseMirror h3 {
                      color: ${darkMode ? '#5eead4' : '#7c3aed'} !important;
                      border-bottom: 1px solid ${darkMode ? '#0f766e' : '#c4b5fd'} !important;
                      padding-bottom: 0.3em !important;
                      margin-top: 1.5em !important;
                      margin-bottom: 0.5em !important;
                      font-weight: bold !important;
                    }
                    
                    .custom-blocknote .ProseMirror code {
                      background-color: ${darkMode ? '#1f2937' : '#f3f4f6'} !important;
                      color: ${darkMode ? '#5eead4' : '#7c3aed'} !important;
                      padding: 0.2em 0.4em !important;
                      border-radius: 3px !important;
                      font-family: monospace !important;
                    }
                    
                    .custom-blocknote .ProseMirror pre {
                      background-color: ${darkMode ? '#1f2937' : '#f3f4f6'} !important;
                      border-left: 3px solid ${darkMode ? '#f472b6' : '#3b82f6'} !important;
                      padding: 1em !important;
                      border-radius: 5px !important;
                      margin: 1em 0 !important;
                      overflow: auto !important;
                    }
                    
                    .custom-blocknote .ProseMirror pre code {
                      background-color: transparent !important;
                      padding: 0 !important;
                      border-radius: 0 !important;
                    }
                    
                    .custom-blocknote .ProseMirror p {
                      margin-bottom: 1em !important;
                      line-height: 1.6 !important;
                    }
                    
                    .custom-blocknote .ProseMirror ul,
                    .custom-blocknote .ProseMirror ol {
                      margin-left: 1.5em !important;
                      margin-bottom: 1em !important;
                      padding-left: 0.5em !important;
                    }
                    
                    .custom-blocknote .ProseMirror li {
                      margin-bottom: 0.5em !important;
                      position: relative !important;
                      display: list-item !important;
                      list-style-position: outside !important;
                    }
                    
                    .custom-blocknote .ProseMirror ul li {
                      list-style-type: disc !important;
                    }
                    
                    .custom-blocknote .ProseMirror ol li {
                      list-style-type: decimal !important;
                    }
                    
                    .custom-blocknote .ProseMirror ul ul li {
                      list-style-type: circle !important;
                    }
                    
                    .custom-blocknote .ProseMirror ul ul ul li {
                      list-style-type: square !important;
                    }
                    
                    /* BlockNote specific list styling - 修正 */
                    .custom-blocknote [data-content-type="bulletListItem"] {
                      display: list-item !important;
                      list-style-type: disc !important;
                      list-style-position: outside !important;
                      margin-left: 1.5em !important;
                      padding-left: 0.5em !important;
                    }
                    
                    .custom-blocknote [data-content-type="numberedListItem"] {
                      display: list-item !important;
                      list-style-type: decimal !important;
                      list-style-position: outside !important;
                      margin-left: 1.5em !important;
                      padding-left: 0.5em !important;
                    }
                    
                    /* リストのネスト対応 */
                    .custom-blocknote [data-content-type="bulletListItem"] [data-content-type="bulletListItem"] {
                      list-style-type: circle !important;
                      margin-left: 1em !important;
                    }
                    
                    .custom-blocknote [data-content-type="bulletListItem"] [data-content-type="bulletListItem"] [data-content-type="bulletListItem"] {
                      list-style-type: square !important;
                    }
                    
                    /* デバッグ文字の非表示 */
                    .custom-blocknote [data-content-type]:before {
                      display: none !important;
                    }
                    
                    .custom-blocknote .bn-block-content[data-content-type]:before {
                      display: none !important;
                    }
                    
                    .custom-blocknote .ProseMirror a {
                      color: ${darkMode ? '#f472b6' : '#3b82f6'} !important;
                      text-decoration: none !important;
                      border-bottom: 1px dashed ${darkMode ? '#f472b6' : '#3b82f6'} !important;
                    }
                    
                    .custom-blocknote .ProseMirror blockquote {
                      border-left: 4px solid ${darkMode ? '#06b6d4' : '#9333ea'} !important;
                      margin: 1em 0 !important;
                      padding-left: 1em !important;
                      font-style: italic !important;
                      color: ${darkMode ? '#94a3b8' : '#64748b'} !important;
                    }
                  `}</style>
                  <BlockNoteView
                    key="blocknote-editor"
                    editor={editor}
                    editable={true}
                    onChange={handleBlockNoteChange}
                    data-testid="blocknote-editor"
                    theme={{
                      colors: {
                        editor: {
                          text: darkMode ? '#e2e8f0' : '#1f2937',
                          background: darkMode ? '#1f2937' : '#f8fafc',
                        },
                        menu: {
                          text: darkMode ? '#e2e8f0' : '#1f2937',
                          background: darkMode ? '#111827' : '#ffffff',
                        },
                        tooltip: {
                          text: darkMode ? '#e2e8f0' : '#1f2937',
                          background: darkMode ? '#111827' : '#ffffff',
                        },
                        hovered: {
                          text: darkMode ? '#ffffff' : '#ffffff',
                          background: darkMode ? '#0f766e' : '#c4b5fd',
                        },
                        selected: {
                          text: darkMode ? '#ffffff' : '#ffffff',
                          background: darkMode ? '#06b6d4' : '#9333ea',
                        },
                        disabled: {
                          text: darkMode ? '#6b7280' : '#9ca3af',
                          background: 'transparent'
                        },
                        shadow: darkMode ? '#00000040' : '#00000020',
                        border: darkMode ? '#06b6d4' : '#9333ea',
                        sideMenu: darkMode ? '#e2e8f0' : '#1f2937',
                        highlights: {
                          gray: { background: darkMode ? '#374151' : '#f3f4f6', text: darkMode ? '#e2e8f0' : '#1f2937' },
                          brown: { background: darkMode ? '#a16207' : '#fbbf24', text: darkMode ? '#ffffff' : '#92400e' },
                          red: { background: darkMode ? '#dc2626' : '#fca5a5', text: darkMode ? '#ffffff' : '#7f1d1d' },
                          orange: { background: darkMode ? '#ea580c' : '#fdba74', text: darkMode ? '#ffffff' : '#9a3412' },
                          yellow: { background: darkMode ? '#ca8a04' : '#fde047', text: darkMode ? '#ffffff' : '#a16207' },
                          green: { background: darkMode ? '#16a34a' : '#86efac', text: darkMode ? '#ffffff' : '#166534' },
                          blue: { background: darkMode ? '#2563eb' : '#93c5fd', text: darkMode ? '#ffffff' : '#1e40af' },
                          purple: { background: darkMode ? '#9333ea' : '#c4b5fd', text: darkMode ? '#ffffff' : '#6b21a8' },
                          pink: { background: darkMode ? '#ec4899' : '#f9a8d4', text: darkMode ? '#ffffff' : '#be185d' },
                        },
                      },
                      borderRadius: 8,
                      fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
                    }}
                  />
                </div>
              ) : (
                <div className={`p-4 rounded-lg border min-h-40 flex items-center justify-center ${
                  darkMode
                    ? "bg-gray-700/50 border-cyan-500/30 text-gray-300"
                    : "bg-purple-50/70 border-purple-300/50 text-gray-700"
                }`}>
                  <p>仕様書を読み込み中...</p>
                </div>
              )}

              <div className="mt-4 flex justify-center">
                <button
                  onClick={regenerateAndEvaluate}
                  disabled={regenerating}
                  className={`px-6 py-2 flex items-center rounded-lg shadow focus:outline-none transform transition ${
                    regenerating 
                      ? "cursor-not-allowed opacity-70" 
                      : "hover:-translate-y-0.5"
                  } ${
                    darkMode
                      ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400"
                      : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
                  } ${
                    regenerating && (darkMode ? "bg-cyan-600" : "from-purple-600 to-blue-700")
                  }`}
                >
                  {regenerating ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      再生成中...
                    </>
                  ) : (
                    <>
                      <RefreshCcw size={16} className="mr-2" />
                      仕様書を再生成・評価
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Question部分 */}
            <div
              className={`flex-1 backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all flex flex-col ${
                darkMode
                  ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                  : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2
                  className={`text-xl font-medium flex items-center ${
                    darkMode ? "text-cyan-400" : "text-purple-700"
                  }`}
                >
                  <AlertTriangle size={20} className="mr-2" />
                  追加質問
                </h2>
                <div className="flex items-center space-x-2">
                  <div className={`px-3 py-1 rounded-full text-sm ${
                    darkMode ? "bg-cyan-900/50 text-cyan-400" : "bg-purple-100 text-purple-700"
                  }`}>
                    {question.length}件
                  </div>
                  <button
                    onClick={() => setShowAddQA(true)}
                    className={`p-2 rounded-lg hover:scale-105 transition-all ${
                      darkMode
                        ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                        : "bg-purple-500 hover:bg-purple-600 text-white"
                    }`}
                  >
                    <Plus size={16} />
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
                          onChange={(e) => setNewAnswer(e.target.value)}
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
                      
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setShowAddQA(false)}
                          className={`px-4 py-2 rounded-lg border transition-all ${
                            darkMode
                              ? "border-gray-600 text-gray-400 hover:text-gray-300"
                              : "border-gray-300 text-gray-600 hover:text-gray-700"
                          }`}
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={handleAddNewQA}
                          className={`px-4 py-2 rounded-lg transition-all ${
                            darkMode
                              ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                              : "bg-purple-500 hover:bg-purple-600 text-white"
                          }`}
                        >
                          追加
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {question.length > 0 ? (
                  question.map((qa, index) => (
                    <div key={qa.qa_id} className={`p-4 rounded-lg border ${
                      darkMode
                        ? "bg-gray-700/40 border-cyan-500/30"
                        : "bg-purple-50/70 border-purple-300/50"
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          {editingQA?.id === qa.qa_id && editingQA.field === 'question' ? (
                            <input
                              type="text"
                              value={editingQA.value}
                              onChange={(e) => setEditingQA({...editingQA, value: e.target.value})}
                              onBlur={handleEndEdit}
                              onKeyDown={(e) => e.key === 'Enter' && handleEndEdit()}
                              className={`w-full p-2 rounded border text-sm font-medium ${
                                darkMode
                                  ? "bg-gray-800 border-cyan-500/50 text-cyan-300"
                                  : "bg-white border-purple-300 text-purple-600"
                              } focus:outline-none`}
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
                          onChange={(e) => setEditingQA({...editingQA, value: e.target.value})}
                          onBlur={handleEndEdit}
                          rows={3}
                          className={`w-full p-3 rounded-lg border transition-all resize-none ${
                            darkMode
                              ? "bg-gray-800 border-cyan-500/50 text-cyan-100 focus:border-cyan-400"
                              : "bg-white border-purple-300 text-gray-800 focus:border-purple-500"
                          } focus:outline-none focus:ring-2 ${
                            darkMode ? "focus:ring-cyan-500/20" : "focus:ring-purple-500/20"
                          }`}
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => handleStartEdit(qa.qa_id, 'answer', qa.answer || '')}
                          className={`w-full p-3 rounded-lg border transition-all resize-none cursor-pointer hover:bg-opacity-50 ${
                            darkMode
                              ? "bg-gray-800 border-cyan-500/50 text-cyan-100 hover:bg-cyan-500"
                              : "bg-white border-purple-300 text-gray-800 hover:bg-purple-500"
                          } min-h-[80px] flex items-center`}
                        >
                          {qa.answer || (
                            <span className={darkMode ? "text-gray-500" : "text-gray-400"}>
                              回答を入力してください...
                              <Edit2 size={14} className="inline ml-2 opacity-50" />
                            </span>
                          )}
                          {qa.answer && <Edit2 size={14} className="ml-auto opacity-50" />}
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

              {question.length > 0 && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => saveQA(question)}
                    disabled={savingQA}
                    className={`px-6 py-2 flex items-center rounded-lg shadow focus:outline-none transform transition ${
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
                        <CheckCircle size={16} className="mr-2 text-white" />
                        保存完了
                      </>
                    ) : savingQA ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} className="mr-2" />
                        回答を保存
                      </>
                    )}
                  </button>
                </div>
              )}
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