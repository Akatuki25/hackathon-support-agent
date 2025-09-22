"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SummaryEditor from "@/components/SummaryEditor";
import { Code, Book } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import Loading from "@/components/PageLoading";
import SaveButton from "@/components/Buttons/SaveButton";
import { patchProjectDocument, getProjectDocument } from "@/libs/modelAPI/document";
import { generateTechnologyDocument } from "@/libs/service/technologyService";
import Header from "@/components/Session/Header";

export default function TechnologyDocumentPage() {
  const router = useRouter();
  const [technologyDoc, setTechnologyDoc] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const projectId = pathname.split("/")[2]; // [ProjectId]の部分を取得

  const { darkMode } = useDarkMode();

  // sessionStorage からフレームワーク選択情報を取得し、技術ドキュメントを生成
  useEffect(() => {
    const initializeDocument = async () => {
      if (typeof window !== "undefined") {
        try {
          const storedReason = sessionStorage.getItem(projectId);

          if (storedReason) {
            // DBからプロジェクトドキュメントを取得
            const projectDoc = await getProjectDocument(projectId);
            const specification = projectDoc.function_doc || "";

            // 既存の技術ドキュメントがあれば表示、なければ生成
            if (projectDoc.frame_work_doc) {
              setTechnologyDoc(projectDoc.frame_work_doc);
            } else if (specification) {
              // 技術ドキュメントを生成
              setLoading(true);
              const technologiesArray = storedReason.split(", ");

              const response = await generateTechnologyDocument({
                selected_technologies: technologiesArray,
                framework_doc: specification
              });

              setTechnologyDoc(response.technology_document);
            }
          } else {
            // フレームワーク選択情報がなければ前のページに戻る
            router.push(`/hackSetUp/${projectId}/selectFramework`);
          }
        } catch (error) {
          console.error("技術ドキュメントの初期化エラー:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    initializeDocument();
  }, [router, projectId]);

  const handleTechnologyDocChange = (newDoc: string) => {
    setTechnologyDoc(newDoc);
    console.log("newTechnologyDoc:", newDoc);
  };

  const handleSave = async () => {
    try {
      // 技術ドキュメントをDBに保存
      await patchProjectDocument(projectId, {
        frame_work_doc: technologyDoc
      });
      console.log("技術ドキュメントの保存に成功");

      // 次のページへ遷移（例：タスク分割ページ）
      router.push(`/hackSetUp/${projectId}/taskDivision`);
    } catch (error) {
      console.error("技術ドキュメントの保存に失敗:", error);
    }
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
            <Code
              className={`mr-3 ${darkMode ? "text-pink-500" : "text-blue-600"}`}
              size={28}
            />
            <h1
              className={`text-2xl font-bold tracking-wider ${darkMode ? "text-cyan-400" : "text-purple-700"}`}
            >
              技術
              <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
                _ドキュメント
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
                <Book
                  className={`mr-2 ${darkMode ? "text-pink-500" : "text-blue-600"}`}
                  size={20}
                />
                <p>
                  技術ドキュメントを確認し、必要に応じて編集してください。Docker環境での
                  インストール手順と公式ドキュメントへのリンクが含まれています。
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
                initialSummary={technologyDoc}
                onSummaryChange={handleTechnologyDocChange}
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