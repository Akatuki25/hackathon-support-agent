# 差分更新UIの統一設計

## 概要

仕様書(Summary)と機能要件(Function Requirements)のUIを統一し、Q&Aページと同様の「編集 + 追加Q&A + 差分更新」パターンを実装する。

---

## 1. 現状の問題

### 1.1 仕様書ページ (summaryQA)

**構成:**
- ✅ 左側: `SpecificationEditor` (編集エリア + 確信度フィードバック)
- ✅ 右側: `QASection` (追加Q&A)
- ✅ ボタン: 「次へ進む」

**機能:**
- ✅ 仕様書の編集
- ✅ 追加Q&Aへの回答
- ✅ 確信度フィードバックの表示
- ❌ **差分更新ボタンがない** (再生成のみ)

### 1.2 機能要件ページ (functionSummary)

**現状:** 調査が必要

**期待される構成:**
- 編集エリア (Markdownエディタ)
- 追加Q&Aセクション
- 差分更新機能

---

## 2. 統一UI設計

### 2.1 共通レイアウトパターン

```
┌──────────────────────────────────────────────────────────┐
│                        Header                              │
├────────────────────────────────┬───────────────────────────┤
│                                │                           │
│    Document Editor             │     QA Section            │
│    (71% width)                 │     (29% width)           │
│                                │                           │
│  ┌──────────────────────────┐ │  ┌─────────────────────┐ │
│  │  Markdown Editor         │ │  │  Additional Q&A     │ │
│  │                          │ │  │                     │ │
│  │  - BlockNote Editor      │ │  │  - Question 1       │ │
│  │  - Auto-save (debounced) │ │  │  - Question 2       │ │
│  └──────────────────────────┘ │  │  - Question 3       │ │
│                                │  │                     │ │
│  ┌──────────────────────────┐ │  │  [Add Q&A]          │ │
│  │  Confidence Feedback     │ │  └─────────────────────┘ │
│  │                          │ │                           │
│  │  - Score: 85/100         │ │                           │
│  │  - MVP Feasible: Yes     │ │                           │
│  │  - Suggestions           │ │                           │
│  └──────────────────────────┘ │                           │
│                                │                           │
│  ┌──────────────────────────┐ │                           │
│  │  Action Buttons          │ │                           │
│  │                          │ │                           │
│  │  [差分更新] [保存]        │ │                           │
│  └──────────────────────────┘ │                           │
└────────────────────────────────┴───────────────────────────┘
│                    [次へ進む]                               │
└──────────────────────────────────────────────────────────┘
```

### 2.2 コンポーネント構成

#### A. ドキュメントエディタコンポーネント

**仕様書用:**
- `SpecificationEditor.tsx` (既存)

**機能要件用:**
- `FunctionRequirementsEditor.tsx` **(新規作成が必要)**

**共通プロパティ:**
```typescript
interface DocumentEditorProps {
  projectId: string;
  projectDocument: ProjectDocumentType | null;
  score: number;
  mvpFeasible: boolean;
  onDocumentUpdate: (document: ProjectDocumentType) => void;
  onEvaluationUpdate: (evaluation: { score_0_100: number; mvp_feasible: boolean }) => void;
}
```

**共通機能:**
1. **Markdown編集**
   - BlockNoteエディタ使用
   - リアルタイム編集

2. **確信度フィードバック表示**
   - スコア表示
   - MVP実現可能性表示
   - 改善提案の表示

3. **アクションボタン**
   - **「差分更新」** - 前段階(Q&A or 仕様書)の変更を反映
   - **「保存」** - 現在の編集内容を保存

#### B. QAセクションコンポーネント

**既存:**
- `QASection.tsx`

**機能:**
- 追加Q&Aの表示・回答
- 新しいQ&Aの追加
- 回答の保存

---

## 3. 差分更新フロー

### 3.1 仕様書の差分更新

**トリガー:**
- Q&Aが追加・変更された場合

**API呼び出し:**
```typescript
// front/src/libs/service/summary.ts
await updateSummaryWithQA(projectId, {
  manual_diff: null,
  new_qa: newQAList
});
```

**バックエンド:**
```python
# back/routers/summary.py
@router.post("/update-qa-and-regenerate")
async def update_summary_with_qa(
    request: SummaryUpdateRequest,
    db: Session = Depends(get_db)
):
    # Q&Aと手動差分を基に仕様書を差分更新
    updated_summary = await summary_service.update_summary_with_diff(
        project_id=str(request.project_id),
        manual_diff=request.manual_diff,
        new_qa=request.new_qa
    )
    # 自動保存
    await summary_service.save_summary_to_project_document(
        project_id=str(request.project_id),
        summary=updated_summary
    )
    return {"message": "Summary updated successfully", ...}
```

### 3.2 機能要件の差分更新

**トリガー:**
- 仕様書が変更された場合

**API呼び出し:**
```typescript
// front/src/libs/service/function.ts (既に実装済み)
await updateFunctionDocWithSpec(projectId, {
  specification_diff: "仕様書の変更内容"
});
```

**バックエンド:**
```python
# back/routers/function_requirements.py (既に実装済み)
@router.post("/update-with-spec")
async def update_function_doc_with_spec(
    request: FunctionDocUpdateWithSpecRequest,
    db: Session = Depends(get_db)
):
    # 仕様書の差分を基に機能要件を差分更新
    updated_doc = await function_service.update_function_doc_with_spec_diff(
        project_id=project_id_str,
        specification_diff=request.specification_diff
    )
    # 自動保存
    project_doc.function_doc = updated_doc
    db.commit()
    return {"message": "Function document updated successfully", ...}
```

---

## 4. 実装タスク

### Phase 1: FunctionRequirementsEditor コンポーネント作成

**ファイル:**
- `front/src/components/FunctionRequirementsEditor/FunctionRequirementsEditor.tsx`

**実装内容:**
1. BlockNoteエディタの統合
2. 確信度フィードバック表示エリア
3. 「差分更新」ボタン
4. 「保存」ボタン
5. 編集状態管理 (isDirty)

**参考:** `SpecificationEditor.tsx` をベースに作成

### Phase 2: functionSummary ページの更新

**ファイル:**
- `front/src/app/hackSetUp/[ProjectId]/functionSummary/page.tsx`

**実装内容:**
1. 既存UIを2カラムレイアウトに変更
   - 左側: `FunctionRequirementsEditor`
   - 右側: `QASection`
2. 差分更新ハンドラーの実装
3. 次へ進むボタンの実装

**参考:** `summaryQA/page.tsx` のレイアウトを踏襲

### Phase 3: SpecificationEditor の差分更新ボタン追加

**ファイル:**
- `front/src/components/SpecificationEditor/SpecificationEditor.tsx`

**実装内容:**
1. 「差分更新」ボタンの追加
2. Q&A変更検知
3. `updateSummaryWithQA` API呼び出し

---

## 5. UIコンポーネントの詳細設計

### 5.1 差分更新ボタンの挙動

**ボタンの状態:**

| 状態 | 表示 | 有効/無効 | 説明 |
|------|------|----------|------|
| 初期状態 | 「差分更新」 | 無効 (グレー) | Q&Aや前段階に変更なし |
| 変更検知 | 「差分更新」 | 有効 (青色) | Q&Aまたは前段階が変更された |
| 更新中 | 「更新中...」 | 無効 + スピナー | API呼び出し中 |
| 完了 | 「差分更新」 | 無効 (グレー) | 更新完了、再度変更があるまで無効 |

**実装例:**
```tsx
const [hasPendingChanges, setHasPendingChanges] = useState(false);
const [isUpdating, setIsUpdating] = useState(false);

const handleDifferentialUpdate = async () => {
  setIsUpdating(true);
  try {
    const result = await updateFunctionDocWithSpec(projectId, specificationDiff);
    setDocument(result.function_doc);
    setHasPendingChanges(false);
    toast.success("差分更新が完了しました");
  } catch (error) {
    toast.error("差分更新に失敗しました");
  } finally {
    setIsUpdating(false);
  }
};

return (
  <button
    onClick={handleDifferentialUpdate}
    disabled={!hasPendingChanges || isUpdating}
    className={`px-4 py-2 rounded ${
      hasPendingChanges && !isUpdating
        ? 'bg-blue-500 hover:bg-blue-600'
        : 'bg-gray-300 cursor-not-allowed'
    }`}
  >
    {isUpdating ? (
      <>
        <Loader2 className="animate-spin mr-2" size={16} />
        更新中...
      </>
    ) : (
      '差分更新'
    )}
  </button>
);
```

### 5.2 変更検知の仕組み

#### A. 仕様書ページ

**検知対象:**
- Q&Aの追加・変更

**実装:**
```tsx
useEffect(() => {
  // Q&Aが変更されたか確認
  const hasQAChanged = JSON.stringify(question) !== JSON.stringify(initialQA);
  setHasPendingChanges(hasQAChanged);
}, [question, initialQA]);
```

#### B. 機能要件ページ

**検知対象:**
- 仕様書の更新日時 (`specification_updated_at`)

**実装:**
```tsx
useEffect(() => {
  if (!projectDocument) return;

  const specUpdatedAt = projectDocument.specification_updated_at;
  const funcUpdatedAt = projectDocument.function_doc_updated_at;

  // 仕様書が機能要件よりも新しい場合
  if (specUpdatedAt && funcUpdatedAt && new Date(specUpdatedAt) > new Date(funcUpdatedAt)) {
    setHasPendingChanges(true);
  } else {
    setHasPendingChanges(false);
  }
}, [projectDocument]);
```

---

## 6. エラーハンドリング

### 6.1 差分更新失敗時

**原因:**
- 前段階のドキュメントが存在しない
- LLM API エラー
- ネットワークエラー

**対処:**
```tsx
const handleDifferentialUpdate = async () => {
  try {
    const result = await updateFunctionDocWithSpec(projectId, specificationDiff);
    // 成功処理
  } catch (error) {
    if (error.response?.status === 404) {
      toast.error("前段階のドキュメントが見つかりません");
    } else if (error.response?.status === 500) {
      toast.error("サーバーエラーが発生しました。再試行してください。");
    } else {
      toast.error("差分更新に失敗しました");
    }
  }
};
```

### 6.2 未保存の変更警告

**シナリオ:**
- ユーザーが編集中に「次へ進む」を押した場合

**実装:**
```tsx
const handleNext = async () => {
  if (isDirty) {
    const confirmed = confirm("未保存の変更があります。保存してから次へ進みますか?");
    if (!confirmed) return;

    await saveFunctionDocument(projectId, functionDoc);
    setIsDirty(false);
  }

  router.push(`/hackSetUp/${projectId}/functionStructure`);
};
```

---

## 7. まとめ

### 7.1 統一されたUI構成

| ページ | 左側 | 右側 | 差分更新トリガー |
|--------|------|------|----------------|
| **仕様書** | SpecificationEditor | QASection | Q&A変更 |
| **機能要件** | FunctionRequirementsEditor | QASection | 仕様書変更 |

### 7.2 実装の優先順位

1. **Phase 1 (必須):** `FunctionRequirementsEditor` コンポーネント作成
2. **Phase 2 (必須):** `functionSummary` ページの更新
3. **Phase 3 (推奨):** `SpecificationEditor` への差分更新ボタン追加
4. **Phase 4 (オプション):** エラーハンドリングの強化

### 7.3 期待される効果

- ✅ 仕様書と機能要件のUI一貫性
- ✅ 差分更新による編集効率の向上
- ✅ 完全再生成と差分更新の使い分けが可能
- ✅ ユーザー体験の向上

---

## 変更履歴

- 2025-01-14: 初版作成
