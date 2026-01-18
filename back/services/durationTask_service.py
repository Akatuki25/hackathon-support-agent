from langchain_core.prompts import ChatPromptTemplate
from langchain_classic.output_parsers import ResponseSchema, StructuredOutputParser
from .base_service import BaseService
from typing import List, Dict
import json

class DurationTaskService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_task_durations(self, duration: str, tasks: List[Dict]) -> List[Dict]:
        """
        入力のプロジェクト全期間 (duration: 日数) と各タスク（task_id, task_name, content を含む）
        をもとに、各タスクの作業期間（開始日、終了日）を算出し、ガントチャート作成用の情報を返します。
        
        出力例（JSON形式）:
        {
          "durations": [
            {"task_id": 0, "start": 1, "end": 5},
            {"task_id": 1, "start": 2, "end": 4},
            {"task_id": 2, "start": 3, "end": 6},
            ...
          ]
        }
        """
        # 出力JSON形式内の波括弧は、テンプレートエンジンに変数として解釈されないようダブルブラケットでエスケープ
        response_schemas = [
            ResponseSchema(
                name="durations",
                description=(
                    "各タスクの期間は以下の形式のオブジェクトです。"
                    "例: {{\"durations\": [{{\"task_id\": 0, \"start\": 1, \"end\": 5}}, "
                    "{{\"task_id\": 1, \"start\": 2, \"end\": 4}}, ...]}}"
                    "※ 出力は必ずJSON形式にしてください。"
                ),
                type="object(array(objects))"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("duration_task_service", "generate_task_durations"),
        )
        # tasks_input: タスク情報リストをJSON形式（見やすい整形付き）に変換
        tasks_input = json.dumps(tasks, ensure_ascii=False, indent=2)
        
        # chain.invoke に渡すパラメータとして duration と tasks_input をセット
        chain = prompt_template | self.llm_pro | parser
        result = chain.invoke({"duration": duration, "tasks_input": tasks_input})
        # result が {"durations": [...]} の形式となることを期待
        return result.get("durations", [])

if __name__ == '__main__':
    # 簡易テスト用サンプル
    tasks = [
        {
            "task_id": 0,
            "task_name": "プロジェクト設計",
            "content": "アプリケーション全体の設計を行う。"
        },
        {
            "task_id": 1,
            "task_name": "データモデル定義 (TODO)",
            "content": "Todoモデルの定義を行う。"
        }
    ]
    service = DurationTaskService()
    try:
        durations = service.generate_task_durations(10, tasks)
        print("Generated Task Durations:")
        print(json.dumps(durations, ensure_ascii=False, indent=2))
    except Exception as e:
        print("Test failed with error:", str(e))
