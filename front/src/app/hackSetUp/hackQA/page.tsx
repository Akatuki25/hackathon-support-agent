"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {  ChevronRight, Terminal, Database, Cpu } from "lucide-react";



import { useDarkMode } from "@/hooks/useDarkMode";
import { Question,Answers } from "@/components/AnswerText";
import AnswerText from "@/components/AnswerText";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent";

export default function HackQA() {
const router = useRouter();
const [idea, setIdea] = useState<string>("");
const [questions, setQuestions] = useState<Question[]>([]);
const [answers, setAnswers] = useState<Answers>({});
const [loading, setLoading] = useState(true);
const processingNext=false
const { darkMode } = useDarkMode();


useEffect(() => {
    if (typeof window !== "undefined") {
    const storedIdea = sessionStorage.getItem("idea");
    // キーを "questionData" で読み込むように修正
    const storedQA = sessionStorage.getItem("questionData");

    if (storedIdea) {
        setIdea(storedIdea);
        if (storedQA) {
        try {
            const data = JSON.parse(storedQA);
            console.log("セッションストレージから読み込んだQ&Aデータ:", data);
            // 期待する形式は { yume_answer: { Answer: [...] } } となる
            if (data && data.yume_answer && Array.isArray(data.yume_answer.Answer)) {
            setQuestions(data.yume_answer.Answer);
            // 初期回答をセット（各オブジェクトの Answer 値を利用）
            const initialAnswers: { [key: number]: string } = {};
            data.yume_answer.Answer.forEach((q: { Question: string; Answer: string }, index: number) => {
                initialAnswers[index] = q.Answer || "";
            });
            setAnswers(initialAnswers);
            } else {
            console.error("予期しないデータ形式:", data);
            }
        } catch (e) {
            console.error("JSONパースエラー:", e);
        }
        } else {
        console.error("Q&Aデータがセッションストレージにありません");
        }
        setLoading(false);
    } else {
        console.log("アイデアがセッションストレージにないため、ホームに戻ります");
        router.push("/");
    }
    }
}, [router]);

const handleAnswerChange = (id: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
};

const handleSave = () => {
    const formattedQA = {
        yume_answer: {
        Answer: questions.map((q, index) => ({
            Question: q.Question,
            Answer: answers[index],
        })),
        },
    };
    sessionStorage.setItem("answers", JSON.stringify(formattedQA));
    
    console.log("formattedQA:", formattedQA);
    // 画面遷移
    router.push("/hackSetUp/setUpSummary");
};

return (
    <>

    {/* mainのカラーを透明にする */}
    <main className="relative z-10">
        <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4 mt-5">
            <Terminal className={`mr-2 ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`} />
            <h1 className={`text-3xl font-bold tracking-wider ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
                プロジェクト<span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>_分析</span>
            </h1>
            </div>
            <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            以下の質問に回答することで、プロダクトの方向性を明確にしましょう
            </p>
        </div>

        <div className={`backdrop-blur-lg rounded-xl p-8 shadow-xl border transition-all ${
            darkMode 
            ? 'bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20' 
            : 'bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20'
        }`}>
            {loading ? (
            <div className="flex flex-col justify-center items-center py-12">
                <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${
                darkMode ? 'border-cyan-500' : 'border-purple-500'
                }`}></div>
                <p className={`mt-4 ${darkMode ? 'text-cyan-400' : 'text-purple-600'}`}>
                データロード中...
                </p>
            </div>
            ) : (
            <>
                <div className="mb-6">
                <h2 className={`text-xl font-medium mb-4 flex items-center ${
                    darkMode ? 'text-cyan-400' : 'text-purple-700'
                }`}>
                    <Database size={18} className={`mr-2 ${
                    darkMode ? 'text-pink-500' : 'text-blue-600'
                    }`} />
                    あなたの作りたいもの：
                </h2>
                <p className={`${
                    darkMode 
                    ? 'bg-gray-700 text-cyan-300' 
                    : 'bg-purple-100 text-gray-800'
                } p-4 rounded-lg border-l-4 ${
                    darkMode ? 'border-pink-500' : 'border-blue-500'
                }`}>
                    {idea}
                </p>
                </div>

                <div className="mb-8">
                <h2 className={`text-xl font-medium mb-4 flex items-center ${
                    darkMode ? 'text-cyan-400' : 'text-purple-700'
                }`}>
                    <Cpu size={18} className={`mr-2 ${
                    darkMode ? 'text-pink-500' : 'text-blue-600'
                    }`} />
                    以下の質問に回答してください：
                </h2>
                <div className="space-y-6">
                    {questions && questions.length > 0 ? (
                    questions.map((question, index) => (
                        <AnswerText
                        key={index}
                        question={question}
                        index={index}
                        answers={answers}
                        handleAnswerChange={handleAnswerChange}
                        />
                    ))
                    ) : (
                    <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                        質問が読み込めませんでした。もう一度お試しください。
                    </p>
                    )}
                </div>
                </div>

                <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className={`px-8 py-3 flex items-center rounded-full shadow-lg focus:outline-none transform transition hover:-translate-y-1 ${
                    darkMode 
                        ? 'bg-cyan-500 hover:bg-cyan-600 text-gray-900 focus:ring-2 focus:ring-cyan-400' 
                        : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-2 focus:ring-purple-400'
                    }`}
                    disabled={questions.length === 0 || processingNext}
                >
                    {processingNext ? (
                    <div className="flex items-center">
                        <div className={`animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 ${
                        darkMode ? 'border-gray-900' : 'border-white'
                        } mr-2`}></div>
                        処理中...
                    </div>
                    ) : (
                    <>
                        <span>次へ進む</span>
                        <ChevronRight size={18} className="ml-2" />
                    </>
                    )}
                </button>
                </div>
            </>
            )}
        </div>
        
        <HackthonSupportAgent />
        </div>
    </main>
    </>
);
}