import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DepositRequest } from "@/lib/types";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const { telegramId, txid, cryptoType, amountTry } = await req.json();

    if (!telegramId || !txid) {
      return NextResponse.json({ success: false, error: "Eksik parametreler (Telegram ID ve TXID gereklidir)" }, { status: 400 });
    }

    const cleanTxid = String(txid).trim();

    // 1. TXID format kontrolü (Tron TXID 64 hex karakterlidir)
    if (!/^[a-fA-F0-9]{64}$/.test(cleanTxid)) {
      return NextResponse.json({
        success: false,
        error: "Geçersiz işlem kodu (TXID). Lütfen 64 karakterli Tron işlem kodunu yapıştırınız.",
      }, { status: 400 });
    }

    // 2. Bu TXID daha önce kullanılmış mı?
    if (db.hasUsedTxid(cleanTxid)) {
      return NextResponse.json({
        success: false,
        error: "Bu işlem kodu (TXID) daha önce kullanılmış ve onaylanmış!",
      }, { status: 400 });
    }

    // 3. TronScan Genel API'sinden işlemi sorgula
    let tronData: any = null;
    try {
      const tronRes = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${cleanTxid}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });
      tronData = await tronRes.json();
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        error: "TronScan ağına bağlanılamadı. Lütfen az sonra tekrar deneyiniz.",
      }, { status: 500 });
    }

    // 4. Tron onay ve başarı kontrolü
    if (!tronData || !tronData.contractRet || tronData.contractRet !== "SUCCESS") {
      return NextResponse.json({
        success: false,
        error: "İşlem Tron ağında henüz onaylanmamış veya bulunamadı. Lütfen 15-30 saniye sonra tekrar deneyiniz.",
      }, { status: 400 });
    }

    const settings = db.getSettings();
    const user = db.getUser(telegramId);
    let creditedAmount = 0;

    // 5. USDT (TRC-20) doğrulaması
    if (cryptoType === "USDT_TRC20") {
      const transfers = tronData.trc20TransferInfo || [];
      const usdtTransfer = transfers.find(
        (t: any) => t.symbol === "USDT" || (t.contract_address && t.contract_address.toLowerCase() === "tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t")
      );

      if (!usdtTransfer) {
        return NextResponse.json({
          success: false,
          error: "Bu işlemde USDT (TRC-20) transferi tespit edilemedi.",
        }, { status: 400 });
      }

      // Admin cüzdanı tanımlı ise alıcı adresi eşleşiyor mu kontrol et
      const adminUsdt = (settings.cryptoSettings?.usdtTrc20Address || "").trim();
      if (adminUsdt && adminUsdt.length > 10 && usdtTransfer.to_address && usdtTransfer.to_address.toLowerCase() !== adminUsdt.toLowerCase()) {
        return NextResponse.json({
          success: false,
          error: "Transfer, sistemimize ait USDT cüzdan adresine gönderilmemiş!",
        }, { status: 400 });
      }

      const rawAmount = parseFloat(usdtTransfer.amount_str || "0") / 1e6;
      if (rawAmount <= 0) {
        return NextResponse.json({ success: false, error: "Transfer tutarı 0 olarak görünüyor." }, { status: 400 });
      }

      const rate = settings.exchangeRateToTry || 49.2;
      creditedAmount = Number((rawAmount * rate).toFixed(2));
    } else {
      // 6. TRX (Tron) doğrulaması
      const contractData = tronData.contractData;
      const adminTrx = (settings.cryptoSettings?.trxAddress || "").trim();
      const toAddr = tronData.toAddress || contractData?.to_address;

      if (adminTrx && adminTrx.length > 10 && toAddr && toAddr.toLowerCase() !== adminTrx.toLowerCase()) {
        return NextResponse.json({
          success: false,
          error: "Transfer, sistemimize ait TRX cüzdan adresine gönderilmemiş!",
        }, { status: 400 });
      }

      const trxSun = parseFloat(contractData?.amount || tronData.amount || "0");
      const trxAmount = trxSun / 1e6;
      if (trxAmount <= 0) {
        return NextResponse.json({ success: false, error: "Transfer TRX tutarı 0 olarak görünüyor." }, { status: 400 });
      }

      // TRX TRY kuru (yaklaşık 7.80 TL)
      const trxRate = Number(((settings.exchangeRateToTry || 49.2) / 6.3).toFixed(2));
      creditedAmount = Number((trxAmount * trxRate).toFixed(2));
    }

    if (creditedAmount <= 0) {
      creditedAmount = Number(amountTry) || 50;
    }

    // 7. Bakiye yükleme kaydı oluştur ve anında ONAYLA
    const deposit: DepositRequest = {
      id: `dep_crypto_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      telegramId: Number(telegramId),
      username: user?.username || `user_${telegramId}`,
      amount: creditedAmount,
      method: cryptoType === "USDT_TRC20" ? "USDT_TRC20" : "TRX",
      status: "APPROVED",
      referenceCode: `TX-${cleanTxid.slice(0, 8).toUpperCase()}`,
      txid: cleanTxid,
      createdAt: new Date().toISOString(),
    };

    await db.addDeposit(deposit);

    // 8. Kullanıcı bakiyesine ANINDA ekle
    const updatedUser = await db.updateUserBalance(telegramId, creditedAmount);

    // 9. Telegram botundan kullanıcıya bildirim gönder
    try {
      await sendTelegramDirectMessage(
        telegramId,
        `⚡ <b>Kripto Ödemeniz Otomatik Doğrulandı!</b>\n\n` +
          `✅ <b>Yüklenen Tutar:</b> <code>+${creditedAmount.toFixed(2)} ₺</code>\n` +
          `💰 <b>Güncel Bakiyeniz:</b> <code>${updatedUser?.balance.toFixed(2) || creditedAmount} ₺</code>\n` +
          `🔑 <b>İşlem Hash (TXID):</b> <code>${cleanTxid.slice(0, 16)}...</code>\n\n` +
          `Teşekkür ederiz, iyi kullanımlar dileriz!`,
        "HTML"
      );
    } catch {
      // Bildirim gitmese bile bakiye yüklendi
    }

    return NextResponse.json({
      success: true,
      creditedAmount,
      newBalance: updatedUser?.balance || creditedAmount,
      message: `Tebrikler! ${creditedAmount.toFixed(2)} ₺ bakiyeniz Tron ağı üzerinden doğrulanarak hesabınıza otomatik yüklendi.`,
      deposit,
    });
  } catch (err: any) {
    console.error("Crypto verify error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
