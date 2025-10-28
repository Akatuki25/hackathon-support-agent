# カンバンボード リファクタリング計画

## 概要
現在のカンバンボード（ステータス別: TODO/DOING/DONE）を**メンバー別のカラム**に変更し、各タスクに**チェックボックス**を追加する。

---

## 1. 現状分析

### 現在の構造
- **ファイル**: `front/src/app/[userName]/[projectId]/kanban/page.tsx`
- **カラム**: ステータス別（TODO, DOING, DONE）
- **データ構造**:
  ```typescript
  type BoardState = Record<TaskStatusEnum, TaskType[]>;
  // { TODO: TaskType[], DOING: TaskType[], DONE: TaskType[] }
  ```
- **主要な関数**:
  - `buildBoardFromTasks()`: タスクをステータス別に分類
  - `moveTaskToStatus()`: タスクを別のステータスに移動
  - `handleColumnDrop()`: ドラッグ&ドロップ処理

### 使用しているAPI
- **タスク取得**: `useTasksByProjectId(projectId)` - `/task/project/{project_id}`
- **タスク更新**: `patchTask(taskId, { status: newStatus })` - `PATCH /task/{task_id}`

### データモデル
- **TaskType** (`/front/src/types/modelTypes.ts:90-110`):
  - `assignee?: string` - 担当者名（文字列）
  - `completed?: boolean` - 完了フラグ（既にスキーマに存在）
  - `status?: TaskStatusEnum` - ステータス
- **ProjectMemberType** (`/front/src/types/modelTypes.ts:54-59`):
  - `project_member_id?: string`
  - `project_id: string`
  - `member_id: string`
  - `member_name: string`

---

## 2. 変更内容

### 2.1 メンバー別カラムへの変更

#### 必要な変更点

1. **プロジェクトメンバー情報の取得**
   - API: `getProjectMembersByProjectId(projectId)` - `/project_member/project/{project_id}`
   - レスポンス: `ProjectMemberType[]`

2. **データ構造の変更**
   ```typescript
   // Before
   type BoardState = Record<TaskStatusEnum, TaskType[]>;

   // After
   type BoardState = Record<string, TaskType[]>; // key = member_name
   // 例: { "山田太郎": [task1, task2], "佐藤花子": [task3], "未割り当て": [task4] }
   ```

3. **カラム定義の変更**
   ```typescript
   // Before
   const STATUS_LIST: ReadonlyArray<{ key: TaskStatusEnum; label: string }> = [
     { key: 'TODO', label: 'TODO' },
     { key: 'DOING', label: 'DOING' },
     { key: 'DONE', label: 'DONE' },
   ];

   // After
   // 動的に生成: プロジェクトメンバー + "未割り当て"カラム
   const memberColumns = useMemo(() => {
     const columns = members.map(m => ({ key: m.member_name, label: m.member_name }));
     columns.push({ key: 'unassigned', label: '未割り当て' });
     return columns;
   }, [members]);
   ```

4. **タスクの分類ロジック変更**
   ```typescript
   // Before: statusで分類
   const buildBoardFromTasks = (tasks?: TaskType[]): BoardState => {
     const board = createEmptyBoard();
     tasks?.forEach((task) => {
       const status: TaskStatusEnum = task.status ?? 'TODO';
       board[status].push(task);
     });
     return board;
   };

   // After: assigneeで分類
   const buildBoardFromTasks = (tasks?: TaskType[], members?: ProjectMemberType[]): BoardState => {
     const board: BoardState = {};

     // 各メンバーの空配列を初期化
     members?.forEach(m => { board[m.member_name] = []; });
     board['unassigned'] = [];

     // タスクを担当者別に分類
     tasks?.forEach((task) => {
       const assignee = task.assignee || 'unassigned';
       if (board[assignee]) {
         board[assignee].push(task);
       } else {
         board['unassigned'].push(task);
       }
     });

     return board;
   };
   ```

5. **ドラッグ&ドロップ時の更新処理**
   ```typescript
   // Before: statusを更新
   await patchTask(taskId, { status: newStatus });

   // After: assigneeを更新
   const newAssignee = targetMemberName === 'unassigned' ? null : targetMemberName;
   await patchTask(taskId, { assignee: newAssignee });
   ```

6. **テーマ/スタイルの調整**
   - `STATUS_THEME` を `MEMBER_THEME` に変更
   - メンバーごとに異なる色を動的に生成（または統一デザイン）
   - ダークモード対応を維持

---

### 2.2 チェックボックスの追加

#### 実装場所
- **TaskCard コンポーネント** (`page.tsx:310-358`)

#### 変更内容

1. **チェックボックスUI追加**
   ```typescript
   function TaskCard({ task, styles, onDragStart, onDragEnd, onSelect, onToggleComplete }: TaskCardProps) {
     return (
       <article className={...}>
         {/* チェックボックスを左上に配置 */}
         <div className="flex items-start gap-2">
           <input
             type="checkbox"
             checked={task.completed ?? false}
             onChange={(e) => {
               e.stopPropagation(); // クリックイベントの伝播を防ぐ
               onToggleComplete(task.task_id);
             }}
             onClick={(e) => e.stopPropagation()}
             className="mt-1 h-4 w-4 rounded border-gray-300"
           />
           <div className="flex-1">
             <h3 className={`font-semibold ${task.completed ? 'line-through opacity-60' : ''} ${styles.title}`}>
               {task.title}
             </h3>
             {/* 残りのコンテンツ */}
           </div>
         </div>
       </article>
     );
   }
   ```

2. **完了フラグの更新処理**
   ```typescript
   const handleToggleComplete = useCallback(
     async (taskId?: string) => {
       if (!taskId) return;

       // 現在の完了状態を取得
       const task = Object.values(board)
         .flat()
         .find(t => t.task_id === taskId);

       if (!task) return;

       const newCompletedState = !task.completed;

       // 楽観的更新
       setBoard((prevBoard) => {
         const nextBoard = { ...prevBoard };
         for (const memberName in nextBoard) {
           nextBoard[memberName] = nextBoard[memberName].map(t =>
             t.task_id === taskId ? { ...t, completed: newCompletedState } : t
           );
         }
         return nextBoard;
       });

       // API呼び出し
       try {
         await patchTask(taskId, { completed: newCompletedState });
       } catch (error) {
         console.error('Failed to update task completion:', error);
         // ロールバック処理
         alert('タスクの完了状態の更新に失敗しました');
       }
     },
     [board]
   );
   ```

3. **視覚的なフィードバック**
   - 完了したタスク: タイトルに取り消し線（`line-through`）
   - 透明度を下げる（`opacity-60`）
   - チェックボックスの色: ダークモード対応

---

## 3. 実装手順

### Phase 1: データ取得と構造変更
1. プロジェクトメンバー取得用のカスタムフックを追加
   ```typescript
   // front/src/hooks/useProjectMembers.ts (新規作成)
   export function useProjectMembers(projectId?: string) {
     return useSWR(
       projectId ? `/project_member/project/${projectId}` : null,
       () => getProjectMembersByProjectId(projectId!)
     );
   }
   ```

2. `page.tsx` でメンバー情報を取得
   ```typescript
   const { members, isLoading: membersLoading } = useProjectMembers(projectId);
   ```

3. `BoardState` 型定義を変更
4. `createEmptyBoard()` をメンバーベースに変更
5. `buildBoardFromTasks()` をメンバーベースに変更

### Phase 2: カラム表示の変更
1. `STATUS_LIST` を動的な `memberColumns` に変更
2. `STATUS_THEME` を削除または簡略化（メンバー用の統一テーマを作成）
3. `TaskColumn` のレンダリングロジックを調整

### Phase 3: ドラッグ&ドロップの変更
1. `moveTaskToStatus()` を `moveTaskToMember()` に変更
2. `handleColumnDrop()` で `assignee` を更新するように変更
3. エラーハンドリングとロールバック処理を維持

### Phase 4: チェックボックスの実装
1. `TaskCard` にチェックボックスUIを追加
2. `handleToggleComplete` ハンドラーを実装
3. `TaskCardProps` 型に `onToggleComplete` を追加
4. 完了状態に応じたスタイリングを適用

### Phase 5: テストと調整
1. ドラッグ&ドロップが正しく動作することを確認
2. チェックボックスの動作確認
3. ダークモード対応の確認
4. エラーハンドリングの確認
5. パフォーマンス確認（メンバー数が多い場合）

---

## 4. 考慮事項

### 潜在的な問題点と対策

1. **メンバーが0人の場合**
   - 「未割り当て」カラムのみを表示
   - または「メンバーを追加してください」メッセージ

2. **メンバー数が多い場合**
   - 横スクロール対応（現在の実装で対応済み: `overflow-x-auto`）
   - カラムの最小幅を設定（現在: `min-w-[220px]`）

3. **assignee が member_name と一致しない場合**
   - 「未割り当て」カラムに表示
   - データの整合性チェックを検討

4. **同時編集の競合**
   - 楽観的更新を使用してUXを改善
   - エラー時はロールバックして再取得

5. **ステータス情報の扱い**
   - `status` フィールドは残すが、UI上は表示しない
   - または各タスクカードにステータスバッジを追加

---

## 5. UI/UXの改善案

### カラムのデザイン
- メンバーごとに異なるアバターアイコンを表示
- メンバーのスキルや役割を表示（`ProjectMemberType` には含まれていないため、`MemberType` と結合が必要）

### タスクカードの改善
- チェックボックスの横にステータスバッジを追加（オプション）
- 完了したタスクを折りたたむオプション
- フィルター機能（完了済みを非表示など）

### パフォーマンス最適化
- `useMemo` でカラムとスタイルをメモ化（既存の実装を維持）
- 大量のタスクがある場合は仮想スクロールを検討

---

## 6. ファイル変更サマリー

### 変更するファイル
- `front/src/app/[userName]/[projectId]/kanban/page.tsx` - メインの変更

### 新規作成するファイル（オプション）
- `front/src/hooks/useProjectMembers.ts` - メンバー取得用フック

### 変更不要なファイル
- バックエンドAPI（既存のAPIをそのまま使用）
- `front/src/types/modelTypes.ts`（既存の型定義で対応可能）
- `front/src/libs/modelAPI/project_member.ts`（既存のAPIクライアントを使用）

---

## 7. 実装の優先度

### 必須（MVP）
1. メンバー別カラム表示
2. ドラッグ&ドロップでassigneeを変更
3. チェックボックスでcompletedを更新

### 推奨（次のイテレーション）
1. 完了済みタスクのフィルター
2. メンバーアバター表示
3. タスクカードにステータスバッジを追加

### オプション（将来的な改善）
1. メンバーカラムの並び替え
2. タスクのソート機能（優先度、期日など）
3. 仮想スクロール対応

---

## 8. テスト計画

### 単体テスト項目
- [ ] `buildBoardFromTasks()` がメンバー別に正しく分類する
- [ ] `moveTaskToMember()` が正しく動作する
- [ ] チェックボックスのトグルが正しく動作する

### 統合テスト項目
- [ ] メンバー情報が正しく取得される
- [ ] ドラッグ&ドロップでAPIが正しく呼ばれる
- [ ] エラー時にロールバックされる

### E2Eテスト項目
- [ ] カンバンボードが正しく表示される
- [ ] タスクをドラッグ&ドロップで移動できる
- [ ] チェックボックスをクリックして完了状態を変更できる
- [ ] ダークモードで正しく表示される

---

## まとめ

この計画に従って実装することで、カンバンボードを**ステータス別からメンバー別**に変更し、**チェックボックス機能**を追加できます。既存のAPI構造を活用し、最小限の変更で実現可能です。
