"use client";

import React from "react";
import Image from "next/image";
import {
  Github,
  Linkedin,
  Twitter,
  Mail,
  Code,
  Users,
  Trophy,
  Clock,
  MessageCircle,
  Lightbulb,
} from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import CyberHeader from "@/components/Session/Header";

export default function HackathonSupportAgentLandingPage() {
  const { darkMode } = useDarkMode();

  const members = [
    {
      name: "Alex Chen",
      role: "AI Engineer",
      description:
        "機械学習とNLP分野で8年の経験。インテリジェントなアシスタントシステムの構築が専門。",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      social: {
        github: "#",
        linkedin: "#",
        twitter: "#",
      },
    },
    {
      name: "Sarah Kim",
      role: "Product Designer",
      description:
        "ユーザー体験設計とデザインシステムのエキスパート。ハッカソン向けツールのUI/UX設計が得意。",
      avatar:
        "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
      social: {
        github: "#",
        linkedin: "#",
        mail: "#",
      },
    },
    {
      name: "Marcus Johnson",
      role: "Backend Developer",
      description:
        "リアルタイムシステムとAPIアーキテクチャのスペシャリスト。高可用性システムの構築経験豊富。",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      social: {
        github: "#",
        twitter: "#",
        mail: "#",
      },
    },
    {
      name: "Emily Zhang",
      role: "Hackathon Expert",
      description:
        "50以上のハッカソンに参加・運営経験。チーム戦略とプロジェクト管理のコンサルティングが専門。",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
      social: {
        github: "#",
        linkedin: "#",
        twitter: "#",
      },
    },
  ];

  const features = [
    {
      icon: <MessageCircle className="w-8 h-8" />,
      title: "リアルタイム支援",
      description: "24/7利用可能なAIアシスタントがハッカソン中にサポート",
      code: "// REAL_TIME_SUPPORT",
    },
    {
      icon: <Lightbulb className="w-8 h-8" />,
      title: "アイデア最適化",
      description: "プロジェクトアイデアの評価と改善提案を提供",
      code: "// IDEA_OPTIMIZATION",
    },
    {
      icon: <Code className="w-8 h-8" />,
      title: "技術支援",
      description: "コーディング、デバッグ、アーキテクチャ設計をサポート",
      code: "// TECH_ASSISTANCE",
    },
    {
      icon: <Trophy className="w-8 h-8" />,
      title: "勝利戦略",
      description: "審査員の評価基準に基づいた戦略的アドバイス",
      code: "// WIN_STRATEGY",
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "時間管理",
      description: "限られた時間内でのプロジェクト完成をサポート",
      code: "// TIME_MANAGEMENT",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "チーム連携",
      description: "効果的なチームワークと役割分担を促進",
      code: "// TEAM_COLLABORATION",
    },
  ];

  const stats = [
    {
      number: "500+",
      label: "サポートしたハッカソン",
      code: "HACKATHONS_SUPPORTED",
    },
    { number: "10,000+", label: "支援したチーム", code: "TEAMS_ASSISTED" },
    { number: "85%", label: "入賞率向上", code: "WIN_RATE_IMPROVEMENT" },
    { number: "24/7", label: "サポート体制", code: "SUPPORT_AVAILABILITY" },
  ];

  return (
    <div
      className={`min-h-screen transition-all duration-300 ${
        darkMode
          ? "bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900"
          : "bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50"
      }`}
    >
      {/* CyberHeader */}
      <CyberHeader />

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 pt-32 pb-12">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div
            className={`inline-block px-4 py-2 rounded-lg font-mono text-sm mb-6 ${
              darkMode
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "bg-purple-500/10 text-purple-600 border border-purple-300/30"
            }`}
          >
            {"// SYSTEM_INITIALIZED"}
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
            {"// AIの力でハッカソンを勝利に導く、あなたの最強パートナー"}
          </p>

          {/* Cyber divider */}
          <div className="flex items-center justify-center mb-8">
            <div
              className={`h-px w-12 ${darkMode ? "bg-cyan-500" : "bg-purple-500"}`}
            ></div>
            <div
              className={`mx-4 w-2 h-2 border ${darkMode ? "border-cyan-500" : "border-purple-500"} rotate-45`}
            ></div>
            <div
              className={`h-px w-12 ${darkMode ? "bg-pink-500" : "bg-blue-500"}`}
            ></div>
          </div>

          {/* CTA Button */}
          <button
            className={`group relative px-8 py-4 rounded-lg font-mono font-bold text-lg tracking-wider transition-all duration-300 overflow-hidden ${
              darkMode
                ? "bg-gray-900/50 hover:bg-gray-800/70 text-cyan-400 border border-cyan-500/50 hover:border-cyan-400"
                : "bg-white/50 hover:bg-gray-50/70 text-purple-600 border border-purple-400/50 hover:border-purple-500"
            } backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:scale-105`}
          >
            {/* Cyber scan line */}
            <div
              className={`absolute inset-0 ${
                darkMode
                  ? "bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent"
                  : "bg-gradient-to-r from-transparent via-purple-400/20 to-transparent"
              } translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700`}
            ></div>
            <span className="relative">INITIALIZE_SYSTEM</span>
            {/* Corner brackets */}
            <div
              className={`absolute top-1 left-1 w-2 h-2 border-l border-t ${
                darkMode ? "border-cyan-400/50" : "border-purple-400/50"
              } opacity-0 group-hover:opacity-100 transition-opacity`}
            ></div>
            <div
              className={`absolute top-1 right-1 w-2 h-2 border-r border-t ${
                darkMode ? "border-cyan-400/50" : "border-purple-400/50"
              } opacity-0 group-hover:opacity-100 transition-opacity`}
            ></div>
          </button>
        </div>

        {/* Stats Section */}
        <div className="mb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div
                key={index}
                className={`relative p-6 rounded-lg backdrop-blur-sm border transition-all duration-300 hover:scale-105 group overflow-hidden ${
                  darkMode
                    ? "bg-gray-900/50 border-cyan-500/30 hover:border-cyan-400/50"
                    : "bg-white/50 border-purple-300/30 hover:border-purple-400/50"
                } shadow-lg hover:shadow-xl`}
              >
                {/* Cyber corners */}
                <div
                  className={`absolute top-2 left-2 w-3 h-3 border-l-2 border-t-2 ${
                    darkMode ? "border-cyan-400/50" : "border-purple-400/50"
                  } opacity-0 group-hover:opacity-100 transition-opacity`}
                ></div>
                <div
                  className={`absolute top-2 right-2 w-3 h-3 border-r-2 border-t-2 ${
                    darkMode ? "border-pink-400/50" : "border-blue-400/50"
                  } opacity-0 group-hover:opacity-100 transition-opacity`}
                ></div>

                <div className="text-center relative">
                  <div
                    className={`text-2xl md:text-3xl font-bold mb-2 font-mono ${
                      darkMode ? "text-cyan-400" : "text-purple-600"
                    }`}
                  >
                    {stat.number}
                  </div>
                  <div
                    className={`text-xs mb-1 font-mono ${darkMode ? "text-gray-400" : "text-gray-500"}`}
                  >
                    {`// ${stat.code}`}
                  </div>
                  <div
                    className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}
                  >
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-20">
          <h2
            className={`text-2xl md:text-3xl font-bold text-center mb-12 font-mono tracking-wider ${
              darkMode ? "text-cyan-400" : "text-purple-600"
            }`}
          >
            {"// SYSTEM_FEATURES"}
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
                {/* Cyber scan line */}
                <div
                  className={`absolute top-0 left-0 right-0 h-px ${
                    darkMode
                      ? "bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
                      : "bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
                  } translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000`}
                ></div>

                <div
                  className={`${darkMode ? "text-cyan-400" : "text-purple-600"} mb-4 relative`}
                >
                  {feature.icon}
                  {/* Icon brackets */}
                  <div
                    className={`absolute -top-1 -left-1 w-3 h-3 border-l border-t ${
                      darkMode ? "border-cyan-400/30" : "border-purple-400/30"
                    } opacity-0 group-hover:opacity-100 transition-opacity`}
                  ></div>
                  <div
                    className={`absolute -bottom-1 -right-1 w-3 h-3 border-r border-b ${
                      darkMode ? "border-pink-400/30" : "border-blue-400/30"
                    } opacity-0 group-hover:opacity-100 transition-opacity`}
                  ></div>
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

        {/* How It Works Section */}
        <div className="mb-20">
          <h2
            className={`text-2xl md:text-3xl font-bold text-center mb-12 font-mono tracking-wider ${
              darkMode ? "text-cyan-400" : "text-purple-600"
            }`}
          >
            {"// EXECUTION_PROTOCOL"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "PROJECT_INIT",
                description: "ハッカソンのテーマとチーム情報を登録",
                code: "initialize(project, team)",
              },
              {
                step: "02",
                title: "AI_SUPPORT_START",
                description: "リアルタイムでアドバイスとサポートを受ける",
                code: "execute(realtime_assistance)",
              },
              {
                step: "03",
                title: "VICTORY_ACHIEVED",
                description: "戦略的なガイダンスで入賞を目指す",
                code: "return success(prize)",
              },
            ].map((item, index) => (
              <div
                key={index}
                className={`relative text-center p-6 rounded-lg backdrop-blur-sm border ${
                  darkMode
                    ? "bg-gray-900/30 border-cyan-500/20"
                    : "bg-white/30 border-purple-300/20"
                }`}
              >
                {/* Step number with cyber styling */}
                <div
                  className={`relative w-16 h-16 mx-auto mb-4 rounded border-2 flex items-center justify-center text-xl font-bold font-mono ${
                    darkMode
                      ? "border-cyan-500 text-cyan-400 bg-gray-900/50"
                      : "border-purple-500 text-purple-600 bg-white/50"
                  }`}
                >
                  {item.step}
                  {/* Corner brackets */}
                  <div
                    className={`absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 ${
                      darkMode ? "border-cyan-400" : "border-purple-400"
                    }`}
                  ></div>
                  <div
                    className={`absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 ${
                      darkMode ? "border-pink-400" : "border-blue-400"
                    }`}
                  ></div>
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

        {/* Team Section */}
        <div className="mb-20">
          <h2
            className={`text-2xl md:text-3xl font-bold text-center mb-12 font-mono tracking-wider ${
              darkMode ? "text-cyan-400" : "text-purple-600"
            }`}
          >
            {"// DEVELOPMENT_TEAM"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {members.map((member, index) => (
              <div
                key={index}
                className={`relative p-6 rounded-lg backdrop-blur-sm border transition-all duration-300 hover:scale-105 group overflow-hidden ${
                  darkMode
                    ? "bg-gray-900/50 border-cyan-500/30 hover:border-cyan-400/50"
                    : "bg-white/50 border-purple-300/30 hover:border-purple-400/50"
                } shadow-lg hover:shadow-xl`}
              >
                {/* Cyber frame animation */}
                <div
                  className={`absolute inset-0 border-2 rounded-lg ${
                    darkMode ? "border-cyan-400/20" : "border-purple-400/20"
                  } opacity-0 group-hover:opacity-100 transition-opacity animate-pulse`}
                ></div>

                <div className="text-center relative">
                  <div
                    className={`relative w-24 h-24 mx-auto mb-4 rounded border-4 overflow-hidden ${
                      darkMode ? "border-cyan-500/50" : "border-purple-500/50"
                    } group-hover:border-opacity-80 transition-all duration-300`}
                  >
                    <Image
                      src={member.avatar}
                      alt={member.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                    {/* Cyber overlay */}
                    <div
                      className={`absolute inset-0 ${
                        darkMode ? "bg-cyan-400/10" : "bg-purple-400/10"
                      } opacity-0 group-hover:opacity-100 transition-opacity`}
                    ></div>
                  </div>
                  <h3
                    className={`text-lg font-semibold mb-2 font-mono tracking-wider ${
                      darkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {member.name.toUpperCase().replace(/\s+/g, "_")}
                  </h3>
                  <p
                    className={`text-sm mb-1 font-mono ${darkMode ? "text-cyan-400" : "text-purple-600"}`}
                  >
                    {`// ${member.role.toUpperCase().replace(/\s+/g, "_")}`}
                  </p>
                  <p
                    className={`text-xs mb-4 ${darkMode ? "text-gray-300" : "text-gray-600"} leading-relaxed`}
                  >
                    {member.description}
                  </p>
                  <div className="flex justify-center space-x-3">
                    {member.social.github && (
                      <a
                        href={member.social.github}
                        className={`relative group/icon ${
                          darkMode
                            ? "text-gray-400 hover:text-cyan-400"
                            : "text-gray-500 hover:text-purple-600"
                        } transition-colors duration-200`}
                      >
                        <Github className="w-4 h-4" />
                        <div
                          className={`absolute -inset-1 border ${
                            darkMode
                              ? "border-cyan-400/30"
                              : "border-purple-400/30"
                          } opacity-0 group-hover/icon:opacity-100 transition-opacity`}
                        ></div>
                      </a>
                    )}
                    {member.social.linkedin && (
                      <a
                        href={member.social.linkedin}
                        className={`relative group/icon ${
                          darkMode
                            ? "text-gray-400 hover:text-cyan-400"
                            : "text-gray-500 hover:text-purple-600"
                        } transition-colors duration-200`}
                      >
                        <Linkedin className="w-4 h-4" />
                        <div
                          className={`absolute -inset-1 border ${
                            darkMode
                              ? "border-cyan-400/30"
                              : "border-purple-400/30"
                          } opacity-0 group-hover/icon:opacity-100 transition-opacity`}
                        ></div>
                      </a>
                    )}
                    {member.social.twitter && (
                      <a
                        href={member.social.twitter}
                        className={`relative group/icon ${
                          darkMode
                            ? "text-gray-400 hover:text-cyan-400"
                            : "text-gray-500 hover:text-purple-600"
                        } transition-colors duration-200`}
                      >
                        <Twitter className="w-4 h-4" />
                        <div
                          className={`absolute -inset-1 border ${
                            darkMode
                              ? "border-cyan-400/30"
                              : "border-purple-400/30"
                          } opacity-0 group-hover/icon:opacity-100 transition-opacity`}
                        ></div>
                      </a>
                    )}
                    {member.social.mail && (
                      <a
                        href={member.social.mail}
                        className={`relative group/icon ${
                          darkMode
                            ? "text-gray-400 hover:text-cyan-400"
                            : "text-gray-500 hover:text-purple-600"
                        } transition-colors duration-200`}
                      >
                        <Mail className="w-4 h-4" />
                        <div
                          className={`absolute -inset-1 border ${
                            darkMode
                              ? "border-cyan-400/30"
                              : "border-purple-400/30"
                          } opacity-0 group-hover/icon:opacity-100 transition-opacity`}
                        ></div>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div
          className={`relative text-center p-12 rounded-lg backdrop-blur-sm border overflow-hidden ${
            darkMode
              ? "bg-gray-900/50 border-cyan-500/30"
              : "bg-white/50 border-purple-300/30"
          } shadow-lg mb-20`}
        >
          {/* Animated background grid */}
          <div
            className={`absolute inset-0 opacity-10 ${
              darkMode ? "bg-cyan-400" : "bg-purple-400"
            }`}
            style={{
              backgroundImage: `
              linear-gradient(${darkMode ? "#06b6d4" : "#8b5cf6"} 1px, transparent 1px),
              linear-gradient(90deg, ${darkMode ? "#06b6d4" : "#8b5cf6"} 1px, transparent 1px)
            `,
              backgroundSize: "20px 20px",
            }}
          ></div>

          <div className="relative">
            <div
              className={`inline-block px-4 py-2 rounded font-mono text-sm mb-4 ${
                darkMode
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                  : "bg-purple-500/20 text-purple-600 border border-purple-400/50"
              }`}
            >
              {"// FINAL_CALL_TO_ACTION"}
            </div>
            <h2
              className={`text-2xl md:text-3xl font-bold mb-4 font-mono tracking-wider ${
                darkMode ? "text-white" : "text-gray-900"
              }`}
            >
              READY_TO_DOMINATE_HACKATHONS?
            </h2>
            <p
              className={`text-lg mb-8 ${darkMode ? "text-gray-300" : "text-gray-600"} max-w-2xl mx-auto`}
            >
              {"// AIの力を借りて、あなたのアイデアを最高の形で実現しませんか？"}
            </p>
            <button
              className={`group relative px-8 py-4 rounded-lg font-mono font-bold text-lg tracking-wider transition-all duration-300 overflow-hidden ${
                darkMode
                  ? "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white"
                  : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
              } shadow-lg hover:shadow-xl transform hover:scale-105`}
              onClick={() => alert("Command Executed!")}
            >
              <span className="relative">EXECUTE_COMMAND</span>
              {/* Cyber scan line */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <div
              className={`h-px w-12 ${darkMode ? "bg-cyan-500" : "bg-purple-500"}`}
            ></div>
            <div
              className={`mx-4 text-xs font-mono ${darkMode ? "text-gray-400" : "text-gray-500"}`}
            >
              {"// END_OF_TRANSMISSION"}
            </div>
            <div
              className={`h-px w-12 ${darkMode ? "bg-pink-500" : "bg-blue-500"}`}
            ></div>
          </div>
          <p
            className={`${darkMode ? "text-gray-400" : "text-gray-500"} text-sm font-mono`}
          >
            © 2025 HACKATHON_SUPPORT_AGENT. ALL_RIGHTS_RESERVED.
          </p>
        </div>
      </div>
    </div>
  );
}
