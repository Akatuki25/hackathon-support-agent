# ボトルネック分析結果

## ステータス: 🎯 **直接的な原因を確実に特定完了**

**最終更新**: 2025-10-06 01:01

---

## 問題: DBに保存できていない

「0個の機能を6カテゴリに分類」と表示され、機能がDBに保存されない

---

## 🎯 **直接的な原因（確定）**

### **Gemini 2.5 Flash Lite が `MALFORMED_FUNCTION_CALL` エラーを返している**

```python
'finish_reason': 'MALFORMED_FUNCTION_CALL'
'output_tokens': 0
'tool_calls': []
'invalid_tool_calls': []
```

### 証拠（ログ）

```
2025-10-06 01:00:38,808 | DEBUG | [AGENT] LAST MESSAGE DUMP: 
  content='' 
  response_metadata={
    'finish_reason': 'MALFORMED_FUNCTION_CALL', 
    'model_name': 'gemini-2.5-flash-lite'
  }
  tool_calls=[] 
  invalid_tool_calls=[]
  usage_metadata={
    'input_tokens': 10989, 
    'output_tokens': 0
  }

2025-10-06 01:00:38,809 | ERROR | [AGENT] CRITICAL: Gemini returned MALFORMED_FUNCTION_CALL error!
2025-10-06 01:00:38,810 | ERROR | [AGENT] This means the LLM tried to call a tool but the format was invalid.
```

---

## 詳細分析

### 何が起きているのか？

1. ✅ エージェントは25個の機能を抽出（Message 8まで成功）
2. ✅ 次のアクション（`structure_functions`または`add_structured_functions`）を実行しようとする
3. ❌ **Gemini APIがツール呼び出しのフォーマットエラーを返す**
4. ❌ `output_tokens: 0` → AIは何も出力できず
5. ❌ `tool_calls: []` → 有効なツール呼び出しなし
6. ❌ エージェントはエラーで停止
7. ❌ 結果: DBに何も保存されない

### なぜ `MALFORMED_FUNCTION_CALL` エラーが発生するのか？

考えられる根本原因:

#### 1. **入力トークン数が多すぎる（最有力）**
```
'input_tokens': 10989
```
- 約11Kトークンのコンテキスト
- Message 8の内容が4000文字（25個の機能のJSONデータ）
- 累積したメッセージ履歴が長すぎる
- Gemini 2.5 Flash Liteの関数呼び出し機能がコンテキスト長に敏感

#### 2. **ツールスキーマの複雑さ**
- 7つのツールが定義されている
- 各ツールのパラメータが複雑（特に`functions_json`）
- Gemini Flash Liteは複雑な関数スキーマに弱い可能性

#### 3. **LangChainとGeminiの関数呼び出し仕様の不一致**
- LangChainの`StructuredTool`から生成されるスキーマ
- Gemini APIが期待する関数スキーマ
- 変換過程で不正なフォーマットになっている可能性

#### 4. **JSONデータのエスケープ問題**
- `functions_json`パラメータに長いJSONデータを渡す
- Geminiがこれを正しく解析できない
- 特殊文字やエスケープ処理の問題

---

## 解決策の方向性

### 解決策1: **よりシンプルなツール設計**

**問題**: ツールが複雑すぎる（7つのツール、複雑なパラメータ）

**解決**:
- ツール数を減らす（3-4個に）
- `functions_json`パラメータを避け、個別のパラメータに分解
- ツールの責任を明確に分離

### 解決策2: **モデルをGemini Proに変更**

**問題**: Gemini 2.5 Flash Liteの関数呼び出し能力の制限

**解決**:
```python
# base_service.pyで
self.llm_pro = ChatGoogleGenerativeAI(model="gemini-2.0-pro-flash")

# function_structuring_service.pyで
self.agent_executor = create_react_agent(
    self.base_service.llm_pro,  # Flash LiteではなくProを使用
    self.tools
)
```

### 解決策3: **メッセージ履歴の圧縮**

**問題**: 累積したメッセージ履歴が長すぎる（10989トークン）

**解決**:
- 古いメッセージを要約
- 必要な情報だけを残す
- LangGraphの`state_modifier`で履歴を制限

### 解決策4: **エラーハンドリングの追加**

**問題**: `MALFORMED_FUNCTION_CALL`エラーで停止

**解決**:
- エラー時にリトライロジックを追加
- エージェントに明示的な指示を追加
- より単純なフォールバックパスを提供

---

## 推奨される実装順序

### 🥇 **最優先: モデルをGemini Proに変更**

理由:
- 最も簡単で効果的
- Flash Liteの制限を回避
- 他の修正と組み合わせ可能

### 🥈 **次: メッセージ履歴の圧縮**

理由:
- トークン数を削減
- 長期的に持続可能
- コスト削減にも貢献

### 🥉 **最後: ツール設計の簡略化**

理由:
- 最も手間がかかる
- 既存のロジックの大幅な変更が必要
- 上記2つで解決できる可能性が高い

---

## テスト計画

1. ✅ セッション競合エラーは解決済み
2. ❌ `MALFORMED_FUNCTION_CALL`エラーを解決
3. ⏳ 構造化・保存ツールの実行を確認
4. ⏳ DBへの保存を確認
5. ⏳ フロントエンドでの表示を確認

---

## 修正ファイル一覧

### Phase 1: セッション競合解決（完了）
- ✅ `database.py`: `get_db_session()`追加
- ✅ `services/function_structuring_service.py`: 7つのツールを独立セッション対応

### Phase 2: MALFORMED_FUNCTION_CALL解決（次のステップ）
- ⏳ `services/base_service.py`: llm_proの追加
- ⏳ `services/function_structuring_service.py`: エージェント作成時にllm_proを使用
- ⏳ メッセージ履歴圧縮ロジックの追加
