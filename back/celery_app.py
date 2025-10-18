"""
Celery アプリケーション設定
Phase 3: タスクハンズオン生成の非同期処理基盤
"""
from celery import Celery
import os

# Dockerコンテナ内を想定（docker-compose.ymlで設定）
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "hackathon_support_agent",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Tokyo",
    enable_utc=True,

    # タスク追跡
    task_track_started=True,

    # タイムアウト設定
    # 単一タスク: 5分（パース含め十分）
    # プロジェクト全体: 60分（62タスク想定）
    task_time_limit=3600,       # ハードリミット（60分）
    task_soft_time_limit=3300,  # ソフトリミット（55分、警告）

    # リトライ設定
    task_acks_late=True,          # タスク完了後にACK
    task_reject_on_worker_lost=True,  # Worker停止時に再キュー

    # 🔧 Redis コマンド最適化設定
    result_expires=3600,  # 結果を1時間で自動削除（デフォルト24時間）
    result_backend_transport_options={
        'master_name': None,
        'visibility_timeout': 3600,
        'retry_policy': {
            'max_retries': 3,
        }
    },

    # 不要な状態保存を削減
    task_ignore_result=False,  # chordで結果が必要なのでFalse
    task_store_eager_result=False,  # EAGER_MODE無効化（本番用）

    # Redisポーリング間隔の調整
    broker_transport_options={
        'visibility_timeout': 43200,  # 12時間（長時間タスク対応）
        'fanout_prefix': True,
        'fanout_patterns': True,
    },

    # タスク自動検出（tasksディレクトリ配下）
    imports=[
        "tasks.hands_on_tasks",  # Phase 3: ハンズオン生成タスク
    ],
)

if __name__ == "__main__":
    celery_app.start()
