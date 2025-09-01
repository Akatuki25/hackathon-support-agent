import uuid
from datetime import date, datetime
from sqlalchemy import Column, String, Integer, Text, Date, DateTime, ForeignKey ,func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base

# ---------- Member -----------------------------------------------------------
class MemberBase(Base):
    __tablename__ = "member"

    member_id   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_name = Column(String,  nullable=False)
    member_skill = Column(String, nullable=False)
    github_name  = Column(String, nullable=False)

    projects = relationship(
        "ProjectMember",
        back_populates="member_base",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<Member(id={self.member_id}, name={self.member_name})>"

# ---------- Project ----------------------------------------------------------
class ProjectBase(Base):
    __tablename__ = "projectBase"

    project_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title      = Column(String, nullable=False)
    idea       = Column(String, nullable=False)
    start_date = Column(Date,  nullable=False)
    end_date   = Column(DateTime, nullable=False)
    num_people = Column(Integer, nullable=False)

    document = relationship(
        "ProjectDocument",
        back_populates="project_base",
        uselist=False,
        cascade="all, delete-orphan",
    )
    members = relationship(
        "ProjectMember",
        back_populates="project_base",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<Project(id={self.project_id}, title={self.title})>"

# ---------- Project–Member link ---------------------------------------------
class ProjectMember(Base):
    __tablename__ = "projectMember"

    project_member_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id        = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id"), nullable=False, index=True)
    member_id         = Column(UUID(as_uuid=True), ForeignKey("member.member_id"),      nullable=False, index=True)
    member_name       = Column(String, nullable=False)  # ← typo 修正 menber_name → member_name

    project_base = relationship("ProjectBase", back_populates="members")
    member_base  = relationship("MemberBase",  back_populates="projects")

    def __repr__(self):
        return f"<ProjectMember(id={self.project_member_id}, project_id={self.project_id})>"

# ---------- Project document -------------------------------------------------
class ProjectDocument(Base):
    __tablename__ = "projectDocument"

    doc_id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projectBase.project_id", ondelete="CASCADE"), nullable=False, index=True)
    specification = Column(Text, nullable=False)
    specification_doc = Column(Text, nullable=False)
    frame_work_doc    = Column(Text, nullable=False)
    directory_info    = Column(Text, nullable=False)

    project_base = relationship("ProjectBase", back_populates="document")
    created_at = Column(
        DateTime(timezone=True),        # タイムゾーン付き
        server_default=func.now(),      # ← DB 側で NOW() を実行
        nullable=False,
    )
    def __repr__(self):
        return f"<ProjectDocument(id={self.doc_id}, project_id={self.project_id})>"
