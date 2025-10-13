"""
WebSearchTool: Tavily API を使用した Web 検索ツール

Phase 3: タスクハンズオン生成のための最新情報検索
"""

from typing import List, Dict, Optional
import os
import requests
from datetime import datetime


class WebSearchTool:
    """
    Tavily API を使用した Web 検索ツール

    最新の技術ドキュメント、公式ガイド、ベストプラクティスを検索します。
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        初期化

        Args:
            api_key: Tavily API キー（未指定の場合は環境変数から取得）
        """
        self.api_key = api_key or os.getenv("TAVILY_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Tavily API key is required. "
                "Set TAVILY_API_KEY environment variable or pass api_key parameter."
            )

        self.base_url = "https://api.tavily.com/search"
        self.default_max_results = 5

    def search(
        self,
        query: str,
        max_results: int = 5,
        search_depth: str = "advanced",
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None,
        include_raw_content: bool = False
    ) -> List[Dict]:
        """
        Web検索を実行

        Args:
            query: 検索クエリ
            max_results: 最大取得結果数（デフォルト: 5）
            search_depth: 検索の深さ ("basic" or "advanced")
            include_domains: 含めるドメインのリスト（例: ["python.org", "docs.python.org"]）
            exclude_domains: 除外するドメインのリスト
            include_raw_content: 生のHTMLコンテンツを含めるか

        Returns:
            検索結果のリスト
            [
                {
                    "title": "記事タイトル",
                    "url": "https://example.com",
                    "content": "記事の要約",
                    "score": 0.95,
                    "published_date": "2025-01-15",
                    "raw_content": "..." (include_raw_content=Trueの場合)
                },
                ...
            ]

        Raises:
            requests.exceptions.RequestException: API呼び出しエラー
            ValueError: 不正なパラメータ
        """
        if not query or not query.strip():
            raise ValueError("Search query cannot be empty")

        if search_depth not in ["basic", "advanced"]:
            raise ValueError("search_depth must be 'basic' or 'advanced'")

        # リクエストペイロード構築
        payload = {
            "api_key": self.api_key,
            "query": query,
            "max_results": max_results,
            "search_depth": search_depth,
            "include_raw_content": include_raw_content,
        }

        if include_domains:
            payload["include_domains"] = include_domains

        if exclude_domains:
            payload["exclude_domains"] = exclude_domains

        try:
            response = requests.post(
                self.base_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()

            result = response.json()

            # 結果を整形
            formatted_results = self._format_results(result.get("results", []))

            return formatted_results

        except requests.exceptions.Timeout:
            raise requests.exceptions.RequestException(
                "Tavily API request timed out (30 seconds)"
            )
        except requests.exceptions.HTTPError as e:
            if response.status_code == 401:
                raise ValueError("Invalid Tavily API key")
            elif response.status_code == 429:
                raise requests.exceptions.RequestException(
                    "Tavily API rate limit exceeded"
                )
            else:
                raise requests.exceptions.RequestException(
                    f"Tavily API error: {e}"
                )
        except Exception as e:
            raise requests.exceptions.RequestException(
                f"Unexpected error during Tavily API call: {e}"
            )

    def _format_results(self, raw_results: List[Dict]) -> List[Dict]:
        """
        Tavily API の結果を統一フォーマットに整形

        Args:
            raw_results: Tavily API からの生の結果

        Returns:
            整形された結果
        """
        formatted = []

        for result in raw_results:
            formatted_result = {
                "title": result.get("title", "No Title"),
                "url": result.get("url", ""),
                "content": result.get("content", "")[:500],  # 最大500文字
                "score": result.get("score", 0.0),
                "published_date": result.get("published_date"),
            }

            # raw_content が含まれている場合は追加
            if "raw_content" in result:
                formatted_result["raw_content"] = result["raw_content"]

            formatted.append(formatted_result)

        return formatted

    def search_technical_docs(
        self,
        technology: str,
        topic: str,
        year: Optional[int] = None
    ) -> List[Dict]:
        """
        技術ドキュメント特化の検索

        Args:
            technology: 技術名（例: "Next.js", "FastAPI", "PostgreSQL"）
            topic: トピック（例: "authentication", "database connection"）
            year: 年指定（最新情報を取得したい場合）

        Returns:
            検索結果のリスト

        Example:
            >>> tool = WebSearchTool()
            >>> results = tool.search_technical_docs(
            ...     technology="Next.js",
            ...     topic="authentication",
            ...     year=2025
            ... )
        """
        year_str = f" {year}" if year else ""
        query = f"{technology} {topic} official documentation best practices{year_str}"

        # 公式ドキュメントを優先
        official_domains = self._get_official_domains(technology)

        return self.search(
            query=query,
            max_results=5,
            search_depth="advanced",
            include_domains=official_domains if official_domains else None
        )

    def _get_official_domains(self, technology: str) -> Optional[List[str]]:
        """
        技術名から公式ドキュメントのドメインを取得

        Args:
            technology: 技術名

        Returns:
            公式ドメインのリスト（見つからない場合はNone）
        """
        official_domains_map = {
            "next.js": ["nextjs.org"],
            "react": ["react.dev", "reactjs.org"],
            "fastapi": ["fastapi.tiangolo.com"],
            "django": ["docs.djangoproject.com"],
            "flask": ["flask.palletsprojects.com"],
            "postgresql": ["postgresql.org"],
            "redis": ["redis.io"],
            "python": ["docs.python.org", "python.org"],
            "typescript": ["typescriptlang.org"],
            "node.js": ["nodejs.org"],
            "tailwind": ["tailwindcss.com"],
            "langchain": ["python.langchain.com"],
            "celery": ["docs.celeryq.dev"],
        }

        tech_lower = technology.lower().replace(" ", "").replace(".", "")

        for key, domains in official_domains_map.items():
            if tech_lower in key or key in tech_lower:
                return domains

        return None

    def search_code_examples(
        self,
        technology: str,
        task_description: str
    ) -> List[Dict]:
        """
        コード例特化の検索

        Args:
            technology: 技術スタック（例: "Next.js + PostgreSQL"）
            task_description: タスクの説明

        Returns:
            コード例を含む検索結果

        Example:
            >>> tool = WebSearchTool()
            >>> results = tool.search_code_examples(
            ...     technology="FastAPI + SQLAlchemy",
            ...     task_description="user authentication with JWT"
            ... )
        """
        query = f"{technology} {task_description} code example tutorial"

        return self.search(
            query=query,
            max_results=5,
            search_depth="advanced"
        )

    def search_troubleshooting(
        self,
        technology: str,
        error_message: str
    ) -> List[Dict]:
        """
        トラブルシューティング特化の検索

        Args:
            technology: 技術名
            error_message: エラーメッセージ

        Returns:
            トラブルシューティング情報を含む検索結果

        Example:
            >>> tool = WebSearchTool()
            >>> results = tool.search_troubleshooting(
            ...     technology="PostgreSQL",
            ...     error_message="connection refused"
            ... )
        """
        query = f"{technology} error {error_message} solution fix"

        # Stack Overflow などの技術Q&Aサイトを優先
        tech_qa_domains = [
            "stackoverflow.com",
            "github.com",
            "reddit.com"
        ]

        return self.search(
            query=query,
            max_results=5,
            search_depth="advanced",
            include_domains=tech_qa_domains
        )


# LangChain互換のツール定義
def create_langchain_tool(api_key: Optional[str] = None):
    """
    LangChain で使用可能なツールを作成

    Args:
        api_key: Tavily API キー

    Returns:
        LangChain Tool オブジェクト

    Example:
        >>> from langchain.agents import initialize_agent
        >>> tool = create_langchain_tool()
        >>> agent = initialize_agent([tool], llm, agent="zero-shot-react-description")
    """
    try:
        from langchain.tools import Tool
    except ImportError:
        raise ImportError(
            "langchain is not installed. "
            "Install it with: pip install langchain"
        )

    search_tool = WebSearchTool(api_key=api_key)

    def search_wrapper(query: str) -> str:
        """検索ラッパー（文字列を返す）"""
        results = search_tool.search(query, max_results=5)

        # 結果を文字列形式で整形
        formatted_output = []
        for i, result in enumerate(results, 1):
            formatted_output.append(
                f"{i}. {result['title']}\n"
                f"   URL: {result['url']}\n"
                f"   Summary: {result['content'][:200]}...\n"
                f"   Relevance: {result['score']:.2f}\n"
            )

        return "\n".join(formatted_output) if formatted_output else "No results found."

    return Tool(
        name="web_search",
        description=(
            "Search the web for the latest technical documentation, "
            "official guides, code examples, and best practices. "
            "Input should be a search query string. "
            "Useful for finding up-to-date information about technologies, "
            "libraries, frameworks, and implementation patterns."
        ),
        func=search_wrapper
    )


if __name__ == "__main__":
    # 動作確認用サンプルコード
    import json

    # APIキーを環境変数から取得（または直接指定）
    # export TAVILY_API_KEY="tvly-..."

    try:
        tool = WebSearchTool()

        # 基本的な検索
        print("=== 基本検索 ===")
        results = tool.search("Next.js 15 authentication best practices 2025")
        print(json.dumps(results, indent=2, ensure_ascii=False))

        # 技術ドキュメント検索
        print("\n=== 技術ドキュメント検索 ===")
        results = tool.search_technical_docs(
            technology="FastAPI",
            topic="JWT authentication",
            year=2025
        )
        print(json.dumps(results, indent=2, ensure_ascii=False))

        # コード例検索
        print("\n=== コード例検索 ===")
        results = tool.search_code_examples(
            technology="PostgreSQL + SQLAlchemy",
            task_description="connection pooling"
        )
        print(json.dumps(results, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"Error: {e}")
