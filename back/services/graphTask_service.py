from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from .base_service import BaseService
from typing import List, Dict
import json

class GraphTaskService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_task_graph(self, tasks: List[Dict]) -> List[Dict]:
        """
        入力のタスクリスト（各タスクは task_id, task_name, content を含む）を受け取り、
        タスク間の依存関係を示すエッジのリストを返す。
        各エッジは {parent: タスクID, child: タスクID} の形式です。
        """
        response_schemas = [
            ResponseSchema(
                name="edges",
                description=(
                    "各エッジはタスク間の依存関係を示します。形式は {parent: number, child: number} です。"
                    "例: {\"edges\": [{\"parent\": 5, \"child\": 3}, {\"parent\": 5, \"child\": 4}, ...]}"
                ),
                type="object(array(objects))"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template="""
            あなたはプロのプロジェクトマネージャーです。
            以下のタスクリストに基づき、以下のような要件でタスク間の依存関係を推論してください。
            それぞれのタスクの内容から、タスクのフロー図を考え、構造木として表現します。API設計-API1の構築-API2の構築のように開発のフローを作ることを想定しています。
            タスクの情報は task_id, task_name, content のみが提供されています。
            ただし、タスクの親子関係は一方通行であり、循環依存は存在しないものとします。
            タスクは基本的に木の中に一つだけになるようにしてください。
            ドキュメント確認などのタスクは、他のタスクに依存しないものとします。
            また、タスクの親子関係は必ず小さいタスクIDから大きいタスクIDへの依存関係として出力してください。
            出力は以下のJSON形式に従い、各エッジを {{parent: タスクID, child: タスクID}} の形式で、
            エッジのリストとして返してください。
            
            タスク一覧:
            {tasks_input}
            
            回答は以下のJSON形式で出力してください:
            {format_instructions}
            """,
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        tasks_input = json.dumps(tasks, ensure_ascii=False, indent=2)
        
        chain = prompt_template | self.llm_pro | parser
        result = chain.invoke({"tasks_input": tasks_input})
        # 期待: result は {"edges": [...]} の形式
        return result.get("edges", [])

if __name__ == '__main__':
    tasks = [
        {
            "task_id": 0,
            "task_name": "プロジェクト設計",
            "content": "アプリケーション全体の設計を行う。コンポーネント設計、データフロー設計、API設計、状態管理設計など。"
        },
        {
            "task_id": 1,
            "task_name": "データモデル定義 (TODO)",
            "content": "backend/app/models/todo.py に Todo モデルを定義する。"
        },
        {
            "task_id": 2,
            "task_name": "データモデル定義 (Category)",
            "content": "backend/app/models/category.py に Category モデルを定義する。"
        }
    ]
    service = GraphTaskService()
    try:
        edges = service.generate_task_graph(tasks)
        print("Generated Graph Edges:")
        print(json.dumps(edges, ensure_ascii=False, indent=2))
    except Exception as e:
        print("Test failed with error:", str(e))
