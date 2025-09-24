# Enhanced Database Schema for Comprehensive Task Management

## 概要

このドキュメントは、包括的なタスク管理システムのための拡張データベーススキーマを説明します。トポロジカルソート、時系列依存関係、教育的タスク詳細、並列処理対応を含む最高品質のタスク管理を実現します。

## 主要エンティティ

### 1. Task（拡張タスクモデル）

包括的なタスク管理のためのメインエンティティ

```sql
CREATE TABLE task (
    -- 基本情報
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES "projectBase"(project_id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    detail TEXT,  -- 教育的詳細情報（JSON形式）
    status task_status_enum NOT NULL DEFAULT 'TODO',
    priority priority_enum NOT NULL DEFAULT 'MEDIUM',

    -- 時系列とスケジューリング
    planned_start_date TIMESTAMPTZ,      -- 計画開始日
    planned_end_date TIMESTAMPTZ,        -- 計画終了日
    actual_start_date TIMESTAMPTZ,       -- 実際の開始日
    actual_end_date TIMESTAMPTZ,         -- 実際の終了日
    due_at TIMESTAMPTZ,                  -- 期限

    -- タスク順序と依存関係
    topological_order INTEGER,           -- トポロジカルソート順序
    execution_phase VARCHAR,             -- 実行フェーズ (setup/development/testing/deployment)
    parallel_group_id VARCHAR,           -- 並列実行グループID
    critical_path BOOLEAN DEFAULT FALSE, -- クリティカルパス上のタスクか

    -- 包括的タスク管理フィールド
    category VARCHAR,                     -- frontend/backend/database/devops/testing/documentation
    estimated_hours INTEGER,             -- 見積作業時間
    complexity_level INTEGER,            -- 複雑度（1-5スケール）
    business_value_score INTEGER,        -- ビジネス価値（1-10スケール）
    technical_risk_score INTEGER,        -- 技術リスク（1-10スケール）
    implementation_difficulty INTEGER,   -- 実装難易度（1-10スケール）
    user_impact_score INTEGER,          -- ユーザー影響度（1-10スケール）
    dependency_weight INTEGER,          -- 依存関係重み（1-10スケール）
    moscow_priority VARCHAR,            -- MoSCoW優先度（Must/Should/Could/Won't）
    mvp_critical BOOLEAN DEFAULT FALSE, -- MVP必須フラグ

    -- 進捗追跡
    progress_percentage INTEGER DEFAULT 0, -- 進捗率（0-100）
    blocking_reason TEXT,                  -- ブロッキング理由
    completion_criteria TEXT,             -- 完了基準

    -- 教育的・参照情報
    learning_resources JSON,             -- 学習リソースJSON
    technology_stack JSON,              -- 使用技術スタックJSON
    reference_links JSON,               -- 参考リンクJSON

    -- メタデータ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    source_doc_id UUID REFERENCES "projectDocument"(doc_id) ON DELETE SET NULL
);

-- インデックス
CREATE INDEX ix_task_topological_order ON task(project_id, topological_order);
CREATE INDEX ix_task_execution_phase ON task(project_id, execution_phase);
CREATE INDEX ix_task_parallel_group ON task(project_id, parallel_group_id);
CREATE INDEX ix_task_critical_path ON task(project_id, critical_path);
CREATE INDEX ix_task_timeline ON task(planned_start_date, planned_end_date);
CREATE INDEX ix_task_moscow_priority ON task(moscow_priority);
CREATE INDEX ix_task_mvp_critical ON task(mvp_critical);
CREATE INDEX ix_task_complexity ON task(complexity_level);
CREATE INDEX ix_task_business_value ON task(business_value_score);
```

### 2. TaskDependency（複雑な依存関係管理）

タスク間の複雑な依存関係を管理するエンティティ

```sql
CREATE TYPE dependency_type_enum AS ENUM (
    'FINISH_TO_START',    -- 前提タスク完了後に開始
    'START_TO_START',     -- 前提タスク開始後に開始
    'FINISH_TO_FINISH',   -- 前提タスク完了後に完了
    'START_TO_FINISH'     -- 前提タスク開始後に完了
);

CREATE TABLE "taskDependency" (
    dependency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES "projectBase"(project_id) ON DELETE CASCADE,
    prerequisite_task_id UUID NOT NULL REFERENCES task(task_id) ON DELETE CASCADE,
    dependent_task_id UUID NOT NULL REFERENCES task(task_id) ON DELETE CASCADE,

    -- 依存関係プロパティ
    dependency_type dependency_type_enum NOT NULL DEFAULT 'FINISH_TO_START',
    lag_time_hours INTEGER DEFAULT 0,      -- 遅延時間（時間単位）
    dependency_strength INTEGER DEFAULT 5, -- 依存関係の強さ（1-10）
    is_critical BOOLEAN DEFAULT FALSE,     -- クリティカルパス上の依存関係か
    notes TEXT,                            -- 依存関係の説明

    -- AI分析結果
    ai_confidence FLOAT,                   -- AI分析の信頼度（0.0-1.0）
    auto_detected BOOLEAN DEFAULT FALSE,   -- AI自動検出か手動設定か
    violation_risk INTEGER,               -- 依存関係違反リスク（1-10）

    -- メタデータ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ux_task_dependency_unique
        UNIQUE (prerequisite_task_id, dependent_task_id, dependency_type)
);

-- インデックス
CREATE INDEX ix_dependency_project ON "taskDependency"(project_id);
CREATE INDEX ix_dependency_critical ON "taskDependency"(is_critical);
CREATE INDEX ix_dependency_strength ON "taskDependency"(dependency_strength);
CREATE INDEX ix_dependency_type ON "taskDependency"(dependency_type);
```

### 3. 既存エンティティとの統合

#### ProjectBase（プロジェクト基本情報）
```sql
-- 既存のプロジェクトテーブルは変更なし
-- start_date と end_date を活用してタイムライン生成
```

#### ProjectDocument（プロジェクト文書）
```sql
-- 既存のドキュメントテーブルは変更なし
-- specification, function_doc, frame_work_doc を活用
```

## 主要機能実装

### 1. トポロジカルソート

```python
# NetworkXを使用したトポロジカルソート
import networkx as nx

def perform_topological_sort(tasks, dependencies):
    graph = nx.DiGraph()

    # ノード（タスク）追加
    for task in tasks:
        graph.add_node(task.task_id, **task_attributes)

    # エッジ（依存関係）追加
    for dep in dependencies:
        graph.add_edge(dep.prerequisite_task_id, dep.dependent_task_id)

    # トポロジカルソート実行
    topological_order = list(nx.topological_sort(graph))
    critical_path = nx.dag_longest_path(graph, weight='duration')

    return {
        'topological_order': topological_order,
        'critical_path': critical_path,
        'parallel_groups': identify_parallel_groups(graph)
    }
```

### 2. 時系列タイムライン生成

```python
def map_timeline_to_project_dates(timeline, project_start, project_end):
    total_days = (project_end - project_start).days

    for task_info in timeline['task_schedule']:
        start_offset = task_info['start_day']
        end_offset = task_info['end_day']

        actual_start = project_start + timedelta(days=start_offset)
        actual_end = project_start + timedelta(days=end_offset)

        # Taskテーブルのplanned_start_date, planned_end_dateに保存
        update_task_timeline(task_info['task_id'], actual_start, actual_end)
```

### 3. 教育的タスク詳細生成

```python
async def generate_educational_details(tasks, project_document):
    enhanced_tasks = []

    for task in tasks:
        # TaskDetailServiceを使用して教育的詳細生成
        educational_detail = task_detail_service.generate_enhanced_task_detail(
            task, project_document.specification
        )

        # 教育的情報をタスクのJSONフィールドに保存
        task.learning_resources = educational_detail.learning_resources
        task.technology_stack = educational_detail.technologies_used
        task.reference_links = educational_detail.reference_links
        task.completion_criteria = educational_detail.educational_notes

        enhanced_tasks.append(task)

    return enhanced_tasks
```

### 4. 並列処理と検索

```python
async def parallel_task_generation(project_document, use_parallel=True):
    if use_parallel:
        # 並列処理でタスク生成
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [
                executor.submit(generate_batch, batch)
                for batch in task_batches
            ]
            results = [future.result() for future in as_completed(futures)]

    # 検索機能統合
    search_results = task_detail_service.research_technology(technology_name)
    return enhanced_results
```

## API エンドポイント

### 1. 包括的タスク生成
```
POST /api/enhanced_tasks/generate/{project_id}
- 完全なワークフロー実行
- 段階的DB保存
- 並列処理対応
```

### 2. 依存関係とトポロジカル情報
```
GET /api/enhanced_tasks/dependencies/{project_id}
- 依存関係一覧
- トポロジカル順序
- クリティカルパス
- 並列実行グループ
```

### 3. タイムライン情報
```
GET /api/enhanced_tasks/timeline/{project_id}
- プロジェクト日程
- タスクスケジュール
- 進捗情報
- フェーズ別統計
```

### 4. 教育的情報
```
GET /api/enhanced_tasks/educational/{project_id}
- 学習リソース
- 技術スタック情報
- 参考リンク
- 教育的ガイダンス
```

### 5. タスク一覧（拡張）
```
GET /api/enhanced_tasks/tasks/{project_id}
- フィルタリング機能
- 詳細情報含む/含まない
- ページング対応
```

## 最適化と性能

### インデックス戦略
- トポロジカル順序による高速ソート
- 実行フェーズ別の効率的フィルタリング
- 並列グループでの高速グループ化
- タイムライン範囲での効率的検索

### 並列処理
- AIタスク生成の並列化
- 教育的詳細生成の並列化
- 検索処理の並列化
- バッチ処理によるスループット向上

### メモリ最適化
- 段階的データベース保存
- 大量タスクの効率的処理
- NetworkXグラフの最適化

## 教育的機能

### 学習支援
- 技術ドキュメント自動収集
- チュートリアル・ガイド提供
- 複雑度に応じた学習パス
- リアルタイム支援情報

### 品質保証
- AI信頼度メトリクス
- 依存関係検証
- タスク完了基準明確化
- 進捗追跡とブロッキング管理

## まとめ

この拡張データベーススキーマは以下を実現します：

1. **包括的タスク管理**: ID基盤のトポロジカルソート対応
2. **時系列依存関係**: プロジェクト日程との統合
3. **教育的支援**: 学習リソースと技術ガイダンス
4. **並列処理**: 高性能なタスク生成と管理
5. **検索統合**: 技術情報の自動収集と提供
6. **品質保証**: AI信頼度と依存関係検証

最大限のリソースを活用し、最高品質のタスク管理システムを提供します。