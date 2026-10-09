import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { getApironePaymentOption } from "@/lib/crypto-currencies";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/deposit/crypto-create
 * Bot ve WebApp içinden kullanıcıya özel tek kullanımlık kripto adresi ve QR kod üretir.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const telegramId = Number(body.telegramId);

    const rateCheck = checkApiRateLimit(req, `crypto_dep_${telegramId || "anon"}`, 4, 15);
    if (!rateCheck.allowed) {
      return NextResponse.json({ success: false, error: rateCheck.error }, { status: 429 });
    }

    const amount = Number(body.amount);
    const payCurrency = String(body.payCurrency || "USDT").toUpperCase();
    const network = body.network ? String(body.network).toUpperCase() : (payCurrency === "USDT" ? "TRC20" : undefined);

    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json(
        { success: false, error: "Geçersiz Telegram ID" },
        { status: 400 }
      );
    }

    if (!amount || isNaN(amount) || amount < 10) {
      return NextResponse.json(
        { success: false, error: "Minimum yükleme tutarı 10 ₺'dir" },
        { status: 400 }
      );
    }

    if (!getApironePaymentOption(payCurrency, network)) {
      return NextResponse.json(
        { success: false, error: "Desteklenmeyen kripto para veya ağ seçimi." },
        { status: 400 }
      );
    }

    await db.syncFromCloud(true);
    const user = db.getUser(telegramId);
    const username = user?.username || `user_${telegramId}`;

    const { createApironeInvoice } = await import("@/lib/apirone");
    const paymentRes = await createApironeInvoice({
      amountTry: amount,
      telegramId,
      username,
      payCurrency,
      network,
    });

    const trackId = paymentRes.invoiceId || paymentRes.trackId;

    if (!paymentRes.success || !paymentRes.address || !trackId) {
      return NextResponse.json(
        {
          success: false,
          error: paymentRes.error || "Kripto ödeme adresi oluşturulamadı.",
        },
        { status: 500 }
      );
    }

    // Bekleyen bakiye yükleme kaydı oluştur
    await db.createDeposit({
      id: `dep_${trackId}_${Date.now()}`,
      telegramId,
      username,
      amount,
      method: "Crypto",
      status: "PENDING",
      referenceCode: `APR-${trackId}`,
      txid: String(trackId),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      trackId: paymentRes.trackId,
      address: paymentRes.address,
      payAmount: paymentRes.payAmount,
      payCurrency: paymentRes.payCurrency,
      network: paymentRes.network,
      qrCodeUrl: paymentRes.qrCodeUrl,
      expiredAt: paymentRes.expiredAt,
      amountTry: amount,
      amountUsd: paymentRes.amountUsd,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Ödeme oluşturulurken beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
