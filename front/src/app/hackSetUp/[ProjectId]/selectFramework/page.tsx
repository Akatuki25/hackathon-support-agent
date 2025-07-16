"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import Header from "@/components/Session/Header";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";

type FrameworkProposal = {
  name: string;
  priority: number;
  reason: string;
};

type FrameworkResponse = {
  frontend: FrameworkProposal[];
  backend: FrameworkProposal[];
};

type NativeFramework = {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
};

export default function SelectFrameworkPage() {
  const router = useRouter();
  const { darkMode } = useDarkMode();
  const [platform, setPlatform] = useState<
    "Web" | "Android" | "iOS" | "MultiPlatform"
  >("Web");
  const [frameworkData, setFrameworkData] = useState<FrameworkResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [selectedFrontend, setSelectedFrontend] =
    useState<FrameworkProposal | null>(null);
  const [selectedBackend, setSelectedBackend] =
    useState<FrameworkProposal | null>(null);
  const [selectedNativeFramework, setSelectedNativeFramework] =
    useState<NativeFramework | null>(null);
  const [specification, setSpecification] = useState<string>("");
  const processingNext = false;

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

  // Webプラットフォーム選択時のAPI呼び出し
  useEffect(() => {
    if (specification && platform === "Web" && !frameworkData) {
      setLoading(true);
      fetch(process.env.NEXT_PUBLIC_API_URL + "/api/framework/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specification }),
      })
        .then((res) => res.json())
        .then((data: FrameworkResponse) => {
          data.frontend.sort((a, b) => a.priority - b.priority);
          data.backend.sort((a, b) => a.priority - b.priority);
          setFrameworkData(data);
        })
        .catch((err) => console.error("Framework API エラー:", err))
        .finally(() => setLoading(false));
    }
  }, [specification, platform, frameworkData]);

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
              フロントエンド: ${selectedFrontend.name}（優先順位: ${selectedFrontend.priority}、理由: ${selectedFrontend.reason}）
              バックエンド: ${selectedBackend.name}（優先順位: ${selectedBackend.priority}、理由: ${selectedBackend.reason}）
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

    sessionStorage.setItem("framework", frameworkInfo);
    
    
    router.push("/hackSetUp/taskDivision");
  };

  const currentNativeFrameworks =
    platform !== "Web"
      ? nativeFrameworks[platform as keyof typeof nativeFrameworks]
      : [];

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      {/* mainのカラーを透明にする */}
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
              プロジェクトに最適なフレームワークを選択してください。推奨順にリストアップされています。
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
              loading ? (
                <div className="flex flex-col justify-center items-center py-16">
                  <div
                    className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${
                      darkMode ? "border-cyan-500" : "border-purple-500"
                    }`}
                  ></div>
                  <p
                    className={`mt-4 ${darkMode ? "text-cyan-400" : "text-purple-600"}`}
                  >
                    フレームワーク情報を解析中...
                  </p>
                </div>
              ) : (
                frameworkData && (
                  <>
                    {/* Frontend */}
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
                        フロントエンド：
                      </h2>
                      <div className="space-y-4">
                        {frameworkData.frontend.map((fw, idx) => (
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
                            <div className="flex flex-wrap justify-between items-start gap-2">
                              <div
                                className={`font-bold text-lg ${darkMode ? "text-cyan-300" : "text-blue-700"}`}
                              >
                                {fw.name}
                              </div>
                              <div
                                className={`px-2 py-0.5 rounded text-sm ${
                                  darkMode
                                    ? "bg-pink-900 text-pink-300"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                優先度: {fw.priority}
                              </div>
                            </div>
                            <p
                              className={`mt-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                            >
                              {fw.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Backend */}
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
                        バックエンド：
                      </h2>
                      <div className="space-y-4">
                        {frameworkData.backend.map((fw, idx) => (
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
                            <div className="flex flex-wrap justify-between items-start gap-2">
                              <div
                                className={`font-bold text-lg ${darkMode ? "text-pink-300" : "text-purple-700"}`}
                              >
                                {fw.name}
                              </div>
                              <div
                                className={`px-2 py-0.5 rounded text-sm ${
                                  darkMode
                                    ? "bg-cyan-900 text-cyan-300"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                優先度: {fw.priority}
                              </div>
                            </div>
                            <p
                              className={`mt-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                            >
                              {fw.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )
              )
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

            {/* Confirm Button */}
            <div className="flex justify-end">
              <button
                onClick={handleConfirm}
                className={`px-8 py-3 flex items-center rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                  darkMode
                    ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400"
                    : "bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400"
                }`}
                disabled={
                  platform === "Web"
                    ? !selectedFrontend || !selectedBackend
                    : !selectedNativeFramework || processingNext
                }
              >
                {processingNext ? (
                  <div className="flex items-center">
                    <div
                      className={`animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 ${
                        darkMode ? "border-gray-900" : "border-white"
                      } mr-2`}
                    ></div>
                    処理中...
                  </div>
                ) : (
                  <>
                    <span>決定</span>
                    <ChevronRight size={18} className="ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>

          <HackthonSupportAgent />
        </div>
      </main>
    </>
  );
}
