"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProjectPhase, getPagePathForPhase } from "@/libs/service/phaseService";

interface UsePhaseRecoveryOptions {
  projectId: string;
  currentPath: string;
  userName?: string;
  autoRedirect?: boolean;
}

/**
 * プロジェクトのフェーズを復旧し、適切なページへリダイレクトするフック
 *
 * タブを閉じて再度開いた時に、途中のフェーズから再開できるようにする
 */
export const usePhaseRecovery = ({
  projectId,
  currentPath,
  userName,
  autoRedirect = true,
}: UsePhaseRecoveryOptions) => {
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkPhase = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      try {
        const phaseData = await getProjectPhase(projectId);
        setCurrentPhase(phaseData.current_phase);

        // 現在のフェーズに対応するパスを取得
        const expectedPath = getPagePathForPhase(
          phaseData.current_phase,
          projectId,
          userName
        );

        // 現在のパスと期待されるパスが異なる場合、リダイレクトフラグを立てる
        if (autoRedirect && currentPath !== expectedPath) {
          console.log(`🔄 Phase recovery: Redirecting from ${currentPath} to ${expectedPath}`);
          setShouldRedirect(true);
          router.push(expectedPath);
        }
      } catch (err) {
        console.error("Failed to fetch project phase:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    checkPhase();
  }, [projectId, currentPath, userName, autoRedirect, router]);

  return {
    currentPhase,
    isLoading,
    shouldRedirect,
    error,
  };
};
