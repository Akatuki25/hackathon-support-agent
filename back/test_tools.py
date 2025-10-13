"""
Phase 3 ツールの動作確認スクリプト
"""

from services.tools.document_fetch_tool import DocumentFetchTool

print("=== DocumentFetchTool Test ===\n")

tool = DocumentFetchTool()

try:
    result = tool.fetch('https://fastapi.tiangolo.com/', extract_main_content=True)
    print(f"✅ Document Fetch Successful")
    print(f"   Title: {result['title']}")
    print(f"   Domain: {result['domain']}")
    print(f"   Content Length: {result['content_length']} characters")
    print(f"   Is Truncated: {result['is_truncated']}")
    print(f"\n   Content Preview (first 300 chars):")
    print(f"   {result['content'][:300]}...")
except Exception as e:
    print(f"❌ Document Fetch Failed: {e}")

print("\n=== WebSearchTool Test (requires TAVILY_API_KEY) ===\n")

try:
    from services.tools.web_search_tool import WebSearchTool
    import os

    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        print("⚠️  TAVILY_API_KEY not set. Skipping WebSearch test.")
        print("   To test: export TAVILY_API_KEY='tvly-...' and re-run")
    else:
        search_tool = WebSearchTool(api_key=api_key)
        results = search_tool.search("FastAPI authentication best practices", max_results=3)

        print(f"✅ WebSearch Successful ({len(results)} results)")
        for i, result in enumerate(results, 1):
            print(f"\n   Result {i}:")
            print(f"   - Title: {result['title']}")
            print(f"   - URL: {result['url']}")
            print(f"   - Score: {result['score']:.2f}")
            print(f"   - Content: {result['content'][:100]}...")
except Exception as e:
    print(f"❌ WebSearch Failed: {e}")

print("\n=== Test Complete ===")
