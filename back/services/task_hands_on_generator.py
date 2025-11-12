"""
TaskHandsOnGenerator: 収集した情報からハンズオンを生成

Phase 2: Plan-and-Execute パターンの Generator
"""

import os
from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from services.task_hands_on_schemas import TaskHandsOnOutput


class TaskHandsOnGenerator:
    """収集した情報からタスクハンズオンを生成"""

    def __init__(self):
        self.model = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            temperature=0.4,
            max_output_tokens=16000,
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )

    def generate(
        self,
        task_info: Dict[str, Any],
        collected_info_text: str
    ) -> TaskHandsOnOutput:
        """
        タスクハンズオンを生成

        Args:
            task_info: タスク情報
            collected_info_text: Executorで収集した情報 (整形済み)

        Returns:
            TaskHandsOnOutput: 生成されたハンズオン
        """
        prompt = self._build_generation_prompt(task_info, collected_info_text)

        # Gemini 2.0 Structured Output を使用
        structured_llm = self.model.with_structured_output(TaskHandsOnOutput)
        hands_on = structured_llm.invoke(prompt)

        return hands_on

    def _build_generation_prompt(
        self,
        task_info: Dict[str, Any],
        collected_info: str
    ) -> str:
        """生成用のプロンプトを構築"""

        title = task_info.get("title", "")
        category = task_info.get("category", "")
        description = task_info.get("description", "")
        priority = task_info.get("priority", "")
        estimated_hours = task_info.get("estimated_hours", 0)

        project_context = task_info.get("project_context", {})
        framework_info = project_context.get("framework", "")
        tech_stack = project_context.get("tech_stack", [])
        tech_stack_str = ", ".join(tech_stack) if tech_stack else "未指定"
        directory_info = project_context.get("directory_info", "")  # 修正: directory_structure → directory_info

        prompt = f"""あなたはハッカソンプロジェクトの実装ガイド(ハンズオン)を作成する専門家です。

## タスク情報
- **タイトル**: {title}
- **カテゴリ**: {category}
- **説明**: {description}
- **優先度**: {priority}
- **見積時間**: {estimated_hours}時間

## プロジェクトコンテキスト
- **フレームワーク**: {framework_info}
- **技術スタック**: {tech_stack_str}

### ディレクトリ構造
```
{directory_info[:1000]}
```

## 収集した参照情報
{collected_info}

---

## あなたの役割
上記の情報を基に、このタスクの**詳細な実装ガイド(ハンズオン)**を作成してください。

### 作成方針

1. **overview (概要説明)**
   - このタスクの目的と役割を2-3文で明確に説明
   - 実装する機能の全体像を把握できるように

2. **prerequisites (前提条件)**
   - 依存タスクで実装された内容 (収集した情報から引用)
   - 必要な環境設定やインストール済みパッケージ
   - 開発者が事前に理解しておくべき概念

3. **technical_context (技術的背景) 🎓 重要: 初心者の学習重視**
   - **使用する技術・ライブラリの役割**: 何をするものか、どういう目的で使うか
   - **なぜこの技術を使うのか**: 技術選択の理由、代替手段との比較
   - **基本的な動作原理**: 内部でどう動いているか (初心者向けに簡潔に)
   - **関連する重要な概念**: 理解しておくべき周辺知識
   - **ハッカソンでの実用性**: この技術を学ぶことで何ができるようになるか

4. **target_files (実装対象ファイル)**
   - 新規作成、修正、または追加が必要なファイルをリストアップ
   - 各ファイルの役割と実施する操作を明記
   - ディレクトリ構造に基づいた適切なパス指定

5. **implementation_steps (実装手順) ⚠️ 重要: コードは含めない**
   - ステップバイステップで**何をするか**を説明 (Markdown形式)
   - 各ステップの目的と手順を自然言語で明確に
   - 実行すべきコマンドがあれば含めても良い
   - **コード例は含めない** - 具体的なコードは code_examples に記載
   - フォーマット例:
     ```markdown
     ## Step 1: データモデルの定義
     `models/user.py` に User モデルを作成します。このモデルは認証に必要な基本情報を保持します。

     ## Step 2: データベースのマイグレーション
     以下のコマンドでマイグレーションを実行:
     ```bash
     python manage.py makemigrations
     python manage.py migrate
     ```

     ## Step 3: API エンドポイントの作成
     `views/auth.py` にユーザー登録用のエンドポイントを実装します。入力値のバリデーションとエラーハンドリングを忘れずに。
     ```

6. **code_examples (コード例) 💻 重要: 実装の具体的なコード**
   - 重要な実装箇所の**具体的なコード**を提供
   - コメントを含め、そのままコピペできる形式
   - 収集した依存タスクのコード例を参考に、一貫性を保つ
   - implementation_steps で説明した内容の実装コードをここに記載

7. **testing_guidelines (テストガイドライン)**
   - 単体テスト、結合テスト、動作確認の方法
   - 確認すべきポイントを明確に
   - 可能であればテストコード例も含める

8. **common_errors (よくあるエラー) ⚠️ 重要: ハッカソン初心者が詰まりやすいポイント**
   - **タイポ・設定ミス**: 変数名の間違い、設定ファイルの誤字など
   - **環境構築の問題**: ポート競合、パーミッションエラー、パスの問題
   - **ライブラリのバージョン問題**: 互換性エラー、API変更
   - **典型的なロジックエラー**: 初心者が陥りやすい実装ミス
   - **各エラーには必ず**: エラー内容、原因、具体的な解決方法を記載

9. **implementation_tips (実装のポイント) 💡 重要: ベストプラクティスと落とし穴**
   - **type="best_practice"**: なぜこれがベストプラクティスか理由を明記
     例: 「エラーハンドリングを追加する」→「理由: 予期しないエラーでアプリが落ちるのを防ぐため」
   - **type="pitfall"**: 避けるべきアンチパターンとその理由
     例: 「グローバル変数を使わない」→「理由: 複数箇所から変更されると予期しない動作になる」
   - **type="security"**: セキュリティ上の注意点と脆弱性の説明
     例: 「入力値をサニタイズする」→「理由: SQLインジェクション攻撃を防ぐため」
   - **type="performance"**: パフォーマンス最適化のヒントと効果
     例: 「インデックスを追加する」→「理由: クエリが100倍高速化される」

10. **estimated_time_minutes (推定時間)**
    - 実装にかかる現実的な時間を分単位で
    - 見積時間 {estimated_hours} 時間を参考に、実装の複雑さを考慮

### 品質基準
- **具体性**: 抽象的な説明ではなく、具体的な実装手順
- **完全性**: このガイドだけで実装が完結できること
- **整合性**: 依存タスクやプロジェクト全体との一貫性
- **実用性**: ハッカソン参加者が迷わず実装できること
- **教育的価値**: 初心者が技術的背景を理解し、よくあるエラーを回避し、ベストプラクティスを学べること

### 🎯 最重要ポイント: ハッカソン初心者の成功を支援
このハンズオンは、プログラミング初心者がハッカソンで:**
1. **詰まらずに実装を進められる** (common_errors で典型的な問題を予防)
2. **なぜそうするのか理解できる** (technical_context で技術的背景を説明)
3. **良い実装習慣を身につけられる** (implementation_tips でベストプラクティスを学習)

TaskHandsOnOutput スキーマに従って、高品質で教育的なハンズオンを生成してください。
"""

        return prompt
