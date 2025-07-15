"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Code, Server, Monitor, ChevronRight, Smartphone, Sun, Moon } from "lucide-react";

type FrameworkProposal = {
  name: string;
  priority: number;
  reason: string;
};

type FrameworkResponse = {
  frontend: FrameworkProposal[];
  backend: FrameworkProposal[];
};

export default function SelectFrameworkPage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<"Web" | "Android" | "iOS">("Web");
  const [frameworkData, setFrameworkData] = useState<FrameworkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFrontend, setSelectedFrontend] = useState<FrameworkProposal | null>(null);
  const [selectedBackend, setSelectedBackend] = useState<FrameworkProposal | null>(null);
  const [specification, setSpecification] = useState<string>("");
  const [darkMode, setDarkMode] = useState(true);
  const [isSelected, setIsSelected] = useState(false);
  
  const handleClick = () => {
    setIsSelected(!isSelected);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // セッションストレージから仕様書を1度だけ取得
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

  // specification が取得できたら、API 呼び出しは一度だけ実施（frameworkData が未取得の場合）
  useEffect(() => {
    if (specification && !frameworkData) {
      // ここでプラットフォームに関わらず、仕様書に基づくAPI呼び出しを実施
      setLoading(true);
      fetch(process.env.NEXT_PUBLIC_API_URL + "/api/framework/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specification }),
      })
        .then((res) => res.json())
        .then((data: FrameworkResponse) => {
          // 優先順位（priority：小さいほど高い）順に並べ替え
          data.frontend.sort((a, b) => a.priority - b.priority);
          data.backend.sort((a, b) => a.priority - b.priority);
          setFrameworkData(data);
        })
        .catch((err) => console.error("Framework API エラー:", err))
        .finally(() => setLoading(false));
    }
  }, [specification, frameworkData]);

  const handleConfirm = () => {
    if (platform === "Web") {
      if (!selectedFrontend || !selectedBackend) {
        alert("フロントエンドとバックエンドのフレームワークを選択してください");
        return;
      }
      // 仕様書にフレームワーク情報を追記
      const frameworkInfo = `
                            【フレームワーク選定】
                            フロントエンド: ${selectedFrontend.name}（優先順位: ${selectedFrontend.priority}、理由: ${selectedFrontend.reason}）
                            バックエンド: ${selectedBackend.name}（優先順位: ${selectedBackend.priority}、理由: ${selectedBackend.reason}）
                            `;
      sessionStorage.setItem("framework",frameworkInfo);
    }else if( platform === "Android") {
      const frameworkInfo = `
      【フレームワーク選定】
          フロントエンド: IOS ネイティブ開発
  
      Kotlinは主にAndroidアプリ開発の公式言語として使用され、Javaとの互換性を持ちつつ簡潔で安全なコードを書けます。また、サーバーサイド開発やウェブフロントエンド開発にも対応していますが、iOS開発には直接使用できません。`

      sessionStorage.setItem("framework", frameworkInfo);

    }else if( platform === "iOS") {
    const frameworkInfo = `
          【フレームワーク選定】
          フロントエンド: IOS ネイティブ開発

          Swiftはアップル社が開発した、使いやすく安全なプログラミング言語で、iOSやmacOSなどのアプリケーション開発に広く使用されています。直感的な文法と高いパフォーマンスを兼ね備え、初心者から上級開発者まで幅広く支持されています。オープンソースとして提供され、継続的に進化しています。
          `;
      sessionStorage.setItem("framework", frameworkInfo);
    }

    router.push("/hackSetUp/taskDivision");
  };

  return (
    <div className={`min-h-screen font-mono transition-all duration-500 ${
      darkMode ? 'bg-gray-900' : 'bg-gray-100'
    } relative overflow-hidden p-4 md:p-8`}>
      {/* Animated background grid */}
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${darkMode ? 'opacity-20' : 'opacity-10'}`}>
        <div className="absolute inset-0" style={{ 
          backgroundImage: `linear-gradient(${darkMode ? '#00ffe1' : '#8a2be2'} 1px, transparent 1px), 
                            linear-gradient(90deg, ${darkMode ? '#00ffe1' : '#8a2be2'} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          backgroundPosition: '-1px -1px'
        }}></div>
      </div>
      
      {/* Theme toggle button */}
      <button 
        onClick={toggleDarkMode} 
        className={`absolute top-6 right-6 p-3 rounded-full transition-all z-30 ${
          darkMode 
            ? 'bg-gray-800 hover:bg-gray-700 text-yellow-300' 
            : 'bg-gray-200 hover:bg-gray-300 text-indigo-600'
        }`}
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      
      {/* Glowing edges */}
      <div className="fixed bottom-0 left-0 right-0 h-1 z-20">
        <div className={`h-full ${darkMode ? 'bg-cyan-500' : 'bg-purple-500'} animate-pulse`}></div>
      </div>
      <div className="fixed top-0 bottom-0 right-0 w-1 z-20">
        <div className={`w-full ${darkMode ? 'bg-pink-500' : 'bg-blue-500'} animate-pulse`}></div>
      </div>
      
      <div className="max-w-5xl mx-auto relative z-10">
        <div className={`backdrop-blur-lg rounded-xl p-6 md:p-8 shadow-xl border transition-all ${
          darkMode 
            ? 'bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20' 
            : 'bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20'
        }`}>
          <div className="flex items-center mb-6">
            <Code className={`mr-3 ${darkMode ? 'text-pink-500' : 'text-blue-600'}`} size={28} />
            <h1 className={`text-2xl font-bold tracking-wider ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
              フレームワーク<span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>_選定</span>
            </h1>
          </div>
          
          <div className={`mb-6 p-4 rounded-lg border-l-4 ${
            darkMode 
              ? 'bg-gray-700 bg-opacity-50 border-pink-500 text-gray-300' 
              : 'bg-purple-50 border-blue-500 text-gray-700'
          }`}>
            <p>プロジェクトに最適なフレームワークを選択してください。推奨順にリストアップされています。</p>
          </div>
          
          <div className="mb-6">
            <label className={`flex items-center mb-3 ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
              <Monitor size={18} className={`mr-2 ${darkMode ? 'text-pink-500' : 'text-blue-600'}`} />
              <span className="font-medium">プラットフォーム選択:</span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setPlatform("Web")}
                className={`px-4 py-2 rounded-md flex items-center transition-all ${
                  platform === "Web"
                    ? darkMode 
                      ? 'bg-cyan-500 text-gray-900' 
                      : 'bg-blue-600 text-white'
                    : darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                <Monitor size={16} className="mr-2" />
                Web
              </button>
              <button
                onClick={() => setPlatform("Android")}
                className={`px-4 py-2 rounded-md flex items-center transition-all ${
                  platform === "Android"
                    ? darkMode 
                      ? 'bg-cyan-500 text-gray-900' 
                      : 'bg-blue-600 text-white'
                    : darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                <Smartphone size={16} className="mr-2" />
                Android
              </button>
              <button
                onClick={() => setPlatform("iOS")}
                className={`px-4 py-2 rounded-md flex items-center transition-all ${
                  platform === "iOS"
                    ? darkMode 
                      ? 'bg-cyan-500 text-gray-900' 
                      : 'bg-blue-600 text-white'
                    : darkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                <Smartphone size={16} className="mr-2" />
                iOS
              </button>
            </div>
          </div>
          
          {platform === "Web" ? (
            loading ? (
              <div className="flex flex-col justify-center items-center py-16">
                {/* サイバーパンク風ローディングアニメーション */}
                <div className="relative w-24 h-24">
                  {/* 回転する外側リング */}
                  <div className={`absolute inset-0 border-4 border-transparent ${
                    darkMode 
                      ? 'border-t-cyan-500 border-r-pink-400' 
                      : 'border-t-purple-600 border-r-blue-500'
                  } rounded-full animate-spin`}></div>
                  
                  {/* パルスする内側サークル */}
                  <div className={`absolute inset-3 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} rounded-full flex items-center justify-center`}>
                    <div className={`w-10 h-10 ${
                      darkMode ? 'bg-cyan-500/20' : 'bg-purple-500/20'
                    } rounded-full animate-ping`}></div>
                  </div>
                  
                  {/* 文字 */}
                  <div className={`absolute inset-0 flex items-center justify-center text-xs ${
                    darkMode ? 'text-cyan-400' : 'text-purple-700'
                  } font-bold`}>
                    LOADING
                  </div>
                </div>
                
                {/* ローディングテキスト */}
                <div className={`mt-6 ${
                  darkMode ? 'text-cyan-400' : 'text-purple-700'
                } font-bold tracking-wider flex flex-col items-center`}>
                  <p className="text-sm mb-2">フレームワーク情報を解析中...</p>
                  <div className="flex space-x-1">
                    <span className={`inline-block w-2 h-2 ${
                      darkMode ? 'bg-pink-500' : 'bg-blue-500'
                    } rounded-full animate-pulse`}></span>
                    <span className={`inline-block w-2 h-2 ${
                      darkMode ? 'bg-pink-500' : 'bg-blue-500'
                    } rounded-full animate-pulse`} style={{animationDelay: '0.2s'}}></span>
                    <span className={`inline-block w-2 h-2 ${
                      darkMode ? 'bg-pink-500' : 'bg-blue-500'
                    } rounded-full animate-pulse`} style={{animationDelay: '0.4s'}}></span>
                  </div>
                </div>
              </div>
            ) : (
              frameworkData && (
                <>
                  <div className="mb-8">
                    <h2 className={`flex items-center text-xl font-semibold mt-4 mb-4 ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
                      <Code size={20} className={`mr-2 ${darkMode ? 'text-pink-500' : 'text-blue-600'}`} />
                      フロントエンド
                    </h2>
                    <div className="space-y-4">
                      {frameworkData.frontend.map((fw, idx) => (
                        <div 
                          key={idx}
                          onClick={() => setSelectedFrontend(fw)}
                          className={`p-4 rounded-lg transition-all cursor-pointer border-l-4 ${
                            selectedFrontend?.name === fw.name
                              ? darkMode
                                ? 'bg-gray-700 border-cyan-500 shadow-lg shadow-cyan-500/10'
                                : 'bg-white border-blue-500 shadow-lg shadow-blue-500/10'
                              : darkMode
                                ? 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                                : 'bg-gray-50 border-gray-200 hover:bg-white'
                          }`}
                        >
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div className={`font-bold text-lg ${darkMode ? 'text-cyan-300' : 'text-blue-700'}`}>
                              {fw.name}
                            </div>
                            <div className={`px-2 py-0.5 rounded text-sm ${
                              darkMode 
                                ? 'bg-pink-900 text-pink-300' 
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              優先度: {fw.priority}
                            </div>
                          </div>
                          <p className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {fw.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mb-8">
                    <h2 className={`flex items-center text-xl font-semibold mt-4 mb-4 ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
                      <Server size={20} className={`mr-2 ${darkMode ? 'text-pink-500' : 'text-blue-600'}`} />
                      バックエンド
                    </h2>
                    <div className="space-y-4">
                      {frameworkData.backend.map((fw, idx) => (
                        <div 
                          key={idx}
                          onClick={() => setSelectedBackend(fw)}
                          className={`p-4 rounded-lg transition-all cursor-pointer border-l-4 ${
                            selectedBackend?.name === fw.name
                              ? darkMode
                                ? 'bg-gray-700 border-pink-500 shadow-lg shadow-pink-500/10'
                                : 'bg-white border-purple-500 shadow-lg shadow-purple-500/10'
                              : darkMode
                                ? 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                                : 'bg-gray-50 border-gray-200 hover:bg-white'
                          }`}
                        >
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div className={`font-bold text-lg ${darkMode ? 'text-pink-300' : 'text-purple-700'}`}>
                              {fw.name}
                            </div>
                            <div className={`px-2 py-0.5 rounded text-sm ${
                              darkMode 
                                ? 'bg-cyan-900 text-cyan-300' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              優先度: {fw.priority}
                            </div>
                          </div>
                          <p className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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
            <div 
            className={`mt-6 p-5 rounded-lg border border-l-4 ${
              darkMode 
                ? `bg-gray-700 bg-opacity-50 border-l-${isSelected ? 'green' : 'gray'}-500 border-gray-600` 
                : `bg-${platform === "Android" ? 'green' : 'blue'}-50 border-l-${isSelected ? 'green' : 'gray'}-500 border-${platform === "Android" ? 'green' : 'blue'}-100`
            }`}
            onClick={handleClick}
          >
            <div className={`flex items-center mb-3 ${
              platform === "Android"
                ? darkMode ? 'text-green-400' : 'text-green-600'
                : darkMode ? 'text-blue-400' : 'text-blue-600'
            }`}>
              <Smartphone size={20} className="mr-2" />
              <h3 className="font-bold">
                {platform === "Android" ? "Android ネイティブ開発" : "iOS ネイティブ開発"}
              </h3>
            </div>
            <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
              {platform === "Android"
                ? "Android 向けの開発では、Kotlin/Java を使用したネイティブアプリ開発が推奨されます。クロスプラットフォーム開発として Flutter や React Native も検討できますが、パフォーマンスとネイティブ機能へのアクセスを考慮するとネイティブ開発が最適です。"
                : "IOS開発, Swiftはアップル社が開発した、使いやすく安全なプログラミング言語で、iOSやmacOSなどのアプリケーション開発に広く使用されています。直感的な文法と高いパフォーマンスを兼ね備え、初心者から上級開発者まで幅広く支持されています。オープンソースとして提供され、継続的に進化しています。"}
            </p>
          </div>
          )}
          
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleConfirm}
              className={`px-8 py-3 flex items-center justify-center rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                darkMode 
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400' 
                  : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400'
              }`}
            >
              決定
              <ChevronRight size={20} className="ml-2" />
            </button>
          </div>
        </div>
        
        <div className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
          <span className={darkMode ? 'text-cyan-400' : 'text-purple-600'}>CYBER</span>
          <span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>DREAM</span> v2.4.7
        </div>
      </div>
    </div>
  );
}