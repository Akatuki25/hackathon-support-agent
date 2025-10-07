import json
import re
import uuid
import time
from typing import List, Dict, Any, Optional
from langchain.tools import StructuredTool
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from json_repair import repair_json
from google.api_core.exceptions import ResourceExhausted

from .base_service import BaseService
from models.project_base import (
    ProjectBase, ProjectDocument, ProjectMember, QA, AIDocument,
    StructuredFunction, FunctionDependency, FunctionToTaskMapping
)


class ContextualInformationRetrieval:
    """関連情報のセマンティック検索クラス"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_relevant_qas(self, project_id: str, function_keywords: List[str]) -> List[Dict]:
        """機能に関連するQ&Aのみを抽出"""
        
        all_qas = self.db.query(QA).filter(
            QA.project_id == project_id,
            QA.answer.isnot(None)
        ).all()
        
        relevant_qas = []
        
        for qa in all_qas:
            relevance_score = self._calculate_relevance(qa, function_keywords)
            
            if relevance_score > 0.3:  # 閾値
                relevant_qas.append({
                    "question": qa.question,
                    "answer": qa.answer,
                    "importance": qa.importance,
                    "relevance_score": relevance_score
                })
        
        # 関連度と重要度でソート
        relevant_qas.sort(key=lambda x: (x["relevance_score"], x["importance"]), reverse=True)
        
        # 上位5つまでに制限
        return relevant_qas[:5]
    
    def _calculate_relevance(self, qa: QA, keywords: List[str]) -> float:
        """簡易的な関連度計算"""
        text = f"{qa.question} {qa.answer or ''}".lower()
        
        # キーワードマッチング
        keyword_matches = sum(1 for kw in keywords if kw.lower() in text)
        keyword_score = keyword_matches / len(keywords) if keywords else 0
        
        # 機能関連用語のマッチング
        function_terms = ["機能", "画面", "api", "データ", "処理", "登録", "表示", "管理", "認証"]
        function_matches = sum(1 for term in function_terms if term in text)
        function_score = min(function_matches / 3, 1.0)  # 上限1.0
        
        # 重要度による重み付け
        importance_weight = qa.importance / 5.0 if qa.importance else 0.5
        
        return (keyword_score * 0.5 + function_score * 0.3) * importance_weight

    def get_contextual_specification(self, specification: str, function_doc: str) -> str:
        """機能要件に関連する要件定義の部分を抽出"""
        
        # 機能要件書からキーワードを抽出
        keywords = self._extract_keywords_from_function_doc(function_doc)
        
        # 要件定義書を段落に分割
        paragraphs = specification.split('\n\n')
        
        relevant_paragraphs = []
        for paragraph in paragraphs:
            if len(paragraph.strip()) < 50:  # 短すぎる段落は除外
                continue
                
            relevance = self._calculate_paragraph_relevance(paragraph, keywords)
            if relevance > 0.4:
                relevant_paragraphs.append({
                    "text": paragraph.strip(),
                    "relevance": relevance
                })
        
        # 関連度でソート、上位3段落まで
        relevant_paragraphs.sort(key=lambda x: x["relevance"], reverse=True)
        
        return "\n\n".join([p["text"] for p in relevant_paragraphs[:3]])
    
    def _extract_keywords_from_function_doc(self, function_doc: str) -> List[str]:
        """機能要件書からキーワードを抽出"""
        # 簡易的なキーワード抽出（名詞句を重視）
        keywords = []
        
        # 見出しから抽出
        headers = re.findall(r'^#{1,3}\s+(.+)$', function_doc, re.MULTILINE)
        keywords.extend([h.strip() for h in headers])
        
        # 重要な動詞句を抽出
        action_patterns = [
            r'(\w+)を(\w+)する',
            r'(\w+)できる',
            r'(\w+)機能',
            r'(\w+)画面',
            r'(\w+)API'
        ]
        
        for pattern in action_patterns:
            matches = re.findall(pattern, function_doc)
            for match in matches:
                if isinstance(match, tuple):
                    keywords.extend(match)
                else:
                    keywords.append(match)
        
        # 重複除去と短すぎるものを除外
        unique_keywords = list(set([kw for kw in keywords if len(kw) > 1]))
        
        return unique_keywords[:10]  # 上位10個まで
    
    def _calculate_paragraph_relevance(self, paragraph: str, keywords: List[str]) -> float:
        """段落の関連度を計算"""
        text = paragraph.lower()
        
        # キーワードマッチング
        keyword_matches = sum(1 for kw in keywords if kw.lower() in text)
        keyword_score = keyword_matches / len(keywords) if keywords else 0
        
        # 機能記述パターンのマッチング
        function_patterns = [
            r'ユーザーは.*できる',
            r'システムは.*する',
            r'画面には.*表示',
            r'データベースには.*保存',
            r'APIは.*返す'
        ]
        
        pattern_matches = sum(1 for pattern in function_patterns if re.search(pattern, text))
        pattern_score = min(pattern_matches / len(function_patterns), 1.0)
        
        return keyword_score * 0.7 + pattern_score * 0.3
    
    def gather_context(self, project_id: str) -> Dict[str, Any]:
        """プロジェクトのコンテキスト情報を統合収集"""
        
        try:
            # project_idをUUIDに変換
            project_uuid = uuid.UUID(project_id)
        except ValueError:
            raise ValueError(f"Invalid project_id format: {project_id}")
        
        # ProjectDocumentを取得（function_doc必須）
        project_doc = self.db.query(ProjectDocument).filter(
            ProjectDocument.project_id == project_uuid
        ).first()
        
        if not project_doc:
            raise ValueError(f"ProjectDocument not found for project_id: {project_id}")
        
        if not project_doc.function_doc:
            raise ValueError(f"function_doc not found for project_id: {project_id}")
        
        # 関連QAを取得
        relevant_qas = self.get_relevant_qas(
            project_id, 
            self._extract_keywords_from_function_doc(project_doc.function_doc)
        )
        
        # AIDocumentを取得（技術情報）
        ai_doc = self.db.query(AIDocument).filter(
            AIDocument.project_id == project_uuid
        ).first()
        
        # ProjectBaseを取得（制約情報）
        project_base = self.db.query(ProjectBase).filter(
            ProjectBase.project_id == project_uuid
        ).first()
        
        # コンテキスト情報の統合
        context = {
            "project_id": project_id,
            "function_doc": project_doc.function_doc,
            "specification": project_doc.specification or "",
            "framework_doc": project_doc.frame_work_doc or "",
            "directory_info": project_doc.directory_info or "",
            "relevant_qas": relevant_qas,
            "project": {
                "title": project_base.title if project_base else "",
                "idea": project_base.idea if project_base else "",
                "start_date": str(project_base.start_date) if project_base else "",
                "end_date": str(project_base.end_date) if project_base else "",
            },
            "technology": {
                "front_end": ai_doc.front_end if ai_doc else "",
                "back_end": ai_doc.back_end if ai_doc else "",
                "database": ai_doc.database if ai_doc else "",
                "deployment": ai_doc.deployment if ai_doc else "",
            }
        }
        
        # コンテキスト仕様の抽出
        if context["specification"] and context["function_doc"]:
            context["contextual_specification"] = self.get_contextual_specification(
                context["specification"], 
                context["function_doc"]
            )
        else:
            context["contextual_specification"] = ""
        
        return context


class FunctionStructuringPipeline:
    """機能構造化のパイプライン処理"""
    
    def __init__(self, db: Session):
        self.db = db
        self.base_service = BaseService(db=db)
        self.llm_pro = self.base_service.llm_pro
        self.llm_judge = self.base_service.llm_flash  # 判定用は高速モデル
    
    def structure_functions_with_context(self, context: Dict) -> Dict:
        """コンテキスト情報を活用した機能構造化"""
        
        try:
            # Step 1: 機能抽出 + 判定
            extracted = self._extract_functions(context["function_doc"], context)
            validation1 = self._validate_extraction(extracted, context["function_doc"])
            
            if validation1.get("needs_revision", False):
                extracted = self._revise_extraction(extracted, validation1.get("suggestions", []))
            
            # Step 2: カテゴリ分類 + 判定
            categorized = self._categorize_functions(extracted, context)
            validation2 = self._validate_categorization(categorized)
            
            if validation2.get("needs_revision", False):
                categorized = self._revise_categorization(categorized, validation2.get("suggestions", []))
            
            # Step 3: 優先度設定 + 判定
            prioritized = self._assign_priorities(categorized, context)
            validation3 = self._validate_priorities(prioritized, context.get("project", {}))
            
            if validation3.get("needs_revision", False):
                prioritized = self._revise_priorities(prioritized, validation3.get("suggestions", []))
            
            # Step 4: 依存関係分析 + 判定
            dependencies = self._analyze_dependencies(prioritized, context)
            validation4 = self._validate_dependencies(prioritized, dependencies)
            
            if validation4.get("needs_revision", False):
                dependencies = self._revise_dependencies(dependencies, validation4.get("suggestions", []))
            
            # Step 5: 最終判定
            final_data = {"functions": prioritized, "dependencies": dependencies}
            final_validation = self._final_validation(final_data, context)
            
            if final_validation.get("judgment") == "REJECT":
                raise ValueError(f"Final validation failed: {final_validation.get('reason', 'Unknown error')}")
            
            # Step 6: DB保存
            if final_validation.get("judgment") in ["APPROVE", "REVISE_NEEDED"]:
                saved_data = self._save_to_database(context["project_id"], final_data)
                return {"success": True, "data": saved_data, "validation": final_validation}
                
        except Exception as e:
            self.base_service.logger.error(f"Function structuring failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def _extract_functions(self, function_doc: str, context: Dict) -> List[Dict]:
        """機能抽出"""
        
        prompt = ChatPromptTemplate.from_template("""
        以下のテキストから独立した機能を抽出してください。
        
        機能要件書:
        {function_doc}
        
        プロジェクト制約:
        {constraints}
        
        抽出基準:
        1. 単一の責任を持つ機能単位
        2. ユーザーが実行できるアクション
        3. システムが提供するサービス
        4. 明確な入力・出力・処理を持つもの
        5. ハッカソンで実装可能な粒度
        
        出力形式（JSON配列のみ）:
        [
          {{
            "function_name": "ユーザー登録",
            "description": "新規ユーザーがアカウントを作成する",
            "estimated_category": "auth",
            "text_position": 1
          }}
        ]
        """)
        
        chain = prompt | self.llm_pro | StrOutputParser()
        result = chain.invoke({
            "function_doc": function_doc,
            "constraints": json.dumps(context.get("project", {}), ensure_ascii=False)
        })
        
        try:
            # JSON修復処理
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"JSON repair failed: {str(e)}")
            return []
    
    def _categorize_functions(self, functions: List[Dict], context: Dict) -> List[Dict]:
        """カテゴリ分類"""
        
        prompt = ChatPromptTemplate.from_template("""
        以下の機能を適切なカテゴリに分類してください。
        
        機能リスト:
        {functions}
        
        技術制約:
        {tech_constraints}
        
        カテゴリ定義:
        - auth: 認証、ログイン、権限管理
        - data: データベース操作、CRUD、データ永続化
        - logic: ビジネスロジック、計算処理、アルゴリズム
        - ui: フロントエンド、画面、ユーザーインターフェース
        - api: 外部API連携、通信、データ取得
        - deployment: デプロイ設定、環境構築、インフラ
        
        各機能に確定的なカテゴリを割り当てて出力してください（JSON配列のみ）。
        """)
        
        chain = prompt | self.llm_pro | StrOutputParser()
        result = chain.invoke({
            "functions": json.dumps(functions, ensure_ascii=False),
            "tech_constraints": json.dumps(context.get("technology", {}), ensure_ascii=False)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Categorization failed: {str(e)}")
            return functions
    
    def _assign_priorities(self, functions: List[Dict], context: Dict) -> List[Dict]:
        """優先度設定"""
        
        prompt = ChatPromptTemplate.from_template("""
        ハッカソンプロジェクトの制約を考慮して優先度を設定してください。
        
        機能リスト:
        {functions}
        
        プロジェクト制約:
        {constraints}
        
        優先度定義:
        - Must: MVP必須機能（最小限のユーザー価値を提供）
        - Should: 価値は高いが必須ではない
        - Could: あれば良い機能
        - Wont: 今回は実装しない
        
        判定基準:
        1. 期間内に実装可能か
        2. チーム規模に適しているか
        3. MVPとして必要最小限か
        4. ユーザー価値を提供するか
        
        各機能に優先度を割り当てて出力してください（JSON配列のみ）。
        """)
        
        chain = prompt | self.llm_pro | StrOutputParser()
        result = chain.invoke({
            "functions": json.dumps(functions, ensure_ascii=False),
            "constraints": json.dumps(context.get("project", {}), ensure_ascii=False)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Priority assignment failed: {str(e)}")
            return functions
    
    def _analyze_dependencies(self, functions: List[Dict], context: Dict) -> List[Dict]:
        """依存関係分析"""
        
        prompt = ChatPromptTemplate.from_template("""
        機能間の依存関係を分析してください。
        
        機能リスト:
        {functions}
        
        依存関係の種類:
        - requires: AがないとBは動作しない
        - blocks: Aが完了しないとBは開始できない
        - relates: AとBは関連するが独立して実装可能
        
        分析観点:
        1. データフロー依存
        2. 前提条件依存
        3. UI/UXフロー依存
        4. 技術的依存
        
        出力形式（JSON配列のみ）:
        [
          {{
            "from_function": "ユーザー登録",
            "to_function": "ログイン",
            "dependency_type": "blocks",
            "reason": "ユーザーアカウントが必要"
          }}
        ]
        """)
        
        chain = prompt | self.llm_pro | StrOutputParser()
        result = chain.invoke({
            "functions": json.dumps(functions, ensure_ascii=False)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Dependency analysis failed: {str(e)}")
            return []
    
    # === LLM as a Judge バリデーション ===
    
    def _validate_extraction(self, extracted_functions: List[Dict], original_text: str) -> Dict:
        """抽出された機能の妥当性をLLMが判定"""
        
        prompt = ChatPromptTemplate.from_template("""
        元のテキストから抽出された機能リストを評価してください。
        
        元テキスト:
        {original_text}
        
        抽出された機能:
        {extracted_functions}
        
        以下の観点で評価:
        1. 漏れはないか（Completeness）
        2. 重複はないか（Uniqueness） 
        3. 適切な粒度か（Granularity）
        4. 独立性はあるか（Independence）
        
        JSON形式で回答してください:
        {{
          "needs_revision": false,
          "completeness_score": 0.8,
          "issues": [],
          "suggestions": []
        }}
        """)
        
        chain = prompt | self.llm_judge | StrOutputParser()
        result = chain.invoke({
            "original_text": original_text[:2000],  # 長すぎる場合は切り詰め
            "extracted_functions": json.dumps(extracted_functions, ensure_ascii=False)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Extraction validation failed: {str(e)}")
            return {"needs_revision": False, "completeness_score": 0.7}
    
    def _validate_categorization(self, categorized_functions: List[Dict]) -> Dict:
        """カテゴリ分類の一貫性をLLMが判定"""
        
        prompt = ChatPromptTemplate.from_template("""
        機能のカテゴリ分類を評価してください。
        
        分類結果:
        {categorized_functions}
        
        カテゴリ定義:
        - auth: 認証、ログイン、権限管理
        - data: データベース操作、CRUD、データ永続化
        - logic: ビジネスロジック、計算処理
        - ui: フロントエンド、画面表示
        - api: 外部API連携、通信
        - deployment: デプロイ、環境構築
        
        判定項目:
        1. 各機能のカテゴリは適切か
        2. 分類に一貫性はあるか
        3. 境界が曖昧な機能はないか
        
        JSON形式で回答:
        {{
          "needs_revision": false,
          "consistency_score": 0.9,
          "misclassified_functions": [],
          "suggestions": []
        }}
        """)
        
        chain = prompt | self.llm_judge | StrOutputParser()
        result = chain.invoke({
            "categorized_functions": json.dumps(categorized_functions, ensure_ascii=False)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Categorization validation failed: {str(e)}")
            return {"needs_revision": False, "consistency_score": 0.8}
    
    def _validate_priorities(self, functions: List[Dict], project_constraints: Dict) -> Dict:
        """優先度設定の妥当性をLLMが判定"""
        
        prompt = ChatPromptTemplate.from_template("""
        ハッカソンプロジェクトの制約を考慮して優先度設定を評価してください。
        
        プロジェクト制約:
        {project_constraints}
        
        機能と優先度:
        {functions}
        
        判定基準:
        1. Must機能はMVPとして必要最小限か
        2. 期間内に実装可能か
        3. チーム規模に適しているか
        4. Should/Couldの区別は適切か
        
        JSON形式で回答:
        {{
          "needs_revision": false,
          "feasibility_score": 0.8,
          "over_ambitious_functions": [],
          "suggestions": []
        }}
        """)
        
        chain = prompt | self.llm_judge | StrOutputParser()
        result = chain.invoke({
            "project_constraints": json.dumps(project_constraints, ensure_ascii=False),
            "functions": json.dumps(functions, ensure_ascii=False)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Priority validation failed: {str(e)}")
            return {"needs_revision": False, "feasibility_score": 0.7}
    
    def _validate_dependencies(self, functions: List[Dict], dependencies: List[Dict]) -> Dict:
        """依存関係の論理性をLLMが判定"""
        
        prompt = ChatPromptTemplate.from_template("""
        機能間の依存関係を評価してください。
        
        機能リスト:
        {functions}
        
        依存関係:
        {dependencies}
        
        判定項目:
        1. 依存関係は論理的に正しいか
        2. 循環依存はないか
        3. 実装順序は現実的か
        4. 不要な依存関係はないか
        
        JSON形式で回答:
        {{
          "needs_revision": false,
          "logical_consistency": 0.9,
          "circular_dependencies": [],
          "suggestions": []
        }}
        """)
        
        chain = prompt | self.llm_judge | StrOutputParser()
        result = chain.invoke({
            "functions": json.dumps(functions, ensure_ascii=False),
            "dependencies": json.dumps(dependencies, ensure_ascii=False)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Dependency validation failed: {str(e)}")
            return {"needs_revision": False, "logical_consistency": 0.8}
    
    def _final_validation(self, structured_data: Dict, context: Dict) -> Dict:
        """構造化データ全体の整合性をLLMが最終判定"""
        
        prompt = ChatPromptTemplate.from_template("""
        機能構造化の最終結果を総合評価してください。
        
        構造化結果:
        {structured_data}
        
        プロジェクトコンテキスト:
        {context}
        
        総合判定項目:
        1. ハッカソンプロジェクトとして実現可能か
        2. 機能間の関係は論理的か
        3. 実装順序は明確か
        4. MVPとしてユーザー価値を提供できるか
        
        JSON形式で回答:
        {{
          "judgment": "APPROVE",
          "overall_score": 0.85,
          "reason": "実装可能で価値のあるMVPとして構造化されている",
          "recommendations": []
        }}
        
        judgment: APPROVE / REJECT / REVISE_NEEDED
        """)
        
        chain = prompt | self.llm_judge | StrOutputParser()
        result = chain.invoke({
            "structured_data": json.dumps(structured_data, ensure_ascii=False),
            "context": json.dumps(context, ensure_ascii=False)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Final validation failed: {str(e)}")
            return {"judgment": "APPROVE", "overall_score": 0.7, "reason": "Default approval"}
    
    # === 修正処理 ===
    
    def _revise_extraction(self, functions: List[Dict], suggestions: List[str]) -> List[Dict]:
        """抽出結果の修正"""
        if not suggestions:
            return functions
        
        prompt = ChatPromptTemplate.from_template("""
        以下の修正提案に基づいて機能リストを修正してください。
        
        現在の機能リスト:
        {functions}
        
        修正提案:
        {suggestions}
        
        修正した機能リストをJSON配列で出力してください。
        """)
        
        chain = prompt | self.llm_pro | StrOutputParser()
        result = chain.invoke({
            "functions": json.dumps(functions, ensure_ascii=False),
            "suggestions": "\n".join(suggestions)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Extraction revision failed: {str(e)}")
            return functions
    
    def _revise_categorization(self, functions: List[Dict], suggestions: List[str]) -> List[Dict]:
        """カテゴリ分類の修正"""
        if not suggestions:
            return functions
        
        prompt = ChatPromptTemplate.from_template("""
        以下の修正提案に基づいてカテゴリ分類を修正してください。
        
        現在の機能リスト:
        {functions}
        
        修正提案:
        {suggestions}
        
        修正した機能リストをJSON配列で出力してください。
        """)
        
        chain = prompt | self.llm_pro | StrOutputParser()
        result = chain.invoke({
            "functions": json.dumps(functions, ensure_ascii=False),
            "suggestions": "\n".join(suggestions)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Categorization revision failed: {str(e)}")
            return functions
    
    def _revise_priorities(self, functions: List[Dict], suggestions: List[str]) -> List[Dict]:
        """優先度の修正"""
        if not suggestions:
            return functions
        
        prompt = ChatPromptTemplate.from_template("""
        以下の修正提案に基づいて優先度を修正してください。
        
        現在の機能リスト:
        {functions}
        
        修正提案:
        {suggestions}
        
        修正した機能リストをJSON配列で出力してください。
        """)
        
        chain = prompt | self.llm_pro | StrOutputParser()
        result = chain.invoke({
            "functions": json.dumps(functions, ensure_ascii=False),
            "suggestions": "\n".join(suggestions)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Priority revision failed: {str(e)}")
            return functions
    
    def _revise_dependencies(self, dependencies: List[Dict], suggestions: List[str]) -> List[Dict]:
        """依存関係の修正"""
        if not suggestions:
            return dependencies
        
        prompt = ChatPromptTemplate.from_template("""
        以下の修正提案に基づいて依存関係を修正してください。
        
        現在の依存関係:
        {dependencies}
        
        修正提案:
        {suggestions}
        
        修正した依存関係をJSON配列で出力してください。
        """)
        
        chain = prompt | self.llm_pro | StrOutputParser()
        result = chain.invoke({
            "dependencies": json.dumps(dependencies, ensure_ascii=False),
            "suggestions": "\n".join(suggestions)
        })
        
        try:
            repaired_json = repair_json(result)
            return json.loads(repaired_json)
        except Exception as e:
            self.base_service.logger.error(f"Dependency revision failed: {str(e)}")
            return dependencies
    
    def _save_to_database(self, project_id: str, structured_data: Dict) -> Dict:
        """構造化データをDBに保存"""
        
        try:
            functions = structured_data["functions"]
            dependencies = structured_data["dependencies"]
            
            saved_functions = []
            saved_dependencies = []
            
            # 機能の保存
            for i, func_data in enumerate(functions):
                function_code = f"F{str(i+1).zfill(3)}"
                
                # Debug: Check if func_data is a dictionary
                if not isinstance(func_data, dict):
                    self.base_service.logger.error(f"Expected dict but got {type(func_data)}: {func_data}")
                    # Try to parse if it's a JSON string
                    if isinstance(func_data, str):
                        try:
                            func_data = json.loads(func_data)
                        except json.JSONDecodeError:
                            self.base_service.logger.error(f"Failed to parse func_data as JSON: {func_data}")
                            func_data = {"function_name": f"Function_{i+1}", "description": str(func_data)}
                    else:
                        func_data = {"function_name": f"Function_{i+1}", "description": str(func_data)}
                
                raw_category = func_data.get("category", func_data.get("estimated_category", "logic"))
                structured_function = StructuredFunction(
                    project_id=project_id,
                    function_code=function_code,
                    function_name=func_data.get("function_name", ""),
                    description=func_data.get("description", ""),
                    category=self._normalize_category(raw_category),
                    priority=func_data.get("priority", "Should"),
                    extraction_confidence=0.8,
                    order_index=i + 1
                )
                
                self.db.add(structured_function)
                self.db.flush()  # IDを取得するため
                
                saved_functions.append({
                    "function_id": str(structured_function.function_id),
                    "function_code": function_code,
                    "function_name": structured_function.function_name
                })
            
            # 依存関係の保存
            function_name_to_id = {
                func["function_name"]: func["function_id"] 
                for func in saved_functions
            }
            
            for dep_data in dependencies:
                # Debug: Check if dep_data is a dictionary
                if not isinstance(dep_data, dict):
                    self.base_service.logger.error(f"Expected dict but got {type(dep_data)}: {dep_data}")
                    # Skip invalid dependency data
                    continue
                    
                from_name = dep_data.get("from_function")
                to_name = dep_data.get("to_function")
                
                if from_name in function_name_to_id and to_name in function_name_to_id:
                    dependency = FunctionDependency(
                        from_function_id=function_name_to_id[from_name],
                        to_function_id=function_name_to_id[to_name],
                        dependency_type=dep_data.get("dependency_type", "requires")
                    )
                    
                    self.db.add(dependency)
                    saved_dependencies.append({
                        "from_function": from_name,
                        "to_function": to_name,
                        "dependency_type": dep_data.get("dependency_type", "requires")
                    })
            
            self.db.commit()
            
            return {
                "functions": saved_functions,
                "dependencies": saved_dependencies,
                "total_functions": len(saved_functions),
                "total_dependencies": len(saved_dependencies)
            }
            
        except Exception as e:
            self.db.rollback()
            self.base_service.logger.error(f"Database save failed: {str(e)}")
            raise e
    
    # =================================================================
    # Public API Methods (Required by Agent)
    # =================================================================
    
    def extract_functions(self, specification: str) -> List[Dict]:
        """パブリック: 機能抽出API"""
        context = {"function_doc": specification}
        return self._extract_functions(specification, context)
    
    def categorize_functions(self, functions: List[Dict], context: Dict) -> List[Dict]:
        """パブリック: カテゴリ分類API"""
        return self._categorize_functions(functions, context)
    
    def prioritize_functions(self, functions: List[Dict], constraints: Dict) -> List[Dict]:
        """パブリック: 優先度設定API"""
        context = {"project": constraints}
        return self._assign_priorities(functions, context)
    
    def analyze_dependencies(self, functions: List[Dict], context: Dict) -> List[Dict]:
        """パブリック: 依存関係分析API"""
        return self._analyze_dependencies(functions, context)
    
    def save_to_database(self, project_id: str, functions: List[Dict], dependencies: List[Dict]) -> Dict:
        """パブリック: データベース保存API"""
        structured_data = {"functions": functions, "dependencies": dependencies}
        return self._save_to_database(project_id, structured_data)


# =================================================================
# ReAct Agent Implementation
# =================================================================

class FunctionStructuringAgent:
    """ReAct agent for function structuring with contextual information gathering"""
    
    def __init__(self, db: Session):
        self.db = db
        self.base_service = BaseService(db=db)
        self.context_retriever = ContextualInformationRetrieval(db)
        self.pipeline = FunctionStructuringPipeline(db)
        
        # Create tools for the agent (反復品質改善ループ用・増分追加設計)
        self.tools = [
            self._create_context_gathering_tool(),              # 1. コンテキスト情報収集
            self._create_get_existing_functions_tool(),         # 2. 既存機能取得（重複回避・反復ごとに再実行）
            self._create_function_extraction_tool(),            # 3. 機能抽出 (extract_function_batch)
            self._create_function_structuring_tool(),           # 4. 機能構造化 (structure_functions)
            self._create_validation_tool(),                     # 5. 品質バリデーション (validate_structured_functions)
            self._create_save_tool(),                           # 6. 増分DB追加 (add_structured_functions) ★複数回呼び出す★
            self._create_coverage_analysis_tool(),              # 7. 網羅性分析・完了判定 (analyze_coverage)
            self._create_delete_duplicate_tool()                # 8. 重複機能削除 (delete_duplicate_function)
        ]
        
        # Create LangGraph ReAct agent
        # llm_proを使用（gemini-2.0-flash-exp: agenticタスクに最適）
        self.agent_executor = create_react_agent(
            self.base_service.llm_pro,
            self.tools
        )
    
    def _get_system_prompt(self) -> str:
        return """
        あなたは機能構造化のエキスパートです。
        プロジェクトの仕様書から機能要件を構造化して、カテゴリ分け、優先度付け、依存関係の分析を行います。
        
        あなたの作業手順:
        1. まず、プロジェクトのコンテキスト情報を収集する
        2. 機能要件を抽出する
        3. 機能を構造化し、カテゴリ分けと優先度付けを行う
        4. 各ステップで品質をバリデーションする
        5. 最終的にデータベースに保存する
        
        各ツールを適切に使用し、段階的に作業を進めてください。
        エラーが発生した場合は、適切にリトライや修正を行ってください。
        """
    
    def _create_get_existing_functions_tool(self):
        """既存機能取得ツール"""
        
        def get_existing_functions(project_id: str) -> str:
            """プロジェクトの既存保存済み機能を取得"""
            try:
                from database import get_db_session
                
                self.base_service.logger.info(f"[AGENT] Getting existing functions for project: {project_id}")
                
                # 独立したDBセッションを使用（並列実行対応）
                with get_db_session() as db:
                    # 既存機能をDBから取得
                    existing_functions = db.query(StructuredFunction).filter(
                        StructuredFunction.project_id == project_id
                    ).all()
                    
                    # JSON形式に変換
                    functions_data = []
                    for func in existing_functions:
                        functions_data.append({
                            "function_id": str(func.function_id),
                            "function_name": func.function_name,
                            "description": func.description,
                            "category": func.category,
                            "priority": func.priority
                        })
                    
                    # 統計情報
                    stats = {
                        "total_count": len(functions_data),
                        "categories": list(set(f["category"] for f in functions_data if f["category"])),
                        "priorities": list(set(f["priority"] for f in functions_data if f["priority"]))
                    }
                    
                    result = {
                        "existing_functions": functions_data,
                        "statistics": stats
                    }
                
                self.base_service.logger.info(f"[AGENT] Found {len(functions_data)} existing functions")
                return f"既存機能取得完了: {len(functions_data)}個の機能が保存済み\n\nデータ:\n{json.dumps(result, ensure_ascii=False)}"
                
            except Exception as e:
                self.base_service.logger.error(f"[AGENT] Failed to get existing functions: {str(e)}")
                return f"既存機能取得エラー: {str(e)}"
        
        return StructuredTool.from_function(
            func=get_existing_functions,
            name="get_existing_functions",
            description="プロジェクトの既存保存済み機能を取得し、重複チェック用に使用します"
        )
    
    def _create_context_gathering_tool(self):
        """コンテキスト情報収集ツール"""
        
        def gather_context(project_id: str) -> str:
            """プロジェクトのコンテキスト情報を収集"""
            try:
                from database import get_db_session
                
                self.base_service.logger.info(f"[AGENT] Starting context gathering for project: {project_id}")
                
                # 独立したDBセッションを使用（並列実行対応）
                with get_db_session() as db:
                    retriever = ContextualInformationRetrieval(db)
                    context = retriever.gather_context(project_id)
                
                self.base_service.logger.info(f"[AGENT] Context gathered successfully. Keys: {list(context.keys()) if isinstance(context, dict) else 'Not a dict'}")
                
                # エージェントが使いやすいフォーマットで返す
                function_doc_length = len(context.get("function_doc", ""))
                specification_length = len(context.get("specification", ""))
                
                # トークン数削減のため、コンテキストデータの出力を最小限にする（実験）
                summary = f"""
                コンテキスト情報収集完了:
                - プロジェクトID: {context.get("project_id")}
                - 機能要件書の長さ: {function_doc_length}文字
                - 要件定義書の長さ: {specification_length}文字
                - 関連QA数: {len(context.get("relevant_qas", []))}件
                - 技術スタック: フロント={context.get("technology", {}).get("front_end", "")}, バック={context.get("technology", {}).get("back_end", "")}

                【重要】次のステップで extract_function_batch を呼び出す際は、以下のfunction_docを使用してください:

                <FUNCTION_DOC>
                {context.get("function_doc", "")}
                </FUNCTION_DOC>

                ※完全なコンテキストデータは省略（トークン数削減のため）
                """
                return summary
            except Exception as e:
                self.base_service.logger.error(f"[AGENT] Context gathering failed: {str(e)}")
                return f"コンテキスト収集エラー: {str(e)}"
        
        return StructuredTool.from_function(
            func=gather_context,
            name="gather_project_context",
            description="プロジェクトIDからコンテキスト情報（仕様書、QA、技術情報）を収集します"
        )
    
    def _create_function_extraction_tool(self):
        """段階的機能抽出ツール"""
        
        def extract_function_batch(specification: str, existing_functions: str = "", focus_area: str = "") -> str:
            """仕様書から機能要件を段階的に抽出（重複回避）"""
            try:
                self.base_service.logger.info(f"[AGENT] Starting batch function extraction (spec length: {len(specification)})")
                
                # 既存機能のパース
                existing_data = []
                if existing_functions.strip():
                    try:
                        existing_parsed = json.loads(existing_functions)
                        if isinstance(existing_parsed, dict) and "existing_functions" in existing_parsed:
                            existing_data = existing_parsed["existing_functions"]
                        elif isinstance(existing_parsed, list):
                            existing_data = existing_parsed
                    except:
                        pass  # 既存機能の解析に失敗した場合は空リストで続行
                
                # 重複チェック用の既存機能名リスト
                existing_names = [func.get("function_name", "") for func in existing_data]
                
                # コンテキストを作成
                context = {
                    "existing_functions": existing_names,
                    "focus_area": focus_area,
                    "extraction_mode": "incremental"
                }
                
                # 段階的抽出を実行
                functions = self.pipeline._extract_functions(specification, context)
                
                # 既存機能との重複を除去
                new_functions = []
                for func in functions:
                    func_name = func.get("function_name", "")
                    if func_name not in existing_names:
                        new_functions.append(func)
                
                self.base_service.logger.info(f"[AGENT] Batch extraction: {len(functions)} extracted, {len(new_functions)} new functions")
                
                functions_json = json.dumps(new_functions, ensure_ascii=False)
                return f"段階的機能抽出完了: {len(new_functions)}個の新機能を抽出\n\nJSONデータ:\n{functions_json}"
                
            except Exception as e:
                self.base_service.logger.error(f"[AGENT] Batch function extraction failed: {str(e)}")
                return f"段階的機能抽出エラー: {str(e)}"
        
        return StructuredTool.from_function(
            func=extract_function_batch,
            name="extract_function_batch",
            description="仕様書から機能要件を段階的に抽出し、既存機能との重複を回避します"
        )
    
    def _create_function_structuring_tool(self):
        """機能構造化ツール"""
        
        def structure_functions(functions_json: str) -> str:
            """機能をカテゴリ分けと優先度付けで構造化
            
            Args:
                functions_json: 抽出された機能のJSON文字列
            """
            try:
                from database import get_db_session
                
                # project_idはインスタンス変数から取得
                project_id = getattr(self, '_current_project_id', None)
                if not project_id:
                    return "エラー: project_idが設定されていません"
                
                self.base_service.logger.info(f"[AGENT] Starting function structuring for project: {project_id}")
                
                functions = json.loads(functions_json)
                self.base_service.logger.info(f"[AGENT] Structuring {len(functions)} functions")
                
                # 独立したDBセッションを使用（並列実行対応）
                with get_db_session() as db:
                    # コンテキスト情報を再取得（カテゴリ分類・優先度設定に必要）
                    retriever = ContextualInformationRetrieval(db)
                    context = retriever.gather_context(project_id)
                    
                    # パイプライン処理も同じセッションで
                    pipeline = FunctionStructuringPipeline(db)
                    
                    # カテゴリ分け
                    categorized = pipeline.categorize_functions(functions, context)
                    
                    # 優先度付け
                    prioritized = pipeline.prioritize_functions(
                        categorized, 
                        context.get("project", {})
                    )
                    
                    # 依存関係分析
                    dependencies = pipeline.analyze_dependencies(prioritized, context)
                    
                    self.base_service.logger.info(f"[AGENT] Structuring complete: {len(prioritized)} functions, {len(dependencies)} dependencies")
                    
                    # 後続ツールが使用できるようにJSONデータも含める
                    functions_output = json.dumps(prioritized, ensure_ascii=False, indent=2)
                    dependencies_output = json.dumps(dependencies, ensure_ascii=False, indent=2)
                
                return f"""
機能構造化完了: {len(prioritized)}個の機能を構造化しました

【カテゴリ別集計】
{self._get_category_stats(prioritized)}

【優先度別集計】
{self._get_priority_stats(prioritized)}

【構造化された機能】
{functions_output}

【依存関係】
{dependencies_output}
"""
            except Exception as e:
                self.base_service.logger.error(f"[AGENT] Function structuring failed: {str(e)}")
                return f"機能構造化エラー: {str(e)}"
        
        return StructuredTool.from_function(
            func=structure_functions,
            name="structure_functions",
            description="抽出された機能JSONを受け取り、カテゴリ分け、優先度付け、依存関係分析を実行します。引数はfunctions_jsonのみ。"
        )
    
    def _get_category_stats(self, functions: List[Dict]) -> str:
        """カテゴリ別統計を生成"""
        categories = {}
        for func in functions:
            cat = func.get("category", "unknown")
            categories[cat] = categories.get(cat, 0) + 1
        return "\n".join([f"  {cat}: {count}個" for cat, count in categories.items()])
    
    def _get_priority_stats(self, functions: List[Dict]) -> str:
        """優先度別統計を生成"""
        priorities = {}
        for func in functions:
            pri = func.get("priority", "unknown")
            priorities[pri] = priorities.get(pri, 0) + 1
        return "\n".join([f"  {pri}: {count}個" for pri, count in priorities.items()])
    
    def _create_validation_tool(self):
        """バリデーションツール"""
        
        def validate_structured_functions(functions_json: str) -> str:
            """構造化された機能の品質をバリデーション"""
            try:
                from database import get_db_session
                
                functions = json.loads(functions_json)
                
                # 独立したDBセッションを使用（並列実行対応）
                with get_db_session() as db:
                    pipeline = FunctionStructuringPipeline(db)
                    
                    # 各種バリデーション実行
                    extraction_validation = pipeline._validate_extraction(functions)
                    categorization_validation = pipeline._validate_categorization(functions)
                
                needs_revision = (
                    extraction_validation.get("needs_revision", False) or
                    categorization_validation.get("needs_revision", False)
                )
                
                if needs_revision:
                    return "バリデーション結果: 修正が必要です。再処理を推奨します。"
                else:
                    return "バリデーション結果: 品質基準を満たしています。"
                
            except Exception as e:
                return f"バリデーションエラー: {str(e)}"
        
        return StructuredTool.from_function(
            func=validate_structured_functions,
            name="validate_functions",
            description="構造化された機能の品質をLLM as a Judgeでバリデーションします"
        )
    
    def _create_save_tool(self):
        """構造化機能の増分追加ツール"""
        
        def add_structured_functions(functions_json: str) -> str:
            """構造化された機能を段階的にDBに追加（増分追加）
            
            Args:
                functions_json: 構造化された機能のJSON文字列
            """
            try:
                from database import get_db_session
                
                # project_idはインスタンス変数から取得
                project_id = getattr(self, '_current_project_id', None)
                if not project_id:
                    return "エラー: project_idが設定されていません"
                    
                self.base_service.logger.info(f"[AGENT] Starting incremental add for project: {project_id}")
                
                functions = json.loads(functions_json)
                self.base_service.logger.info(f"[AGENT] Adding {len(functions)} structured functions")
                
                # 独立したDBセッションを使用（並列実行対応）
                with get_db_session() as db:
                    # 既存機能の重複チェック
                    existing_functions = db.query(StructuredFunction).filter(
                        StructuredFunction.project_id == project_id
                    ).all()
                    existing_names = {f.function_name for f in existing_functions}
                    
                    saved_count = 0
                    skipped_count = 0
                    last_func_data = None  # バグ修正: 空リスト対応
                    
                    for func_data in functions:
                        last_func_data = func_data  # 最後のfunc_dataを保持
                        function_name = func_data.get("function_name", "")
                        
                        # 重複チェック
                        if function_name in existing_names:
                            self.base_service.logger.warning(f"[AGENT] Skipping duplicate function: {function_name}")
                            skipped_count += 1
                            continue
                        
                        # 現在のDB内機能数（コード生成用）
                        current_count = db.query(StructuredFunction).filter(
                            StructuredFunction.project_id == project_id
                        ).count()
                        
                        # デフォルト値設定
                        description = func_data.get("description", "")
                        raw_category = func_data.get("category", func_data.get("estimated_category", "logic"))
                        category = self._normalize_category(raw_category)
                        priority = func_data.get("priority", "Should")
                        confidence = func_data.get("extraction_confidence", 0.8)
                        
                        # 関数コード生成
                        function_code = f"F{str(current_count + 1).zfill(3)}"
                        
                        # DB保存
                        structured_function = StructuredFunction(
                            project_id=project_id,
                            function_code=function_code,
                            function_name=function_name,
                            description=description,
                            category=category,
                            priority=priority,
                            extraction_confidence=confidence,
                            order_index=current_count + 1
                        )
                        
                        db.add(structured_function)
                        db.flush()  # IDを即座に取得
                        saved_count += 1
                        existing_names.add(function_name)
                    
                    # 依存関係も保存（もしあれば）
                    dependencies_saved = 0
                    if last_func_data and "dependencies" in last_func_data:
                        # TODO: 依存関係の保存処理
                        pass
                    
                    db.commit()
                    
                    # 現在のDB内機能数を取得
                    total_functions = db.query(StructuredFunction).filter(
                        StructuredFunction.project_id == project_id
                    ).count()
                
                result = f"""
増分追加完了:
- 新規保存: {saved_count}個
- スキップ（重複）: {skipped_count}個
- 現在の合計: {total_functions}個

【重要】次のステップで analyze_coverage を実行して、網羅性を確認してください。
"""
                
                self.base_service.logger.info(f"[AGENT] Incremental add completed: {saved_count} new, {skipped_count} skipped, {total_functions} total")
                return result
                
            except Exception as e:
                self.db.rollback()
                self.base_service.logger.error(f"[AGENT] Incremental add failed: {str(e)}")
                import traceback
                self.base_service.logger.error(traceback.format_exc())
                return f"増分追加エラー: {str(e)}\n\n詳細: {traceback.format_exc()}"
        
        return StructuredTool.from_function(
            func=add_structured_functions,
            name="add_structured_functions",
            description="構造化された機能をデータベースに段階的に追加します。引数はfunctions_jsonのみ。重複は自動スキップ。複数回呼び出して段階的に追加可能。"
        )
    
    def _create_coverage_analysis_tool(self):
        """網羅性分析・完了判定ツール"""
        
        def analyze_coverage(specification: str) -> str:
            """現在の機能網羅性を分析し、完了判定を実行
            
            Args:
                specification: 機能要件書の文字列
            """
            try:
                from database import get_db_session
                
                # project_idはインスタンス変数から取得
                project_id = getattr(self, '_current_project_id', None)
                if not project_id:
                    return "エラー: project_idが設定されていません"
                    
                self.base_service.logger.info(f"[AGENT] Starting coverage analysis for project: {project_id}")
                
                # 独立したDBセッションを使用（並列実行対応）
                with get_db_session() as db:
                    # 現在保存されている機能を取得
                    existing_functions = db.query(StructuredFunction).filter(
                        StructuredFunction.project_id == project_id
                    ).all()
                    
                    # 機能リストを作成
                    current_functions = []
                    for func in existing_functions:
                        current_functions.append({
                            "function_name": func.function_name,
                            "description": func.description,
                            "category": func.category
                        })
                
                # 機能リストにfunction_idも追加（重複削除用）
                current_functions_with_id = []
                for func in existing_functions:
                    current_functions_with_id.append({
                        "function_id": str(func.function_id),
                        "function_name": func.function_name,
                        "description": func.description,
                        "category": func.category
                    })
                
                # 網羅性分析をLLMで実行
                coverage_prompt = f"""
                仕様書と現在抽出済みの機能を比較し、網羅性と重複を分析してください。
                
                仕様書:
                {specification}
                
                現在の機能数: {len(current_functions)}
                現在の機能（function_id付き）: {json.dumps(current_functions_with_id, ensure_ascii=False)}
                
                【重要な分析項目】
                1. **網羅性**: 仕様書の要件をどの程度カバーしているか
                
                2. **重複**: 機能リスト内で同じ内容を表す機能がないか
                   
                   ⚠️ 重複の定義（重要）:
                   
                   ✅ 重複と判定すべき例（削除対象）:
                   - "ユーザー登録" と "新規ユーザー登録" → 完全に同じ機能
                   - "AIによる解説の提供" と "AIによる丁寧な解説提供" → 同一機能
                   - "難易度調整" と "難易度の動的調整" → 同じ機能（表現違い）
                   
                   ❌ 重複ではない例（削除禁止）:
                   - 仕様書の大項目「学習履歴の登録」 vs 機能「テスト結果の登録」
                     → これは大項目の詳細化であり、重複ではない
                   - 仕様書の大項目「ユーザー認証」 vs 機能「ログイン」「ユーザー登録」
                     → これは大項目を具体的な機能に分解したものであり、重複ではない
                   
                   【重複検知のルール】:
                   - **機能リスト内の機能同士のみを比較**してください
                   - 仕様書の大項目は参照情報であり、削除対象ではありません
                   - 機能名の類似度が80%以上 かつ 説明が実質的に同じ場合のみ重複
                
                3. **抜け漏れ**: 仕様書にあるが機能リストにない要件
                
                以下のJSON形式で回答:
                {{
                    "coverage_percentage": 85,
                    "missing_areas": ["認証機能の詳細", "データ同期機能"],
                    "duplicate_functions": [
                        {{
                            "function_id": "uuid-1",
                            "function_name": "ユーザー登録",
                            "duplicate_of": "新規ユーザー登録",
                            "reason": "同じ機能を指している"
                        }}
                    ],
                    "completion_status": "continue",
                    "iteration_count": 1,
                    "reason": "認証機能の詳細が不足、重複が1件あり"
                }}
                
                completion_status: "complete" (完了) または "continue" (継続)
                
                ※重複がある場合は、duplicate_functionsリストに含めてください。
                　重複削除には delete_duplicate_function ツールを使用できます。
                """
                
                result = self.base_service.llm_flash.invoke(coverage_prompt)
                analysis = json.loads(repair_json(result.content))
                
                self.base_service.logger.info(f"[AGENT] Coverage analysis: {analysis.get('coverage_percentage', 0)}% coverage")
                
                return f"網羅性分析完了\n\n分析結果:\n{json.dumps(analysis, ensure_ascii=False)}"
                
            except Exception as e:
                self.base_service.logger.error(f"[AGENT] Coverage analysis failed: {str(e)}")
                return f"網羅性分析エラー: {str(e)}"
        
        return StructuredTool.from_function(
            func=analyze_coverage,
            name="analyze_coverage",
            description="現在の機能の網羅性を分析し、完了判定を実行します"
        )
    
    def _create_delete_duplicate_tool(self):
        """重複機能削除ツール"""
        
        def delete_duplicate_function(function_id: str, reason: str = "") -> str:
            """重複している機能をDBから削除
            
            Args:
                function_id: 削除する機能のUUID
                reason: 削除理由（ログ用）
            
            Returns:
                削除結果のメッセージ
            """
            try:
                from database import get_db_session
                
                self.base_service.logger.info(f"[AGENT] Deleting duplicate function: {function_id}, reason: {reason}")
                
                # 独立したDBセッションを使用（並列実行対応）
                with get_db_session() as db:
                    # 機能を取得
                    function = db.query(StructuredFunction).filter(
                        StructuredFunction.function_id == function_id
                    ).first()
                    
                    if not function:
                        return f"エラー: 機能ID {function_id} が見つかりません"
                    
                    function_name = function.function_name
                    function_code = function.function_code
                    
                    # 依存関係も削除
                    db.query(FunctionDependency).filter(
                        (FunctionDependency.from_function_id == function_id) |
                        (FunctionDependency.to_function_id == function_id)
                    ).delete()
                    
                    # 機能を削除
                    db.delete(function)
                    db.commit()
                    
                    self.base_service.logger.info(f"[AGENT] Deleted function: {function_code} ({function_name})")
                    
                    return f"""重複機能削除完了:
- 機能コード: {function_code}
- 機能名: {function_name}
- 削除理由: {reason}

削除後は get_existing_functions を再実行して最新の機能リストを確認してください。
"""
                    
            except Exception as e:
                self.base_service.logger.error(f"[AGENT] Function deletion failed: {str(e)}")
                return f"削除エラー: {str(e)}"
        
        return StructuredTool.from_function(
            func=delete_duplicate_function,
            name="delete_duplicate_function",
            description="重複している機能をDBから削除します。function_id（UUID）と削除理由を指定してください"
        )
    
    def process_project(self, project_id: str) -> Dict[str, Any]:
        """プロジェクトの機能構造化を実行（ReActループによる品質評価）"""
        
        # project_idをインスタンス変数に保存（ツールから参照できるようにする）
        self._current_project_id = project_id
        
        input_message = f"""
        プロジェクトID {project_id} の機能構造化を実行してください。
        
        【重要な作業方針】
        - 品質を重視し、バリデーションで不適切と判断された場合は再実行する
        - 段階的に機能を抽出し、網羅性を確認しながら進める
        - 既存機能との重複を避ける
        
        【正しい作業フロー（増分的にDBに追加）】
        
        ★初期化フェーズ★
        1. gather_project_context("{project_id}"): 
           コンテキスト情報を収集し、<FUNCTION_DOC>タグ内の機能要件書を抽出
        
        2. get_existing_functions("{project_id}"): 
           既存のDB保存済み機能を取得（初回は0個）
        
        ★反復フェーズ（複数回実行）★
        以下を網羅性80%以上になるまで繰り返す：
        
        3. extract_function_batch(specification, existing_functions_json, focus_area):
           - specification: <FUNCTION_DOC>内の機能要件書
           - existing_functions_json: get_existing_functionsの結果をJSON文字列で
           - focus_area: 初回は"", 2回目以降はanalyze_coverageが提案する領域
           ↓
        4. structure_functions(functions_json, "{project_id}"):
           - 抽出した機能をカテゴリ分け・優先度付け・依存関係分析
           ↓
        5. validate_structured_functions(functions_json):
           - 品質バリデーション
           - 不十分な場合はステップ3へ戻る（focus_areaを変更）
           ↓
        6. add_structured_functions("{project_id}", functions_json):
           ★★★ここで増分的にDBに追加★★★
           - 構造化された機能をDBに追加（重複は自動スキップ）
           - この時点でDBに保存されるため、次の反復で get_existing_functions を再実行すると増えている
           ↓
        7. get_existing_functions("{project_id}"):
           更新された既存機能リストを再取得
           ↓
        8. analyze_coverage("{project_id}", specification):
           網羅性分析を実行（重複チェック含む）
           - completion_status="continue" → ステップ3へ戻る（missing_areasを focus_area に設定）
           - duplicate_functions が検出された場合 → ステップ9で削除
           - completion_status="complete" → 終了
           ↓
        9. delete_duplicate_function(function_id, reason): ★新機能★
           重複している機能を削除
           - function_id: analyze_coverageが検出した重複機能のUUID
           - reason: 重複理由（ログ用）
           - 削除後は get_existing_functions を再実行して確認
        
        【最重要ポイント】
        ✅ add_structured_functions は**複数回呼ぶ**ことを前提としている
        ✅ 各反復で少しずつDBに追加していく（増分追加）
        ✅ get_existing_functions を反復ごとに再実行して、既に保存された機能を確認
        ✅ 重複チェックは add_structured_functions が自動で行う
        
        【注意事項】
        - JSONデータの抽出時は、マークダウンのコードブロックを除去
        - 網羅性80%またはiteration_count≧3で終了
        - エラー時は詳細を確認して対処
        
        それでは作業を開始してください。
        """
        
        try:
            self.base_service.logger.info(f"[AGENT] Starting ReAct agent execution for project: {project_id}")
            self.base_service.logger.debug(f"[AGENT] Input message length: {len(input_message)} chars")
            self.base_service.logger.debug(f"[AGENT] Number of tools: {len(self.tools)}")  # 8 tools including delete_duplicate_function
            
            # ツールスキーマのサイズを確認（デバッグ用）
            for i, tool in enumerate(self.tools):
                tool_schema = str(tool.args_schema.schema()) if hasattr(tool, 'args_schema') and tool.args_schema else str(tool)
                self.base_service.logger.debug(f"[AGENT] Tool {i} ({tool.name}): schema size = {len(tool_schema)} chars")
            
            # LangGraphのcreate_react_agentは最大反復回数の設定が必要
            # デフォルトは25回程度だが、明示的に設定
            config = {
                "recursion_limit": 50  # 最大反復回数を増やす
            }
            
            # 初期メッセージ
            messages = [{"role": "user", "content": input_message}]
            
            # 会話履歴の自動圧縮を有効化
            result = self._execute_agent_with_compression(messages, config)
            
            self.base_service.logger.info(f"[AGENT] ReAct agent execution completed")
            self.base_service.logger.debug(f"[AGENT] Result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
            
            # LangGraph returns messages list, get the last assistant message
            output = ""
            if result.get("messages"):
                self.base_service.logger.info(f"[AGENT] Processing {len(result['messages'])} messages")
                
                # 全メッセージをログに出力（デバッグ用）
                for i, msg in enumerate(result["messages"]):
                    msg_content = msg.content if hasattr(msg, 'content') else str(msg)
                    msg_type = type(msg).__name__
                    msg_role = getattr(msg, 'role', 'unknown') if hasattr(msg, 'role') else 'unknown'
                    
                    # tool_callsの有無を確認
                    has_tool_calls = hasattr(msg, 'tool_calls') and msg.tool_calls
                    tool_calls_info = ""
                    if has_tool_calls:
                        tool_calls_info = f", tool_calls={len(msg.tool_calls)}"
                        for tc in msg.tool_calls:
                            tool_name = tc.get('name', 'unknown') if isinstance(tc, dict) else getattr(tc, 'name', 'unknown')
                            tool_calls_info += f" [{tool_name}]"
                    
                    self.base_service.logger.debug(f"[AGENT] Message {i}: type={msg_type}, role={msg_role}, content_len={len(str(msg_content))}{tool_calls_info}")
                    self.base_service.logger.debug(f"[AGENT] Message {i} content preview: {str(msg_content)[:200]}...")
                    
                    # 最後のメッセージの詳細をダンプ（デバッグ用）
                    if i == len(result["messages"]) - 1:
                        self.base_service.logger.debug(f"[AGENT] LAST MESSAGE DUMP: {msg}")
                        self.base_service.logger.debug(f"[AGENT] LAST MESSAGE __dict__: {msg.__dict__ if hasattr(msg, '__dict__') else 'N/A'}")
                        
                        # invalid_tool_callsの詳細を確認
                        if hasattr(msg, 'invalid_tool_calls') and msg.invalid_tool_calls:
                            self.base_service.logger.error(f"[AGENT] INVALID TOOL CALLS DETECTED: {len(msg.invalid_tool_calls)} calls")
                            for idx, invalid_call in enumerate(msg.invalid_tool_calls):
                                self.base_service.logger.error(f"[AGENT] Invalid call {idx}: {invalid_call}")
                        
                        # response_metadataのfinish_reasonを確認
                        if hasattr(msg, 'response_metadata'):
                            finish_reason = msg.response_metadata.get('finish_reason', 'unknown')
                            if finish_reason == 'MALFORMED_FUNCTION_CALL':
                                self.base_service.logger.error(f"[AGENT] CRITICAL: Gemini returned MALFORMED_FUNCTION_CALL error!")
                                self.base_service.logger.error(f"[AGENT] This means the LLM tried to call a tool but the format was invalid.")
                
                last_message = result["messages"][-1]
                output = last_message.content if hasattr(last_message, 'content') else str(last_message)
                self.base_service.logger.info(f"[AGENT] Final output length: {len(output)} chars")
                self.base_service.logger.debug(f"[AGENT] Final output: {output[:500]}...")
                
                # 異常終了の検知
                is_abnormal_termination = False
                termination_reason = None
                input_tokens = 0
                
                if hasattr(last_message, 'response_metadata'):
                    finish_reason = last_message.response_metadata.get('finish_reason', 'unknown')
                    if finish_reason in ['MALFORMED_FUNCTION_CALL', 'STOP'] and len(output) == 0:
                        is_abnormal_termination = True
                        termination_reason = finish_reason
                
                # トークン数を記録
                if hasattr(last_message, 'usage_metadata') and last_message.usage_metadata:
                    input_tokens = last_message.usage_metadata.get('input_tokens', 0)
                    self.base_service.logger.info(f"[AGENT] Token usage: input={input_tokens}, messages={len(result['messages'])}")
                
                # 部分的な成功を確認（保存された機能の数）
                from database import get_db_session
                with get_db_session() as db:
                    saved_count = db.query(StructuredFunction).filter(
                        StructuredFunction.project_id == project_id
                    ).count()
                
                if is_abnormal_termination:
                    self.base_service.logger.warning(
                        f"[AGENT] Agent terminated abnormally ({termination_reason}) at {len(result['messages'])} messages, {input_tokens} tokens"
                    )
                    self.base_service.logger.warning(
                        f"[AGENT] Partial success: {saved_count} functions were saved before termination"
                    )
                    return {
                        "success": False,
                        "partial_success": True,
                        "saved_functions_count": saved_count,
                        "error": f"Agent terminated abnormally: {termination_reason}. Token limit may have been reached.",
                        "result": output,
                        "project_id": project_id,
                        "debug_info": {
                            "messages_count": len(result['messages']),
                            "input_tokens": input_tokens,
                            "termination_reason": termination_reason
                        }
                    }
                
            else:
                self.base_service.logger.warning(f"[AGENT] No messages in result")
            
            return {
                "success": True,
                "result": output,
                "project_id": project_id
            }
            
        except Exception as e:
            self.base_service.logger.error(f"[AGENT] Agent execution failed: {str(e)}")
            import traceback
            self.base_service.logger.error(f"[AGENT] Traceback: {traceback.format_exc()}")
            return {
                "success": False,
                "error": str(e),
                "project_id": project_id
            }
    
    def _execute_agent_with_compression(self, messages: List[Dict], config: Dict) -> Dict:
        """
        会話履歴の自動圧縮機能付きでエージェントを実行
        
        トークン上限に達する前に会話履歴を圧縮して継続実行する
        MALFORMED_FUNCTION_CALL発生時も自動リカバリーを試みる
        """
        MAX_MESSAGES_BEFORE_COMPRESSION = 20  # 20メッセージごとに圧縮（Rate Limit対策で積極的に）
        MAX_RETRY_ON_ERROR = 2  # エラー時の最大リトライ回数
        
        retry_count = 0
        current_messages = messages
        
        while retry_count <= MAX_RETRY_ON_ERROR:
            try:
                result = self.agent_executor.invoke(
                    {"messages": current_messages},
                    config=config
                )

                if not result.get("messages"):
                    return result

                last_message = result["messages"][-1]
                finish_reason = None

                # 終了理由をチェック
                if hasattr(last_message, 'response_metadata'):
                    finish_reason = last_message.response_metadata.get('finish_reason', 'unknown')

            except ResourceExhausted as e:
                # Google Gemini APIのレート制限エラーを処理
                error_msg = str(e)
                self.base_service.logger.warning(f"[AGENT] Rate limit exceeded: {error_msg}")

                # エラーメッセージから待機時間を抽出（デフォルト60秒）
                wait_time = 60
                if "retry in" in error_msg.lower():
                    # "Please retry in 58.512190946s" のような形式から秒数を抽出
                    import re
                    match = re.search(r'retry in (\d+\.?\d*)s', error_msg, re.IGNORECASE)
                    if match:
                        wait_time = int(float(match.group(1))) + 5  # 余裕を持たせて5秒追加

                if retry_count < MAX_RETRY_ON_ERROR:
                    self.base_service.logger.info(f"[AGENT] Waiting {wait_time} seconds before retry (attempt {retry_count + 1}/{MAX_RETRY_ON_ERROR})...")
                    time.sleep(wait_time)
                    retry_count += 1
                    continue
                else:
                    self.base_service.logger.error(f"[AGENT] Max retries exceeded for rate limit error")
                    raise ValueError(
                        f"Google Gemini APIのレート制限に達しました。しばらく待ってから再度お試しください。"
                        f"無料プランでは1分間に10リクエストまでです。"
                    ) from e

            except Exception as e:
                self.base_service.logger.error(f"[AGENT] Agent execution failed: {str(e)}")
                import traceback
                self.base_service.logger.error(f"[AGENT] Traceback: {traceback.format_exc()}")

                if retry_count < MAX_RETRY_ON_ERROR:
                    retry_count += 1
                    self.base_service.logger.info(f"[AGENT] Retrying... (attempt {retry_count}/{MAX_RETRY_ON_ERROR})")
                    continue
                else:
                    raise

            # MALFORMED_FUNCTION_CALL または STOP で終了した場合
            if finish_reason in ['MALFORMED_FUNCTION_CALL', 'STOP']:
                message_count = len(result["messages"])
                input_tokens = 0

                if hasattr(last_message, 'usage_metadata'):
                    input_tokens = last_message.usage_metadata.get('input_tokens', 0)

                self.base_service.logger.warning(
                    f"[AGENT] Agent stopped with {finish_reason} at {message_count} messages, {input_tokens} tokens (retry {retry_count}/{MAX_RETRY_ON_ERROR})"
                )

                # リトライ可能な場合は圧縮して再実行
                if retry_count < MAX_RETRY_ON_ERROR and message_count > 10:
                    self.base_service.logger.info(
                        f"[AGENT] Attempting recovery: compressing history and retrying..."
                    )

                    # 会話履歴を圧縮（より積極的に）
                    compressed_messages = self._compress_message_history(result["messages"])

                    # さらに最終チェックフェーズに移行するようプロンプトを追加
                    recovery_prompt = """

                    【緊急リカバリー指示】
                    前回の実行でエラーが発生しました。以下の手順で最終チェックを実行してください：

                    1. get_existing_functions でDB保存済み機能を確認
                    2. analyze_coverage で網羅性を評価
                    3. 網羅性が低い場合（<70%）は追加抽出を1回のみ試行
                    4. 結果を報告して終了

                    ※トークン制限を避けるため、シンプルな操作のみ実行してください
                    """

                    compressed_messages.append(HumanMessage(content=recovery_prompt))

                    self.base_service.logger.info(
                        f"[AGENT] Compressed from {message_count} to {len(compressed_messages)} messages, retrying..."
                    )

                    current_messages = compressed_messages
                    retry_count += 1
                    continue  # リトライ
                else:
                    # リトライ回数超過または圧縮不可
                    self.base_service.logger.warning(
                        f"[AGENT] Cannot retry (retry_count={retry_count}, messages={message_count})"
                    )
                    return result

            # 通常の圧縮チェック（メッセージ数が閾値を超えた場合）
            if len(result["messages"]) > MAX_MESSAGES_BEFORE_COMPRESSION:
                self.base_service.logger.info(
                    f"[AGENT] Message count ({len(result['messages'])}) exceeded limit. Compressing for next iteration..."
                )

                compressed_messages = self._compress_message_history(result["messages"])

                self.base_service.logger.info(
                    f"[AGENT] Compressed from {len(result['messages'])} to {len(compressed_messages)} messages"
                )

                # 注: ここでは再実行せず、次のイテレーションで使用される

            return result
        
        # 最終的にリトライ回数超過
        self.base_service.logger.error(f"[AGENT] Max retries ({MAX_RETRY_ON_ERROR}) exceeded")
        return {"messages": current_messages} if isinstance(current_messages, list) else {}
    
    def _compress_message_history(self, messages: List) -> List:
        """
        会話履歴を圧縮
        
        戦略:
        1. 最初の5メッセージを保持（初期コンテキスト）
        2. 最新の10メッセージを保持（現在の作業状況）
        3. 中間のメッセージをサマリー化
        """
        if len(messages) <= 15:
            return messages
        
        # 最初の5メッセージ（初期化フェーズ）
        initial_messages = messages[:5]
        
        # 最新の10メッセージ（現在の作業）
        recent_messages = messages[-10:]
        
        # 中間メッセージの要約
        middle_messages = messages[5:-10]
        
        # 中間の重要な情報を抽出
        summary_data = {
            "extracted_functions": [],
            "saved_functions": 0,
            "errors": [],
            "iterations": 0
        }
        
        for msg in middle_messages:
            if hasattr(msg, 'content') and isinstance(msg.content, str):
                content = msg.content
                
                # 機能抽出の記録
                if "抽出完了" in content:
                    match = re.search(r"(\d+)個の新機能", content)
                    if match:
                        count = int(match.group(1))
                        summary_data["extracted_functions"].append(count)
                
                # 保存の記録
                if "増分追加完了" in content:
                    match = re.search(r"追加: (\d+)", content)
                    if match:
                        summary_data["saved_functions"] += int(match.group(1))
                
                # エラーの記録
                if "エラー" in content:
                    summary_data["errors"].append(content[:100])
                
                # イテレーションカウント
                if "反復フェーズ" in content or "analyze_coverage" in str(msg):
                    summary_data["iterations"] += 1
        
        # サマリーメッセージを作成
        summary_content = f"""
[会話履歴サマリー - {len(middle_messages)}メッセージを圧縮]
- 機能抽出回数: {len(summary_data['extracted_functions'])}回 (合計: {sum(summary_data['extracted_functions'])}個)
- DB保存済み機能: {summary_data['saved_functions']}個
- イテレーション数: {summary_data['iterations']}回
- エラー発生: {len(summary_data['errors'])}件
"""
        
        if summary_data['errors']:
            summary_content += "\n主なエラー:\n" + "\n".join(summary_data['errors'][:3])
        
        # HumanMessageとしてサマリーを挿入
        summary_message = HumanMessage(content=summary_content)
        
        # 圧縮された履歴を構築
        compressed = initial_messages + [summary_message] + recent_messages
        
        return compressed
    
    @staticmethod
    def _normalize_uuid(value: uuid.UUID | str) -> uuid.UUID:
        """UUID文字列をUUIDオブジェクトに正規化"""
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))
    
    @staticmethod
    def _normalize_category(category: str) -> str:
        """カテゴリ名をDB制約に適合する形式に正規化"""
        if not category:
            return "logic"
            
        category_lower = category.lower()
        
        # カテゴリマッピング
        category_mapping = {
            # 認証関連
            "authentication": "auth",
            "auth": "auth",
            "login": "auth",
            "user": "auth",
            "security": "auth",
            
            # データ関連  
            "data": "data",
            "database": "data",
            "storage": "data",
            "model": "data",
            "entity": "data",
            
            # ビジネスロジック
            "logic": "logic",
            "business": "logic",
            "service": "logic",
            "processing": "logic",
            "management": "logic",
            "product_management": "logic",
            "order_management": "logic",
            "inventory_management": "logic",
            
            # UI関連
            "ui": "ui",
            "frontend": "ui",
            "interface": "ui",
            "view": "ui",
            "component": "ui",
            "product_catalog": "ui",
            "shopping_cart": "ui",
            "user_profile": "ui",
            
            # API関連
            "api": "api",
            "endpoint": "api",
            "rest": "api",
            "payment_processing": "api",
            "reporting": "api",
            
            # デプロイメント
            "deployment": "deployment",
            "deploy": "deployment",
            "infrastructure": "deployment",
            "system_administration": "deployment"
        }
        
        return category_mapping.get(category_lower, "logic")