import time
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Optional
from langchain_core.tools import Tool
from langchain.schema import HumanMessage
from pydantic import BaseModel, Field
from .base_service import BaseService
import logging
import re

# Optional imports for web search tools
try:
    from langchain_google_community import GoogleSearchAPIWrapper
    GOOGLE_SEARCH_AVAILABLE = True
except ImportError:
    GOOGLE_SEARCH_AVAILABLE = False

try:
    from langchain_community.tools import DuckDuckGoSearchRun
    DUCKDUCKGO_SEARCH_AVAILABLE = True
except ImportError:
    DUCKDUCKGO_SEARCH_AVAILABLE = False

logger = logging.getLogger(__name__)

RATE_LIMIT_SEC = 0.5

class TaskItem(BaseModel):
    task_name: str
    priority: str  # "Must", "Should", "Could"
    content: str
    detail: Optional[str] = None

class TechnologyReference(BaseModel):
    """技術参照情報"""
    name: str = Field(description="技術・ライブラリ名")
    official_url: str = Field(description="公式サイトURL")
    documentation_url: str = Field(description="ドキュメントURL")
    tutorial_url: str = Field(description="チュートリアル・入門ガイドURL")
    why_needed: str = Field(description="なぜこの技術が必要かの説明")
    key_concepts: List[str] = Field(description="重要な概念・用語")

class EnhancedTaskDetail(BaseModel):
    """拡張タスク詳細"""
    task_name: str
    priority: str
    content: str
    detail: str = Field(description="詳細実装指針（マークダウン形式）")
    technologies_used: List[TechnologyReference] = Field(description="使用技術の参照情報")
    learning_resources: List[str] = Field(description="学習リソースURL")
    dependency_explanation: str = Field(description="依存関係の説明")
    educational_notes: str = Field(description="教育的な解説")

class TaskDetailService(BaseService):
    def __init__(self, db):
        super().__init__(db)
        self.setup_search_tools()
        self.setup_agent()

    def setup_search_tools(self):
        """検索ツールのセットアップ"""
        self.search_tools = []

        # Google検索ツール（API キーがある場合）
        if GOOGLE_SEARCH_AVAILABLE and os.getenv("GOOGLE_API_KEY") and os.getenv("GOOGLE_CSE_ID"):
            try:
                google_search = GoogleSearchAPIWrapper(
                    google_api_key=os.getenv("GOOGLE_API_KEY"),
                    google_cse_id=os.getenv("GOOGLE_CSE_ID"),
                    k=5
                )
                google_tool = Tool(
                    name="google_search",
                    description="Google検索を実行して最新の技術情報、公式ドキュメント、チュートリアルを検索する",
                    func=google_search.run,
                )
                self.search_tools.append(google_tool)
                logger.info("Google Search tool initialized")
            except Exception as e:
                logger.warning("Google Search tool failed to initialize: %s", e)

        # DuckDuckGo検索ツール（フォールバック）
        if DUCKDUCKGO_SEARCH_AVAILABLE:
            try:
                ddg_search = DuckDuckGoSearchRun()
                ddg_tool = Tool(
                    name="duckduckgo_search",
                    description="DuckDuckGo検索を使用して技術情報、公式ドキュメント、チュートリアルを検索する",
                    func=ddg_search.run,
                )
                self.search_tools.append(ddg_tool)
                logger.info("DuckDuckGo Search tool initialized")
            except Exception as e:
                logger.warning("DuckDuckGo Search tool failed to initialize: %s", e)

        # 技術リサーチツール
        self.search_tools.append(Tool(
            name="technology_research",
            description="特定の技術・ライブラリの公式ドキュメント、チュートリアル、ベストプラクティスを調査する",
            func=self.research_technology,
        ))

        if not self.search_tools:
            logger.warning("No search tools available - continuing with limited functionality")

    def setup_agent(self):
        """LangChainエージェントのセットアップ"""
        try:
            # 簡単な設定でエージェント初期化を完了
            logger.info("Agent setup completed successfully")
        except Exception as e:
            logger.error("Agent setup failed: %s", e)

    def research_technology(self, technology_name: str) -> str:
        """技術の詳細研究"""
        try:
            # 検索クエリの構築
            queries = [
                f"{technology_name} official documentation",
                f"{technology_name} tutorial getting started",
                f"{technology_name} best practices guide",
                f"why use {technology_name} benefits"
            ]

            results = []
            for query in queries:
                for tool in self.search_tools:
                    if tool.name in ["google_search", "duckduckgo_search"]:
                        try:
                            result = tool.func(query)
                            if result:
                                results.append(f"Query: {query}\nResult: {result}\n")
                                break
                        except Exception as e:
                            logger.warning("Search failed for %s: %s", query, e)
                            continue

                if len(results) >= 3:  # 制限
                    break

            return "\n".join(results) if results else f"No search results found for {technology_name}"

        except Exception as e:
            logger.error("Technology research failed: %s", e)
            return f"Research failed for {technology_name}: {str(e)}"

    def extract_technologies_from_task(self, task: Dict, specification: str) -> List[str]:
        """タスクから使用技術を抽出"""
        technologies = []

        # 仕様書から技術スタックを抽出
        common_techs = [
            "React", "Vue.js", "Next.js", "Angular", "Node.js", "Express",
            "FastAPI", "Django", "Flask", "PostgreSQL", "MySQL", "MongoDB",
            "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Vercel", "Netlify",
            "TypeScript", "JavaScript", "Python", "Java", "Go", "Rust",
            "Redis", "Elasticsearch", "GraphQL", "REST API", "WebSocket",
            "Jest", "Cypress", "pytest", "JUnit", "Selenium"
        ]

        task_text = f"{task.get('task_name', '')} {task.get('content', '')} {specification}"

        for tech in common_techs:
            if tech.lower() in task_text.lower():
                technologies.append(tech)

        return technologies

    def generate_enhanced_task_detail(self, task: Dict, specification: str) -> EnhancedTaskDetail:
        """拡張タスク詳細の生成"""
        try:
            # 使用技術の抽出
            technologies = self.extract_technologies_from_task(task, specification)

            # 各技術のリサーチ
            tech_references = []
            for tech in technologies[:3]:  # 最大3つに制限
                research_result = self.research_technology(tech)
                tech_ref = self.parse_research_result(tech, research_result)
                tech_references.append(tech_ref)

            # 詳細タスク情報の生成
            detail_prompt = self.create_detail_generation_prompt(task, specification, tech_references)

            llm_response = self.llm_flash.invoke([HumanMessage(content=detail_prompt)])
            detail_content = llm_response.content if hasattr(llm_response, "content") else str(llm_response)

            # 学習リソースの抽出
            learning_resources = self.extract_learning_resources(detail_content, tech_references)

            return EnhancedTaskDetail(
                task_name=task.get("task_name", ""),
                priority=task.get("priority", "Should"),
                content=task.get("content", ""),
                detail=detail_content,
                technologies_used=tech_references,
                learning_resources=learning_resources,
                dependency_explanation=self.generate_dependency_explanation(task, specification),
                educational_notes=self.generate_educational_notes(task, tech_references)
            )

        except Exception as e:
            logger.error("Enhanced task detail generation failed: %s", e)
            return EnhancedTaskDetail(
                task_name=task.get("task_name", ""),
                priority=task.get("priority", "Should"),
                content=task.get("content", ""),
                detail=f"タスク詳細の生成に失敗しました: {str(e)}",
                technologies_used=[],
                learning_resources=[],
                dependency_explanation="依存関係の分析に失敗しました",
                educational_notes="教育的解説の生成に失敗しました"
            )

    def parse_research_result(self, tech_name: str, research_result: str) -> TechnologyReference:
        """リサーチ結果から技術参照情報を解析"""
        try:
            # URLの抽出
            url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
            urls = re.findall(url_pattern, research_result)

            official_url = ""
            doc_url = ""
            tutorial_url = ""

            for url in urls:
                if any(domain in url for domain in [".org", ".io", "github.com", "docs."]):
                    if not official_url:
                        official_url = url
                    elif "docs" in url or "documentation" in url:
                        doc_url = url
                    elif "tutorial" in url or "getting-started" in url:
                        tutorial_url = url

            # デフォルトURLの設定
            if not official_url:
                official_url = f"https://www.google.com/search?q={tech_name}+official+site"
            if not doc_url:
                doc_url = f"https://www.google.com/search?q={tech_name}+documentation"
            if not tutorial_url:
                tutorial_url = f"https://www.google.com/search?q={tech_name}+tutorial"

            return TechnologyReference(
                name=tech_name,
                official_url=official_url,
                documentation_url=doc_url,
                tutorial_url=tutorial_url,
                why_needed=f"{tech_name}は{self.extract_why_needed(research_result, tech_name)}",
                key_concepts=self.extract_key_concepts(research_result, tech_name)
            )

        except Exception as e:
            logger.error("Parse research result failed: %s", e)
            return TechnologyReference(
                name=tech_name,
                official_url=f"https://www.google.com/search?q={tech_name}",
                documentation_url=f"https://www.google.com/search?q={tech_name}+docs",
                tutorial_url=f"https://www.google.com/search?q={tech_name}+tutorial",
                why_needed=f"{tech_name}の使用理由の取得に失敗しました",
                key_concepts=[]
            )

    def extract_why_needed(self, research_result: str, tech_name: str) -> str:
        """なぜその技術が必要かを抽出"""
        # 簡単なキーワードベースの抽出
        benefits_keywords = ["benefit", "advantage", "feature", "用途", "利点", "特徴"]
        lines = research_result.split('\n')

        for line in lines:
            if any(keyword in line.lower() for keyword in benefits_keywords):
                return line.strip()[:200]  # 200文字まで

        return f"効率的な開発とパフォーマンス向上のために使用されます"

    def extract_key_concepts(self, research_result: str, tech_name: str) -> List[str]:
        """重要な概念を抽出"""
        # 一般的な技術概念
        common_concepts = {
            "React": ["コンポーネント", "State", "Props", "Hook", "JSX"],
            "Node.js": ["イベントループ", "非同期処理", "npm", "モジュール"],
            "FastAPI": ["依存性注入", "Pydantic", "OpenAPI", "async/await"],
            "PostgreSQL": ["ACID", "トランザクション", "インデックス", "SQL"],
            "Docker": ["コンテナ", "イメージ", "Dockerfile", "ボリューム"]
        }

        return common_concepts.get(tech_name, ["基本概念", "設定", "実装", "テスト"])

    def create_detail_generation_prompt(self, task: Dict, specification: str, tech_refs: List[TechnologyReference]) -> str:
        """詳細生成用プロンプトの作成"""
        tech_info = "\n".join([
            f"- {tech.name}: {tech.why_needed}\n  公式: {tech.official_url}\n  ドキュメント: {tech.documentation_url}"
            for tech in tech_refs
        ])

        return f"""
        あなたはハッカソン初心者向けの教育的タスクガイド作成エキスパートです。

        以下のタスクについて、初心者が理解しやすい詳細な実装指針をマークダウン形式で作成してください：

        ## タスク情報
        - タスク名: {task.get('task_name', '')}
        - 優先度: {task.get('priority', '')}
        - 概要: {task.get('content', '')}

        ## プロジェクト仕様
        {specification[:500]}...

        ## 使用技術
        {tech_info}

        ## 出力要件
        1. **なぜこのタスクが必要か**を明確に説明
        2. **ステップバイステップの手順**（コマンド含む）
        3. **重要なポイントと注意事項**
        4. **動作確認方法**
        5. **よくある問題と解決方法**

        マークダウン形式で詳細に記述してください。コードは最小限にして、理解重視で作成してください。
        """

    def extract_learning_resources(self, detail_content: str, tech_refs: List[TechnologyReference]) -> List[str]:
        """学習リソースの抽出"""
        resources = []

        # 技術参照からURL追加
        for tech in tech_refs:
            resources.extend([tech.official_url, tech.documentation_url, tech.tutorial_url])

        # 詳細コンテンツからURL抽出
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        content_urls = re.findall(url_pattern, detail_content)
        resources.extend(content_urls)

        return list(set(resources))[:10]  # 重複除去、最大10個

    def generate_dependency_explanation(self, task: Dict, specification: str) -> str:
        """依存関係説明の生成"""
        return f"このタスク「{task.get('task_name', '')}」は、プロジェクトの仕様に基づいて実装される必要があります。他のタスクとの依存関係については、プロジェクト全体の進行状況を確認してください。"

    def generate_educational_notes(self, task: Dict, tech_refs: List[TechnologyReference]) -> str:
        """教育的解説の生成"""
        tech_names = [tech.name for tech in tech_refs]
        if tech_names:
            return f"このタスクでは{', '.join(tech_names)}の技術を活用します。各技術の公式ドキュメントを参照し、基本概念を理解してから実装に取り組むことをお勧めします。"
        else:
            return "このタスクでは基本的な技術を活用します。関連するドキュメントを参照し、基本概念を理解してから実装に取り組むことをお勧めします。"

    def generate_task_details_batch(self, specification: str, tasks: List[Dict]) -> List[Dict]:
        """
        複数タスクをまとめて拡張詳細生成
        """
        try:
            results = []
            for task in tasks:
                enhanced_detail = self.generate_enhanced_task_detail(task, specification)

                # 辞書形式に変換
                task_result = {
                    "task_name": enhanced_detail.task_name,
                    "priority": enhanced_detail.priority,
                    "content": enhanced_detail.content,
                    "detail": enhanced_detail.detail,
                    "technologies_used": [tech.model_dump() for tech in enhanced_detail.technologies_used],
                    "learning_resources": enhanced_detail.learning_resources,
                    "dependency_explanation": enhanced_detail.dependency_explanation,
                    "educational_notes": enhanced_detail.educational_notes
                }
                results.append(task_result)

                time.sleep(RATE_LIMIT_SEC)  # レート制限

            return results

        except Exception as e:
            logger.error("バッチ詳細生成失敗: %s", e, exc_info=True)
            return [{**t, "detail": f"詳細生成失敗: {e}"} for t in tasks]

    def generate_task_details_parallel(
        self,
        tasks: List[Dict],
        specification: str,
        batch_size: int = 2,  # 検索APIの制限を考慮して減らす
        max_workers: int = 3
    ) -> List[Dict]:
        """並列タスク詳細生成（検索API制限を考慮）"""
        batches = [tasks[i:i + batch_size] for i in range(0, len(tasks), batch_size)]
        results: List[Dict] = []
        with ThreadPoolExecutor(max_workers=min(max_workers, len(batches))) as exe:
            futures = {
                exe.submit(self.generate_task_details_batch, specification, b): b for b in batches}
            for future in as_completed(futures):
                try:
                    results.extend(future.result())
                except Exception as e:
                    logger.error("並列バッチ呼び出し失敗: %s", e, exc_info=True)
                    for t in futures[future]:
                        results.append({**t, "detail": "並列処理失敗"})
        return results