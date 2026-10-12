import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOxapayWebhook } from "@/lib/oxapay";
import { confirmCryptoDeposit } from "@/lib/deposit-confirm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/user/deposit/crypto-webhook
 * Apirone fatura callback'i ve OxaPay IPN uç noktası.
 *
 * Güvenlik: gövdedeki "status: paid" bilgisine GÜVENİLMEZ (uç nokta herkese açık). Gövdeden yalnızca
 * fatura/takip numarası alınır; ödeme durumu sağlayıcının API'sinden sorgulanarak doğrulanır ve bakiye
 * lib/deposit-confirm.ts üzerinden bir kez yüklenir.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const isApirone = Boolean(payload.invoice);
  // Apirone callback'i durdurmak için "*ok*" yanıtı bekler
  const ack = () =>
    new NextResponse(isApirone ? "*ok*" : "ok", { status: 200, headers: { "Content-Type": "text/plain" } });

  try {
    if (!isApirone) {
      const hmacHeader =
        req.headers.get("HMAC") || req.headers.get("hmac") || req.headers.get("x-hmac") || req.headers.get("X-HMAC");
      if (hmacHeader && !verifyOxapayWebhook(rawBody, hmacHeader)) {
        console.warn("⚠️ OxaPay Webhook: Geçersiz HMAC İmzası!");
        return new NextResponse("Invalid HMAC signature", { status: 400 });
      }
    }

    const trackId = String(payload.invoice || payload.track_id || payload.trackId || "").trim();
    const orderId = String(payload.order_id || payload.orderId || "").trim();
    console.log(`🔔 Kripto Webhook: ${isApirone ? "Apirone" : "OxaPay"} id=${trackId} status=${payload.status}`);
    if (!trackId) return ack();

    await db.syncFromCloud(true);
    const dep = db
      .getDeposits()
      .find(
        (d) =>
          d.referenceCode === `APR-${trackId}` ||
          d.referenceCode === `OXA-${trackId}` ||
          d.txid === trackId ||
          (orderId !== "" && (d.referenceCode === orderId || d.id === orderId))
      );

    if (!dep) {
      console.warn(`⚠️ Kripto Webhook: Depozit kaydı bulunamadı (id: ${trackId})`);
      return ack();
    }

    if (dep.status === "PENDING") {
      const { approved, payInfo } = await confirmCryptoDeposit(dep, trackId);
      if (!approved) {
        console.log(`Kripto Webhook: ${dep.id} henüz onaylanmadı (sağlayıcı durumu: ${payInfo?.status || "bilinmiyor"})`);
      }
    }

    return ack();
  } catch (err: any) {
    console.error("❌ Kripto Webhook İşleme Hatası:", err);
    // Sağlayıcı yeniden denesin; bekleyen ödemeler zamanlanmış bakımda da kontrol edilir
    return new NextResponse("error", { status: 500 });
  }
}
