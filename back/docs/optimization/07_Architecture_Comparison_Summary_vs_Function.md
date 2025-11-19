# 仕様書(Summary)と機能要件(Function)のアーキテクチャ比較

## 概要

このドキュメントは、`summary_service.py`(仕様書生成)と`function_service.py`(機能要件生成)の根本的なアーキテクチャの違いを分析し、なぜこれらの違いが存在するのか、そして統一すべきかどうかを検討する。

## 1. 高レベルアーキテクチャ比較

### 1.1 データフロー図

#### 仕様書生成 (summary_service.py)

```
Q&Aリスト (DB)
    ↓
文字列結合 (simple concatenation)
    ↓
LLM (Gemini 2.0 Flash Thinking)
    ↓
StrOutputParser
    ↓
Markdown文字列
    ↓
DB保存 (specification)
```

#### 機能要件生成 (function_service.py)

```
仕様書 + Q&A (DB)
    ↓
コンテキスト構築
    ↓
LLM (Gemini 2.0 Flash Thinking) + ResponseSchema
    ↓
StructuredOutputParser
    ↓
JSON検証 + json_repair
    ↓
Pydantic Model (FunctionalRequirement)
    ↓
確信度評価 (confidence_level 0.0-1.0)
    ↓
低確信度項目 → 追加Q&A生成
    ↓
JSON → Markdown変換
    ↓
DB保存 (function_doc)
```

---

## 2. 詳細な技術的差異

### 2.1 スキーマ設計

| 側面 | Summary Service | Function Service |
|-----|----------------|------------------|
| **入力スキーマ** | 非構造化 (文字列連結) | 構造化 (Pydantic Models) |
| **出力スキーマ** | なし (自由形式Markdown) | 厳密なJSON Schema |
| **バリデーション** | なし | ResponseSchema + Pydantic |
| **型安全性** | 低 | 高 |

#### Summary Service - スキーマなし

```python
# back/services/summary_service.py:63-89
async def generate_summary_from_qa_list(
    self,
    question_answer: List[Union[dict, BaseModel]]
) -> str:
    """Q&Aリストから仕様書を生成"""
    question_answer_str = ""
    for item in question_answer:
        if hasattr(item, "question") and hasattr(item, "answer"):
            question_answer_str += f"Q: {item.question}\nA: {item.answer}\n\n"
        elif isinstance(item, dict):
            question_answer_str += f"Q: {item.get('question', '')}\nA: {item.get('answer', '')}\n\n"

    # プロンプトから直接Markdownを生成
    chain = summary_system_prompt | self.llm_pro | StrOutputParser()
    summary = await chain.ainvoke({"question_answer": question_answer_str})
    return summary  # 文字列として返される
```

#### Function Service - 厳密なスキーマ定義

```python
# back/services/function_service.py:60-115
def generate_functional_requirements(
    self,
    project_id: str,
    confidence_threshold: float = 0.7
) -> Dict[str, Any]:
    """仕様書から機能要件を生成（構造化出力）"""

    # 1. ResponseSchemaで出力構造を定義
    response_schemas = [
        ResponseSchema(
            name="requirements",
            type="array(objects)",
            description=(
                "機能要件のリスト。各要素は以下のフィールドを持つ: "
                "requirement_id (string), category (string), title (string), "
                "description (string), priority (string: Must/Should/Could), "
                "confidence_level (float 0.0-1.0), "
                "acceptance_criteria (array of strings), "
                "dependencies (array of requirement_ids)"
            )
        ),
        ResponseSchema(
            name="overall_confidence",
            type="float",
            description="全体の確信度 0.0-1.0"
        )
    ]

    # 2. StructuredOutputParserでJSONパース
    parser = StructuredOutputParser.from_response_schemas(response_schemas)
    format_instructions = parser.get_format_instructions()

    # 3. LLM実行
    chain = prompt_template | self.llm_flash_thinking | parser
    result = chain.invoke({
        "specification": project_doc.specification,
        "qa_context": qa_context_str,
        "format_instructions": format_instructions
    })

    # 4. JSON修復処理
    if not isinstance(result.get("requirements"), list):
        from json_repair import repair_json
        repaired = repair_json(
            json_like_string=str(result["requirements"]),
            array_root=True
        )
        result["requirements"] = repaired

    return result  # 構造化JSON
```

### 2.2 データ処理パイプライン

#### Summary Service - シンプルなパイプライン

```python
# back/services/summary_service.py:63-112
入力 (Q&A List)
  → 文字列結合
  → LLM
  → StrOutputParser
  → Markdown文字列
  → DB保存
```

**特徴:**
- 中間フォーマットなし
- 検証レイヤーなし
- 直接Markdownとして保存
- 処理ステップが少ない = シンプル

#### Function Service - 複雑なパイプライン

```python
# back/services/function_service.py:60-209
入力 (Specification + Q&A)
  → コンテキスト構築
  → LLM (with ResponseSchema)
  → StructuredOutputParser
  → JSON検証
  → json_repair (エラー時)
  → Pydantic Model変換
  → 確信度評価
  → 低確信度項目フィルタリング
  → 追加Q&A生成
  → JSON → Markdown変換
  → DB保存
```

**特徴:**
- 複数の中間フォーマット (JSON → Pydantic → Markdown)
- 多層の検証レイヤー
- エラー修復機構
- 処理ステップが多い = 複雑だが堅牢

### 2.3 エラーハンドリング

#### Summary Service - 最小限のエラー処理

```python
# back/services/summary_service.py
try:
    summary = await chain.ainvoke({"question_answer": question_answer_str})
    return summary
except Exception as e:
    logger.error(f"仕様書生成エラー: {e}")
    raise
```

**特徴:**
- LLMエラーをそのまま伝播
- 出力検証なし
- JSON修復なし

#### Function Service - 多段階エラー処理

```python
# back/services/function_service.py:60-209
try:
    # 1. LLM実行
    result = chain.invoke({...})

    # 2. JSON検証
    if not isinstance(result.get("requirements"), list):
        logger.warning("requirements が list 型ではありません。修復を試みます。")
        from json_repair import repair_json
        repaired = repair_json(
            json_like_string=str(result["requirements"]),
            array_root=True
        )
        result["requirements"] = repaired

    # 3. 各要件のバリデーション
    for req in result["requirements"]:
        if not isinstance(req.get("acceptance_criteria"), list):
            req["acceptance_criteria"] = []
        if not isinstance(req.get("dependencies"), list):
            req["dependencies"] = []

    return result

except json.JSONDecodeError as e:
    logger.error(f"JSON パースエラー: {e}")
    # フォールバック処理

except Exception as e:
    logger.error(f"機能要件生成エラー: {e}")
    raise
```

**特徴:**
- JSON修復ライブラリ使用
- フィールドごとの検証
- フォールバック機構
- 詳細なログ記録

### 2.4 確信度トラッキング

#### Summary Service - 確信度なし

```python
# summary_service.py には confidence_level の概念が存在しない
async def generate_summary_from_qa_list(...) -> str:
    summary = await chain.ainvoke({"question_answer": question_answer_str})
    return summary  # 文字列のみ
```

#### Function Service - 確信度ベースのQ&A生成

```python
# back/services/function_service.py:116-167
def generate_functional_requirements(...) -> Dict[str, Any]:
    result = chain.invoke({...})

    # 確信度の低い項目を抽出
    low_confidence_requirements = [
        req for req in result["requirements"]
        if req.get("confidence_level", 1.0) < confidence_threshold
    ]

    # 追加Q&Aを自動生成
    if low_confidence_requirements:
        clarification_questions = self._generate_clarification_questions(
            low_confidence_requirements
        )
        return {
            "requirements": result["requirements"],
            "overall_confidence": result["overall_confidence"],
            "clarification_questions": clarification_questions,
            "low_confidence_count": len(low_confidence_requirements)
        }
```

**理由:**
- 機能要件は仕様書よりも具体的 → 不確実性が高い
- 自動的に不足情報を検知して追加質問を生成
- ユーザーが回答 → 再生成で精度向上

### 2.5 ストレージ戦略

#### Summary Service - 直接Markdown保存

```python
# back/services/summary_service.py:198-228
async def save_summary_to_project_document(
    self,
    project_id: str,
    summary: str  # Markdown文字列
) -> ProjectDocument:
    project_doc = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_uuid
    ).first()

    if not project_doc:
        project_doc = ProjectDocument(
            project_id=project_uuid,
            specification=summary  # 直接保存
        )
    else:
        project_doc.specification = summary
        project_doc.specification_updated_at = datetime.utcnow()

    db.commit()
    return project_doc
```

#### Function Service - JSON → Markdown変換保存

```python
# back/services/function_service.py:234-274
def save_functional_requirements_to_document(
    self,
    project_id: str,
    requirements: List[Dict]  # JSON配列
) -> ProjectDocument:
    # 1. JSONをMarkdownに変換
    requirements_md = self._format_requirements_as_markdown(requirements)

    # 2. Markdownとして保存
    project_doc.function_doc = requirements_md
    project_doc.function_doc_updated_at = datetime.utcnow()

    db.commit()
    return project_doc

def _format_requirements_as_markdown(
    self,
    requirements: List[Dict]
) -> str:
    """JSONをMarkdownに変換"""
    md_lines = ["# 機能要件書\n"]

    for req in requirements:
        md_lines.append(f"## {req['requirement_id']}: {req['title']}")
        md_lines.append(f"**カテゴリ**: {req['category']}")
        md_lines.append(f"**優先度**: {req['priority']}")
        md_lines.append(f"**確信度**: {req['confidence_level']:.2f}")
        md_lines.append(f"\n{req['description']}\n")
        # ... 省略

    return "\n".join(md_lines)
```

**疑問点:**
- **なぜJSONで保存しないのか？**
  - DBスキーマ上 `function_doc` は `String` 型
  - フロントエンドでの表示・編集がMarkdownの方が扱いやすい
  - 構造化データとしての利用が将来必要なら `JSONB` 型への移行が必要

---

## 3. 差分更新の実装状況

### 3.1 Summary Service - 実装済み

#### ユーザー編集保存

```python
# back/routers/summary.py:75-103
@router.post("/save")
def save_summary(
    request: SummarySaveRequest,
    db: Session = Depends(get_db)
):
    """ユーザーが編集した仕様書を保存"""
    summary_service = SummaryService(db=db)
    result = asyncio.run(
        summary_service.save_summary_to_project_document(
            project_id=request.project_id,
            summary=request.summary
        )
    )
    return {"message": "Summary saved successfully", ...}
```

#### AI差分更新

```python
# back/routers/summary.py:149-187
@router.post("/update-qa-and-regenerate")
async def update_summary_with_qa(
    request: SummaryUpdateRequest,
    db: Session = Depends(get_db)
):
    """追加Q&Aと手動差分を反映して仕様書を更新"""
    summary_service = SummaryService(db=db)

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

#### 差分更新のプロンプト設計

```python
# back/services/summary_service.py:230-298
async def update_summary_with_diff(
    self,
    project_id: str,
    manual_diff: Optional[str] = None,
    new_qa: Optional[List[QA]] = None
) -> str:
    """既存の仕様書に差分を適用"""

    # 既存の仕様書を取得
    project_doc = self.db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_uuid
    ).first()

    existing_spec = project_doc.specification

    # 差分情報を構築
    diff_info = ""
    if new_qa:
        diff_info += "## 新しく追加されたQ&A:\n"
        for qa in new_qa:
            diff_info += f"Q: {qa.question}\nA: {qa.answer}\n\n"

    if manual_diff:
        diff_info += f"## 手動で指定された変更点:\n{manual_diff}\n\n"

    # プロンプトで差分更新を指示
    prompt_text = f"""
既存の仕様書に対して、以下の新しい情報を反映して更新してください。

## 既存の仕様書:
{existing_spec}

{diff_info}

既存の仕様書の構造を保ちつつ、新しい情報を適切に反映してください。
変更が必要ない部分はそのまま残してください。
Markdown形式で出力してください。
"""

    chain = ChatPromptTemplate.from_template(prompt_text) | self.llm_pro | StrOutputParser()
    updated_spec = await chain.ainvoke({})

    return updated_spec
```

### 3.2 Function Service - 未実装

#### 現状の問題

```python
# back/routers/function_requirements.py
# ✅ 実装済み
@router.post("/generate")  # 新規生成のみ
@router.post("/generate-and-save")  # 生成+保存
@router.post("/regenerate")  # 完全再生成（差分ではない）

# ❌ 未実装
# @router.post("/save")  # ユーザー編集保存
# @router.post("/update-with-spec")  # 仕様書変更時の差分更新
```

#### 必要な実装

ドキュメント `06_Function_Requirements_Update_API.md` に詳細設計が記載されているが、`function_service.py` には差分更新メソッドが存在しない。

**必要なメソッド:**

```python
# back/services/function_service.py (追加が必要)
async def update_function_doc_with_spec_diff(
    self,
    project_id: str,
    specification_diff: Optional[str] = None
) -> str:
    """仕様書の変更に基づいて機能要件を差分更新"""

    # 既存の機能要件書と仕様書を取得
    project_doc = self.db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_uuid
    ).first()

    if not project_doc.function_doc or not project_doc.specification:
        raise ValueError("機能要件書または仕様書が存在しません")

    # 差分更新プロンプト
    prompt_text = f"""
既存の機能要件書に対して、仕様書の変更を反映して更新してください。

## 既存の機能要件書:
{project_doc.function_doc}

## 仕様書の変更:
{specification_diff}

## 最新の仕様書:
{project_doc.specification}

既存の機能要件書の構造を保ちつつ、仕様書の変更に対応する部分のみを更新してください。
変更が必要ない部分はそのまま残してください。
Markdown形式で出力してください。
"""

    chain = ChatPromptTemplate.from_template(prompt_text) | self.llm_pro | StrOutputParser()
    updated_doc = await chain.ainvoke({})

    return updated_doc
```

---

## 4. なぜこの違いが存在するのか

### 4.1 歴史的経緯（推測）

1. **仕様書が先に開発された**
   - シンプルなMarkdown生成で十分だった
   - Q&Aから仕様書への変換は自然言語処理のみ

2. **機能要件は後から追加された**
   - より詳細で構造化されたデータが必要
   - 確信度トラッキングの要件が発生
   - エラーハンドリングの重要性が認識された

### 4.2 技術的必然性

| 側面 | Summary | Function |
|-----|---------|----------|
| **データの性質** | 自由記述 | 構造化データ |
| **出力の一貫性** | 低要求 | 高要求 |
| **後続処理** | なし | タスク生成など |
| **エラー影響** | 低 | 高 |

**機能要件が構造化を必要とする理由:**

1. **後続処理への依存**
   - 機能要件 → 機能一覧 (function_structure) への変換
   - タスク生成への入力
   - 依存関係の解析

2. **確信度ベースのQ&A生成**
   - 各要件に `confidence_level` が必要
   - 閾値による自動フィルタリング
   - プログラマティックな処理が不可欠

3. **優先度管理**
   - Must/Should/Could の分類
   - 後続のタスク優先順位に影響

---

## 5. 統一すべきか？それとも現状維持か？

### 5.1 統一する場合のメリット

#### パターンA: Function Service を Summary 風にシンプル化

**メリット:**
- コードの複雑性が下がる
- LLMトークン消費が減少（ResponseSchema が不要）
- メンテナンスコストが下がる

**デメリット:**
- 確信度トラッキングが失われる
- 自動Q&A生成機能が失われる
- 後続処理（機能一覧生成、タスク生成）でのパースが困難
- エラーハンドリングが脆弱になる

**結論:** ❌ **推奨しない**

#### パターンB: Summary Service を Function 風に構造化

**メリット:**
- 仕様書にも確信度トラッキング導入可能
- 構造化データとして再利用しやすい
- API設計が統一される

**デメリット:**
- 既存の仕様書が全てMarkdown → JSON変換が必要
- DBマイグレーションが必要 (`specification` を JSONB 型に)
- 過剰な複雑化（仕様書は自由記述で十分）
- LLMトークン消費が増加

**結論:** ❌ **推奨しない**

### 5.2 現状維持 + 差分更新の統一（推奨）

**方針:**
- Summary と Function の**内部実装は異なるまま**にする
- ただし、**API設計は統一**する

**統一すべきAPI:**

| エンドポイント | Summary | Function | 説明 |
|--------------|---------|----------|------|
| `POST /generate` | ✅ `POST /` | ✅ `POST /generate` | 新規生成 |
| `POST /save` | ✅ | ❌ **追加必要** | ユーザー編集保存 |
| `POST /update-*` | ✅ `update-qa-and-regenerate` | ❌ **追加必要** `update-with-spec` | AI差分更新 |
| `POST /regenerate` | ✅ `generate-with-feedback` | ✅ `regenerate` | 完全再生成 |

**実装方針:**

1. **`POST /api/function_requirements/save`** を追加
   - Summary Service の `/save` と同じ設計
   - ユーザー編集を直接保存

2. **`POST /api/function_requirements/update-with-spec`** を追加
   - Summary Service の `/update-qa-and-regenerate` と同じパターン
   - 仕様書変更時の差分更新
   - **ただし、内部では Markdown ベースで処理**（JSON構造は保持しない）

3. **差分更新のプロンプト設計を統一**
   - 両サービスで同じパターンの差分適用ロジック
   - "既存ドキュメント + 差分情報 → 更新版" の形式

---

## 6. 05_Setup_Flow_Navigation_Design.md との整合性

### 6.1 セットアップフローとの関係

ドキュメント `05_Setup_Flow_Navigation_Design.md` の設計では:

```
Q&A → 仕様書 → 機能要件 → 機能一覧
 ↑      ↑        ↑         ↑
 └──────┴────────┴─────────┘
   Q&A変更時は全て削除
```

**影響:**

1. **Q&A変更 → 仕様書削除**
   - Summary Service: `/update-qa-and-regenerate` で対応済み
   - 再生成時は `POST /` で新規生成

2. **仕様書変更 → 機能要件削除（オプション）**
   - Function Service: `/update-with-spec` が必要
   - 完全削除ではなく、差分更新を選択可能

3. **後続ドキュメント削除API**

```python
# back/routers/project/project_document.py (追加が必要)
@router.delete("/project_document/{project_id}/downstream")
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

## 7. 推奨実装計画

### Phase 1: API統一（必須）

#### 1.1 Function Requirements に不足しているエンドポイントを追加

```python
# back/routers/function_requirements.py

class FunctionDocSaveRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    function_doc: str  # Markdown

@router.post("/save")
def save_function_document(
    request: FunctionDocSaveRequest,
    db: Session = Depends(get_db)
):
    """ユーザー編集した機能要件書を保存"""
    # 実装は 06_Function_Requirements_Update_API.md を参照
    pass
```

```python
class FunctionDocUpdateWithSpecRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    specification_diff: Optional[str] = None

@router.post("/update-with-spec")
async def update_function_doc_with_spec(
    request: FunctionDocUpdateWithSpecRequest,
    db: Session = Depends(get_db)
):
    """仕様書変更時に機能要件を差分更新"""
    # 実装は 06_Function_Requirements_Update_API.md を参照
    pass
```

#### 1.2 Project Document に後続削除エンドポイントを追加

```python
# back/routers/project/project_document.py

@router.delete("/project_document/{project_id}/downstream")
async def delete_downstream_documents(
    project_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Q&A変更時に後続ドキュメントを削除"""
    # 実装は 05_Setup_Flow_Navigation_Design.md を参照
    pass
```

### Phase 2: フロントエンド対応（必須）

```typescript
// front/src/libs/service/function.ts

/**
 * ユーザーが編集した機能要件ドキュメントを保存する
 */
export const saveFunctionDocument = async (
  projectId: string,
  functionDoc: string
): Promise<{ message: string; project_id: string; doc_id: string }> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/save`,
    {
      project_id: projectId,
      function_doc: functionDoc
    }
  );
  return response.data;
};

/**
 * 仕様書の変更に基づいて機能要件を差分更新する
 */
export const updateFunctionDocWithSpec = async (
  projectId: string,
  specificationDiff?: string
): Promise<{
  message: string;
  function_doc: string;
  project_id: string;
  doc_id: string;
}> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/function_requirements/update-with-spec`,
    {
      project_id: projectId,
      specification_diff: specificationDiff
    }
  );
  return response.data;
};
```

### Phase 3: ドキュメントの更新（推奨）

- [ ] `06_Function_Requirements_Update_API.md` の実装コードを最終化
- [ ] 本ドキュメント (`07_Architecture_Comparison_Summary_vs_Function.md`) をチームで共有
- [ ] API仕様書の更新 (Swagger/OpenAPI)

---

## 8. まとめ

### 8.1 根本的な違い

| 側面 | Summary Service | Function Service |
|-----|----------------|------------------|
| **データモデル** | 自由記述Markdown | 構造化JSON → Markdown |
| **スキーマ** | なし | ResponseSchema + Pydantic |
| **確信度** | なし | 0.0-1.0 + 自動Q&A生成 |
| **エラー処理** | 最小限 | JSON修復 + 多段階検証 |
| **パイプライン** | シンプル (3ステップ) | 複雑 (10+ステップ) |

### 8.2 なぜこの違いが存在するのか

- **仕様書**: 自然言語の要約で十分
- **機能要件**: 後続処理（タスク生成等）のために構造化が必要

### 8.3 推奨アプローチ

✅ **内部実装は異なるまま + API設計を統一**

- Summary と Function の技術的必然性は異なる
- 無理に統一すると複雑化 or 機能劣化
- ただし、ユーザー向けAPIは統一してUX改善

### 8.4 次のアクション

1. **`POST /api/function_requirements/save` を実装**
2. **`POST /api/function_requirements/update-with-spec` を実装**
3. **`DELETE /project_document/{project_id}/downstream` を実装**
4. **フロントエンドの `saveFunctionDocument` と `updateFunctionDocWithSpec` を追加**
5. **05_Setup_Flow_Navigation_Design.md の双方向ナビゲーションと統合**

---

## 変更履歴

- 2025-01-14: 初版作成
