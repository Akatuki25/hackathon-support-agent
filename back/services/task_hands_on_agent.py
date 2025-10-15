"""
TaskHandsOnAgent: WebSearch統合型ReActエージェント

Phase 3: タスク単位で高品質なハンズオンを生成するエージェント
"""

from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from datetime import datetime, date
import json
import os
from pydantic import BaseModel, Field

from models.project_base import Task, TaskHandsOn, ProjectBase
from services.tools.web_search_tool import WebSearchTool
from services.tools.document_fetch_tool import DocumentFetchTool

# LangChain imports
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain.tools import Tool
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain_core.messages import HumanMessage


# Pydantic models for structured output
class TargetFile(BaseModel):
    path: str = Field(description="ファイルパス")
    action: str = Field(description="create または modify")
    description: str = Field(description="ファイルの説明")


class CodeExample(BaseModel):
    file: str = Field(description="ファイル名")
    language: str = Field(description="プログラミング言語")
    code: str = Field(description="コード全文")
    explanation: str = Field(description="コードの説明")


class CommonError(BaseModel):
    error: str = Field(description="エラーメッセージ")
    cause: str = Field(description="エラーの原因")
    solution: str = Field(description="解決方法")


class Reference(BaseModel):
    title: str = Field(description="参考資料のタイトル")
    url: str = Field(description="URL")
    type: str = Field(description="docs/tutorial/article")
    relevance: str = Field(description="この資料がなぜ役立つか")


class ImplementationTip(BaseModel):
    type: str = Field(description="best_practice/anti_pattern/gotcha")
    tip: str = Field(description="実装時のポイント")
    reason: str = Field(description="なぜこれが重要か")


class TaskHandsOnOutput(BaseModel):
    """ハンズオン生成の出力スキーマ"""
    overview: str = Field(description="タスクの概要を200-300文字で")
    prerequisites: str = Field(description="前提条件・必要な知識")
    target_files: List[TargetFile] = Field(description="対象ファイルのリスト")
    implementation_steps: str = Field(description="実装手順をMarkdown形式で")
    code_examples: List[CodeExample] = Field(description="コード例のリスト")
    verification: str = Field(description="動作確認方法")
    common_errors: List[CommonError] = Field(description="よくあるエラーのリスト")
    references: List[Reference] = Field(description="参考資料のリスト")
    technical_context: str = Field(description="技術的背景")
    implementation_tips: List[ImplementationTip] = Field(description="実装のヒント")


class TaskHandsOnAgent:
    """
    WebSearch統合型ReActエージェント
    タスク単位で高品質なハンズオンを生成
    """

    def __init__(
        self,
        db: Session,
        task: Task,
        project_context: Dict,
        config: Optional[Dict] = None
    ):
        """
        初期化

        Args:
            db: データベースセッション
            task: 対象タスク
            project_context: プロジェクトコンテキスト
                {
                    "project_id": "uuid",
                    "title": "プロジェクト名",
                    "tech_stack": "Next.js 15, PostgreSQL, ...",
                    "specification": "...",
                    "framework_info": "...",
                    ...
                }
            config: 生成設定
                {
                    "enable_web_search": True,
                    "verification_level": "medium",
                    "model": "gemini-2.0-flash-exp"
                }
        """
        self.db = db
        self.task = task
        self.project_context = project_context
        self.config = config or {}

        # LLMの初期化（JSON mode有効化）
        model_name = self.config.get("model", "gemini-2.0-flash-exp")
        self.llm = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=0.3,
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            max_output_tokens=16000  # 出力トークン数を増やす
        )

        # ツールの初期化
        # WebSearchToolはTAVILY_API_KEYがある場合のみ初期化
        tavily_api_key = os.getenv("TAVILY_API_KEY")
        if tavily_api_key and self.config.get("enable_web_search", True):
            self.web_search_tool = WebSearchTool(api_key=tavily_api_key)
        else:
            self.web_search_tool = None

        self.document_fetch_tool = DocumentFetchTool()

        # ReActエージェントの構築
        self.agent_executor = self._build_react_agent()

    def _build_react_agent(self) -> AgentExecutor:
        """
        ReActエージェントを構築

        Returns:
            AgentExecutor
        """
        # ツール定義
        tools = [
            Tool(
                name="web_search",
                description=(
                    "Search the web for the latest technical documentation, "
                    "official guides, code examples, and best practices. "
                    "Input should be a search query string. "
                    "Useful for finding up-to-date information about technologies, "
                    "libraries, frameworks, and implementation patterns."
                ),
                func=self._web_search_wrapper
            ),
            Tool(
                name="fetch_document",
                description=(
                    "Fetch and parse a document from a URL. "
                    "Converts HTML to readable Markdown format. "
                    "Input should be a valid URL string. "
                    "Useful for retrieving official documentation, "
                    "blog posts, tutorials, and technical articles."
                ),
                func=self._fetch_document_wrapper
            ),
        ]

        # プロンプトテンプレート
        prompt = PromptTemplate(
            template="""あなたはシニアエンジニアです。以下のタスクの詳細なハンズオンを作成してください。

## タスク情報
タイトル: {task_title}
説明: {task_description}
カテゴリ: {task_category}
優先度: {task_priority}

## プロジェクトコンテキスト
技術スタック: {tech_stack}
プロジェクト概要: {project_summary}

## 利用可能なツール
{tools}

ツール名: {tool_names}

## 重要: 出力形式の指示

あなたは必ずReActフォーマットで応答してください。以下の形式に厳密に従ってください：

Thought: [現在の状況と次に何をすべきか考える]
Action: [使用するツール名]
Action Input: [ツールへの入力]
Observation: [ツールの出力結果がここに表示されます]
... (必要に応じてThought/Action/Action Input/Observationを繰り返す)
Thought: [十分な情報を収集できた。最終的な回答を出す]
Final Answer: [最終的な回答をここに書く]

## 最終的な回答（Final Answer）の形式

Final Answerには、以下のJSON形式の内容を含めてください：

{{
  "overview": "タスクの概要（何を実装するか、なぜ必要か）",
  "prerequisites": "前提条件（必要なパッケージ、事前タスク、環境設定）",
  "target_files": [
    {{"path": "ファイルパス", "action": "create/modify", "description": "説明"}}
  ],
  "implementation_steps": "ステップバイステップの実装手順（Markdown形式）",
  "code_examples": [
    {{
      "file": "ファイル名",
      "language": "言語",
      "code": "実際のコード",
      "explanation": "コードの説明"
    }}
  ],
  "verification": "動作確認方法・期待される結果",
  "common_errors": [
    {{
      "error": "エラー内容",
      "cause": "原因",
      "solution": "解決方法"
    }}
  ],
  "references": [
    {{
      "title": "タイトル",
      "url": "URL",
      "type": "docs/article",
      "relevance": "関連性の説明"
    }}
  ],
  "technical_context": "このタスクで使う技術・概念の簡潔な説明",
  "implementation_tips": [
    {{
      "type": "best_practice/anti_pattern",
      "tip": "ポイント",
      "reason": "理由"
    }}
  ],
  "search_queries": ["実行した検索クエリのリスト"],
  "referenced_urls": ["参照したURLのリスト"]
}}

## JSON出力の重要な注意事項
1. **文字列値内の改行**: 必ず \\n でエスケープ
   - 正しい例: "step 1\\nstep 2"
   - 誤り例: "step 1
step 2"

2. **implementation_stepsやcode内の改行**: 全て \\n に置換
   - 例: "### Step 1\\n\\nコード:\\n```python\\ndef hello():\\n    pass\\n```"

3. **ダブルクォート**: 文字列値内では \\" でエスケープ

4. **バックスラッシュ**: \\\\ でエスケープ（ただし\\nは例外）

## タスクの実行手順
1. タスクの技術スタック（使用ライブラリ・フレームワーク）を特定
2. web_searchで最新のベストプラクティス・公式ドキュメントを検索
3. fetch_documentで詳細情報を取得
4. 収集した情報を基に、初心者でも理解できる実装手順を作成
5. 実際に動作するコード例を含める
6. よくあるエラーとその解決方法を記載

それでは、タスク「{task_title}」のハンズオンを作成してください。

{agent_scratchpad}""",
            input_variables=[
                "task_title",
                "task_description",
                "task_category",
                "task_priority",
                "tech_stack",
                "project_summary",
                "tools",
                "tool_names",
                "agent_scratchpad"
            ]
        )

        # ReActエージェント作成
        agent = create_react_agent(
            llm=self.llm,
            tools=tools,
            prompt=prompt
        )

        # AgentExecutor作成
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            max_iterations=10,
            handle_parsing_errors=True
        )

        return agent_executor

    def _web_search_wrapper(self, query: str) -> str:
        """Web検索ラッパー"""
        try:
            if not self.web_search_tool:
                return "Web search is not available (TAVILY_API_KEY not configured)."

            if not self.config.get("enable_web_search", True):
                return "Web search is disabled in config."

            results = self.web_search_tool.search(query, max_results=5)

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

        except Exception as e:
            return f"Error during web search: {str(e)}"

    def _fetch_document_wrapper(self, url: str) -> str:
        """ドキュメント取得ラッパー"""
        try:
            result = self.document_fetch_tool.fetch(url, extract_main_content=True)

            output = f"Title: {result['title']}\n\n"
            output += f"URL: {result['url']}\n\n"
            output += f"Content ({result['content_length']} characters):\n\n"
            output += result['content'][:5000]  # 最大5000文字

            if result['is_truncated']:
                output += "\n\n... (content truncated)"

            return output

        except Exception as e:
            return f"Error fetching document: {str(e)}"

    def generate_hands_on(self) -> TaskHandsOn:
        """
        ハンズオン生成のメイン処理

        Returns:
            TaskHandsOn オブジェクト
        """
        print(f"[TaskHandsOnAgent] ハンズオン生成開始: {self.task.title}")

        # エージェント実行
        agent_input = {
            "task_title": self.task.title,
            "task_description": self.task.description or "説明なし",
            "task_category": self.task.category or "未分類",
            "task_priority": self.task.priority or "Must",
            "tech_stack": self.project_context.get("tech_stack", "不明"),
            "project_summary": self.project_context.get("specification", "")[:500],
        }

        try:
            result = self.agent_executor.invoke(agent_input)
            final_answer = result.get("output", "{}")

            # JSONパース
            hands_on_data = self._parse_agent_output(final_answer)

            # 品質評価
            quality_score = self._evaluate_quality(hands_on_data)

            # 情報鮮度（参照URLから推定）
            freshness = self._extract_information_freshness(hands_on_data)

            # TaskHandsOnオブジェクト作成
            hands_on = TaskHandsOn(
                task_id=self.task.task_id,
                overview=hands_on_data.get("overview"),
                prerequisites=hands_on_data.get("prerequisites"),
                target_files=hands_on_data.get("target_files"),
                implementation_steps=hands_on_data.get("implementation_steps"),
                code_examples=hands_on_data.get("code_examples"),
                verification=hands_on_data.get("verification"),
                common_errors=hands_on_data.get("common_errors"),
                references=hands_on_data.get("references"),
                technical_context=hands_on_data.get("technical_context"),
                implementation_tips=hands_on_data.get("implementation_tips"),
                quality_score=quality_score,
                generation_model=self.config.get("model", "gemini-2.0-flash-exp"),
                search_queries=hands_on_data.get("search_queries"),
                referenced_urls=hands_on_data.get("referenced_urls"),
                information_freshness=freshness,
            )

            print(f"[TaskHandsOnAgent] ハンズオン生成完了 (品質スコア: {quality_score:.2f})")

            return hands_on

        except Exception as e:
            print(f"[TaskHandsOnAgent] エラー: {str(e)}")
            raise

    def _parse_agent_output(self, output: str) -> Dict:
        """
        エージェント出力をパース

        Args:
            output: エージェントの出力文字列

        Returns:
            パースされた辞書
        """
        try:
            # JSON部分を抽出（```json ... ``` の形式にも対応）
            import re
            from json_repair import repair_json

            print(f"[TaskHandsOnAgent] パース開始 - 出力長: {len(output)} 文字")
            print(f"[TaskHandsOnAgent] 出力の最初の200文字: {output[:200]}")

            # マークダウンコードブロックを除去
            # 最初の```jsonから最後の```までを抽出（途中にコードブロックがあっても対応）
            if output.strip().startswith('```json'):
                # ```jsonで始まる場合、最初の```jsonを除去し、最後の```を除去
                json_str = output.strip()[7:]  # '```json' の7文字を除去
                if json_str.rstrip().endswith('```'):
                    json_str = json_str.rstrip()[:-3]  # 最後の '```' を除去
                json_str = json_str.strip()
                print(f"[TaskHandsOnAgent] ```jsonブロックを検出して除去 - 抽出後の長さ: {len(json_str)}")
            else:
                # Final Answer: の後のJSONを抽出
                final_answer_match = re.search(r'Final Answer:\s*(.+)', output, re.DOTALL)
                if final_answer_match:
                    json_str = final_answer_match.group(1).strip()
                    print(f"[TaskHandsOnAgent] 'Final Answer:'の後を抽出 - 長さ: {len(json_str)}")
                else:
                    json_str = output
                    print(f"[TaskHandsOnAgent] そのまま使用")

            print(f"[TaskHandsOnAgent] パース対象JSONの最初の300文字: {json_str[:300]}")

            # まず通常のJSONパースを試行
            try:
                data = json.loads(json_str)
                print(f"[TaskHandsOnAgent] ✅ 通常のJSONパース成功 - キー: {list(data.keys())}")
                return data
            except json.JSONDecodeError as e:
                # json-repairで修復を試みる
                print(f"[TaskHandsOnAgent] JSONパース失敗 ({e})、json-repairで修復を試みます...")
                repaired_json = repair_json(json_str)
                print(f"[TaskHandsOnAgent] 修復後のJSONの最初の300文字: {repaired_json[:300]}")
                data = json.loads(repaired_json)
                print(f"[TaskHandsOnAgent] ✅ 修復後パース成功 - キー: {list(data.keys())}")
                return data

        except Exception as e:
            print(f"[TaskHandsOnAgent] ❌ JSON パースエラー: {e}")
            print(f"出力の最初の500文字: {output[:500]}...")
            print(f"出力の最後の500文字: {output[-500:] if len(output) > 500 else output}")

            # パースエラーを上位に伝播（Celeryタスク側で再生成する）
            raise ValueError(f"JSON parse failed: {e}") from e

    def _evaluate_quality(self, hands_on_data: Dict) -> float:
        """
        ハンズオンの品質を評価

        Args:
            hands_on_data: ハンズオンデータ

        Returns:
            品質スコア（0.0-1.0）
        """
        score = 0.0
        total_checks = 8

        # チェック1: overview が存在するか（重要度: 高）
        if hands_on_data.get("overview") and len(hands_on_data["overview"]) > 50:
            score += 0.15

        # チェック2: implementation_steps が存在するか（重要度: 最高）
        if hands_on_data.get("implementation_steps") and len(hands_on_data["implementation_steps"]) > 100:
            score += 0.25

        # チェック3: code_examples が存在するか（重要度: 高）
        if hands_on_data.get("code_examples") and len(hands_on_data["code_examples"]) > 0:
            score += 0.20

        # チェック4: verification が存在するか（重要度: 中）
        if hands_on_data.get("verification") and len(hands_on_data["verification"]) > 30:
            score += 0.10

        # チェック5: common_errors が存在するか（重要度: 中）
        if hands_on_data.get("common_errors") and len(hands_on_data["common_errors"]) > 0:
            score += 0.10

        # チェック6: references が存在するか（重要度: 中）
        if hands_on_data.get("references") and len(hands_on_data["references"]) > 0:
            score += 0.10

        # チェック7: technical_context が存在するか（重要度: 低）
        if hands_on_data.get("technical_context") and len(hands_on_data["technical_context"]) > 30:
            score += 0.05

        # チェック8: implementation_tips が存在するか（重要度: 低）
        if hands_on_data.get("implementation_tips") and len(hands_on_data["implementation_tips"]) > 0:
            score += 0.05

        return round(score, 2)

    def _extract_information_freshness(self, hands_on_data: Dict) -> Optional[date]:
        """
        参照URLから情報鮮度を推定

        Args:
            hands_on_data: ハンズオンデータ

        Returns:
            情報の最新日付（推定）
        """
        # 現時点では現在日付を返す（将来的にURLから日付を抽出）
        return datetime.now().date()


if __name__ == "__main__":
    # 動作確認用サンプルコード
    from database import get_db

    db = next(get_db())

    # サンプルタスク取得
    task = db.query(Task).first()
    if not task:
        print("タスクが見つかりません")
        exit(1)

    # プロジェクトコンテキスト構築
    project = db.query(ProjectBase).filter_by(project_id=task.project_id).first()
    project_context = {
        "project_id": str(project.project_id),
        "title": project.title,
        "tech_stack": "Next.js 15, FastAPI, PostgreSQL",
        "specification": "ハッカソンサポートエージェント",
    }

    # エージェント実行
    agent = TaskHandsOnAgent(
        db=db,
        task=task,
        project_context=project_context,
        config={"enable_web_search": True, "model": "gemini-2.0-flash-exp"}
    )

    hands_on = agent.generate_hands_on()

    print("\n=== 生成されたハンズオン ===")
    print(f"概要: {hands_on.overview}")
    print(f"品質スコア: {hands_on.quality_score}")
    print(f"検索クエリ: {hands_on.search_queries}")
