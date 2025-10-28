"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Boxes, ChevronRight, Loader2, Bot, CheckCircle, AlertCircle, ArrowRight, Edit3, Save, Plus, Trash2, X, Terminal } from "lucide-react";
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
import { generateAIDocument } from "@/libs/service/aiDocumentService";

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
  | 'generating-document'    // AI仕様書生成中
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
    bg: 'bg-red-500/5 dark:bg-red-500/3',
    border: 'border-red-500/20 dark:border-red-400/30',
    text: 'text-red-600 dark:text-red-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(248,113,113,0.4)]'
  },
  data: {
    bg: 'bg-blue-500/5 dark:bg-blue-500/3',
    border: 'border-blue-500/20 dark:border-blue-400/30',
    text: 'text-blue-600 dark:text-blue-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(96,165,250,0.4)]'
  },
  logic: {
    bg: 'bg-green-500/5 dark:bg-green-500/3',
    border: 'border-green-500/20 dark:border-green-400/30',
    text: 'text-green-600 dark:text-green-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(74,222,128,0.4)]'
  },
  ui: {
    bg: 'bg-purple-500/5 dark:bg-purple-500/3',
    border: 'border-purple-500/20 dark:border-purple-400/30',
    text: 'text-purple-600 dark:text-purple-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(192,132,252,0.4)]'
  },
  api: {
    bg: 'bg-orange-500/5 dark:bg-orange-500/3',
    border: 'border-orange-500/20 dark:border-orange-400/30',
    text: 'text-orange-600 dark:text-orange-400',
    glow: 'shadow-lg dark:shadow-[0_0_30px_rgba(251,146,60,0.4)]'
  },
  deployment: {
    bg: 'bg-gray-500/5 dark:bg-gray-500/3',
    border: 'border-gray-500/20 dark:border-gray-400/30',
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

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string; shadow: string }> = {
  Must: {
    bg: 'bg-red-500/20 dark:bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    border: 'border border-red-500/40 dark:border-red-400/50',
    shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]'
  },
  Should: {
    bg: 'bg-yellow-500/20 dark:bg-yellow-500/10',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border border-yellow-500/40 dark:border-yellow-400/50',
    shadow: 'shadow-[0_0_15px_rgba(234,179,8,0.3)]'
  },
  Could: {
    bg: 'bg-blue-500/20 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border border-blue-500/40 dark:border-blue-400/50',
    shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]'
  },
  Wont: {
    bg: 'bg-gray-500/20 dark:bg-gray-500/10',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border border-gray-500/40 dark:border-gray-400/50',
    shadow: 'shadow-[0_0_15px_rgba(107,114,128,0.3)]'
  }
};

export default function FunctionStructuring() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = pathname.split("/")[2];
  const { darkMode } = useDarkMode();
  const { data: session, status } = useSession();

  // セットアップフェーズ関連の状態
  const [setupPhase, setSetupPhase] = useState<SetupPhase>(() => {
    // localStorageから状態を復元（タブ切り替え時の不具合対策）
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`setupPhase_${projectId}`);
      return (saved as SetupPhase) || 'initializing';
    }
    return 'initializing';
  });
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
  const [newFunctionData, setNewFunctionData] = useState<CreateFunctionRequest>({
    project_id: projectId,
    function_name: '',
    description: '',
    category: 'logic',
    priority: 'Should'
  });

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

      case 'generating-document':
        setSetupError({
          phase,
          message: `仕様書生成に失敗しました: ${errorMessage}`,
          canContinue: true
        });
        console.warn('仕様書生成に失敗しましたが、処理を続行します:', error);
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

  // 機能の編集を開始
  const handleEditFunction = (func: StructuredFunction) => {
    setEditingFunction(func.function_id);
    setEditingValues({
      function_name: func.function_name,
      description: func.description,
      category: func.category,
      priority: func.priority
    });
  };

  // 機能の編集を保存
  const handleSaveFunction = async (functionId: string) => {
    try {
      await updateFunction(functionId, editingValues);

      // 更新後、サーバーから最新のデータを再取得
      try {
        const updatedData = await getStructuredFunctions(projectId);
        setStructuringResult(updatedData);
      } catch (fetchError) {
        console.warn('最新データの取得に失敗、手動で更新します:', fetchError);
        // フォールバック: 手動で更新
        const updatedFunction = await updateFunction(functionId, editingValues);
        if (structuringResult) {
          const updatedFunctions = structuringResult.functions.map(func =>
            func.function_id === functionId ? { ...func, ...updatedFunction } : func
          );
          setStructuringResult({
            ...structuringResult,
            functions: updatedFunctions
          });
        }
      }

      setEditingFunction(null);
      setEditingValues({});
    } catch (error) {
      console.error('機能の更新に失敗:', error);
      alert('機能の更新に失敗しました');
    }
  };

  // 機能の編集をキャンセル
  const handleCancelEdit = () => {
    setEditingFunction(null);
    setEditingValues({});
  };

  // 機能を削除
  const handleDeleteFunction = async (functionId: string) => {
    if (!confirm('この機能を削除しますか？')) return;

    try {
      await deleteFunction(functionId);

      // 削除後、サーバーから最新のデータを再取得
      try {
        const updatedData = await getStructuredFunctions(projectId);
        setStructuringResult(updatedData);
      } catch (fetchError) {
        console.warn('最新データの取得に失敗、手動で削除します:', fetchError);
        // フォールバック: 手動で削除
        if (structuringResult) {
          const updatedFunctions = structuringResult.functions.filter(func => func.function_id !== functionId);
          setStructuringResult({
            ...structuringResult,
            functions: updatedFunctions,
            total_functions: updatedFunctions.length
          });
        }
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

      // 作成後、サーバーから最新のデータを再取得
      try {
        const updatedData = await getStructuredFunctions(projectId);
        setStructuringResult(updatedData);
      } catch (fetchError) {
        console.warn('最新データの取得に失敗、手動で追加します:', fetchError);
        // フォールバック: 手動で追加（依存関係などのデフォルト値を設定）
        const functionWithDefaults = {
          ...createdFunction,
          dependencies: createdFunction.dependencies || { incoming: [], outgoing: [] },
          extraction_confidence: createdFunction.extraction_confidence || 1.0,
          implementation_order: createdFunction.implementation_order || structuringResult!.total_functions + 1,
          estimated_effort: createdFunction.estimated_effort || 'medium',
          function_code: createdFunction.function_code || `F${structuringResult!.total_functions + 1}`
        };

        if (structuringResult) {
          setStructuringResult({
            ...structuringResult,
            functions: [...structuringResult.functions, functionWithDefaults],
            total_functions: structuringResult.total_functions + 1
          });
        }
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
    router.push(`/${githubName}/${projectId}`);
  };

  // setupPhaseをlocalStorageに保存（タブ切り替え時の状態保持）
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`setupPhase_${projectId}`, setupPhase);
    }
  }, [setupPhase, projectId]);

  // 認証とデータ初期化
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/");
      return;
    }

    const initializeAndStructure = async () => {
      try {
        // 既に完了している場合は何もしない（タブ切り替え時の再実行防止）
        const currentPhase = localStorage.getItem(`setupPhase_${projectId}`);
        if (currentPhase === 'completed') {
          // 既存結果を読み込むだけ
          try {
            const data = await getStructuredFunctions(projectId);
            if (data.total_functions > 0) {
              setStructuringResult(data);
              setProcessingState('completed');
              setSetupPhase('completed');
              return;
            }
          } catch {
            // データがない場合は初期化フェーズに戻す
            setSetupPhase('initializing');
          }
        }

        // Step 1: URLパラメータからフレームワーク選択データを取得
        const technologies = searchParams.get('technologies');
        const platform = searchParams.get('platform');
        const aiRecommended = searchParams.get('aiRecommended');

        if (technologies && technologies.length > 0) {
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

          // Step 3: AI仕様書生成
          setSetupPhase('generating-document');
          try {
            await generateAIDocument(projectId);
          } catch (error) {
            handleSetupError('generating-document', error);
            // エラーでも続行
          }
        }

        // Step 4: 機能構造化（既存の処理）
        setSetupPhase('structuring-functions');

        // 既存結果をチェック
        try {
          const data = await getStructuredFunctions(projectId);
          if (data.total_functions > 0) {
            setStructuringResult(data);
            setProcessingState('completed');
            setSetupPhase('completed');
            return;
          }
        } catch {
          console.log('既存結果なし、新規実行が必要');
        }

        // 新規実行
        await handleStructureFunctions();
        setSetupPhase('completed');

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
        {/* サイバー背景 */}
        {darkMode && (
          <>
            <div className="-z-10 absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[150px] animate-pulse" />
            <div className="-z-10 absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-pink-500/15 rounded-full blur-[150px] animate-pulse" style={{animationDelay: '1s'}} />
            <div className="-z-10 absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[140px] animate-pulse" style={{animationDelay: '2s'}} />
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
          {setupPhase === 'saving-framework' && processingState !== 'completed' && (
            <div className={`backdrop-blur-[2px] rounded-2xl p-8 shadow-2xl border transition-all duration-500 mb-8 animate-pulse-slow ${
              darkMode
                ? "bg-slate-900/[0.02] border-cyan-400/20 shadow-[0_0_80px_rgba(34,211,238,0.3)]"
                : "bg-white/10 border-purple-500/30 shadow-purple-300/20"
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

          {/* AI仕様書生成中 */}
          {setupPhase === 'generating-document' && processingState !== 'completed' && (
            <div className={`backdrop-blur-[2px] rounded-2xl p-8 shadow-2xl border transition-all duration-500 mb-8 animate-pulse-slow ${
              darkMode
                ? "bg-slate-900/[0.02] border-cyan-400/20 shadow-[0_0_80px_rgba(34,211,238,0.3)]"
                : "bg-white/10 border-purple-500/30 shadow-purple-300/20"
            }`}>
              <div className="text-center">
                <Bot size={48} className={`mx-auto mb-4 ${darkMode ? "text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]" : "text-purple-600"}`} />
                <h2 className={`text-xl font-bold mb-4 ${darkMode ? "text-cyan-300" : "text-purple-700"}`}>
                  AI仕様書を生成中
                </h2>
                <div className="flex items-center justify-center mb-4">
                  <Loader2 className="animate-spin mr-2" size={20} />
                  <span className={darkMode ? "text-gray-300" : "text-gray-700"}>
                    プロジェクト要件を分析し、詳細な仕様書を作成しています...
                  </span>
                </div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                  この処理には数十秒かかる場合があります
                </div>
              </div>
            </div>
          )}

          {/* 処理中の表示 */}
          {(processingState === 'structuring' || (setupPhase === 'structuring-functions' && processingState !== 'completed')) && (
            <div className={`backdrop-blur-[2px] rounded-2xl p-8 shadow-2xl border transition-all duration-500 mb-8 animate-pulse-slow ${
              darkMode
                ? "bg-slate-900/[0.02] border-cyan-400/20 shadow-[0_0_80px_rgba(34,211,238,0.3)]"
                : "bg-white/10 border-purple-500/30 shadow-purple-300/20"
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
            <div className={`backdrop-blur-[2px] rounded-2xl p-8 shadow-2xl border transition-all duration-500 mb-8 ${
              darkMode
                ? "bg-red-950/[0.05] border-red-500/20 shadow-[0_0_80px_rgba(248,113,113,0.4)]"
                : "bg-red-50/20 border-red-400/30 shadow-red-200/30"
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
            <div className={`backdrop-blur-[2px] rounded-2xl p-6 shadow-xl border transition-all duration-500 mb-6 ${
              darkMode
                ? "bg-yellow-950/[0.05] border-yellow-500/20 shadow-[0_0_80px_rgba(251,191,36,0.4)]"
                : "bg-yellow-50/20 border-yellow-400/30 shadow-yellow-200/30"
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
                <div className={`backdrop-blur-[2px] rounded-2xl p-6 shadow-xl border transition-all duration-500 mb-6 ${
                  darkMode
                    ? "bg-yellow-950/[0.05] border-yellow-500/20 shadow-[0_0_80px_rgba(251,191,36,0.4)]"
                    : "bg-yellow-50/20 border-yellow-400/30 shadow-yellow-200/30"
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

              <div className={`backdrop-blur-[2px] rounded-2xl p-8 shadow-2xl border transition-all duration-500 mb-8 ${
                darkMode
                  ? "bg-slate-900/[0.02] border-cyan-400/20 shadow-[0_0_80px_rgba(34,211,238,0.3)]"
                  : "bg-white/5 border-purple-500/20 shadow-purple-300/20"
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
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all duration-300 backdrop-blur-md ${
                      darkMode
                        ? "bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.6)] hover:scale-105"
                        : "bg-purple-100/50 hover:bg-purple-200/60 border border-purple-300/40 text-purple-700 hover:scale-105"
                    }`}
                  >
                    <Plus size={18} />
                    新しい機能を追加
                  </button>
                </div>

                {/* カテゴリ別機能表示 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                    const categoryFunctions = structuringResult.functions.filter(f => f.category === category);

                    if (categoryFunctions.length === 0) return null;

                    const colors = CATEGORY_COLORS[category];

                    return (
                      <div
                        key={category}
                        className={`rounded-2xl p-4 border backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] ${colors.bg} ${colors.border} shadow-lg ${colors.glow}`}
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
                                  className={`p-3 rounded-xl border backdrop-blur-sm transition-all duration-300 ${
                                    editingFunction === func.function_id
                                      ? darkMode
                                        ? "bg-slate-800/40 border-cyan-400/40 shadow-[0_0_25px_rgba(34,211,238,0.4)]"
                                        : "bg-white/60 border-purple-400/50"
                                      : darkMode
                                      ? "bg-slate-800/10 border-slate-600/20 hover:bg-slate-700/20 hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(100,116,139,0.3)]"
                                      : "bg-white/20 border-gray-200/30 hover:bg-white/40 hover:scale-[1.01]"
                                  }`}
                                >
                                  {editingFunction === func.function_id ? (
                                    // 編集モード
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <input
                                          type="text"
                                          value={editingValues.function_name || ''}
                                          onChange={(e) => setEditingValues({...editingValues, function_name: e.target.value})}
                                          className={`text-sm font-semibold border-b border-dashed outline-none flex-1 mr-2 px-2 py-1 ${
                                            darkMode ? "bg-slate-700/50 text-gray-100 border-cyan-400/50" : "bg-white/80 text-gray-900 border-purple-500/50"
                                          }`}
                                        />
                                        <div className="flex space-x-1">
                                          <button
                                            onClick={() => handleSaveFunction(func.function_id)}
                                            className={`p-1.5 rounded-lg transition-all ${
                                              darkMode ? "bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/40" : "bg-green-100 hover:bg-green-200 text-green-600 border border-green-300"
                                            }`}
                                            title="保存"
                                          >
                                            <Save size={14} />
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            className={`p-1.5 rounded-lg transition-all ${
                                              darkMode ? "bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 border border-gray-500/40" : "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300"
                                            }`}
                                            title="キャンセル"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      </div>

                                      <textarea
                                        value={editingValues.description || ''}
                                        onChange={(e) => setEditingValues({...editingValues, description: e.target.value})}
                                        className={`w-full text-xs border border-dashed rounded p-2 outline-none resize-none ${
                                          darkMode ? "bg-slate-700/50 text-gray-200 border-cyan-400/50" : "bg-white/80 text-gray-700 border-purple-500/50"
                                        }`}
                                        rows={2}
                                      />

                                      <div className="flex space-x-2">
                                        <select
                                          value={editingValues.category || func.category}
                                          onChange={(e) => setEditingValues({...editingValues, category: e.target.value as StructuredFunction['category']})}
                                          className={`text-xs border rounded px-2 py-1 ${
                                            darkMode ? "bg-slate-700/70 border-cyan-400/50 text-gray-200" : "bg-white/90 border-purple-500/50 text-gray-700"
                                          }`}
                                        >
                                          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                          ))}
                                        </select>

                                        <select
                                          value={editingValues.priority || func.priority}
                                          onChange={(e) => setEditingValues({...editingValues, priority: e.target.value as StructuredFunction['priority']})}
                                          className={`text-xs border rounded px-2 py-1 ${
                                            darkMode ? "bg-slate-700/70 border-cyan-400/50 text-gray-200" : "bg-white/90 border-purple-500/50 text-gray-700"
                                          }`}
                                        >
                                          {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  ) : (
                                    // 表示モード
                                    <div>
                                      <div className="flex items-start justify-between mb-2">
                                        <h4 className={`font-semibold text-sm ${
                                          darkMode ? "text-gray-100" : "text-gray-900"
                                        }`}>
                                          {func.function_code}: {func.function_name}
                                        </h4>
                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                          <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md whitespace-nowrap flex-shrink-0 ${priorityColor.bg} ${priorityColor.text} ${priorityColor.border} ${darkMode ? priorityColor.shadow : ''}`}>
                                            {PRIORITY_LABELS[func.priority]}
                                          </span>
                                          <button
                                            onClick={() => handleEditFunction(func)}
                                            className={`p-1 rounded-lg transition-all ${
                                              darkMode ? "bg-slate-700/30 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-gray-100 hover:bg-purple-100 text-purple-600 border border-purple-300"
                                            }`}
                                            title="編集"
                                          >
                                            <Edit3 size={12} />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteFunction(func.function_id)}
                                            className={`p-1 rounded-lg transition-all ${
                                              darkMode ? "bg-slate-700/30 hover:bg-red-500/20 text-red-400 border border-red-500/30" : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-300"
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
                                          <div className="text-xs">
                                            <span className={`${darkMode ? "text-gray-500" : "text-gray-600"}`}>
                                              依存関係:
                                            </span>
                                            {func.dependencies.incoming.length > 0 && (
                                              <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                                                darkMode ? "bg-blue-900/20 text-blue-300" : "bg-blue-100 text-blue-700"
                                              }`}>
                                                入力 {func.dependencies.incoming.length}
                                              </span>
                                            )}
                                            {func.dependencies.outgoing.length > 0 && (
                                              <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                                                darkMode ? "bg-purple-900/20 text-purple-300" : "bg-purple-100 text-purple-700"
                                              }`}>
                                                出力 {func.dependencies.outgoing.length}
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {/* 実装順序 */}
                                        <div className="text-xs">
                                          <span className={`${darkMode ? "text-gray-500" : "text-gray-600"}`}>
                                            実装順序:
                                          </span>
                                          <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                                            darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"
                                          }`}>
                                            #{func.implementation_order}
                                          </span>
                                        </div>

                                        {/* 推定工数 */}
                                        <div className="text-xs">
                                          <span className={`${darkMode ? "text-gray-500" : "text-gray-600"}`}>
                                            推定工数:
                                          </span>
                                          <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
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
                                  )}
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
                    <div className={`p-4 rounded-2xl border backdrop-blur-[2px] transition-all duration-300 ${
                      darkMode
                        ? "bg-slate-900/[0.02] border-slate-600/20 shadow-[0_0_30px_rgba(100,116,139,0.2)]"
                        : "bg-gray-50/10 border-gray-200/20"
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
                            className={`p-3 rounded-xl border backdrop-blur-sm transition-all duration-300 ${
                              item.can_start
                                ? darkMode
                                  ? "bg-green-900/10 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                                  : "bg-green-50/30 border-green-200/30"
                                : darkMode
                                  ? "bg-yellow-900/10 border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                                  : "bg-yellow-50/30 border-yellow-200/30"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium mr-2 ${
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
                              {(() => {
                                const priorityColor = PRIORITY_COLORS[item.priority as keyof typeof PRIORITY_COLORS];
                                return (
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md whitespace-nowrap flex-shrink-0 ${priorityColor.bg} ${priorityColor.text} ${priorityColor.border} ${darkMode ? priorityColor.shadow : ''}`}>
                                    {PRIORITY_LABELS[item.priority]}
                                  </span>
                                );
                              })()}
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
                  <div className={`p-4 rounded-2xl border backdrop-blur-[2px] transition-all duration-300 ${
                    darkMode
                      ? "bg-slate-900/[0.02] border-slate-600/20 shadow-[0_0_30px_rgba(100,116,139,0.2)]"
                      : "bg-gray-50/10 border-gray-200/20"
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
                        {Object.entries(structuringResult.summary.priorities.counts).map(([priority, count]) => {
                          const priorityColor = PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS];
                          return (
                            <div key={priority} className="flex justify-between items-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md whitespace-nowrap flex-shrink-0 ${priorityColor.bg} ${priorityColor.text} ${priorityColor.border} ${darkMode ? priorityColor.shadow : ''}`}>
                                {PRIORITY_LABELS[priority]}
                              </span>
                              <span className={`text-xs ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                                {count}個
                              </span>
                            </div>
                          );
                        })}
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
                  <div className={`mt-6 p-4 rounded-2xl border backdrop-blur-[2px] transition-all duration-300 ${
                    darkMode
                      ? "bg-slate-900/[0.02] border-slate-600/20 shadow-[0_0_30px_rgba(100,116,139,0.2)]"
                      : "bg-gray-50/10 border-gray-200/20"
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
                          <span key={type} className={`px-2 py-1 rounded-full text-xs backdrop-blur-sm ${
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
                          <div key={dep.dependency_id} className={`p-2 rounded-xl text-xs backdrop-blur-sm transition-all duration-200 ${
                            darkMode ? "bg-slate-800/10 border border-slate-600/20" : "bg-gray-100/30 border border-gray-200/30"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${
                                darkMode ? "text-gray-200" : "text-gray-800"
                              }`}>
                                {dep.from_function_name}
                              </span>
                              <span className={`px-1 py-0.5 rounded text-xs ${
                                dep.dependency_type === 'requires'
                                  ? darkMode ? "bg-red-900/20 text-red-300" : "bg-red-100 text-red-700"
                                  : dep.dependency_type === 'blocks'
                                  ? darkMode ? "bg-orange-900/20 text-orange-300" : "bg-orange-100 text-orange-700"
                                  : darkMode ? "bg-blue-900/20 text-blue-300" : "bg-blue-100 text-blue-700"
                              }`}>
                                {dep.dependency_type}
                              </span>
                              <span className={`font-medium ${
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
                  className={`px-8 py-3 flex items-center mx-auto rounded-full shadow-lg focus:outline-none transform transition-all duration-300 hover:-translate-y-1 hover:scale-105 backdrop-blur-sm ${
                    darkMode
                      ? "bg-cyan-500/70 hover:bg-cyan-500/90 text-gray-900 focus:ring-2 focus:ring-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.5)]"
                      : "bg-gradient-to-r from-purple-500/80 to-blue-600/80 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className={`rounded-2xl p-6 shadow-2xl border max-w-lg w-full mx-4 backdrop-blur-xl transition-all duration-300 ${
            darkMode
              ? "bg-slate-900/80 border-cyan-500/40 shadow-[0_0_60px_rgba(34,211,238,0.3)]"
              : "bg-white/80 border-purple-500/40 shadow-purple-300/40"
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
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${
                    darkMode
                      ? "bg-gray-700/50 border-gray-600 text-gray-100"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                  placeholder="例: ユーザー認証機能"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  説明
                </label>
                <textarea
                  value={newFunctionData.description}
                  onChange={(e) => setNewFunctionData({...newFunctionData, description: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border outline-none resize-none ${
                    darkMode
                      ? "bg-gray-700/50 border-gray-600 text-gray-100"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                  rows={3}
                  placeholder="機能の詳細を入力してください"
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
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${
                      darkMode
                        ? "bg-gray-700/50 border-gray-600 text-gray-100"
                        : "bg-white border-gray-300 text-gray-900"
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
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${
                      darkMode
                        ? "bg-gray-700/50 border-gray-600 text-gray-100"
                        : "bg-white border-gray-300 text-gray-900"
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
                className={`px-4 py-2 rounded-lg transition-colors ${
                  darkMode
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveNewFunction}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  darkMode
                    ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900"
                    : "bg-purple-500 hover:bg-purple-600 text-white"
                }`}
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
