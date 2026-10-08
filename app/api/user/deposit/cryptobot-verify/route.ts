import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCryptoBotInvoice } from "@/lib/cryptobot";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoiceId");

    if (!invoiceId) {
      return NextResponse.json({ success: false, error: "invoiceId gereklidir" }, { status: 400 });
    }

    await db.syncFromCloud();
    const deposits = db.getDeposits();
    let deposit = deposits.find((d) => d.txid === invoiceId);

    if (deposit && deposit.status === "APPROVED") {
      return NextResponse.json({ success: true, status: "paid", alreadyApproved: true });
    }

    const result = await getCryptoBotInvoice(invoiceId);
    if (!result.success || !result.invoice) {
      return NextResponse.json({ success: false, error: result.error || "Fatura sorgulanamadı" });
    }

    if (result.invoice.status === "paid") {
      let payloadData: any = null;
      try {
        if (result.invoice.payload) payloadData = JSON.parse(result.invoice.payload);
      } catch (e) {}

      const telegramId = payloadData?.telegramId || deposit?.telegramId;
      const amountTry = payloadData?.amountTry || deposit?.amount || 0;

      if (telegramId && amountTry > 0) {
        const updatedUser = await db.updateUserBalance(telegramId, amountTry);
        if (deposit) {
          await db.updateDepositStatus(deposit.id, "APPROVED");
        }

        try {
          await sendTelegramDirectMessage(
            telegramId,
            `🎉 <b>BAKİYE YÜKLEMESİ DOĞRULANDI!</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🤖 <b>Ödeme Yöntemi:</b> @CryptoBot (Kripto)\n` +
              `💰 <b>Yüklenen Tutar:</b> <code>+${amountTry.toFixed(2)} ₺</code>\n` +
              `💳 <b>Yeni Bakiyeniz:</b> <code>${updatedUser.balance.toFixed(2)} ₺</code>\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `⚡ <i>Ödemeniz onaylanmıştır. İyi kullanımlar dileriz!</i>`
          );
        } catch (e) {}

        return NextResponse.json({
          success: true,
          status: "paid",
          newBalance: updatedUser.balance,
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: result.invoice.status, // "active" or "expired"
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
