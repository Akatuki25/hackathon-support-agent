"""
TaskHandsOnExecutor: 情報収集計画を実行する

Phase 2: Plan-and-Execute パターンの Executor
"""

import asyncio
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from services.task_hands_on_schemas import InformationPlan
from services.tools.hands_on_search_tool import HandsOnSearchTool
from services.tools.use_case_tool import UseCaseTool
from services.tools.document_fetch_tool import DocumentFetchTool
from services.base_service import BaseService


class InformationExecutor:
    """情報収集計画を並列実行するExecutor"""

    def __init__(self, db: Session, project_id: str, current_task_id: str):
        self.db = db
        self.project_id = project_id
        self.current_task_id = current_task_id

        # ツールの初期化
        self.hands_on_search = HandsOnSearchTool(db, project_id, current_task_id)
        self.use_case_tool = UseCaseTool(db, project_id)
        self.doc_fetch_tool = DocumentFetchTool()

        # BaseService を初期化（Google Search grounding 用）
        self.base_service = BaseService(db)

    async def execute_plan(self, plan: InformationPlan) -> Dict[str, Any]:
        """
        計画を並列実行して情報を収集

        Args:
            plan: Plannerが作成した情報収集計画

        Returns:
            収集した情報の辞書
        """
        tasks = []

        # 1. 依存タスクの情報取得
        if plan.needs_dependencies:
            tasks.append(self._get_dependency_info(plan.dependency_search_keywords))
        else:
            tasks.append(self._return_none("dependency_info"))

        # 2. ユースケース/仕様書取得
        if plan.needs_use_case:
            tasks.append(
                self._get_use_case_info(plan.use_case_category)
            )
        else:
            tasks.append(self._return_none("use_case_info"))

        # 3. Web検索 (現在は未実装、将来的に追加可能)
        if plan.web_search_queries:
            tasks.append(self._web_search(plan.web_search_queries))
        else:
            tasks.append(self._return_none("web_search_results"))

        # 4. ドキュメント取得 (現在は未実装、将来的に追加可能)
        if plan.document_urls:
            tasks.append(self._fetch_documents(plan.document_urls))
        else:
            tasks.append(self._return_none("document_contents"))

        # 並列実行
        results = await asyncio.gather(*tasks)

        # 結果を統合
        collected_info = {
            "dependency_info": results[0],
            "use_case_info": results[1],
            "web_search_results": results[2],
            "document_contents": results[3],
        }

        return collected_info

    async def _get_dependency_info(
        self, keywords: List[str]
    ) -> Dict[str, Any]:
        """依存タスクの情報を取得"""

        # 1. 依存関係にあるタスクのハンズオンを取得
        dependency_hands_on = await asyncio.to_thread(
            self.hands_on_search.get_dependency_hands_on
        )

        # 2. キーワード検索で関連タスクを取得
        search_results = []
        for keyword in keywords[:3]:  # 最大3キーワード
            results = await asyncio.to_thread(
                self.hands_on_search.search, keyword, max_results=2
            )
            search_results.extend(results)

        # 重複削除 (タスクタイトルで判定)
        seen_titles = set()
        unique_results = []
        for result in search_results:
            title = result.get("task_title")
            if title not in seen_titles:
                seen_titles.add(title)
                unique_results.append(result)

        return {
            "direct_dependencies": dependency_hands_on,
            "related_tasks": unique_results[:5],  # 最大5件
        }

    async def _get_use_case_info(
        self, category: str | None
    ) -> str:
        """ユースケース/仕様書情報を取得"""

        flow = await asyncio.to_thread(
            self.use_case_tool.get_flow, category
        )
        return flow

    async def _web_search(self, queries: List[str]) -> List[Dict[str, Any]]:
        """
        Gemini Google Search Grounding を使用してWeb検索を実行

        Args:
            queries: 検索クエリのリスト

        Returns:
            検索結果のリスト
            [{"query": "...", "title": "...", "url": "...", "snippet": "...", "content": "..."}, ...]
        """
        results = []

        for query in queries[:3]:  # 最大3クエリ
            try:
                # Google Search Grounding を使用
                search_prompt = f"""
以下の技術トピックについて、最新かつ正確な情報を検索して回答してください。
公式ドキュメントやベストプラクティスを優先してください。

検索トピック: {query}

回答は簡潔に、重要なポイントを箇条書きで説明してください。
"""
                response_text, reference_urls = await asyncio.to_thread(
                    self.base_service.invoke_with_search,
                    search_prompt
                )

                # 検索結果を整形
                for url_info in reference_urls:
                    results.append({
                        "query": query,
                        "title": url_info.get("title", query),
                        "url": url_info.get("url", ""),
                        "snippet": url_info.get("snippet", ""),
                        "content": response_text[:500] if not results else "",  # 最初の結果のみコンテンツを含める
                        "source": "gemini_grounding"
                    })

                # URLが取得できなかった場合でも、レスポンス内容は保存
                if not reference_urls and response_text:
                    results.append({
                        "query": query,
                        "title": query,
                        "url": "",
                        "snippet": response_text[:200],
                        "content": response_text[:500],
                        "source": "gemini_grounding_no_url"
                    })

            except Exception as e:
                # エラー時はスキップ
                print(f"[_web_search] Error for query '{query}': {e}")
                continue

        return results

    async def _fetch_documents(self, urls: List[str]) -> List[Dict[str, Any]]:
        """
        指定されたURLからドキュメントを取得

        Args:
            urls: 取得するドキュメントのURLリスト

        Returns:
            ドキュメント情報のリスト
            [{"url": "...", "title": "...", "content": "...", "domain": "..."}, ...]
        """
        results = []

        for url in urls[:3]:  # 最大3URL
            try:
                # DocumentFetchTool を使用してドキュメントを取得
                doc = await asyncio.to_thread(
                    self.doc_fetch_tool.fetch, url
                )

                if doc.get("success", True):
                    results.append({
                        "url": url,
                        "title": doc.get("title", ""),
                        "content": doc.get("content", "")[:2000],  # 最大2000文字
                        "domain": doc.get("domain", ""),
                        "description": doc.get("description", ""),
                        "success": True
                    })
                else:
                    results.append({
                        "url": url,
                        "title": "",
                        "content": "",
                        "error": doc.get("error", "Unknown error"),
                        "success": False
                    })

            except Exception as e:
                # エラー時はエラー情報を記録
                print(f"[_fetch_documents] Error for URL '{url}': {e}")
                results.append({
                    "url": url,
                    "title": "",
                    "content": "",
                    "error": str(e),
                    "success": False
                })

        return results

    async def _return_none(self, key: str) -> None:
        """何もしない (プレースホルダー)"""
        return None

    def format_collected_info(self, collected_info: Dict[str, Any]) -> str:
        """
        収集した情報をプロンプト用に整形

        Args:
            collected_info: execute_plan() の結果

        Returns:
            整形された情報文字列
        """
        sections = []

        # 1. 依存タスク情報
        dep_info = collected_info.get("dependency_info")
        if dep_info:
            sections.append("## 依存タスクの実装情報\n")

            # 直接的な依存関係
            direct_deps = dep_info.get("direct_dependencies", [])
            if direct_deps:
                sections.append("### 前提タスク\n")
                for i, dep in enumerate(direct_deps, 1):
                    sections.append(
                        f"{i}. **{dep['task_title']}**\n"
                        f"   - 前提条件: {dep['prerequisites']}\n"
                        f"   - 実装ファイル: {', '.join([f.get('path', '') for f in dep['target_files'][:3]])}\n"
                        f"   - コード例:\n```\n{dep['code_example'][:300]}\n```\n"
                    )

            # 関連タスク
            related = dep_info.get("related_tasks", [])
            if related:
                sections.append("\n### 関連する実装例\n")
                for i, task in enumerate(related, 1):
                    sections.append(
                        f"{i}. **{task['task_title']}** ({task['task_category']})\n"
                        f"   - {task['overview'][:200]}\n"
                        f"   - ファイル: {', '.join(task['target_files'][:2])}\n"
                    )

        # 2. ユースケース/仕様書
        use_case = collected_info.get("use_case_info")
        if use_case:
            sections.append("\n## プロジェクト仕様書\n")
            sections.append(use_case)

        # 3. Web検索結果
        web_results = collected_info.get("web_search_results")
        if web_results:
            sections.append("\n## 技術情報 (Web検索)\n")
            for result in web_results:
                url = result.get('url', '')
                title = result.get('title', result.get('query', 'Unknown'))
                snippet = result.get('snippet', '')
                content = result.get('content', '')

                if url:
                    sections.append(f"### [{title}]({url})\n")
                else:
                    sections.append(f"### {title}\n")

                if snippet:
                    sections.append(f"{snippet}\n\n")
                elif content:
                    sections.append(f"{content[:300]}...\n\n")

        # 4. 公式ドキュメント
        docs = collected_info.get("document_contents")
        if docs:
            sections.append("\n## 公式ドキュメント\n")
            for doc in docs:
                if not doc.get("success", True):
                    continue  # 取得失敗したドキュメントはスキップ

                url = doc.get('url', '')
                title = doc.get('title', url)
                content = doc.get('content', '')
                description = doc.get('description', '')

                if url:
                    sections.append(f"### [{title}]({url})\n")
                else:
                    sections.append(f"### {title}\n")

                if description:
                    sections.append(f"*{description}*\n\n")

                if content:
                    sections.append(f"{content[:500]}...\n\n")

        return "\n".join(sections) if sections else "特に参照情報はありません。"
