import { NextRequest, NextResponse } from "next/server";
import { getTelegramBot } from "@/lib/telegram-bot";
import { db } from "@/lib/db";
import { CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const bot = getTelegramBot();
    if (!bot) {
      console.error("Bot token not configured");
      return NextResponse.json({ ok: false, error: "Bot token not configured" }, { status: 400 });
    }

    // GrammY requires init() before handleUpdate()
    if (!bot.isInited()) {
      await bot.init();
    }

    const body = await req.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    // Return 200 to Telegram so it doesn't get stuck retrying broken updates
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}

export async function GET(req: NextRequest) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get("action");

  if (!token) {
    return NextResponse.json({ ok: false, error: "Telegram Bot Token not configured" });
  }

  const webhookUrl = `${CONFIG.APP_URL}/api/bot/webhook`;

  if (action === "setWebhook") {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      const data = await res.json();
      return NextResponse.json({ ok: true, webhookUrl, telegramResponse: data });
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
  }

  // Varsayılan bilgi
  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const info = await infoRes.json();
    return NextResponse.json({
      status: "online",
      message: "AzFur Telegram Bot Webhook endpoint ready",
      appUrl: CONFIG.APP_URL,
      expectedWebhookUrl: webhookUrl,
      telegramWebhookInfo: info,
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "online",
      message: "AzFur Telegram Bot Webhook endpoint ready",
      error: err.message,
    });
  }
}
