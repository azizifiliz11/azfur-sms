import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DepositRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await db.syncFromCloud();
    const settings = db.getSettings();
    return NextResponse.json(
      {
        success: true,
        bankInfo: settings.bankInfo || {
          bankName: "Ziraat Bankası",
          accountHolder: "AzFur SMS",
          iban: "TR00 0000 0000 0000 0000 0000 00",
          descriptionNote: "Açıklama alanına Telegram ID'nizi veya kullanıcı adınızı yazınız.",
        },
        // Yalnızca kullanıcıya gösterilmesi gereken alanlar. Apirone hesap/transfer anahtarı,
        // OxaPay/CryptoBot anahtarları gibi gizli bilgiler ASLA istemciye gönderilmez.
        cryptoSettings: {
          usdtTrc20Address: settings.cryptoSettings?.usdtTrc20Address || "",
          trxAddress: settings.cryptoSettings?.trxAddress || "",
          autoVerifyEnabled: settings.cryptoSettings?.autoVerifyEnabled !== false,
        },
        exchangeRate: settings.exchangeRateToTry || 49.2,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const { telegramId, amount, method, referenceCode, txid } = await req.json();

    if (!telegramId || !amount || !method) {
      return NextResponse.json({ success: false, error: "Eksik parametreler" }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ success: false, error: "Geçersiz yükleme tutarı" }, { status: 400 });
    }

    const user = db.getUser(telegramId);
    const deposit: DepositRequest = {
      id: `dep_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      telegramId: Number(telegramId),
      username: (user?.username && !user.username.startsWith("user_")) ? user.username : "",
      amount: numAmount,
      method: method,
      status: "PENDING",
      referenceCode: referenceCode || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      txid: txid || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.addDeposit(deposit);

    return NextResponse.json({
      success: true,
      message: "Bakiye yükleme talebiniz başarıyla oluşturuldu. Kontrol sonrası bakiyenize yansıtılacaktır.",
      deposit,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
