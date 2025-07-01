import uuid
from datetime import date
from sqlalchemy import create_engine, Column, String, Integer, Text, JSON, Date, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.ext.declarative import declarative_base
import os
import sys
from database import Base

class MemberBase(Base):
    __tablename__ = "member"
    # メンバーID（文字列型、主キー）
    member_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    member_name = Column(String, nullable=False)  # メンバー名（文字列）
    # メンバーのスキル（文字列）
    member_skill = Column(String, nullable=False)
    # github Name （文字列）
    github_name = Column(String, nullable=False)
    projects = relationship( # ★ 追加
    "ProjectMember",
    back_populates="member_base",
    cascade="all, delete-orphan",
    )
    
    def __repr__(self):
        return f"<MemberBase(id={self.member_id}, name={self.member_name}, skill={self.member_skill})>"

class ProjectMember(Base):
    __tablename__ = "projectMember"
    # プロジェクトメンバーID（文字列型、主キー）
    project_member_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))

    # プロジェクトID（文字列型、外部キー）
    project_id = Column(String, ForeignKey("projectBase.project_id"), nullable=False)
    # メンバーID（文字列型、外部キー）
    member_id = Column(String, ForeignKey("member.member_id"), nullable=False)
    menber_name = Column(String, nullable=False)

    # MemberBaseとのリレーションシップ (任意ですが便利です)
    member_base = relationship("MemberBase", back_populates="projects")
    
    def __repr__(self):
        return f"<ProjectMember(id={self.project_member_id}, project_id={self.project_id}, member_id={self.member_id})>"


class ProjectBase(Base):
    __tablename__ ="projectBase"
    project_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    idea = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    num_people = Column(Integer, nullable=False)

    # ProjectDocumentとのリレーションシップ (任意ですが便利です)
    # 'uselist=False' は1対1の関係を示します
    document = relationship("ProjectDocument", back_populates="project_base", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<ProjectBase(id={self.project_id}, idea={self.idea}, duration={self.duration}, num_people={self.num_people})>"

class ProjectDocument(Base):
    __tablename__ = "projectDocument"
    # ProjectBaseのproject_idへの外部キーとして定義し、同時に主キーとします
    project_id = Column(String, ForeignKey("projectBase.project_id"), primary_key=True, index=True)
    specification_doc = Column(Text, nullable=False)
    frame_work_doc = Column(String, nullable=False)
    directory_info = Column(Text, nullable=False)
    
    # ProjectBaseとのリレーションシップ (任意ですが便利です)
    project_base = relationship("ProjectBase", back_populates="document")

    def __repr__(self):
        return f"<ProjectDocument(project_id={self.project_id}, specification_summary='{self.specification[:30]}...')>" # reprは簡潔に

