"""
Unit tests for function_structuring_schemas.py

Tests Pydantic models for:
1. DB schema compatibility (Enum values)
2. Field validation (min_length, max_length, ge, le)
3. Model conversion helpers
"""

import pytest
import uuid
from pydantic import ValidationError

from services.function.function_structuring_schemas import (
    FunctionCategory,
    FunctionPriority,
    DependencyType,
    ExtractedFunction,
    FunctionExtractionOutput,
    StructuredFunction,
    StructuredFunctionOutput,
    FunctionDependency,
    DependencyAnalysisOutput,
    ValidationResult,
    StructuredFunctionDB,
    FunctionDependencyDB,
    extracted_to_structured,
    structured_to_db,
)


class TestEnums:
    """Test Enum definitions and DB compatibility"""

    def test_function_category_values(self):
        """Test FunctionCategory enum matches DB CHECK constraint"""
        expected_values = {"auth", "data", "logic", "ui", "api", "deployment"}
        actual_values = {cat.value for cat in FunctionCategory}
        assert actual_values == expected_values, "FunctionCategory enum must match DB constraint"

    def test_function_priority_values(self):
        """Test FunctionPriority enum matches DB CHECK constraint (no apostrophe)"""
        expected_values = {"Must", "Should", "Could", "Wont"}  # NO apostrophe in Wont
        actual_values = {pri.value for pri in FunctionPriority}
        assert actual_values == expected_values, "FunctionPriority enum must match DB constraint"

        # Ensure "Won't" is NOT in the enum
        priority_values = [pri.value for pri in FunctionPriority]
        assert "Won't" not in priority_values, "Priority must be 'Wont' not 'Won't'"

    def test_dependency_type_values(self):
        """Test DependencyType enum values"""
        expected_values = {"requires", "blocks", "relates"}
        actual_values = {dep.value for dep in DependencyType}
        assert actual_values == expected_values, "DependencyType enum values are correct"

    def test_dependency_type_default(self):
        """Test default dependency type is 'requires'"""
        assert DependencyType.REQUIRES.value == "requires", "Default dependency type should be 'requires'"


class TestExtractedFunction:
    """Test ExtractedFunction model and validation"""

    def test_valid_extracted_function(self):
        """Test creating a valid ExtractedFunction"""
        func = ExtractedFunction(
            function_name="ユーザー登録API",
            description="メールアドレスとパスワードでユーザーを新規登録する。入力バリデーション（メール形式、パスワード8文字以上）、既存ユーザー重複チェック、bcryptによるパスワードハッシュ化を実装。POST /api/users エンドポイントとして公開。",
            estimated_category=FunctionCategory.AUTH,
            text_position=1
        )
        assert func.function_name == "ユーザー登録API"
        assert func.estimated_category == "auth"  # Enum converted to string
        assert func.text_position == 1

    def test_description_min_length_validation(self):
        """Test description must be at least 50 characters"""
        with pytest.raises(ValidationError) as exc_info:
            ExtractedFunction(
                function_name="Test",
                description="短すぎる説明",  # Less than 50 chars
                estimated_category=FunctionCategory.AUTH,
                text_position=1
            )
        errors = exc_info.value.errors()
        assert any(err["loc"] == ("description",) for err in errors), "Description validation failed"

    def test_function_name_max_length_validation(self):
        """Test function_name must not exceed 200 characters"""
        with pytest.raises(ValidationError) as exc_info:
            ExtractedFunction(
                function_name="あ" * 201,  # Exceeds 200 chars
                description="これは50文字以上の説明です。" * 5,
                estimated_category=FunctionCategory.AUTH,
                text_position=1
            )
        errors = exc_info.value.errors()
        assert any(err["loc"] == ("function_name",) for err in errors), "Function name length validation failed"

    def test_text_position_validation(self):
        """Test text_position must be >= 0"""
        with pytest.raises(ValidationError) as exc_info:
            ExtractedFunction(
                function_name="Test",
                description="これは50文字以上の説明です。" * 3,
                estimated_category=FunctionCategory.AUTH,
                text_position=-1  # Invalid: negative
            )
        errors = exc_info.value.errors()
        assert any(err["loc"] == ("text_position",) for err in errors), "Text position validation failed"


class TestStructuredFunction:
    """Test StructuredFunction model"""

    def test_valid_structured_function(self):
        """Test creating a valid StructuredFunction"""
        func = StructuredFunction(
            function_name="ユーザー登録API",
            description="メールアドレスとパスワードでユーザーを新規登録する。",
            category=FunctionCategory.AUTH,
            priority=FunctionPriority.MUST,
            dependencies=["データベース初期化"],
            confidence=0.9,
            text_position=1
        )
        assert func.category == "auth"
        assert func.priority == "Must"
        assert len(func.dependencies) == 1

    def test_confidence_range_validation(self):
        """Test confidence must be between 0.0 and 1.0"""
        # Valid confidence
        func = StructuredFunction(
            function_name="Test",
            description="Description",
            category=FunctionCategory.AUTH,
            priority=FunctionPriority.MUST,
            confidence=0.8
        )
        assert func.confidence == 0.8

        # Invalid: confidence > 1.0
        with pytest.raises(ValidationError):
            StructuredFunction(
                function_name="Test",
                description="Description",
                category=FunctionCategory.AUTH,
                priority=FunctionPriority.MUST,
                confidence=1.5
            )

    def test_default_dependencies(self):
        """Test dependencies defaults to empty list"""
        func = StructuredFunction(
            function_name="Test",
            description="Description",
            category=FunctionCategory.AUTH,
            priority=FunctionPriority.MUST
        )
        assert func.dependencies == []

    def test_priority_wont_no_apostrophe(self):
        """Test that priority 'Wont' (no apostrophe) is accepted"""
        func = StructuredFunction(
            function_name="Test",
            description="Description",
            category=FunctionCategory.AUTH,
            priority=FunctionPriority.WONT
        )
        assert func.priority == "Wont", "Priority should be 'Wont' not 'Won't'"


class TestFunctionDependency:
    """Test FunctionDependency model"""

    def test_valid_dependency(self):
        """Test creating a valid FunctionDependency"""
        dep = FunctionDependency(
            from_function="ログイン機能",
            to_function="ユーザー登録API",
            dependency_type=DependencyType.REQUIRES,
            reason="ユーザーアカウントが必要"
        )
        assert dep.from_function == "ログイン機能"
        assert dep.dependency_type == "requires"
        assert dep.reason == "ユーザーアカウントが必要"

    def test_default_dependency_type(self):
        """Test default dependency_type is REQUIRES"""
        dep = FunctionDependency(
            from_function="A",
            to_function="B"
        )
        assert dep.dependency_type == DependencyType.REQUIRES


class TestValidationResult:
    """Test ValidationResult model"""

    def test_valid_validation_result(self):
        """Test creating a valid ValidationResult"""
        result = ValidationResult(
            is_valid=True,
            score=0.85,
            issues=["Issue 1", "Issue 2"],
            suggestions=["Suggestion 1"],
            needs_revision=False
        )
        assert result.is_valid is True
        assert result.score == 0.85
        assert len(result.issues) == 2
        assert result.needs_revision is False

    def test_score_range_validation(self):
        """Test score must be between 0.0 and 1.0"""
        # Valid score
        result = ValidationResult(
            is_valid=True,
            score=0.5,
            issues=[],
            suggestions=[]
        )
        assert result.score == 0.5

        # Invalid: score < 0.0
        with pytest.raises(ValidationError):
            ValidationResult(
                is_valid=True,
                score=-0.1,
                issues=[],
                suggestions=[]
            )

        # Invalid: score > 1.0
        with pytest.raises(ValidationError):
            ValidationResult(
                is_valid=True,
                score=1.1,
                issues=[],
                suggestions=[]
            )

    def test_default_values(self):
        """Test default values for optional fields"""
        result = ValidationResult(
            is_valid=True,
            score=0.8
        )
        assert result.issues == []
        assert result.suggestions == []
        assert result.needs_revision is False


class TestHelperFunctions:
    """Test helper functions for model conversion"""

    def test_extracted_to_structured(self):
        """Test converting ExtractedFunction to StructuredFunction"""
        extracted = ExtractedFunction(
            function_name="ユーザー登録API",
            description="メールアドレスとパスワードでユーザーを新規登録する。入力バリデーション（メール形式、パスワード8文字以上）、既存ユーザー重複チェック、bcryptによるパスワードハッシュ化を実装。POST /api/users エンドポイントとして公開。",
            estimated_category=FunctionCategory.AUTH,
            text_position=1
        )

        structured = extracted_to_structured(
            extracted=extracted,
            category=FunctionCategory.AUTH,
            priority=FunctionPriority.MUST,
            dependencies=["データベース初期化"]
        )

        assert structured.function_name == extracted.function_name
        assert structured.description == extracted.description
        assert structured.category == FunctionCategory.AUTH
        assert structured.priority == FunctionPriority.MUST
        assert structured.dependencies == ["データベース初期化"]
        assert structured.text_position == 1

    def test_structured_to_db(self):
        """Test converting StructuredFunction to StructuredFunctionDB"""
        structured = StructuredFunction(
            function_name="ユーザー登録API",
            description="メールアドレスとパスワードでユーザーを新規登録する。",
            category=FunctionCategory.AUTH,
            priority=FunctionPriority.MUST,
            confidence=0.9,
            text_position=1
        )

        source_doc_id = uuid.uuid4()
        db_model = structured_to_db(
            structured=structured,
            function_code="F001",
            order_index=0,
            source_doc_id=source_doc_id
        )

        assert db_model.function_code == "F001"
        assert db_model.function_name == structured.function_name
        assert db_model.description == structured.description
        assert db_model.category == "auth"  # String value
        assert db_model.priority == "Must"  # String value
        assert db_model.extraction_confidence == 0.9
        assert db_model.order_index == 0
        assert db_model.source_doc_id == source_doc_id


class TestWrapperModels:
    """Test wrapper models for LLM structured output"""

    def test_function_extraction_output(self):
        """Test FunctionExtractionOutput wrapper"""
        func1 = ExtractedFunction(
            function_name="機能1",
            description="メールアドレスとパスワードでユーザーを新規登録する。入力バリデーション（メール形式、パスワード8文字以上）、既存ユーザー重複チェック、bcryptによるパスワードハッシュ化を実装。POST /api/users エンドポイントとして公開。",
            estimated_category=FunctionCategory.AUTH,
            text_position=1
        )
        func2 = ExtractedFunction(
            function_name="機能2",
            description="ユーザーのプロジェクト一覧を表示する画面コンポーネント。カード形式のUI、フィルタリング機能、ページネーション、新規作成ボタンを含む。レスポンシブデザイン対応。",
            estimated_category=FunctionCategory.UI,
            text_position=2
        )

        output = FunctionExtractionOutput(functions=[func1, func2])
        assert len(output.functions) == 2
        assert output.functions[0].function_name == "機能1"

    def test_structured_function_output(self):
        """Test StructuredFunctionOutput wrapper"""
        func1 = StructuredFunction(
            function_name="機能1",
            description="説明",
            category=FunctionCategory.AUTH,
            priority=FunctionPriority.MUST
        )
        func2 = StructuredFunction(
            function_name="機能2",
            description="説明",
            category=FunctionCategory.UI,
            priority=FunctionPriority.SHOULD
        )

        output = StructuredFunctionOutput(functions=[func1, func2])
        assert len(output.functions) == 2

    def test_dependency_analysis_output(self):
        """Test DependencyAnalysisOutput wrapper"""
        dep1 = FunctionDependency(
            from_function="A",
            to_function="B",
            dependency_type=DependencyType.REQUIRES
        )
        dep2 = FunctionDependency(
            from_function="B",
            to_function="C",
            dependency_type=DependencyType.BLOCKS
        )

        output = DependencyAnalysisOutput(dependencies=[dep1, dep2])
        assert len(output.dependencies) == 2
        assert output.dependencies[0].dependency_type == "requires"


class TestEnumValueConversion:
    """Test Enum to string conversion with use_enum_values=True"""

    def test_extracted_function_enum_conversion(self):
        """Test ExtractedFunction converts Enum to string"""
        func = ExtractedFunction(
            function_name="Test",
            description="メールアドレスとパスワードでユーザーを新規登録する。入力バリデーション（メール形式、パスワード8文字以上）を実装。",
            estimated_category=FunctionCategory.AUTH,
            text_position=1
        )
        func_dict = func.model_dump()
        assert func_dict["estimated_category"] == "auth", "Enum should be converted to string"
        assert isinstance(func_dict["estimated_category"], str), "Should be string not Enum"

    def test_structured_function_enum_conversion(self):
        """Test StructuredFunction converts Enum to string"""
        func = StructuredFunction(
            function_name="Test",
            description="説明",
            category=FunctionCategory.AUTH,
            priority=FunctionPriority.MUST
        )
        func_dict = func.model_dump()
        assert func_dict["category"] == "auth"
        assert func_dict["priority"] == "Must"
        assert isinstance(func_dict["category"], str)
        assert isinstance(func_dict["priority"], str)

    def test_dependency_enum_conversion(self):
        """Test FunctionDependency converts Enum to string"""
        dep = FunctionDependency(
            from_function="A",
            to_function="B",
            dependency_type=DependencyType.REQUIRES
        )
        dep_dict = dep.model_dump()
        assert dep_dict["dependency_type"] == "requires"
        assert isinstance(dep_dict["dependency_type"], str)
