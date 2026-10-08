import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCryptoBotSignature } from "@/lib/cryptobot";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("crypto-pay-api-signature");

    // İmza doğrulaması (güvenlik kontrolü)
    const isValid = verifyCryptoBotSignature(rawBody, signature);
    if (!isValid) {
      console.warn("Invalid CryptoBot webhook signature");
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(rawBody);
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

      const telegramId = payloadData?.telegramId || deposit?.telegramId;
      const amountTry = payloadData?.amountTry || deposit?.amount || 0;

      if (telegramId && amountTry > 0) {
        // 1. Bakiyeyi otomatik yükle
        const updatedUser = await db.updateUserBalance(telegramId, amountTry);

        // 2. Depozit durumunu onayla
        if (deposit) {
          await db.updateDepositStatus(deposit.id, "APPROVED");
        }

        // 3. Kullanıcıya Telegram'dan anlık push bildirimi gönder
        const messageText =
          `🎉 <b>BAKİYE YÜKLEMESİ ONAYLANDI!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🤖 <b>Ödeme Yöntemi:</b> @CryptoBot (Kripto)\n` +
          `💰 <b>Yüklenen Tutar:</b> <code>+${amountTry.toFixed(2)} ₺</code>\n` +
          `💳 <b>Yeni Bakiyeniz:</b> <code>${updatedUser.balance.toFixed(2)} ₺</code>\n` +
          `🔑 <b>Fatura No:</b> <code>#${invoiceId}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚡ <i>Ödemeniz otomatik olarak tanımlanmıştır. İyi kullanımlar dileriz!</i>`;

        try {
          await sendTelegramDirectMessage(telegramId, messageText);
        } catch (e) {
          console.error("CryptoBot notification send error:", e);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("CryptoBot webhook processing error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
