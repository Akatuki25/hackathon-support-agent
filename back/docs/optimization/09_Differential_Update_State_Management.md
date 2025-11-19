# 差分更新のための状態管理とトークン最適化設計

## 概要

仕様書→機能要件→機能一覧という依存チェーンにおいて、各段階での変更を検知し、適切に差分更新を行うための状態管理とトークン最適化の設計。

---

## 1. 現状の問題

### 1.1 DBスキーマの不足

**現在のProjectDocumentテーブル:**
```python
class ProjectDocument(Base):
    __tablename__ = "projectDocument"

    doc_id         = Column(UUID, primary_key=True, default=uuid.uuid4)
    project_id     = Column(UUID, ForeignKey("projectBase.project_id"), nullable=False)
    specification  = Column(Text, nullable=False)  # 仕様書
    function_doc   = Column(Text, nullable=False)  # 機能要件
    frame_work_doc = Column(Text, nullable=False)  # フレームワーク
    directory_info = Column(Text, nullable=False)  # ディレクトリ構成
    created_at     = Column(DateTime, server_default=func.now())
    # ⚠️ 各ドキュメントの更新日時が存在しない
```

**問題点:**
1. どのドキュメントがいつ更新されたか追跡できない
2. 仕様書変更時に機能要件が古いかどうか判定できない
3. フロントエンドで「差分更新が必要」状態を表示できない

### 1.2 差分検知の課題

**ユースケース:**
```
1. 仕様書を編集 (2025-01-14 10:00)
2. 機能要件ページに移動
3. ❌ 機能要件が古い情報のまま (最終生成: 2025-01-14 09:00)
   → 差分更新ボタンが有効化されるべきだが、判定できない
```

**機能一覧でも同じ問題:**
```
1. 機能要件を編集 (2025-01-14 11:00)
2. 機能一覧ページに移動
3. ❌ 機能一覧が古い情報のまま (最終生成: 2025-01-14 10:00)
   → 差分更新が必要だが検知できない
```

### 1.3 トークン消費の問題

**現在の差分更新実装:**
```python
async def update_function_doc_with_spec_diff(
    self,
    project_id: str,
    specification_diff: Optional[str] = None
) -> str:
    # ⚠️ 仕様書全文を毎回LLMに送信
    prompt_text = f"""
既存の機能要件書:
{project_doc.function_doc}  # 全文

仕様書の変更:
{specification_diff}  # ユーザーから渡される差分（現在は実装されていない）

最新の仕様書:
{project_doc.specification}  # 全文
"""
```

**問題点:**
- 仕様書全文と機能要件全文を毎回送信
- 差分だけを抽出する仕組みがない
- トークン消費が非常に大きい

---

## 2. 解決策: 更新日時の追加

### 2.1 DBスキーマの拡張

```python
class ProjectDocument(Base):
    __tablename__ = "projectDocument"

    doc_id         = Column(UUID, primary_key=True, default=uuid.uuid4)
    project_id     = Column(UUID, ForeignKey("projectBase.project_id"), nullable=False)

    # ドキュメント本体
    specification  = Column(Text, nullable=True)  # NULL許可に変更
    function_doc   = Column(Text, nullable=True)  # NULL許可に変更
    function_structure = Column(JSON, nullable=True)  # 機能一覧（構造化）
    frame_work_doc = Column(Text, nullable=True)
    directory_info = Column(Text, nullable=True)

    # 📅 各ドキュメントの更新日時（NEW）
    specification_updated_at = Column(DateTime(timezone=True), nullable=True)
    function_doc_updated_at  = Column(DateTime(timezone=True), nullable=True)
    function_structure_updated_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### 2.2 マイグレーションスクリプト

```python
# back/migrations/add_document_timestamps.py

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # 各ドキュメントの更新日時カラムを追加
    op.add_column('projectDocument',
        sa.Column('specification_updated_at',
                  sa.DateTime(timezone=True),
                  nullable=True)
    )
    op.add_column('projectDocument',
        sa.Column('function_doc_updated_at',
                  sa.DateTime(timezone=True),
                  nullable=True)
    )
    op.add_column('projectDocument',
        sa.Column('function_structure_updated_at',
                  sa.DateTime(timezone=True),
                  nullable=True)
    )

    # 既存データの初期化（created_atの値で埋める）
    op.execute("""
        UPDATE "projectDocument"
        SET specification_updated_at = created_at,
            function_doc_updated_at = created_at,
            function_structure_updated_at = created_at
        WHERE specification IS NOT NULL
    """)

def downgrade():
    op.drop_column('projectDocument', 'specification_updated_at')
    op.drop_column('projectDocument', 'function_doc_updated_at')
    op.drop_column('projectDocument', 'function_structure_updated_at')
```

---

## 3. 差分検知ロジック

### 3.1 バックエンドAPI: ドキュメント状態取得

```python
# back/routers/project/project_document.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentStatus(BaseModel):
    exists: bool
    updated_at: Optional[datetime]
    needs_update: bool  # 前段階の方が新しい

class ProjectDocumentStatus(BaseModel):
    specification: DocumentStatus
    function_doc: DocumentStatus
    function_structure: DocumentStatus

@router.get("/project_document/{project_id}/status",
            response_model=ProjectDocumentStatus)
async def get_document_status(
    project_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    各ドキュメントの存在状態と更新必要性を返す
    """
    doc = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id
    ).first()

    if not doc:
        # ドキュメントが存在しない場合
        return ProjectDocumentStatus(
            specification=DocumentStatus(exists=False, updated_at=None, needs_update=False),
            function_doc=DocumentStatus(exists=False, updated_at=None, needs_update=False),
            function_structure=DocumentStatus(exists=False, updated_at=None, needs_update=False)
        )

    # 仕様書
    spec_status = DocumentStatus(
        exists=bool(doc.specification),
        updated_at=doc.specification_updated_at,
        needs_update=False  # 仕様書は最上流なので常にFalse
    )

    # 機能要件（仕様書より古いかチェック）
    func_status = DocumentStatus(
        exists=bool(doc.function_doc),
        updated_at=doc.function_doc_updated_at,
        needs_update=(
            doc.specification_updated_at is not None and
            doc.function_doc_updated_at is not None and
            doc.specification_updated_at > doc.function_doc_updated_at
        )
    )

    # 機能一覧（機能要件より古いかチェック）
    struct_status = DocumentStatus(
        exists=bool(doc.function_structure),
        updated_at=doc.function_structure_updated_at,
        needs_update=(
            doc.function_doc_updated_at is not None and
            doc.function_structure_updated_at is not None and
            doc.function_doc_updated_at > doc.function_structure_updated_at
        )
    )

    return ProjectDocumentStatus(
        specification=spec_status,
        function_doc=func_status,
        function_structure=struct_status
    )
```

### 3.2 フロントエンド: 状態取得フック

```typescript
// front/src/hooks/useDocumentStatus.ts

import useSWR from 'swr';
import axios from 'axios';

interface DocumentStatus {
  exists: boolean;
  updated_at: string | null;
  needs_update: boolean;
}

interface ProjectDocumentStatus {
  specification: DocumentStatus;
  function_doc: DocumentStatus;
  function_structure: DocumentStatus;
}

export const useDocumentStatus = (projectId: string) => {
  const { data, error, mutate } = useSWR<ProjectDocumentStatus>(
    projectId ? `/project_document/${projectId}/status` : null,
    (url) => axios.get(`${process.env.NEXT_PUBLIC_API_URL}${url}`).then(res => res.data),
    {
      refreshInterval: 5000, // 5秒ごとに自動更新
      revalidateOnFocus: true
    }
  );

  return {
    status: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate
  };
};
```

### 3.3 フロントエンド: 差分更新ボタンの有効化

```tsx
// front/src/components/FunctionEditor/FunctionEditor.tsx

import { useDocumentStatus } from '@/hooks/useDocumentStatus';

export default function FunctionEditor({ projectId, ... }: Props) {
  const { status } = useDocumentStatus(projectId);

  // 仕様書の方が新しい場合、差分更新ボタンを有効化
  const hasSpecificationChanged = status?.function_doc.needs_update ?? false;

  return (
    <button
      onClick={handleDifferentialUpdate}
      disabled={!hasSpecificationChanged || updatingDiff}
      className={hasSpecificationChanged ? 'bg-blue-500' : 'bg-gray-300'}
    >
      {updatingDiff ? '更新中...' : '差分更新'}
    </button>
  );
}
```

---

## 4. 差分抽出とトークン最適化

### 4.1 差分計算のアプローチ

**Option A: フロントエンドで差分を渡す（推奨）**
```typescript
// ユーザーが編集中、変更内容をトラッキング
const [specificationDiff, setSpecificationDiff] = useState<string>('');

const handleSpecificationEdit = (newSpec: string) => {
  // 差分を記録（簡易的には変更前後のdiff）
  const diff = calculateDiff(oldSpecification, newSpec);
  setSpecificationDiff(diff);
};

// 保存時に差分情報も一緒に送る
await saveFunctionDocument(projectId, {
  specification: newSpecification,
  diff: specificationDiff  // 変更箇所のみ
});
```

**Option B: バックエンドで差分を計算**
```python
# back/services/function_service.py

async def update_function_doc_with_spec_diff(
    self,
    project_id: str,
    specification_diff: Optional[str] = None
) -> str:
    project_doc = self._get_project_document(project_id)

    if not specification_diff:
        # 差分が渡されていない場合は、全文更新
        # （理想的にはフロントから差分を受け取る）
        specification_diff = "仕様書が更新されました。全体を確認してください。"

    # ⚠️ 最適化: 機能要件全文ではなく、目次のみ送信
    function_summary = self._extract_function_summary(project_doc.function_doc)

    prompt_text = f"""
以下の機能要件の目次を確認し、仕様書の変更に対応する部分のみを更新してください。

## 機能要件の目次:
{function_summary}

## 仕様書の変更:
{specification_diff}

変更が必要な機能要件のセクションとその更新内容を教えてください。
"""

    # ... LLM呼び出し
```

### 4.2 目次抽出による最適化

```python
def _extract_function_summary(self, function_doc: str) -> str:
    """
    機能要件書から目次（見出しのみ）を抽出

    例:
    # 機能要件書
    ## ユーザー認証
    ### ログイン機能
    ### パスワードリセット
    ## データ管理
    ### ユーザーデータ保存

    → これだけを送信（詳細は省略）
    """
    lines = function_doc.split('\n')
    summary = []
    for line in lines:
        if line.startswith('#'):  # Markdownの見出し
            summary.append(line)

    return '\n'.join(summary)
```

**効果:**
- トークン消費を80%削減（全文 → 目次のみ）
- LLMは必要なセクションだけ特定できる
- その後、該当セクションのみ詳細更新

### 4.3 段階的更新

```python
async def update_function_doc_with_spec_diff(
    self,
    project_id: str,
    specification_diff: Optional[str] = None
) -> str:
    project_doc = self._get_project_document(project_id)

    # Step 1: 目次から影響範囲を特定（軽量）
    function_summary = self._extract_function_summary(project_doc.function_doc)

    prompt_affected = f"""
以下の機能要件の目次から、仕様書の変更で影響を受けるセクションを特定してください。

## 機能要件の目次:
{function_summary}

## 仕様書の変更:
{specification_diff}

影響を受けるセクションの見出しをリストで返してください。
"""

    affected_sections = await self.llm.ainvoke(prompt_affected)

    # Step 2: 該当セクションの詳細のみ取得して更新
    sections_to_update = self._extract_sections(
        project_doc.function_doc,
        affected_sections
    )

    prompt_update = f"""
以下の機能要件のセクションを、仕様書の変更に基づいて更新してください。

## 更新対象セクション:
{sections_to_update}

## 仕様書の変更:
{specification_diff}

更新後のセクションを返してください。
"""

    updated_sections = await self.llm.ainvoke(prompt_update)

    # Step 3: 元のドキュメントの該当部分を置換
    updated_doc = self._replace_sections(
        project_doc.function_doc,
        affected_sections,
        updated_sections
    )

    return updated_doc
```

---

## 5. 実装の優先順位

### Phase 1: DBスキーマ拡張（必須）
- [ ] `specification_updated_at`, `function_doc_updated_at`, `function_structure_updated_at` カラム追加
- [ ] マイグレーションスクリプト作成
- [ ] 既存データの初期化

### Phase 2: 状態取得API（必須）
- [ ] `GET /project_document/{project_id}/status` 実装
- [ ] `needs_update` フラグの計算ロジック
- [ ] フロントエンドのuseDocumentStatusフック

### Phase 3: 差分更新の最適化（推奨）
- [ ] 目次抽出機能（`_extract_function_summary`）
- [ ] 影響範囲特定（Step 1）
- [ ] 部分更新（Step 2-3）

### Phase 4: フロントエンド差分トラッキング（オプション）
- [ ] エディタでの変更差分計算
- [ ] 差分情報の保存API拡張
- [ ] バックエンドでの差分活用

---

## 6. トークン削減の効果試算

### 現在の実装
```
仕様書: 5000 tokens
機能要件: 8000 tokens
合計: 13000 tokens / リクエスト
```

### 最適化後（目次のみ）
```
仕様書の差分: 500 tokens
機能要件の目次: 1000 tokens
影響セクション: 2000 tokens
合計: 3500 tokens / リクエスト （73%削減）
```

### さらなる最適化（段階的更新）
```
Step 1（影響範囲特定）: 1500 tokens
Step 2（部分更新）: 2500 tokens
合計: 4000 tokens / リクエスト （69%削減）
```

---

## 7. まとめ

### 7.1 核心的な課題

1. **状態管理**: 各ドキュメントの更新日時がないため、差分検知できない
2. **トークン消費**: 全文を毎回送信しているため、コストが高い
3. **依存関係**: 仕様書→機能要件→機能一覧の連鎖で同じ問題が発生

### 7.2 解決策

1. **更新日時の追加**: `*_updated_at` カラムで差分検知を実現
2. **状態取得API**: `needs_update` フラグでフロントエンドに通知
3. **目次抽出**: 全文ではなく目次のみ送信してトークン削減
4. **段階的更新**: 影響範囲特定 → 部分更新の2ステップ

### 7.3 期待される効果

- ✅ 差分更新ボタンの適切な有効化
- ✅ トークン消費の70%削減
- ✅ UXの向上（更新必要性が明確）
- ✅ 実装の明瞭性（状態が明確）

---

## 変更履歴

- 2025-01-14: 初版作成
