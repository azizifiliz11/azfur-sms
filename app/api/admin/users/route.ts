import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchTelegramUserInfo } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await db.syncFromCloud();
    const users = db.getAllUsers();

    // Otomatik profil iyileştirme: İsmi 'Kullanıcı' kalan veya 'user_...' takma adı olanları Telegram'dan gerçek isimleriyle güncelle
    let dbUpdated = false;
    for (const u of users) {
      if (u.username && u.username.startsWith("user_")) {
        u.username = "";
        dbUpdated = true;
      }
      const isPlaceholderName =
        !u.firstName ||
        u.firstName === "Kullanıcı" ||
        u.firstName === "Misafir" ||
        u.firstName === "Telegram Kullanıcısı";

      if (isPlaceholderName || !u.username) {
        try {
          const tgProfile = await fetchTelegramUserInfo(u.telegramId);
          if (tgProfile) {
            if (tgProfile.firstName && u.firstName !== tgProfile.firstName) {
              u.firstName = tgProfile.firstName;
              dbUpdated = true;
            }
            if (tgProfile.lastName && u.lastName !== tgProfile.lastName) {
              u.lastName = tgProfile.lastName;
              dbUpdated = true;
            }
            if (tgProfile.username && u.username !== tgProfile.username) {
              u.username = tgProfile.username;
              dbUpdated = true;
            }
          }
        } catch (e) {}
      }
    }

    if (dbUpdated) {
      for (const u of users) {
        await db.saveUser(u);
      }
    }

    return NextResponse.json(
      { success: true, users },
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

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const body = await req.json();
    const { action, telegramId, userData } = body;

    // 0. İstemci önbelleğinden kullanıcıları eşitleme (Multi-container sync)
    if (action === "sync_users") {
      const { clientUsers } = body;
      if (Array.isArray(clientUsers)) {
        await db.mergeUsers(clientUsers);
      }
      return NextResponse.json({
        success: true,
        users: db.getAllUsers(),
      });
    }

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Telegram ID gereklidir" }, { status: 400 });
    }

    // 1. Kullanıcı Silme
    if (action === "delete_user") {
      await db.deleteUser(telegramId);
      return NextResponse.json({ success: true, message: "Kullanıcı başarıyla silindi" });
    }

    // 2. Ban / Engel Durumu Değiştirme
    if (action === "toggle_ban") {
      const { isBanned } = body;
      const updated = await db.toggleUserBan(telegramId, isBanned, userData);
      return NextResponse.json({
        success: true,
        message: isBanned ? "Kullanıcı başarıyla engellendi (banlandı)" : "Kullanıcının engeli kaldırıldı",
        user: updated,
      });
    }

    // 3. Admin Rolü Verme / Kaldırma
    if (action === "toggle_role") {
      const { role } = body;
      const updated = await db.updateUserRole(telegramId, role === "admin" ? "admin" : "user", userData);
      return NextResponse.json({
        success: true,
        message: role === "admin" ? "Kullanıcıya admin yetkisi verildi" : "Admin yetkisi kaldırıldı",
        user: updated,
      });
    }

    // 4. Manuel Bakiye Ekleme / Düşme
    const { delta, reason } = body;
    if (delta !== undefined) {
      const numDelta = parseFloat(delta);
      if (isNaN(numDelta)) {
        return NextResponse.json({ success: false, error: "Geçersiz tutar" }, { status: 400 });
      }

      const updatedUser = await db.updateUserBalance(telegramId, numDelta, userData);

      return NextResponse.json(
        {
          success: true,
          message: `Bakiye güncellendi (${numDelta > 0 ? "+" : ""}${numDelta} ₺). Yeni bakiye: ${updatedUser.balance.toFixed(2)} ₺`,
          user: updatedUser,
          reason,
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json({ success: false, error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
