import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPaymentInformation, evaluateCryptoTolerance } from "@/lib/oxapay";
import { confirmCryptoDeposit } from "@/lib/deposit-confirm";

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

    // İlgili depoziti bul (başka örnekte oluşturulmuş olabilir: güncel veriyi al)
    await db.syncFromCloud();
    const dep = db
      .getDeposits()
      .find(
        (d) =>
          d.referenceCode === `APR-${trackId}` ||
          d.referenceCode === `OXA-${trackId}` ||
          d.txid === String(trackId)
      );

    // Depozit varsa onay + tek seferlik yükleme + bildirim ortak fonksiyonda (webhook ve bakımla aynı)
    const confirmation = dep ? await confirmCryptoDeposit(dep, String(trackId)) : null;
    const payInfo = confirmation?.payInfo || (await getPaymentInformation(trackId));
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

    const depositAmountTry = dep?.amount || 0;
    const tolerance = confirmation?.tolerance || evaluateCryptoTolerance(payInfo, depositAmountTry);

    if (payInfo.status === "paid" || tolerance.isAccepted) {
      const creditedAmount = depositAmountTry;
      return NextResponse.json({
        success: true,
        isPaid: true,
        status: "paid",
        creditedAmount,
        message: tolerance.deficitTry > 0
          ? `Ödemeniz küçük yuvarlama farkı toleransı (${tolerance.deficitTry.toFixed(2)} ₺) ile onaylandı ve bakiyeniz hesabınıza yüklendi!`
          : "Ödemeniz başarıyla onaylandı ve bakiyeniz hesabınıza yüklendi!",
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
        deficitTry: tolerance.deficitTry,
        message: tolerance.message || `Eksik tutar gönderildi (${tolerance.deficitTry.toFixed(2)} ₺ eksik). Kabul edilebilir maksimum tolerans 10 ₺'dir.`,
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
