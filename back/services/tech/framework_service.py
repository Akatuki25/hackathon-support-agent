from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_classic.output_parsers import StructuredOutputParser, ResponseSchema
from ..core import BaseService
from sqlalchemy.orm import Session
from typing import List

class FrameworkService(BaseService):
    def __init__(self, db:Session):
        super().__init__(db=db)

    def generate_framework_priority(self, specification: str):
        """
        仕様書の内容に基づき、固定のフロントエンド候補（React, Vue, Next, Astro）
        およびバックエンド候補（Nest, Flask, FastAPI, Rails, Gin）の優先順位と理由を
        JSON 形式で生成する。
        """
        response_schemas = [
            ResponseSchema(
                name="frontend",
                description="配列形式のフロントエンドフレームワークの提案。各項目は {name: string, priority: number, reason: string} の形式。",
                type="array(objects)"
            ),
            ResponseSchema(
                name="backend",
                description="配列形式のバックエンドフレームワークの提案。各項目は {name: string, priority: number, reason: string} の形式。",
                type="array(objects)"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("framework_service", "generate_framework_priority"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash | parser
        result = chain.invoke({"specification": specification})
        return result
    def generate_framework_recommendations(self, specification: str, function_doc: str = ""):
        """
        仕様書と機能ドキュメントの内容に基づき、推薦技術の名前、優先度、理由のみを返す。
        その他の技術は自由選択として扱う。
        """
        response_schemas = [
            ResponseSchema(
                name="recommended_technologies",
                description="推薦技術の配列。各項目は {name: string, priority: number, reason: string} の形式。priorityは1-10の数値（1が最高優先度）。",
                type="array(objects)"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("framework_service", "generate_simple_recommendations"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash | parser
        result = chain.invoke({
            "specification": specification,
            "function_doc": function_doc
        })
        return result

    def generate_framework_document(self, specification: str, framework: str):
        """
        仕様書の内容に基づき、固定のフロントエンド候補
        およびバックエンド候補の選択肢かを選んだものからそのフレームワークに沿った技術要件書を作成する。
        """

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("framework_service", "generate_framework_document")
        )

        chain = prompt_template | self.llm_flash | StrOutputParser()
        result = chain.invoke({"specification": specification, "frame_work": framework})
        return result

    def get_technology_options(self, platform: str):
        """
        プラットフォーム別の技術オプションを取得
        """
        technology_options = {
            "web": [
                # Frontend Technologies
                {"name": "React", "category": "frontend", "description": "人気のJavaScript UIライブラリ",
                 "pros": ["大規模なコミュニティ", "豊富なライブラリ", "学習リソースが豊富"],
                 "cons": ["学習コストが高い", "設定が複雑"], "difficulty": "intermediate"},
                {"name": "Vue.js", "category": "frontend", "description": "プログレッシブJavaScriptフレームワーク",
                 "pros": ["学習しやすい", "軽量", "日本語ドキュメント充実"],
                 "cons": ["企業採用が少ない", "大規模開発向けではない"], "difficulty": "beginner"},
                {"name": "Next.js", "category": "frontend", "description": "Reactベースのフルスタックフレームワーク",
                 "pros": ["SSR/SSG対応", "API Routes", "最適化済み"],
                 "cons": ["Reactの知識が必要", "複雑な設定"], "difficulty": "intermediate"},
                {"name": "Angular", "category": "frontend", "description": "Googleが開発するフルスタックフレームワーク",
                 "pros": ["TypeScript標準", "企業向け機能充実", "大規模開発向け"],
                 "cons": ["学習コストが高い", "バンドルサイズが大きい"], "difficulty": "advanced"},
                {"name": "Svelte", "category": "frontend", "description": "コンパイル時最適化フレームワーク",
                 "pros": ["軽量", "高速", "直感的な構文"],
                 "cons": ["エコシステムが小さい", "企業採用が少ない"], "difficulty": "intermediate"},
                # Backend Technologies
                {"name": "Node.js + Express", "category": "backend", "description": "JavaScriptバックエンド環境",
                 "pros": ["フロントエンドと言語統一", "NPMエコシステム", "軽量"],
                 "cons": ["シングルスレッド", "型安全性が低い"], "difficulty": "beginner"},
                {"name": "FastAPI (Python)", "category": "backend", "description": "高速なPython APIフレームワーク",
                 "pros": ["自動ドキュメント生成", "型ヒント対応", "高性能"],
                 "cons": ["Pythonの知識が必要", "新しいフレームワーク"], "difficulty": "intermediate"},
                {"name": "Django (Python)", "category": "backend", "description": "Pythonのフルスタックフレームワーク",
                 "pros": ["バッテリー内蔵", "管理画面自動生成", "セキュア"],
                 "cons": ["重厚", "小規模プロジェクトには過剰"], "difficulty": "intermediate"},
                {"name": "Ruby on Rails", "category": "backend", "description": "Ruby on Railsフレームワーク",
                 "pros": ["開発速度が速い", "豊富なgem", "MVCアーキテクチャ"],
                 "cons": ["パフォーマンスが劣る", "学習コストが高い"], "difficulty": "intermediate"},
                {"name": "Spring Boot (Java)", "category": "backend", "description": "Javaの企業向けフレームワーク",
                 "pros": ["エンタープライズ級", "豊富な機能", "大規模開発対応"],
                 "cons": ["重厚", "設定が複雑", "起動が遅い"], "difficulty": "advanced"},
                {"name": "Gin (Go)", "category": "backend", "description": "高性能なGo言語フレームワーク",
                 "pros": ["高速", "軽量", "並行処理に強い"],
                 "cons": ["学習コストが高い", "エコシステムが小さい"], "difficulty": "advanced"},
                {"name": "Laravel (PHP)", "category": "backend", "description": "PHPの人気フレームワーク",
                 "pros": ["開発効率が高い", "豊富な機能", "学習しやすい"],
                 "cons": ["パフォーマンスが劣る", "PHP特有の問題"], "difficulty": "beginner"},
                # Database Technologies
                {"name": "PostgreSQL", "category": "database", "description": "高機能なオープンソースRDB",
                 "pros": ["ACID準拠", "JSON対応", "拡張性が高い"],
                 "cons": ["設定が複雑", "メモリ使用量が多い"], "difficulty": "intermediate"},
                {"name": "MySQL", "category": "database", "description": "世界で最も人気のあるRDB",
                 "pros": ["高速", "軽量", "豊富な情報"],
                 "cons": ["機能が限定的", "データ整合性の問題"], "difficulty": "beginner"},
                {"name": "MongoDB", "category": "database", "description": "NoSQLドキュメントデータベース",
                 "pros": ["柔軟なスキーマ", "スケーラブル", "JSON形式"],
                 "cons": ["ACID保証が弱い", "メモリ使用量が多い"], "difficulty": "intermediate"},
                {"name": "Redis", "category": "database", "description": "インメモリデータストア",
                 "pros": ["超高速", "キャッシュに最適", "多様なデータ構造"],
                 "cons": ["メモリ依存", "永続化の制限"], "difficulty": "beginner"},
                # Deployment Technologies
                {"name": "Vercel", "category": "deployment", "description": "フロントエンド特化のホスティング",
                 "pros": ["簡単デプロイ", "CDN内蔵", "Next.js最適化"],
                 "cons": ["バックエンド制限", "コストが高い"], "difficulty": "beginner"},
                {"name": "AWS (EC2/ECS)", "category": "deployment", "description": "Amazon Web Servicesクラウド",
                 "pros": ["豊富なサービス", "スケーラブル", "企業級"],
                 "cons": ["複雑", "コスト管理が困難", "学習コストが高い"], "difficulty": "advanced"},
                {"name": "Docker + Heroku", "category": "deployment", "description": "コンテナ化とPaaSの組み合わせ",
                 "pros": ["簡単デプロイ", "環境統一", "スケーラブル"],
                 "cons": ["コストが高い", "制限が多い"], "difficulty": "intermediate"}
            ],
            "ios": [
                {"name": "Swift + UIKit", "category": "frontend", "description": "iOS標準開発言語とフレームワーク",
                 "pros": ["ネイティブ性能", "豊富なAPI", "Apple公式サポート"],
                 "cons": ["iOS専用", "学習コストが高い"], "difficulty": "intermediate"},
                {"name": "Swift + SwiftUI", "category": "frontend", "description": "最新のSwift UIフレームワーク",
                 "pros": ["宣言的UI", "プレビュー機能", "macOS/watchOS対応"],
                 "cons": ["iOS 13以降限定", "まだ発展途上"], "difficulty": "intermediate"},
                {"name": "React Native", "category": "frontend", "description": "クロスプラットフォーム開発フレームワーク",
                 "pros": ["コード共有可能", "Reactの知識活用", "ホットリロード"],
                 "cons": ["ネイティブより性能劣る", "プラットフォーム固有機能制限"], "difficulty": "intermediate"},
                {"name": "Firebase", "category": "backend", "description": "Googleのモバイル向けBaaS",
                 "pros": ["簡単セットアップ", "リアルタイムDB", "認証機能"],
                 "cons": ["ベンダーロックイン", "複雑なクエリ制限"], "difficulty": "beginner"}
            ],
            "android": [
                {"name": "Kotlin + Jetpack Compose", "category": "frontend", "description": "Android標準開発とモダンUIフレームワーク",
                 "pros": ["ネイティブ性能", "最新UI", "Kotlin言語"],
                 "cons": ["Android専用", "新しいため情報少ない"], "difficulty": "intermediate"},
                {"name": "Java + XML", "category": "frontend", "description": "従来のAndroid開発手法",
                 "pros": ["安定している", "豊富な情報", "Javaの知識活用"],
                 "cons": ["冗長なコード", "開発効率が低い"], "difficulty": "beginner"},
                {"name": "React Native", "category": "frontend", "description": "クロスプラットフォーム開発フレームワーク",
                 "pros": ["コード共有可能", "Reactの知識活用", "開発速度"],
                 "cons": ["ネイティブより性能劣る", "プラットフォーム固有機能制限"], "difficulty": "intermediate"},
                {"name": "Firebase", "category": "backend", "description": "Googleのモバイル向けBaaS",
                 "pros": ["簡単セットアップ", "リアルタイムDB", "認証機能"],
                 "cons": ["ベンダーロックイン", "複雑なクエリ制限"], "difficulty": "beginner"}
            ]
        }
        return technology_options.get(platform, [])

    def evaluate_framework_choice(self, specification: str, selected_technologies: List[str], platform: str):
        """
        選択されたフレームワークの妥当性を評価
        """
        response_schemas = [
            ResponseSchema(
                name="score",
                description="選択の妥当性スコア（0.0-1.0）",
                type="number"
            ),
            ResponseSchema(
                name="feedback",
                description="フィードバックの配列",
                type="array(strings)"
            ),
            ResponseSchema(
                name="alternatives",
                description="代替案の配列",
                type="array(objects)"
            ),
            ResponseSchema(
                name="risks",
                description="リスクの配列",
                type="array(strings)"
            )
        ]
        parser = StructuredOutputParser.from_response_schemas(response_schemas)

        prompt_template = ChatPromptTemplate.from_template(
            template=self.get_prompt("framework_service", "evaluate_framework_choice"),
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        chain = prompt_template | self.llm_flash | parser
        result = chain.invoke({
            "specification": specification,
            "selected_technologies": ", ".join(selected_technologies),
            "platform": platform
        })
        return result
