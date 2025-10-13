"""
DocumentFetchTool: URL からドキュメントを取得してパースするツール

Phase 3: タスクハンズオン生成のための公式ドキュメント取得
"""

from typing import Optional, Dict
import requests
from bs4 import BeautifulSoup
import html2text
from urllib.parse import urlparse


class DocumentFetchTool:
    """
    URL からドキュメントを取得し、Markdown 形式で返すツール

    公式ドキュメントやブログ記事を取得して、読みやすいテキストに変換します。
    """

    def __init__(self, timeout: int = 30, max_content_length: int = 100000):
        """
        初期化

        Args:
            timeout: HTTPリクエストのタイムアウト（秒）
            max_content_length: 最大コンテンツ長（文字数）
        """
        self.timeout = timeout
        self.max_content_length = max_content_length

        # HTML to Markdown コンバーター
        self.html_converter = html2text.HTML2Text()
        self.html_converter.ignore_links = False
        self.html_converter.ignore_images = True
        self.html_converter.ignore_emphasis = False
        self.html_converter.body_width = 0  # 改行を無効化（元のフォーマット維持）

    def fetch(
        self,
        url: str,
        extract_main_content: bool = True,
        include_metadata: bool = True
    ) -> Dict:
        """
        URL からドキュメントを取得

        Args:
            url: 取得するURL
            extract_main_content: メインコンテンツのみを抽出するか
            include_metadata: メタデータ（タイトル、説明など）を含めるか

        Returns:
            {
                "url": "https://example.com",
                "title": "ページタイトル",
                "description": "メタディスクリプション",
                "content": "Markdown形式のコンテンツ",
                "content_length": 12345,
                "domain": "example.com",
                "is_truncated": False
            }

        Raises:
            requests.exceptions.RequestException: HTTP取得エラー
            ValueError: 不正なURL
        """
        # URL検証
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            raise ValueError(f"Invalid URL: {url}")

        try:
            # HTTP GET リクエスト
            response = requests.get(
                url,
                timeout=self.timeout,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (compatible; TaskHandsOnBot/1.0; "
                        "+https://github.com/hackathon-support-agent)"
                    )
                },
                allow_redirects=True
            )
            response.raise_for_status()

            # Content-Type チェック
            content_type = response.headers.get("Content-Type", "")
            if "text/html" not in content_type.lower():
                raise ValueError(
                    f"URL does not return HTML content (Content-Type: {content_type})"
                )

            # HTMLパース
            soup = BeautifulSoup(response.content, "html.parser")

            # メタデータ取得
            metadata = {}
            if include_metadata:
                metadata = self._extract_metadata(soup)

            # コンテンツ抽出
            if extract_main_content:
                content_html = self._extract_main_content(soup)
            else:
                content_html = soup

            # Markdown変換
            content_markdown = self.html_converter.handle(str(content_html))

            # 長すぎる場合は切り詰め
            is_truncated = False
            if len(content_markdown) > self.max_content_length:
                content_markdown = content_markdown[:self.max_content_length]
                content_markdown += "\n\n... (content truncated)"
                is_truncated = True

            return {
                "url": url,
                "title": metadata.get("title", ""),
                "description": metadata.get("description", ""),
                "content": content_markdown,
                "content_length": len(content_markdown),
                "domain": parsed_url.netloc,
                "is_truncated": is_truncated
            }

        except requests.exceptions.Timeout:
            raise requests.exceptions.RequestException(
                f"Request timed out after {self.timeout} seconds: {url}"
            )
        except requests.exceptions.HTTPError as e:
            raise requests.exceptions.RequestException(
                f"HTTP error {response.status_code}: {url}"
            )
        except Exception as e:
            raise requests.exceptions.RequestException(
                f"Failed to fetch document from {url}: {e}"
            )

    def _extract_metadata(self, soup: BeautifulSoup) -> Dict:
        """
        HTMLからメタデータを抽出

        Args:
            soup: BeautifulSoup オブジェクト

        Returns:
            メタデータの辞書
        """
        metadata = {}

        # タイトル
        title_tag = soup.find("title")
        if title_tag:
            metadata["title"] = title_tag.get_text(strip=True)

        # メタディスクリプション
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            metadata["description"] = meta_desc["content"]

        # OGPタイトル（OpenGraph Protocol）
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            metadata["og_title"] = og_title["content"]

        # OGP説明
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            metadata["og_description"] = og_desc["content"]

        return metadata

    def _extract_main_content(self, soup: BeautifulSoup) -> BeautifulSoup:
        """
        HTMLからメインコンテンツのみを抽出

        ヘッダー、フッター、ナビゲーション、広告などを除去します。

        Args:
            soup: BeautifulSoup オブジェクト

        Returns:
            メインコンテンツのBeautifulSoup
        """
        # 不要な要素を削除
        unwanted_tags = [
            "script", "style", "nav", "header", "footer",
            "aside", "iframe", "noscript"
        ]
        for tag in unwanted_tags:
            for element in soup.find_all(tag):
                element.decompose()

        # クラス名・IDで不要な要素を削除
        unwanted_selectors = [
            {"class": "advertisement"},
            {"class": "ad"},
            {"class": "sidebar"},
            {"class": "navigation"},
            {"class": "menu"},
            {"id": "comments"},
            {"id": "footer"},
            {"id": "header"},
        ]
        for selector in unwanted_selectors:
            for element in soup.find_all(attrs=selector):
                element.decompose()

        # メインコンテンツを探す
        main_content = (
            soup.find("main") or
            soup.find("article") or
            soup.find("div", class_="content") or
            soup.find("div", id="content") or
            soup.find("div", class_="main") or
            soup.find("div", id="main") or
            soup.find("body")
        )

        return main_content if main_content else soup

    def fetch_multiple(
        self,
        urls: list[str],
        extract_main_content: bool = True
    ) -> list[Dict]:
        """
        複数のURLからドキュメントを取得

        Args:
            urls: URLのリスト
            extract_main_content: メインコンテンツのみを抽出するか

        Returns:
            各URLの取得結果のリスト（エラーの場合はerrorキーを含む）

        Example:
            >>> tool = DocumentFetchTool()
            >>> results = tool.fetch_multiple([
            ...     "https://nextjs.org/docs/authentication",
            ...     "https://docs.python.org/3/library/asyncio.html"
            ... ])
        """
        results = []

        for url in urls:
            try:
                result = self.fetch(
                    url,
                    extract_main_content=extract_main_content
                )
                results.append(result)
            except Exception as e:
                results.append({
                    "url": url,
                    "error": str(e),
                    "success": False
                })

        return results

    def fetch_as_text(self, url: str, max_length: int = 5000) -> str:
        """
        URLからテキストのみを取得（LLMプロンプト用の簡易版）

        Args:
            url: 取得するURL
            max_length: 最大文字数

        Returns:
            テキストコンテンツ（Markdown形式）

        Example:
            >>> tool = DocumentFetchTool()
            >>> text = tool.fetch_as_text("https://fastapi.tiangolo.com/")
            >>> print(text[:200])
        """
        result = self.fetch(url, extract_main_content=True, include_metadata=False)
        content = result["content"]

        if len(content) > max_length:
            content = content[:max_length] + "\n\n... (truncated)"

        return content


# LangChain互換のツール定義
def create_langchain_tool():
    """
    LangChain で使用可能なツールを作成

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

    fetch_tool = DocumentFetchTool()

    def fetch_wrapper(url: str) -> str:
        """ドキュメント取得ラッパー（文字列を返す）"""
        try:
            result = fetch_tool.fetch(url, extract_main_content=True)

            output = f"Title: {result['title']}\n\n"
            output += f"URL: {result['url']}\n\n"
            output += f"Content ({result['content_length']} characters):\n\n"
            output += result['content'][:5000]  # 最大5000文字

            if result['is_truncated']:
                output += "\n\n... (content truncated)"

            return output

        except Exception as e:
            return f"Error fetching document: {e}"

    return Tool(
        name="fetch_document",
        description=(
            "Fetch and parse a document from a URL. "
            "Converts HTML to readable Markdown format. "
            "Input should be a valid URL string. "
            "Useful for retrieving official documentation, "
            "blog posts, tutorials, and technical articles."
        ),
        func=fetch_wrapper
    )


if __name__ == "__main__":
    # 動作確認用サンプルコード
    import json

    tool = DocumentFetchTool()

    # 基本的な取得
    print("=== ドキュメント取得 ===")
    try:
        result = tool.fetch("https://fastapi.tiangolo.com/")
        print(f"Title: {result['title']}")
        print(f"Domain: {result['domain']}")
        print(f"Content Length: {result['content_length']}")
        print(f"Content Preview:\n{result['content'][:500]}...")
    except Exception as e:
        print(f"Error: {e}")

    # 複数URL取得
    print("\n=== 複数URL取得 ===")
    urls = [
        "https://docs.python.org/3/library/asyncio.html",
        "https://nextjs.org/docs/authentication"
    ]
    results = tool.fetch_multiple(urls)
    print(json.dumps(
        [{"url": r.get("url"), "title": r.get("title")} for r in results],
        indent=2,
        ensure_ascii=False
    ))
