import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONFIG } from "@/lib/config";
import { verifyTelegramInitData } from "@/lib/telegram-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/user/preferences
 * Profil > Ayarlar: bildirim tercihlerini kaydeder. Kullanıcı Telegram initData imzasıyla belirlenir.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tgUser = verifyTelegramInitData(String(body.initData || ""), CONFIG.TELEGRAM_BOT_TOKEN);
    if (!tgUser) {
      return NextResponse.json(
        { success: false, error: "Oturum doğrulanamadı. Lütfen Mini App'i Telegram üzerinden yeniden açın." },
        { status: 401 }
      );
    }

    const partial: { notifySms?: boolean; notifyAnnouncements?: boolean } = {};
    if (typeof body.notifySms === "boolean") partial.notifySms = body.notifySms;
    if (typeof body.notifyAnnouncements === "boolean") partial.notifyAnnouncements = body.notifyAnnouncements;
    if (Object.keys(partial).length === 0) {
      return NextResponse.json({ success: false, error: "Güncellenecek tercih yok" }, { status: 400 });
    }

    const preferences = await db.setUserPreferences(tgUser.id, partial);
    return NextResponse.json({ success: true, preferences }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("Preferences error:", err);
    return NextResponse.json({ success: false, error: err.message || "Tercihler kaydedilemedi" }, { status: 500 });
  }
}
