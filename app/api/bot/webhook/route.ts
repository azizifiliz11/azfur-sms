import { NextRequest, NextResponse } from "next/server";
import { getTelegramBot, runAfterResponse } from "@/lib/telegram-bot";
import { db } from "@/lib/db";
import { CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 15;

const WELCOME_COMMAND_RE = /^\/(?:start|menu)(?:@\w+)?$/i;

function getWelcomeSenderId(body: any): number | null {
  const msg = body?.message;
  const firstWord = typeof msg?.text === "string" ? msg.text.trim().split(/\s/, 1)[0] : "";
  if (!WELCOME_COMMAND_RE.test(firstWord)) return null;
  const id = Number(msg?.from?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function POST(req: NextRequest) {
  try {
    const bot = getTelegramBot();
    if (!bot) {
      console.error("Bot token not configured");
      return NextResponse.json({ ok: false, error: "Bot token not configured" }, { status: 400 });
    }

    // grammY başlatma (getMe) gövde okunurken paralel başlar; botInfo önbellekteyse anında biter
    const initPromise = bot.isInited() ? Promise.resolve() : bot.init();
    const body = await req.json();

    // HIZLI YOL: /start ve /menu, sıcak önbellekte tüm veritabanı senkronizasyonunu beklemez.
    // Yalnızca gönderenin tek satırı SQL'den tazelenir (bakiye/ban doğru kalır);
    // tam senkronizasyon cevap Telegram'a döndükten sonra arka planda yapılır.
    const welcomeSenderId = getWelcomeSenderId(body);
    let usedFastPath = false;
    if (welcomeSenderId && db.isCacheWarm()) {
      try {
        await Promise.all([db.refreshUserFromSql(welcomeSenderId), initPromise]);
        usedFastPath = true;
      } catch {
        usedFastPath = false; // Tek satır sorgusu başarısızsa güvenli yola (tam senkronizasyon) düş
      }
    }

    if (!usedFastPath) {
      await Promise.all([db.syncFromCloud(), initPromise]);
    }

    try {
      const settings = db.getSettings();
      if (settings.botInfo) bot.botInfo = settings.botInfo;
      if (!settings.botInfo && bot.botInfo) {
        runAfterResponse(() => db.updateSettings({ botInfo: bot.botInfo }));
      }
    } catch (e) {}

    // Process update directly via grammY outbound API
    await bot.handleUpdate(body);

    // Cevap döndükten sonra: önbelleği tazele + otomatik yedekleme kontrolü (kullanıcıyı bekletmez)
    runAfterResponse(async () => {
      if (usedFastPath) await db.syncFromCloud();
      await db.triggerAutoBackupIfNeeded();
    });

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

  if (action === "resetMenuButton" || action === "reset_menu") {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu_button: { type: "default" } }),
      });
      const data = await res.json();
      return NextResponse.json({
        ok: data.ok ?? true,
        message: "Bot menü butonu BotFather varsayılanına sıfırlandı.",
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
