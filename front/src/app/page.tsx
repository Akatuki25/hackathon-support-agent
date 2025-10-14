"use client";

import React from "react";
import {
  MessageCircle,
  Code,
  Wrench,
  Workflow,
  Cpu,
  Brain,
  Users,
} from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import CyberHeader from "@/components/Session/Header";
import { signIn } from "next-auth/react";

export default function HackathonSupportAgentLandingPage() {
  const { darkMode } = useDarkMode();

  const features = [
    {
      icon: <Workflow className="w-8 h-8" />,
      title: "タスク分割支援",
      description:
        "エージェントが仕様の具体化と優先順位付けを自動提案。やるべきことを明確化し、時間を無駄にしない開発へ。",
      code: "// TASK_PLANNING_ASSIST",
    },
    {
      icon: <Wrench className="w-8 h-8" />,
      title: "環境構築補助",
      description:
        "devcontainerを自動生成し、コンテナ起動だけで開発環境が整う。煩雑なセットアップは不要。",
      code: "// ENVIRONMENT_SETUP",
    },
    {
      icon: <Code className="w-8 h-8" />,
      title: "コーディング補助",
      description:
        "ディレクトリ構成やサンプルコードをAIが生成。プロジェクト全体像を視覚的に理解しながら開発を進行。",
      code: "// CODING_ASSIST",
    },
    {
      icon: <MessageCircle className="w-8 h-8" />,
      title: "AI質問・アドバイス機能",
      description:
        "要件定義や実装時にAIへ自由に質問。補足説明や設計アドバイスを即座に受け取れるサポートチャットを常駐。",
      code: "// AI_QUESTION_ADVICE",
    },
    {
      icon: <Cpu className="w-8 h-8" />,
      title: "AIによる技術推薦",
      description:
        "要件やタスク内容から最適な技術スタックを自動提案。Web/モバイル/ビジネス用途に柔軟対応。",
      code: "// TECH_RECOMMENDATION",
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "プロジェクト管理・可視化",
      description:
        "タスク依存関係を検出し、フロー図・ガントチャートを生成。チーム全体で進捗を直感的に把握。",
      code: "// PROJECT_MANAGEMENT",
    },
  ];

  const executionSteps = [
    {
      step: "01",
      title: "INIT_PROJECT",
      description: "テーマとチーム情報を登録し、支援エージェントを起動。",
      code: "initialize(project, team)",
    },
    {
      step: "02",
      title: "GENERATE_PLAN",
      description: "AIが仕様を分析し、タスク分割と環境構築を自動生成。",
      code: "agent.generate_tasks()",
    },
    {
      step: "03",
      title: "BUILD_AND_DEPLOY",
      description: "AIの支援で実装・デバッグ・デプロイまで一気通貫。",
      code: "agent.deploy_app()",
    },
  ];

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-gray-50 via-white to-gray-50"
      }`}
    >
      <div className="relative z-50">
        <CyberHeader />
      </div>

      <div className="relative z-10 container mx-auto px-6 pt-32 pb-12">
        {/* Hero */}
        <div className="text-center mb-20">
          <div
            className={`inline-block px-4 py-2 rounded-lg font-mono text-sm mb-6 ${
              darkMode
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "bg-purple-500/10 text-purple-600 border border-purple-300/30"
            }`}
          >
            {"// HACKATHON_SUPPORT_AI"}
          </div>

          <h1
            className={`text-4xl md:text-6xl font-bold mb-6 font-mono tracking-wider ${
              darkMode
                ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400"
                : "text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600"
            }`}
          >
            HACKATHON_SUPPORT_AGENT
          </h1>

          <p
            className={`text-lg md:text-xl mb-8 ${darkMode ? "text-gray-300" : "text-gray-600"} font-mono max-w-3xl mx-auto`}
          >
            {"// ハッカソンを成長する機会に！AIがあなたの開発を全方位からサポートします。"}
          </p>

          <button
            onClick={() => signIn("github", { callbackUrl: "/hackSetUp" })}
            className={`group relative px-8 py-4 rounded-lg font-mono font-bold text-lg tracking-wider transition-all duration-300 overflow-hidden ${
              darkMode
                ? "bg-gray-900/50 hover:bg-gray-800/70 text-cyan-400 border border-cyan-500/50 hover:border-cyan-400"
                : "bg-white/50 hover:bg-gray-50/70 text-purple-600 border border-purple-400/50 hover:border-purple-500"
            } backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:scale-105`}
          >
            <span className="relative">START_NOW</span>
          </button>
        </div>

        {/* Features */}
        <div className="mb-24">
          <h2
            className={`text-2xl md:text-3xl font-bold text-center mb-12 font-mono tracking-wider ${
              darkMode ? "text-cyan-400" : "text-purple-600"
            }`}
          >
            {"// WHAT_YOU_CAN_DO"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`relative p-6 rounded-lg backdrop-blur-sm border transition-all duration-300 hover:scale-105 group overflow-hidden ${
                  darkMode
                    ? "bg-gray-900/50 border-cyan-500/30 hover:border-cyan-400/50"
                    : "bg-white/50 border-purple-300/30 hover:border-purple-400/50"
                } shadow-lg hover:shadow-xl`}
              >
                <div
                  className={`${darkMode ? "text-cyan-400" : "text-purple-600"} mb-4`}
                >
                  {feature.icon}
                </div>
                <h3
                  className={`text-lg font-semibold mb-2 font-mono tracking-wider ${
                    darkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {feature.title}
                </h3>
                <p
                  className={`text-xs mb-3 font-mono ${darkMode ? "text-gray-400" : "text-gray-500"}`}
                >
                  {feature.code}
                </p>
                <p
                  className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm leading-relaxed`}
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Execution Flow */}
        <div className="mb-20">
          <h2
            className={`text-2xl md:text-3xl font-bold text-center mb-12 font-mono tracking-wider ${
              darkMode ? "text-cyan-400" : "text-purple-600"
            }`}
          >
            {"// HOW_IT_WORKS"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {executionSteps.map((item, index) => (
              <div
                key={index}
                className={`relative text-center p-6 rounded-lg backdrop-blur-sm border ${
                  darkMode
                    ? "bg-gray-900/30 border-cyan-500/20"
                    : "bg-white/30 border-purple-300/20"
                }`}
              >
                <div
                  className={`w-16 h-16 mx-auto mb-4 rounded border-2 flex items-center justify-center text-xl font-bold font-mono ${
                    darkMode
                      ? "border-cyan-500 text-cyan-400 bg-gray-900/50"
                      : "border-purple-500 text-purple-600 bg-white/50"
                  }`}
                >
                  {item.step}
                </div>
                <h3
                  className={`text-lg font-semibold mb-2 font-mono tracking-wider ${
                    darkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {item.title}
                </h3>
                <p
                  className={`text-xs mb-3 font-mono ${darkMode ? "text-gray-400" : "text-gray-500"}`}
                >
                  {`// ${item.code}`}
                </p>
                <p
                  className={`${darkMode ? "text-gray-300" : "text-gray-600"} text-sm`}
                >
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div
          className={`relative text-center p-12 rounded-lg backdrop-blur-sm border ${
            darkMode
              ? "bg-gray-900/50 border-cyan-500/30"
              : "bg-white/50 border-purple-300/30"
          } shadow-lg mb-20`}
        >
          <h2
            className={`text-2xl md:text-3xl font-bold mb-4 font-mono tracking-wider ${
              darkMode ? "text-white" : "text-gray-900"
            }`}
          >
            LET’S_CREATE_WITH_AI
          </h2>
          <p
            className={`text-lg mb-8 ${darkMode ? "text-gray-300" : "text-gray-600"} max-w-2xl mx-auto`}
          >
            {"// 初心者でもハッカソンを楽しめるように。AIがあなたの“作りたい”を形にします。"}
          </p>
          <button
            className={`group relative px-8 py-4 rounded-lg font-mono font-bold text-lg tracking-wider transition-all duration-300 overflow-hidden ${
              darkMode
                ? "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white"
                : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
            } shadow-lg hover:shadow-xl transform hover:scale-105`}
            onClick={() => signIn("github", { callbackUrl: "/hackSetUp" })}
          >
            <span className="relative">EXECUTE_COMMAND</span>
          </button>
        </div>
      </div>
    </div>
  );
}
