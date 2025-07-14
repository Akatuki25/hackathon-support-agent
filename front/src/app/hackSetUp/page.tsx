"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Clock, Users, ChevronRight } from "lucide-react";
import { useSession } from 'next-auth/react';

import { useDarkMode } from "@/hooks/useDarkMode";
import { postQuestion } from "@/libs/fetchAPI";
import Header from "@/components/Session/Header";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";

export default function Home() {
  const { darkMode } = useDarkMode();
  const { data: session } = useSession();
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [duration, setDuration] = useState("");
  const [numPeople, setNumPeople] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    sessionStorage.setItem("duration", duration);
    sessionStorage.setItem("numPeople", numPeople);
    
    try {
      // APIを呼び出す
      const formattedData = await postQuestion(idea, duration, numPeople);

      // sessionStorage にアイデアと質問データを保存
      sessionStorage.setItem("idea", idea);
      sessionStorage.setItem("questionData", JSON.stringify(formattedData));
      
      // 質問＆回答入力ページへ遷移
      router.push("/hackSetUp/hackQA");
    } catch (error) {
      console.error("API呼び出しエラー:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Fixed at top, full width */}
      <div className="w-full fixed top-0 left-0 right-0 z-40">
        <Header />
      </div>

      {/* Main Content - Adjusted for fixed header */}
      <div className="flex-1 flex items-center justify-center px-6 pt-24">
        <div className="w-full max-w-2xl">

          {/* Project Form */}
          <div
            className={`relative backdrop-blur-md rounded-xl shadow-xl p-8 w-full border transition-all ${
              darkMode 
                ? 'bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20' 
                : 'bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20'
            }`}
          >
            <div className="flex items-center justify-center mb-6 mt-5 w-xl">
              <Zap className={`mr-2 ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`} />
              <h1 className={`text-2xl font-bold tracking-wider ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
                プロジェクト<span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>_コード</span>
              </h1>
            </div>
            
            {/* User info in form header */}
            {session && (
              <div className={`mb-6 p-4 rounded-lg border ${
                darkMode 
                  ? 'bg-gray-700/30 border-cyan-500/20 text-cyan-300' 
                  : 'bg-purple-50/50 border-purple-300/20 text-purple-700'
              }`}>
                <p className="text-sm">
                  <span className="font-medium">プロジェクト作成者:</span> {session.user?.name}
                </p>
              </div>
            )}
            
            {/* input space  */}
            <div className="mb-5">
              <label className={`flex items-center ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                <Zap size={16} className={`mr-2 ${darkMode ? 'text-pink-500' : 'text-blue-600'}`} />
                <span>アイデア</span>
              </label>
              <textarea
                value={idea}
                onChange={(e) => {
                  // これ入れないとサイズが変わったあとに内容を削除したときなど動きがおかしい
                  e.target.style.height = 'auto';
                  // 改行に合わせて高さを変える
                  e.target.style.height = e.target.scrollHeight + 'px';
                  setIdea(e.target.value);
                }}
                placeholder="例: AIを活用したプロジェクト"
                required
                className={`w-full p-3 rounded border-l-4 focus:outline-none transition-all ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-100 border-pink-500 focus:ring-1 focus:ring-cyan-400' 
                    : 'bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400'
                }`}
              />
            </div>
            
            <div className="mb-5">
              <label className={`flex items-center ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                <Clock size={16} className={`mr-2 ${darkMode ? 'text-pink-500' : 'text-blue-600'}`} />
                <span>期間</span>
              </label>

              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="例: 2週間"
                required
                className={`w-full p-3 rounded border-l-4 focus:outline-none transition-all ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-100 border-pink-500 focus:ring-1 focus:ring-cyan-400' 
                    : 'bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400'
                }`}
              />
            </div>
            
            <div className="mb-6">
              <label className={`flex items-center ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                <Users size={16} className={`mr-2 ${darkMode ? 'text-pink-500' : 'text-blue-600'}`} />
                <span>人数</span>
              </label>
              <input
                type="number"
                min={1}
                value={numPeople}
                onChange={(e) => setNumPeople(e.target.value)}
                placeholder="例: 3"
                required
                className={`w-full p-3 rounded border-l-4 focus:outline-none transition-all ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-100 border-pink-500 focus:ring-1 focus:ring-cyan-400' 
                    : 'bg-white text-gray-800 border-blue-500 focus:ring-1 focus:ring-purple-400'
                }`}
              />
            </div>
            
            <form onSubmit={handleSubmit}>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center font-bold py-3 px-6 rounded transition-all ${
                  darkMode 
                    ? 'bg-cyan-500 hover:bg-cyan-600 text-gray-900 disabled:bg-gray-600 disabled:text-gray-400' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-400 disabled:text-gray-600'
                }`}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                    <span>処理中...</span>
                  </div>
                ) : (
                  <>
                    <span>質問に答える</span>
                    <ChevronRight size={18} className="ml-2" />
                  </>
                )}
              </button>
            </form>
            
            <HackthonSupportAgent />
          </div>
        </div>
      </div>
    </div>
  );
}