import time
import json
import textwrap
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from pydantic import BaseModel
from .base_service import BaseService
import logging

from json_repair import repair_json  # 追加
from copy import deepcopy      # 追加

logger = logging.getLogger(__name__)

RATE_LIMIT_SEC = 0.5  # 呼び出し間隔（秒）

class TaskItem(BaseModel):
    task_name: str
    priority: str  # "Must", "Should", "Could"
    content: str

class TaskDetailService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_task_details_batch(self, specification: str, tasks: List[Dict]) -> List[Dict]:
        """
        複数タスクをまとめてLLMに投げ、
        生の文字列を json_repair で補正してからパースします。
        """
        # スキーマとパーサの定義
        response_schema = ResponseSchema(
            name="tasks",
            description="複数タスクに detail を追加した配列",
            type="array(objects)"
        )
        parser = StructuredOutputParser.from_response_schemas([response_schema])

        # プロンプト
        template = textwrap.dedent("""
            あなたはタスク詳細化のエキスパートです。以下のタスクリストについて、各タスクに対して具体的なハンズオンの手順を「detail」として生成してください。
            detailは、タスクの内容をさらに具体化したもので、この形式を必ず守ってください。
            具体的なハンズオンは、詳細な手順やコマンド、コードの記述などを含めてください。
            また、マークダウン形式でこれを見るだけでこのタスクを完了できるほどの詳細さで出力してください。
            ただし、コードに関しては最小限の記述で十分です。ある程度は読者の自力で考えられるようにしてください。
            ユーザーはハッカソンに参加する初心者です。
            重要: 応答は必ず有効なJSONである必要があります。特殊文字（バックスラッシュ、引用符など）は適切にエスケープしてください。Markdownのコードブロック内でも引用符とバックスラッシュには特に注意が必要です。
            以下の制約を厳密に守ってください:
            1. 出力は単純な構造を持つ必要があります: "tasks"キーの配列のみです
            2. 各タスクには task_name, priority, content, detail フィールドのみを含めてください
            3. 改行は文字列内で "\\n" としてエスケープしてください
            4. コードブロックを含める場合は、Markdown記法の ```の代わりに "```" とエスケープしてください
            5. JSON文字列として有効であることを優先し、必要に応じて内容を簡略化してください
            JSON の例:
            {format_instructions}
            
            仕様書(全体内のタスクの位置を把握するのに参考にしてください):
            {specification}

            入力は以下の形式のタスク情報です:
            {tasks_input}
        """)
        prompt = ChatPromptTemplate.from_template(
            template=template,
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        try:
            # LLM呼び出しして生の応答を取得
            llm_response = (prompt | self.llm_flash).invoke({
                "tasks_input": tasks,
                "specification": specification
                })
            raw = llm_response.content if hasattr(llm_response, "content") else str(llm_response)
            logger.debug("Raw LLM output: %s", raw)

            # JSON修復
            repaired = repair_json(raw)
            logger.debug("Repaired JSON: %s", repaired)

            # 修復した文字列をパーサーにかける
            parsed = parser.parse(repaired)
            logger.debug("Parsed result: %s", parsed)

            return parsed["tasks"]

        except Exception as e:
            logger.error("バッチ呼び出し失敗: %s", e, exc_info=True)
            # フォールバック
            return [{**t, "detail": f"バッチ呼び出し失敗: {e}"} for t in tasks]
        finally:
            time.sleep(RATE_LIMIT_SEC)

    def generate_task_details_parallel(
        self,
        tasks: List[Dict],
        specification: str,
        batch_size: int = 3,
        max_workers: int = 5
    ) -> List[Dict]:
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
                        results.append({**t, "detail": "バッチ呼び出し失敗"})
        return results