import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCryptoBotSignature } from "@/lib/cryptobot";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

// Webhook ping / healthcheck desteği
export async function GET() {
  return NextResponse.json({ ok: true, service: "CryptoBot Webhook Endpoint Active" });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("crypto-pay-api-signature") ||
      req.headers.get("Crypto-Pay-Api-Signature");

    // İmza doğrulaması (resmi HMAC SHA-256 kontrolü)
    const isValid = verifyCryptoBotSignature(rawBody, signature);
    if (!isValid) {
      console.warn("Invalid CryptoBot webhook signature:", {
        receivedSig: signature,
        hasBody: !!rawBody,
      });
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(rawBody);

    // Yalnızca invoice_paid olayında bakiye yükle
    if (data.update_type === "invoice_paid" && data.payload) {
      const invoice = data.payload;
      const invoiceId = invoice.invoice_id;
      let payloadData: any = null;

      try {
        if (invoice.payload) {
          payloadData = JSON.parse(invoice.payload);
        }
      } catch (e) {}

      await db.syncFromCloud();

      // İlgili yatırma talebini bul
      const deposits = db.getDeposits();
      let deposit = deposits.find(
        (d) => d.txid === String(invoiceId) || (payloadData && d.id === payloadData.depositId)
      );

      // Çift yüklemeyi önlemek için kontrol
      if (deposit && deposit.status === "APPROVED") {
        return NextResponse.json({ ok: true, message: "Already credited" });
      }

      const settings = db.getSettings();
      const telegramId = payloadData?.telegramId || deposit?.telegramId;

      let amountTry = 0;
      if (payloadData?.amountTry && !isNaN(parseFloat(payloadData.amountTry))) {
        amountTry = parseFloat(payloadData.amountTry);
      } else if (invoice.currency_type === "fiat" && invoice.fiat === "TRY") {
        amountTry = parseFloat(invoice.amount) || 0;
      } else if (invoice.currency_type === "fiat" && invoice.fiat === "USD") {
        const rate = settings.exchangeRateToTry || settings.lastTcmbRate || 49.2;
        amountTry = Number(((parseFloat(invoice.amount) || 0) * rate).toFixed(2));
      } else if (deposit?.amount) {
        amountTry = deposit.amount;
      }

      if (telegramId && amountTry > 0) {
        // 1. Bakiyeyi otomatik yükle
        const updatedUser = await db.updateUserBalance(telegramId, amountTry);

        // 2. Depozit durumunu onayla
        if (deposit) {
          await db.updateDepositStatus(deposit.id, "APPROVED");
        }

        // 3. Kullanıcıya Telegram'dan anlık bildirim gönder
        const paidAssetStr = invoice.paid_asset
          ? ` (${invoice.paid_amount} ${invoice.paid_asset})`
          : "";

        const messageText =
          `🎉 <b>BAKİYE YÜKLEMESİ ONAYLANDI!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🤖 <b>Ödeme Yöntemi:</b> @CryptoBot (Kripto)\n` +
          `💰 <b>Yüklenen Tutar:</b> <code>+${amountTry.toFixed(2)} ₺</code>${paidAssetStr}\n` +
          `💳 <b>Yeni Bakiyeniz:</b> <code>${updatedUser.balance.toFixed(2)} ₺</code>\n` +
          `🔑 <b>Fatura No:</b> <code>#${invoiceId}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚡ <i>Ödemeniz otomatik olarak tanımlanmıştır. Hemen numara kiralayabilirsiniz!</i>`;

        try {
          await sendTelegramDirectMessage(telegramId, messageText);
        } catch (e) {
          console.error("CryptoBot notification send error:", e);
        }
      }
    }

    // CryptoBot sunucusuna başarılı yanıt dön (aksi halde tekrar dener)
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("CryptoBot webhook processing error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
