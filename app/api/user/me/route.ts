import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONFIG } from "@/lib/config";
import { fetchTelegramUserInfo } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const body = await req.json();
    const { telegramId, username, firstName, lastName } = body;

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Telegram ID gerekli" }, { status: 400 });
    }

    const cleanUsername = username ? String(username).replace(/^@/, "").trim() : "";
    const cleanFirstName = firstName ? String(firstName).trim() : "";
    const cleanLastName = lastName ? String(lastName).trim() : undefined;

    const user = await db.getOrCreateUser(telegramId, {
      username: cleanUsername,
      firstName: cleanFirstName,
      lastName: cleanLastName,
    });

    const activeOrders = db.getActiveOrders(telegramId);
    const settings = db.getSettings();

    return NextResponse.json(
      {
        success: true,
        user,
        activeOrdersCount: activeOrders.length,
        currency: settings.currencySymbol,
        isAdmin: user.role === "admin" || String(telegramId) === String(CONFIG.ADMIN_TELEGRAM_ID),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Telegram ID gerekli" }, { status: 400 });
    }

    let user = db.getUser(telegramId);
    if (!user) {
      user = await db.getOrCreateUser(telegramId);
    }

    // Otomatik profil iyileştirme
    if (
      user &&
      (!user.firstName ||
        user.firstName === "Kullanıcı" ||
        user.firstName === "Misafir" ||
        user.firstName === "Telegram Kullanıcısı" ||
        !user.username ||
        user.username.startsWith("user_"))
    ) {
      let changed = false;
      if (user.username && user.username.startsWith("user_")) {
        user.username = "";
        changed = true;
      }
      try {
        const tgProfile = await fetchTelegramUserInfo(telegramId);
        if (tgProfile) {
          if (tgProfile.firstName && user.firstName !== tgProfile.firstName) {
            user.firstName = tgProfile.firstName;
            changed = true;
          }
          if (tgProfile.lastName && user.lastName !== tgProfile.lastName) {
            user.lastName = tgProfile.lastName;
            changed = true;
          }
          if (tgProfile.username && user.username !== tgProfile.username) {
            user.username = tgProfile.username;
            changed = true;
          }
        }
      } catch (e) {}
      if (changed) {
        await db.saveUser(user);
      }
    }

    return NextResponse.json(
      { success: true, user },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
