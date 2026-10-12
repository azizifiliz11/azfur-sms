import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONFIG } from "@/lib/config";
import { verifyTelegramInitData } from "@/lib/telegram-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/user/profile
 * Profil ekranı: hesap bilgisi, bakiye özeti, bakiye yükleme ve numara geçmişi.
 * Geçmiş telefon numaraları ve SMS kodları içerdiğinden kullanıcı, istemcinin gönderdiği
 * telegramId ile değil Telegram'ın imzaladığı initData ile belirlenir.
 */
export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json().catch(() => ({ initData: "" }));
    const tgUser = verifyTelegramInitData(String(initData || ""), CONFIG.TELEGRAM_BOT_TOKEN);
    if (!tgUser) {
      return NextResponse.json(
        { success: false, error: "Oturum doğrulanamadı. Lütfen Mini App'i Telegram üzerinden yeniden açın." },
        { status: 401 }
      );
    }

    await db.syncFromCloud();
    const user = db.getUser(tgUser.id);
    if (!user) {
      return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı" }, { status: 404 });
    }
    if (user.isBanned) {
      return NextResponse.json({ success: false, error: "Hesabınız askıya alınmıştır." }, { status: 403 });
    }

    const [history, preferences] = await Promise.all([
      db.getUserHistory(tgUser.id),
      db.getUserPreferences(tgUser.id),
    ]);

    // İstatistikler: başarı oranı yalnızca sonuçlanmış siparişler üzerinden (kod bekleyenler hariç)
    const sc = history.statusCounts;
    const succeeded = (sc.COMPLETED || 0) + (sc.RECEIVED || 0);
    const finished = history.orderCount - (sc.WAIT_CODE || 0);

    // Otomatik VIP: tek seferde eşik ve üzeri yükleme yapan kullanıcı VIP olur (db.updateDepositStatus)
    const vipCfg = db.getSettings().vipSettings;
    const autoVipThreshold =
      vipCfg?.enabled && vipCfg.autoVipOnDepositAmount ? Number(vipCfg.autoVipOnDepositAmount) : null;

    return NextResponse.json(
      {
        success: true,
        vip: {
          isVip: Boolean(user.isVip),
          discountPercent: user.vipDiscountPercent || 0,
          since: user.vipSince || null,
          expiresAt: user.vipExpiresAt || null,
          autoVipThreshold,
          autoVipDiscountPercent: autoVipThreshold ? vipCfg?.defaultDiscountPercent || 15 : null,
        },
        activeDiscount: user.activeDiscount || null,
        stats: {
          totalOrders: history.orderCount,
          succeeded,
          cancelled: sc.CANCELLED || 0,
          timedOut: sc.TIMEOUT || 0,
          successRate: finished > 0 ? Math.round((succeeded / finished) * 100) : null,
          topService: history.topService,
        },
        tickets: history.tickets.map((t) => {
          const last = t.messages[t.messages.length - 1];
          return {
            id: t.id,
            subject: t.subject,
            status: t.status,
            updatedAt: t.updatedAt,
            lastMessage: last ? { sender: last.sender, text: String(last.text || "").slice(0, 160) } : null,
          };
        }),
        preferences,
        profile: {
          telegramId: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName || "",
          username: user.username || "",
          createdAt: user.createdAt,
          balance: user.balance,
          spent: user.spent || 0,
          totalDeposited: history.totalDeposited,
          orderCount: history.orderCount,
          isVip: Boolean(user.isVip),
          vipDiscountPercent: user.vipDiscountPercent || 0,
        },
        deposits: history.deposits.map((d) => ({
          id: d.id,
          amount: d.amount,
          method: d.method,
          status: d.status,
          createdAt: d.createdAt,
        })),
        orders: history.orders.map((o) => ({
          id: o.id,
          serviceName: o.serviceName || o.serviceCode,
          countryName: o.countryName,
          countryFlag: o.countryFlag,
          phoneNumber: o.phoneNumber,
          chargedPrice: o.chargedPrice,
          status: o.status,
          smsCode: o.smsCode,
          createdAt: o.createdAt,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("Profile error:", err);
    return NextResponse.json({ success: false, error: err.message || "Profil yüklenemedi" }, { status: 500 });
  }
}
