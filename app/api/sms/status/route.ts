import { NextRequest, NextResponse } from "next/server";
import { requireTelegramUser } from "@/lib/request-auth";
import { db } from "@/lib/db";
import { syncOrderWithProvider } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * GET /api/sms/status?id=<aktivasyon>
 * Mini App'in sipariş yoklaması. Sağlayıcıyla eşitleme (kod teslimi, süre dolumu / sağlayıcı iptali
 * iadesi) lib/orders.ts içinde tek seferliktir: bot, Hero-SMS webhook'u ve arka plan taramasıyla aynı yol.
 */
export async function GET(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Aktivasyon ID gerekli" }, { status: 400 });
    }

    const auth = requireTelegramUser(req);
    if (!auth.ok) return auth.response;

    await db.syncFromCloud();
    const order = db.getActivation(id);
    // Başkasının siparişi "bulunamadı" gibi davranır (numara/kod sızmasın, varlığı da belli olmasın)
    if (!order || Number(order.telegramId) !== auth.id) {
      return NextResponse.json({ success: false, error: "Sipariş bulunamadı" }, { status: 404 });
    }

    const { order: synced, event } = await syncOrderWithProvider(id);
    const messages: Record<string, string> = {
      code_received: "SMS kodu başarıyla yakalandı",
      refunded_timeout: "Süre doldu, ücret iade edildi",
      refunded_cancelled: "Aktivasyon iptal edildi, ücret iade edildi",
    };

    return NextResponse.json({ success: true, order: synced || order, message: messages[event] });
  } catch (err: any) {
    console.error("Status polling error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
