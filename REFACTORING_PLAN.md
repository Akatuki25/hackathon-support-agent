# リファクタリング計画書: フレームワーク選択とDB保存処理の分離

## 概要

`selectFramework` ページから `functionStructuring` ページへの遷移時に、DB保存処理とAIドキュメント生成処理を分離し、ユーザー体験を向上させるためのリファクタリング。

## 現状の問題点

### 現在のフロー
1. **selectFramework ページ** (`front/src/app/hackSetUp/[ProjectId]/selectFramework/page.tsx:434-462`)
   - ユーザーが技術スタックを選択
   - 「セットアップ完了へ」ボタンをクリック
   - `handleNext` 関数内で以下を**順次実行**:
     - フレームワーク選択をDBに保存 (`patchProjectDocument`)
     - AIドキュメント生成 (`generateAIDocument`)
     - 1秒待機
     - 次ページへ遷移

2. **functionStructuring ページ** (`front/src/app/hackSetUp/[ProjectId]/functionStructuring/page.tsx:290-318`)
   - マウント時に自動的に機能構造化を開始

### 具体的な問題

1. **遅延した画面遷移**
   - ユーザーはDB操作とAI生成が完了するまで待機させられる
   - レスポンスが悪いと数秒〜数十秒待たされる可能性

2. **エラーハンドリングの不備**
   - DB保存やAI生成が失敗しても次ページに遷移（lines 454-458）
   - ユーザーは失敗に気づかない可能性

3. **フィードバック不足**
   - 処理中は「処理中...」としか表示されない（line 990）
   - 何の処理が行われているか不明確

4. **責任の混在**
   - selectFramework ページが次ページで必要なデータ準備まで担当
   - ページ間の結合度が高い

## リファクタリング目標

1. **即座のページ遷移**: ボタンクリック後、即座に次ページへ
2. **明確な進行状況表示**: 各処理ステップを可視化
3. **適切なエラーハンドリング**: 各ステップでのエラーを個別に処理
4. **責任の分離**: 各ページが自身の処理のみを担当

## 新しいフロー設計

### Phase 1: selectFramework ページの簡素化

#### 変更点
- `handleNext` 関数をシンプル化
- DB保存とAI生成処理を削除
- 選択データをルーターパラメータで次ページへ渡す
- 即座に遷移

#### データ転送方法
Next.js の `router.push` で以下のデータを渡す:

```typescript
interface FrameworkSelectionData {
  selectedTechnologies: string[];        // 選択された技術名の配列
  selectedPlatform: 'web' | 'ios' | 'android' | null;  // プラットフォーム
  useAIRecommendations: boolean;         // AI推薦使用フラグ
}
```

**実装方法**: URLクエリパラメータ または ルーター状態

```typescript
// オプション1: URLクエリパラメータ
router.push({
  pathname: `/hackSetUp/${projectId}/functionStructuring`,
  query: {
    technologies: Array.from(selectedTechnologies).join(','),
    platform: selectedPlatform || '',
    aiRecommended: useAIRecommendations
  }
});

// オプション2: ルーター状態（推奨）
router.push(`/hackSetUp/${projectId}/functionStructuring`, {
  state: {
    selectedTechnologies: Array.from(selectedTechnologies),
    selectedPlatform,
    useAIRecommendations
  }
});
```

#### 修正対象コード

**削除する処理** (lines 434-462):
```typescript
// これらの処理を削除
await saveFrameworkSelection(projectId, reason);
await generateAIDocument(projectId);
setTimeout(() => { ... }, 1000);
```

**新しい handleNext**:
```typescript
const handleNext = () => {
  if (selectedTechnologies.size === 0 || (!selectedPlatform && !useAIRecommendations)) return;

  // データを次ページへ渡して即座に遷移
  router.push(
    `/hackSetUp/${projectId}/functionStructuring`,
    {
      state: {
        selectedTechnologies: Array.from(selectedTechnologies),
        selectedPlatform,
        useAIRecommendations
      }
    }
  );
};
```

### Phase 2: functionStructuring ページでのデータ処理

#### 新しい処理フェーズ

```typescript
type SetupPhase =
  | 'initializing'           // 初期化中
  | 'saving-framework'       // フレームワーク選択を保存中
  | 'generating-document'    // AI仕様書生成中
  | 'structuring-functions'  // 機能構造化中
  | 'completed'              // 完了
  | 'error';                 // エラー

type SetupError = {
  phase: SetupPhase;
  message: string;
  canContinue: boolean;  // 処理続行可能か
};
```

#### 新しい状態管理

```typescript
const [setupPhase, setSetupPhase] = useState<SetupPhase>('initializing');
const [setupError, setSetupError] = useState<SetupError | null>(null);
const [frameworkData, setFrameworkData] = useState<FrameworkSelectionData | null>(null);
```

#### 新しい useEffect フロー

```typescript
useEffect(() => {
  if (status === "loading") return;
  if (!session) {
    router.push("/");
    return;
  }

  const initializeAndStructure = async () => {
    try {
      // Step 1: ルーターから選択データを取得
      const data = router.state?.selectedTechnologies
        ? router.state
        : null;

      if (data && data.selectedTechnologies.length > 0) {
        setFrameworkData(data);

        // Step 2: フレームワーク選択を保存
        setSetupPhase('saving-framework');
        await saveFrameworkSelection(projectId, data);

        // Step 3: AI仕様書生成
        setSetupPhase('generating-document');
        await generateAIDocument(projectId);
      }

      // Step 4: 機能構造化（既存の処理）
      setSetupPhase('structuring-functions');

      // 既存結果をチェック
      const existingData = await getStructuredFunctions(projectId);
      if (existingData.total_functions > 0) {
        setStructuringResult(existingData);
        setSetupPhase('completed');
        return;
      }

      // 新規実行
      await handleStructureFunctions();

    } catch (error) {
      handleSetupError(setupPhase, error);
    }
  };

  if (projectId) {
    initializeAndStructure();
  }
}, [projectId, session, status, router]);
```

#### エラーハンドリング

```typescript
const handleSetupError = (phase: SetupPhase, error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : '不明なエラー';

  switch (phase) {
    case 'saving-framework':
      setSetupError({
        phase,
        message: `フレームワーク選択の保存に失敗しました: ${errorMessage}`,
        canContinue: true  // 保存失敗しても構造化は続行可能
      });
      // 警告を表示して続行
      break;

    case 'generating-document':
      setSetupError({
        phase,
        message: `仕様書生成に失敗しました: ${errorMessage}`,
        canContinue: true  // 生成失敗しても構造化は続行可能
      });
      break;

    case 'structuring-functions':
      setSetupError({
        phase,
        message: `機能構造化に失敗しました: ${errorMessage}`,
        canContinue: false  // 構造化失敗は致命的
      });
      setSetupPhase('error');
      break;
  }
};
```

#### UI表示の追加

各フェーズに対応したローディング表示:

```typescript
{setupPhase === 'saving-framework' && (
  <div className="loading-container">
    <Loader2 className="animate-spin" />
    <p>フレームワーク選択を保存中...</p>
    {frameworkData && (
      <p className="text-sm">
        選択技術: {frameworkData.selectedTechnologies.join(', ')}
      </p>
    )}
  </div>
)}

{setupPhase === 'generating-document' && (
  <div className="loading-container">
    <Loader2 className="animate-spin" />
    <p>AI仕様書を生成中...</p>
    <p className="text-sm">
      プロジェクト要件を分析しています...
    </p>
  </div>
)}

{setupPhase === 'structuring-functions' && (
  // 既存のUI（lines 370-392）
)}

{setupError && setupError.canContinue && (
  <div className="warning-banner">
    <AlertCircle />
    <p>{setupError.message}</p>
    <p>処理を続行します...</p>
  </div>
)}
```

### Phase 3: 必要な API 関数の追加/移動

#### selectFramework から functionStructuring へ移動

```typescript
// functionStructuring/page.tsx に追加
import { patchProjectDocument } from "@/libs/modelAPI/document";
import { generateAIDocument } from "@/libs/service/aiDocumentService";

// フレームワーク選択データから理由文字列を生成
const buildFrameworkReason = (data: FrameworkSelectionData): string => {
  const technologies = data.selectedTechnologies.join(", ");

  if (data.useAIRecommendations) {
    return `選択理由: AI推薦により${technologies}を使用`;
  } else {
    return `選択理由: ${data.selectedPlatform}プラットフォームで${technologies}を使用`;
  }
};

// フレームワーク選択を保存
const saveFrameworkSelection = async (
  projectId: string,
  data: FrameworkSelectionData
) => {
  const reason = buildFrameworkReason(data);
  await patchProjectDocument(projectId, {
    frame_work_doc: reason
  });
};
```

## 実装順序

### ステップ 1: selectFramework ページの修正
1. `handleNext` 関数を簡素化
2. DB保存とAI生成処理を削除
3. データ転送ロジックを追加
4. テスト: 遷移が即座に行われることを確認

### ステップ 2: functionStructuring ページの修正
1. 新しい型定義を追加
2. 状態管理を追加
3. データ受け取りロジックを実装
4. フェーズ別処理フローを実装
5. エラーハンドリングを実装

### ステップ 3: UI の更新
1. 各フェーズのローディング表示を追加
2. エラー/警告バナーを追加
3. プログレスインジケーターを追加（オプション）

### ステップ 4: テスト
1. 正常系: 全フェーズが正しく動作
2. エラー系: 各フェーズでのエラーハンドリング
3. エッジケース: データなしでの遷移など

## 期待される効果

### ユーザー体験の向上
- ✅ ボタンクリック後の即座の遷移
- ✅ 各処理の進行状況が明確に表示
- ✅ エラー発生時の適切なフィードバック

### コード品質の向上
- ✅ ページ間の責任が明確に分離
- ✅ エラーハンドリングが改善
- ✅ 保守性の向上

### パフォーマンス
- ✅ 体感速度の向上（即座の画面遷移）
- ✅ 実際の処理時間は変わらないが、適切なフィードバックにより待ち時間が許容可能に

## リスクと対策

### リスク 1: データ転送の失敗
**対策**: URLクエリパラメータをフォールバックとして使用

### リスク 2: 既存の動作への影響
**対策**:
- フェーズごとに段階的にテスト
- 既存の機能構造化ロジックは極力変更しない

### リスク 3: ブラウザバック時の挙動
**対策**:
- functionStructuring でデータがない場合は selectFramework にリダイレクト
- または、DBから既存のフレームワーク選択を取得

## 実装後の検証項目

- [ ] selectFramework から functionStructuring への遷移が即座に行われる
- [ ] functionStructuring で各フェーズが正しく実行される
- [ ] フレームワーク選択がDBに正しく保存される
- [ ] AI仕様書が正しく生成される
- [ ] 機能構造化が正常に完了する
- [ ] 各フェーズでのエラーが適切にハンドリングされる
- [ ] ユーザーに適切なフィードバックが表示される
- [ ] ブラウザバック時に正しく動作する

## 参考資料

- Next.js Router: https://nextjs.org/docs/app/api-reference/functions/use-router
- React State Management: https://react.dev/learn/managing-state
- UX Best Practices: Progressive disclosure, Optimistic UI patterns

---

**作成日**: 2025-10-18
**対象バージョン**: front/ (Next.js 15 + React 19)
**関連ファイル**:
- `front/src/app/hackSetUp/[ProjectId]/selectFramework/page.tsx`
- `front/src/app/hackSetUp/[ProjectId]/functionStructuring/page.tsx`
- `front/src/libs/modelAPI/document.ts`
- `front/src/libs/service/aiDocumentService.ts`
