import { NextRequest, NextResponse } from "next/server";
import { getTelegramBot } from "@/lib/telegram-bot";
import { webhookCallback } from "grammy";

export async function POST(req: NextRequest) {
  try {
    const bot = getTelegramBot();
    if (!bot) {
      return NextResponse.json({ ok: false, error: "Bot token not configured" }, { status: 400 });
    }

    const handler = webhookCallback(bot, "std/http");
    return await handler(req);
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    message: "AzFur Telegram Bot Webhook endpoint ready",
  });
}
