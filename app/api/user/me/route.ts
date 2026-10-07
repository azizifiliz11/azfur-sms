import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONFIG } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, username, firstName, lastName } = body;

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Telegram ID gerekli" }, { status: 400 });
    }

    const user = db.getOrCreateUser(telegramId, {
      username,
      firstName,
      lastName,
    });

    const activeOrders = db.getActiveOrders(telegramId);
    const settings = db.getSettings();

    return NextResponse.json({
      success: true,
      user,
      activeOrdersCount: activeOrders.length,
      currency: settings.currencySymbol,
      isAdmin: user.role === "admin" || String(telegramId) === String(CONFIG.ADMIN_TELEGRAM_ID),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Telegram ID gerekli" }, { status: 400 });
    }

    const user = db.getUser(telegramId);
    if (!user) {
      return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
