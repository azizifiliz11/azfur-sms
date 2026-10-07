import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DepositRequest } from "@/lib/types";

export async function GET() {
  try {
    const settings = db.getSettings();
    return NextResponse.json({
      success: true,
      bankInfo: settings.bankInfo || {
        bankName: "Ziraat Bankası",
        accountHolder: "AzFur SMS",
        iban: "TR00 0000 0000 0000 0000 0000 00",
        descriptionNote: "Açıklama alanına Telegram ID'nizi veya kullanıcı adınızı yazınız.",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { telegramId, amount, method, referenceCode } = await req.json();

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
      username: user?.username || `user_${telegramId}`,
      amount: numAmount,
      method: method,
      status: "PENDING",
      referenceCode: referenceCode || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: new Date().toISOString(),
    };

    db.addDeposit(deposit);

    return NextResponse.json({
      success: true,
      message: "Bakiye yükleme talebiniz başarıyla oluşturuldu. Kontrol sonrası bakiyenize yansıtılacaktır.",
      deposit,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
