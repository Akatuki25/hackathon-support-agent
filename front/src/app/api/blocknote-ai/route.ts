import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type CoreMessage } from "ai";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// TLS検証を無効化（開発環境用）
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

export async function POST(req: NextRequest) {
  try {
    // BlockNoteから送られてくるリクエスト形式
    // { messages: CoreMessage[], toolDefinitions?: unknown }
    const { messages } = await req.json();

    console.log("🤖 BlockNote AI request received");
    console.log("  - Messages count:", messages?.length || 0);

    // Google Gemini APIキーを確認
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("❌ GOOGLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "GOOGLE_API_KEY is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Gemini APIの制約: system messagesは会話の最初にのみ配置可能
    // BlockNoteから送られるメッセージを並び替えて、systemメッセージを先頭に移動
    const systemMessages = messages.filter((m: CoreMessage) => m.role === "system");
    const otherMessages = messages.filter((m: CoreMessage) => m.role !== "system");
    const reorderedMessages = [...systemMessages, ...otherMessages];

    console.log(
      `  - System messages: ${systemMessages.length}, Other messages: ${otherMessages.length}`
    );

    // Vercel AI SDKを使ってストリーミングレスポンスを生成
    // Note: BlockNoteのAI機能はテキスト生成のみなので、toolsは不要
    // toolDefinitionsはBlockNote独自の形式であり、Vercel AI SDKのtoolsパラメータと互換性がない
    const result = streamText({
      model: google("gemini-2.5-flash"),
      messages: convertToModelMessages(reorderedMessages),
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    console.log("✅ Streaming response started");

    // BlockNoteが期待するUI Message Stream形式で返す
    // x-vercel-ai-ui-message-stream: v1 ヘッダーが自動的に設定される
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("❌ Error in BlockNote AI endpoint:", error);
    if (error instanceof Error) {
      console.error("  Error message:", error.message);
      console.error("  Error stack:", error.stack);
    }
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
