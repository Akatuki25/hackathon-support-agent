"use client";

import React from "react";
import { useDarkMode } from "@/hooks/useDarkMode";

// APIから返される質問オブジェクトの型定義
export type Question = {
  Question: string;
  Answer?: string;
}
export type Answers = { [key: number]: string };
type  AnswerTextProps = {
  question: Question;
  index: number;
  answers: Answers;
  handleAnswerChange: (index: number, value: string) => void;
}

// 質問と回答入力欄を表示するコンポーネント
const AnswerText: React.FC<AnswerTextProps> = ({ question, index, answers, handleAnswerChange }) => {
    const { darkMode } = useDarkMode();
  return (
    <div key={index} className={`p-4 rounded-lg ${
        darkMode 
            ? 'bg-gray-700 bg-opacity-50' 
            : 'bg-white bg-opacity-80'
        } transition-all`}>
        <p className={`mb-3 font-medium ${
            darkMode ? 'text-pink-300' : 'text-blue-700'
        }`}>
            {index + 1}. {question.Question}
        </p>
        <textarea
            value={answers[index] || ""}
            onChange={(e) =>{ 
                // これ入れないとサイズが変わったあとに内容を削除したときなど動きがおかしい
                e.target.style.height = 'auto';
                // 改行に合わせて高さを変える
                e.target.style.height = e.target.scrollHeight + 'px';
                handleAnswerChange(index, e.target.value)}}
            placeholder="回答を入力してください..."
            rows={3}
            className={`w-full p-3 rounded border-l-4 focus:outline-none transition-all ${
            darkMode 
                ? 'bg-gray-800 text-gray-100 border-cyan-500 focus:ring-1 focus:ring-pink-400' 
                : 'bg-white text-gray-800 border-purple-500 focus:ring-1 focus:ring-blue-400'
            }`}
        />
        </div>
  );
};

export default AnswerText;
