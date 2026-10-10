import { NextRequest, NextResponse } from "next/server";
import { getTelegramBot } from "@/lib/telegram-bot";
import { db } from "@/lib/db";
import { CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    // Read the update, refresh shared state (using the DB's short cache), and
    // initialize grammY concurrently. A forced cloud read on every webhook
    // update added a database round trip before even inspecting /start.
    const bodyPromise = req.json();
    const bot = getTelegramBot();
    if (!bot) {
      console.error("Bot token not configured");
      return NextResponse.json({ ok: false, error: "Bot token not configured" }, { status: 400 });
    }

    const syncPromise = db.syncFromCloud();
    const initPromise = bot.isInited() ? Promise.resolve() : bot.init();
    const [body] = await Promise.all([bodyPromise, syncPromise, initPromise]);

    try {
      const settings = db.getSettings();
      // The bot may have been constructed while the cloud refresh was still
      // running; prefer the freshly synchronized bot identity when available.
      if (settings.botInfo) bot.botInfo = settings.botInfo;
      if (!settings.botInfo && bot.botInfo) {
        db.updateSettings({ botInfo: bot.botInfo }).catch(() => {});
      }
    } catch (e) {}

    // GrammY is initialized and shared state is current before processing.
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

  if (action === "setWebhook" || action === "set" || searchParams.get("set") === "1") {
    try {
      const dropPending = searchParams.get("drop") !== "0"; // Kuyruktaki eski mesajları temizle ki bot 0 gecikmeyle anında açılsın
      const targetUrl = searchParams.get("url") || webhookUrl;
      const res = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(targetUrl)}&drop_pending_updates=${dropPending}&max_connections=100`
      );
      const data = await res.json();
      return NextResponse.json({
        ok: data.ok ?? true,
        message: data.ok ? "Telegram Webhook Başarıyla Kuruldu!" : "Telegram Webhook Hatası",
        webhookUrl: targetUrl,
        telegramResponse: data,
      });
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
