import uuid
from datetime import date
# from sqlalchemy import create_engine, Column, String, Integer, Text, JSON, Date, ForeignKey # JSONは未使用
from sqlalchemy import create_engine, Column, String, Integer, Text, Date, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.ext.declarative import declarative_base
import os # __file__ の使用に備えて

# Baseの定義 (database.pyの内容をシミュレート、または置き換える)
# 実際のプロジェクトでは database.py からインポートしてください
Base = declarative_base()

# --- 提供されたモデル定義 ---

class MemberBase(Base):
    __tablename__ = "member"
    # メンバーID（文字列型、主キー）
    member_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    # メンバーのスキル（文字列）
    member_skill = Column(String, nullable=False)
    # github Name （文字列）
    github_name = Column(String, nullable=False)

    # ProjectMember とのリレーションシップを追加
    # ProjectMember の member_base リレーションシップに対応する
    projects = relationship("ProjectMember", back_populates="member_base")

    # reprを修正 (member_name -> github_name)
    def __repr__(self):
        # __repr__ 内で存在しない属性 self.member_name を参照していたため修正
        return f"<MemberBase(id={self.member_id}, name={self.github_name}, skill={self.member_skill})>"


class ProjectBase(Base):
    __tablename__ ="projectBase"
    project_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    idea = Column(String, nullable=False)
    duration = Column(Date, nullable=False)
    num_people = Column(Integer, nullable=False)

    # ProjectDocumentとのリレーションシップ (任意ですが便利です)
    # 'uselist=False' は1対1の関係を示します
    document = relationship("ProjectDocument", back_populates="project_base", uselist=False, cascade="all, delete-orphan")

    # ProjectMember とのリレーションシップを追加
    # ProjectMember の project_base リレーションシップに対応する
    members = relationship("ProjectMember", back_populates="project_base")

    def __repr__(self):
        return f"<ProjectBase(id={self.project_id}, idea={self.idea}, duration={self.duration}, num_people={self.num_people})>"


class ProjectMember(Base):
    __tablename__ = "projectMember"
    # プロジェクトメンバーID（文字列型、主キー）
    project_member_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))

    # プロジェクトID（文字列型、外部キー）
    project_id = Column(String, ForeignKey("projectBase.project_id"), nullable=False)
    # メンバーID（文字列型、外部キー）
    member_id = Column(String, ForeignKey("member.member_id"), nullable=False)

    # ProjectBaseとのリレーションシップ (任意ですが便利です)
    # ProjectBase の members リレーションシップに対応する
    project_base = relationship("ProjectBase", back_populates="members")

    # MemberBaseとのリレーションシップ (任意ですが便利です)
    # MemberBase の projects リレーションシップに対応する
    member_base = relationship("MemberBase", back_populates="projects")

    # menber_name -> member_name に修正
    member_name = Column(String, nullable=False)

    def __repr__(self):
        # repr に member_name を追加
        return f"<ProjectMember(id={self.project_member_id}, project_id={self.project_id}, member_id={self.member_id}, member_name={self.member_name})>"


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
        # reprを修正 (specification -> specification_doc, スライス範囲調整)
        # __repr__ 内で存在しない属性 self.specification を参照していたため修正
        spec_summary = self.specification_doc[:30] + '...' if self.specification_doc and len(self.specification_doc) > 30 else self.specification_doc
        # None の場合のreprを考慮して str() を使うとより安全ですが、今回は簡略化
        return f"<ProjectDocument(project_id={self.project_id}, specification_summary='{spec_summary}')>"

# --- テストコード ---
from dotenv import load_dotenv

# 環境変数の読み込み
load_dotenv("/workspaces/hackson_support_agent/back/.env.local")

DATABASE_URL = os.getenv("DATABASE_URL")


# インメモリSQLiteデータベースを使用
engine = create_engine(DATABASE_URL, echo=True)

# >>> ここで明示的にマッパー設定を完了させる <<<
# これにより、全てのモデルクラスとリレーションシップの情報がSQLAlchemyに登録される
try:
    Base.registry.configure()
    print("SQLAlchemy registry configured successfully.")
except Exception as e:
    print(f"Error during registry configuration: {e}")
    # 設定エラーは致命的なので、ここで終了させるか、適切に処理する
    # raise # デバッグのためにエラーを再発生させても良い

# テーブルを全て作成
# create_all は configure() の後に呼ぶのがより安全
Base.metadata.create_all(engine)
print("Database tables created successfully.")


# セッションを作成するファクトリを作成
Session = sessionmaker(bind=engine)

# テストデータの作成と挿入
def test_models():
    session = Session()
    print("Database session created.")

    try:
        # 1. メンバーの作成
        print("Attempting to create MemberBase instances...")
        member1 = MemberBase(
            member_skill="PythonとSQL",
            github_name="vyuma"
        )
        member2 = MemberBase(
            member_skill="JavaScript, Frontend",
            github_name="user2_github"
        )
        session.add_all([member1, member2])
        session.commit() # メンバーIDが生成されるようにコミット
        print("MemberBase instances created and committed.")

        # 2. プロジェクトの作成
        print("Attempting to create ProjectBase instance...")
        project1 = ProjectBase(
            idea="Develop a web application",
            duration=date(2024, 12, 31),
            num_people=5
        )
        session.add(project1)
        session.commit() # プロジェクトIDが生成されるようにコミット
        print("ProjectBase instance created and committed.")


        # 3. プロジェクトドキュメントの作成とプロジェクトへの紐付け
        print("Attempting to create ProjectDocument instance...")
        # project1 のコミット後に ID が生成されるので、ここで参照
        project1_doc = ProjectDocument(
            project_id=project1.project_id, # ProjectBaseからIDを取得
            specification_doc="Initial specification details...",
            frame_work_doc="React, Flask",
            directory_info="/src/backend, /src/frontend"
        )
        session.add(project1_doc)
        session.commit() # ドキュメントが保存されるようにコミット
        print("ProjectDocument instance created and committed.")

        # 4. プロジェクトとメンバーの紐付け (ProjectMember)
        print("Attempting to create ProjectMember instances...")
        # member1, member2, project1 のコミット後に ID が生成されるので、ここで参照
        project_member1_1 = ProjectMember(
            project_id=project1.project_id,
            member_id=member1.member_id,
            member_name=member1.github_name # member_nameをgithub_nameから設定
        )
        project_member1_2 = ProjectMember(
            project_id=project1.project_id,
            member_id=member2.member_id,
            member_name=member2.github_name # member_nameをgithub_nameから設定
        )
        session.add_all([project_member1_1, project_member1_2])
        session.commit() # ProjectMemberが保存されるようにコミット
        print("ProjectMember instances created and committed.")

        print("\n--- データ挿入完了 ---")

        # --- データ取得と検証 ---

        # メンバーを取得して検証
        print("\n--- データ取得と検証 ---")
        retrieved_member1 = session.query(MemberBase).filter_by(github_name="user1_github").first()
        print(f"取得したメンバー: {retrieved_member1}")
        assert retrieved_member1 is not None
        assert retrieved_member1.member_skill == "Python, SQL"
        assert len(retrieved_member1.projects) == 1 # project1に紐付いているか

        # プロジェクトを取得して検証
        retrieved_project1 = session.query(ProjectBase).filter_by(idea="Develop a web application").first()
        print(f"取得したプロジェクト: {retrieved_project1}")
        assert retrieved_project1 is not None
        assert retrieved_project1.num_people == 5

        # プロジェクトからドキュメントを取得して検証 (1対1リレーション)
        retrieved_doc = retrieved_project1.document
        print(f"取得したプロジェクトドキュメント: {retrieved_doc}")
        assert retrieved_doc is not None
        assert retrieved_doc.specification_doc == "Initial specification details..."

        # プロジェクトから参加メンバーを取得して検証 (多対多リレーション via ProjectMember)
        print(f"プロジェクトに参加しているメンバー ({len(retrieved_project1.members)}人):")
        for pm in retrieved_project1.members:
            print(f"- ProjectMember ID: {pm.project_member_id}, Member Name (from ProjectMember): {pm.member_name}")
            # ProjectMemberからMemberBaseオブジェクトにアクセス
            print(f"  Associated MemberBase: {pm.member_base}")
            assert pm.member_base is not None
            # ProjectMemberからProjectBaseオブジェクトにアクセス
            print(f"  Associated ProjectBase: {pm.project_base}")
            assert pm.project_base is not None

        # MemberBaseから参加プロジェクトを取得して検証 (多対多リレーション via ProjectMember)
        retrieved_member2_again = session.query(MemberBase).filter_by(github_name="user2_github").first()
        print(f"\nメンバー '{retrieved_member2_again.github_name}' が参加しているプロジェクト ({len(retrieved_member2_again.projects)}件):")
        for pm in retrieved_member2_again.projects:
             print(f"- ProjectMember ID: {pm.project_member_id}, Project Idea (from ProjectBase via ProjectMember): {pm.project_base.idea}")
             assert pm.project_base is not None

        print("\n--- 簡易テスト成功 ---")

    except Exception as e:
        session.rollback()
        print(f"\n!!! テスト中にエラーが発生しました: {e}")
        raise # エラーの詳細を確認するために再発生させる
    finally:
        session.close()
        print("Database session closed.")
        # 必要に応じてテーブルを削除する場合は以下のコメントを外す
        # print("Dropping database tables...")
        # Base.metadata.drop_all(engine)
        # print("Database tables dropped.")

# テストの実行
if __name__ == "__main__":
    test_models()