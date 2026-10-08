import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPaymentInformation } from "@/lib/oxapay";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/deposit/crypto-verify-status
 * WebApp veya Bot üzerinden kullanıcının ödeme durumunu sorgular.
 * Ödeme tamamlandıysa bakiyeyi otomatik yükler.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const trackId = body.trackId;
    const telegramId = Number(body.telegramId);

    if (!trackId) {
      return NextResponse.json(
        { success: false, error: "trackId parametresi gereklidir" },
        { status: 400 }
      );
    }

    const payInfo = await getPaymentInformation(trackId);
    if (!payInfo.success) {
      return NextResponse.json(
        {
          success: false,
          error: payInfo.error || "Ödeme durumu doğrulanamadı",
          status: "unknown",
        },
        { status: 400 }
      );
    }

    // İlgili bekleyen depoziti bul
    const deposits = db.getDeposits();
    const dep = deposits.find(
      (d) =>
        d.referenceCode === `OXA-${trackId}` ||
        d.txid === String(trackId)
    );

    if (payInfo.status === "paid") {
      let creditedAmount = dep?.amount || 0;
      let targetTelegramId = dep?.telegramId || telegramId;

      if (dep && dep.status !== "APPROVED") {
        await db.updateDepositStatus(dep.id, "APPROVED");

        if (targetTelegramId) {
          const user = db.getUser(targetTelegramId);
          if (user) {
            const newBal = Number((user.balance + creditedAmount).toFixed(2));
            await db.updateUser(targetTelegramId, { balance: newBal });

            await sendTelegramDirectMessage(
              targetTelegramId,
              `🎉 <b>TEBRİKLER! ÖDEMENİZ ONAYLANDI</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `💰 <b>Yüklenen Tutar:</b> <code>₺${creditedAmount.toFixed(2)}</code>\n` +
                `💳 <b>Yeni Bakiyeniz:</b> <code>₺${newBal.toFixed(2)}</code>\n` +
                `🆔 <b>İşlem No:</b> <code>#${trackId}</code>\n` +
                `⚡ Bakiyeniz hesabınıza anında aktarılmıştır. Keyifli kullanımlar dileriz!`
            );
          }
        }
      }

      return NextResponse.json({
        success: true,
        isPaid: true,
        status: "paid",
        creditedAmount,
        message: "Ödemeniz başarıyla onaylandı ve bakiyeniz hesabınıza yüklendi!",
      });
    }

    if (payInfo.status === "paying") {
      return NextResponse.json({
        success: true,
        isPaid: false,
        status: "paying",
        message: "İşleminiz blokzincirinde tespit edildi. Ağ onayı bekleniyor...",
      });
    }

    if (payInfo.status === "underpaid") {
      return NextResponse.json({
        success: true,
        isPaid: false,
        status: "underpaid",
        message: "Eksik tutar gönderildi. Lütfen kalan tutarı da adrese iletiniz.",
      });
    }

    return NextResponse.json({
      success: true,
      isPaid: false,
      status: "waiting",
      message: "Ödeme bekleniyor. Lütfen belirtilen adrese transferi tamamlayınız.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Durum kontrol edilemedi" },
      { status: 500 }
    );
  }
}
