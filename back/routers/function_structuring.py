from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from services.function import FunctionStructuringWorkflow
from typing import Union, List, Dict, Any, Optional
import uuid

router = APIRouter()


class ProjectIdRequest(BaseModel):
    project_id: Union[str, uuid.UUID]


def _calculate_implementation_order(functions_data: List[Dict], dependencies_data: List[Dict]) -> List[Dict]:
    """依存関係に基づいて実装順序を計算"""
    try:
        # 依存関係グラフを構築
        graph = {}
        in_degree = {}
        
        for func in functions_data:
            func_id = func["function_id"]
            graph[func_id] = []
            in_degree[func_id] = 0
        
        for dep in dependencies_data:
            from_id = dep["from_function_id"]
            to_id = dep["to_function_id"]
            if from_id in graph and to_id in graph:
                graph[from_id].append(to_id)
                in_degree[to_id] += 1
        
        # トポロジカルソート
        queue = [func_id for func_id, degree in in_degree.items() if degree == 0]
        result = []
        
        while queue:
            current = queue.pop(0)
            result.append(current)
            
            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        # 結果を機能情報と組み合わせ
        ordered_functions = []
        for i, func_id in enumerate(result):
            func_info = next(f for f in functions_data if f["function_id"] == func_id)
            ordered_functions.append({
                "order": i + 1,
                "function_id": func_id,
                "function_name": func_info["function_name"],
                "function_code": func_info["function_code"],
                "category": func_info["category"],
                "priority": func_info["priority"],
                "can_start": in_degree[func_id] == 0,
                "blocked_by": [dep["from_function_name"] for dep in dependencies_data 
                             if dep["to_function_id"] == func_id and dep["dependency_type"] == "blocks"]
            })
        
        return ordered_functions
        
    except Exception as e:
        # エラー時は優先度順でソート
        return sorted(functions_data, key=lambda x: {"Must": 0, "Should": 1, "Could": 2, "Wont": 3}[x["priority"]])


def _get_category_summary(functions_data: List[Dict]) -> Dict[str, Any]:
    """カテゴリ別サマリーを生成"""
    category_counts = {}
    category_priorities = {}
    
    for func in functions_data:
        category = func["category"]
        priority = func["priority"]
        
        if category not in category_counts:
            category_counts[category] = 0
            category_priorities[category] = {"Must": 0, "Should": 0, "Could": 0, "Wont": 0}
        
        category_counts[category] += 1
        category_priorities[category][priority] += 1
    
    return {
        "counts": category_counts,
        "priorities": category_priorities,
        "total_categories": len(category_counts)
    }


def _get_priority_summary(functions_data: List[Dict]) -> Dict[str, Any]:
    """優先度別サマリーを生成"""
    priority_counts = {"Must": 0, "Should": 0, "Could": 0, "Wont": 0}
    priority_categories = {"Must": {}, "Should": {}, "Could": {}, "Wont": {}}
    
    for func in functions_data:
        priority = func["priority"]
        category = func["category"]
        
        priority_counts[priority] += 1
        
        if category not in priority_categories[priority]:
            priority_categories[priority][category] = 0
        priority_categories[priority][category] += 1
    
    return {
        "counts": priority_counts,
        "by_category": priority_categories,
        "mvp_ready": priority_counts["Must"] > 0
    }


def _analyze_dependency_patterns(dependencies_data: List[Dict]) -> Dict[str, Any]:
    """依存関係パターンを分析"""
    dependency_types = {}
    circular_dependencies = []
    critical_paths = []
    
    for dep in dependencies_data:
        dep_type = dep["dependency_type"]
        if dep_type not in dependency_types:
            dependency_types[dep_type] = 0
        dependency_types[dep_type] += 1
    
    # 循環依存の検出（簡易版）
    # 実際の実装ではより複雑なアルゴリズムが必要
    
    return {
        "types": dependency_types,
        "circular_dependencies": circular_dependencies,
        "critical_paths": critical_paths,
        "complexity_score": len(dependencies_data) / max(1, len(set(dep["from_function_id"] for dep in dependencies_data)))
    }


@router.post("/structure")
def structure_functions(request: ProjectIdRequest, db: Session = Depends(get_db)):
    """
    プロジェクトの機能要件を構造化してカテゴリ分け、優先度付け、依存関係分析を実行する
    StateGraph Workflow による確定的な機能構造化処理

    新アーキテクチャ (Phase 1-7):
    - Plan-and-Execute パターン
    - 並列実行による高速化 (レイテンシ -50%)
    - Context Caching によるトークン削減 (-85%)
    - Map-Reduce による大規模document対応

    Args:
        project_id: プロジェクトID

    Returns:
        構造化された機能と依存関係の情報
    """
    try:
        # project_idを文字列に変換
        if isinstance(request.project_id, str):
            project_id_str = request.project_id
        else:
            project_id_str = str(request.project_id)

        # FunctionStructuringWorkflow を初期化して実行
        workflow = FunctionStructuringWorkflow(db)
        result = workflow.process_project(project_id_str)

        if result["success"]:
            return {
                "message": "Function structuring completed successfully",
                "project_id": project_id_str,
                "data": result["data"],
                "metadata": result.get("metadata", {}),
                "success": True
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Function structuring failed: {result.get('error', 'Unknown error')}"
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/functions/{project_id}")
def get_structured_functions(project_id: str, db: Session = Depends(get_db)):
    """
    プロジェクトの構造化された機能一覧を取得する
    
    Args:
        project_id: プロジェクトID
        
    Returns:
        構造化された機能と依存関係のリスト
    """
    from models.project_base import StructuredFunction, FunctionDependency
    
    try:
        # project_idをUUIDに変換
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        
        # 構造化された機能を取得
        structured_functions = db.query(StructuredFunction).filter(
            StructuredFunction.project_id == project_uuid
        ).order_by(StructuredFunction.order_index).all()
        
        # 依存関係を取得
        dependencies = db.query(FunctionDependency).join(
            StructuredFunction, FunctionDependency.from_function_id == StructuredFunction.function_id
        ).filter(
            StructuredFunction.project_id == project_uuid
        ).all()
        
        # レスポンス形式に変換（詳細情報を含む）
        functions_data = []
        for func in structured_functions:
            # 依存関係情報を取得
            incoming_deps = [dep for dep in dependencies if str(dep.to_function_id) == str(func.function_id)]
            outgoing_deps = [dep for dep in dependencies if str(dep.from_function_id) == str(func.function_id)]
            
            functions_data.append({
                "function_id": str(func.function_id),
                "function_code": func.function_code,
                "function_name": func.function_name,
                "description": func.description,
                "category": func.category,
                "priority": func.priority,
                "extraction_confidence": func.extraction_confidence,
                "order_index": func.order_index,
                "created_at": func.created_at.isoformat(),
                # 詳細情報を追加
                "dependencies": {
                    "incoming": [
                        {
                            "function_id": str(dep.from_function_id),
                            "dependency_type": dep.dependency_type,
                            "reason": getattr(dep, 'reason', '')
                        } for dep in incoming_deps
                    ],
                    "outgoing": [
                        {
                            "function_id": str(dep.to_function_id),
                            "dependency_type": dep.dependency_type,
                            "reason": getattr(dep, 'reason', '')
                        } for dep in outgoing_deps
                    ]
                },
                "implementation_order": func.order_index,
                "estimated_effort": getattr(func, 'estimated_effort', 'medium'),
                "validation_status": getattr(func, 'validation_status', 'validated')
            })
        
        dependencies_data = []
        for dep in dependencies:
            # 依存関係の詳細情報を取得
            from_func = next((f for f in structured_functions if f.function_id == dep.from_function_id), None)
            to_func = next((f for f in structured_functions if f.function_id == dep.to_function_id), None)
            
            dependencies_data.append({
                "dependency_id": str(dep.id),
                "from_function_id": str(dep.from_function_id),
                "to_function_id": str(dep.to_function_id),
                "dependency_type": dep.dependency_type,
                "reason": getattr(dep, 'reason', ''),
                # 機能名も含める
                "from_function_name": from_func.function_name if from_func else "Unknown",
                "to_function_name": to_func.function_name if to_func else "Unknown",
                "strength": getattr(dep, 'strength', 'medium')
            })
        
        # 実装順序の推奨を計算
        implementation_order = _calculate_implementation_order(functions_data, dependencies_data)
        
        return {
            "project_id": str(project_uuid),
            "functions": functions_data,
            "dependencies": dependencies_data,
            "total_functions": len(functions_data),
            "total_dependencies": len(dependencies_data),
            "implementation_order": implementation_order,
            "summary": {
                "categories": _get_category_summary(functions_data),
                "priorities": _get_priority_summary(functions_data),
                "dependency_analysis": _analyze_dependency_patterns(dependencies_data)
            }
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project_id format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


class CreateFunctionRequest(BaseModel):
    project_id: str
    function_name: str
    description: str
    category: str = "logic"  # auth, logic, ui, data, external
    priority: str = "Should"  # Must, Should, Could, Wont


@router.post("/functions")
def create_structured_function(request: CreateFunctionRequest, db: Session = Depends(get_db)):
    """
    新しい構造化機能を手動で作成する
    
    Args:
        request: 機能作成リクエスト
            - project_id: プロジェクトID
            - function_name: 機能名
            - description: 機能説明
            - category: カテゴリ (auth, logic, ui, data, external)
            - priority: 優先度 (Must, Should, Could, Wont)
    
    Returns:
        作成された機能の情報
    """
    from models.project_base import StructuredFunction
    
    try:
        project_uuid = uuid.UUID(request.project_id)
        
        # 現在の最大order_indexを取得
        max_order = db.query(StructuredFunction).filter(
            StructuredFunction.project_id == project_uuid
        ).count()
        
        # 既存の最大function_code番号を取得して次の番号を生成
        existing_functions = db.query(StructuredFunction).filter(
            StructuredFunction.project_id == project_uuid
        ).all()
        
        # function_codeから番号を抽出して最大値を取得
        max_code_number = 0
        for func in existing_functions:
            if func.function_code and func.function_code.startswith('F'):
                try:
                    code_number = int(func.function_code[1:])
                    max_code_number = max(max_code_number, code_number)
                except ValueError:
                    continue
        
        function_code = f"F{str(max_code_number + 1).zfill(3)}"
        
        new_function = StructuredFunction(
            project_id=project_uuid,
            function_code=function_code,
            function_name=request.function_name,
            description=request.description,
            category=request.category,
            priority=request.priority,
            extraction_confidence=1.0,  # 手動作成なので100%
            order_index=max_order + 1
        )
        
        db.add(new_function)
        db.commit()
        db.refresh(new_function)
        
        # フロントエンド表示用に必要な属性を追加
        # （DBには存在しないが、GETエンドポイントと同じ形式で返す）
        return {
            "message": "Function created successfully",
            "function": {
                "function_id": str(new_function.function_id),
                "function_code": new_function.function_code,
                "function_name": new_function.function_name,
                "description": new_function.description,
                "category": new_function.category,
                "priority": new_function.priority,
                "extraction_confidence": new_function.extraction_confidence,
                "order_index": new_function.order_index,
                "created_at": new_function.created_at.isoformat() if new_function.created_at else None,
                # GETエンドポイントと同じ形式で属性を追加
                "dependencies": {
                    "incoming": [],
                    "outgoing": []
                },
                "implementation_order": new_function.order_index,
                "estimated_effort": "medium",  # 手動作成のデフォルト
                "validation_status": "validated"  # 手動作成は検証済みとみなす
            }
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project_id format")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


class UpdateFunctionRequest(BaseModel):
    function_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None


@router.patch("/functions/{function_id}")
def update_structured_function(function_id: str, request: UpdateFunctionRequest, db: Session = Depends(get_db)):
    """
    構造化機能を更新する
    
    Args:
        function_id: 機能ID
        request: 更新リクエスト（部分更新対応）
            - function_name: 機能名（オプション）
            - description: 機能説明（オプション）
            - category: カテゴリ（オプション）
            - priority: 優先度（オプション）
    
    Returns:
        更新された機能の情報
    """
    from models.project_base import StructuredFunction
    
    try:
        function_uuid = uuid.UUID(function_id)
        
        function = db.query(StructuredFunction).filter(
            StructuredFunction.function_id == function_uuid
        ).first()
        
        if not function:
            raise HTTPException(status_code=404, detail="Function not found")
        
        # 更新可能なフィールドのみ更新（Noneでないもの）
        update_data = request.dict(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                setattr(function, field, value)
        
        db.commit()
        db.refresh(function)
        
        # 依存関係を取得
        from models.project_base import FunctionDependency
        incoming_deps = db.query(FunctionDependency).filter(
            FunctionDependency.to_function_id == function_uuid
        ).all()
        outgoing_deps = db.query(FunctionDependency).filter(
            FunctionDependency.from_function_id == function_uuid
        ).all()
        
        return {
            "message": "Function updated successfully",
            "function": {
                "function_id": str(function.function_id),
                "function_code": function.function_code,
                "function_name": function.function_name,
                "description": function.description,
                "category": function.category,
                "priority": function.priority,
                "extraction_confidence": function.extraction_confidence,
                "order_index": function.order_index,
                "created_at": function.created_at.isoformat() if function.created_at else None,
                # GETエンドポイントと同じ形式で属性を追加
                "dependencies": {
                    "incoming": [
                        {
                            "function_id": str(dep.from_function_id),
                            "dependency_type": dep.dependency_type,
                            "reason": getattr(dep, 'reason', '')
                        } for dep in incoming_deps
                    ],
                    "outgoing": [
                        {
                            "function_id": str(dep.to_function_id),
                            "dependency_type": dep.dependency_type,
                            "reason": getattr(dep, 'reason', '')
                        } for dep in outgoing_deps
                    ]
                },
                "implementation_order": function.order_index,
                "estimated_effort": getattr(function, 'estimated_effort', 'medium'),
                "validation_status": getattr(function, 'validation_status', 'validated')
            }
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid function_id format")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/functions/{function_id}")
def delete_single_function(function_id: str, db: Session = Depends(get_db)):
    """
    単一の構造化機能を削除する
    
    Args:
        function_id: 削除する機能のID
    
    Returns:
        削除結果メッセージ
    """
    from models.project_base import StructuredFunction, FunctionDependency
    
    try:
        function_uuid = uuid.UUID(function_id)
        
        function = db.query(StructuredFunction).filter(
            StructuredFunction.function_id == function_uuid
        ).first()
        
        if not function:
            raise HTTPException(status_code=404, detail="Function not found")
        
        # 依存関係も削除（カスケード削除されるが念のため）
        db.query(FunctionDependency).filter(
            (FunctionDependency.from_function_id == function_uuid) |
            (FunctionDependency.to_function_id == function_uuid)
        ).delete()
        
        deleted_name = function.function_name
        deleted_code = function.function_code
        
        db.delete(function)
        db.commit()
        
        return {
            "message": "Function deleted successfully",
            "deleted_function": {
                "function_id": str(function_uuid),
                "function_code": deleted_code,
                "function_name": deleted_name
            }
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid function_id format")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/project/{project_id}/functions")
def delete_all_project_functions(project_id: str, db: Session = Depends(get_db)):
    """
    プロジェクトの構造化された機能をすべて削除する
    
    Args:
        project_id: プロジェクトID
        
    Returns:
        削除完了メッセージ
    """
    from models.project_base import StructuredFunction
    
    try:
        # project_idをUUIDに変換
        project_uuid = uuid.UUID(project_id) if isinstance(project_id, str) else project_id
        
        # 構造化された機能を削除（カスケードで依存関係も削除される）
        deleted_count = db.query(StructuredFunction).filter(
            StructuredFunction.project_id == project_uuid
        ).delete()
        
        db.commit()
        
        return {
            "message": f"Successfully deleted {deleted_count} structured functions",
            "project_id": str(project_uuid),
            "deleted_count": deleted_count
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project_id format")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")