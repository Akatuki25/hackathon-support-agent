"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Boxes, ChevronRight, Loader2, Bot, CheckCircle, AlertCircle, ArrowRight, Edit3, Plus, Trash2, Terminal } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import {
  structureFunctions,
  getStructuredFunctions,
  createFunction,
  updateFunction,
  deleteFunction,
  type StructuredFunction,
  type StructuringResult,
  type CreateFunctionRequest,
} from "@/libs/modelAPI/functionStructuringAPI";
import { patchProjectDocument } from "@/libs/modelAPI/document";

// フレームワーク選択データの型定義
interface FrameworkSelectionData {
  selectedTechnologies: string[];
  selectedPlatform: 'web' | 'ios' | 'android' | null;
  useAIRecommendations: boolean;
}

// セットアップフェーズの型定義
type SetupPhase =
  | 'initializing'           // 初期化中
  | 'saving-framework'       // フレームワーク選択を保存中
  | 'structuring-functions'  // 機能構造化中
  | 'completed'              // 完了
  | 'error';                 // エラー

// セットアップエラーの型定義
interface SetupError {
  phase: SetupPhase;
  message: string;
  canContinue: boolean;
}

type ProcessingState = 'idle' | 'structuring' | 'completed' | 'error';

const CATEGORY_LABELS: Record<string, string> = {
  auth: '認証・権限',
  data: 'データ管理',
  logic: 'ビジネスロジック',
  ui: 'UI・画面',
  api: 'API・通信',
  deployment: 'デプロイ・インフラ'
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  auth: {
    bg: 'bg-red-500/10 dark:bg-red-500/5',
    border: 'border-red-500/30 dark:border-red-400/50',
    text: 'text-red-600 dark:text-red-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(248,113,113,0.4)]'
  },
  data: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/5',
    border: 'border-blue-500/30 dark:border-blue-400/50',
    text: 'text-blue-600 dark:text-blue-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(96,165,250,0.4)]'
  },
  logic: {
    bg: 'bg-green-500/10 dark:bg-green-500/5',
    border: 'border-green-500/30 dark:border-green-400/50',
    text: 'text-green-600 dark:text-green-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(74,222,128,0.4)]'
  },
  ui: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/5',
    border: 'border-purple-500/30 dark:border-purple-400/50',
    text: 'text-purple-600 dark:text-purple-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(192,132,252,0.4)]'
  },
  api: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/5',
    border: 'border-orange-500/30 dark:border-orange-400/50',
    text: 'text-orange-600 dark:text-orange-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(251,146,60,0.4)]'
  },
  deployment: {
    bg: 'bg-gray-500/10 dark:bg-gray-500/5',
    border: 'border-gray-500/30 dark:border-gray-400/50',
    text: 'text-gray-600 dark:text-gray-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(156,163,175,0.4)]'
  }
};

const PRIORITY_LABELS: Record<string, string> = {
  Must: '必須',
  Should: '重要',
  Could: '推奨',
  Wont: '将来'
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Must: { bg: 'bg-red-500', text: 'text-white' },
  Should: { bg: 'bg-yellow-500', text: 'text-white' },
  Could: { bg: 'bg-blue-500', text: 'text-white' },
  Wont: { bg: 'bg-gray-500', text: 'text-white' }
};

export default function FunctionStructuring() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = pathname.split("/")[2];
  const { darkMode } = useDarkMode();
  const { data: session, status } = useSession();

  // セットアップフェーズ関連の状態
  const [setupPhase, setSetupPhase] = useState<SetupPhase>('initializing');
  const [setupError, setSetupError] = useState<SetupError | null>(null);
  const [frameworkData, setFrameworkData] = useState<FrameworkSelectionData | null>(null);

  // 既存の状態
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [structuringResult, setStructuringResult] = useState<StructuringResult | null>(null);
  const [error, setError] = useState<string>("");
  const [agentProgress, setAgentProgress] = useState<string>("");
  const [editingFunction, setEditingFunction] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<StructuredFunction>>({});
  const [isAddingFunction, setIsAddingFunction] = useState(false);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [newFunctionData, setNewFunctionData] = useState<CreateFunctionRequest>({
    project_id: projectId,
    function_name: '',
    description: '',
    category: 'logic',
    priority: 'Should'
  });

  // Textarea の ref
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const newTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Textarea の高さを自動調整する関数
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  };

  // 編集モーダルが開いたときに高さを調整
  useEffect(() => {
    if (isEditingModalOpen && editTextareaRef.current) {
      adjustTextareaHeight(editTextareaRef.current);
    }
  }, [isEditingModalOpen, editingValues.description]);

  // 新規追加モーダルが開いたときに高さを調整
  useEffect(() => {
    if (isAddingFunction && newTextareaRef.current) {
      adjustTextareaHeight(newTextareaRef.current);
    }
  }, [isAddingFunction, newFunctionData.description]);

  // フレームワーク選択データから理由文字列を生成
  const buildFrameworkReason = (data: FrameworkSelectionData): string => {
    const technologies = data.selectedTechnologies.join(", ");

    if (data.useAIRecommendations) {
      return `選択理由: AI推薦により${technologies}を使用`;
    } else {
      return `選択理由: ${data.selectedPlatform}プラットフォームで${technologies}を使用`;
    }
  };

  // フレームワーク選択を保存
  const saveFrameworkSelection = async (data: FrameworkSelectionData) => {
    const reason = buildFrameworkReason(data);
    await patchProjectDocument(projectId, {
      frame_work_doc: reason
    });
  };

  // セットアップエラーをハンドリング
  const handleSetupError = (phase: SetupPhase, error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';

    switch (phase) {
      case 'saving-framework':
        setSetupError({
          phase,
          message: `フレームワーク選択の保存に失敗しました: ${errorMessage}`,
          canContinue: true
        });
        console.warn('フレームワーク選択の保存に失敗しましたが、処理を続行します:', error);
        break;

      case 'structuring-functions':
        setSetupError({
          phase,
          message: `機能構造化に失敗しました: ${errorMessage}`,
          canContinue: false
        });
        setSetupPhase('error');
        console.error('機能構造化に失敗しました:', error);
        break;

      default:
        setSetupError({
          phase,
          message: errorMessage,
          canContinue: false
        });
        setSetupPhase('error');
        console.error('予期しないエラーが発生しました:', error);
    }
  };

  // 機能構造化を実行
  const handleStructureFunctions = async () => {
    setProcessingState('structuring');
    setError("");
    setAgentProgress("コンテキスト情報を収集中...");

    try {
      const result = await structureFunctions(projectId);

      if (result.success) {
        setAgentProgress("構造化された機能を取得中...");
        const structuredData = await getStructuredFunctions(projectId);
        setStructuringResult(structuredData);
        setProcessingState('completed');
        setAgentProgress("機能構造化が完了しました！");
      } else if ('partial_success' in result && result.partial_success) {
        // 部分的に成功した場合
        console.warn('部分的な成功:', result);
        const partialResult = result as { partial_success: boolean; saved_functions_count?: number; error?: string };
        setAgentProgress(`部分的に機能を構造化しました (${partialResult.saved_functions_count}個の機能を保存)`);

        // 保存された機能を取得
        try {
          const structuredData = await getStructuredFunctions(projectId);
          if (structuredData.total_functions > 0) {
            setStructuringResult(structuredData);
            setProcessingState('completed');
            setError(
              `AIエージェントが途中で停止しましたが、${partialResult.saved_functions_count}個の機能を正常に保存しました。\n\n` +
              `原因: ${partialResult.error}\n\n` +
              `保存された機能を確認して、必要に応じて手動で追加することができます。`
            );
          } else {
            throw new Error('保存された機能が見つかりませんでした');
          }
        } catch (fetchError) {
          throw new Error(`部分的に成功しましたが、データの取得に失敗しました: ${fetchError}`);
        }
      } else {
        throw new Error(result.error || '機能構造化に失敗しました');
      }
    } catch (error) {
      console.error('機能構造化エラー:', error);
      const errorMessage = error instanceof Error ? error.message : '機能構造化に失敗しました';

      // ユーザーフレンドリーなエラーメッセージに変換
      let friendlyMessage = errorMessage;
      if (errorMessage.includes('MALFORMED_FUNCTION_CALL')) {
        friendlyMessage =
          'AIエージェントの関数呼び出しで問題が発生しました。\n\n' +
          '考えられる原因:\n' +
          '• Google Gemini APIのレート制限に達した可能性があります\n' +
          '• トークン制限に達した可能性があります\n\n' +
          '対処方法:\n' +
          '• しばらく待ってから「再実行」ボタンをクリックしてください\n' +
          '• Gemini APIの無料プランでは1分間に10リクエストまでです';
      } else if (errorMessage.includes('Token limit') || errorMessage.includes('token')) {
        friendlyMessage =
          'AIモデルのトークン制限に達しました。\n\n' +
          '対処方法:\n' +
          '• 少し待ってから再実行してください\n' +
          '• 機能要件書が長すぎる場合は、分割して処理することを検討してください';
      } else if (errorMessage.includes('Rate limit') || errorMessage.includes('retry')) {
        friendlyMessage =
          'Google Gemini APIのレート制限に達しました。\n\n' +
          '対処方法:\n' +
          '• 1分ほど待ってから「再実行」ボタンをクリックしてください\n' +
          '• 無料プランでは1分間に10リクエストまでです';
      }

      setError(friendlyMessage);
      setProcessingState('error');
    }
  };

  // 機能の編集を開始（モーダルを開く）
  const handleEditFunction = (func: StructuredFunction) => {
    setEditingFunction(func.function_id);
    setEditingValues({
      function_name: func.function_name,
      description: func.description,
      category: func.category,
      priority: func.priority
    });
    setIsEditingModalOpen(true);
  };

  // 機能の編集を保存
  const handleSaveFunction = async (functionId: string) => {
    if (!editingValues.function_name?.trim() || !editingValues.description?.trim()) {
      alert('機能名と説明を入力してください');
      return;
    }

    // 楽観的更新（Optimistic Update）：APIレスポンスを待たずにUIを即座に更新
    if (structuringResult) {
      const optimisticUpdatedFunctions = structuringResult.functions.map(func => {
        if (func.function_id === functionId) {
          return {
            ...func,
            function_name: editingValues.function_name || func.function_name,
            description: editingValues.description || func.description,
            category: editingValues.category || func.category,
            priority: editingValues.priority || func.priority,
          };
        }
        return func;
      });

      setStructuringResult({
        ...structuringResult,
        functions: optimisticUpdatedFunctions
      });
    }

    // モーダルを即座に閉じる
    setEditingFunction(null);
    setEditingValues({});
    setIsEditingModalOpen(false);

    // バックグラウンドでAPIを呼び出して、サーバーと同期
    try {
      const updatedFunction = await updateFunction(functionId, editingValues);

      // APIレスポンスで状態を更新（詳細情報を含む完全なデータ）
      if (structuringResult) {
        const updatedFunctions = structuringResult.functions.map(func => {
          if (func.function_id === functionId) {
            return {
              ...func,
              ...updatedFunction,
              dependencies: updatedFunction.dependencies || func.dependencies,
              extraction_confidence: updatedFunction.extraction_confidence ?? func.extraction_confidence,
              implementation_order: updatedFunction.implementation_order ?? func.implementation_order,
              estimated_effort: updatedFunction.estimated_effort || func.estimated_effort,
            };
          }
          return func;
        });

        setStructuringResult({
          ...structuringResult,
          functions: updatedFunctions
        });
      }
    } catch (error) {
      console.error('機能の更新に失敗:', error);
      alert('機能の更新に失敗しました。変更を元に戻しています...');

      // エラーが発生した場合は、最新のデータを再取得
      try {
        const freshData = await getStructuredFunctions(projectId);
        setStructuringResult(freshData);
      } catch (fetchError) {
        console.error('データの再取得に失敗:', fetchError);
      }
    }
  };

  // 機能の編集をキャンセル
  const handleCancelEdit = () => {
    setEditingFunction(null);
    setEditingValues({});
    setIsEditingModalOpen(false);
  };

  // 機能を削除
  const handleDeleteFunction = async (functionId: string) => {
    if (!confirm('この機能を削除しますか？')) return;

    try {
      await deleteFunction(functionId);

      if (structuringResult) {
        const updatedFunctions = structuringResult.functions.filter(func => func.function_id !== functionId);
        setStructuringResult({
          ...structuringResult,
          functions: updatedFunctions,
          total_functions: updatedFunctions.length
        });
      }
    } catch (error) {
      console.error('機能の削除に失敗:', error);
      alert('機能の削除に失敗しました');
    }
  };

  // 新しい機能を追加（モーダルを開く）
  const handleOpenAddFunction = () => {
    setIsAddingFunction(true);
    setNewFunctionData({
      project_id: projectId,
      function_name: '',
      description: '',
      category: 'logic',
      priority: 'Should'
    });
  };

  // 新しい機能を保存
  const handleSaveNewFunction = async () => {
    if (!newFunctionData.function_name.trim() || !newFunctionData.description.trim()) {
      alert('機能名と説明を入力してください');
      return;
    }

    try {
      const createdFunction = await createFunction(newFunctionData);

      if (structuringResult) {
        setStructuringResult({
          ...structuringResult,
          functions: [...structuringResult.functions, createdFunction],
          total_functions: structuringResult.total_functions + 1
        });
      }
      setIsAddingFunction(false);
    } catch (error) {
      console.error('機能の追加に失敗:', error);
      alert('機能の追加に失敗しました');
    }
  };

  // タスク可視化ページへ進む
  const handleNext = () => {
    console.log("handleNext called");
    // セッション情報からgithubNameを取得
    const githubName = session?.user?.name || 'unknown';
    console.log("githubName:", githubName);
    console.log("projectId:", projectId);
    // from=setup パラメータを追加して、初回遷移を識別
    router.push(`/${githubName}/${projectId}?from=setup`);
  };

  // 認証とデータ初期化
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/");
      return;
    }

    const initializeAndStructure = async () => {
      try {
        // Step 1: URLパラメータからフレームワーク選択データを取得
        const technologies = searchParams.get('technologies');
        const platform = searchParams.get('platform');
        const aiRecommended = searchParams.get('aiRecommended');

        // フレームワーク選択ページから遷移してきたかどうかを判定
        const isInitialTransition = technologies && technologies.length > 0;

        if (isInitialTransition) {
          const data: FrameworkSelectionData = {
            selectedTechnologies: technologies.split(','),
            selectedPlatform: (platform || null) as 'web' | 'ios' | 'android' | null,
            useAIRecommendations: aiRecommended === 'true'
          };
          setFrameworkData(data);

          // Step 2: フレームワーク選択を保存
          setSetupPhase('saving-framework');
          try {
            await saveFrameworkSelection(data);
          } catch (error) {
            handleSetupError('saving-framework', error);
            // エラーでも続行
          }
        }

        // Step 3: 既存の機能構造化結果をチェック（ポーリング）
        // selectFrameworkでバックグラウンド呼び出しが開始されているので、
        // 結果が準備されるまで待つ
        const checkResult = async () => {
          try {
            const data = await getStructuredFunctions(projectId);
            if (data.total_functions > 0) {
              // 既存結果がある場合は表示のみ
              setStructuringResult(data);
              setProcessingState('completed');
              setSetupPhase('completed');
              return true;
            }
          } catch {
            // まだ結果がない
          }
          return false;
        };

        // 初回チェック
        if (await checkResult()) {
          return;
        }

        // Step 4: 初回遷移の場合のみポーリング
        if (isInitialTransition) {
          setSetupPhase('structuring-functions');
          setProcessingState('structuring');

          // 最大150秒間、5秒ごとにポーリング（バックグラウンド処理の完了を待つ）
          let pollCount = 0;
          const maxPolls = 30; // 150秒 (5秒 x 30回)
          while (pollCount < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            if (await checkResult()) {
              return;
            }
            pollCount++;
          }

          // ポーリングタイムアウト → 実行中 or 失敗
          // 手動実行ボタンを表示
          console.log('Background task timeout, showing manual execution button');
          setProcessingState('idle');
          setSetupPhase('completed');
        } else {
          // リロードやタブ切り替えの場合は idle 状態で待機
          setProcessingState('idle');
          setSetupPhase('completed');
        }

      } catch (error) {
        handleSetupError(setupPhase, error);
      }
    };

    if (projectId) {
      initializeAndStructure();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, session, status]);

  if (status === "loading" || setupPhase === 'initializing') {
    return <Loading />;
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-0 absolute">
        <Header />
      </div>

      <main className={`relative z-10 min-h-screen`}>
        {/* サイバーグリッド背景 */}
        {darkMode && (
          <>
            <div className="-z-10 absolute inset-0 bg-[linear-gradient(to_right,#4f46e520_1px,transparent_1px),linear-gradient(to_bottom,#4f46e520_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
            <div className="-z-10 absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="-z-10 absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '1s'}} />
          </>
        )}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4 mt-5">
              <Boxes
                className={`mr-2 ${darkMode ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" : "text-purple-600"}`}
              />
              <h1
                className={`text-3xl font-bold tracking-wider ${darkMode ? "text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]" : "text-purple-700"}`}
              >
                機能
                <span className={darkMode ? "text-pink-500 drop-shadow-[0_0_12px_rgba(236,72,153,0.5)]" : "text-blue-600"}>
                  _構造化
                </span>
              </h1>
            </div>
            <p
              className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              プロジェクトの機能を分析し、カテゴリ別に整理します
            </p>
          </div>

          {/* フレームワーク選択保存中 */}
          {setupPhase === 'saving-framework' && (
            <div className={`backdrop-blur-xl rounded-xl p-8 shadow-2x transition-all mb-8 ${
              darkMode
                ? "bg-slate-800/90"
                : "bg-white/60 "
            }`}>
              <div className="text-center">
                <Terminal size={48} className={`mx-auto mb-4 ${darkMode ? "text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]" : "text-purple-600"}`} />
                <h2 className={`text-xl font-bold mb-4 ${darkMode ? "text-cyan-300" : "text-purple-700"}`}>
                  フレームワーク選択を保存中
                </h2>
                <div className="flex items-center justify-center mb-4">
                  <Loader2 className="animate-spin mr-2" size={20} />
                  <span className={darkMode ? "text-gray-300" : "text-gray-700"}>
                    選択された技術スタックをデータベースに保存しています...
                  </span>
                </div>
                {frameworkData && (
                  <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                    選択技術: {frameworkData.selectedTechnologies.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 処理中の表示 */}
          {(processingState === 'structuring' || setupPhase === 'structuring-functions') && (
            <div className={`backdrop-blur-xl rounded-xl p-8 shadow-2xl border transition-all mb-8 ${
              darkMode
                ? "bg-slate-800/10 border-cyan-400/40 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
                : "bg-white/40 border-purple-500/40 shadow-purple-300/30"
            }`}>
              <div className="text-center">
                <Bot size={48} className={`mx-auto mb-4 ${darkMode ? "text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]" : "text-purple-600"}`} />
                <h2 className={`text-xl font-bold mb-4 ${darkMode ? "text-cyan-300" : "text-purple-700"}`}>
                  AI機能構造化エージェント実行中
                </h2>
                <div className="flex items-center justify-center mb-4">
                  <Loader2 className="animate-spin mr-2" size={20} />
                  <span className={darkMode ? "text-gray-300" : "text-gray-700"}>
                    {agentProgress}
                  </span>
                </div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  複数段階のバリデーションにより高品質な構造化を実行中...
                </div>
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {processingState === 'error' && (
            <div className={` rounded-xl p-8 transition-all mb-8 ${
              darkMode
                ? "bg-red-900/5 "
                : "bg-red-50/60"
            }`}>
              <div className="text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
                <h2 className={`text-xl font-bold mb-4 ${darkMode ? "text-red-400" : "text-red-700"}`}>
                  機能構造化エラー
                </h2>
                <div className={`mb-4 text-left max-w-2xl mx-auto whitespace-pre-line ${darkMode ? "text-red-300" : "text-red-600"}`}>
                  {error}
                </div>
                <button
                  onClick={handleStructureFunctions}
                  className={`px-6 py-2 rounded-full transition-colors ${
                    darkMode
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  }`}
                >
                  再実行
                </button>
              </div>
            </div>
          )}

          {/* セットアップエラー/警告表示 */}
          {setupError && setupError.canContinue && (
            <div className={`backdrop-blur-xl rounded-xl p-6 shadow-xl border transition-all mb-6 ${
              darkMode
                ? "bg-yellow-900/5 border-yellow-400/40 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                : "bg-yellow-50/60 border-yellow-300/60 shadow-yellow-200/40"
            }`}>
              <div className="flex items-start">
                <AlertCircle size={24} className={`mr-3 mt-1 flex-shrink-0 ${darkMode ? "text-yellow-400" : "text-yellow-600"}`} />
                <div className="flex-1">
                  <h3 className={`text-lg font-bold mb-2 ${darkMode ? "text-yellow-400" : "text-yellow-700"}`}>
                    警告: 一部の処理でエラーが発生しました
                  </h3>
                  <div className={`text-sm whitespace-pre-line ${darkMode ? "text-yellow-300" : "text-yellow-700"}`}>
                    {setupError.message}
                  </div>
                  <div className={`text-sm mt-2 ${darkMode ? "text-yellow-200" : "text-yellow-600"}`}>
                    処理を続行しています...
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 完了結果の表示 */}
          {(processingState === 'completed' || setupPhase === 'completed') && structuringResult && (
            <>
              {/* 部分的成功の警告 */}
              {error && (
                <div className={`backdrop-blur-xl rounded-xl p-6 shadow-xl border transition-all mb-6 ${
                  darkMode
                    ? "bg-yellow-900/5 border-yellow-400/40 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                    : "bg-yellow-50/60 border-yellow-300/60 shadow-yellow-200/40"
                }`}>
                  <div className="flex items-start">
                    <AlertCircle size={24} className={`mr-3 mt-1 flex-shrink-0 ${darkMode ? "text-yellow-400" : "text-yellow-600"}`} />
                    <div className="flex-1">
                      <h3 className={`text-lg font-bold mb-2 ${darkMode ? "text-yellow-400" : "text-yellow-700"}`}>
                        部分的な成功
                      </h3>
                      <div className={`text-sm whitespace-pre-line ${darkMode ? "text-yellow-300" : "text-yellow-700"}`}>
                        {error}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={`transition-all mb-8 ${
                darkMode
                  ? "bg-transparent "
                  : "bg-white/10"
              }`}>
                <div className="text-center mb-6">
                  <CheckCircle size={48} className={`mx-auto mb-4 ${darkMode ? "text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.6)]" : "text-green-600"}`} />
                  <h2 className={`text-xl font-bold mb-2 ${darkMode ? "text-cyan-300" : "text-purple-700"}`}>
                    機能構造化完了
                  </h2>
                  <p className={`${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    {structuringResult.total_functions}個の機能を{Object.keys(CATEGORY_LABELS).length}カテゴリに分類し、
                    {structuringResult.total_dependencies}個の依存関係を分析しました
                  </p>
                </div>

                {/* 機能追加ボタン */}
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleOpenAddFunction}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all backdrop-blur-md ${
                      darkMode
                        ? "bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                        : "bg-purple-100/70 hover:bg-purple-200/70 border border-purple-300 text-purple-700"
                    }`}
                  >
                    <Plus size={18} />
                    新しい機能を追加
                  </button>
                </div>

                {/* カテゴリ別機能表示 */}
                <div className="flex gap-6 overflow-x-auto pb-4">
                  {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                    const categoryFunctions = structuringResult.functions.filter(f => f.category === category);

                    if (categoryFunctions.length === 0) return null;

                    const colors = CATEGORY_COLORS[category];

                    return (
                      <div
                        key={category}
                        className={`rounded-xl p-4 border backdrop-blur-lg transition-all flex-shrink-0 w-80 ${colors.bg} ${colors.border} shadow-lg ${colors.glow}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className={`text-lg font-bold ${colors.text}`}>
                            {label} ({categoryFunctions.length})
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {categoryFunctions
                            .sort((a, b) => {
                              const priorityOrder = { Must: 0, Should: 1, Could: 2, Wont: 3 };
                              return priorityOrder[a.priority as keyof typeof priorityOrder] -
                                     priorityOrder[b.priority as keyof typeof priorityOrder];
                            })
                            .map((func) => {
                              const priorityColor = PRIORITY_COLORS[func.priority];

                              return (
                                <div
                                  key={func.function_id}
                                  className={`p-3 rounded-lg border backdrop-blur-md transition-all group ${
                                    darkMode
                                      ? "bg-slate-800/20 border-slate-600/40 hover:bg-slate-700/30 hover:border-slate-500/60 hover:shadow-[0_0_10px_rgba(100,116,139,0.2)]"
                                      : "bg-white/50 border-gray-200/60 hover:bg-white/70"
                                  }`}
                                >
                                  <div>
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <h4 className={`font-semibold text-sm flex-1 min-w-0 ${
                                          darkMode ? "text-gray-100" : "text-gray-900"
                                        }`}>
                                          {func.function_code}: {func.function_name}
                                        </h4>
                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${priorityColor.bg} ${priorityColor.text}`}>
                                            {PRIORITY_LABELS[func.priority]}
                                          </span>
                                          <button
                                            onClick={() => handleEditFunction(func)}
                                            className={`p-1 rounded transition-colors ${
                                              darkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"
                                            }`}
                                            title="編集"
                                          >
                                            <Edit3 size={12} />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteFunction(func.function_id)}
                                            className={`p-1 rounded transition-colors ${
                                              darkMode ? "hover:bg-red-700 text-red-400" : "hover:bg-red-100 text-red-600"
                                            }`}
                                            title="削除"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>
                                      <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                        {func.description}
                                      </p>

                                      {/* 詳細情報 */}
                                      <div className="mt-2 space-y-1">
                                        {/* 信頼度 */}
                                        <div className="flex items-center justify-between">
                                          <span className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-600"}`}>
                                            信頼度:
                                          </span>
                                          <div className="flex items-center">
                                            <div className={`w-16 h-2 rounded-full mr-2 ${
                                              darkMode ? "bg-gray-700" : "bg-gray-200"
                                            }`}>
                                              <div
                                                className={`h-2 rounded-full ${
                                                  func.extraction_confidence > 0.8
                                                    ? "bg-green-500"
                                                    : func.extraction_confidence > 0.6
                                                    ? "bg-yellow-500"
                                                    : "bg-red-500"
                                                }`}
                                                style={{ width: `${func.extraction_confidence * 100}%` }}
                                              />
                                            </div>
                                            <span className={`text-xs ${
                                              darkMode ? "text-gray-400" : "text-gray-600"
                                            }`}>
                                              {Math.round(func.extraction_confidence * 100)}%
                                            </span>
                                          </div>
                                        </div>

                                        {/* 依存関係情報 */}
                                        {(func.dependencies.incoming.length > 0 || func.dependencies.outgoing.length > 0) && (
                                          <div className="flex items-center flex-wrap gap-1 text-xs">
                                            <span className={`${darkMode ? "text-gray-500" : "text-gray-600"}`}>
                                              依存関係:
                                            </span>
                                            {func.dependencies.incoming.length > 0 && (
                                              <span className={`px-1 py-0.5 rounded text-xs whitespace-nowrap ${
                                                darkMode ? "bg-blue-900/20 text-blue-300" : "bg-blue-100 text-blue-700"
                                              }`}>
                                                入力 {func.dependencies.incoming.length}
                                              </span>
                                            )}
                                            {func.dependencies.outgoing.length > 0 && (
                                              <span className={`px-1 py-0.5 rounded text-xs whitespace-nowrap ${
                                                darkMode ? "bg-purple-900/20 text-purple-300" : "bg-purple-100 text-purple-700"
                                              }`}>
                                                出力 {func.dependencies.outgoing.length}
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {/* 実装順序 */}
                                        <div className="flex items-center flex-wrap gap-1 text-xs">
                                          <span className={`${darkMode ? "text-gray-500" : "text-gray-600"}`}>
                                            実装順序:
                                          </span>
                                          <span className={`px-1 py-0.5 rounded text-xs whitespace-nowrap ${
                                            darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"
                                          }`}>
                                            #{func.implementation_order}
                                          </span>
                                        </div>

                                        {/* 推定工数 */}
                                        <div className="flex items-center flex-wrap gap-1 text-xs">
                                          <span className={`${darkMode ? "text-gray-500" : "text-gray-600"}`}>
                                            推定工数:
                                          </span>
                                          <span className={`px-1 py-0.5 rounded text-xs whitespace-nowrap ${
                                            func.estimated_effort === 'low'
                                              ? darkMode ? "bg-green-900/20 text-green-300" : "bg-green-100 text-green-700"
                                              : func.estimated_effort === 'high'
                                              ? darkMode ? "bg-red-900/20 text-red-300" : "bg-red-100 text-red-700"
                                              : darkMode ? "bg-yellow-900/20 text-yellow-300" : "bg-yellow-100 text-yellow-700"
                                          }`}>
                                            {func.estimated_effort === 'low' ? '低' : func.estimated_effort === 'high' ? '高' : '中'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 実装順序とサマリー情報 */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 実装順序 */}
                  {structuringResult.implementation_order && structuringResult.implementation_order.length > 0 && (
                    <div className={`p-4 rounded-lg border backdrop-blur-lg ${
                      darkMode
                        ? "bg-slate-800/10 border-slate-600/40 shadow-[0_0_15px_rgba(100,116,139,0.1)]"
                        : "bg-gray-50/60 border-gray-200/60"
                    }`}>
                      <h3 className={`text-lg font-bold mb-3 flex items-center ${
                        darkMode ? "text-gray-100" : "text-gray-900"
                      }`}>
                        <ArrowRight size={20} className="mr-2" />
                        推奨実装順序
                      </h3>
                      <div className="space-y-2">
                        {structuringResult.implementation_order.slice(0, 5).map((item) => (
                          <div
                            key={item.function_id}
                            className={`p-3 rounded-lg border backdrop-blur-md transition-all ${
                              item.can_start
                                ? darkMode
                                  ? "bg-green-900/10 border-green-600/40 shadow-[0_0_10px_rgba(74,222,128,0.1)] hover:shadow-[0_0_15px_rgba(74,222,128,0.15)]"
                                  : "bg-green-50/60 border-green-200/60"
                                : darkMode
                                  ? "bg-yellow-900/10 border-yellow-600/40 shadow-[0_0_10px_rgba(251,191,36,0.1)] hover:shadow-[0_0_15px_rgba(251,191,36,0.15)]"
                                  : "bg-yellow-50/60 border-yellow-200/60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center flex-1 min-w-0">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium mr-2 whitespace-nowrap flex-shrink-0 ${
                                  item.can_start
                                    ? "bg-green-500 text-white"
                                    : "bg-yellow-500 text-white"
                                }`}>
                                  {item.order}
                                </span>
                                <span className={`font-medium ${
                                  darkMode ? "text-gray-100" : "text-gray-900"
                                }`}>
                                  {item.function_code}: {item.function_name}
                                </span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap flex-shrink-0 ${
                                PRIORITY_COLORS[item.priority as keyof typeof PRIORITY_COLORS].bg
                              } ${PRIORITY_COLORS[item.priority as keyof typeof PRIORITY_COLORS].text}`}>
                                {PRIORITY_LABELS[item.priority]}
                              </span>
                            </div>
                            {!item.can_start && item.blocked_by.length > 0 && (
                              <p className={`text-xs mt-1 ${
                                darkMode ? "text-yellow-300" : "text-yellow-700"
                              }`}>
                                待機中: {item.blocked_by.join(", ")} の完了が必要
                              </p>
                            )}
                          </div>
                        ))}
                        {structuringResult.implementation_order.length > 5 && (
                          <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                            他 {structuringResult.implementation_order.length - 5} 個の機能...
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* サマリー情報 */}
                  <div className={`p-4 rounded-lg border backdrop-blur-lg ${
                    darkMode
                      ? "bg-gray-800/10 border-gray-600/40 shadow-[0_0_15px_rgba(156,163,175,0.1)]"
                      : "bg-gray-50/60 border-gray-200/60"
                  }`}>
                    <h3 className={`text-lg font-bold mb-3 flex items-center ${
                      darkMode ? "text-gray-100" : "text-gray-900"
                    }`}>
                      <CheckCircle size={20} className="mr-2" />
                      構造化サマリー
                    </h3>

                    {/* カテゴリ別統計 */}
                    <div className="mb-4">
                      <h4 className={`text-sm font-semibold mb-2 ${
                        darkMode ? "text-gray-200" : "text-gray-800"
                      }`}>
                        カテゴリ別分布
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(structuringResult.summary.categories.counts).map(([category, count]) => (
                          <div key={category} className={`p-2 rounded text-xs backdrop-blur-sm ${
                            CATEGORY_COLORS[category]?.bg || "bg-gray-100"
                          } ${CATEGORY_COLORS[category]?.text || "text-gray-700"}`}>
                            {CATEGORY_LABELS[category]}: {count}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 優先度別統計 */}
                    <div className="mb-4">
                      <h4 className={`text-sm font-semibold mb-2 ${
                        darkMode ? "text-gray-200" : "text-gray-800"
                      }`}>
                        優先度別分布
                      </h4>
                      <div className="space-y-1">
                        {Object.entries(structuringResult.summary.priorities.counts).map(([priority, count]) => (
                          <div key={priority} className="flex justify-between items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                              PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS].bg
                            } ${PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS].text}`}>
                              {PRIORITY_LABELS[priority]}
                            </span>
                            <span className={`text-xs whitespace-nowrap ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                              {count}個
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* MVP準備状況 */}
                    <div className={`p-2 rounded backdrop-blur-sm ${
                      structuringResult.summary.priorities.mvp_ready
                        ? darkMode ? "bg-green-900/20 border border-green-600/50" : "bg-green-50/80 border border-green-200"
                        : darkMode ? "bg-yellow-900/20 border border-yellow-600/50" : "bg-yellow-50/80 border border-yellow-200"
                    }`}>
                      <p className={`text-xs font-medium ${
                        structuringResult.summary.priorities.mvp_ready
                          ? darkMode ? "text-green-300" : "text-green-700"
                          : darkMode ? "text-yellow-300" : "text-yellow-700"
                      }`}>
                        {structuringResult.summary.priorities.mvp_ready
                          ? "✅ MVP準備完了"
                          : "⚠️ MVP機能が不足"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 依存関係詳細 */}
                {structuringResult.total_dependencies > 0 && (
                  <div className={`mt-6 p-4 rounded-lg border backdrop-blur-lg ${
                    darkMode
                      ? "bg-gray-800/10 border-gray-600/40 shadow-[0_0_15px_rgba(156,163,175,0.1)]"
                      : "bg-gray-50/60 border-gray-200/60"
                  }`}>
                    <h3 className={`text-lg font-bold mb-3 flex items-center ${
                      darkMode ? "text-gray-100" : "text-gray-900"
                    }`}>
                      <ArrowRight size={20} className="mr-2" />
                      機能間依存関係詳細 ({structuringResult.total_dependencies})
                    </h3>

                    {/* 依存関係タイプ別統計 */}
                    <div className="mb-4">
                      <h4 className={`text-sm font-semibold mb-2 ${
                        darkMode ? "text-gray-200" : "text-gray-800"
                      }`}>
                        依存関係タイプ
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(structuringResult.summary.dependency_analysis.types).map(([type, count]) => (
                          <span key={type} className={`px-2 py-1 rounded-full text-xs whitespace-nowrap backdrop-blur-sm ${
                            darkMode ? "bg-blue-900/20 text-blue-300" : "bg-blue-100 text-blue-700"
                          }`}>
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 複雑度スコア */}
                    <div className={`p-2 rounded backdrop-blur-sm ${
                      structuringResult.summary.dependency_analysis.complexity_score > 0.5
                        ? darkMode ? "bg-orange-900/20 border border-orange-600/50" : "bg-orange-50/80 border border-orange-200"
                        : darkMode ? "bg-green-900/20 border border-green-600/50" : "bg-green-50/80 border border-green-200"
                    }`}>
                      <p className={`text-xs font-medium ${
                        structuringResult.summary.dependency_analysis.complexity_score > 0.5
                          ? darkMode ? "text-orange-300" : "text-orange-700"
                          : darkMode ? "text-green-300" : "text-green-700"
                      }`}>
                        複雑度スコア: {structuringResult.summary.dependency_analysis.complexity_score.toFixed(2)}
                        {structuringResult.summary.dependency_analysis.complexity_score > 0.5
                          ? " (高複雑度)"
                          : " (低複雑度)"}
                      </p>
                    </div>

                    {/* 具体的な依存関係一覧 */}
                    <div className="mt-4">
                      <h4 className={`text-sm font-semibold mb-2 ${
                        darkMode ? "text-gray-200" : "text-gray-800"
                      }`}>
                        具体的な依存関係
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {structuringResult.dependencies.slice(0, 10).map((dep) => (
                          <div key={dep.dependency_id} className={`p-2 rounded text-xs backdrop-blur-md transition-all ${
                            darkMode ? "bg-gray-700/20 border border-gray-600/30 hover:shadow-[0_0_8px_rgba(156,163,175,0.1)]" : "bg-gray-100/60 border border-gray-200/60"
                          }`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-medium truncate ${
                                darkMode ? "text-gray-200" : "text-gray-800"
                              }`}>
                                {dep.from_function_name}
                              </span>
                              <span className={`px-1 py-0.5 rounded text-xs whitespace-nowrap flex-shrink-0 ${
                                dep.dependency_type === 'requires'
                                  ? darkMode ? "bg-red-900/20 text-red-300" : "bg-red-100 text-red-700"
                                  : dep.dependency_type === 'blocks'
                                  ? darkMode ? "bg-orange-900/20 text-orange-300" : "bg-orange-100 text-orange-700"
                                  : darkMode ? "bg-blue-900/20 text-blue-300" : "bg-blue-100 text-blue-700"
                              }`}>
                                {dep.dependency_type}
                              </span>
                              <span className={`font-medium truncate ${
                                darkMode ? "text-gray-200" : "text-gray-800"
                              }`}>
                                {dep.to_function_name}
                              </span>
                            </div>
                            {dep.reason && (
                              <p className={`mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                {dep.reason}
                              </p>
                            )}
                          </div>
                        ))}
                        {structuringResult.dependencies.length > 10 && (
                          <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                            他 {structuringResult.dependencies.length - 10} 個の依存関係...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* タスク可視化へ進むボタン */}
              <div className="text-center">
                <button
                  onClick={handleNext}
                  className={`px-8 py-3 flex items-center mx-auto rounded-full shadow-lg focus:outline-none transform transition-all hover:-translate-y-1 backdrop-blur-md ${
                    darkMode
                      ? "bg-cyan-500/80 hover:bg-cyan-500 text-gray-900 focus:ring-2 focus:ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
                      : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
                  }`}
                >
                  <span>タスク可視化へ</span>
                  <ChevronRight size={18} className="ml-2" />
                </button>
              </div>
            </>
          )}

          <HackthonSupportAgent />
        </div>
      </main>

      {/* 新規機能追加モーダル */}
      {isAddingFunction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className={`rounded-xl p-6 shadow-2xl border max-w-lg w-full mx-4 backdrop-blur-xl ${
            darkMode
              ? "bg-gray-800/80 border-cyan-500/40 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
              : "bg-white/80 border-purple-500/40"
          }`}>
            <h3 className={`text-xl font-bold mb-4 ${darkMode ? "text-cyan-300" : "text-purple-700"}`}>
              新しい機能を追加
            </h3>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  機能名
                </label>
                <input
                  type="text"
                  value={newFunctionData.function_name}
                  onChange={(e) => setNewFunctionData({...newFunctionData, function_name: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border outline-none backdrop-blur-sm transition-all ${
                    darkMode
                      ? "bg-gray-700/30 border-gray-600/60 text-gray-100 focus:border-cyan-400/80 focus:shadow-[0_0_10px_rgba(34,211,238,0.15)]"
                      : "bg-white/70 border-gray-300 text-gray-900"
                  }`}
                  placeholder="例: ユーザー認証機能"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  説明
                </label>
                <textarea
                  ref={newTextareaRef}
                  value={newFunctionData.description}
                  onChange={(e) => {
                    setNewFunctionData({...newFunctionData, description: e.target.value});
                    adjustTextareaHeight(e.target);
                  }}
                  className={`w-full px-3 py-2 rounded-lg border outline-none resize-none backdrop-blur-sm transition-all ${
                    darkMode
                      ? "bg-gray-700/30 border-gray-600/60 text-gray-100 focus:border-cyan-400/80 focus:shadow-[0_0_10px_rgba(34,211,238,0.15)]"
                      : "bg-white/70 border-gray-300 text-gray-900"
                  }`}
                  rows={6}
                  placeholder="機能の詳細を入力してください"
                  style={{ minHeight: '120px' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    カテゴリ
                  </label>
                  <select
                    value={newFunctionData.category}
                    onChange={(e) => setNewFunctionData({...newFunctionData, category: e.target.value as StructuredFunction['category']})}
                    className={`w-full px-3 py-2 rounded-lg border outline-none backdrop-blur-sm transition-all ${
                      darkMode
                        ? "bg-gray-700/30 border-gray-600/60 text-gray-100 focus:border-cyan-400/80"
                        : "bg-white/70 border-gray-300 text-gray-900"
                    }`}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    優先度
                  </label>
                  <select
                    value={newFunctionData.priority}
                    onChange={(e) => setNewFunctionData({...newFunctionData, priority: e.target.value as StructuredFunction['priority']})}
                    className={`w-full px-3 py-2 rounded-lg border outline-none backdrop-blur-sm transition-all ${
                      darkMode
                        ? "bg-gray-700/30 border-gray-600/60 text-gray-100 focus:border-cyan-400/80"
                        : "bg-white/70 border-gray-300 text-gray-900"
                    }`}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsAddingFunction(false)}
                className={`px-4 py-2 rounded-lg transition-all backdrop-blur-sm ${
                  darkMode
                    ? "bg-gray-700/50 hover:bg-gray-600/70 text-gray-300 border border-gray-600/60"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveNewFunction}
                className={`px-4 py-2 rounded-lg transition-all backdrop-blur-sm ${
                  darkMode
                    ? "bg-cyan-500/80 hover:bg-cyan-500 text-gray-900 shadow-[0_0_10px_rgba(34,211,238,0.2)] hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                    : "bg-purple-500 hover:bg-purple-600 text-white"
                }`}
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 機能編集モーダル */}
      {isEditingModalOpen && editingFunction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className={`rounded-xl p-6 shadow-2xl border max-w-lg w-full mx-4 backdrop-blur-xl ${
            darkMode
              ? "bg-gray-800/80 border-cyan-500/40 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
              : "bg-white/80 border-purple-500/40"
          }`}>
            <h3 className={`text-xl font-bold mb-4 ${darkMode ? "text-cyan-300" : "text-purple-700"}`}>
              機能を編集
            </h3>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  機能名
                </label>
                <input
                  type="text"
                  value={editingValues.function_name || ''}
                  onChange={(e) => setEditingValues({...editingValues, function_name: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border outline-none backdrop-blur-sm transition-all ${
                    darkMode
                      ? "bg-gray-700/30 border-gray-600/60 text-gray-100 focus:border-cyan-400/80 focus:shadow-[0_0_10px_rgba(34,211,238,0.15)]"
                      : "bg-white/70 border-gray-300 text-gray-900"
                  }`}
                  placeholder="例: ユーザー認証機能"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  説明
                </label>
                <textarea
                  ref={editTextareaRef}
                  value={editingValues.description || ''}
                  onChange={(e) => {
                    setEditingValues({...editingValues, description: e.target.value});
                    adjustTextareaHeight(e.target);
                  }}
                  className={`w-full px-3 py-2 rounded-lg border outline-none resize-none backdrop-blur-sm transition-all ${
                    darkMode
                      ? "bg-gray-700/30 border-gray-600/60 text-gray-100 focus:border-cyan-400/80 focus:shadow-[0_0_10px_rgba(34,211,238,0.15)]"
                      : "bg-white/70 border-gray-300 text-gray-900"
                  }`}
                  rows={6}
                  placeholder="機能の詳細を入力してください"
                  style={{ minHeight: '120px' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    カテゴリ
                  </label>
                  <select
                    value={editingValues.category}
                    onChange={(e) => setEditingValues({...editingValues, category: e.target.value as StructuredFunction['category']})}
                    className={`w-full px-3 py-2 rounded-lg border outline-none backdrop-blur-sm transition-all ${
                      darkMode
                        ? "bg-gray-700/30 border-gray-600/60 text-gray-100 focus:border-cyan-400/80"
                        : "bg-white/70 border-gray-300 text-gray-900"
                    }`}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                    優先度
                  </label>
                  <select
                    value={editingValues.priority}
                    onChange={(e) => setEditingValues({...editingValues, priority: e.target.value as StructuredFunction['priority']})}
                    className={`w-full px-3 py-2 rounded-lg border outline-none backdrop-blur-sm transition-all ${
                      darkMode
                        ? "bg-gray-700/30 border-gray-600/60 text-gray-100 focus:border-cyan-400/80"
                        : "bg-white/70 border-gray-300 text-gray-900"
                    }`}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancelEdit}
                className={`px-4 py-2 rounded-lg transition-all backdrop-blur-sm ${
                  darkMode
                    ? "bg-gray-700/50 hover:bg-gray-600/70 text-gray-300 border border-gray-600/60"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSaveFunction(editingFunction)}
                className={`px-4 py-2 rounded-lg transition-all backdrop-blur-sm ${
                  darkMode
                    ? "bg-cyan-500/80 hover:bg-cyan-500 text-gray-900 shadow-[0_0_10px_rgba(34,211,238,0.2)] hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                    : "bg-purple-500 hover:bg-purple-600 text-white"
                }`}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
