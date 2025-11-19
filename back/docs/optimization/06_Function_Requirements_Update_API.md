# 機能要件書の更新API設計

## 問題点

### 現状の仕様書と機能要件書の違い

| 機能 | 仕様書 (`/api/summary`) | 機能要件 (`/api/function_requirements`) |
|------|------------------------|----------------------------------------|
| 生成のみ | `POST /` | `POST /generate` |
| 生成+保存 | `POST /save` (保存のみ) | `POST /generate-and-save` |
| ユーザー編集の保存 | ✅ `POST /save` | ❌ **無い** |
| AI差分更新 | ✅ `POST /update-qa-and-regenerate` | ❌ **無い** |
| 再生成 | `POST /generate-with-feedback` | `POST /regenerate` |

**問題:**
- 仕様書は以下の2種類の更新機能がある:
  1. **`POST /save`**: ユーザーが手動で編集した内容を保存
  2. **`POST /update-qa-and-regenerate`**: 追加Q&A → AIが差分ベースで仕様書を更新
- 機能要件は両方とも無い

### なぜ問題か

**新しいセットアップフロー設計(`05_Setup_Flow_Navigation_Design.md`)では:**

1. **ユーザーが機能要件を手動編集して「次へ」**
   - 編集内容をそのまま保存する必要がある
   - 現状: `/save`エンドポイントが無い

2. **仕様書が変更された場合**
   - 機能要件をAIが差分ベースで更新する必要がある (完全再生成ではなく)
   - 現状: 差分更新エンドポイントが無い (`/regenerate`は完全再生成)

**仕様書の実装 (`back/services/summary_service.py`):**
- `save_summary_to_project_document`: ユーザー編集を保存
- `update_summary_with_diff`: 追加Q&Aや手動編集の差分をAIが反映
- `update_summary_with_diff_cached`: Context Cachingを使った差分更新

**機能要件の実装 (`back/services/function_service.py`):**
- `save_functional_requirements_to_document`: 生成された要件をMarkdownに変換して保存
- ❌ **差分更新メソッド無し**

---

## 解決策: 仕様書と統一したAPI設計

### 実装する機能

1. **`POST /save`**: ユーザーが編集した機能要件書を保存
2. **`POST /update-with-spec`**: 仕様書変更時にAIが機能要件を差分更新

### 1. ユーザー編集の保存エンドポイント

#### バックエンド

```python
# back/routers/function_requirements.py

class FunctionDocSaveRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    function_doc: str  # Markdown形式の機能要件書

@router.post("/save")
def save_function_document(
    request: FunctionDocSaveRequest,
    db: Session = Depends(get_db)
):
    """
    ユーザーが編集した機能要件ドキュメントを保存する

    Args:
        project_id: プロジェクトID
        function_doc: 更新後の機能要件書（Markdown）

    Returns:
        保存完了メッセージ
    """
    from models.project_base import ProjectDocument
    from datetime import datetime

    try:
        # project_idをUUIDに変換
        if isinstance(request.project_id, str):
            project_uuid = uuid.UUID(request.project_id)
        else:
            project_uuid = request.project_id

        # プロジェクトドキュメントを取得
        project_doc = db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if not project_doc:
            # ドキュメントが存在しない場合は作成
            project_doc = ProjectDocument(
                project_id=project_uuid,
                function_doc=request.function_doc
            )
            db.add(project_doc)
        else:
            # 既存のドキュメントを更新
            project_doc.function_doc = request.function_doc
            project_doc.function_doc_updated_at = datetime.utcnow()

        db.commit()
        db.refresh(project_doc)

        return {
            "message": "Function document saved successfully",
            "doc_id": str(project_doc.doc_id),
            "project_id": str(project_doc.project_id)
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
```

#### フロントエンド

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
```

---

### 2. AI差分更新エンドポイント

仕様書が変更された場合、機能要件をAIが差分ベースで更新します。

#### バックエンド (サービス層)

```python
# back/services/function_service.py

async def update_function_doc_with_spec_diff(
    self,
    project_id: str,
    specification_diff: Optional[str] = None
) -> str:
    """
    仕様書の変更に基づいて機能要件を差分更新する

    Args:
        project_id: プロジェクトID
        specification_diff: 仕様書の差分情報

    Returns:
        更新された機能要件書（Markdown）
    """
    from langchain.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser

    project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id

    # 既存の機能要件書と仕様書を取得
    project_doc = self.db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_uuid
    ).first()

    if not project_doc or not project_doc.function_doc:
        raise ValueError(f"No function document found for project_id: {project_id}")

    if not project_doc.specification:
        raise ValueError(f"No specification found for project_id: {project_id}")

    # 差分がない場合は既存の機能要件書を返す
    if not specification_diff:
        return project_doc.function_doc

    # プロンプトで差分更新を指示
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

    # LLMで更新
    prompt_template = ChatPromptTemplate.from_template(template=prompt_text)
    chain = prompt_template | self.llm_pro | StrOutputParser()
    updated_function_doc = await chain.ainvoke({})

    return updated_function_doc
```

#### バックエンド (ルーター)

```python
# back/routers/function_requirements.py

class FunctionDocUpdateWithSpecRequest(BaseModel):
    project_id: Union[str, uuid.UUID]
    specification_diff: Optional[str] = None  # 仕様書の差分情報

@router.post("/update-with-spec")
async def update_function_doc_with_spec(
    request: FunctionDocUpdateWithSpecRequest,
    db: Session = Depends(get_db)
):
    """
    仕様書の変更に基づいて機能要件を差分更新し、自動保存する

    Args:
        project_id: プロジェクトID
        specification_diff: 仕様書の差分情報

    Returns:
        更新された機能要件書
    """
    function_service = FunctionService(db=db)

    try:
        if isinstance(request.project_id, str):
            project_id_str = request.project_id
        else:
            project_id_str = str(request.project_id)

        # 差分更新
        updated_doc = await function_service.update_function_doc_with_spec_diff(
            project_id=project_id_str,
            specification_diff=request.specification_diff
        )

        # 自動保存
        project_uuid = uuid.UUID(project_id_str)
        project_doc = db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()

        if project_doc:
            project_doc.function_doc = updated_doc
            project_doc.function_doc_updated_at = datetime.utcnow()
            db.commit()
            db.refresh(project_doc)

        return {
            "message": "Function document updated successfully",
            "function_doc": updated_doc,
            "project_id": str(project_uuid),
            "doc_id": str(project_doc.doc_id) if project_doc else None
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
```

#### フロントエンド

```typescript
// front/src/libs/service/function.ts

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

---

## 実装後の統一されたAPI構成

| エンドポイント | 仕様書 | 機能要件 | 説明 |
|--------------|--------|---------|------|
| `POST /generate` | `POST /` | ✅ `POST /generate` | Q&Aから新規生成 |
| `POST /save` | ✅ | ✅ **NEW** | ユーザー編集の保存 |
| `POST /generate-and-save` | ❌ | ✅ | 生成 + 保存を一括実行 |
| `POST /regenerate` | `POST /generate-with-feedback` | ✅ | 再生成 + 自動保存 |
| `POST /update-*` | ✅ `update-qa-and-regenerate` | ✅ **NEW** `update-with-spec` | AI差分更新 |
| `POST /confidence-feedback` | ✅ | ✅ | フィードバック生成 |

---

## 実装手順

### 1. バックエンド（必須）

- [ ] `FunctionDocSaveRequest` モデルを追加 (`back/routers/function_requirements.py`)
- [ ] `POST /save` エンドポイントを実装
- [ ] `FunctionDocUpdateWithSpecRequest` モデルを追加
- [ ] `update_function_doc_with_spec_diff` メソッドを実装 (`back/services/function_service.py`)
- [ ] `POST /update-with-spec` エンドポイントを実装
- [ ] `datetime.utcnow()` のimportを確認

### 2. フロントエンド（必須）

- [ ] `saveFunctionDocument` 関数を実装 (`front/src/libs/service/function.ts`)
- [ ] `updateFunctionDocWithSpec` 関数を実装
- [ ] 既存の `updateFunctionDocument` を **削除または非推奨化**

### 3. 各ページでの利用（必須）

```tsx
// front/src/app/hackSetUp/[ProjectId]/functionSummary/page.tsx

const handleNext = async () => {
  if (isDirty) {
    // ユーザー編集を保存
    await saveFunctionDocument(projectId, functionDoc);
    setIsDirty(false);
  }

  await generateDocumentForStep('function_structure', projectId);
  router.push(`/hackSetUp/${projectId}/functionStructure`);
};

// 仕様書変更時の自動更新 (オプション)
const handleSpecificationChange = async (specDiff: string) => {
  const result = await updateFunctionDocWithSpec(projectId, specDiff);
  setFunctionDoc(result.function_doc);
};
```

### 4. テスト

- [ ] 機能要件を手動編集して「次へ」を押す
- [ ] DBに保存されるか確認
- [ ] 仕様書を変更して差分更新が動作するか確認
- [ ] 前のページに戻って再度確認（編集内容が保持されているか）

---

## まとめ

**現状の問題:**
- 機能要件にはユーザー編集の保存エンドポイントが無い
- 機能要件にはAI差分更新エンドポイントが無い
- 仕様書とAPI設計が不統一

**解決策:**
- `POST /api/function_requirements/save` を新規追加（ユーザー編集保存）
- `POST /api/function_requirements/update-with-spec` を新規追加（AI差分更新）
- 仕様書の `POST /api/summary/save` と同じ設計パターン
- 仕様書の `POST /api/summary/update-qa-and-regenerate` と同じ差分更新戦略

**効果:**
- セットアップフローの「次へ」ボタンで正しく保存可能
- 仕様書変更時の機能要件の自動更新が可能
- Q&A変更時の後続ドキュメント削除が正しく機能
- 仕様書と機能要件書のAPI設計が統一される

---

## 変更履歴

- 2025-01-14: 初版作成
- 2025-01-14: AI差分更新エンドポイント追加、仕様書実装との対比を明確化
