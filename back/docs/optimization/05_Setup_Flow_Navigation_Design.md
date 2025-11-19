# プロジェクトセットアップフロー改善設計書

## 概要

ハッカソンサポートエージェントのプロジェクトセットアップフローを、「一方通行のウィザード」から「反復的な仕様策定ワークスペース」へ改善する設計。

---

## 1. 設計方針

### 1.1 根本的な課題

**現状の問題:**
- ページ間の移動が一方向のみ（「次へ」ボタンのみ）
- 前のページに戻って編集できない
- 編集した場合、次のドキュメントとの整合性が取れない
- 「壁打ち」的な使い方（仕様書と機能要件を行き来して修正）ができない

**目指すUX:**
- ヘッダーのステッパーで自由に前後移動
- Q&Aを修正したら、仕様書以降を再生成
- 仕様書と機能要件を何度も行き来して洗練
- 明確な状態表示（生成済み、未生成、生成中）

### 1.2 核心的なルール

**Q&Aを変更 = 後続ドキュメントを全削除**

- Q&A編集 → 仕様書、機能要件、機能一覧を削除（DBで`NULL`に）
- タイムスタンプ比較や複雑な状態管理は不要
- システムの振る舞いが明確で実装しやすい

---

## 2. 状態定義

### 2.1 ドキュメントの状態（3状態のみ）

```typescript
export type DocumentStatus =
  | 'not_exists'  // 未生成（前提情報が不足）
  | 'generating'  // 生成中
  | 'exists';     // 存在（最新）
```

**シンプルさの理由:**
- `needs_update` や `needs_regenerate` といった中間状態は不要
- Q&A変更時は後続を削除するため、「古い情報」が残らない
- 状態遷移が単純: `not_exists` → `generating` → `exists`

### 2.2 セットアップステップ

```typescript
export type StepId =
  | 'qa'                      // Q&A
  | 'specification'           // 仕様書
  | 'functional_requirements' // 機能要件
  | 'function_structure';     // 機能一覧（構造化）

export interface SetupStep {
  id: StepId;
  label: string;
  path: (projectId: string) => string;
  prerequisite: StepId | null; // 前提となるステップ
}
```

**必須ステップ:**
1. Q&A
2. 仕様書
3. 機能要件
4. 機能一覧

**フレームワーク選択:**
- 任意のオプション機能（必須ステップには含めない）
- ユーザーが「AIに推奨してもらう」or「自分で決める」を選択

---

## 3. ドキュメント生成のタイミングと依存関係

### 3.1 生成・更新戦略

| 前段階の操作 | 次のドキュメント | 処理 |
|------------|----------------|------|
| **Q&A完了 → 次へ** | 仕様書 | **新規生成** |
| **Q&A編集** | 仕様書以降 | **全削除** → 再生成が必要 |
| **仕様書完了 → 次へ** | 機能要件 | **新規生成** |
| **仕様書編集** | 機能要件以降 | **全削除**（オプション） |
| **機能要件完了 → 次へ** | 機能一覧 | **新規生成** |

### 3.2 依存関係グラフ

```
Q&A → 仕様書 → 機能要件 → 機能一覧
 ↑      ↑        ↑         ↑
 └──────┴────────┴─────────┘
   Q&A変更時は全て削除
```

---

## 4. ナビゲーションルール

### 4.1 ステップへの遷移条件

```typescript
/**
 * ステップへのナビゲーションが可能か判定
 */
function canNavigateToStep(
  targetStep: StepId,
  status: ProjectSetupStatus
): { allowed: boolean; reason?: string } {
  const step = SETUP_STEPS.find(s => s.id === targetStep);

  // 前提条件: 前段階のドキュメントが存在するか
  if (step.prerequisite) {
    const prerequisiteStatus = status.steps[step.prerequisite];

    if (prerequisiteStatus.status === 'not_exists') {
      return {
        allowed: false,
        reason: `先に「${prerequisiteLabel}」を完了してください`
      };
    }
  }

  return { allowed: true };
}
```

**ルール:**
- 前段階のドキュメントが `exists` なら遷移可能
- `not_exists` の場合は遷移不可（ステッパーでグレーアウト）

### 4.2 「次へ進む」ボタンの挙動

```typescript
async function handleNextStep(
  currentStep: StepId,
  projectId: string,
  router: Router
): Promise<void> {
  // 1. 現在のページの内容を保存（編集中の場合のみ）
  if (hasUnsavedChanges) {
    await saveCurrentDocument();
  }

  // 2. 次ページのドキュメントを生成（存在しない場合のみ）
  const nextStep = getNextStep(currentStep);
  await generateDocumentForStep(nextStep.id, projectId);

  // 3. 次のページへ遷移
  router.push(nextStep.path(projectId));
}
```

---

## 5. Q&A変更時の処理

### 5.1 フロントエンド

```tsx
// Q&Aページ（front/src/app/hackSetUp/[ProjectId]/hackQA/page.tsx）

const handleQAChange = async (updatedQAs: QAType[]) => {
  // 後続ドキュメントが存在するか確認
  const hasDownstream =
    status?.steps.specification.status === 'exists' ||
    status?.steps.functional_requirements.status === 'exists' ||
    status?.steps.function_structure.status === 'exists';

  // 警告ダイアログ
  if (hasDownstream) {
    const confirmed = confirm(
      'Q&Aを変更すると、仕様書以降のドキュメントが削除されます。\n' +
      'よろしいですか？'
    );
    if (!confirmed) return;
  }

  // Q&A保存 + 後続ドキュメント削除
  await saveQAs(projectId, updatedQAs);
  await deleteDownstreamDocuments(projectId);
  await refresh(); // ステータス更新
};
```

### 5.2 バックエンドAPI

```python
# back/routers/project/project_document.py

@router.delete("/project_document/{project_id}/downstream",
               summary="Q&A以降のドキュメントを削除")
async def delete_downstream_documents(
    project_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Q&Aが変更された際に、仕様書以降のドキュメントを削除"""
    db_document = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id
    ).first()

    if db_document is None:
        raise HTTPException(status_code=404, detail="Project document not found")

    # 後続ドキュメントをNULLにする
    db_document.specification = None
    db_document.specification_updated_at = None
    db_document.function_doc = None
    db_document.function_doc_updated_at = None
    db_document.function_structure = None
    db_document.function_structure_updated_at = None

    db.commit()
    return {"message": "Q&A以降のドキュメントを削除しました"}
```

---

## 6. ステッパーUI

### 6.1 コンポーネント構成

```tsx
// front/src/components/SetupStepper/SetupStepper.tsx

export default function SetupStepper({ projectId }: Props) {
  const { status } = useProjectSetupStatus(projectId);

  return (
    <div className="flex items-center gap-2 py-4">
      {SETUP_STEPS.map((step) => {
        const stepStatus = status.steps[step.id];
        const navigation = canNavigateToStep(step.id, status);

        return (
          <button
            onClick={() => handleStepClick(step.id)}
            disabled={!navigation.allowed}
            className={getStepColor(stepStatus.status)}
          >
            {getStatusIcon(stepStatus.status)}
            <span>{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

### 6.2 状態別の色分け

| 状態 | 色 | アイコン | 説明 |
|------|---|---------|------|
| `exists` | 緑 | ✓ | 生成済み（クリック可能） |
| `generating` | 青（点滅） | 🔄 | 生成中 |
| `not_exists` | グレー | 🔒 | 未生成（クリック不可） |

```typescript
const getStepColor = (status: DocumentStatus) => {
  switch (status) {
    case 'exists':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'generating':
      return 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse';
    case 'not_exists':
      return 'bg-gray-100 text-gray-500 border-gray-300';
  }
};
```

---

## 7. 保存タイミング

### 7.1 基本方針

**自動保存はしない（通信コスト削減）**

- 「次へ進む」ボタンを押した時のみ保存
- 編集中は `isDirty` フラグで未保存を検知
- ブラウザバック時は `beforeunload` で警告

### 7.2 実装例

```tsx
export default function SummaryQA() {
  const [specification, setSpecification] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // エディタの変更検知
  const handleChange = (newSpec: string) => {
    setSpecification(newSpec);
    setIsDirty(true);
  };

  // 次へ進む（保存してから遷移）
  const handleNext = async () => {
    if (isDirty) {
      await patchProjectDocument(projectId, { specification });
      setIsDirty(false);
    }

    await generateDocumentForStep('functional_requirements', projectId);
    router.push(`/hackSetUp/${projectId}/functionSummary`);
  };

  // ブラウザバック時の警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '未保存の変更があります';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <>
      <Header />
      <SpecificationEditor value={specification} onChange={handleChange} />
      {isDirty && <p className="text-yellow-600">⚠ 未保存の変更があります</p>}
      <button onClick={handleNext}>次へ進む</button>
    </>
  );
}
```

---

## 8. 壁打ちの想定フロー

### 8.1 典型的な使い方

```
1. Q&A入力 → 仕様書生成 → 機能要件生成 → 機能一覧生成
   [Q&A: ✓] [仕様書: ✓] [機能要件: ✓] [機能一覧: ✓]

2. 機能一覧を見て「ここが足りない」と気づく
   → ステッパーで仕様書へ戻る

3. 仕様書を編集
   → 「次へ」で保存して機能要件へ

4. 機能要件が古い情報のまま（仕様書変更が未反映）
   → 「再生成」ボタンで機能要件を更新（実装による）

5. 機能一覧へ進む
   → 機能要件が変更されているため、機能一覧も更新が必要
```

**注:** 仕様書編集時に機能要件以降を自動削除するかは、UX次第で調整可能。

---

## 9. 実装の優先順位

### Phase 1: 基盤整備（必須）
- [ ] 型定義（`front/src/types/projectSetup.ts`）
- [ ] ステップ定義（`front/src/config/setupSteps.ts`）
- [ ] ステータス取得フック（`front/src/hooks/useProjectSetupStatus.ts`）
- [ ] ナビゲーションルール（`front/src/utils/setupNavigation.ts`）
- [ ] バックエンドAPI（`DELETE /project_document/{project_id}/downstream`）

### Phase 2: フロー統一（必須）
- [ ] `handleNextStep`（`front/src/utils/stepTransition.ts`）
- [ ] `generateDocumentForStep`（`front/src/utils/documentGeneration.ts`）
- [ ] hackQA ページの修正
- [ ] summaryQA ページの修正
- [ ] functionSummary ページの修正

### Phase 3: UI改善（推奨）
- [ ] ステッパーコンポーネント（`front/src/components/SetupStepper/SetupStepper.tsx`）
- [ ] Headerへの統合
- [ ] 生成中インジケーター（`front/src/components/GeneratingIndicator/GeneratingIndicator.tsx`）
- [ ] 未保存変更警告

### Phase 4: オプション機能
- [ ] 再生成ボタン（各ドキュメントページ）
- [ ] 確認ダイアログの改善
- [ ] フレームワーク選択の任意化

---

## 10. 懸念事項と対策

### 10.1 Q&A変更時の誤操作

**懸念:**
- ユーザーが誤ってQ&Aを編集し、後続ドキュメントが削除される

**対策:**
- Q&A変更時に確認ダイアログを表示
- 削除される内容を明示（「仕様書、機能要件、機能一覧が削除されます」）

### 10.2 生成中の状態管理

**懸念:**
- ドキュメント生成中にページを離れると状態が不整合

**対策:**
- SWRの `refreshInterval` でポーリング（5秒ごと）
- 生成中は「生成中...」インジケーターを表示
- 生成完了後に自動でステータス更新

### 10.3 ネットワークエラー

**懸念:**
- ドキュメント削除APIが失敗した場合の不整合

**対策:**
- try-catch でエラーハンドリング
- エラー時はユーザーに通知し、リトライを促す
- ステータス更新は必ず `await` で待つ

---

## 11. まとめ

### 11.1 設計のポイント

1. **シンプルな3状態**: `not_exists`, `generating`, `exists`
2. **Q&A変更 = 後続削除**: 明確なルールで実装が簡単
3. **自由な行き来**: ステッパーで前後移動可能
4. **保存は明示的**: 「次へ」ボタンでのみ保存

### 11.2 期待される効果

- **ユーザー体験の向上**: 壁打ち的な使い方が可能に
- **実装の簡潔性**: 状態管理がシンプル
- **バグの削減**: 曖昧な状態が無い
- **拡張性**: 新しいステップの追加が容易

---

## 変更履歴

- 2025-XX-XX: 初版作成
