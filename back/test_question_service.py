"""
QuestionService Pydantic構造化出力のテスト

実行方法:
cd /Users/akatuki/HackathonAgent/hackathon-support-agent/back
source venv/bin/activate
python test_question_service.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from services.project import QuestionService, QuestionItem, QuestionOutput
from database import get_db
import uuid


def test_pydantic_models():
    """Pydanticモデルの基本動作テスト"""
    print("=" * 60)
    print("Test 1: Pydanticモデルの動作確認")
    print("=" * 60)

    # QuestionItemの作成
    item = QuestionItem(
        question="このプロジェクトの対象ユーザーは誰ですか？",
        answer="大学生や若い社会人",
        importance=5
    )
    print(f"✅ QuestionItem作成成功:")
    print(f"   question: {item.question}")
    print(f"   answer: {item.answer}")
    print(f"   importance: {item.importance}")

    # QuestionOutputの作成
    output = QuestionOutput(QA=[item])
    print(f"✅ QuestionOutput作成成功: {len(output.QA)}個の質問")

    # バリデーションテスト（importance範囲外）
    try:
        invalid_item = QuestionItem(
            question="test",
            answer="test",
            importance=10  # 範囲外（1-5のみ許可）
        )
        print("❌ バリデーションが機能していません")
    except Exception as e:
        print(f"✅ バリデーション成功: importance=10はエラー")

    print()


def test_service_mock():
    """サービスのモック呼び出しテスト（LLM呼び出しなし）"""
    print("=" * 60)
    print("Test 2: サービスの基本構造テスト")
    print("=" * 60)

    db = next(get_db())
    service = QuestionService(db=db)

    print(f"✅ QuestionService初期化成功")
    print(f"   llm_with_thinking: {type(service.llm_with_thinking)}")
    print(f"   logger: {service.logger.name}")

    # プロンプトが読み込めるか確認
    try:
        prompt = service.get_prompt("question_service", "generate_question")
        print(f"✅ プロンプト読み込み成功")
        print(f"   長さ: {len(prompt)} 文字")
        # {format_instructions}が含まれていないことを確認
        if "{format_instructions}" in prompt:
            print("❌ 警告: プロンプトに{format_instructions}が残っています")
        else:
            print("✅ {format_instructions}は削除されています")
    except Exception as e:
        print(f"❌ プロンプト読み込み失敗: {e}")

    db.close()
    print()


def test_full_generation(run_llm_test=False):
    """実際のLLM呼び出しテスト（オプション）"""
    print("=" * 60)
    print("Test 3: 実際のLLM呼び出しテスト")
    print("=" * 60)

    if not run_llm_test:
        print("スキップしました（LLMテストを実行する場合は run_llm_test=True を指定）")
        return

    db = next(get_db())
    service = QuestionService(db=db)

    test_idea = "大学生向けの勉強記録アプリ。毎日の学習時間を記録して、友達と共有できる。期間は2週間、メンバーは3人。"
    test_project_id = uuid.uuid4()

    print(f"入力アイデア: {test_idea}")
    print(f"プロジェクトID: {test_project_id}")
    print("LLM呼び出し中...")

    try:
        result = service.generate_question(test_idea, project_id=test_project_id)

        print(f"✅ 質問生成成功: {len(result['QA'])}個の質問")
        print()

        for i, qa in enumerate(result['QA'], 1):
            print(f"--- 質問 {i} ---")
            print(f"質問: {qa['question']}")
            print(f"回答例: {qa['answer'][:50]}...")
            print(f"重要度: {qa['importance']}")
            print(f"qa_id: {qa['qa_id']}")
            print(f"follows_qa_id: {qa['follows_qa_id']}")
            print()

        # 構造チェック
        assert all('qa_id' in qa for qa in result['QA']), "qa_idが設定されていません"
        assert result['QA'][0]['follows_qa_id'] is None, "最初のfollows_qa_idがNoneではありません"
        if len(result['QA']) > 1:
            assert result['QA'][1]['follows_qa_id'] == result['QA'][0]['qa_id'], "follows_qa_idが正しくチェーンされていません"

        print("✅ 全てのバリデーションに合格しました")

    except Exception as e:
        print(f"❌ エラー発生: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    print("\n" + "=" * 60)
    print("QuestionService Pydantic構造化出力テスト")
    print("=" * 60)
    print()

    # コマンドライン引数で --llm を指定した場合のみLLMテストを実行
    run_llm = "--llm" in sys.argv

    test_pydantic_models()
    test_service_mock()
    test_full_generation(run_llm_test=run_llm)

    print("\n" + "=" * 60)
    print("テスト完了")
    if not run_llm:
        print("(LLMテストをスキップしました。実行する場合: python test_question_service.py --llm)")
    print("=" * 60)
