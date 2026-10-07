import { NextRequest, NextResponse } from "next/server";
import { getTelegramBot } from "@/lib/telegram-bot";
import { db } from "@/lib/db";

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

export async function GET() {
  return NextResponse.json({
    status: "online",
    message: "AzFur Telegram Bot Webhook endpoint ready",
  });
}
