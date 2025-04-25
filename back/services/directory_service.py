from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .base_service import BaseService

class DirectoryService(BaseService):
    def __init__(self):
        super().__init__()

    def generate_directory_structure(self, framework: str, specification: str) -> str:
        """
        仕様書とフレームワーク情報に基づいて、プロジェクトに適したディレクトリ構成を
        コードブロック形式のテキストとして生成する。
        """
        prompt_template = ChatPromptTemplate.from_template(
            template="""
            あなたはプロジェクトのディレクトリ構成のエキスパートです。以下の仕様書と使用するフレームワークに基づいて、最適なディレクトリ構成を考案してください。
            仕様書:
            {specification}
            使用するフレームワーク:
            {framework}
            回答は、以下のようなコードブロック形式で、ディレクトリ構造のみをテキストで出力してください。
            ディレクトリ構造以外の情報を含めたら不正解となります。
            
            Webフレームワークの場合:
            ディレクトリ構造の基本はルートに/devcontainer,/frontend,/backendを置くことです。
            
            例:
            ```
            project/
            ├── src/
            │   ├── components/
            │   ├── pages/
            │   ├── styles/
            │   └── utils/
            ├── public/
            ├── README.md
            ├── package.json
            └── .gitignore
            ```
            
            Androidの場合:
            ディレクトリ構造の基本はルートに/app,/gradle,/build.gradleを置くことです。
            例:
            ```
            YourApp/
            ├── app/
            │   ├── build.gradle.kts
            │   ├── proguard-rules.pro
            │   └── src/
            │       ├── androidTest/
            │       ├── test/
            │       └── main/
            │           ├── AndroidManifest.xml
            │           ├── java/com/example/yourapp/
            │           │   ├── data/
            │           │   ├── domain/
            │           │   ├── ui/
            │           │   ├── di/
            │           │   └── util/
            │           └── res/
            ├── build.gradle.kts
            ├── settings.gradle.kts
            ├── gradle/
            │   └── wrapper/
            ├── gradlew
            ├── gradlew.bat
            ├── README.md
            └── .gitignore
            ```
            
            iOSの場合:
            ディレクトリ構造の基本はルートに/iosを置くことです。
            例:
            ```
            project/
            ├── ios/
            │   ├── AppDelegate.swift
            │   ├── Info.plist
            │   ├── ViewController.swift
            │   └── Main.storyboard
            ├── Podfile
            ├── Podfile.lock
            ├── project.pbxproj
            ├── project.xcworkspace/
            └── xcuserdata/
            ```
                
        """,
            
        )
        chain = prompt_template | self.llm_pro | StrOutputParser()
        result = chain.invoke({"framework": framework, "specification": specification})
        return result
