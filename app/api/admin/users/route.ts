import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchTelegramUserInfo, sendTelegramDirectMessage, getAdminUsernamesList } from "@/lib/telegram-bot";
import { isAuthorizedAdmin } from "@/lib/auth-check";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    const reqAdminTgId = req.headers.get("x-telegram-id") || db.getSettings().adminTelegramId;
    if (reqAdminTgId) {
      await db.touchUserActive(reqAdminTgId);
    }
    const { searchParams } = new URL(req.url);
    const detailTelegramId = searchParams.get("telegramId");

    // Tekil kullanıcı detay sorgusu (Aldığı numaralar, kodlar, ödemeler, ticketlar)
    if (detailTelegramId) {
      const cleanId = String(detailTelegramId).trim();
      const user = db.getAllUsers().find((u) => String(u.telegramId).trim() === cleanId) || null;
      if (!user) {
        return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı" }, { status: 404 });
      }

      const activations = db.getUserActivations(cleanId);
      const deposits = db.getDeposits().filter((d) => String(d.telegramId).trim() === cleanId);
      const tickets = db.getUserTickets(cleanId);

      return NextResponse.json(
        {
          success: true,
          user,
          activations,
          deposits,
          tickets,
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const users = db.getAllUsers();
    const allActivations = db.getAllActivations();

    // Kullanıcıları özet sipariş ve aktivasyon istatistikleriyle zenginleştir
    const enrichedUsers = users.map((u) => {
      const userActs = allActivations.filter((a) => Number(a.telegramId) === Number(u.telegramId));
      const successActs = userActs.filter((a) => a.status === "COMPLETED" || a.status === "RECEIVED" || Boolean(a.smsCode));
      return {
        ...u,
        totalOrdersCount: userActs.length,
        successOrdersCount: successActs.length,
      };
    });

    return NextResponse.json(
      { success: true, users: enrichedUsers },
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
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
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

      // Kullanıcı banlandığında anında bota ban mesajı ve admin kullanıcı adlarını gönder
      if (isBanned) {
        try {
          const adminUsernames = getAdminUsernamesList();
          const adminsText =
            adminUsernames.length > 0
              ? adminUsernames.map((u) => `• <b>@${u}</b>`).join("\n")
              : "• <b>@olanak</b>";

          const banMsg =
            `🚫 <b>HESABINIZ ENGELLENDİ (BANLANDINIZ)</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Sistem kuralları veya yönetici kararı doğrultusunda AzFur SMS botuna ve hizmetlerine erişiminiz durdurulmuştur.\n\n` +
            `İtiraz etmek veya bilgi almak için aşağıdaki yöneticilerle iletişime geçebilirsiniz:\n\n` +
            `👑 <b>Yöneticiler:</b>\n` +
            `${adminsText}`;

          const inlineKeyboard = {
            inline_keyboard: adminUsernames.map((u) => [
              { text: `💬 Yöneticiye Yaz (@${u})`, url: `https://t.me/${u}` },
            ]),
          };

          await sendTelegramDirectMessage(telegramId, banMsg, "HTML", inlineKeyboard);
        } catch (e) {
          console.warn("Direct ban message error:", e);
        }
      }

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
      await db.addLog({
        category: "ADMIN",
        level: "WARN",
        action: "ROLE_CHANGED",
        details: `${updated.firstName} (@${updated.username || telegramId}) rolü '${role}' olarak güncellendi.`,
        telegramId: Number(telegramId),
        username: updated.username,
      });
      return NextResponse.json({
        success: true,
        message: role === "admin" ? "Kullanıcıya admin yetkisi verildi" : "Admin yetkisi kaldırıldı",
        user: updated,
      });
    }

    // 4. VIP Üyelik Durumu Değiştirme
    if (action === "toggle_vip") {
      const { isVip, discountPercent, note } = body;
      const updated = await db.updateUserVip(telegramId, Boolean(isVip), {
        discountPercent: discountPercent !== undefined ? Number(discountPercent) : undefined,
        note,
        userData,
      });

      // Telegram üzerinden kullanıcıyı anında bilgilendir
      if (isVip) {
        try {
          const vipMsg =
            `⭐ <b>TEBRİKLER! HESABINIZ VIP STATÜSÜNE YÜKSELTİLDİ</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Yönetim tarafından hesabınıza özel <b>VIP Ayrıcalığı</b> tanımlandı.\n\n` +
            `🎁 <b>VIP İndirim Oranı:</b> <code>%${updated.vipDiscountPercent || 15}</code>\n` +
            `✨ Tüm numara alımlarınızda otomatik indirimli fiyatlardan yararlanacaksınız!\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
          await sendTelegramDirectMessage(telegramId, vipMsg, "HTML");
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: isVip
          ? `Kullanıcı başarıyla VIP yapıldı (%${updated.vipDiscountPercent} indirim tanımlandı)`
          : "Kullanıcının VIP üyeliği kaldırıldı",
        user: updated,
      });
    }

    // 5. Manuel Bakiye Ekleme / Düşme
    const { delta, reason } = body;
    if (delta !== undefined) {
      const numDelta = parseFloat(delta);
      if (isNaN(numDelta)) {
        return NextResponse.json({ success: false, error: "Geçersiz tutar" }, { status: 400 });
      }

      const updatedUser = await db.updateUserBalance(telegramId, numDelta, userData);

      await db.addLog({
        category: "ADMIN",
        level: numDelta > 0 ? "SUCCESS" : "WARN",
        action: "BALANCE_MANUAL_ADJUST",
        details: `${updatedUser.firstName} (@${updatedUser.username || telegramId}) bakiyesine ${numDelta > 0 ? "+" : ""}${numDelta} ₺ işlendi (Yeni Bakiye: ${updatedUser.balance.toFixed(2)} ₺). Gerekçe: ${reason || "Yönetici İşlemi"}`,
        telegramId: Number(telegramId),
        username: updatedUser.username,
        metadata: { delta: numDelta, reason },
      });

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
