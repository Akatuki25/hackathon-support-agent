"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import TechnologyEditor from "@/components/TechnologyEditor/TechnologyEditor";
import { useDarkMode } from "@/hooks/useDarkMode";
import Loading from "@/components/PageLoading";
import { patchProjectDocument, getProjectDocument } from "@/libs/modelAPI/document";
import { generateTechnologyDocument } from "@/libs/service/technologyService";
import Header from "@/components/Session/Header";
import HackthonSupportAgent from "@/components/Logo/HackthonSupportAgent"

export default function TechnologyDocumentPage() {
  const router = useRouter();
  const [technologyDoc, setTechnologyDoc] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);
  const [specification, setSpecification] = useState<string>("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [editorKey, setEditorKey] = useState(0); // エディター強制更新用
  const pathname = usePathname();
  const projectId = pathname.split("/")[2]; // [ProjectId]の部分を取得
  const { darkMode } = useDarkMode();

  // プロジェクトドキュメントとフレームワーク選択情報を取得
  useEffect(() => {
    const initializeDocument = async () => {
      if (typeof window !== "undefined") {
        try {
          const storedReason = sessionStorage.getItem(projectId);
          // DBからプロジェクトドキュメントを取得してspecificationを取得
          const projectDoc = await getProjectDocument(projectId);
          const storedSpecification = projectDoc.function_doc || "";

          if (storedReason && storedSpecification) {
            // 選択された技術を配列に変換
            const technologiesArray = storedReason.split(", ");
            setSelectedTechnologies(technologiesArray);
            setSpecification(storedSpecification);

            // 既存の技術ドキュメントがあれば読み込み、なければ自動生成
            if (projectDoc.frame_work_doc) {
              setTechnologyDoc(projectDoc.frame_work_doc);
            } else {
              // 技術ドキュメントを自動生成
              await generateTechnologyDoc(technologiesArray, storedSpecification);
            }
          } else {
            // 必要な情報がなければフレームワーク選択に戻る
            router.push(`/hackSetUp/${projectId}/selectFramework`);
          }
        } catch (error) {
          console.error("プロジェクトドキュメントの取得に失敗:", error);
          // エラーの場合もフレームワーク選択に戻る
          router.push(`/hackSetUp/${projectId}/selectFramework`);
        } finally {
          setLoading(false);
        }
      }
    };

    initializeDocument();
  }, [router, projectId]);

  // 技術ドキュメント生成関数
  const generateTechnologyDoc = async (technologiesArray: string[], specification: string) => {
    try {
      const response = await generateTechnologyDocument({
        selected_technologies: technologiesArray,
        framework_doc: specification
      });
      setTechnologyDoc(response.technology_document);

      // 生成されたドキュメントをDBに保存
      await patchProjectDocument(projectId, {
        frame_work_doc: response.technology_document
      });
    } catch (error) {
      console.error("技術ドキュメント生成エラー:", error);
    }
  };

  // 技術ドキュメントの内容変更ハンドラー
  const handleContentChange = (content: string) => {
    setTechnologyDoc(content);
  };

  // 技術ドキュメント再生成
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      // 一時的に空の状態にしてエディターをリセット
      setTechnologyDoc("");

      // 新しい技術ドキュメントを生成
      const response = await generateTechnologyDocument({
        selected_technologies: selectedTechnologies,
        framework_doc: specification
      });

      // 新しいコンテンツを設定
      setTechnologyDoc(response.technology_document);

      // エディターを強制更新
      setEditorKey(prev => prev + 1);

      // DBに保存
      await patchProjectDocument(projectId, {
        frame_work_doc: response.technology_document
      });

      console.log("技術ドキュメントの再生成に成功");
    } catch (error) {
      console.error("技術ドキュメント再生成エラー:", error);
      alert("技術ドキュメントの再生成に失敗しました。");
    } finally {
      setIsRegenerating(false);
    }
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
      <div className="min-h-screen pb-20">
        <div className="max-w-7xl mx-auto relative z-10 mt-30 px-4">
          <div className="pt-4 pb-8">
            <TechnologyEditor
              key={`tech-editor-${editorKey}`}
              initialContent={technologyDoc}
              onContentChange={handleContentChange}
              onSave={handleSave}
              onRegenerate={handleRegenerate}
              isRegenerating={isRegenerating}
            />
          </div>

          <HackthonSupportAgent/>
        </div>
      </div>
    </>
  );
}