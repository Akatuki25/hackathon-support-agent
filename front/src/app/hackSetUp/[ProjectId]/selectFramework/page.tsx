"use client";

import React, { useEffect, useState } from "react";
import { useRouter,usePathname } from "next/navigation";
import {
  Code,
  Server,
  Monitor,
  ChevronRight,
  Smartphone,
  Globe,
  Terminal,
  Database,
  Cpu,
  Sparkles,
  Book,
} from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import Header from "@/components/Session/Header";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";
import { patchDocument } from "@/libs/modelAPI/document";

type Framework = {
  name: string;
  description: string;
  category: "frontend" | "backend";
};

type NativeFramework = {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
};

// Webフレームワークの定義（フロントエンド・バックエンド各20個）
const webFrameworks: Framework[] = [
  // フロントエンド
  { name: "React", description: "Facebookが開発したコンポーネントベースのUIライブラリ。仮想DOMによる高速レンダリング", category: "frontend" },
  { name: "Vue.js", description: "段階的に採用可能な進歩的なJavaScriptフレームワーク。学習曲線が緩やか", category: "frontend" },
  { name: "Angular", description: "Googleが開発したTypeScript製の本格的なフロントエンドフレームワーク", category: "frontend" },
  { name: "Next.js", description: "React用のフルスタックフレームワーク。SSR/SSG対応で高速", category: "frontend" },
  { name: "Nuxt.js", description: "Vue.js用のフルスタックフレームワーク。自動ルーティング機能付き", category: "frontend" },
  { name: "Svelte", description: "コンパイル時に最適化される革新的なフレームワーク。軽量で高速", category: "frontend" },
  { name: "SvelteKit", description: "Svelteのフルスタックフレームワーク。モダンなWeb開発に最適", category: "frontend" },
  { name: "Remix", description: "React用の新しいフルスタックフレームワーク。Web標準に準拠", category: "frontend" },
  { name: "Gatsby", description: "React製の静的サイトジェネレーター。高速なパフォーマンス", category: "frontend" },
  { name: "Astro", description: "マルチフレームワーク対応の静的サイトビルダー。アイランドアーキテクチャ採用", category: "frontend" },
  { name: "Solid.js", description: "リアクティブで高性能なUIライブラリ。仮想DOMを使わない", category: "frontend" },
  { name: "Alpine.js", description: "軽量なJavaScriptフレームワーク。HTMLに直接記述可能", category: "frontend" },
  { name: "Preact", description: "Reactの軽量版代替。3KBの超軽量サイズ", category: "frontend" },
  { name: "Ember.js", description: "規約重視の成熟したフレームワーク。大規模アプリに適合", category: "frontend" },
  { name: "Lit", description: "Web Componentsベースの軽量フレームワーク。標準準拠", category: "frontend" },
  { name: "Qwik", description: "レジューマビリティを実現する革新的フレームワーク", category: "frontend" },
  { name: "Vite", description: "高速な開発環境を提供するビルドツール。HMR対応", category: "frontend" },
  { name: "Webpack", description: "強力で柔軟なモジュールバンドラー。高度なカスタマイズ可能", category: "frontend" },
  { name: "Parcel", description: "設定不要のWebアプリケーションバンドラー", category: "frontend" },
  { name: "Turbopack", description: "Next.js用の高速バンドラー。Rustで実装", category: "frontend" },
  
  // バックエンド
  { name: "Node.js + Express", description: "JavaScriptでサーバーサイド開発。軽量で柔軟なWebフレームワーク", category: "backend" },
  { name: "Django", description: "Python製の高機能Webフレームワーク。管理画面付き", category: "backend" },
  { name: "Ruby on Rails", description: "Ruby製のフルスタックWebフレームワーク。規約重視で生産性が高い", category: "backend" },
  { name: "Spring Boot", description: "Java製のエンタープライズ向けフレームワーク。マイクロサービス対応", category: "backend" },
  { name: "FastAPI", description: "Python製の高速APIフレームワーク。自動ドキュメント生成", category: "backend" },
  { name: "NestJS", description: "TypeScript製のNode.jsフレームワーク。エンタープライズ対応", category: "backend" },
  { name: "Laravel", description: "PHP製の人気Webフレームワーク。エレガントな構文", category: "backend" },
  { name: "ASP.NET Core", description: "Microsoft製のクロスプラットフォームフレームワーク", category: "backend" },
  { name: "Flask", description: "Python製の軽量Webフレームワーク。シンプルで拡張性が高い", category: "backend" },
  { name: "Gin", description: "Go言語製の高速Webフレームワーク。マイクロサービス向け", category: "backend" },
  { name: "Fiber", description: "Go言語製のExpress風フレームワーク。超高速", category: "backend" },
  { name: "Phoenix", description: "Elixir製のリアルタイムWebフレームワーク。高い並行性", category: "backend" },
  { name: "Koa", description: "Express開発チームによる次世代Node.jsフレームワーク", category: "backend" },
  { name: "Fastify", description: "Node.js製の高速Webフレームワーク。プラグインアーキテクチャ", category: "backend" },
  { name: "Hono", description: "エッジ環境対応の超軽量Webフレームワーク", category: "backend" },
  { name: "Deno", description: "TypeScript/JavaScript用の安全なランタイム", category: "backend" },
  { name: "Bun", description: "JavaScript/TypeScript用の高速オールインワンツールキット", category: "backend" },
  { name: "Actix Web", description: "Rust製の高性能Webフレームワーク", category: "backend" },
  { name: "Rocket", description: "Rust製の使いやすいWebフレームワーク", category: "backend" },
  { name: "Echo", description: "Go言語製のミニマルで高性能なWebフレームワーク", category: "backend" },
];

export default function SelectFrameworkPage() {
  const router = useRouter();
  const { darkMode } = useDarkMode();
  const [platform, setPlatform] = useState<
    "Web" | "Android" | "iOS" | "MultiPlatform"
  >("Web");
  const [selectedFrontend, setSelectedFrontend] = useState<Framework | null>(null);
  const [selectedBackend, setSelectedBackend] = useState<Framework | null>(null);
  const [selectedNativeFramework, setSelectedNativeFramework] = useState<NativeFramework | null>(null);
  const [specification, setSpecification] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ai" | "manual">("ai");
  const [path, setPath] = usePathname();

  // AIのおすすめ（モック）
  const [aiRecommendations] = useState({
    frontend: ["Next.js", "React", "Vue.js"],
    backend: ["Node.js + Express", "FastAPI", "Django"]
  });

  // プラットフォーム別のフレームワーク定義
  const nativeFrameworks = {
    Android: [
      {
        name: "Kotlin Native",
        description:
          "Googleが推奨するAndroid開発の公式言語。Java との完全互換性があり、簡潔で安全なコード記述が可能。",
        pros: [
          "Googleの公式サポート",
          "Javaとの100%互換性",
          "Null安全性とラムダ式サポート",
          "Android Jetpack完全対応",
        ],
        cons: [
          "学習コストが若干高い",
          "コンパイル時間がJavaより長い場合がある",
        ],
      },
      {
        name: "Java",
        description:
          "従来からのAndroid開発言語。豊富な情報とライブラリが利用可能で、安定性に優れている。",
        pros: [
          "豊富な学習リソース",
          "大規模なコミュニティ",
          "安定した実行環境",
          "既存コードの再利用が容易",
        ],
        cons: [
          "冗長なコード記述",
          "Null安全性の欠如",
          "Kotlinと比較して現代的でない構文",
        ],
      },
    ],
    iOS: [
      {
        name: "Swift",
        description:
          "Apple開発の現代的な言語。高性能で安全性が高く、iOS/macOS開発に最適化されている。",
        pros: [
          "Appleの公式サポート",
          "高いパフォーマンス",
          "メモリ安全性",
          "SwiftUIによるモダンUI開発",
        ],
        cons: [
          "iOS/macOSエコシステムに限定",
          "頻繁な言語仕様変更",
          "学習コストが高い",
        ],
      },
      {
        name: "Objective-C",
        description:
          "従来からのiOS開発言語。レガシーコードとの互換性に優れ、C言語との親和性が高い。",
        pros: [
          "C言語ライブラリとの互換性",
          "既存プロジェクトとの互換性",
          "安定した実行環境",
          "豊富な既存リソース",
        ],
        cons: ["冗長な構文", "メモリ管理の複雑さ", "現代的でないコード記述"],
      },
    ],
    MultiPlatform: [
      {
        name: "Flutter",
        description:
          "Googleが開発したクロスプラットフォームフレームワーク。単一コードベースでiOS/Android両対応。",
        pros: [
          "単一コードベースで両OS対応",
          "高いパフォーマンス",
          "豊富なUIウィジェット",
          "ホットリロード機能",
        ],
        cons: [
          "アプリサイズが大きくなりがち",
          "ネイティブ機能へのアクセスに制約",
          "Dartの学習が必要",
        ],
      },
      {
        name: "Kotlin Multiplatform",
        description:
          "JetBrainsが開発したクロスプラットフォーム技術。ビジネスロジックを共有し、UIは各プラットフォーム専用。",
        pros: [
          "ビジネスロジックの共有",
          "各プラットフォームネイティブUI",
          "既存Kotlinコードの活用",
          "段階的導入が可能",
        ],
        cons: ["まだ比較的新しい技術", "設定の複雑さ", "学習リソースが限定的"],
      },
      {
        name: "React Native",
        description:
          "Facebookが開発したクロスプラットフォームフレームワーク。JavaScriptでネイティブアプリを開発。",
        pros: [
          "Web開発者にとって習得しやすい",
          "豊富なサードパーティライブラリ",
          "大企業での採用実績",
          "ホットリロード機能",
        ],
        cons: [
          "パフォーマンスの制約",
          "ネイティブコードが必要な場合がある",
          "デバッグの難しさ",
        ],
      },
    ],
  };

  // セッションストレージから仕様書を取得
  useEffect(() => {
    if (typeof window !== "undefined") {
      const spec = sessionStorage.getItem("specification");
      if (spec) {
        setSpecification(spec);
      } else {
        console.error("仕様書が見つかりません");
        router.push("/");
      }
    }
  }, [router]);

  // プラットフォーム変更時の状態リセット
  useEffect(() => {
    setSelectedFrontend(null);
    setSelectedBackend(null);
    setSelectedNativeFramework(null);
  }, [platform]);

  const handleConfirm = async () => {
    let frameworkInfo = "";

    if (platform === "Web") {
      if (!selectedFrontend || !selectedBackend) {
        alert("フロントエンドとバックエンドのフレームワークを選択してください");
        return;
      }
      frameworkInfo = `
      【フレームワーク選定】
      プラットフォーム: Web
      フロントエンド: ${selectedFrontend.name}
      説明: ${selectedFrontend.description}
      バックエンド: ${selectedBackend.name}
      説明: ${selectedBackend.description}
      `;
    } else {
      if (!selectedNativeFramework) {
        alert("フレームワークを選択してください");
        return;
      }
      frameworkInfo = `
      【フレームワーク選定】
      プラットフォーム: ${platform}
      選択フレームワーク: ${selectedNativeFramework.name}
      説明: ${selectedNativeFramework.description}
      メリット: ${selectedNativeFramework.pros.join(", ")}
      デメリット: ${selectedNativeFramework.cons.join(", ")}
      `;
    }
    const projectId = path.split("/")[2];
    patchDocument(projectId, {
      specification: frameworkInfo,
    });
    router.push(`/hackSetUp/${projectId}/frameWorkSummary`);
  };

  const currentNativeFrameworks =
    platform !== "Web"
      ? nativeFrameworks[platform as keyof typeof nativeFrameworks]
      : [];

  // フロントエンドとバックエンドのフレームワークを分離
  const frontendFrameworks = webFrameworks.filter(fw => fw.category === "frontend");
  const backendFrameworks = webFrameworks.filter(fw => fw.category === "backend");

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      <main className="relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4 mt-5">
              <Code
                className={`mr-2 ${darkMode ? "text-cyan-400" : "text-purple-600"}`}
              />
              <h1
                className={`text-3xl font-bold tracking-wider ${darkMode ? "text-cyan-400" : "text-purple-700"}`}
              >
                フレームワーク
                <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
                  _選定
                </span>
              </h1>
            </div>
            <p
              className={`text-lg ${darkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              プロジェクトに最適なフレームワークを選択してください
            </p>
          </div>

          <div
            className={`backdrop-blur-lg rounded-xl p-8 shadow-xl border transition-all ${
              darkMode
                ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
                : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
            }`}
          >
            {/* Platform Selection */}
            <div className="mb-8">
              <h2
                className={`text-xl font-medium mb-4 flex items-center ${
                  darkMode ? "text-cyan-400" : "text-purple-700"
                }`}
              >
                <Monitor
                  size={18}
                  className={`mr-2 ${
                    darkMode ? "text-pink-500" : "text-blue-600"
                  }`}
                />
                プラットフォーム選択：
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { key: "Web", icon: Monitor, label: "Web" },
                  { key: "Android", icon: Smartphone, label: "Android" },
                  { key: "iOS", icon: Smartphone, label: "iOS" },
                  {
                    key: "MultiPlatform",
                    icon: Globe,
                    label: "マルチプラットフォーム",
                  },
                ].map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setPlatform(key as any)}
                    className={`p-4 rounded-lg flex items-center transition-all ${
                      platform === key
                        ? darkMode
                          ? "bg-cyan-500 text-gray-900"
                          : "bg-blue-600 text-white"
                        : darkMode
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  >
                    <Icon size={16} className="mr-2" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Framework Selection */}
            {platform === "Web" ? (
              <>
                {/* Tab Selection */}
                <div className="mb-6">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab("ai")}
                      className={`px-6 py-3 rounded-lg flex items-center transition-all ${
                        activeTab === "ai"
                          ? darkMode
                            ? "bg-gradient-to-r from-cyan-500 to-pink-500 text-gray-900"
                            : "bg-gradient-to-r from-purple-500 to-blue-600 text-white"
                          : darkMode
                            ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            : "bg-gray-200 hover:bg-gray-300"
                      }`}
                    >
                      <Sparkles size={16} className="mr-2" />
                      AIおすすめ
                    </button>
                    <button
                      onClick={() => setActiveTab("manual")}
                      className={`px-6 py-3 rounded-lg flex items-center transition-all ${
                        activeTab === "manual"
                          ? darkMode
                            ? "bg-gradient-to-r from-cyan-500 to-pink-500 text-gray-900"
                            : "bg-gradient-to-r from-purple-500 to-blue-600 text-white"
                          : darkMode
                            ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            : "bg-gray-200 hover:bg-gray-300"
                      }`}
                    >
                      <Book size={16} className="mr-2" />
                      手動選択
                    </button>
                  </div>
                </div>

                {activeTab === "ai" ? (
                  // AI Recommendations Tab
                  <>
                    <div className="mb-8">
                      <h2
                        className={`text-xl font-medium mb-4 flex items-center ${
                          darkMode ? "text-cyan-400" : "text-purple-700"
                        }`}
                      >
                        <Code
                          size={18}
                          className={`mr-2 ${
                            darkMode ? "text-pink-500" : "text-blue-600"
                          }`}
                        />
                        AIおすすめフロントエンド：
                      </h2>
                      <div className="space-y-4">
                        {aiRecommendations.frontend.map((fwName, idx) => {
                          const fw = frontendFrameworks.find(f => f.name === fwName);
                          if (!fw) return null;
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedFrontend(fw)}
                              className={`p-4 rounded-lg transition-all cursor-pointer border-l-4 ${
                                selectedFrontend?.name === fw.name
                                  ? darkMode
                                    ? "bg-gray-700 border-cyan-500 shadow-lg shadow-cyan-500/10"
                                    : "bg-white border-blue-500 shadow-lg shadow-blue-500/10"
                                  : darkMode
                                    ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                                    : "bg-gray-50 border-gray-200 hover:bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div
                                    className={`font-bold text-lg ${darkMode ? "text-cyan-300" : "text-blue-700"}`}
                                  >
                                    {fw.name}
                                  </div>
                                  <p
                                    className={`mt-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                                  >
                                    {fw.description}
                                  </p>
                                </div>
                                <div
                                  className={`px-3 py-1 rounded-full text-sm ${
                                    darkMode
                                      ? "bg-pink-900 text-pink-300"
                                      : "bg-purple-100 text-purple-800"
                                  }`}
                                >
                                  推奨 #{idx + 1}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mb-8">
                      <h2
                        className={`text-xl font-medium mb-4 flex items-center ${
                          darkMode ? "text-cyan-400" : "text-purple-700"
                        }`}
                      >
                        <Server
                          size={18}
                          className={`mr-2 ${
                            darkMode ? "text-pink-500" : "text-blue-600"
                          }`}
                        />
                        AIおすすめバックエンド：
                      </h2>
                      <div className="space-y-4">
                        {aiRecommendations.backend.map((fwName, idx) => {
                          const fw = backendFrameworks.find(f => f.name === fwName);
                          if (!fw) return null;
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedBackend(fw)}
                              className={`p-4 rounded-lg transition-all cursor-pointer border-l-4 ${
                                selectedBackend?.name === fw.name
                                  ? darkMode
                                    ? "bg-gray-700 border-pink-500 shadow-lg shadow-pink-500/10"
                                    : "bg-white border-purple-500 shadow-lg shadow-purple-500/10"
                                  : darkMode
                                    ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                                    : "bg-gray-50 border-gray-200 hover:bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div
                                    className={`font-bold text-lg ${darkMode ? "text-pink-300" : "text-purple-700"}`}
                                  >
                                    {fw.name}
                                  </div>
                                  <p
                                    className={`mt-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                                  >
                                    {fw.description}
                                  </p>
                                </div>
                                <div
                                  className={`px-3 py-1 rounded-full text-sm ${
                                    darkMode
                                      ? "bg-cyan-900 text-cyan-300"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  推奨 #{idx + 1}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  // Manual Selection Tab
                  <>
                    <div className="mb-8">
                      <h2
                        className={`text-xl font-medium mb-4 flex items-center ${
                          darkMode ? "text-cyan-400" : "text-purple-700"
                        }`}
                      >
                        <Code
                          size={18}
                          className={`mr-2 ${
                            darkMode ? "text-pink-500" : "text-blue-600"
                          }`}
                        />
                        フロントエンドフレームワーク：
                      </h2>
                      <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
                        {frontendFrameworks.map((fw, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedFrontend(fw)}
                            className={`p-4 rounded-lg transition-all cursor-pointer border-l-4 ${
                              selectedFrontend?.name === fw.name
                                ? darkMode
                                  ? "bg-gray-700 border-cyan-500 shadow-lg shadow-cyan-500/10"
                                  : "bg-white border-blue-500 shadow-lg shadow-blue-500/10"
                                : darkMode
                                  ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                                  : "bg-gray-50 border-gray-200 hover:bg-white"
                            }`}
                          >
                            <div
                              className={`font-bold text-lg ${darkMode ? "text-cyan-300" : "text-blue-700"}`}
                            >
                              {fw.name}
                            </div>
                            <p
                              className={`mt-2 text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                            >
                              {fw.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-8">
                      <h2
                        className={`text-xl font-medium mb-4 flex items-center ${
                          darkMode ? "text-cyan-400" : "text-purple-700"
                        }`}
                      >
                        <Server
                          size={18}
                          className={`mr-2 ${
                            darkMode ? "text-pink-500" : "text-blue-600"
                          }`}
                        />
                        バックエンドフレームワーク：
                      </h2>
                      <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
                        {backendFrameworks.map((fw, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedBackend(fw)}
                            className={`p-4 rounded-lg transition-all cursor-pointer border-l-4 ${
                              selectedBackend?.name === fw.name
                                ? darkMode
                                  ? "bg-gray-700 border-pink-500 shadow-lg shadow-pink-500/10"
                                  : "bg-white border-purple-500 shadow-lg shadow-purple-500/10"
                                : darkMode
                                  ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                                  : "bg-gray-50 border-gray-200 hover:bg-white"
                            }`}
                          >
                            <div
                              className={`font-bold text-lg ${darkMode ? "text-pink-300" : "text-purple-700"}`}
                            >
                              {fw.name}
                            </div>
                            <p
                              className={`mt-2 text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                            >
                              {fw.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="mb-8">
                <h2
                  className={`text-xl font-medium mb-4 flex items-center ${
                    darkMode ? "text-cyan-400" : "text-purple-700"
                  }`}
                >
                  <Database
                    size={18}
                    className={`mr-2 ${
                      darkMode ? "text-pink-500" : "text-blue-600"
                    }`}
                  />
                  {platform}開発フレームワーク：
                </h2>
                <div className="space-y-6">
                  {currentNativeFrameworks.map((fw, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedNativeFramework(fw)}
                      className={`p-6 rounded-lg cursor-pointer transition-all border-l-4 ${
                        selectedNativeFramework?.name === fw.name
                          ? darkMode
                            ? "bg-gray-700 border-cyan-500 shadow-lg shadow-cyan-500/10"
                            : "bg-white border-purple-500 shadow-lg shadow-purple-500/10"
                          : darkMode
                            ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                            : "bg-gray-50 border-gray-200 hover:bg-white"
                      }`}
                    >
                      <h3
                        className={`font-bold text-xl mb-4 ${
                          darkMode ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {fw.name}
                      </h3>
                      <p
                        className={`text-sm mb-6 leading-relaxed ${
                          darkMode ? "text-gray-300" : "text-gray-600"
                        }`}
                      >
                        {fw.description}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4
                            className={`text-sm font-bold mb-3 ${
                              darkMode ? "text-green-400" : "text-green-600"
                            }`}
                          >
                            メリット：
                          </h4>
                          <ul className="space-y-2">
                            {fw.pros.map((pro, proIdx) => (
                              <li
                                key={proIdx}
                                className={`text-sm flex items-start ${
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                }`}
                              >
                                <span
                                  className={`mr-2 ${darkMode ? "text-green-400" : "text-green-600"}`}
                                >
                                  ✓
                                </span>
                                {pro}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4
                            className={`text-sm font-bold mb-3 ${
                              darkMode ? "text-yellow-400" : "text-yellow-600"
                            }`}
                          >
                            注意点：
                          </h4>
                          <ul className="space-y-2">
                            {fw.cons.map((con, conIdx) => (
                              <li
                                key={conIdx}
                                className={`text-sm flex items-start ${
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                }`}
                              >
                                <span
                                  className={`mr-2 ${darkMode ? "text-yellow-400" : "text-yellow-600"}`}
                                >
                                  ⚠
                                </span>
                                {con}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Frameworks Display */}
            {platform === "Web" && (selectedFrontend || selectedBackend) && (
              <div className={`mt-6 p-4 rounded-lg ${
                darkMode 
                  ? "bg-gray-900 bg-opacity-50 border border-cyan-500/20"
                  : "bg-gray-100 bg-opacity-50 border border-purple-500/20"
              }`}>
                <h3 className={`text-sm font-bold mb-2 ${
                  darkMode ? "text-cyan-400" : "text-purple-700"
                }`}>
                  現在の選択:
                </h3>
                <div className="flex flex-col gap-2">
                  {selectedFrontend && (
                    <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      <span className={`font-medium ${darkMode ? "text-pink-400" : "text-blue-600"}`}>
                        フロントエンド: 
                      </span> {selectedFrontend.name}
                    </div>
                  )}
                  {selectedBackend && (
                    <div className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      <span className={`font-medium ${darkMode ? "text-cyan-400" : "text-purple-600"}`}>
                        バックエンド: 
                      </span> {selectedBackend.name}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Confirm Button */}
            <div className="flex justify-end mt-8">
              <button
                onClick={handleConfirm}
                className={`px-8 py-3 flex items-center rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                  darkMode
                    ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400"
                    : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
                } ${
                  (platform === "Web" && (!selectedFrontend || !selectedBackend)) ||
                  (platform !== "Web" && !selectedNativeFramework)
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                disabled={
                  platform === "Web"
                    ? !selectedFrontend || !selectedBackend
                    : !selectedNativeFramework
                }
              >
                <span>決定</span>
                <ChevronRight size={18} className="ml-2" />
              </button>
            </div>
          </div>

          <HackthonSupportAgent />
        </div>
      </main>
    </>
  );
}