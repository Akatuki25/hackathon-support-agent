# All Project Page Enhancement Plan

## 概要

`/front/src/app/dashbord/allProject/page.tsx` の機能拡張計画書です。以下の主要機能を実装します：

1. **フェーズリカバリー機能**: プロジェクトカードから途中のフェーズへ直接遷移
2. **チームメンバーフィルタリング**: ログインユーザーが参加しているプロジェクトのみ表示
3. **追加の便利機能**: ソート、フィルタリング、プロジェクト統計など

本計画は `PHASE_MANAGEMENT_IMPLEMENTATION.md` に記載されているフェーズ管理機能と統合し、シームレスなユーザー体験を提供します。

---

## 1. フェーズリカバリー機能の実装

### 1.1 概要

プロジェクトカードに「続きから再開」ボタンを追加し、データベースに保存されている現在のフェーズへ直接ジャンプできるようにします。

### 1.2 必要なバックエンド変更

#### 1.2.1 プロジェクト一覧APIの拡張

**ファイル**: `/back/routers/project/project_base.py`

現在の `/projectsAll` エンドポイントを拡張し、フェーズ情報を含めます。

```python
from models.project_base import ProjectBase

@router.get("/projectsAll", summary="全プロジェクト一覧取得（フェーズ情報含む）")
async def get_all_projects_with_phase(db: Session = Depends(get_db)):
    """
    全プロジェクトをフェーズ情報付きで取得
    """
    projects = db.query(ProjectBase).all()

    result = []
    for project in projects:
        result.append({
            "project_id": str(project.project_id),
            "title": project.title,
            "idea": project.idea,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "member_count": project.member_count,
            "team_name": project.team_name,
            # 新規追加: フェーズ情報
            "current_phase": project.current_phase,
            "phase_updated_at": project.phase_updated_at.isoformat() if project.phase_updated_at else None,
            "phase_progress_percentage": _calculate_phase_progress(project.current_phase)
        })

    return result

def _calculate_phase_progress(phase: str) -> int:
    """フェーズから進行率を計算"""
    phase_order = {
        "initial": 0,
        "qa_editing": 14,
        "summary_review": 28,
        "framework_selection": 42,
        "function_review": 57,
        "function_structuring": 71,
        "task_management": 100
    }
    return phase_order.get(phase, 0)
```

#### 1.2.2 メンバー別プロジェクト取得API（新規）

**ファイル**: `/back/routers/project/project_base.py`

```python
@router.get("/projects/member/{member_id}", summary="メンバーが参加しているプロジェクト一覧")
async def get_projects_by_member(member_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    指定されたメンバーが参加しているプロジェクトを取得
    """
    # ProjectMemberテーブルから該当するproject_idを取得
    project_members = db.query(ProjectMember).filter(
        ProjectMember.member_id == member_id
    ).all()

    project_ids = [pm.project_id for pm in project_members]

    # プロジェクト情報を取得
    projects = db.query(ProjectBase).filter(
        ProjectBase.project_id.in_(project_ids)
    ).all()

    result = []
    for project in projects:
        result.append({
            "project_id": str(project.project_id),
            "title": project.title,
            "idea": project.idea,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "member_count": project.member_count,
            "team_name": project.team_name,
            "current_phase": project.current_phase,
            "phase_updated_at": project.phase_updated_at.isoformat() if project.phase_updated_at else None,
            "phase_progress_percentage": _calculate_phase_progress(project.current_phase)
        })

    return result
```

#### 1.2.3 GitHub名からメンバーIDを取得するAPI

すでに `/member/github/{github_name}` が存在するため、追加不要です。

### 1.3 フロントエンド実装

#### 1.3.1 型定義の拡張

**ファイル**: `/front/src/types/modelTypes.ts`

```typescript
export interface ProjectType {
  project_id: string;
  title: string;
  idea: string;
  start_date: string | Date;
  end_date: string | Date;
  member_count?: number;
  team_name?: string;
  // 新規追加
  current_phase?: string;
  phase_updated_at?: string;
  phase_progress_percentage?: number;
}
```

#### 1.3.2 API関数の追加

**ファイル**: `/front/src/libs/modelAPI/project.ts`

```typescript
// メンバーが参加しているプロジェクト一覧を取得
export const getProjectsByMemberId = async (memberId: string): Promise<ProjectType[]> => {
  const response = await axios.get<ProjectType[]>(`${API_URL}/projects/member/${memberId}`);
  return response.data;
};

// 全プロジェクト取得（フェーズ情報含む）
export const getAllProjectsWithPhase = async (): Promise<ProjectType[]> => {
  const response = await axios.get<ProjectType[]>(`${API_URL}/projectsAll`);
  return response.data;
};
```

#### 1.3.3 プロジェクトカードコンポーネントの作成

**ファイル**: `/front/src/components/ProjectCard.tsx` (新規作成)

```typescript
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Clock, Lightbulb, Trash2, PlayCircle } from "lucide-react";
import { ProjectType } from "@/types/modelTypes";
import { getPagePathForPhase, getPhaseLabel } from "@/libs/service/phaseService";

interface ProjectCardProps {
  project: ProjectType;
  index: number;
  darkMode: boolean;
  onDelete: (e: React.MouseEvent, projectId: string, projectTitle: string) => void;
  userName?: string;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  index,
  darkMode,
  onDelete,
  userName,
}) => {
  const router = useRouter();

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return "未設定";
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const calculateRemainingDays = (endDate: string | Date) => {
    if (!endDate) return 0;
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getProjectStatus = (startDate: string | Date, endDate: string | Date) => {
    if (!startDate || !endDate) return "未設定";
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return "準備中";
    if (now > end) return "完了";
    return "進行中";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "進行中":
        return darkMode
          ? "text-green-400 border-green-400/50"
          : "text-green-600 border-green-500/50";
      case "完了":
        return darkMode
          ? "text-blue-400 border-blue-400/50"
          : "text-blue-600 border-blue-500/50";
      case "準備中":
        return darkMode
          ? "text-yellow-400 border-yellow-400/50"
          : "text-yellow-600 border-yellow-500/50";
      default:
        return darkMode
          ? "text-gray-400 border-gray-400/50"
          : "text-gray-600 border-gray-500/50";
    }
  };

  const status = getProjectStatus(project.start_date, project.end_date);
  const statusColor = getStatusColor(status);

  // フェーズリカバリー用のパスを取得
  const handleResumeProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.current_phase && project.current_phase !== "initial") {
      const phasePath = getPagePathForPhase(
        project.current_phase,
        project.project_id,
        userName
      );
      router.push(phasePath);
    } else {
      // 初期状態またはフェーズ情報がない場合は通常の遷移
      router.push(`/projects/${project.project_id}`);
    }
  };

  // カード全体のクリックは詳細ページへ
  const handleCardClick = () => {
    router.push(`/projects/${project.project_id}`);
  };

  return (
    <div
      className={`relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden ${
        status === "完了"
          ? darkMode
            ? "bg-gray-800/20 border-gray-600/20 opacity-60 shadow-lg shadow-gray-500/10"
            : "bg-white/40 border-gray-300/20 opacity-60"
          : status === "進行中"
          ? darkMode
            ? "bg-blue-900/30 border-blue-500/40 hover:border-blue-400/60 shadow-lg shadow-blue-500/30"
            : "bg-blue-100/60 border-blue-400/40 hover:border-blue-500/60"
          : darkMode
          ? "bg-gray-800/30 border-cyan-500/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
          : "bg-white/60 border-purple-300/30 hover:border-purple-400/50"
      } shadow-lg hover:shadow-2xl cursor-pointer`}
      onClick={handleCardClick}
    >
      {/* サイバースキャンライン */}
      <div
        className={`absolute top-0 left-0 right-0 h-px ${
          darkMode
            ? "bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
            : "bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
        } translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000`}
      ></div>

      {/* プロジェクト番号 & ステータス */}
      <div className="absolute top-4 right-4 flex items-center space-x-2">
        <div
          className={`px-2 py-1 rounded text-xs font-mono font-bold border backdrop-blur-md ${statusColor}`}
        >
          {status}
        </div>
        <div
          className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-mono font-bold backdrop-blur-md ${
            darkMode
              ? "border-cyan-500/50 text-cyan-400 bg-gray-800/50"
              : "border-purple-500/50 text-purple-600 bg-white/50"
          }`}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>

      {/* サイバーコーナー */}
      <div
        className={`absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 ${
          darkMode ? "border-cyan-400/50" : "border-purple-400/50"
        } opacity-0 group-hover:opacity-100 transition-opacity`}
      ></div>
      <div
        className={`absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 ${
          darkMode ? "border-pink-400/50" : "border-blue-400/50"
        } opacity-0 group-hover:opacity-100 transition-opacity`}
      ></div>

      {/* コンテンツ */}
      <div className="relative">
        {/* タイトル */}
        <h2
          className={`text-xl font-bold mb-4 font-mono tracking-wider line-clamp-2 pr-20 ${
            darkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {project.title || "UNTITLED_PROJECT"}
        </h2>

        {/* アイデア */}
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <Lightbulb
              className={`w-4 h-4 mr-2 ${
                darkMode ? "text-cyan-400" : "text-purple-600"
              }`}
            />
            <span
              className={`text-xs font-mono font-bold ${
                darkMode ? "text-cyan-400" : "text-purple-600"
              }`}
            >
              PROJECT_CONCEPT
            </span>
          </div>
          <p
            className={`text-sm leading-relaxed line-clamp-3 ${
              darkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {project.idea || "アイデアが設定されていません"}
          </p>
        </div>

        {/* フェーズ進行状況（新規） */}
        {project.current_phase && (
          <div
            className={`mb-4 p-3 rounded border backdrop-blur-md ${
              darkMode
                ? "bg-gray-800/40 border-gray-600/50"
                : "bg-gray-50/50 border-gray-300/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-mono ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                現在のフェーズ
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  darkMode ? "text-cyan-400" : "text-purple-600"
                }`}
              >
                {getPhaseLabel(project.current_phase)}
              </span>
            </div>
            {/* プログレスバー */}
            <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  darkMode ? "bg-cyan-400" : "bg-purple-600"
                }`}
                style={{
                  width: `${project.phase_progress_percentage || 0}%`,
                }}
              ></div>
            </div>
          </div>
        )}

        {/* プロジェクト情報グリッド */}
        <div className="grid grid-cols-2 gap-4">
          {/* 残り日数 */}
          <div
            className={`p-3 rounded border backdrop-blur-md ${
              darkMode
                ? "bg-gray-800/40 border-gray-600/50"
                : "bg-gray-50/50 border-gray-300/50"
            }`}
          >
            <div className="flex items-center mb-1">
              <Clock
                className={`w-3 h-3 mr-1 ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              />
              <span
                className={`text-xs font-mono ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {status === "完了"
                  ? "終了"
                  : status === "進行中"
                  ? "残り日数"
                  : "開始まで"}
              </span>
            </div>
            <span
              className={`text-sm font-mono font-bold ${
                status === "完了"
                  ? darkMode
                    ? "text-gray-500"
                    : "text-gray-600"
                  : status === "進行中"
                  ? darkMode
                    ? "text-blue-400"
                    : "text-blue-600"
                  : darkMode
                  ? "text-white"
                  : "text-gray-900"
              }`}
            >
              {status === "完了"
                ? "完了済み"
                : status === "進行中"
                ? `${calculateRemainingDays(project.end_date)}日`
                : `${Math.ceil(
                    (new Date(project.start_date).getTime() -
                      new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}日`}
            </span>
          </div>
        </div>

        {/* 日付 */}
        <div
          className={`mt-4 p-3 rounded border backdrop-blur-md ${
            darkMode
              ? "bg-gray-800/30 border-gray-600/30"
              : "bg-gray-50/30 border-gray-300/30"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs font-mono ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              開始日
            </span>
            <span
              className={`text-xs font-mono ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {formatDate(project.start_date)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-mono ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              終了日
            </span>
            <span
              className={`text-xs font-mono ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {formatDate(project.end_date)}
            </span>
          </div>
        </div>

        {/* アクションボタン（新規） */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* 続きから再開ボタン */}
          {project.current_phase && project.current_phase !== "task_management" && (
            <button
              onClick={handleResumeProject}
              className={`py-2 px-3 rounded border backdrop-blur-md transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 ${
                darkMode
                  ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400"
                  : "bg-purple-50 border-purple-500/50 text-purple-600 hover:bg-purple-100 hover:border-purple-600"
              }`}
              title="フェーズから再開"
            >
              <PlayCircle className="w-4 h-4" />
              <span className="text-xs font-mono">続きから</span>
            </button>
          )}

          {/* 削除ボタン */}
          <button
            onClick={(e) => onDelete(e, String(project.project_id), project.title)}
            className={`py-2 px-3 rounded border backdrop-blur-md transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-2 ${
              project.current_phase && project.current_phase !== "task_management"
                ? ""
                : "col-span-2"
            } ${
              darkMode
                ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-400"
                : "bg-red-50 border-red-500/50 text-red-600 hover:bg-red-100 hover:border-red-600"
            }`}
            title="プロジェクトを削除"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-mono">削除</span>
          </button>
        </div>
      </div>
    </div>
  );
};
```

#### 1.3.4 All Project ページの改修

**ファイル**: `/front/src/app/dashbord/allProject/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Lightbulb,
  Search,
  Plus,
  Filter,
  SortAsc,
  Users,
} from "lucide-react";
import { ProjectType } from "@/types/modelTypes";
import { getAllProjectsWithPhase, deleteProject } from "@/libs/modelAPI/project";
import { getMemberByGithubName } from "@/libs/modelAPI/member";
import { useDarkMode } from "@/hooks/useDarkMode";
import Header from "@/components/Session/Header";
import { ProjectCard } from "@/components/ProjectCard";

type SortOption = "date-desc" | "date-asc" | "title" | "progress";
type FilterOption = "all" | "in-progress" | "completed" | "preparing";

export default function AllProjectPage() {
  const router = useRouter();
  const { darkMode } = useDarkMode();
  const { data: session } = useSession();

  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");
  const [showOnlyMyProjects, setShowOnlyMyProjects] = useState(true); // デフォルトで自分のプロジェクトのみ
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  // 削除モーダル用のステート
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [confirmationText, setConfirmationText] = useState("");

  // 現在のログインユーザーのメンバーIDを取得
  useEffect(() => {
    const fetchCurrentMember = async () => {
      if (session?.user?.name) {
        try {
          const member = await getMemberByGithubName(session.user.name);
          setCurrentMemberId(member.member_id);
        } catch (error) {
          console.error("メンバー情報の取得エラー:", error);
        }
      }
    };
    fetchCurrentMember();
  }, [session]);

  // プロジェクト一覧を取得
  useEffect(() => {
    if (typeof window !== "undefined") {
      const fetchProjects = async () => {
        try {
          setLoading(true);
          const projects = await getAllProjectsWithPhase();

          // メンバーフィルタリング
          let filteredByMember = projects;
          if (showOnlyMyProjects && currentMemberId) {
            // TODO: プロジェクトメンバーテーブルからフィルタリング
            // 現在は全プロジェクトを表示（後で実装）
            filteredByMember = projects;
          }

          setAllProjects(filteredByMember);
          setFilteredProjects(filteredByMember);
        } catch (error) {
          console.error("プロジェクトの取得エラー:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchProjects();
    }
  }, [showOnlyMyProjects, currentMemberId]);

  // 検索、ソート、フィルタリング
  useEffect(() => {
    let result = [...allProjects];

    // 検索フィルタ
    if (searchTerm) {
      result = result.filter(
        (project) =>
          project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          project.idea.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // ステータスフィルタ
    if (filterOption !== "all") {
      result = result.filter((project) => {
        const status = getProjectStatus(project.start_date, project.end_date);
        if (filterOption === "in-progress") return status === "進行中";
        if (filterOption === "completed") return status === "完了";
        if (filterOption === "preparing") return status === "準備中";
        return true;
      });
    }

    // ソート
    result.sort((a, b) => {
      if (sortOption === "date-desc") {
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      } else if (sortOption === "date-asc") {
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      } else if (sortOption === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortOption === "progress") {
        return (b.phase_progress_percentage || 0) - (a.phase_progress_percentage || 0);
      }
      return 0;
    });

    setFilteredProjects(result);
  }, [searchTerm, sortOption, filterOption, allProjects]);

  const getProjectStatus = (startDate: string | Date, endDate: string | Date) => {
    if (!startDate || !endDate) return "未設定";
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return "準備中";
    if (now > end) return "完了";
    return "進行中";
  };

  const handleDeleteClick = (
    e: React.MouseEvent,
    projectId: string,
    projectTitle: string
  ) => {
    e.stopPropagation();
    setProjectToDelete({ id: projectId, title: projectTitle });
    setDeleteModalOpen(true);
    setConfirmationText("");
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete || confirmationText !== projectToDelete.title) {
      return;
    }

    try {
      await deleteProject(projectToDelete.id);
      const updatedProjects = await getAllProjectsWithPhase();
      setAllProjects(updatedProjects);
      setFilteredProjects(updatedProjects);
      setDeleteModalOpen(false);
      setProjectToDelete(null);
      setConfirmationText("");
    } catch (error) {
      console.error("プロジェクトの削除エラー:", error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setProjectToDelete(null);
    setConfirmationText("");
  };

  if (loading) {
    return (
      <>
        <Header />
        <div
          className={`min-h-screen flex items-center justify-center ${
            darkMode
              ? "bg-gradient-to-br from-gray-900 via-black to-gray-900"
              : "bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200"
          }`}
        >
          <div
            className={`relative px-8 py-6 rounded-lg backdrop-blur-xl border ${
              darkMode
                ? "bg-gray-800/30 border-cyan-500/40 text-cyan-400 shadow-cyan-500/30"
                : "bg-white/60 border-purple-300/30 text-purple-600"
            } shadow-2xl overflow-hidden`}
          >
            <div
              className={`absolute inset-0 ${
                darkMode
                  ? "bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"
                  : "bg-gradient-to-r from-transparent via-purple-400/10 to-transparent"
              } translate-x-[-100%] animate-pulse`}
            ></div>
            <div className="flex items-center space-x-4 relative">
              <div
                className={`animate-spin rounded-full h-6 w-6 border-2 ${
                  darkMode
                    ? "border-cyan-400 border-t-transparent"
                    : "border-purple-600 border-t-transparent"
                }`}
              ></div>
              <span className="text-lg font-mono font-bold tracking-wider">
                LOADING_PROJECTS...
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="w-full top-0 left-0 right-0 z-99 absolute">
        <Header />
      </div>

      <div
        className={`min-h-screen pt-24 p-6 ${
          darkMode
            ? "bg-gradient-to-br from-gray-900 via-black to-gray-900"
            : "bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200"
        }`}
      >
        <div className="container mx-auto max-w-7xl">
          {/* ヘッダー */}
          <div className="text-center mb-12">
            <div
              className={`inline-block px-4 py-2 rounded-lg font-mono text-sm mb-6 backdrop-blur-md ${
                darkMode
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-300/30"
              }`}
            >
              PROJECT_DATABASE_ACCESS
            </div>

            <h1
              className={`text-4xl md:text-5xl font-bold font-mono tracking-wider mb-4 ${
                darkMode
                  ? "text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                  : "text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600"
              }`}
            >
              ALL_PROJECTS_OVERVIEW
            </h1>

            <div className="flex items-center justify-center mb-8">
              <div
                className={`h-px w-16 ${darkMode ? "bg-cyan-500" : "bg-purple-500"}`}
              ></div>
              <div
                className={`mx-4 w-2 h-2 border ${
                  darkMode ? "border-cyan-500" : "border-purple-500"
                } rotate-45`}
              ></div>
              <div
                className={`h-px w-16 ${darkMode ? "bg-pink-500" : "bg-blue-500"}`}
              ></div>
            </div>
          </div>

          {/* コントロール */}
          <div className="flex flex-col gap-4 mb-8">
            {/* 検索バー */}
            <div className="flex-1 relative">
              <Search
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  darkMode ? "text-cyan-400" : "text-purple-600"
                }`}
              />
              <input
                type="text"
                placeholder="プロジェクトを検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-12 pr-4 py-3 rounded-lg font-mono text-sm backdrop-blur-xl border transition-all duration-300 ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 text-white placeholder-gray-400 focus:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                    : "bg-white/60 border-purple-300/30 text-gray-900 placeholder-gray-500 focus:border-purple-400/50"
                } shadow-lg focus:shadow-xl outline-none`}
              />
            </div>

            {/* フィルタ & ソート */}
            <div className="flex flex-wrap gap-4 items-center">
              {/* マイプロジェクトトグル */}
              <button
                onClick={() => setShowOnlyMyProjects(!showOnlyMyProjects)}
                className={`px-4 py-2 rounded-lg backdrop-blur-xl border transition-all ${
                  showOnlyMyProjects
                    ? darkMode
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                      : "bg-purple-500/20 border-purple-500/50 text-purple-600"
                    : darkMode
                    ? "bg-gray-800/30 border-gray-600/30 text-gray-400"
                    : "bg-white/60 border-gray-300/30 text-gray-600"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-mono">マイプロジェクト</span>
                </div>
              </button>

              {/* ステータスフィルタ */}
              <select
                value={filterOption}
                onChange={(e) => setFilterOption(e.target.value as FilterOption)}
                className={`px-4 py-2 rounded-lg backdrop-blur-xl border font-mono text-sm ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 text-white"
                    : "bg-white/60 border-purple-300/30 text-gray-900"
                }`}
              >
                <option value="all">全てのステータス</option>
                <option value="in-progress">進行中</option>
                <option value="completed">完了</option>
                <option value="preparing">準備中</option>
              </select>

              {/* ソートオプション */}
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className={`px-4 py-2 rounded-lg backdrop-blur-xl border font-mono text-sm ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 text-white"
                    : "bg-white/60 border-purple-300/30 text-gray-900"
                }`}
              >
                <option value="date-desc">日付（新しい順）</option>
                <option value="date-asc">日付（古い順）</option>
                <option value="title">タイトル順</option>
                <option value="progress">進捗順</option>
              </select>

              {/* 統計 */}
              <div className="flex items-center space-x-4 ml-auto">
                <div
                  className={`px-4 py-2 rounded-lg backdrop-blur-xl border ${
                    darkMode
                      ? "bg-gray-800/30 border-cyan-500/30 shadow-lg shadow-cyan-500/20"
                      : "bg-white/60 border-purple-300/30"
                  }`}
                >
                  <span
                    className={`text-sm font-mono ${
                      darkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    総数:
                  </span>
                  <span
                    className={`ml-2 font-bold font-mono ${
                      darkMode ? "text-cyan-400" : "text-purple-600"
                    }`}
                  >
                    {allProjects.length}
                  </span>
                </div>
                <div
                  className={`px-4 py-2 rounded-lg backdrop-blur-xl border ${
                    darkMode
                      ? "bg-gray-800/30 border-cyan-500/30 shadow-lg shadow-cyan-500/20"
                      : "bg-white/60 border-purple-300/30"
                  }`}
                >
                  <span
                    className={`text-sm font-mono ${
                      darkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    表示:
                  </span>
                  <span
                    className={`ml-2 font-bold font-mono ${
                      darkMode ? "text-cyan-400" : "text-purple-600"
                    }`}
                  >
                    {filteredProjects.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* プロジェクトグリッド */}
          {filteredProjects.length === 0 ? (
            <div
              className={`text-center p-12 rounded-lg backdrop-blur-xl border ${
                darkMode
                  ? "bg-gray-800/30 border-cyan-500/30 shadow-lg shadow-cyan-500/20"
                  : "bg-white/60 border-purple-300/30"
              }`}
            >
              <div
                className={`w-20 h-20 mx-auto mb-6 rounded-full border-2 flex items-center justify-center ${
                  darkMode
                    ? "border-cyan-500/50 text-cyan-400"
                    : "border-purple-500/50 text-purple-600"
                }`}
              >
                <Lightbulb className="w-10 h-10" />
              </div>
              <h3
                className={`text-2xl font-mono font-bold mb-3 ${
                  darkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {searchTerm ? "NO_SEARCH_RESULTS" : "NO_PROJECTS_FOUND"}
              </h3>
              <p
                className={`${
                  darkMode ? "text-gray-400" : "text-gray-500"
                } font-mono`}
              >
                {searchTerm
                  ? `// "${searchTerm}" に一致するプロジェクトが見つかりません`
                  : "// まだプロジェクトが登録されていません"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* 新規プロジェクト作成カード */}
              <div
                onClick={() => router.push("/hackSetUp")}
                className={`relative p-6 rounded-lg backdrop-blur-xl border transition-all duration-300 hover:scale-105 group overflow-hidden cursor-pointer ${
                  darkMode
                    ? "bg-gray-800/30 border-cyan-500/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                    : "bg-white/60 border-purple-300/30 hover:border-purple-400/50"
                } shadow-lg hover:shadow-2xl flex items-center justify-center min-h-[320px]`}
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-px ${
                    darkMode
                      ? "bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
                      : "bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
                  } translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000`}
                ></div>

                <div
                  className={`absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 ${
                    darkMode ? "border-cyan-400/50" : "border-purple-400/50"
                  } opacity-0 group-hover:opacity-100 transition-opacity`}
                ></div>
                <div
                  className={`absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 ${
                    darkMode ? "border-pink-400/50" : "border-blue-400/50"
                  } opacity-0 group-hover:opacity-100 transition-opacity`}
                ></div>

                <div className="text-center">
                  <div
                    className={`w-20 h-20 mx-auto mb-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      darkMode
                        ? "border-cyan-500/50 text-cyan-400 group-hover:border-cyan-400 group-hover:text-cyan-300"
                        : "border-purple-500/50 text-purple-600 group-hover:border-purple-600 group-hover:text-purple-700"
                    }`}
                  >
                    <Plus className="w-10 h-10" />
                  </div>
                  <h3
                    className={`text-xl font-mono font-bold ${
                      darkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    新規プロジェクト作成
                  </h3>
                  <p
                    className={`mt-2 text-sm font-mono ${
                      darkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    CREATE_NEW_PROJECT
                  </p>
                </div>
              </div>

              {/* 既存プロジェクト */}
              {filteredProjects.map((project, index) => (
                <ProjectCard
                  key={project.project_id}
                  project={project}
                  index={index}
                  darkMode={darkMode}
                  onDelete={handleDeleteClick}
                  userName={session?.user?.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 削除確認モーダル（既存のまま） */}
      {deleteModalOpen && projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* ... 既存のモーダルコード ... */}
        </div>
      )}
    </>
  );
}
```

---

## 2. チームメンバーフィルタリング機能

### 2.1 バックエンド拡張

上記の「メンバー別プロジェクト取得API」を実装済み。

### 2.2 フロントエンド実装

#### 2.2.1 プロジェクトメンバーAPI関数の作成

**ファイル**: `/front/src/libs/modelAPI/project_member.ts`

既存のファイルを確認し、必要に応じて以下を追加：

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface ProjectMemberType {
  project_member_id: string;
  project_id: string;
  member_id: string;
  member_name: string;
}

// プロジェクトIDからメンバー一覧を取得
export const getProjectMembersByProjectId = async (
  projectId: string
): Promise<ProjectMemberType[]> => {
  const response = await axios.get<ProjectMemberType[]>(
    `${API_URL}/project_member/project/${projectId}`
  );
  return response.data;
};

// メンバーIDからプロジェクト一覧を取得（逆引き）
export const getProjectsByMemberId = async (
  memberId: string
): Promise<ProjectMemberType[]> => {
  // バックエンドで該当のエンドポイントを作成する必要がある
  const response = await axios.get<ProjectMemberType[]>(
    `${API_URL}/project_member/member/${memberId}`
  );
  return response.data;
};
```

#### 2.2.2 バックエンドにメンバー逆引きエンドポイントを追加

**ファイル**: `/back/routers/project/project_member.py`

```python
# メンバーIDから参加しているプロジェクトメンバー情報を取得
@router.get("/project_member/member_projects/{member_id}", summary="メンバーIDから参加プロジェクト取得")
async def get_projects_by_member_id(member_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    指定されたメンバーが参加しているプロジェクトメンバー情報を取得
    """
    db_project_members = db.query(ProjectMember).filter(
        ProjectMember.member_id == member_id
    ).all()

    if not db_project_members:
        return []  # 404ではなく空配列を返す

    return db_project_members
```

#### 2.2.3 All Project ページでのメンバーフィルタリング実装

上記の `page.tsx` に既に組み込み済み。`showOnlyMyProjects` トグルを使用してフィルタリングします。

実際のフィルタリングロジックを完成させる：

```typescript
// プロジェクト一覧を取得（修正版）
useEffect(() => {
  if (typeof window !== "undefined") {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const allProjectsData = await getAllProjectsWithPhase();

        // メンバーフィルタリング
        if (showOnlyMyProjects && currentMemberId) {
          // メンバーが参加しているプロジェクトメンバー情報を取得
          const memberProjects = await getProjectsByMemberId(currentMemberId);
          const memberProjectIds = memberProjects.map((pm) => pm.project_id);

          // プロジェクトIDでフィルタリング
          const filtered = allProjectsData.filter((p) =>
            memberProjectIds.includes(p.project_id)
          );
          setAllProjects(filtered);
          setFilteredProjects(filtered);
        } else {
          setAllProjects(allProjectsData);
          setFilteredProjects(allProjectsData);
        }
      } catch (error) {
        console.error("プロジェクトの取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }
}, [showOnlyMyProjects, currentMemberId]);
```

---

## 3. 追加の便利機能

### 3.1 プロジェクト統計ダッシュボード

**ファイル**: `/front/src/components/ProjectStatistics.tsx` (新規作成)

```typescript
"use client";

import React from "react";
import { ProjectType } from "@/types/modelTypes";
import { TrendingUp, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface ProjectStatisticsProps {
  projects: ProjectType[];
  darkMode: boolean;
}

export const ProjectStatistics: React.FC<ProjectStatisticsProps> = ({
  projects,
  darkMode,
}) => {
  // 統計計算
  const totalProjects = projects.length;
  const inProgressCount = projects.filter((p) => {
    const status = getProjectStatus(p.start_date, p.end_date);
    return status === "進行中";
  }).length;

  const completedCount = projects.filter((p) => {
    const status = getProjectStatus(p.start_date, p.end_date);
    return status === "完了";
  }).length;

  const preparingCount = projects.filter((p) => {
    const status = getProjectStatus(p.start_date, p.end_date);
    return status === "準備中";
  }).length;

  const averageProgress =
    projects.reduce((sum, p) => sum + (p.phase_progress_percentage || 0), 0) /
    (totalProjects || 1);

  const getProjectStatus = (startDate: string | Date, endDate: string | Date) => {
    if (!startDate || !endDate) return "未設定";
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return "準備中";
    if (now > end) return "完了";
    return "進行中";
  };

  const stats = [
    {
      label: "進行中",
      value: inProgressCount,
      icon: TrendingUp,
      color: darkMode ? "text-green-400" : "text-green-600",
      bgColor: darkMode ? "bg-green-500/10" : "bg-green-50",
      borderColor: darkMode ? "border-green-500/50" : "border-green-500/30",
    },
    {
      label: "完了",
      value: completedCount,
      icon: CheckCircle,
      color: darkMode ? "text-blue-400" : "text-blue-600",
      bgColor: darkMode ? "bg-blue-500/10" : "bg-blue-50",
      borderColor: darkMode ? "border-blue-500/50" : "border-blue-500/30",
    },
    {
      label: "準備中",
      value: preparingCount,
      icon: Clock,
      color: darkMode ? "text-yellow-400" : "text-yellow-600",
      bgColor: darkMode ? "bg-yellow-500/10" : "bg-yellow-50",
      borderColor: darkMode ? "border-yellow-500/50" : "border-yellow-500/30",
    },
    {
      label: "平均進捗",
      value: `${Math.round(averageProgress)}%`,
      icon: AlertCircle,
      color: darkMode ? "text-purple-400" : "text-purple-600",
      bgColor: darkMode ? "bg-purple-500/10" : "bg-purple-50",
      borderColor: darkMode ? "border-purple-500/50" : "border-purple-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg backdrop-blur-xl border ${stat.bgColor} ${stat.borderColor} transition-all hover:scale-105`}
        >
          <div className="flex items-center justify-between mb-2">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <span
              className={`text-2xl font-bold font-mono ${stat.color}`}
            >
              {stat.value}
            </span>
          </div>
          <p
            className={`text-sm font-mono ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
};
```

### 3.2 クイックアクションメニュー

プロジェクトカードに右クリックメニューを追加：

- プロジェクト詳細へ移動
- フェーズから再開
- 編集
- 削除
- 共有リンクをコピー

### 3.3 プロジェクトテンプレート機能

よく使うプロジェクト設定をテンプレートとして保存・再利用できる機能。

### 3.4 エクスポート機能

プロジェクト一覧をCSV/JSONでエクスポート。

---

## 4. 実装手順

### Phase 1: バックエンド基盤構築

1. **フェーズ管理の完全実装**
   - `PHASE_MANAGEMENT_IMPLEMENTATION.md` に従ってフェーズ管理機能を実装
   - マイグレーションスクリプト実行
   - 既存のAIルーターにフェーズ更新ロジックを追加

2. **プロジェクト一覧APIの拡張**
   - `/projectsAll` エンドポイントをフェーズ情報含むように修正
   - メンバー別プロジェクト取得API追加
   - プロジェクトメンバー逆引きAPI追加

### Phase 2: フロントエンド基盤構築

3. **共通コンポーネント作成**
   - `ProjectCard.tsx` の作成
   - `PhaseProgress.tsx` の作成（既存）
   - `ProjectStatistics.tsx` の作成

4. **型定義とAPI関数の拡張**
   - `ProjectType` にフェーズ情報を追加
   - `project.ts` に新しいAPI関数を追加
   - `project_member.ts` にメンバー逆引き関数を追加

### Phase 3: All Project ページ改修

5. **メイン機能の実装**
   - フェーズリカバリー機能
   - チームメンバーフィルタリング
   - ソート・検索機能の強化

6. **UI/UX改善**
   - 統計ダッシュボードの追加
   - レスポンシブデザインの最適化
   - ローディング状態の改善

### Phase 4: テストとデバッグ

7. **動作確認**
   - 新規プロジェクト作成フロー
   - フェーズリカバリー機能
   - メンバーフィルタリング
   - 削除機能

8. **エッジケース対応**
   - フェーズ情報がないプロジェクト
   - メンバー情報がないユーザー
   - 権限のないプロジェクトへのアクセス

---

## 5. チェックリスト

### バックエンド

- [ ] `ProjectBase` モデルにフェーズカラムを追加（`PHASE_MANAGEMENT_IMPLEMENTATION.md`参照）
- [ ] マイグレーションスクリプト実行
- [ ] `/projectsAll` エンドポイントをフェーズ情報含むように修正
- [ ] `/projects/member/{member_id}` エンドポイント追加
- [ ] `/project_member/member_projects/{member_id}` エンドポイント追加
- [ ] 各AIルーターにフェーズ更新ロジック追加

### フロントエンド

- [ ] `ProjectType` 型にフェーズ情報を追加
- [ ] `getAllProjectsWithPhase` API関数作成
- [ ] `getProjectsByMemberId` API関数作成
- [ ] `ProjectCard` コンポーネント作成
- [ ] `ProjectStatistics` コンポーネント作成
- [ ] `page.tsx` でフェーズリカバリー機能実装
- [ ] `page.tsx` でメンバーフィルタリング実装
- [ ] ソート・フィルタリング機能の実装

### テスト

- [ ] 新規プロジェクト作成→フェーズ進行→All Projectページでの表示確認
- [ ] 「続きから」ボタンで正しいフェーズへ遷移することを確認
- [ ] マイプロジェクトトグルで自分のプロジェクトのみ表示されることを確認
- [ ] ソート・フィルタリング機能の動作確認
- [ ] プロジェクト削除機能の確認
- [ ] レスポンシブデザインの確認（モバイル・タブレット・デスクトップ）

---

## 6. 今後の拡張案

### 6.1 プロジェクトアーカイブ機能

完了したプロジェクトをアーカイブし、一覧から非表示にする。

### 6.2 プロジェクトタグ機能

プロジェクトにタグを付けて分類・検索を容易にする。

### 6.3 プロジェクトダッシュボード

各プロジェクトの進捗状況を一目で把握できるダッシュボード。

### 6.4 通知機能

プロジェクトの期限が近づいた時や、チームメンバーが更新した時に通知。

### 6.5 プロジェクトテンプレート

よく使うプロジェクト構成をテンプレート化し、新規作成時に選択可能にする。

---

## 7. 参考資料

### 関連ファイル

- **フェーズ管理実装計画**: `/workspaces/hackathon_support_agent/PHASE_MANAGEMENT_IMPLEMENTATION.md`
- **現在のAll Projectページ**: `/workspaces/hackathon_support_agent/front/src/app/dashbord/allProject/page.tsx:17`
- **プロジェクトAPI**: `/workspaces/hackathon_support_agent/front/src/libs/modelAPI/project.ts:1`
- **プロジェクトメンバーAPI**: `/workspaces/hackathon_support_agent/back/routers/project/project_member.py:1`
- **フェーズサービス**: `/workspaces/hackathon_support_agent/front/src/libs/service/phaseService.ts:1`
- **フェーズリカバリーフック**: `/workspaces/hackathon_support_agent/front/src/hooks/usePhaseRecovery.ts:1`

---

**作成日**: 2025-10-18
**最終更新**: 2025-10-18
**バージョン**: 1.0
