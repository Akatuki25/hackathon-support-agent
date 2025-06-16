import uuid
from sqlalchemy import Column, String, Integer, Text, JSON

from database import Base

class Project(Base):
    __tablename__ = "projects"

    # プロジェクトID（文字列型、主キー）
    project_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # アイデア（文字列）
    idea = Column(String, nullable=False)
    
    # 期間（文字列）
    duration = Column(String, nullable=False)
    
    # 人数（整数型）
    num_people = Column(Integer, nullable=False)
    
    # 仕様書（長い文字列）
    specification = Column(Text, nullable=False)
    
    # 選択フレームワーク（文字列）
    selected_framework = Column(String, nullable=False)
    
    # ディレクトリ情報（長い文字列）
    directory_info = Column(Text, nullable=False)
    
    # メンバー情報（JSON型：メンバーのリストを保存）
    menber_info = Column(JSON, nullable=True)
    
    # タスク情報（JSON型：タスクのリストを保存）
    task_info = Column(JSON, nullable=True)
    
    # 環境構築ハンズオン
    envHanson = Column(Text, nullable=True)
    





