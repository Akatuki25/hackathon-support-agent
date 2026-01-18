"""
Latency measurement tests for question_service API endpoint.

計測指標:
- TTFT (Time To First Token): LLMが最初のトークンを生成するまでの時間
- TTLT (Time To Last Token): LLMが最後のトークンを生成するまでの時間
- TTFB (Time To First Byte): 現在のAPI実装で最初のバイトが返るまでの時間

分析:
- TTFB - TTFT = ストリーミング化で削減可能な遅延
- TTFB ≈ TTLT なら、スキーマ検証のオーバーヘッドは小さい

Usage:
    cd back
    source venv/bin/activate
    pip install httpx pytest-asyncio

    # バックエンドサーバー起動（別ターミナル）
    python app.py

    # テスト実行
    python tests/test_latency_measurement.py <project_id>
"""

import os
import sys
import time
import asyncio
import statistics
from dataclasses import dataclass, field
from typing import Optional, List
import json

# パスを追加してservicesをインポート可能にする
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from dotenv import load_dotenv

# .env読み込み
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.local"))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


@dataclass
class StreamingMetrics:
    """LLMストリーミング計測結果"""
    ttft_ms: float = 0.0  # Time To First Token
    ttlt_ms: float = 0.0  # Time To Last Token
    token_count: int = 0
    tokens_per_second: float = 0.0


@dataclass
class APIMetrics:
    """API計測結果"""
    ttfb_ms: float = 0.0  # Time To First Byte
    total_ms: float = 0.0  # Total response time
    response_size: int = 0


@dataclass
class LatencyComparison:
    """TTFT vs TTFB 比較結果"""
    streaming: StreamingMetrics
    api: APIMetrics

    @property
    def potential_improvement_ms(self) -> float:
        """ストリーミング化で削減可能な遅延 (ms)"""
        return self.api.ttfb_ms - self.streaming.ttft_ms

    @property
    def improvement_ratio(self) -> float:
        """改善率 (%)"""
        if self.api.ttfb_ms == 0:
            return 0
        return (self.potential_improvement_ms / self.api.ttfb_ms) * 100


async def measure_llm_streaming_ttft(prompt: str) -> StreamingMetrics:
    """
    LLMのストリーミングAPIを直接呼び出してTTFTを計測

    これにより「LLM自体は何msで最初のトークンを返せるか」を測定
    """
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain.prompts import ChatPromptTemplate

    # question_serviceと同じプロンプトテンプレートを使用
    template = """あなたはハッカソンのコーチです。
アイデアをより具体化するために質問を作成してください。

以下のアイデアに対して、プロダクトの要件を明確にするための質問を5つ作成してください。
各質問には想定される回答例と重要度(1-5)を付けてください。

アイデア:
{idea_prompt}

出力形式:
```json
{{
  "QA": [
    {{"question": "質問文", "answer": "想定回答例", "importance": 1-5}},
    ...
  ]
}}
```
"""

    prompt_template = ChatPromptTemplate.from_template(template)
    formatted_prompt = prompt_template.format(idea_prompt=prompt)

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.5,
        api_key=os.getenv("GOOGLE_API_KEY"),
        streaming=True,
    )

    metrics = StreamingMetrics()
    start_time = time.perf_counter()
    first_token_time = None
    token_count = 0

    print("  [Streaming] Starting LLM stream...")

    async for chunk in llm.astream(formatted_prompt):
        current_time = time.perf_counter()

        if first_token_time is None:
            first_token_time = current_time
            metrics.ttft_ms = (first_token_time - start_time) * 1000
            print(f"  [Streaming] First token received at {metrics.ttft_ms:.2f} ms")

        token_count += 1

    end_time = time.perf_counter()
    metrics.ttlt_ms = (end_time - start_time) * 1000
    metrics.token_count = token_count

    if metrics.ttlt_ms > metrics.ttft_ms:
        generation_time = (metrics.ttlt_ms - metrics.ttft_ms) / 1000
        metrics.tokens_per_second = token_count / generation_time if generation_time > 0 else 0

    print(f"  [Streaming] Last token at {metrics.ttlt_ms:.2f} ms ({token_count} chunks)")

    return metrics


async def measure_api_ttfb(project_id: str, prompt: str, timeout: float = 120.0) -> APIMetrics:
    """
    現在のAPI実装でTTFBを計測

    with_structured_outputを使っているため、全トークン生成後にレスポンスが返る
    """
    url = f"{API_BASE_URL}/api/question/{project_id}"
    payload = {"Prompt": prompt}

    metrics = APIMetrics()

    print(f"  [API] Calling POST {url}")

    start_time = time.perf_counter()

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            url,
            json=payload,
            headers={"Content-Type": "application/json"}
        ) as response:
            first_byte_time = None
            chunks = []

            async for chunk in response.aiter_bytes():
                current_time = time.perf_counter()

                if first_byte_time is None:
                    first_byte_time = current_time
                    metrics.ttfb_ms = (first_byte_time - start_time) * 1000
                    print(f"  [API] First byte received at {metrics.ttfb_ms:.2f} ms")

                chunks.append(chunk)

            end_time = time.perf_counter()
            metrics.total_ms = (end_time - start_time) * 1000
            metrics.response_size = sum(len(c) for c in chunks)

    print(f"  [API] Response complete at {metrics.total_ms:.2f} ms ({metrics.response_size} bytes)")

    return metrics


async def compare_ttft_vs_ttfb(project_id: str, prompt: str) -> LatencyComparison:
    """
    TTFT（ストリーミング）とTTFB（現在のAPI）を比較
    """
    print("\n" + "="*70)
    print("TTFT vs TTFB Comparison")
    print("="*70)
    print(f"\nPrompt: {prompt[:100]}...")
    print()

    # 1. ストリーミングでTTFTを計測
    print("[1/2] Measuring TTFT (LLM Streaming)...")
    streaming_metrics = await measure_llm_streaming_ttft(prompt)

    print()

    # API rate limit対策
    await asyncio.sleep(2)

    # 2. 現在のAPIでTTFBを計測
    print("[2/2] Measuring TTFB (Current API)...")
    try:
        api_metrics = await measure_api_ttfb(project_id, prompt)
    except httpx.ConnectError:
        print("  [API] ERROR: Backend server not running")
        api_metrics = APIMetrics()
    except Exception as e:
        print(f"  [API] ERROR: {e}")
        api_metrics = APIMetrics()

    comparison = LatencyComparison(streaming=streaming_metrics, api=api_metrics)

    return comparison


def print_comparison_report(comparison: LatencyComparison):
    """比較レポートを表示"""
    print("\n" + "="*70)
    print("LATENCY COMPARISON REPORT")
    print("="*70)

    print("\n[LLM Streaming Metrics]")
    print(f"  TTFT (Time To First Token): {comparison.streaming.ttft_ms:,.2f} ms")
    print(f"  TTLT (Time To Last Token):  {comparison.streaming.ttlt_ms:,.2f} ms")
    print(f"  Token count:                {comparison.streaming.token_count}")
    print(f"  Tokens/second:              {comparison.streaming.tokens_per_second:.1f}")

    print("\n[Current API Metrics]")
    print(f"  TTFB (Time To First Byte):  {comparison.api.ttfb_ms:,.2f} ms")
    print(f"  Total response time:        {comparison.api.total_ms:,.2f} ms")
    print(f"  Response size:              {comparison.api.response_size:,} bytes")

    print("\n" + "-"*70)
    print("ANALYSIS")
    print("-"*70)

    if comparison.api.ttfb_ms > 0:
        print(f"\n  Potential improvement with streaming:")
        print(f"    Current TTFB:     {comparison.api.ttfb_ms:,.2f} ms")
        print(f"    Optimal TTFT:     {comparison.streaming.ttft_ms:,.2f} ms")
        print(f"    ─────────────────────────────────")
        print(f"    Reducible delay:  {comparison.potential_improvement_ms:,.2f} ms")
        print(f"    Improvement:      {comparison.improvement_ratio:.1f}%")

        # ボトルネック判定
        print("\n  Bottleneck Analysis:")

        # TTFTが全体の何%か
        ttft_ratio = (comparison.streaming.ttft_ms / comparison.api.ttfb_ms) * 100 if comparison.api.ttfb_ms > 0 else 0
        processing_delay = comparison.api.ttfb_ms - comparison.streaming.ttlt_ms

        print(f"    TTFT / TTFB ratio: {ttft_ratio:.1f}%")

        if ttft_ratio < 20:
            print(f"\n    >>> TTFT is fast ({ttft_ratio:.1f}% of TTFB)")
            print(f"    >>> Most delay comes from waiting for full generation")
            print(f"    >>> Streaming would provide {comparison.improvement_ratio:.1f}% faster first response")
        elif ttft_ratio < 50:
            print(f"\n    >>> Moderate TTFT ({ttft_ratio:.1f}% of TTFB)")
            print(f"    >>> Streaming would still help significantly")
        else:
            print(f"\n    >>> TTFT is slow ({ttft_ratio:.1f}% of TTFB)")
            print(f"    >>> Consider LLM optimization or caching")

        # スキーマ検証オーバーヘッド推定
        schema_overhead = comparison.api.ttfb_ms - comparison.streaming.ttlt_ms
        if schema_overhead > 0:
            print(f"\n    Schema validation overhead: ~{schema_overhead:.2f} ms")

    else:
        print("\n  [!] API measurement failed - server may not be running")

    print("\n" + "="*70)


async def run_benchmark(project_id: str, prompt: str, iterations: int = 3) -> dict:
    """
    複数回計測してベンチマーク結果を返す
    """
    results: List[LatencyComparison] = []

    print(f"\n{'#'*70}")
    print(f"# LATENCY BENCHMARK ({iterations} iterations)")
    print(f"{'#'*70}")

    for i in range(iterations):
        print(f"\n>>> Iteration {i+1}/{iterations}")

        comparison = await compare_ttft_vs_ttfb(project_id, prompt)
        results.append(comparison)

        if i < iterations - 1:
            print("\n  Waiting 3 seconds before next iteration...")
            await asyncio.sleep(3)

    # 統計計算
    ttft_values = [r.streaming.ttft_ms for r in results]
    ttlt_values = [r.streaming.ttlt_ms for r in results]
    ttfb_values = [r.api.ttfb_ms for r in results if r.api.ttfb_ms > 0]
    improvement_values = [r.potential_improvement_ms for r in results if r.api.ttfb_ms > 0]

    summary = {
        "iterations": len(results),
        "ttft_ms": {
            "mean": statistics.mean(ttft_values),
            "median": statistics.median(ttft_values),
            "min": min(ttft_values),
            "max": max(ttft_values),
        },
        "ttlt_ms": {
            "mean": statistics.mean(ttlt_values),
            "median": statistics.median(ttlt_values),
            "min": min(ttlt_values),
            "max": max(ttlt_values),
        },
        "ttfb_ms": {
            "mean": statistics.mean(ttfb_values) if ttfb_values else 0,
            "median": statistics.median(ttfb_values) if ttfb_values else 0,
            "min": min(ttfb_values) if ttfb_values else 0,
            "max": max(ttfb_values) if ttfb_values else 0,
        },
        "potential_improvement_ms": {
            "mean": statistics.mean(improvement_values) if improvement_values else 0,
            "median": statistics.median(improvement_values) if improvement_values else 0,
        }
    }

    # サマリー表示
    print(f"\n{'#'*70}")
    print("# BENCHMARK SUMMARY")
    print(f"{'#'*70}")

    print(f"\n  TTFT (LLM First Token):")
    print(f"    Mean:   {summary['ttft_ms']['mean']:,.2f} ms")
    print(f"    Median: {summary['ttft_ms']['median']:,.2f} ms")
    print(f"    Range:  {summary['ttft_ms']['min']:,.2f} - {summary['ttft_ms']['max']:,.2f} ms")

    print(f"\n  TTLT (LLM Last Token):")
    print(f"    Mean:   {summary['ttlt_ms']['mean']:,.2f} ms")
    print(f"    Median: {summary['ttlt_ms']['median']:,.2f} ms")

    if ttfb_values:
        print(f"\n  TTFB (Current API):")
        print(f"    Mean:   {summary['ttfb_ms']['mean']:,.2f} ms")
        print(f"    Median: {summary['ttfb_ms']['median']:,.2f} ms")

        print(f"\n  Potential Improvement with Streaming:")
        print(f"    Mean reduction:   {summary['potential_improvement_ms']['mean']:,.2f} ms")
        print(f"    Median reduction: {summary['potential_improvement_ms']['median']:,.2f} ms")

        ratio = summary['potential_improvement_ms']['mean'] / summary['ttfb_ms']['mean'] * 100 if summary['ttfb_ms']['mean'] > 0 else 0
        print(f"    Improvement:      {ratio:.1f}%")

    print(f"\n{'#'*70}\n")

    return summary


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    # コマンドライン引数
    if len(sys.argv) < 2:
        print("Usage: python test_latency_measurement.py <project_id> [iterations]")
        print("\nExample:")
        print("  python test_latency_measurement.py 123e4567-e89b-12d3-a456-426614174000")
        print("  python test_latency_measurement.py 123e4567-e89b-12d3-a456-426614174000 5")
        sys.exit(1)

    project_id = sys.argv[1]
    iterations = int(sys.argv[2]) if len(sys.argv) > 2 else 3

    prompt = """
プロジェクトタイトル: ハッカソンサポートアプリ
プロジェクトアイディア: チームでハッカソンに参加する際に、
アイデア出しからタスク管理、進捗確認までをサポートするWebアプリケーション。
AI機能を使って要件定義や技術選定のアドバイスを受けられる。
期間: 2024-01-01 〜 2024-01-02 12:00
"""

    print(f"Project ID: {project_id}")
    print(f"Iterations: {iterations}")
    print(f"API URL: {API_BASE_URL}")
    print("\nMake sure:")
    print("  1. Backend server is running (python app.py)")
    print("  2. GOOGLE_API_KEY is set in .env")
    print("  3. Project ID exists in database")

    # 実行
    summary = asyncio.run(run_benchmark(project_id, prompt, iterations))

    # 結果をJSONファイルに保存
    output_file = "latency_benchmark_result.json"
    with open(output_file, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Results saved to {output_file}")
