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

    # タスク自動検出（tasksディレクトリ配下）
    imports=[
        "tasks.hands_on_tasks",  # Phase 3: ハンズオン生成タスク
    ],
)

if __name__ == "__main__":
    celery_app.start()
