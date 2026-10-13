import { NextRequest, NextResponse } from "next/server";
import { db, getSqlClient } from "@/lib/db";
import { isAuthorizedAdmin } from "@/lib/auth-check";
import { withAdminAudit } from "@/lib/admin-audit";
import { cancelOrderWithRefund, syncOrderWithProvider } from "@/lib/orders";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const STATUS_FILTERS: Record<string, string[]> = {
  waiting: ["WAIT_CODE"],
  received: ["RECEIVED"],
  completed: ["COMPLETED"],
  refunded: ["CANCELLED", "TIMEOUT"],
  all: ["WAIT_CODE", "RECEIVED", "COMPLETED", "CANCELLED", "TIMEOUT"],
};

/** GET /api/admin/orders?filter=waiting|received|completed|refunded|all&q=&limit= */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz erişim" }, { status: 403 });
    }
    await db.syncFromCloud();
    const p = req.nextUrl.searchParams;
    const statuses = STATUS_FILTERS[p.get("filter") || "all"] || STATUS_FILTERS.all;
    const q = (p.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(p.get("limit")) || 100, 1), 300);
    const sql = getSqlClient();

    let rows: any[] = [];
    if (sql) {
      const digits = q.replace(/[^0-9]/g, "");
      const like = `%${q.toLowerCase()}%`;
      rows = (q
        ? await sql`
            SELECT * FROM activations
            WHERE status = ANY(${statuses})
              AND (
                CAST(telegram_id AS TEXT) = ${q}
                OR id = ${q}
                OR (${digits.length >= 4} AND regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"})
                OR LOWER(service_name) LIKE ${like}
                OR LOWER(country_name) LIKE ${like}
              )
            ORDER BY created_at DESC LIMIT ${limit}`
        : await sql`SELECT * FROM activations WHERE status = ANY(${statuses}) ORDER BY created_at DESC LIMIT ${limit}`) as any[];
    }

    const orders = rows.map((a) => {
      const u = db.getUser(Number(a.telegram_id));
      return {
        id: a.id,
        telegramId: Number(a.telegram_id),
        username: u?.username && !u.username.startsWith("user_") ? u.username : "",
        userFullName: [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim(),
        serviceName: a.service_name || a.service_code,
        serviceCode: a.service_code,
        countryName: a.country_name || "",
        countryFlag: a.country_flag || "",
        phoneNumber: a.phone_number || "",
        chargedPrice: parseFloat(a.charged_price) || 0,
        originalCost: parseFloat(a.original_cost) || 0,
        status: a.status,
        smsCode: a.sms_code || null,
        createdAt: Number(a.created_at) || 0,
        expiresAt: Number(a.expires_at) || 0,
      };
    });
    return NextResponse.json({ success: true, orders }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/orders
 *  { action: "sync", orderId }          — sağlayıcıdan durumu şimdi kontrol et (kod / iade)
 *  { action: "cancel_refund", orderId } — kod bekleyen siparişi sağlayıcıda iptal et ve iade et
 *  { action: "manual_refund", orderId, reason } — kodu gelmiş/tamamlanmış siparişe elle iade (gönüllü iade)
 */
async function handlePOST(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz erişim" }, { status: 403 });
    }
    await db.syncFromCloud(true);
    const body = await req.json();
    const orderId = String(body.orderId || "");
    const order = db.getActivation(orderId);
    if (!order) return NextResponse.json({ success: false, error: "Sipariş bulunamadı" }, { status: 404 });
    // Kayıt için hedef kullanıcı
    body.telegramId = order.telegramId;

    if (body.action === "sync") {
      const { order: synced, event } = await syncOrderWithProvider(orderId);
      return NextResponse.json({ success: true, order: synced, message: `Sağlayıcıyla eşitlendi (${event}).` });
    }

    if (body.action === "cancel_refund") {
      const result = await cancelOrderWithRefund(orderId, Number(order.telegramId));
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      return NextResponse.json({
        success: true,
        order: result.order,
        message: `Sipariş iptal edildi, ₺${order.chargedPrice.toFixed(2)} iade edildi.`,
      });
    }

    if (body.action === "manual_refund") {
      // Kodu gelmiş/tamamlanmış siparişe gönüllü iade: durum atomik değişir, iade bir kez yapılır
      const claimed = await db.claimActivationStatus(orderId, ["RECEIVED", "COMPLETED"], "CANCELLED");
      if (!claimed) {
        return NextResponse.json(
          { success: false, error: "Bu sipariş zaten iade edilmiş veya hâlâ kod bekliyor (önce 'İptal & iade' kullanın)." },
          { status: 409 }
        );
      }
      const user = await db.incrementUserBalance(order.telegramId, order.chargedPrice);
      const reason = String(body.reason || "").replace(/[<>&]/g, "").slice(0, 200);
      await sendTelegramDirectMessage(
        order.telegramId,
        `↩️ <b>SİPARİŞİNİZ İADE EDİLDİ</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
          `📱 ${order.serviceName} • <code>${order.phoneNumber}</code>\n` +
          `💰 <b>İade:</b> <code>+${order.chargedPrice.toFixed(2)} ₺</code>\n` +
          `💳 <b>Yeni Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>` +
          (reason ? `\n\n<i>${reason}</i>` : "")
      ).catch(() => {});
      return NextResponse.json({
        success: true,
        order: claimed,
        message: `₺${order.chargedPrice.toFixed(2)} kullanıcıya iade edildi.`,
      });
    }

    return NextResponse.json({ success: false, error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Başarılı yönetici işlemleri silinemez işlem kaydına (admin_audit) yazılır
export const POST = withAdminAudit("orders", handlePOST);
