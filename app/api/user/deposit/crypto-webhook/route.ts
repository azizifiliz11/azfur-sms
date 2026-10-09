import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOxapayWebhook } from "@/lib/oxapay";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/deposit/crypto-webhook
 * OxaPay IPN (Instant Payment Notification) Webhook Endpoint'i.
 * Kullanıcı ödeme yaptığında blokzincir onayından sonra anında tetiklenir.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Invalid JSON body", { status: 400 });
    }

    // --- 1. APIRONE WEBHOOK İŞLEME ---
    if (payload.invoice && payload.account) {
      const invoiceId = String(payload.invoice);
      const apStatus = String(payload.status || "").toLowerCase();
      console.log(`🔔 Apirone Webhook Alındı: Invoice=${invoiceId}, Status=${apStatus}`);

      // Eğer fatura ödendi veya tamamlandıysa
      if (apStatus === "paid" || apStatus === "completed" || apStatus === "overpaid") {
        const deposits = db.getDeposits();
        const dep = deposits.find(
          (d) =>
            d.referenceCode === `APR-${invoiceId}` ||
            d.txid === invoiceId ||
            d.id.includes(invoiceId)
        );

        if (dep && dep.status !== "APPROVED") {
          await db.updateDepositStatus(dep.id, "APPROVED");

          const user = db.getUser(dep.telegramId);
          if (user) {
            const newBal = Number((user.balance + dep.amount).toFixed(2));
            await db.updateUser(dep.telegramId, { balance: newBal });

            await sendTelegramDirectMessage(
              dep.telegramId,
              `🎉 <b>TEBRİKLER! ÖDEMENİZ ONAYLANDI</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `💰 <b>Yüklenen Tutar:</b> <code>₺${dep.amount.toFixed(2)}</code>\n` +
                `💳 <b>Yeni Bakiyeniz:</b> <code>₺${newBal.toFixed(2)}</code>\n` +
                `🆔 <b>İşlem No:</b> <code>#${invoiceId}</code>\n` +
                `⚡ Bakiyeniz hesabınıza otomatik olarak yüklenmiştir. Keyifli kullanımlar dileriz!`
            );
          }
        }
      }

      // Apirone servisi için HTTP 200 "ok" (text/plain) dön
      return new NextResponse("ok", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // --- 2. OXAPAY WEBHOOK İŞLEME (Geriye Dönük Uyumluluk) ---
    const hmacHeader =
      req.headers.get("HMAC") ||
      req.headers.get("hmac") ||
      req.headers.get("x-hmac") ||
      req.headers.get("X-HMAC");

    if (hmacHeader) {
      const isSignatureValid = verifyOxapayWebhook(rawBody, hmacHeader);
      if (!isSignatureValid) {
        console.warn("⚠️ OxaPay Webhook: Geçersiz HMAC İmzası!");
        return new NextResponse("Invalid HMAC signature", { status: 400 });
      }
    }

    const trackId = payload.track_id || payload.trackId;
    const orderId = payload.order_id || payload.orderId;
    const status = String(payload.status || "").toLowerCase();

    console.log(`🔔 Kripto Webhook Alındı: TrackId=${trackId}, Status=${status}, OrderId=${orderId}`);

    // Yalnızca başarılı ödemeleri işle
    if (status === "paid" || status === "complete" || status === "completed") {
      const deposits = db.getDeposits();
      const dep = deposits.find(
        (d) =>
          d.referenceCode === `OXA-${trackId}` ||
          d.txid === String(trackId) ||
          d.referenceCode === `APR-${trackId}` ||
          d.referenceCode === orderId ||
          d.id === orderId
      );

      if (dep) {
        if (dep.status !== "APPROVED") {
          await db.updateDepositStatus(dep.id, "APPROVED");

          const user = db.getUser(dep.telegramId);
          if (user) {
            const newBal = Number((user.balance + dep.amount).toFixed(2));
            await db.updateUser(dep.telegramId, { balance: newBal });

            await sendTelegramDirectMessage(
              dep.telegramId,
              `🎉 <b>TEBRİKLER! ÖDEMENİZ ONAYLANDI</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `💰 <b>Yüklenen Tutar:</b> <code>₺${dep.amount.toFixed(2)}</code>\n` +
                `💳 <b>Yeni Bakiyeniz:</b> <code>₺${newBal.toFixed(2)}</code>\n` +
                `🆔 <b>İşlem No:</b> <code>#${trackId}</code>\n` +
                `⚡ Bakiyeniz hesabınıza otomatik olarak yüklenmiştir. Bizi tercih ettiğiniz için teşekkür ederiz!`
            );
          }
        }
      } else {
        console.warn(`⚠️ Kripto Webhook: Depozit kaydı bulunamadı (TrackId: ${trackId})`);
      }
    }

    return new NextResponse("ok", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err: any) {
    console.error("❌ OxaPay Webhook İşleme Hatası:", err);
    // OxaPay'in tekrar tekrar denememesi için yine de 200 ok dönebiliriz veya 500
    return new NextResponse("ok", { status: 200 });
  }
}
