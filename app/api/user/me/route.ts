import { NextRequest, NextResponse } from "next/server";
import { requireTelegramUser } from "@/lib/request-auth";
import { db } from "@/lib/db";
import { CONFIG } from "@/lib/config";
import { fetchTelegramUserInfo, getAdminUsernamesList } from "@/lib/telegram-bot";
import { tcmb } from "@/lib/tcmb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud(true);
    const body = await req.json();
    const auth = requireTelegramUser(req, body, body.telegramId);
    if (!auth.ok) return auth.response;
    const telegramId = auth.id;

    // Profil bilgileri istemcinin gönderdiğinden değil, Telegram'ın imzaladığı veriden alınır
    const cleanUsername = (auth.user.username || "").replace(/^@/, "").trim();
    const cleanFirstName = (auth.user.first_name || "").trim();
    const cleanLastName = auth.user.last_name ? auth.user.last_name.trim() : undefined;

    const user = await db.getOrCreateUser(telegramId, {
      username: cleanUsername,
      firstName: cleanFirstName,
      lastName: cleanLastName,
    });

    const activeOrders = db.getActiveOrders(telegramId);
    let settings = db.getSettings();

    // Yenileme aralığı tcmb.getLiveRate tarafından DB ayarına göre uygulanır.
    if (settings.useTcmbAutoRate !== false) {
      try {
        await tcmb.getLiveRate();
        settings = db.getSettings();
      } catch (e) {
        console.warn("[Auto-Rate]: Kur yenileme hatası:", e);
      }
    }

    const adminUsernames = getAdminUsernamesList();

    return NextResponse.json(
      {
        success: true,
        user,
        activeOrdersCount: activeOrders.length,
        currency: settings.currencySymbol,
        isAdmin: db.isAdmin(telegramId) || user.role === "admin",
        adminUsernames,
        maintenanceMode: Boolean(settings.maintenanceMode),
        maintenanceMessage: settings.maintenanceMessage || "",
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
    await db.syncFromCloud(true);
    const { searchParams } = new URL(req.url);
    const auth = requireTelegramUser(req, undefined, searchParams.get("telegramId"));
    if (!auth.ok) return auth.response;
    const telegramId = String(auth.id);

    let user = db.getUser(telegramId);
    if (!user) {
      user = await db.getOrCreateUser(telegramId);
    } else {
      await db.touchUserActive(telegramId);
      user = db.getUser(telegramId);
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

    const settings = db.getSettings();
    const adminUsernames = getAdminUsernamesList();
    const isAdmin = db.isAdmin(telegramId) || user?.role === "admin";
    const responseUser = user && isAdmin && user.role !== "admin"
      ? { ...user, role: "admin" as const }
      : user;

    return NextResponse.json(
      {
        success: true,
        user: responseUser,
        adminUsernames,
        isAdmin,
        maintenanceMode: Boolean(settings.maintenanceMode),
        maintenanceMessage: settings.maintenanceMessage || "",
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
