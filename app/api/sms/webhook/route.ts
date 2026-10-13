import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/auth-check";
import { deliverCode, isRentOrder, syncOrderWithProvider } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * POST /api/sms/webhook — Hero-SMS "sms-incoming" webhook'u.
 * SMS gelir gelmez kodu siparişe işler ve kullanıcıya Telegram bildirimi gönderir; Mini App kapalı olsa
 * veya bot butonuna basılmasa da kod anında iletilir. Hero-SMS hesap ayarlarında bu adres tanımlanmalı.
 *
 * Güvenlik: istekler yalnızca Hero-SMS'in belgelenmiş IP adreslerinden kabul edilir. Belgeye göre 3 sn içinde
 * 200 yanıtı beklenir; işlenmiş SMS için de 200 dönülmelidir.
 */
const HERO_WEBHOOK_IPS = new Set(["84.32.223.53", "185.138.88.87"]);

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!HERO_WEBHOOK_IPS.has(ip)) {
    console.warn(`[HeroWebhook] İzin verilmeyen IP: ${ip}`);
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const activationId = String(payload.activationId ?? "").trim();
    if (!activationId) return NextResponse.json({ ok: true });

    await db.syncFromCloud();
    const order = db.getActivation(activationId);
    if (!order) {
      console.warn(`[HeroWebhook] Sipariş bulunamadı: ${activationId}`);
      return NextResponse.json({ ok: true });
    }

    const code = payload.code ? String(payload.code).trim() : "";
    const text = payload.text ? String(payload.text) : null;
    if (code && !isRentOrder(order) && (order.status === "WAIT_CODE" || order.status === "RECEIVED")) {
      await deliverCode(activationId, code, text);
    } else {
      // Kod alanı boşsa (yalnızca metin) sağlayıcıdan durumu sorup eşitle
      await syncOrderWithProvider(activationId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[HeroWebhook] İşleme hatası:", err);
    // Hero-SMS yeniden denesin (en az 3 dk); arka plan taraması da ayrıca yakalar
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
