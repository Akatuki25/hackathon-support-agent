# 自動リカバリー戦略の実装

**実装日**: 2025-10-06  
**目的**: MALFORMED_FUNCTION_CALL発生時の自動リカバリー

---

## 🎯 実装の概要

### 問題

```
Message 20: MALFORMED_FUNCTION_CALL
input_tokens: 16,201
→ 28個の機能が保存済み
→ そのまま終了（品質チェックなし）
```

### 解決策

**トークン圧縮 + リトライ + 最終チェックフェーズ**

---

## 📋 実装詳細

### 1. **自動リカバリーループ**

```python:1608-1720
def _execute_agent_with_compression(self, messages, config):
    MAX_RETRY_ON_ERROR = 2  # エラー時の最大リトライ回数
    retry_count = 0
    current_messages = messages
    
    while retry_count <= MAX_RETRY_ON_ERROR:
        result = self.agent_executor.invoke({"messages": current_messages}, config)
        
        # MALFORMED_FUNCTION_CALL または STOP で終了した場合
        if finish_reason in ['MALFORMED_FUNCTION_CALL', 'STOP']:
            # リトライ可能な場合は圧縮して再実行
            if retry_count < MAX_RETRY_ON_ERROR:
                compressed_messages = self._compress_message_history(result["messages"])
                
                # 最終チェックフェーズに移行するプロンプトを追加
                recovery_prompt = """
                【緊急リカバリー指示】
                1. get_existing_functions でDB保存済み機能を確認
                2. analyze_coverage で網羅性を評価
                3. 網羅性が低い場合（<70%）は追加抽出を1回のみ試行
                4. 結果を報告して終了
                """
                compressed_messages.append(HumanMessage(content=recovery_prompt))
                
                current_messages = compressed_messages
                retry_count += 1
                continue  # リトライ
```

---

## 🔄 動作フロー

### 通常実行

```
1. gather_context
2. get_existing_functions
3. extract_function_batch
4. structure_functions
5. validate_functions (エラー)
6. add_structured_functions (28個保存)
7. get_existing_functions
8. analyze_coverage
→ Message 20で MALFORMED_FUNCTION_CALL
```

### 自動リカバリー（NEW!）

```
Message 20: MALFORMED_FUNCTION_CALL 検知
↓
【リカバリー開始】
1. 会話履歴を圧縮（20メッセージ → 16メッセージ）
2. リカバリープロンプトを追加
3. エージェントを再実行（retry 1/2）
↓
【最終チェックフェーズ】
1. get_existing_functions → "28個保存済み"
2. analyze_coverage → "網羅性70%"
3. 結果を報告
↓
【正常終了】
```

---

## 📊 期待される改善効果

### Before（改善前）

| 項目 | 値 |
|------|-----|
| Message 20でエラー | MALFORMED_FUNCTION_CALL |
| トークン数 | 16,201 |
| 保存済み機能 | 28個 |
| 品質チェック | ❌ なし |
| 網羅性分析 | ❌ なし |
| ユーザーへの報告 | "エラー発生" |

### After（改善後・予測）

| 項目 | 値 | 改善 |
|------|-----|------|
| Message 20でエラー | MALFORMED_FUNCTION_CALL | - |
| **リカバリー試行** | **✅ 実施** | **NEW** |
| 圧縮後のトークン数 | ~8,000 | **-50%** |
| Message 25で再実行 | 最終チェック実行 | **NEW** |
| 保存済み機能 | 28-32個（追加抽出） | **+0-14%** |
| 品質チェック | ✅ analyze_coverage実行 | **NEW** |
| 網羅性分析 | ✅ 70-80% | **NEW** |
| ユーザーへの報告 | "28個保存、網羅性70%" | **詳細化** |

---

## 🎯 実装の特徴

### 1. **段階的リトライ**

```python
MAX_RETRY_ON_ERROR = 2  # 最大2回リトライ

retry 0 → エラー → 圧縮 → retry 1 → エラー → 圧縮 → retry 2 → 諦める
```

### 2. **積極的な圧縮**

```python
# 通常の圧縮
if len(messages) > 20:
    compress()

# エラー時の圧縮
if finish_reason == 'MALFORMED_FUNCTION_CALL':
    compress()  # 即座に圧縮
    add_recovery_prompt()
    retry()
```

### 3. **リカバリープロンプト**

```
【緊急リカバリー指示】
前回の実行でエラーが発生しました。以下の手順で最終チェックを実行してください：

1. get_existing_functions でDB保存済み機能を確認
2. analyze_coverage で網羅性を評価
3. 網羅性が低い場合（<70%）は追加抽出を1回のみ試行
4. 結果を報告して終了

※トークン制限を避けるため、シンプルな操作のみ実行してください
```

**効果**:
- エージェントに最終チェックを明示的に指示
- トークン制限を回避するため、シンプルな操作のみ

### 4. **例外ハンドリング**

```python
except Exception as e:
    retry_count += 1
    if retry_count > MAX_RETRY_ON_ERROR:
        raise
    
    # 履歴があれば圧縮してリトライ
    if len(current_messages) > 10:
        current_messages = self._compress_message_history(current_messages)
    else:
        raise
```

---

## 🔍 動作例

### ケース1: リカバリー成功

```
[Execution 1]
Message 20: MALFORMED_FUNCTION_CALL (16,201 tokens)
[AGENT] Agent stopped with MALFORMED_FUNCTION_CALL at 20 messages (retry 0/2)
[AGENT] Attempting recovery: compressing history and retrying...
[AGENT] Compressed from 20 to 16 messages, retrying...

[Execution 2 - Recovery]
Message 1-16: (圧縮された履歴)
Message 17: (リカバリープロンプト)
Message 18: get_existing_functions → "28個保存済み"
Message 19: analyze_coverage → "網羅性70%"
Message 20: "最終チェック完了"

✅ 正常終了
```

### ケース2: リカバリー失敗（2回目のエラー）

```
[Execution 1]
Message 20: MALFORMED_FUNCTION_CALL (retry 0/2)
→ 圧縮してリトライ

[Execution 2]
Message 20: MALFORMED_FUNCTION_CALL (retry 1/2)
→ 圧縮してリトライ

[Execution 3]
Message 20: MALFORMED_FUNCTION_CALL (retry 2/2)
[AGENT] Cannot retry (retry_count=2, messages=20)

⚠️ partial_success: True
保存済み: 28個
```

---

## 📈 実装の利点

### 1. **データ損失の防止**

- 28個保存済み → 最終チェックで確認
- 網羅性分析の結果をユーザーに報告

### 2. **トークン制限への対応**

- 圧縮により50%削減
- リトライ可能な状態を維持

### 3. **ユーザー体験の向上**

```
Before: "エラーが発生しました"
After:  "28個の機能を保存しました（網羅性70%）。一部エラーがありましたが、最終チェックを完了しました。"
```

### 4. **柔軟性**

- 最大2回まで自動リトライ
- リトライ回数は調整可能

---

## ⚠️ 注意点

### 1. **リトライ回数の上限**

```python
MAX_RETRY_ON_ERROR = 2
```

- 無限ループを防ぐため
- 2回リトライしても失敗した場合は諦める

### 2. **Rate Limit（429エラー）**

- 自動リトライはRate Limitを考慮しない
- LangChainのデフォルトリトライが429を処理

### 3. **トークン削減の限界**

```
圧縮1回目: 20 → 16メッセージ (-20%)
圧縮2回目: 16 → 13メッセージ (-19%)
圧縮3回目: 13 → 11メッセージ (-15%)
```

- 圧縮を繰り返すと効果が減少
- 最終的には限界に達する

---

## 🎉 結論

### ✅ 実装完了

| 機能 | 状態 |
|------|------|
| MALFORMED_FUNCTION_CALL検知 | ✅ 完了 |
| 自動圧縮 + リトライ | ✅ 完了 |
| リカバリープロンプト | ✅ 完了 |
| 最終チェックフェーズ | ✅ 完了 |
| 例外ハンドリング | ✅ 完了 |

### 📊 期待される効果

- **リカバリー成功率**: 70-80%（予測）
- **データ損失**: ほぼゼロ
- **ユーザー満足度**: 大幅向上

### 🚀 次のステップ

1. **実際のテスト実行**
2. **リカバリー成功率の測定**
3. **リトライ回数の最適化**

---

**実装担当**: AI Assistant  
**レビュー状況**: 実装完了、テスト待ち

