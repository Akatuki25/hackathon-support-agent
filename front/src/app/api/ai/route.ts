import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Node.js ランタイムで動かす
export const runtime = "nodejs";

// TLS検証を無効化（開発環境用）
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

// --- CORS 共通ヘッダ ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-blocknote-ai-key, x-goog-api-key",
};

// --- OPTIONS: preflight ---
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// --- メイン（GET/POST等すべて） ---
export async function POST(req: NextRequest) {
  // CORS 付与
  const withCORS = (res: NextResponse) => {
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
  };

  try {
    // 認証なし（一時的に無効化）
    console.log("AI proxy - no authentication required");

    // クエリパラメータ取得
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const provider = searchParams.get("provider");

    if (!url || !provider) {
      return withCORS(
        NextResponse.json({ error: "url and provider required" }, { status: 400 })
      );
    }

    // Google Gemini APIキーを設定
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("x-goog-api-key", process.env.GOOGLE_API_KEY || "");

    // リクエストボディを取得
    const body = await req.text();

    // Gemini APIに直接プロキシ
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: body,
    });

    // レスポンスをそのまま返す
    return new NextResponse(response.body, {
      status: response.status,
      headers: withCORS(new NextResponse()).headers,
    });

  } catch (error) {
    console.error("Error in AI proxy:", error);
    return withCORS(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
