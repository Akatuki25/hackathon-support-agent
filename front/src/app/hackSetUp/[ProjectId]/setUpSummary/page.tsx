"use client";

import React, { useEffect, useState } from "react";
import { useRouter,usePathname } from "next/navigation";
import SummaryEditor from "@/components/SummaryEditor";
import {  FileText, Save, ChevronRight, Info } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import Loading from "@/components/PageLoading";
import  SaveButton  from "@/components/Buttons/SaveButton";
import { ProjectDocumentType } from "@/types/modelTypes";
import { postDocument } from "@/libs/modelAPI/document";
import path from "path";


interface QAItem {
  Question: string;
  Answer: string;
}

interface QAItems {
    yume_answer: {
      Answer: QAItem[];
    };
  }  

export default function SetUpSummaryPage() {
  const router = useRouter();
  const [qaData, setQaData] = useState<QAItems | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const projectId = pathname.split("/")[2]; // [ProjectId]の部分を
  

const { darkMode } = useDarkMode();

  // sessionStorage から Q&A 回答情報を取得
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedQA = sessionStorage.getItem("answers");
      if (storedQA) {
        try {
          const parsedQA: QAItems= JSON.parse(storedQA);
          console.log("セッションストレージから読み込んだQ&Aデータ:", parsedQA);
          setQaData(parsedQA);
        } catch (error) {
          console.error("Q&Aデータのパースエラー:", error);
        }
      } else {
        // Q&A情報がなければホームに戻る
        router.push("/");
      }
    }
  }, [router]);

  // Q&Aデータが取得できたら summary API を呼び出す
    useEffect(() => {

    if (qaData == null) return;
    if (qaData.yume_answer &&
        Array.isArray(qaData.yume_answer.Answer) &&
        qaData.yume_answer.Answer.length > 0
        ) {
        const fetchSummary = async () => {
        setLoading(true);
        try {
            // hackQAで整形したデータをそのままAPIに送る
            const requestBody = qaData.yume_answer;
            const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/summary/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            });
            const summaryText = await res.json();
            setSummary(summaryText.summary);
        } catch (error) {
            console.error("summary API 呼び出しエラー:", error);
        } finally {
            setLoading(false);
        }
        };
        fetchSummary();
        }else{
            console.error("Q&Aデータが不正です");
        }
    }, [qaData]);


const handleSummaryChange = (newSummary: string) => {
    setSummary(newSummary);
    console.log("newSummary:", newSummary);
};

const handleSave = async () => {
    // 編集後の仕様書を sessionStorage に保存

    sessionStorage.setItem("specification", summary);
    // 仕様書をAPIに送信
    const ID =await postDocument({
        project_id: projectId,
        specification_doc: summary,
        frame_work_doc : "",
        directory_info : "",
    });
    if (!ID) {
        console.error("仕様書の保存に失敗しました");
        return;
    }
    console.log("仕様書の保存に成功:", ID);



    router.push("/hackSetUp/{ID}/selectFramework");
};

if (loading) {
return (
    <div className="flex items-center justify-center h-screen">
        <Loading />
    </div>
)
}


return (
<>
    
    <div className="max-w-7xl mx-auto relative z-10">
    <div className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
        darkMode 
        ? 'bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20' 
        : 'bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20'
    }`}>
        <div className="flex items-center mb-6">
        <FileText className={`mr-3 ${darkMode ? 'text-pink-500' : 'text-blue-600'}`} size={28} />
        <h1 className={`text-2xl font-bold tracking-wider ${darkMode ? 'text-cyan-400' : 'text-purple-700'}`}>
            仕様書<span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>_編集</span>
        </h1>
        </div>
        <>
            <div className={`mb-4 p-4 rounded-lg border-l-4 ${
            darkMode 
                ? 'bg-gray-700 bg-opacity-50 border-pink-500 text-gray-300' 
                : 'bg-purple-50 border-blue-500 text-gray-700'
            }`}>
            <div className="flex items-center">
                <Info className={`mr-2 ${darkMode ? 'text-pink-500' : 'text-blue-600'}`} size={20} />
                <p>仕様書を確認し、必要に応じて編集してください。マークダウン形式で記述できます。</p>
            </div>
        </div>
            
            <div className={`rounded-lg border transition-all ${
            darkMode 
                ? 'bg-gray-700 bg-opacity-50 border-cyan-500/40' 
                : 'bg-white border-purple-300/40'
            }`}>
            <SummaryEditor 
                initialSummary={summary} 
                onSummaryChange={handleSummaryChange}
            />
            </div>
            
            <div className="mt-6 flex justify-end">
            <SaveButton 
            handleSave={handleSave}
            title={"保存して次へ"}
            />
            </div>
        </>

    </div>
    
    <div className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
        <span className={darkMode ? 'text-cyan-400' : 'text-purple-600'}>CYBER</span>
        <span className={darkMode ? 'text-pink-500' : 'text-blue-600'}>DREAM</span> v2.4.7
    </div>

    </div>
</>
);
}
