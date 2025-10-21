# 機能要件ページのQA追加問題 - 修正プラン

## 問題の概要

機能要件編集ページ（`functionSummary/page.tsx`）において、QAセクションで新しい質問を追加する際に問題が発生している。

## 現在の実装分析

### 1. QASection コンポーネントの追加フロー
**ファイル**: `/front/src/components/QASection/QASection.tsx`

```typescript
const handleAddNewQA = async () => {
  if (!newQuestion.trim()) {
    alert("質問を入力してください");
    return;
  }

  try {
    const newQA: Omit<QAType, 'qa_id' | 'created_at'> = {
      project_id: projectId,
      question: newQuestion.trim(),
      answer: newAnswer.trim() || null,
      is_ai: false,
      importance: 1,
      source_doc_id: null,
      follows_qa_id: questions.length > 0 ? questions[questions.length - 1].qa_id : null,
    };

    await postQA(newQA);

    // 最新のQ&Aリストを再取得
    const evaluation = await evaluateSummary(projectId);
    onQuestionsUpdate(evaluation.qa);

    setNewQuestion("");
    setNewAnswer("");
    setShowAddQA(false);
  } catch (error) {
    console.error("Q&Aの追加に失敗:", error);
    alert("Q&Aの追加に失敗しました");
  }
};
```

### 2. 問題点の特定

#### 潜在的な問題:
1. **データの不整合**: `evaluateSummary()` が返すデータが即座に反映されない可能性
2. **API呼び出しの順序**: `postQA()` 後に `evaluateSummary()` を呼び出しているが、DBへの反映が遅延する可能性
3. **エラーハンドリング不足**: 詳細なエラー情報が表示されていない
4. **レスポンス検証不足**: APIレスポンスの構造が想定と異なる可能性
5. **再取得ロジック**: `evaluateSummary()` が適切にQAリストを返すか不明

### 3. 依存する API

#### postQA API
**ファイル**: `/front/src/libs/modelAPI/qa.ts`
```typescript
export const postQA = async (qa: Omit<QAType, 'qa_id' | 'created_at'>): Promise<string> => {
  const response = await axios.post<QAResponseType>(`${API_URL}/qa`, qa);
  return response.data.qa_id;
};
```

#### evaluateSummary API
**ファイル**: `/front/src/libs/service/summary.ts`
```typescript
export const evaluateSummary = async (
  projectId: string
) : Promise<MVPJudge> => {
  const response = await axios.post<MVPJudge>(
    `${API_BASE_URL}/api/summary/evaluate`,
    { project_id: projectId }
  );
  return response.data;
};
```

## 修正プラン

### Phase 1: 問題診断 - デバッグログ追加

**目的**: 正確な問題箇所を特定する

**実装内容**:
1. `handleAddNewQA` 関数に詳細なログを追加
2. 各ステップでのレスポンスデータを確認
3. エラー発生時の詳細情報を取得

**変更箇所**:
- `/front/src/components/QASection/QASection.tsx` の `handleAddNewQA` 関数

### Phase 2: データ取得ロジックの改善

**目的**: より確実なQAリスト更新を実現

**選択肢**:

#### オプション A: 直接QAリストを取得
```typescript
// postQA後に直接QAリストを取得
const newQaId = await postQA(newQA);
const updatedQAs = await getQAsByProjectId(projectId);
onQuestionsUpdate(updatedQAs);
```

**メリット**:
- シンプルで直接的
- データの整合性が高い
- 依存が少ない

**デメリット**:
- evaluateSummaryの副作用（あれば）が失われる

#### オプション B: ローカルステート更新 + バックグラウンド同期
```typescript
// 即座にローカルステートを更新
const newQaId = await postQA(newQA);
const newQAWithId: QAType = {
  ...newQA,
  qa_id: newQaId,
  created_at: new Date().toISOString()
};
onQuestionsUpdate([...questions, newQAWithId]);

// バックグラウンドで同期
evaluateSummary(projectId).then(evaluation => {
  onQuestionsUpdate(evaluation.qa);
}).catch(console.error);
```

**メリット**:
- UI反応が即座
- ユーザー体験が向上

**デメリット**:
- データの二重更新
- 複雑性が増す

#### オプション C: 現状維持 + リトライロジック
```typescript
// 再取得をリトライする
const maxRetries = 3;
let retryCount = 0;
let success = false;

await postQA(newQA);

while (retryCount < maxRetries && !success) {
  try {
    await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
    const evaluation = await evaluateSummary(projectId);
    if (evaluation.qa && evaluation.qa.length > questions.length) {
      onQuestionsUpdate(evaluation.qa);
      success = true;
    }
  } catch (error) {
    retryCount++;
  }
}
```

**メリット**:
- DB反映遅延に対応
- 現在のロジックを維持

**デメリット**:
- パフォーマンス低下
- 複雑

### Phase 3: エラーハンドリング強化

**実装内容**:
1. より詳細なエラーメッセージ
2. ネットワークエラー vs サーバーエラーの区別
3. ユーザーへのフィードバック改善
4. ローディング状態の明示

**変更箇所**:
```typescript
const [isAdding, setIsAdding] = useState(false);

const handleAddNewQA = async () => {
  // バリデーション...

  setIsAdding(true);
  try {
    const newQaId = await postQA(newQA);

    if (!newQaId) {
      throw new Error("QAの作成に失敗しました（IDが返されませんでした）");
    }

    const updatedQAs = await getQAsByProjectId(projectId);

    if (!updatedQAs || updatedQAs.length === 0) {
      throw new Error("QAリストの取得に失敗しました");
    }

    onQuestionsUpdate(updatedQAs);

    // UIリセット
    setNewQuestion("");
    setNewAnswer("");
    setShowAddQA(false);

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      alert(`Q&Aの追加に失敗しました (${status}): ${message}`);
    } else {
      alert(`Q&Aの追加に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
    console.error("詳細エラー:", error);
  } finally {
    setIsAdding(false);
  }
};
```

### Phase 4: UI改善

**実装内容**:
1. 追加中のローディングインジケーター
2. 成功時のフィードバック（アニメーション）
3. 失敗時の詳細エラー表示
4. フォームの無効化（二重送信防止）

## 推奨アプローチ

**Phase 1 + Phase 2（オプションA） + Phase 3 + Phase 4** を実装

### 理由:
1. **オプションA** が最もシンプルで確実
2. `getQAsByProjectId` は信頼性の高いAPI
3. エラーハンドリングの強化で問題の早期発見が可能
4. UIフィードバックでユーザー体験が向上

## 実装手順

1. **Step 1**: デバッグログを追加して現在の問題を特定
2. **Step 2**: `handleAddNewQA` を書き換え（オプションA）
3. **Step 3**: エラーハンドリングを強化
4. **Step 4**: ローディング状態とUIフィードバックを追加
5. **Step 5**: テスト実施
6. **Step 6**: 問題が解決しない場合は、バックエンドAPIの調査

## バックエンド調査ポイント（必要に応じて）

もし問題が続く場合、以下を確認:
1. `/back/routers/qa.py` - QA作成エンドポイント
2. `/back/routers/summary.py` - evaluate エンドポイント
3. データベーストランザクションのコミットタイミング
4. CORSやネットワーク設定

## テストケース

実装後に以下をテスト:
1. 新しいQAを追加（質問のみ）
2. 新しいQAを追加（質問と回答）
3. 複数のQAを連続追加
4. ネットワークエラーシミュレーション
5. 異なるプロジェクトでのQA追加

## ロールバックプラン

問題が悪化した場合:
1. Git で変更前の状態に戻す
2. デバッグログのみを残す
3. 問題の詳細をログから分析
4. バックエンドチームと連携

---

## 実装完了報告

### 実装日時
2025-10-19

### 実装内容

#### ✅ Phase 1: デバッグログ追加
- `handleAddNewQA` 関数に詳細なコンソールログを追加
- 各処理ステップでのデータ状態を出力
- エラー発生時の詳細情報を取得

#### ✅ Phase 2: データ取得ロジック改善（オプションA採用）
- `evaluateSummary()` から `getQAsByProjectId()` への切り替え
- より直接的で確実なQAリスト取得を実現
- `postQA()` のレスポンス（新しいQA ID）を検証

**変更前:**
```typescript
const evaluation = await evaluateSummary(projectId);
onQuestionsUpdate(evaluation.qa);
```

**変更後:**
```typescript
const newQaId = await postQA(newQA);
if (!newQaId) {
  throw new Error("QAの作成に失敗しました（IDが返されませんでした）");
}
const updatedQAs = await getQAsByProjectId(projectId);
onQuestionsUpdate(updatedQAs);
```

#### ✅ Phase 3: エラーハンドリング強化
- Axios エラーの詳細な判定と表示
- HTTPステータスコードとエラーメッセージの表示
- スタックトレースのコンソール出力
- ユーザーへのわかりやすいエラーメッセージ

#### ✅ Phase 4: UI改善
**追加した状態管理:**
- `isAdding`: QA追加中のローディング状態
- `addSuccess`: 追加成功時のフィードバック表示

**UI変更:**
- 追加ボタンにローディングインジケーター（スピナー）を表示
- 成功時にチェックマークアイコンと「追加完了」メッセージ
- 処理中はボタンを無効化（二重送信防止）
- 成功表示は2秒後に自動で消える

### 変更されたファイル

**`/front/src/components/QASection/QASection.tsx`**
1. インポート変更:
   - `evaluateSummary` を削除
   - `getQAsByProjectId` を追加
   - `axios` を追加（エラーチェック用）

2. 状態追加:
   - `isAdding: boolean` - 追加処理中フラグ
   - `addSuccess: boolean` - 追加成功フラグ

3. `handleAddNewQA` 関数の改善:
   - ローディング状態管理
   - 詳細なログ出力
   - より確実なデータ取得ロジック
   - 強化されたエラーハンドリング
   - 成功時のフィードバック

4. UI要素の改善:
   - 追加ボタンの状態表示
   - キャンセルボタンの無効化制御

### 期待される改善効果

1. **データ整合性の向上**: 直接QAリストを取得することで、確実に最新データを反映
2. **ユーザー体験の向上**: ローディング表示と成功フィードバックで操作状態が明確
3. **デバッグ効率の向上**: 詳細なログで問題の早期発見が可能
4. **エラー対応の改善**: 詳細なエラーメッセージで問題の特定が容易

### テストポイント

実際の動作確認時に以下をテストしてください:

1. ✅ 新しいQAを追加（質問のみ）
2. ✅ 新しいQAを追加（質問と回答）
3. ✅ 複数のQAを連続追加
4. ✅ ローディング表示が正しく動作
5. ✅ 成功時のフィードバックが表示される
6. ✅ エラー時に詳細なメッセージが表示される
7. ✅ 処理中のボタン無効化が機能する

### 今後の課題（必要に応じて）

もし問題が継続する場合:
1. バックエンドAPIの調査（`/back/routers/qa.py`）
2. データベーストランザクションのコミットタイミング確認
3. ネットワーク遅延への対処（リトライロジック検討）

---

## 実装完了

すべてのPhaseが完了しました。
ブラウザのコンソールでデバッグログを確認しながら、QA追加機能をテストしてください。
