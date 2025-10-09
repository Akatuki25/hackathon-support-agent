"""
依存関係選択ロジックの直接テスト

LLM呼び出しなしで、min/maxロジックが無限ループを引き起こすか検証
"""


def test_min_max_logic():
    """min/max ロジックのシミュレーション"""
    print("=" * 80)
    print("min/max ロジックテスト")
    print("=" * 80)

    # 2つの機能のタスク
    func1_tasks = [
        {"node_id": "task_0", "depends_on": []},
        {"node_id": "task_1", "depends_on": []},
        {"node_id": "task_2", "depends_on": []},
    ]

    func2_tasks = [
        {"node_id": "task_3", "depends_on": []},
        {"node_id": "task_4", "depends_on": []},
        {"node_id": "task_5", "depends_on": []},
    ]

    print("\n初期状態:")
    print(f"  機能1: {[t['node_id'] for t in func1_tasks]}")
    print(f"  機能2: {[t['node_id'] for t in func2_tasks]}")

    # LLMが「機能2は機能1に依存」と返したと仮定
    # 元のロジック: min/max で選択
    print("\n\n元のロジック（min/max）で複数回実行:")
    print("-" * 80)

    for iteration in range(10):
        print(f"\n反復 {iteration + 1}:")

        # 依存が最も少ないタスク
        first_dependent = min(func2_tasks, key=lambda t: len(t.get("depends_on", [])))
        # 依存が最も多いタスク
        last_prerequisite = max(func1_tasks, key=lambda t: len(t.get("depends_on", [])))

        print(f"  選択: {first_dependent['node_id']} (依存数: {len(first_dependent['depends_on'])}) <- {last_prerequisite['node_id']} (依存数: {len(last_prerequisite['depends_on'])})")

        # 依存を追加
        if last_prerequisite["node_id"] not in first_dependent["depends_on"]:
            first_dependent["depends_on"].append(last_prerequisite["node_id"])
            print(f"  ✓ 追加成功 (新しい依存数: {len(first_dependent['depends_on'])})")
        else:
            print(f"  - 既に存在（スキップ）")
            break

        # 状態表示
        print(f"  機能2の依存状態: {[(t['node_id'], len(t['depends_on'])) for t in func2_tasks]}")

    print("\n" + "=" * 80)
    print("結果:")
    for task in func2_tasks:
        print(f"  {task['node_id']}: {task['depends_on']}")


def test_fixed_index_logic():
    """固定インデックスロジックのシミュレーション"""
    print("\n\n" + "=" * 80)
    print("固定インデックスロジックテスト")
    print("=" * 80)

    # 2つの機能のタスク
    func1_tasks = [
        {"node_id": "task_0", "depends_on": []},
        {"node_id": "task_1", "depends_on": []},
        {"node_id": "task_2", "depends_on": []},
    ]

    func2_tasks = [
        {"node_id": "task_3", "depends_on": []},
        {"node_id": "task_4", "depends_on": []},
        {"node_id": "task_5", "depends_on": []},
    ]

    print("\n初期状態:")
    print(f"  機能1: {[t['node_id'] for t in func1_tasks]}")
    print(f"  機能2: {[t['node_id'] for t in func2_tasks]}")

    print("\n\n固定インデックスで複数回実行:")
    print("-" * 80)

    for iteration in range(10):
        print(f"\n反復 {iteration + 1}:")

        # 固定: 最初と最後
        first_dependent = func2_tasks[0]
        last_prerequisite = func1_tasks[-1]

        print(f"  選択: {first_dependent['node_id']} (依存数: {len(first_dependent['depends_on'])}) <- {last_prerequisite['node_id']} (依存数: {len(last_prerequisite['depends_on'])})")

        # 依存を追加
        if last_prerequisite["node_id"] not in first_dependent["depends_on"]:
            first_dependent["depends_on"].append(last_prerequisite["node_id"])
            print(f"  ✓ 追加成功 (新しい依存数: {len(first_dependent['depends_on'])})")
        else:
            print(f"  - 既に存在（スキップ）")
            break

        # 状態表示
        print(f"  機能2の依存状態: {[(t['node_id'], len(t['depends_on'])) for t in func2_tasks]}")

    print("\n" + "=" * 80)
    print("結果:")
    for task in func2_tasks:
        print(f"  {task['node_id']}: {task['depends_on']}")


if __name__ == "__main__":
    test_min_max_logic()
    test_fixed_index_logic()

    print("\n\n" + "=" * 80)
    print("結論:")
    print("=" * 80)
    print("元のmin/maxロジック: 同じタスクが繰り返し選ばれる -> 2回目以降は「既に存在」でスキップされる")
    print("→ 無限ループは起こらない（ただし不安定）")
    print()
    print("固定インデックスロジック: 必ず同じタスクが選ばれる -> 安定している")
    print("=" * 80)
