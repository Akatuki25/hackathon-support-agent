"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Terminal, ChevronRight, Loader2, Smartphone, Globe, Tablet, Bot, Check } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import Header from "@/components/Session/Header";
import Loading from "@/components/PageLoading";
import { getProjectDocument } from "@/libs/modelAPI/frameworkService";
import { getFrameworkRecommendations, saveFrameworkSelection } from "@/libs/service/frameworkService";

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
  const [processingNext, setProcessingNext] = useState(false);

  // 初期処理：プロジェクト仕様書を取得
  useEffect(() => {
    const initializeFlow = async () => {
      if (!projectId) return;

      try {
        const doc = await getProjectDocument(projectId);
        setProjectSpecification(doc.function_doc || "");
        setFlowState('ready');
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

  // プラットフォーム選択
  const handlePlatformSelect = (platform: 'web' | 'ios' | 'android') => {
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
  const handleNext = async () => {
    if (selectedTechnologies.size === 0 || !selectedPlatform) return;

    setProcessingNext(true);
    try {
      // 選択した技術スタックを保存
      await saveFrameworkSelection(
        projectId,
        selectedPlatform,
        Array.from(selectedTechnologies),
        `選択理由: ${selectedPlatform}プラットフォームで${Array.from(selectedTechnologies).join(", ")}を使用`
      );

      setTimeout(() => {
        router.push(`/hackSetUp/${projectId}/setUpSummary`);
      }, 1000);
    } catch (error) {
      console.error("フレームワーク選択の保存に失敗:", error);
      // エラーでも次のページに進む
      setTimeout(() => {
        router.push(`/hackSetUp/${projectId}/setUpSummary`);
      }, 1000);
    }
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

          {/* AI推薦セクション */}
          <div className={`mb-8 rounded-xl border-2 overflow-hidden ${
            darkMode
              ? "bg-gray-800/50 border-cyan-500/30"
              : "bg-white/50 border-purple-500/30"
          } backdrop-blur-sm`}>
            <div className={`p-4 border-b ${
              darkMode ? "border-gray-700 bg-gray-800/80" : "border-gray-200 bg-gray-50/80"
            }`}>
              <h3 className={`text-lg font-bold flex items-center ${
                darkMode ? "text-cyan-300" : "text-purple-700"
              }`}>
                <Bot size={20} className="mr-2" />
                AI技術推薦
              </h3>
            </div>

            <div className="p-6">
              {!aiRecommendations ? (
                <div className="text-center">
                  <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {projectSpecification
                      ? "プロジェクト仕様に基づいて最適な技術スタックを推薦します"
                      : "一般的な開発パターンに基づいて技術スタックを推薦します"
                    }
                  </p>
                  {!projectSpecification && (
                    <p className={`mb-4 text-sm ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      ※ プロジェクト仕様書が見つからないため、汎用的な推薦を行います
                    </p>
                  )}
                  <button
                    onClick={handleGetAIRecommendations}
                    disabled={isLoadingRecommendations}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${
                      darkMode
                        ? "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30"
                        : "bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300"
                    } disabled:opacity-50`}
                  >
                    {isLoadingRecommendations ? (
                      <div className="flex items-center">
                        <Loader2 className="animate-spin mr-2" size={18} />
                        推薦を生成中...
                      </div>
                    ) : (
                      "AI推薦を取得"
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${
                    darkMode ? "bg-gray-700/50" : "bg-gray-50"
                  }`}>
                    <h4 className={`font-semibold mb-4 ${
                      darkMode ? "text-cyan-300" : "text-purple-700"
                    }`}>
                      AI推薦技術
                    </h4>
                    <div className="space-y-3">
                      {aiRecommendations.recommended_technologies
                        .sort((a, b) => a.priority - b.priority)
                        .map((tech, index) => (
                        <div key={index} className={`p-3 rounded-lg border ${
                          darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-200"
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className={`font-semibold ${
                              darkMode ? "text-cyan-300" : "text-purple-700"
                            }`}>
                              {tech.name}
                            </h5>
                            <span className={`text-xs px-2 py-1 rounded font-medium ${
                              tech.priority <= 3
                                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                : tech.priority <= 6
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}>
                              優先度 {tech.priority}
                            </span>
                          </div>
                          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                            {tech.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg ${
                    darkMode ? "bg-blue-900/20 border-blue-500/30" : "bg-blue-50 border-blue-200"
                  } border`}>
                    <p className={`text-sm ${darkMode ? "text-blue-300" : "text-blue-700"}`}>
                      💡 推薦されていない技術も自由に選択できます。プロジェクトの要件に応じて組み合わせてください。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* プラットフォーム選択 */}
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
                  onClick={() => handlePlatformSelect(key as any)}
                  className={`p-6 rounded-xl border-2 transition-all hover:scale-105 ${
                    selectedPlatform === key
                      ? darkMode
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                        : "bg-purple-100 border-purple-500 text-purple-700"
                      : darkMode
                        ? "bg-gray-800/50 border-gray-600 text-gray-300 hover:border-cyan-500/50"
                        : "bg-white border-gray-300 text-gray-700 hover:border-purple-500/50"
                  }`}
                >
                  <Icon size={32} className="mx-auto mb-3" />
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm opacity-75">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 技術選択 */}
          {selectedPlatform && (
            <div className="mb-8">
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
                              {/* AI推薦バッジ */}
                              {isRecommended && (
                                <div className="absolute top-2 right-2">
                                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    darkMode ? "bg-green-500 text-white" : "bg-green-500 text-white"
                                  }`}>
                                    AI推薦
                                  </div>
                                </div>
                              )}

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
                // iOS/Android：通常表示
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TECHNOLOGY_OPTIONS[selectedPlatform].map((tech) => (
                  <div
                    key={tech.name}
                    onClick={() => handleTechnologyToggle(tech.name)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-102 ${
                      selectedTechnologies.has(tech.name)
                        ? darkMode
                          ? "bg-cyan-500/20 border-cyan-500"
                          : "bg-purple-100 border-purple-500"
                        : darkMode
                          ? "bg-gray-800/50 border-gray-600 hover:border-cyan-500/50"
                          : "bg-white border-gray-300 hover:border-purple-500/50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
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
          )}

          {/* 次へ進むボタン */}
          {selectedTechnologies.size > 0 && (
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
                  <p className={`mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    技術スタックの選択が完了したら、次のステップに進みましょう。
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
                        <span>セットアップ完了へ</span>
                        <ChevronRight size={18} className="ml-2" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <HackthonSupportAgent />
        </div>
      </main>
    </>
  );
}