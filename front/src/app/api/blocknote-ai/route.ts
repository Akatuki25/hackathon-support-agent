import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText } from "ai";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// TLS検証を無効化（開発環境用）
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

export async function POST(req: NextRequest) {
  try {
    const { messages, toolDefinitions } = await req.json();

    // Google Gemini APIキーを確認
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_API_KEY is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Vercel AI SDKを使ってストリーミングレスポンスを生成
    const result = streamText({
      model: google("gemini-2.0-flash-exp"),
      messages: convertToModelMessages(messages),
      // toolDefinitionsが提供された場合はツールを設定
      ...(toolDefinitions && {
        tools: toolDefinitions,
        toolChoice: "auto",
      }),
    });

    // BlockNoteが期待するUIMessageStream形式で返す
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in BlockNote AI endpoint:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
