import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createCryptoBotInvoice, getCryptoBotToken } from "@/lib/cryptobot";
import { DepositRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const body = await req.json();
    const { telegramId, amount } = body;

    if (!telegramId || !amount) {
      return NextResponse.json(
        { success: false, error: "Telegram ID ve tutar gereklidir" },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 10) {
      return NextResponse.json(
        { success: false, error: "Minimum yükleme tutarı 10 ₺'dir" },
        { status: 400 }
      );
    }

    const token = getCryptoBotToken();
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Sistemde aktif bir @CryptoBot entegrasyonu bulunmuyor. Lütfen yöneticiyle iletişime geçiniz.",
        },
        { status: 400 }
      );
    }

    const user = db.getUser(telegramId);
    const depositId = `dep_cbot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const invoiceResult = await createCryptoBotInvoice({
      telegramId: Number(telegramId),
      amountTry: numAmount,
      depositId,
    });

    if (!invoiceResult.success || !invoiceResult.invoice) {
      return NextResponse.json(
        {
          success: false,
          error: invoiceResult.error || "CryptoBot faturası oluşturulamadı.",
        },
        { status: 500 }
      );
    }

    const deposit: DepositRequest = {
      id: depositId,
      telegramId: Number(telegramId),
      username: user?.username && !user.username.startsWith("user_") ? user.username : "",
      amount: numAmount,
      method: "CryptoBot",
      status: "PENDING",
      referenceCode: `CBOT-${invoiceResult.invoice.invoice_id}`,
      txid: String(invoiceResult.invoice.invoice_id),
      createdAt: new Date().toISOString(),
    };

    await db.addDeposit(deposit);

    return NextResponse.json({
      success: true,
      depositId,
      invoiceId: invoiceResult.invoice.invoice_id,
      payUrl: invoiceResult.invoice.bot_invoice_url,
      miniAppUrl: invoiceResult.invoice.mini_app_invoice_url || invoiceResult.invoice.bot_invoice_url,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
