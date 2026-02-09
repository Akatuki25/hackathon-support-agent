"""
技術選定プリセットの初期データ

実行方法:
    cd back
    python -c "from seeds.tech_presets import seed_tech_presets; seed_tech_presets()"
"""

from sqlalchemy.orm import Session
from models.tech_preset import TechDomain, TechStack
from database import SessionLocal


DOMAINS = [
    # Backend / Python
    {
        "key": "db_driver_python",
        "name": "DBドライバ（Python）",
        "description": "PostgreSQLへ接続するためのドライバ（sync/async含む）",
        "decision_prompt": "PostgreSQL接続ドライバをどれにしますか？（後でORM/接続方式に影響します）",
    },
    {
        "key": "orm_python",
        "name": "DBアクセス層（Python）",
        "description": "ORM/クエリビルダ等、DBアクセスの中心となる層",
        "decision_prompt": "DBアクセス層（ORM/クエリビルダ）をどれにしますか？",
    },
    {
        "key": "migration_python",
        "name": "マイグレーション（Python）",
        "description": "DBスキーマ変更の管理（生成/適用/ロールバック/履歴）",
        "decision_prompt": "マイグレーション管理をどうしますか？",
    },
    {
        "key": "validation_python",
        "name": "入力検証・シリアライズ（Python）",
        "description": "API入出力の検証・変換・型境界",
        "decision_prompt": "入力検証/シリアライズの中核ライブラリをどれにしますか？",
    },
    {
        "key": "api_style_backend",
        "name": "APIスタイル（Backend）",
        "description": "REST/OpenAPI/GraphQL/gRPCなど、APIの表現と契約の形",
        "decision_prompt": "APIスタイルをどうしますか？（契約/クライアント実装に影響）",
    },
    {
        "key": "realtime_transport",
        "name": "リアルタイム通信（SSE/WebSocket）",
        "description": "サーバからのプッシュ、ストリーミング、双方向通信",
        "decision_prompt": "リアルタイム通信が必要なら方式を選びます（不要ならスキップ可）",
    },
    {
        "key": "auth_backend_method",
        "name": "認証方式（Backend）",
        "description": "セッション/JWT/OAuth2(OIDC)などの方式",
        "decision_prompt": "認証方式をどれにしますか？",
    },
    {
        "key": "auth_backend_impl_python",
        "name": "認証実装（Python）",
        "description": "FastAPI周辺での認証の実装方法（ライブラリ/構成）",
        "decision_prompt": "FastAPIでの認証実装をどうしますか？",
    },
    {
        "key": "bg_jobs_python",
        "name": "非同期ジョブ/キュー（Python）",
        "description": "長時間処理・再試行・スケジュールを扱う仕組み",
        "decision_prompt": "バックグラウンド処理基盤をどうしますか？",
    },
    {
        "key": "object_storage",
        "name": "画像/ファイル保管（Object Storage）",
        "description": "一時/永続のファイル格納（ローカル/S3/GCS等）",
        "decision_prompt": "画像ファイルの保管先をどうしますか？",
    },

    # Frontend / Next.js
    {
        "key": "data_fetching_next",
        "name": "データ取得・キャッシュ（Next.js）",
        "description": "サーバデータの取得、キャッシュ、ミューテーションの流儀",
        "decision_prompt": "サーバデータ取得（キャッシュ/更新）をどうしますか？",
    },
    {
        "key": "state_management_next",
        "name": "クライアント状態管理（Next.js）",
        "description": "UIローカル状態、横断状態の管理",
        "decision_prompt": "クライアント状態管理ライブラリをどれにしますか？",
    },
    {
        "key": "forms_next",
        "name": "フォーム管理（Next.js）",
        "description": "フォームの状態/バリデーション/送信の整理",
        "decision_prompt": "フォーム管理をどうしますか？",
    },
    {
        "key": "schema_validation_front",
        "name": "フロントのスキーマ/バリデーション",
        "description": "フォーム/API境界のスキーマ定義（型生成にも影響）",
        "decision_prompt": "フロント側のスキーマ/バリデーションをどうしますか？",
    },
    {
        "key": "api_client_next",
        "name": "HTTPクライアント（Next.js）",
        "description": "HTTP呼び出し（fetchラップ、リトライ、エラー整形など）",
        "decision_prompt": "HTTPクライアントをどうしますか？",
    },
    {
        "key": "css_system_next",
        "name": "CSS/スタイリング（Next.js）",
        "description": "CSS設計（ユーティリティ/モジュール/コンポーネントライブラリ）",
        "decision_prompt": "スタイリング方針をどうしますか？",
    },
    {
        "key": "auth_frontend_next",
        "name": "フロント認証（Next.js）",
        "description": "フロント側のログインUX/セッション取り回し",
        "decision_prompt": "Next.js側の認証統合をどうしますか？",
    },

    # Mobile
    {
        "key": "ui_framework_ios",
        "name": "UI（iOS）",
        "description": "UIKit/SwiftUIなど",
        "decision_prompt": "iOSのUI実装方針をどれにしますか？",
    },
    {
        "key": "ui_framework_android",
        "name": "UI（Android）",
        "description": "Jetpack Compose/Viewなど",
        "decision_prompt": "AndroidのUI実装方針をどれにしますか？",
    },
]


STACKS = [
    # -----------------------
    # DB Driver (Python)
    # -----------------------
    {
        "domain_key": "db_driver_python",
        "key": "python_psycopg3",
        "label": "psycopg (v3)",
        "ecosystem": "python",
        "summary": "PostgreSQLの代表的ドライバ。同期・非同期両方の選択肢を取りやすい。",
        "pros": ["実績が厚い", "PostgreSQL機能に追従しやすい", "運用情報が多い"],
        "cons": ["async設計は構成次第で分岐が増える"],
    },
    {
        "domain_key": "db_driver_python",
        "key": "python_asyncpg",
        "label": "asyncpg",
        "ecosystem": "python",
        "summary": "非同期専用のPostgreSQLドライバ。高スループット狙いの構成向け。",
        "pros": ["高速", "async設計が明確"],
        "cons": ["同期スタックとは混ぜにくい", "ORM側の対応を確認する必要がある"],
    },

    # -----------------------
    # ORM / DB access (Python)
    # -----------------------
    {
        "domain_key": "orm_python",
        "key": "python_sqlalchemy",
        "label": "SQLAlchemy",
        "ecosystem": "python",
        "summary": "Pythonで最も標準的なORM/SQLツールキット。モデル中心/SQL中心どちらにも寄せられる。",
        "pros": ["設計の自由度が高い", "複雑クエリに耐える", "周辺ノウハウが豊富"],
        "cons": ["初期に覚える概念が多い", "設計を雑にすると統一感が崩れる"],
    },
    {
        "domain_key": "orm_python",
        "key": "python_sqlmodel",
        "label": "SQLModel",
        "ecosystem": "python",
        "summary": "Pydantic寄りのモデル定義で始めやすいSQLAlchemyベース。小〜中規模で整理しやすい。",
        "pros": ["モデル定義が読みやすい", "FastAPIと相性が良い", "SQLAlchemyへ段階的に寄せられる"],
        "cons": ["表現が複雑になるとSQLAlchemy知識が必要", "高度な機能は結局SQLAlchemy流儀になる"],
    },
    {
        "domain_key": "orm_python",
        "key": "python_tortoise_orm",
        "label": "Tortoise ORM",
        "ecosystem": "python",
        "summary": "async/await前提のORM。async中心の構成でシンプルにまとめたいときに選択肢になる。",
        "pros": ["async前提で設計しやすい", "導入が軽い"],
        "cons": ["採用事例/運用知見が相対的に少ない", "周辺（migrations等）が選択肢依存になる"],
    },

    # -----------------------
    # Migration (Python)
    # -----------------------
    {
        "domain_key": "migration_python",
        "key": "python_alembic",
        "label": "Alembic",
        "ecosystem": "python",
        "summary": "SQLAlchemy系の標準マイグレーション。DBスキーマ変更の運用を一般的な形で組める。",
        "pros": ["SQLAlchemyと整合しやすい", "運用ノウハウが多い", "柔軟な差分管理が可能"],
        "cons": ["初期設定と運用の型を決めないとブレる"],
    },
    {
        "domain_key": "migration_python",
        "key": "python_yoyo_migrations",
        "label": "yoyo-migrations",
        "ecosystem": "python",
        "summary": "SQLファイル中心で管理するマイグレーション。SQL主導の運用に寄せたい場合の選択肢。",
        "pros": ["SQLがそのまま資産になる", "挙動が分かりやすい"],
        "cons": ["ORM主導の運用とは方向性が違う", "チームで型を決めないと散る"],
    },

    # -----------------------
    # Validation / Serialization (Python)
    # -----------------------
    {
        "domain_key": "validation_python",
        "key": "python_pydantic",
        "label": "Pydantic",
        "ecosystem": "python",
        "summary": "FastAPI標準の型/検証基盤。API境界を明確にしたい場合の基本選択肢。",
        "pros": ["FastAPIと統合", "型と検証を揃えやすい", "学習コストが比較的低い"],
        "cons": ["複雑な変換ルールが増えるとモデルが肥大化しやすい"],
    },
    {
        "domain_key": "validation_python",
        "key": "python_msgspec",
        "label": "msgspec",
        "ecosystem": "python",
        "summary": "高速なシリアライズ/バリデーション寄り。性能要件が強い境界で検討対象になる。",
        "pros": ["高速", "型ベースの扱いが明確"],
        "cons": ["周辺エコシステムはPydanticより薄い", "チームの学習投資が必要"],
    },
    {
        "domain_key": "validation_python",
        "key": "python_marshmallow",
        "label": "Marshmallow",
        "ecosystem": "python",
        "summary": "スキーマ定義で変換/検証を組む従来型。既存資産がある場合の選択肢。",
        "pros": ["表現が明示的", "枯れている"],
        "cons": ["FastAPI/Pydantic流儀と二重化しやすい"],
    },

    # -----------------------
    # API style (Backend)
    # -----------------------
    {
        "domain_key": "api_style_backend",
        "key": "api_rest_json",
        "label": "REST（JSON）",
        "ecosystem": None,
        "summary": "リソース中心のHTTP API。多くのチームで共通理解があるため基本の選択肢。",
        "pros": ["学習コストが低い", "ツール/運用が揃っている"],
        "cons": ["契約が曖昧になりやすい（ドキュメント運用が必要）"],
    },
    {
        "domain_key": "api_style_backend",
        "key": "api_openapi_contract",
        "label": "REST + OpenAPI（契約重視）",
        "ecosystem": None,
        "summary": "RESTを維持しつつ契約（OpenAPI）を強める。クライアント生成/連携に効く。",
        "pros": ["契約が明確", "クライアント生成や検証に繋げやすい"],
        "cons": ["運用をサボると形骸化する"],
    },
    {
        "domain_key": "api_style_backend",
        "key": "api_graphql",
        "label": "GraphQL",
        "ecosystem": None,
        "summary": "クライアント主導の取得形を許容するAPI。画面要件が頻繁に変わる場合に検討対象。",
        "pros": ["取得の柔軟性", "クライアント最適化がしやすい"],
        "cons": ["設計・運用の難易度が上がる", "キャッシュ/権限が複雑化しやすい"],
    },
    {
        "domain_key": "api_style_backend",
        "key": "api_grpc",
        "label": "gRPC",
        "ecosystem": None,
        "summary": "サービス間通信や強い契約が必要な場合に検討対象。社内サービス向けに寄る。",
        "pros": ["強い型契約", "高速な通信"],
        "cons": ["ブラウザ/外部公開での取り回しが増える"],
    },

    # -----------------------
    # Realtime transport
    # -----------------------
    {
        "domain_key": "realtime_transport",
        "key": "rt_sse",
        "label": "SSE（Server-Sent Events）",
        "ecosystem": None,
        "summary": "サーバ→クライアントの一方向ストリーム。進捗/逐次出力に向く。",
        "pros": ["HTTPで扱いやすい", "実装が比較的単純"],
        "cons": ["双方向用途には不向き", "接続管理の設計は必要"],
    },
    {
        "domain_key": "realtime_transport",
        "key": "rt_websocket",
        "label": "WebSocket",
        "ecosystem": None,
        "summary": "双方向リアルタイム通信。協調/対話/低遅延双方向が必要な場合に向く。",
        "pros": ["双方向", "低遅延"],
        "cons": ["接続/再接続/スケール設計が必要"],
    },

    # -----------------------
    # Auth method (Backend)
    # -----------------------
    {
        "domain_key": "auth_backend_method",
        "key": "auth_session",
        "label": "セッション（Cookie）",
        "ecosystem": None,
        "summary": "サーバ側で状態を持つ方式。ブラウザ中心のプロダクトで扱いやすい。",
        "pros": ["失効/ログアウトを扱いやすい", "権限管理と相性が良い"],
        "cons": ["スケール時にストア設計が必要"],
    },
    {
        "domain_key": "auth_backend_method",
        "key": "auth_jwt",
        "label": "JWT（アクセストークン）",
        "ecosystem": None,
        "summary": "トークンベースの方式。複数クライアントやサービス間で共有したい場合に検討対象。",
        "pros": ["分散に寄せやすい", "クライアントが増えても扱える"],
        "cons": ["失効/更新/漏洩時対応の設計が必要"],
    },
    {
        "domain_key": "auth_backend_method",
        "key": "auth_oidc",
        "label": "OAuth2 / OIDC",
        "ecosystem": None,
        "summary": "外部IdPに寄せる方式。SSOや外部ログインが要件にある場合の基本。",
        "pros": ["ユーザー管理を外出し可能", "セキュリティ機能を流用できる"],
        "cons": ["依存先と運用が増える", "構成が複雑化しやすい"],
    },

    # -----------------------
    # Auth impl (Python / FastAPI)
    # -----------------------
    {
        "domain_key": "auth_backend_impl_python",
        "key": "fastapi_users",
        "label": "fastapi-users",
        "ecosystem": "python",
        "summary": "FastAPIでユーザー管理/認証フローをまとめて扱うための実装セット。",
        "pros": ["認証の土台が早く作れる", "実装の型を作りやすい"],
        "cons": ["要件が外れるとカスタムが必要", "仕組み理解なしで使うとブラックボックス化する"],
    },
    {
        "domain_key": "auth_backend_impl_python",
        "key": "authlib_oauth",
        "label": "Authlib（OAuth/OIDC）",
        "ecosystem": "python",
        "summary": "OAuth/OIDCを扱うためのライブラリ。外部IdP連携が中心のときに。",
        "pros": ["標準仕様に沿って組める", "応用が効く"],
        "cons": ["設計・設定が必要で導入は軽くない"],
    },
    {
        "domain_key": "auth_backend_impl_python",
        "key": "custom_minimal_auth",
        "label": "最小自前（セッション/トークン）",
        "ecosystem": "python",
        "summary": "要件が小さい場合に自前で最小実装する構成。理解を優先したいときに使う。",
        "pros": ["中身が理解できる", "要件に合わせて最小にできる"],
        "cons": ["やるべきことの抜け漏れが出やすい", "後で拡張するときに負債化しやすい"],
    },

    # -----------------------
    # Background jobs (Python)
    # -----------------------
    {
        "domain_key": "bg_jobs_python",
        "key": "bg_fastapi_backgroundtasks",
        "label": "FastAPI BackgroundTasks（軽量）",
        "ecosystem": "python",
        "summary": "軽い非同期処理をアプリ内で回す。キュー/再試行が不要な範囲で使う。",
        "pros": ["導入が最小", "構成が増えない"],
        "cons": ["再試行/監視/分散には弱い", "ワーカー分離が必要になると移行が発生"],
    },
    {
        "domain_key": "bg_jobs_python",
        "key": "bg_celery",
        "label": "Celery",
        "ecosystem": "python",
        "summary": "定番の分散タスクキュー。再試行/監視/ワーカー分離が必要なら候補になる。",
        "pros": ["機能が揃っている", "運用事例が多い"],
        "cons": ["構成が重くなる", "ブローカー等の依存が増える"],
    },
    {
        "domain_key": "bg_jobs_python",
        "key": "bg_rq",
        "label": "RQ（Redis Queue）",
        "ecosystem": "python",
        "summary": "Redis前提のシンプルなキュー。Celeryより軽く運用したい場合の候補。",
        "pros": ["構成が比較的軽い", "理解しやすい"],
        "cons": ["高度な要件には拡張が必要"],
    },

    # -----------------------
    # Object storage
    # -----------------------
    {
        "domain_key": "object_storage",
        "key": "storage_local",
        "label": "ローカルファイル（開発/簡易）",
        "ecosystem": None,
        "summary": "ローカルディスクに保存。検証・小規模用途で最小構成にしたい場合。",
        "pros": ["最小構成", "導入が速い"],
        "cons": ["スケール/冗長化/共有が難しい"],
    },
    {
        "domain_key": "object_storage",
        "key": "storage_s3",
        "label": "S3互換（AWS S3等）",
        "ecosystem": None,
        "summary": "オブジェクトストレージに保存。永続化・共有・スケールを見据える場合の基本。",
        "pros": ["運用実績が多い", "スケールしやすい"],
        "cons": ["権限/IAM/署名URLなど設計が必要"],
    },
    {
        "domain_key": "object_storage",
        "key": "storage_gcs",
        "label": "Google Cloud Storage",
        "ecosystem": None,
        "summary": "GCP前提のオブジェクトストレージ。GCP統合を重視する場合。",
        "pros": ["GCP統合", "運用しやすい"],
        "cons": ["クラウド選定が固定化される"],
    },

    # -----------------------
    # Frontend data fetching (Next.js)
    # -----------------------
    {
        "domain_key": "data_fetching_next",
        "key": "next_tanstack_query",
        "label": "TanStack Query",
        "ecosystem": "next.js",
        "summary": "サーバデータの取得/キャッシュ/更新をアプリ側で明確に管理する。",
        "pros": ["キャッシュ/再取得/更新が強い", "非同期状態の整理がしやすい"],
        "cons": ["導入と理解が必要", "設計を雑にすると依存が散る"],
    },
    {
        "domain_key": "data_fetching_next",
        "key": "next_swr",
        "label": "SWR",
        "ecosystem": "next.js",
        "summary": "軽量なデータ取得・キャッシュ。小〜中規模でシンプルに運用したい場合。",
        "pros": ["軽い", "導入が簡単"],
        "cons": ["更新フローが複雑になると設計が必要"],
    },
    {
        "domain_key": "data_fetching_next",
        "key": "next_fetch_only",
        "label": "fetch（標準）+ 手動キャッシュ設計",
        "ecosystem": "next.js",
        "summary": "依存を増やさず標準で組む。規模が小さい/運用を絞る場合。",
        "pros": ["依存ゼロ", "挙動が素直"],
        "cons": ["キャッシュ/更新の型を自分で決める必要"],
    },

    # -----------------------
    # State management (Next.js)
    # -----------------------
    {
        "domain_key": "state_management_next",
        "key": "next_zustand",
        "label": "Zustand",
        "ecosystem": "next.js",
        "summary": "横断状態を軽量に扱う。UIローカル状態中心の構成で扱いやすい。",
        "pros": ["軽量", "導入が速い"],
        "cons": ["規模が大きい場合は設計が必要"],
    },
    {
        "domain_key": "state_management_next",
        "key": "next_jotai",
        "label": "Jotai",
        "ecosystem": "next.js",
        "summary": "アトム分割で細粒度に状態を扱う。局所的な状態が多い場合に合う。",
        "pros": ["細粒度", "Reactとの相性が良い"],
        "cons": ["設計方針がないと散る"],
    },
    {
        "domain_key": "state_management_next",
        "key": "next_redux_toolkit",
        "label": "Redux Toolkit",
        "ecosystem": "next.js",
        "summary": "状態の規約・デバッグ体験を強くする。規模/チーム前提で検討対象。",
        "pros": ["規約化しやすい", "DevToolsが強い"],
        "cons": ["導入コストが高い", "小規模だと過剰になりやすい"],
    },

    # -----------------------
    # Forms (Next.js)
    # -----------------------
    {
        "domain_key": "forms_next",
        "key": "next_react_hook_form",
        "label": "React Hook Form",
        "ecosystem": "next.js",
        "summary": "フォーム状態とバリデーションを軽量に扱う。実務で採用が多い。",
        "pros": ["軽い", "拡張が効く"],
        "cons": ["設計なしだとフォームが肥大化する"],
    },
    {
        "domain_key": "forms_next",
        "key": "next_formik",
        "label": "Formik",
        "ecosystem": "next.js",
        "summary": "フォーム管理の選択肢。既存資産がある場合に検討対象。",
        "pros": ["枯れている", "情報が多い"],
        "cons": ["新規での優先度は下がりがち"],
    },

    # -----------------------
    # Frontend schema/validation
    # -----------------------
    {
        "domain_key": "schema_validation_front",
        "key": "front_zod",
        "label": "Zod",
        "ecosystem": "next.js",
        "summary": "型とスキーマの整合を取りやすい。フォーム/API境界の検証を揃える用途。",
        "pros": ["TypeScriptと相性が良い", "表現が直感的"],
        "cons": ["大規模化するとスキーマ管理が必要"],
    },
    {
        "domain_key": "schema_validation_front",
        "key": "front_valibot",
        "label": "Valibot",
        "ecosystem": "next.js",
        "summary": "軽量なスキーマバリデーション。Zodの代替として検討されることがある。",
        "pros": ["軽量"],
        "cons": ["周辺事例はZodより薄い"],
    },

    # -----------------------
    # API client (Next.js)
    # -----------------------
    {
        "domain_key": "api_client_next",
        "key": "next_fetch",
        "label": "fetch API（標準）",
        "ecosystem": "next.js",
        "summary": "追加依存なしで運用する。小規模〜中規模の基本選択肢。",
        "pros": ["依存ゼロ", "標準で完結"],
        "cons": ["共通処理（リトライ/整形）を自作する必要"],
    },
    {
        "domain_key": "api_client_next",
        "key": "next_ky",
        "label": "Ky",
        "ecosystem": "next.js",
        "summary": "fetchラップで軽量に共通処理を持つ。",
        "pros": ["軽量", "扱いやすい"],
        "cons": ["高度な機能は別設計が必要"],
    },
    {
        "domain_key": "api_client_next",
        "key": "next_axios",
        "label": "Axios",
        "ecosystem": "next.js",
        "summary": "共通処理（interceptor等）を手早く持つ目的で使われる。",
        "pros": ["機能が揃っている", "扱い慣れてる人が多い"],
        "cons": ["依存が増える", "fetch標準化の流れとは方向が違う"],
    },

    # -----------------------
    # CSS system (Next.js)
    # -----------------------
    {
        "domain_key": "css_system_next",
        "key": "css_tailwind",
        "label": "Tailwind CSS",
        "ecosystem": "next.js",
        "summary": "ユーティリティで速度重視に組む。UI試作〜実装まで同一流儀に寄せやすい。",
        "pros": ["実装速度", "設計が崩れにくい"],
        "cons": ["慣れが必要", "クラスが長くなりやすい"],
    },
    {
        "domain_key": "css_system_next",
        "key": "css_modules",
        "label": "CSS Modules",
        "ecosystem": "next.js",
        "summary": "スコープ付きCSS。依存を増やさずに整理したい場合。",
        "pros": ["標準寄り", "依存が増えない"],
        "cons": ["設計規約がないとバラける"],
    },
    {
        "domain_key": "css_system_next",
        "key": "css_styled_components",
        "label": "styled-components",
        "ecosystem": "next.js",
        "summary": "CSS-in-JSでコンポーネント寄せ。チームの好み/資産がある場合に。",
        "pros": ["コンポーネントと近い", "テーマ化しやすい"],
        "cons": ["ランタイム/設定が増える", "方向性が分かれることがある"],
    },

    # -----------------------
    # Frontend auth (Next.js)
    # -----------------------
    {
        "domain_key": "auth_frontend_next",
        "key": "next_authjs",
        "label": "Auth.js（NextAuth）",
        "ecosystem": "next.js",
        "summary": "Next.jsで認証統合をまとめる選択肢。OAuth/OIDC連携を含めて扱える。",
        "pros": ["統合が速い", "事例が多い"],
        "cons": ["要件が外れるとカスタムが必要", "理解なしで使うと追えなくなる"],
    },
    {
        "domain_key": "auth_frontend_next",
        "key": "next_clerk",
        "label": "Clerk（外部Auth）",
        "ecosystem": "next.js",
        "summary": "外部認証基盤を使い、ユーザー管理やUIを短時間で揃える。",
        "pros": ["導入が速い", "UI/運用が揃う"],
        "cons": ["外部依存", "コスト/制約が発生"],
    },
    {
        "domain_key": "auth_frontend_next",
        "key": "next_supabase_auth",
        "label": "Supabase Auth",
        "ecosystem": "next.js",
        "summary": "Supabase利用前提の認証。DB/ストレージとまとめて選ぶと一貫する。",
        "pros": ["BaaS統合", "導入が速い"],
        "cons": ["採用がインフラ選択を固定しやすい"],
    },

    # -----------------------
    # iOS / Android UI
    # -----------------------
    {
        "domain_key": "ui_framework_ios",
        "key": "ios_swiftui",
        "label": "SwiftUI",
        "ecosystem": "ios",
        "summary": "宣言的UI。新規開発で標準寄りの方向に寄せたい場合。",
        "pros": ["宣言的で書きやすい", "状態管理と相性が良い"],
        "cons": ["細かいUI/既存資産ではUIKit知識が必要になることがある"],
    },
    {
        "domain_key": "ui_framework_ios",
        "key": "ios_uikit",
        "label": "UIKit",
        "ecosystem": "ios",
        "summary": "従来型UI。既存資産や細かい制御が必要な場合に。",
        "pros": ["成熟している", "制御が細かい"],
        "cons": ["宣言的UIより実装コストが上がりやすい"],
    },
    {
        "domain_key": "ui_framework_android",
        "key": "android_compose",
        "label": "Jetpack Compose",
        "ecosystem": "android",
        "summary": "宣言的UI。新規開発で標準寄りに寄せたい場合。",
        "pros": ["宣言的", "状態管理と相性が良い"],
        "cons": ["古いView資産と混在すると設計が必要"],
    },
    {
        "domain_key": "ui_framework_android",
        "key": "android_views",
        "label": "Android Views（XML）",
        "ecosystem": "android",
        "summary": "従来型UI。既存資産や要件で必要な場合に。",
        "pros": ["成熟している", "既存資産を活かせる"],
        "cons": ["新規ではComposeが主流になりやすい"],
    },
]


def seed_tech_presets(db: Session = None):
    """技術選定プリセットの初期データを投入"""
    close_session = False
    if db is None:
        db = SessionLocal()
        close_session = True

    try:
        # 既存データの確認
        existing_domains = db.query(TechDomain).count()
        if existing_domains > 0:
            print(f"既に{existing_domains}件のdomainが存在します。スキップします。")
            return

        # Domainを作成
        domain_map = {}
        for domain_data in DOMAINS:
            domain = TechDomain(
                key=domain_data["key"],
                name=domain_data["name"],
                description=domain_data["description"],
                decision_prompt=domain_data["decision_prompt"]
            )
            db.add(domain)
            db.flush()
            domain_map[domain_data["key"]] = domain.id
            print(f"Domain作成: {domain_data['key']}")

        # Stackを作成
        for stack_data in STACKS:
            domain_key = stack_data["domain_key"]
            domain_id = domain_map.get(domain_key)
            if not domain_id:
                print(f"警告: domain_key '{domain_key}' が見つかりません。スキップ: {stack_data['key']}")
                continue

            stack = TechStack(
                domain_id=domain_id,
                key=stack_data["key"],
                label=stack_data["label"],
                ecosystem=stack_data["ecosystem"],
                summary=stack_data["summary"],
                pros=stack_data["pros"],
                cons=stack_data["cons"]
            )
            db.add(stack)
            print(f"Stack作成: {stack_data['key']} -> {domain_key}")

        db.commit()
        print(f"\nシードデータの投入が完了しました。")
        print(f"Domains: {len(DOMAINS)}件")
        print(f"Stacks: {len(STACKS)}件")

    except Exception as e:
        db.rollback()
        print(f"エラー: {e}")
        raise
    finally:
        if close_session:
            db.close()


if __name__ == "__main__":
    seed_tech_presets()
