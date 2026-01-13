"""
TTFT原因診断テスト

検証項目:
A) thinking_budget=0 でTTFTが下がるか → 犯人はthinking
B) プロンプト1/4でTTFTが下がるか → 犯人はprefill（入力トークン）

Usage:
    cd back
    source venv/bin/activate
    python tests/test_ttft_diagnosis.py
"""

import os
import sys
import time
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.local"))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))


# ============================================================================
# テスト用プロンプト
# ============================================================================

FULL_PROMPT = """
あなたはプログラミング初心者のプロダクト開発を補助するハッカソン支援エージェントです。
...アイデア、期間、人数:
プロジェクトタイトル: ハッカソンサポートアプリ
プロジェクトアイディア: チームでハッカソンに参加する際に、
アイデア出しからタスク管理、進捗確認までをサポートするWebアプリケーション。
AI機能を使って要件定義や技術選定のアドバイスを受けられる。
期間: 2024-01-01 〜 2024-01-02 12:00

これに基づいたアイデアを仕様に落とし込む上での質問をしてください。アイデアが仕様に触れるような具体的な内容であればよりコンセプトをまとめるように、抽象的であればコンセプトから考えさせるような質問にしてください。
ただし、フレームワークの記述は不要です。どの言語が書けるかなどユーザーのコーディング力には触れても問題ないです。
また、回答例をanswerの欄に含めてください。questionの欄には解答例を書かないでください。

回答の質としては次のようにしてください。
- アイディアを掘り下げる質問
- 課題を明確化する。とくに誰の課題であるかを問う
- 課題に裏付けはあるか？
- 課題にイメージはつくか？
- 仮説はあるのか？
- 具体的に提供するユーザーはだれか？
- 説明と具体的イメージはどんなモノか？

JSON形式で出力してください:
{"QA": [{"question": "質問文", "answer": "想定回答例", "importance": 1-5}, ...]}
"""

# プロンプト1/4版（検証B用）
SHORT_PROMPT = """
ハッカソン支援アプリのアイデアについて質問を3つ作成してください。
JSON形式: {"QA": [{"question": "質問", "answer": "回答例", "importance": 1-5}]}
"""


# ============================================================================
# 検証A: thinking_budget=0 (google-genai直接使用)
# ============================================================================

async def test_with_thinking_budget(thinking_budget: int, prompt: str, label: str) -> float:
    """
    google-genaiを直接使用してthinking_budgetを制御
    """
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    print(f"\n[{label}] thinking_budget={thinking_budget}")
    print(f"  Prompt length: {len(prompt)} chars")

    start_time = time.perf_counter()
    first_token_time = None
    token_count = 0

    # ストリーミングでTTFTを計測
    config = types.GenerateContentConfig(
        temperature=0.5,
        thinking_config=types.ThinkingConfig(thinking_budget=thinking_budget)
    )

    # 正しいストリーミング呼び出し
    response_stream = await client.aio.models.generate_content_stream(
        model="gemini-2.5-flash",
        contents=prompt,
        config=config,
    )

    async for chunk in response_stream:
        current_time = time.perf_counter()
        if first_token_time is None and chunk.text:
            first_token_time = current_time
            ttft = (first_token_time - start_time) * 1000
            print(f"  TTFT: {ttft:.2f} ms (first token received)")
        token_count += 1

    end_time = time.perf_counter()
    ttlt = (end_time - start_time) * 1000

    if first_token_time is None:
        first_token_time = end_time
        ttft = ttlt

    print(f"  TTLT: {ttlt:.2f} ms ({token_count} chunks)")

    return ttft


# ============================================================================
# 検証B: LangChain経由（現状の実装）
# ============================================================================

async def test_langchain_streaming(prompt: str, label: str) -> float:
    """
    現状のLangChain実装でのTTFT計測（比較用）
    """
    from langchain_google_genai import ChatGoogleGenerativeAI

    print(f"\n[{label}] LangChain ChatGoogleGenerativeAI")
    print(f"  Prompt length: {len(prompt)} chars")

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.5,
        api_key=os.getenv("GOOGLE_API_KEY"),
        streaming=True,
    )

    start_time = time.perf_counter()
    first_token_time = None
    token_count = 0

    async for chunk in llm.astream(prompt):
        current_time = time.perf_counter()
        if first_token_time is None:
            first_token_time = current_time
            ttft = (first_token_time - start_time) * 1000
            print(f"  TTFT: {ttft:.2f} ms (first token received)")
        token_count += 1

    end_time = time.perf_counter()
    ttlt = (end_time - start_time) * 1000

    if first_token_time is None:
        first_token_time = end_time
        ttft = ttlt

    print(f"  TTLT: {ttlt:.2f} ms ({token_count} chunks)")

    return ttft


# ============================================================================
# Main
# ============================================================================

async def run_diagnosis():
    """
    TTFT原因診断を実行
    """
    results = {}

    print("="*70)
    print("TTFT DIAGNOSIS TEST")
    print("="*70)
    print("\nThis test will identify the root cause of high TTFT (~11s)")
    print("Expected outcomes:")
    print("  - If thinking_budget=0 drastically reduces TTFT → thinking is the cause")
    print("  - If shorter prompt drastically reduces TTFT → prefill is the cause")
    print("  - If neither helps → queue/network/region issue")

    # ========================================
    # 検証1: LangChain現状（ベースライン）
    # ========================================
    print("\n" + "="*70)
    print("TEST 1: Baseline (LangChain, full prompt)")
    print("="*70)

    results["baseline_langchain"] = await test_langchain_streaming(FULL_PROMPT, "Baseline")
    await asyncio.sleep(2)

    # ========================================
    # 検証2: thinking_budget=0（google-genai直接）
    # ========================================
    print("\n" + "="*70)
    print("TEST 2: thinking_budget=0 (google-genai direct)")
    print("="*70)

    results["thinking_off"] = await test_with_thinking_budget(0, FULL_PROMPT, "ThinkingOFF")
    await asyncio.sleep(2)

    # ========================================
    # 検証3: thinking_budget=1024（比較用）
    # ========================================
    print("\n" + "="*70)
    print("TEST 3: thinking_budget=1024 (google-genai direct)")
    print("="*70)

    results["thinking_low"] = await test_with_thinking_budget(1024, FULL_PROMPT, "ThinkingLow")
    await asyncio.sleep(2)

    # ========================================
    # 検証4: 短いプロンプト（prefill検証）
    # ========================================
    print("\n" + "="*70)
    print("TEST 4: Short prompt (1/4 length)")
    print("="*70)

    results["short_prompt"] = await test_with_thinking_budget(0, SHORT_PROMPT, "ShortPrompt")

    # ========================================
    # 結果サマリー
    # ========================================
    print("\n" + "="*70)
    print("DIAGNOSIS RESULTS")
    print("="*70)

    print(f"\n  Baseline (LangChain):     {results['baseline_langchain']:,.0f} ms")
    print(f"  thinking_budget=0:        {results['thinking_off']:,.0f} ms")
    print(f"  thinking_budget=1024:     {results['thinking_low']:,.0f} ms")
    print(f"  Short prompt + budget=0:  {results['short_prompt']:,.0f} ms")

    # 分析
    print("\n" + "-"*70)
    print("ANALYSIS")
    print("-"*70)

    baseline = results["baseline_langchain"]
    thinking_off = results["thinking_off"]
    short_prompt = results["short_prompt"]

    thinking_improvement = baseline - thinking_off
    prompt_improvement = thinking_off - short_prompt

    print(f"\n  Improvement from thinking_budget=0: {thinking_improvement:,.0f} ms ({thinking_improvement/baseline*100:.1f}%)")
    print(f"  Improvement from shorter prompt:    {prompt_improvement:,.0f} ms ({prompt_improvement/thinking_off*100:.1f}% of remaining)")

    if thinking_improvement > 3000:  # 3秒以上改善
        print("\n  >>> VERDICT: thinking is the PRIMARY cause of high TTFT")
        print("  >>> RECOMMENDATION: Set thinking_budget=0 or upgrade langchain-google-genai to v4.1+")
    elif prompt_improvement > 2000:  # 2秒以上改善
        print("\n  >>> VERDICT: prefill (input tokens) is contributing significantly")
        print("  >>> RECOMMENDATION: Optimize prompt length or use caching")
    else:
        print("\n  >>> VERDICT: Issue may be queue/network/region related")
        print("  >>> RECOMMENDATION: Check API quotas and consider regional endpoints")

    print("\n" + "="*70)

    return results


if __name__ == "__main__":
    results = asyncio.run(run_diagnosis())
