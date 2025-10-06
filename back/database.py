import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv

# 環境変数の読み込み
load_dotenv()


DATABASE_URL = os.getenv("DATABASE_URL")
print(DATABASE_URL)
# エンジンの作成
engine = create_engine(DATABASE_URL, echo=False)

# セッション作成用のファクトリ
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# SQLAlchemy のベースクラス（モデル定義で継承する）
Base = declarative_base()

# DBセッション取得用 dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ツール用の独立したDBセッションを提供（並列実行対応）
@contextmanager
def get_db_session():
    """
    各ツールが独立したDBセッションを使用するためのコンテキストマネージャー
    並列実行時のセッション競合を回避する
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()