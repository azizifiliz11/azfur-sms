import crypto from "crypto";
import { db } from "./db";
import { pricingEngine } from "./pricing";

const CRYPTO_PAY_API_URL = "https://pay.crypt.bot/api";

export interface CryptoBotMeResult {
  app_id: number;
  name: string;
  payment_processing_bot_username: string;
}

export interface CryptoBotInvoice {
  invoice_id: number;
  hash: string;
  currency_type: string;
  asset?: string;
  fiat?: string;
  amount: string;
  bot_invoice_url: string;
  mini_app_invoice_url?: string;
  web_app_invoice_url?: string;
  status: "active" | "paid" | "expired";
  payload?: string;
  created_at: string;
}

export function getCryptoBotToken(): string {
  const settings = db.getSettings();
  return (
    settings.cryptoSettings?.cryptoBotToken ||
    process.env.CRYPTO_BOT_TOKEN ||
    ""
  ).trim();
}

/**
 * CryptoPay API bağlantısını ve token geçerliliğini test eder
 */
export async function testCryptoBotToken(tokenInput?: string): Promise<{
  success: boolean;
  app?: CryptoBotMeResult;
  error?: string;
}> {
  const token = (tokenInput || getCryptoBotToken()).trim();
  if (!token) {
    return { success: false, error: "CryptoBot API Token girilmedi." };
  }

  try {
    const res = await fetch(`${CRYPTO_PAY_API_URL}/getMe`, {
      method: "GET",
      headers: {
        "Crypto-Pay-API-Token": token,
      },
      cache: "no-store",
    });

    const data = await res.json();
    if (data.ok && data.result) {
      return {
        success: true,
        app: data.result,
      };
    }

    return {
      success: false,
      error: data.error?.name || data.description || "Geçersiz API Token",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Bağlantı hatası",
    };
  }
}

/**
 * Kullanıcı için otomatik @CryptoBot faturası oluşturur
 */
export async function createCryptoBotInvoice(params: {
  telegramId: number;
  amountTry: number;
  depositId: string;
  description?: string;
}): Promise<{
  success: boolean;
  invoice?: CryptoBotInvoice;
  error?: string;
}> {
  const token = getCryptoBotToken();
  if (!token) {
    return {
      success: false,
      error: "Sistemde aktif bir @CryptoBot tokeni yapılandırılmamış.",
    };
  }

  const settings = db.getSettings();
  const rate = settings.exchangeRateToTry || settings.lastTcmbRate || 49.2;
  const amountUsd = Number(Math.max(1.0, params.amountTry / rate).toFixed(2));

  const payloadStr = JSON.stringify({
    depositId: params.depositId,
    telegramId: params.telegramId,
    amountTry: params.amountTry,
    amountUsd,
  });

  try {
    const bodyPayload = {
      currency_type: "fiat",
      fiat: "USD",
      amount: amountUsd.toFixed(2),
      accepted_assets: "USDT,TON,TRX,BTC,ETH,LTC,BNB,USDC",
      description: params.description || `AzFur SMS Bakiye Yükleme (${params.amountTry} ₺)`,
      payload: payloadStr,
      paid_btn_name: "openBot",
      paid_btn_url: `https://t.me/azfur_bot`,
    };

    const res = await fetch(`${CRYPTO_PAY_API_URL}/createInvoice`, {
      method: "POST",
      headers: {
        "Crypto-Pay-API-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
      cache: "no-store",
    });

    const data = await res.json();
    if (data.ok && data.result) {
      return {
        success: true,
        invoice: data.result,
      };
    }

    return {
      success: false,
      error: data.error?.name || data.description || "Fatura oluşturulamadı",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "CryptoBot API erişim hatası",
    };
  }
}

/**
 * Fatura durumunu doğrudan sorgular
 */
export async function getCryptoBotInvoice(invoiceId: number | string): Promise<{
  success: boolean;
  invoice?: CryptoBotInvoice;
  error?: string;
}> {
  const token = getCryptoBotToken();
  if (!token) return { success: false, error: "CryptoBot Token bulunamadı" };

  try {
    const res = await fetch(`${CRYPTO_PAY_API_URL}/getInvoices?invoice_ids=${invoiceId}`, {
      method: "GET",
      headers: {
        "Crypto-Pay-API-Token": token,
      },
      cache: "no-store",
    });

    const data = await res.json();
    if (data.ok && data.result && data.result.items && data.result.items.length > 0) {
      return {
        success: true,
        invoice: data.result.items[0],
      };
    }

    return { success: false, error: "Fatura bulunamadı" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Webhook imzasını (HMAC SHA-256) doğrular
 */
export function verifyCryptoBotSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const token = getCryptoBotToken();
  if (!token || !signatureHeader) return false;

  try {
    const secret = crypto.createHash("sha256").update(token).digest();
    const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return hmac === signatureHeader;
  } catch {
    return false;
  }
}
