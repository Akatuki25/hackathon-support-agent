"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, Loader2, Smartphone, Globe, Tablet, Bot, Check } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import { getProjectDocument } from "@/libs/modelAPI/frameworkService";
import { getFrameworkRecommendations } from "@/libs/service/frameworkService";
import { structureFunctions } from "@/libs/modelAPI/functionStructuringAPI";
import { AgentChatWidget } from "@/components/chat";

export interface TechnologyOption {
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'deployment';
  description: string;
  pros: string[];
  cons: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  recommended?: boolean;
}

export interface RecommendedTechnology {
  name: string;
  priority: number;
  reason: string;
}

export interface FrameworkRecommendationResponse {
  recommended_technologies: RecommendedTechnology[];
}

type FlowState = 'loading' | 'ready';
type SelectedPlatform = 'web' | 'ios' | 'android' | null;

// プラットフォーム別の必須カテゴリ定義
const REQUIRED_CATEGORIES = {
  web: {
    frontend: { min: 1, label: 'フロントエンド', required: true },
    backend: { min: 1, label: 'バックエンド', required: true },
    database: { min: 1, label: 'データベース', required: true },
    deployment: { min: 0, label: 'デプロイメント', required: false }
  },
  ios: {
    frontend: { min: 1, label: 'iOSフレームワーク', required: true },
    backend: { min: 1, label: 'バックエンド/BaaS', required: true }
  },
  android: {
    frontend: { min: 1, label: 'Androidフレームワーク', required: true },
    backend: { min: 1, label: 'バックエンド/BaaS', required: true }
  }
};

const TECHNOLOGY_OPTIONS: Record<string, TechnologyOption[]> = {
  web: [
    // Frontend Technologies
    {
      name: "React",
      category: "frontend",
      description: "人気のJavaScript UIライブラリ",
      pros: ["大規模なコミュニティ", "豊富なライブラリ", "学習リソースが豊富"],
      cons: ["学習コストが高い", "設定が複雑"],
      difficulty: "intermediate"
    },
    {
      name: "Vue.js",
      category: "frontend",
      description: "プログレッシブJavaScriptフレームワーク",
      pros: ["学習しやすい", "軽量", "日本語ドキュメント充実"],
      cons: ["企業採用が少ない", "大規模開発向けではない"],
      difficulty: "beginner"
    },
    {
      name: "Next.js",
      category: "frontend",
      description: "Reactベースのフルスタックフレームワーク",
      pros: ["SSR/SSG対応", "API Routes", "最適化済み"],
      cons: ["Reactの知識が必要", "複雑な設定"],
      difficulty: "intermediate"
    },
    {
      name: "Astro",
      category: "frontend",
      description: "静的サイト生成フレームワーク",
      pros: ["高速", "マルチフレームワーク対応", "ゼロJS"],
      cons: ["新しいため情報が少ない", "動的機能が限定的"],
      difficulty: "intermediate"
    },
    {
      name: "Angular",
      category: "frontend",
      description: "Googleが開発するフルスタックフレームワーク",
      pros: ["TypeScript標準", "企業向け機能充実", "大規模開発向け"],
      cons: ["学習コストが高い", "バンドルサイズが大きい"],
      difficulty: "advanced"
    },
    {
      name: "Svelte",
      category: "frontend",
      description: "コンパイル時最適化フレームワーク",
      pros: ["軽量", "高速", "直感的な構文"],
      cons: ["エコシステムが小さい", "企業採用が少ない"],
      difficulty: "intermediate"
    },
    // Backend Technologies
    {
      name: "Node.js + Express",
      category: "backend",
      description: "JavaScriptバックエンド環境",
      pros: ["フロントエンドと言語統一", "NPMエコシステム", "軽量"],
      cons: ["シングルスレッド", "型安全性が低い"],
      difficulty: "beginner"
    },
    {
      name: "FastAPI (Python)",
      category: "backend",
      description: "高速なPython APIフレームワーク",
      pros: ["自動ドキュメント生成", "型ヒント対応", "高性能"],
      cons: ["Pythonの知識が必要", "新しいフレームワーク"],
      difficulty: "intermediate"
    },
    {
      name: "Django (Python)",
      category: "backend",
      description: "Pythonのフルスタックフレームワーク",
      pros: ["バッテリー内蔵", "管理画面自動生成", "セキュア"],
      cons: ["重厚", "小規模プロジェクトには過剰"],
      difficulty: "intermediate"
    },
    {
      name: "Ruby on Rails",
      category: "backend",
      description: "Ruby on Railsフレームワーク",
      pros: ["開発速度が速い", "豊富なgem", "MVCアーキテクチャ"],
      cons: ["パフォーマンスが劣る", "学習コストが高い"],
      difficulty: "intermediate"
    },
    {
      name: "Spring Boot (Java)",
      category: "backend",
      description: "Javaの企業向けフレームワーク",
      pros: ["エンタープライズ級", "豊富な機能", "大規模開発対応"],
      cons: ["重厚", "設定が複雑", "起動が遅い"],
      difficulty: "advanced"
    },
    {
      name: "Gin (Go)",
      category: "backend",
      description: "高性能なGo言語フレームワーク",
      pros: ["高速", "軽量", "並行処理に強い"],
      cons: ["学習コストが高い", "エコシステムが小さい"],
      difficulty: "advanced"
    },
    {
      name: "ASP.NET Core (C#)",
      category: "backend",
      description: "Microsoft製クロスプラットフォームフレームワーク",
      pros: ["高性能", "型安全", "豊富なツール"],
      cons: ["Microsoft依存", "学習コストが高い"],
      difficulty: "advanced"
    },
    {
      name: "Laravel (PHP)",
      category: "backend",
      description: "PHPの人気フレームワーク",
      pros: ["開発効率が高い", "豊富な機能", "学習しやすい"],
      cons: ["パフォーマンスが劣る", "PHP特有の問題"],
      difficulty: "beginner"
    },
    // Database Technologies
    {
      name: "PostgreSQL",
      category: "database",
      description: "高機能なオープンソースRDB",
      pros: ["ACID準拠", "JSON対応", "拡張性が高い"],
      cons: ["設定が複雑", "メモリ使用量が多い"],
      difficulty: "intermediate"
    },
    {
      name: "MySQL",
      category: "database",
      description: "世界で最も人気のあるRDB",
      pros: ["高速", "軽量", "豊富な情報"],
      cons: ["機能が限定的", "データ整合性の問題"],
      difficulty: "beginner"
    },
    {
      name: "MongoDB",
      category: "database",
      description: "NoSQLドキュメントデータベース",
      pros: ["柔軟なスキーマ", "スケーラブル", "JSON形式"],
      cons: ["ACID保証が弱い", "メモリ使用量が多い"],
      difficulty: "intermediate"
    },
    {
      name: "Redis",
      category: "database",
      description: "インメモリデータストア",
      pros: ["超高速", "キャッシュに最適", "多様なデータ構造"],
      cons: ["メモリ依存", "永続化の制限"],
      difficulty: "beginner"
    },
    // Deployment Technologies
    {
      name: "Vercel",
      category: "deployment",
      description: "フロントエンド特化のホスティング",
      pros: ["簡単デプロイ", "CDN内蔵", "Next.js最適化"],
      cons: ["バックエンド制限", "コストが高い"],
      difficulty: "beginner"
    },
    {
      name: "Netlify",
      category: "deployment",
      description: "JAMstack向けホスティング",
      pros: ["簡単設定", "CDN内蔵", "無料枠豊富"],
      cons: ["動的機能制限", "複雑な処理に不向き"],
      difficulty: "beginner"
    },
    {
      name: "AWS (EC2/ECS)",
      category: "deployment",
      description: "Amazon Web Servicesクラウド",
      pros: ["豊富なサービス", "スケーラブル", "企業級"],
      cons: ["複雑", "コスト管理が困難", "学習コストが高い"],
      difficulty: "advanced"
    },
    {
      name: "Docker + Heroku",
      category: "deployment",
      description: "コンテナ化とPaaSの組み合わせ",
      pros: ["簡単デプロイ", "環境統一", "スケーラブル"],
      cons: ["コストが高い", "制限が多い"],
      difficulty: "intermediate"
    }
  ],
  ios: [
    // Frontend/Main
    {
      name: "Swift + UIKit",
      category: "frontend",
      description: "iOS標準開発言語とフレームワーク",
      pros: ["ネイティブ性能", "豊富なAPI", "Apple公式サポート"],
      cons: ["iOS専用", "学習コストが高い"],
      difficulty: "intermediate"
    },
    {
      name: "Swift + SwiftUI",
      category: "frontend",
      description: "最新のSwift UIフレームワーク",
      pros: ["宣言的UI", "プレビュー機能", "macOS/watchOS対応"],
      cons: ["iOS 13以降限定", "まだ発展途上"],
      difficulty: "intermediate"
    },
    {
      name: "React Native",
      category: "frontend",
      description: "クロスプラットフォーム開発フレームワーク",
      pros: ["コード共有可能", "Reactの知識活用", "ホットリロード"],
      cons: ["ネイティブより性能劣る", "プラットフォーム固有機能制限"],
      difficulty: "intermediate"
    },
    {
      name: "Flutter",
      category: "frontend",
      description: "Googleのクロスプラットフォームフレームワーク",
      pros: ["高性能", "豊富なウィジェット", "ホットリロード"],
      cons: ["Dartの学習が必要", "アプリサイズが大きい"],
      difficulty: "intermediate"
    },
    // Backend (共通)
    {
      name: "Firebase",
      category: "backend",
      description: "Googleのモバイル向けBaaS",
      pros: ["簡単セットアップ", "リアルタイムDB", "認証機能"],
      cons: ["ベンダーロックイン", "複雑なクエリ制限"],
      difficulty: "beginner"
    },
    {
      name: "AWS Amplify",
      category: "backend",
      description: "AWSのモバイル向けサービス",
      pros: ["AWSサービス統合", "GraphQL自動生成", "CI/CD"],
      cons: ["AWSの知識が必要", "設定が複雑"],
      difficulty: "intermediate"
    }
  ],
  android: [
    // Frontend/Main
    {
      name: "Kotlin + Jetpack Compose",
      category: "frontend",
      description: "Android標準開発とモダンUIフレームワーク",
      pros: ["ネイティブ性能", "最新UI", "Kotlin言語"],
      cons: ["Android専用", "新しいため情報少ない"],
      difficulty: "intermediate"
    },
    {
      name: "Java + XML",
      category: "frontend",
      description: "従来のAndroid開発手法",
      pros: ["安定している", "豊富な情報", "Javaの知識活用"],
      cons: ["冗長なコード", "開発効率が低い"],
      difficulty: "beginner"
    },
    {
      name: "React Native",
      category: "frontend",
      description: "クロスプラットフォーム開発フレームワーク",
      pros: ["コード共有可能", "Reactの知識活用", "開発速度"],
      cons: ["ネイティブより性能劣る", "プラットフォーム固有機能制限"],
      difficulty: "intermediate"
    },
    {
      name: "Flutter",
      category: "frontend",
      description: "Googleのクロスプラットフォームフレームワーク",
      pros: ["高性能", "豊富なウィジェット", "単一コードベース"],
      cons: ["Dartの学習が必要", "アプリサイズが大きい"],
      difficulty: "intermediate"
    },
    // Backend (共通)
    {
      name: "Firebase",
      category: "backend",
      description: "Googleのモバイル向けBaaS",
      pros: ["簡単セットアップ", "リアルタイムDB", "認証機能"],
      cons: ["ベンダーロックイン", "複雑なクエリ制限"],
      difficulty: "beginner"
    },
    {
      name: "AWS Amplify",
      category: "backend",
      description: "AWSのモバイル向けサービス",
      pros: ["AWSサービス統合", "GraphQL自動生成", "スケーラブル"],
      cons: ["AWSの知識が必要", "コストが高い"],
      difficulty: "intermediate"
    }
  ]
};

export default function SelectFramework() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[2];
  const { darkMode } = useDarkMode();

  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [selectedPlatform, setSelectedPlatform] = useState<SelectedPlatform>(null);
  const [selectedTechnologies, setSelectedTechnologies] = useState<Set<string>>(new Set());
  const [aiRecommendations, setAiRecommendations] = useState<FrameworkRecommendationResponse | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [projectSpecification, setProjectSpecification] = useState<string>("");
  const [useAIRecommendations, setUseAIRecommendations] = useState(false);

  // 初期処理：プロジェクト仕様書を取得 + バックグラウンドで機能構造化を開始
  useEffect(() => {
    const initializeFlow = async () => {
      if (!projectId) return;

      try {
        const doc = await getProjectDocument(projectId);
        setProjectSpecification(doc.function_doc || "");
        setFlowState('ready');

        // バックグラウンドで機能構造化APIを呼び出し（時間稼ぎ）
        // ユーザーが技術を選んでいる間に処理を進める
        structureFunctions(projectId).catch((error) => {
          console.log("Background function structuring failed (non-blocking):", error);
          // エラーは無視（次のページで再試行される）
        });
      } catch (error) {
        console.error("プロジェクト仕様書の取得に失敗:", error);
        // エラーが発生した場合でも空の仕様書で進める
        setProjectSpecification("");
        setFlowState('ready');
      }
    };

    initializeFlow();
  }, [projectId]);

  // AI推薦を取得
  const handleGetAIRecommendations = async () => {
    setIsLoadingRecommendations(true);
    try {
      const recommendations = await getFrameworkRecommendations(
        projectSpecification || "一般的なWebアプリケーション", // 仕様書がない場合はデフォルト値を使用
        "" // function_doc は今回は空文字
      );
      setAiRecommendations(recommendations);
    } catch (error) {
      console.error("AI推薦の取得に失敗:", error);
      // Fallback to mock data if API fails
      const mockRecommendations: FrameworkRecommendationResponse = {
        recommended_technologies: [
          { name: "React", priority: 1, reason: "コンポーネントベースで再利用性が高く、豊富なエコシステムがあるため" },
          { name: "Node.js + Express", priority: 2, reason: "フロントエンドと同じJavaScriptで統一でき、開発効率が向上するため" },
          { name: "PostgreSQL", priority: 3, reason: "高機能で信頼性が高く、プロジェクトの成長に対応できるため" }
        ]
      };
      setAiRecommendations(mockRecommendations);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // AI推薦選択の処理
  const handleAIRecommendationSelect = () => {
    setUseAIRecommendations(true);
    setSelectedPlatform('web'); // AI推薦はwebプラットフォームを前提
    // AI推薦の技術は自動選択せず、ユーザーが個別に選択
    setSelectedTechnologies(new Set());
  };

  // 手動選択の処理
  const handleManualSelect = () => {
    setUseAIRecommendations(false);
    setSelectedPlatform('web'); // デフォルトでWebを選択
    setSelectedTechnologies(new Set());
  };

  // プラットフォーム選択
  const handlePlatformSelect = (platform: 'web' | 'ios' | 'android') => {
    setUseAIRecommendations(false); // 手動選択に切り替え
    setSelectedPlatform(platform);
    setSelectedTechnologies(new Set());
  };

  // 技術選択
  const handleTechnologyToggle = (techName: string) => {
    const newSelected = new Set(selectedTechnologies);
    if (newSelected.has(techName)) {
      newSelected.delete(techName);
    } else {
      newSelected.add(techName);
    }
    setSelectedTechnologies(newSelected);
  };

  // 次へ進む
  const handleNext = () => {
    if (selectedTechnologies.size === 0 || (!selectedPlatform && !useAIRecommendations)) return;

    // 選択データを次ページへ渡して即座に遷移
    const searchParams = new URLSearchParams({
      technologies: Array.from(selectedTechnologies).join(','),
      platform: selectedPlatform || '',
      aiRecommended: useAIRecommendations.toString()
    });

    router.push(`/hackSetUp/${projectId}/functionStructuring?${searchParams.toString()}`);
  };

  // 難易度の表示色
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-500';
      case 'intermediate': return 'text-yellow-500';
      case 'advanced': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  // 難易度の表示テキスト
  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '初級';
      case 'intermediate': return '中級';
      case 'advanced': return '上級';
      default: return '不明';
    }
  };

  // カテゴリの表示ラベル
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'frontend': return 'フロントエンド';
      case 'backend': return 'バックエンド';
      case 'database': return 'データベース';
      case 'deployment': return 'デプロイメント';
      default: return category;
    }
  };

  // カテゴリの色
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'frontend': return darkMode ? 'bg-purple-500/80 text-white' : 'bg-purple-500 text-white';
      case 'backend': return darkMode ? 'bg-blue-500/80 text-white' : 'bg-blue-500 text-white';
      case 'database': return darkMode ? 'bg-green-600/80 text-white' : 'bg-green-600 text-white';
      case 'deployment': return darkMode ? 'bg-orange-500/80 text-white' : 'bg-orange-500 text-white';
      default: return darkMode ? 'bg-gray-500/80 text-white' : 'bg-gray-500 text-white';
    }
  };

  // カテゴリごとの選択数を計算
  const getCategorySelectionCount = (category: string) => {
    if (!selectedPlatform && !useAIRecommendations) return 0;
    const platform = useAIRecommendations ? 'web' : selectedPlatform;
    if (!platform) return 0;

    return Array.from(selectedTechnologies).filter(techName => {
      const tech = TECHNOLOGY_OPTIONS[platform]?.find(t => t.name === techName);
      return tech?.category === category;
    }).length;
  };

  // 現在のプラットフォームの必須カテゴリを取得
    // 型定義を追加して config のプロパティにアクセスできるようにする
    type CategoryConfig = { min: number; label: string; required: boolean };
    type RequiredCategoriesMap = Record<string, CategoryConfig>;
  
    const getRequiredCategories = (): RequiredCategoriesMap => {
      const platform = useAIRecommendations ? 'web' : selectedPlatform;
      if (!platform) return {};
      return (REQUIRED_CATEGORIES[platform] as RequiredCategoriesMap) || {};
    };

  // すべての必須カテゴリが満たされているかチェック
  const areAllRequiredCategoriesFilled = () => {
    const requiredCategories = getRequiredCategories();
    return Object.entries(requiredCategories).every(([category, config]) => {
      if (!config.required) return true;
      return getCategorySelectionCount(category) >= config.min;
    });
  };

  // 完了したカテゴリ数を計算
  const getCompletedCategoriesCount = () => {
    const requiredCategories = getRequiredCategories();
    return Object.entries(requiredCategories).filter(([category, config]) => {
      if (!config.required) return false;
      return getCategorySelectionCount(category) >= config.min;
    }).length;
  };

  // 必須カテゴリの総数
  const getTotalRequiredCategoriesCount = () => {
    const requiredCategories = getRequiredCategories();
    return Object.values(requiredCategories).filter(config => config.required).length;
  };

  // 不足しているカテゴリのリストを取得
  const getMissingCategories = () => {
    const requiredCategories = getRequiredCategories();
    return Object.entries(requiredCategories)
      .filter(([category, config]: [string, CategoryConfig]) => {
        if (!config.required) return false;
        return getCategorySelectionCount(category) < config.min;
      })
      .map(([, config]: [string, CategoryConfig]) => config.label);
  };

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
                技術スタック
                <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
                  _選択
                </span>
              </h1>
            </div>
            <p
              className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              プラットフォームと技術スタックを選択してください
            </p>
          </div>

          {/* 技術選択方法 */}
          <div className="mb-8">
            <h2 className={`text-xl font-bold mb-4 ${
              darkMode ? "text-cyan-300" : "text-purple-700"
            }`}>
              技術選択方法を選択
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AI推薦オプション */}
              <button
                onClick={() => {
                  if (!aiRecommendations) {
                    handleGetAIRecommendations();
                  } else {
                    handleAIRecommendationSelect();
                  }
                }}
                disabled={isLoadingRecommendations}
                className={`p-6 rounded-xl border-2 transition-all hover:scale-105 ${
                  useAIRecommendations
                    ? darkMode
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                      : "bg-purple-100 border-purple-500 text-purple-700"
                    : darkMode
                      ? "bg-gray-800/50 border-gray-600 text-gray-300 hover:border-cyan-500/50"
                      : "bg-white border-gray-300 text-gray-700 hover:border-purple-500/50"
                } disabled:opacity-50`}
              >
                <Bot size={32} className="mx-auto mb-3" />
                <h3 className="text-lg font-semibold">AI推薦</h3>
                <p className="text-sm opacity-75 mb-3">
                  {!aiRecommendations
                    ? "プロジェクトに最適な技術を自動選択"
                    : "AI推薦による技術スタック"
                  }
                </p>
                {isLoadingRecommendations && (
                  <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" size={18} />
                    <span className="text-xs">推薦を生成中...</span>
                  </div>
                )}
                {aiRecommendations && !isLoadingRecommendations && (
                  <div className="text-xs opacity-75">
                    {aiRecommendations.recommended_technologies.length}個の技術を推薦
                  </div>
                )}
              </button>

              {/* 手動選択オプション */}
              <button
                onClick={handleManualSelect}
                className={`p-6 rounded-xl border-2 transition-all hover:scale-105 ${
                  !useAIRecommendations && selectedPlatform
                    ? darkMode
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                      : "bg-purple-100 border-purple-500 text-purple-700"
                    : darkMode
                      ? "bg-gray-800/50 border-gray-600 text-gray-300 hover:border-cyan-500/50"
                      : "bg-white border-gray-300 text-gray-700 hover:border-purple-500/50"
                }`}
              >
                <Terminal size={32} className="mx-auto mb-3" />
                <h3 className="text-lg font-semibold">手動選択</h3>
                <p className="text-sm opacity-75">
                  プラットフォームから自分で技術を選択
                </p>
              </button>
            </div>
          </div>

          {/* AI推薦技術選択 - 2カラムレイアウト */}
          {useAIRecommendations && aiRecommendations && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
              {/* 左側：選択状況メータ（sticky） */}
              <div className="lg:col-span-3">
                <div className="lg:sticky lg:top-24">
                  <div className={`p-4 rounded-xl border-2 ${
                    darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-300"
                  }`}>
                    <h3 className={`text-sm font-semibold mb-3 flex items-center ${
                      darkMode ? "text-cyan-300" : "text-purple-700"
                    }`}>
                      <Bot size={16} className="mr-2" />
                      選択状況
                    </h3>

                    {/* 全体進捗サマリー */}
                    <div className={`mb-4 p-3 rounded-lg ${
                      areAllRequiredCategoriesFilled()
                        ? darkMode ? "bg-green-900/20 border border-green-500/30" : "bg-green-50 border border-green-200"
                        : darkMode ? "bg-yellow-900/20 border border-yellow-500/30" : "bg-yellow-50 border border-yellow-200"
                    }`}>
                      <div className={`text-xs font-semibold mb-1 ${
                        areAllRequiredCategoriesFilled()
                          ? darkMode ? "text-green-400" : "text-green-600"
                          : darkMode ? "text-yellow-400" : "text-yellow-600"
                      }`}>
                        {areAllRequiredCategoriesFilled() ? (
                          <span className="flex items-center">
                            <Check size={14} className="mr-1" />
                            選択完了
                          </span>
                        ) : (
                          `進捗: ${getCompletedCategoriesCount()}/${getTotalRequiredCategoriesCount()}`
                        )}
                      </div>
                      <div className={`text-xs ${
                        areAllRequiredCategoriesFilled()
                          ? darkMode ? "text-green-300" : "text-green-700"
                          : darkMode ? "text-yellow-300" : "text-yellow-700"
                      }`}>
                        {areAllRequiredCategoriesFilled()
                          ? "すべての必須カテゴリが選択されています"
                          : "必須カテゴリを選択してください"
                        }
                      </div>
                    </div>

                    {/* カテゴリ別進捗 */}
                    <div className="space-y-3">
                      {Object.entries(getRequiredCategories()).map(([category, config]: [string, CategoryConfig]) => {
                        const count = getCategorySelectionCount(category);
                        const isFilled = count >= config.min;
                        const percentage = config.min > 0 ? Math.min((count / config.min) * 100, 100) : 100;

                        return (
                          <div key={category}>
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs font-medium ${
                                darkMode ? "text-gray-300" : "text-gray-700"
                              }`}>
                                {config.label}
                                {config.required && <span className="text-red-500 ml-1">*</span>}
                              </span>
                              <span className={`text-xs flex items-center ${
                                isFilled
                                  ? darkMode ? "text-green-400" : "text-green-600"
                                  : darkMode ? "text-gray-400" : "text-gray-500"
                              }`}>
                                {count}/{config.min}
                                {isFilled && <Check size={12} className="ml-1" />}
                              </span>
                            </div>
                            <div className={`h-1.5 rounded-full overflow-hidden ${
                              darkMode ? "bg-gray-700" : "bg-gray-200"
                            }`}>
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isFilled
                                    ? "bg-gradient-to-r from-green-500 to-green-600"
                                    : count > 0
                                      ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                                      : "bg-gray-400"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 未完了の警告メッセージ */}
                    {!areAllRequiredCategoriesFilled() && (
                      <div className={`mt-3 text-xs ${darkMode ? "text-yellow-400" : "text-yellow-600"}`}>
                        ⚠️ 必須カテゴリ（*印）を選択してください
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 右側：AI推薦技術カード */}
              <div className="lg:col-span-9">
                <h2 className={`text-xl font-bold mb-4 flex items-center ${
                  darkMode ? "text-cyan-300" : "text-purple-700"
                }`}>
                  <Bot size={24} className="mr-2" />
                  AI推薦技術を選択 (WEB)
                </h2>

                {/* AI推薦技術を手動選択と同じUIで表示 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiRecommendations.recommended_technologies
                  .sort((a, b) => a.priority - b.priority)
                  .map((tech, index) => {
                    // 手動選択の技術リストから詳細情報を取得
                    const techDetail = TECHNOLOGY_OPTIONS.web.find(t => t.name === tech.name);

                    return (
                    <div
                      key={index}
                      onClick={() => handleTechnologyToggle(tech.name)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-102 relative ${
                        selectedTechnologies.has(tech.name)
                          ? darkMode
                            ? "bg-cyan-500/20 border-cyan-500"
                            : "bg-purple-100 border-purple-500"
                          : darkMode
                            ? "bg-gray-800/50 border-gray-600 hover:border-cyan-500/50"
                            : "bg-white border-gray-300 hover:border-purple-500/50"
                      }`}
                    >
                      {/* AI推薦バッジ */}
                      <div className="absolute top-2 right-2">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          darkMode ? "bg-green-500 text-white" : "bg-green-500 text-white"
                        }`}>
                          AI推薦
                        </div>
                      </div>

                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className={`font-semibold ${
                            darkMode ? "text-cyan-300" : "text-purple-700"
                          }`}>
                            {tech.name}
                          </h4>
                          <div className="flex gap-2 mt-1">
                            {techDetail && (
                              <span className={`text-xs px-2 py-1 rounded ${getDifficultyColor(techDetail.difficulty)}`}>
                                {getDifficultyText(techDetail.difficulty)}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded ${
                              tech.priority <= 3
                                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                : tech.priority <= 6
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}>
                              優先度 {tech.priority}
                            </span>
                          </div>
                        </div>
                        {selectedTechnologies.has(tech.name) && (
                          <Check size={20} className={darkMode ? "text-cyan-400" : "text-purple-600"} />
                        )}
                      </div>

                      <p className={`text-sm mb-3 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                        {techDetail?.description || "AI推薦技術"}
                      </p>

                      {/* AI推薦理由 */}
                      <div className={`p-2 rounded-lg mb-3 ${
                        darkMode ? "bg-green-900/30 border border-green-500/30" : "bg-green-50 border border-green-200"
                      }`}>
                        <h5 className={`text-xs font-semibold mb-1 ${darkMode ? "text-green-400" : "text-green-600"}`}>
                          AI推薦理由
                        </h5>
                        <p className={`text-xs ${darkMode ? "text-green-300" : "text-green-700"}`}>
                          {tech.reason}
                        </p>
                      </div>

                      {/* 技術詳細情報（あれば表示） */}
                      {techDetail && (
                        <div className="space-y-2">
                          <div>
                            <h5 className={`text-xs font-semibold mb-1 ${darkMode ? "text-green-400" : "text-green-600"}`}>
                              メリット
                            </h5>
                            <ul className="text-xs space-y-1">
                              {techDetail.pros.slice(0, 2).map((pro, index) => (
                                <li key={index} className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                  • {pro}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h5 className={`text-xs font-semibold mb-1 ${darkMode ? "text-red-400" : "text-red-600"}`}>
                              注意点
                            </h5>
                            <ul className="text-xs space-y-1">
                              {techDetail.cons.slice(0, 2).map((con, index) => (
                                <li key={index} className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                  • {con}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* プラットフォーム選択（手動選択時のみ表示） */}
          {!useAIRecommendations && (
            <div className="mb-8">
              <h2 className={`text-xl font-bold mb-4 ${
                darkMode ? "text-cyan-300" : "text-purple-700"
              }`}>
                プラットフォームを選択
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: 'web', icon: Globe, title: 'Web', desc: 'Webアプリケーション' },
                  { key: 'ios', icon: Smartphone, title: 'iOS', desc: 'iOSアプリ' },
                  { key: 'android', icon: Tablet, title: 'Android', desc: 'Androidアプリ' }
                ].map(({ key, icon: Icon, title, desc }) => (
                  <button
                    key={key}
                    onClick={() => handlePlatformSelect(key as 'web' | 'ios' | 'android')}
                    className={`p-6 rounded-xl border-2 transition-colors duration-200 h-[160px] w-full flex flex-col items-center justify-center ${
                      selectedPlatform === key
                        ? darkMode
                          ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                          : "bg-purple-100 border-purple-500 text-purple-700"
                        : darkMode
                          ? "bg-gray-800/50 border-gray-600 text-gray-300 hover:border-cyan-500/50"
                          : "bg-white border-gray-300 text-gray-700 hover:border-purple-500/50"
                    }`}
                  >
                    <Icon size={32} className="mb-3" />
                    <h3 className="text-lg font-semibold mb-2">{title}</h3>
                    <p className="text-sm opacity-75">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 技術選択（手動選択時のみ）- 2カラムレイアウト */}
          {selectedPlatform && !useAIRecommendations && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
              {/* 左側：選択状況メータ（sticky） */}
              <div className="lg:col-span-3">
                <div className="lg:sticky lg:top-24">
                  <div className={`p-4 rounded-xl border-2 ${
                    darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-300"
                  }`}>
                    <h3 className={`text-sm font-semibold mb-3 flex items-center ${
                      darkMode ? "text-cyan-300" : "text-purple-700"
                    }`}>
                      <Terminal size={16} className="mr-2" />
                      選択状況
                    </h3>

                    {/* 全体進捗サマリー */}
                    <div className={`mb-4 p-3 rounded-lg ${
                      areAllRequiredCategoriesFilled()
                        ? darkMode ? "bg-green-900/20 border border-green-500/30" : "bg-green-50 border border-green-200"
                        : darkMode ? "bg-yellow-900/20 border border-yellow-500/30" : "bg-yellow-50 border border-yellow-200"
                    }`}>
                      <div className={`text-xs font-semibold mb-1 ${
                        areAllRequiredCategoriesFilled()
                          ? darkMode ? "text-green-400" : "text-green-600"
                          : darkMode ? "text-yellow-400" : "text-yellow-600"
                      }`}>
                        {areAllRequiredCategoriesFilled() ? (
                          <span className="flex items-center">
                            <Check size={14} className="mr-1" />
                            選択完了
                          </span>
                        ) : (
                          `進捗: ${getCompletedCategoriesCount()}/${getTotalRequiredCategoriesCount()}`
                        )}
                      </div>
                      <div className={`text-xs ${
                        areAllRequiredCategoriesFilled()
                          ? darkMode ? "text-green-300" : "text-green-700"
                          : darkMode ? "text-yellow-300" : "text-yellow-700"
                      }`}>
                        {areAllRequiredCategoriesFilled()
                          ? "すべての必須カテゴリが選択されています"
                          : "必須カテゴリを選択してください"
                        }
                      </div>
                    </div>

                    {/* カテゴリ別進捗 */}
                    <div className="space-y-3">
                      {Object.entries(getRequiredCategories()).map(([category, config]: [string, CategoryConfig]) => {
                        const count = getCategorySelectionCount(category);
                        const isFilled = count >= config.min;
                        const percentage = config.min > 0 ? Math.min((count / config.min) * 100, 100) : 100;

                        return (
                          <div key={category}>
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs font-medium ${
                                darkMode ? "text-gray-300" : "text-gray-700"
                              }`}>
                                {config.label}
                                {config.required && <span className="text-red-500 ml-1">*</span>}
                              </span>
                              <span className={`text-xs flex items-center ${
                                isFilled
                                  ? darkMode ? "text-green-400" : "text-green-600"
                                  : darkMode ? "text-gray-400" : "text-gray-500"
                              }`}>
                                {count}/{config.min}
                                {isFilled && <Check size={12} className="ml-1" />}
                              </span>
                            </div>
                            <div className={`h-1.5 rounded-full overflow-hidden ${
                              darkMode ? "bg-gray-700" : "bg-gray-200"
                            }`}>
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isFilled
                                    ? "bg-gradient-to-r from-green-500 to-green-600"
                                    : count > 0
                                      ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                                      : "bg-gray-400"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 未完了の警告メッセージ */}
                    {!areAllRequiredCategoriesFilled() && (
                      <div className={`mt-3 text-xs ${darkMode ? "text-yellow-400" : "text-yellow-600"}`}>
                        ⚠️ 必須カテゴリ（*印）を選択してください
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 右側：技術選択カード */}
              <div className="lg:col-span-9">
                <h2 className={`text-xl font-bold mb-4 ${
                  darkMode ? "text-cyan-300" : "text-purple-700"
                }`}>
                  技術スタックを選択 ({selectedPlatform.toUpperCase()})
                </h2>

              {selectedPlatform === 'web' ? (
                // Web専用：カテゴリ別表示
                <>
                  {['frontend', 'backend', 'database', 'deployment'].map((category) => {
                    const categoryTechs = TECHNOLOGY_OPTIONS[selectedPlatform].filter(tech => tech.category === category);
                    if (categoryTechs.length === 0) return null;

                    const categoryLabels: Record<string, string> = {
                      frontend: 'フロントエンド',
                      backend: 'バックエンド',
                      database: 'データベース',
                      deployment: 'デプロイメント'
                    };

                    return (
                      <div key={category} className="mb-8">
                        <h3 className={`text-lg font-semibold mb-4 ${
                          darkMode ? "text-cyan-200" : "text-purple-600"
                        }`}>
                          {categoryLabels[category]}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categoryTechs.map((tech) => {
                            const isRecommended = aiRecommendations?.recommended_technologies.some(rec => rec.name === tech.name);
                            const recommendedTech = aiRecommendations?.recommended_technologies.find(rec => rec.name === tech.name);

                            return (
                            <div
                              key={tech.name}
                              onClick={() => handleTechnologyToggle(tech.name)}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-102 relative ${
                                selectedTechnologies.has(tech.name)
                                  ? darkMode
                                    ? "bg-cyan-500/20 border-cyan-500"
                                    : "bg-purple-100 border-purple-500"
                                  : isRecommended
                                    ? darkMode
                                      ? "bg-green-900/20 border-green-500/50 hover:border-green-500"
                                      : "bg-green-50 border-green-300 hover:border-green-500"
                                    : darkMode
                                      ? "bg-gray-800/50 border-gray-600 hover:border-cyan-500/50"
                                      : "bg-white border-gray-300 hover:border-purple-500/50"
                              }`}
                            >
                              {/* カテゴリバッジとAI推薦バッジ（右上） */}
                              <div className="absolute top-2 right-2 flex gap-1 flex-wrap justify-end">
                                {/* カテゴリバッジ */}
                                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(tech.category)}`}>
                                  {getCategoryLabel(tech.category)}
                                </div>
                                {/* AI推薦バッジ */}
                                {isRecommended && (
                                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    darkMode ? "bg-green-500 text-white" : "bg-green-500 text-white"
                                  }`}>
                                    AI推薦
                                  </div>
                                )}
                              </div>

                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className={`font-semibold ${
                                    darkMode ? "text-cyan-300" : "text-purple-700"
                                  }`}>
                                    {tech.name}
                                  </h4>
                                  <div className="flex gap-2 mt-1">
                                    <span className={`text-xs px-2 py-1 rounded ${getDifficultyColor(tech.difficulty)}`}>
                                      {getDifficultyText(tech.difficulty)}
                                    </span>
                                    {isRecommended && recommendedTech && (
                                      <span className={`text-xs px-2 py-1 rounded ${
                                        darkMode ? "bg-green-800 text-green-200" : "bg-green-100 text-green-700"
                                      }`}>
                                        優先度 {recommendedTech.priority}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {selectedTechnologies.has(tech.name) && (
                                  <Check size={20} className={darkMode ? "text-cyan-400" : "text-purple-600"} />
                                )}
                              </div>

                              <p className={`text-sm mb-3 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                {tech.description}
                              </p>

                              {/* AI推薦理由 */}
                              {isRecommended && recommendedTech && (
                                <div className={`p-2 rounded-lg mb-3 ${
                                  darkMode ? "bg-green-900/30 border border-green-500/30" : "bg-green-50 border border-green-200"
                                }`}>
                                  <h5 className={`text-xs font-semibold mb-1 ${darkMode ? "text-green-400" : "text-green-600"}`}>
                                    AI推薦理由
                                  </h5>
                                  <p className={`text-xs ${darkMode ? "text-green-300" : "text-green-700"}`}>
                                    {recommendedTech.reason}
                                  </p>
                                </div>
                              )}

                              <div className="space-y-2">
                                <div>
                                  <h5 className={`text-xs font-semibold mb-1 ${darkMode ? "text-green-400" : "text-green-600"}`}>
                                    メリット
                                  </h5>
                                  <ul className="text-xs space-y-1">
                                    {tech.pros.slice(0, 2).map((pro, index) => (
                                      <li key={index} className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                        • {pro}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div>
                                  <h5 className={`text-xs font-semibold mb-1 ${darkMode ? "text-red-400" : "text-red-600"}`}>
                                    注意点
                                  </h5>
                                  <ul className="text-xs space-y-1">
                                    {tech.cons.slice(0, 2).map((con, index) => (
                                      <li key={index} className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                        • {con}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                // iOS/Android：カテゴリ表示付き
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TECHNOLOGY_OPTIONS[selectedPlatform].map((tech) => (
                  <div
                    key={tech.name}
                    onClick={() => handleTechnologyToggle(tech.name)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-102 relative ${
                      selectedTechnologies.has(tech.name)
                        ? darkMode
                          ? "bg-cyan-500/20 border-cyan-500"
                          : "bg-purple-100 border-purple-500"
                        : darkMode
                          ? "bg-gray-800/50 border-gray-600 hover:border-cyan-500/50"
                          : "bg-white border-gray-300 hover:border-purple-500/50"
                    }`}
                  >
                    {/* カテゴリバッジ（右上） */}
                    <div className="absolute top-2 right-2">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        tech.category === 'frontend'
                          ? darkMode ? "bg-purple-500/80 text-white" : "bg-purple-500 text-white"
                          : darkMode ? "bg-blue-500/80 text-white" : "bg-blue-500 text-white"
                      }`}>
                        {tech.category === 'frontend' ? 'フロントエンド' : 'バックエンド'}
                      </div>
                    </div>

                    <div className="flex items-start justify-between mb-2">
                      <div className="pr-24">
                        <h3 className={`font-semibold ${
                          darkMode ? "text-cyan-300" : "text-purple-700"
                        }`}>
                          {tech.name}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded ${getDifficultyColor(tech.difficulty)}`}>
                          {getDifficultyText(tech.difficulty)}
                        </span>
                      </div>
                      {selectedTechnologies.has(tech.name) && (
                        <Check size={20} className={darkMode ? "text-cyan-400" : "text-purple-600"} />
                      )}
                    </div>

                    <p className={`text-sm mb-3 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {tech.description}
                    </p>

                    <div className="space-y-2">
                      <div>
                        <h5 className={`text-xs font-semibold mb-1 ${darkMode ? "text-green-400" : "text-green-600"}`}>
                          メリット
                        </h5>
                        <ul className="text-xs space-y-1">
                          {tech.pros.slice(0, 2).map((pro, index) => (
                            <li key={index} className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                              • {pro}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h5 className={`text-xs font-semibold mb-1 ${darkMode ? "text-red-400" : "text-red-600"}`}>
                          注意点
                        </h5>
                        <ul className="text-xs space-y-1">
                          {tech.cons.slice(0, 2).map((con, index) => (
                            <li key={index} className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                              • {con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          )}

          {/* 次へ進むボタン */}
          {selectedTechnologies.size > 0 && (useAIRecommendations || selectedPlatform) && (
            <div className="mt-8">
              <div
                className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
                  darkMode
                    ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                    : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
                }`}
              >
                <div className="text-center py-4">
                  <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    選択した技術: {Array.from(selectedTechnologies).join(", ")}
                  </p>

                  {areAllRequiredCategoriesFilled() ? (
                    <>
                      <p className={`mb-6 flex items-center justify-center ${
                        darkMode ? 'text-green-400' : 'text-green-600'
                      }`}>
                        <Check size={18} className="mr-2" />
                        すべての必須カテゴリが選択されています。次のステップに進みましょう！
                      </p>

                      <button
                        onClick={handleNext}
                        className={`px-8 py-3 flex items-center mx-auto rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                          darkMode
                            ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400"
                            : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
                        }`}
                      >
                        <span>次へ進む</span>
                        <ChevronRight size={18} className="ml-2" />
                      </button>
                    </>
                  ) : (
                    <>
                      <p className={`mb-6 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        ⚠️ {getMissingCategories().join('、')}が足りませんが次に進みますか？
                      </p>

                      <button
                        onClick={handleNext}
                        className={`px-8 py-3 flex items-center mx-auto rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                          darkMode
                            ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400"
                            : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
                        }`}
                      >
                        <span>次へ進む</span>
                        <ChevronRight size={18} className="ml-2" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <HackthonSupportAgent />
        </div>
      </main>

      {/* AI Chat Widget */}
      {projectId && (
        <AgentChatWidget
          projectId={projectId}
          pageContext="selectFramework"
          pageSpecificContext={{
            selected_platform: selectedPlatform,
            selected_technologies: Array.from(selectedTechnologies),
          }}
        />
      )}
    </>
  );
}