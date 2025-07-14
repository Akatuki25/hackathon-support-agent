"use client";

import React from 'react';
import { Github, Linkedin, Twitter, Mail, Code, Zap, Users, Target, LogIn, UserPlus } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useDarkMode } from '@/hooks/useDarkMode';
import Header from '@/components/Session/Header';

export default function PlannectLandingPage() {
  const { data: session, status } = useSession();
  const { darkMode} = useDarkMode();

  const members = [
    {
      name: "田中 太郎",
      role: "Lead Developer",
      description: "フルスタック開発者として10年以上の経験を持つ。システム設計と最適化のスペシャリスト。",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      social: {
        github: "#",
        linkedin: "#",
        twitter: "#"
      }
    },
    {
      name: "佐藤 花子",
      role: "Product Manager",
      description: "プロダクト戦略とユーザー体験設計のエキスパート。開発者向けツールの企画に特化。",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
      social: {
        github: "#",
        linkedin: "#",
        mail: "#"
      }
    },
    {
      name: "山田 次郎",
      role: "Backend Engineer",
      description: "クラウドアーキテクチャとAPI設計のプロフェッショナル。スケーラブルなシステム構築が得意。",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      social: {
        github: "#",
        twitter: "#",
        mail: "#"
      }
    },
    {
      name: "鈴木 美咲",
      role: "Frontend Engineer",
      description: "モダンなWebテクノロジーとUX/UIデザインに精通。ユーザーフレンドリーなインターフェース作成が専門。",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
      social: {
        github: "#",
        linkedin: "#",
        twitter: "#"
      }
    }
  ];

  const features = [
    {
      icon: <Code className="w-8 h-8" />,
      title: "コード最適化",
      description: "開発プロセスの効率化と品質向上を実現"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "高速パフォーマンス",
      description: "最新技術によるパフォーマンス最適化"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "チーム連携",
      description: "開発チーム全体の生産性を向上"
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "精密な分析",
      description: "データ駆動型の開発決定をサポート"
    }
  ];

  return (
    <div >
      <Header/>
      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className={`text-6xl md:text-8xl font-bold mb-6 ${
            darkMode 
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400' 
              : 'text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600'
          } animate-pulse`}>
            Plannect
          </h1>
          <p className={`text-xl md:text-2xl mb-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'} font-light`}>
            開発者にとって必要な定義を最適化するため
          </p>
          <div className={`w-24 h-1 mx-auto ${darkMode ? 'bg-gradient-to-r from-cyan-500 to-pink-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'} rounded-full`}></div>
        </div>

        {/* Features Section */}
        <div className="mb-20">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`}>
            特徴
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`p-6 rounded-xl backdrop-blur-sm border transition-all duration-300 hover:scale-105 ${
                  darkMode 
                    ? 'bg-gray-800/50 border-cyan-500/20 hover:border-cyan-500/40' 
                    : 'bg-white/50 border-purple-300/20 hover:border-purple-300/40'
                } shadow-lg hover:shadow-xl`}
              >
                <div className={`${darkMode ? 'text-cyan-400' : 'text-purple-600'} mb-4`}>
                  {feature.icon}
                </div>
                <h3 className={`text-xl font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {feature.title}
                </h3>
                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Team Section */}
        <div>
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`}>
            チームメンバー
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {members.map((member, index) => (
              <div
                key={index}
                className={`p-6 rounded-xl backdrop-blur-sm border transition-all duration-300 hover:scale-105 group ${
                  darkMode 
                    ? 'bg-gray-800/50 border-cyan-500/20 hover:border-cyan-500/40' 
                    : 'bg-white/50 border-purple-300/20 hover:border-purple-300/40'
                } shadow-lg hover:shadow-xl`}
              >
                <div className="text-center">
                  <div className={`w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 ${
                    darkMode ? 'border-cyan-500/30' : 'border-purple-500/30'
                  } group-hover:border-opacity-60 transition-all duration-300`}>
                    <img 
                      src={member.avatar} 
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {member.name}
                  </h3>
                  <p className={`text-sm mb-3 ${darkMode ? 'text-cyan-400' : 'text-purple-600'} font-medium`}>
                    {member.role}
                  </p>
                  <p className={`text-xs mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'} leading-relaxed`}>
                    {member.description}
                  </p>
                  <div className="flex justify-center space-x-3">
                    {member.social.github && (
                      <a href={member.social.github} className={`${darkMode ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-500 hover:text-purple-600'} transition-colors duration-200`}>
                        <Github className="w-4 h-4" />
                      </a>
                    )}
                    {member.social.linkedin && (
                      <a href={member.social.linkedin} className={`${darkMode ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-500 hover:text-purple-600'} transition-colors duration-200`}>
                        <Linkedin className="w-4 h-4" />
                      </a>
                    )}
                    {member.social.twitter && (
                      <a href={member.social.twitter} className={`${darkMode ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-500 hover:text-purple-600'} transition-colors duration-200`}>
                        <Twitter className="w-4 h-4" />
                      </a>
                    )}
                    {member.social.mail && (
                      <a href={member.social.mail} className={`${darkMode ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-500 hover:text-purple-600'} transition-colors duration-200`}>
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 text-center">
          <div className={`w-24 h-1 mx-auto mb-6 ${darkMode ? 'bg-gradient-to-r from-cyan-500 to-pink-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'} rounded-full`}></div>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
            © 2025 Plannect. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}