"""
依存関係生成の無限ループテスト

機能間依存関係のロジックが無限ループを引き起こすか検証
"""
import asyncio
from services.task import TaskDependencyService
from database import SessionLocal


# テストデータ: 2つの機能、各3タスク
test_tasks = [
    # 機能1のタスク
    {"node_id": "task_0", "function_id": "func_1", "task_name": "機能1タスク1", "category": "バックエンド", "priority": "Must", "depends_on": []},
    {"node_id": "task_1", "function_id": "func_1", "task_name": "機能1タスク2", "category": "バックエンド", "priority": "Must", "depends_on": []},
    {"node_id": "task_2", "function_id": "func_1", "task_name": "機能1タスク3", "category": "バックエンド", "priority": "Must", "depends_on": []},

    # 機能2のタスク（機能1に依存）
    {"node_id": "task_3", "function_id": "func_2", "task_name": "機能2タスク1", "category": "フロントエンド", "priority": "Must", "depends_on": []},
    {"node_id": "task_4", "function_id": "func_2", "task_name": "機能2タスク2", "category": "フロントエンド", "priority": "Must", "depends_on": []},
    {"node_id": "task_5", "function_id": "func_2", "task_name": "機能2タスク3", "category": "フロントエンド", "priority": "Must", "depends_on": []},
]

test_functions = [
    {"function_id": "func_1", "function_name": "ユーザー管理API", "category": "backend", "priority": "Must", "description": "ユーザーのCRUD操作"},
    {"function_id": "func_2", "function_name": "ユーザー管理UI", "category": "frontend", "priority": "Must", "description": "ユーザー管理画面"},
]


async def test_infinite_loop():
    """無限ループテスト"""
    db = SessionLocal()

    try:
        print("=" * 80)
        print("無限ループテスト開始")
        print("=" * 80)

        service = TaskDependencyService(db)

        # generate_dependencies を呼び出す
        print("\n依存関係生成開始...")
        tasks_with_deps, edges = await service.generate_dependencies(test_tasks, test_functions)

        print("\n" + "=" * 80)
        print("✅ テスト完了（無限ループは発生しなかった）")
        print("=" * 80)

        print(f"\n総タスク数: {len(tasks_with_deps)}")
        print(f"総エッジ数: {len(edges)}")

        print("\n各タスクの依存関係:")
        for task in tasks_with_deps:
            deps = task.get("depends_on", [])
            print(f"  {task['node_id']}: {deps} ({len(deps)}個の依存)")

        print("\nエッジ一覧:")
        for edge in edges:
            print(f"  {edge['source_node_id']} -> {edge['target_node_id']}")

    except KeyboardInterrupt:
        print("\n\n" + "=" * 80)
        print("❌ 無限ループ検出: Ctrl+Cで中断されました")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()

    finally:
        db.close()


if __name__ == "__main__":
    # タイムアウトを設定（30秒で強制終了）
    try:
        asyncio.run(asyncio.wait_for(test_infinite_loop(), timeout=30.0))
    except asyncio.TimeoutError:
        print("\n" + "=" * 80)
        print("❌ タイムアウト: 30秒以内に処理が完了しませんでした")
        print("無限ループまたは非常に遅い処理が発生している可能性があります")
        print("=" * 80)
