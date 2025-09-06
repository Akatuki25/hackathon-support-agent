"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SummaryEditor from "@/components/SummaryEditor";
import { FileText, Save, ChevronRight, Info } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import Loading from "@/components/PageLoading";
import SaveButton from "@/components/Buttons/SaveButton";
import { ProjectDocumentType } from "@/types/modelTypes";
import { postProjectDocument, getProjectDocument,patchProjectDocument  } from "@/libs/modelAPI/document";
import Header from "@/components/Session/Header";
import { getServerSession } from "next-auth";
import { ca } from "zod/locales";

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
  const [frameworkDocument, setFrameworkDocument] = useState<string>("")
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const projectId = pathname.split("/")[2]; // [ProjectId]の部分を

  const { darkMode } = useDarkMode();

  // sessionStorage から Q&A 回答情報を取得
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedFramework = sessionStorage.getItem("frameworkInfo")
      if (!storedFramework) {
       try{
        const storedFramework = getProjectDocument(projectId);
        storedFramework
            .then((data) => {
                const frameworkInfo = data.frame_work_doc;
                setFrameworkDocument(frameworkInfo)
                setLoading(false);
                })
            .catch((error) => {
                console.error("フレームワーク情報の取得に失敗:", error);
                setLoading(false);
            });
      }catch (error) {
            console.error("フレームワーク情報の取得に失敗:", error);
            setLoading(false);
        }
    }
    }
  }, [router]);

  const handleSummaryChange = (newSummary: string) => {
    console.log("newSummary:", newSummary);
  };

  const handleSave = async () => {

    // 仕様書をAPIに送信
    const specificationDoc = sessionStorage.getItem("specification");
   const ID = await patchProjectDocument(
    projectId,
    {
        frame_work_doc: frameworkDocument,
    }
   )
    if (!ID) {
      console.error("仕様書の保存に失敗しました");
      return;
    }
    console.log("仕様書の保存に成功:", ID);

    router.push(`/hackSetUp/${ID}/documentDashboard`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading />
      </div>
    );
  }

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>
      <div className="max-w-7xl mx-auto relative z-10 mt-30">
        <div
          className={`backdrop-blur-lg rounded-xl p-6 shadow-xl border transition-all ${
            darkMode
              ? "bg-gray-800 bg-opacity-70 border-cyan-500/30 shadow-cyan-500/20"
              : "bg-white bg-opacity-70 border-purple-500/30 shadow-purple-300/20"
          }`}
        >
          <div className="flex items-center mb-6">
            <FileText
              className={`mr-3 ${darkMode ? "text-pink-500" : "text-blue-600"}`}
              size={28}
            />
            <h1
              className={`text-2xl font-bold tracking-wider ${darkMode ? "text-cyan-400" : "text-purple-700"}`}
            >
              仕様書
              <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
                _編集
              </span>
            </h1>
          </div>
          <>
            <div
              className={`mb-4 p-4 rounded-lg border-l-4 ${
                darkMode
                  ? "bg-gray-700 bg-opacity-50 border-pink-500 text-gray-300"
                  : "bg-purple-50 border-blue-500 text-gray-700"
              }`}
            >
              <div className="flex items-center">
                <Info
                  className={`mr-2 ${darkMode ? "text-pink-500" : "text-blue-600"}`}
                  size={20}
                />
                <p>
                  仕様書を確認し、必要に応じて編集してください。マークダウン形式で記述できます。
                </p>
              </div>
            </div>

            <div
              className={`rounded-lg border transition-all ${
                darkMode
                  ? "bg-gray-700 bg-opacity-50 border-cyan-500/40"
                  : "bg-white border-purple-300/40"
              }`}
            >
              <SummaryEditor
                initialSummary={frameworkDocument}
                onSummaryChange={handleSummaryChange}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <SaveButton handleSave={handleSave} title={"保存して次へ"} />
            </div>
          </>
        </div>

        <div
          className={`text-xs text-center mt-4 ${darkMode ? "text-gray-500" : "text-gray-600"}`}
        >
          <span className={darkMode ? "text-cyan-400" : "text-purple-600"}>
            CYBER
          </span>
          <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
            DREAM
          </span>{" "}
          v2.4.7
        </div>
      </div>
    </>
  );
}
