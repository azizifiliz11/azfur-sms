import crypto from "crypto";
import { db } from "./db";

// Crypto Pay API Base URLs (Documentation: https://help.cr.bot/en/articles/10279948-crypto-pay-api)
const MAINNET_API_URL = "https://pay.crypt.bot/api";
const TESTNET_API_URL = "https://testnet-pay.crypt.bot/api";

// Aktif tokenin ağını bellekte önbelleğe al
let cachedNetworkBaseUrl: string | null = null;
let cachedTokenForNetwork: string | null = null;

export interface CryptoBotMeResult {
  app_id: number;
  name: string;
  payment_processing_bot_username: string;
}

export interface CryptoBotInvoice {
  invoice_id: number;
  hash: string;
  currency_type: "crypto" | "fiat" | string;
  asset?: string;
  fiat?: string;
  amount: string;
  paid_asset?: string;
  paid_amount?: string;
  paid_fiat_rate?: string;
  fee_asset?: string;
  fee_amount?: number;
  bot_invoice_url: string;
  mini_app_invoice_url?: string;
  web_app_invoice_url?: string;
  status: "active" | "paid" | "expired";
  payload?: string;
  created_at: string;
  expiration_date?: string;
  paid_at?: string;
  allow_comments?: boolean;
  allow_anonymous?: boolean;
}

export interface CryptoBotBalanceItem {
  currency_code: string;
  available: string;
  onhold: string;
}

export interface CryptoBotExchangeRateItem {
  is_valid: boolean;
  is_crypto: boolean;
  is_fiat: boolean;
  source: string;
  target: string;
  rate: string;
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
 * Token için uygun API adresini döner (Mainnet öncelikli, gerekirse Testnet)
 */
export async function resolveApiBaseUrl(tokenInput?: string): Promise<string> {
  const token = (tokenInput || getCryptoBotToken()).trim();
  if (!token) return MAINNET_API_URL;

  if (cachedTokenForNetwork === token && cachedNetworkBaseUrl) {
    return cachedNetworkBaseUrl;
  }

  // Önce Mainnet'i dene
  try {
    const resMain = await fetch(`${MAINNET_API_URL}/getMe`, {
      method: "GET",
      headers: { "Crypto-Pay-API-Token": token },
      cache: "no-store",
    });
    const dataMain = await resMain.json();
    if (dataMain.ok) {
      cachedNetworkBaseUrl = MAINNET_API_URL;
      cachedTokenForNetwork = token;
      return MAINNET_API_URL;
    }
  } catch {}

  // Mainnet başarısızsa Testnet'i dene
  try {
    const resTest = await fetch(`${TESTNET_API_URL}/getMe`, {
      method: "GET",
      headers: { "Crypto-Pay-API-Token": token },
      cache: "no-store",
    });
    const dataTest = await resTest.json();
    if (dataTest.ok) {
      cachedNetworkBaseUrl = TESTNET_API_URL;
      cachedTokenForNetwork = token;
      return TESTNET_API_URL;
    }
  } catch {}

  return MAINNET_API_URL;
}

/**
 * CryptoPay API bağlantısını ve token geçerliliğini test eder.
 * Hem Mainnet (@CryptoBot) hem de Testnet (@CryptoTestnetBot) kontrollerini yapar.
 */
export async function testCryptoBotToken(tokenInput?: string): Promise<{
  success: boolean;
  app?: CryptoBotMeResult;
  isTestnet?: boolean;
  balances?: CryptoBotBalanceItem[];
  error?: string;
}> {
  const token = (tokenInput || getCryptoBotToken()).trim();
  if (!token) {
    return { success: false, error: "CryptoBot API Token girilmedi." };
  }

  // 1. Önce Mainnet testi
  try {
    const resMain = await fetch(`${MAINNET_API_URL}/getMe`, {
      method: "GET",
      headers: { "Crypto-Pay-API-Token": token },
      cache: "no-store",
    });
    const dataMain = await resMain.json();
    if (dataMain.ok && dataMain.result) {
      cachedNetworkBaseUrl = MAINNET_API_URL;
      cachedTokenForNetwork = token;

      // Bakiyeleri de almayı dene
      let balances: CryptoBotBalanceItem[] = [];
      try {
        const balRes = await fetch(`${MAINNET_API_URL}/getBalance`, {
          headers: { "Crypto-Pay-API-Token": token },
          cache: "no-store",
        });
        const balData = await balRes.json();
        if (balData.ok && Array.isArray(balData.result)) {
          balances = balData.result.filter((b: any) => parseFloat(b.available) > 0);
        }
      } catch {}

      return {
        success: true,
        isTestnet: false,
        app: dataMain.result,
        balances,
      };
    }
  } catch {}

  // 2. Mainnet olmadıysa Testnet testi
  try {
    const resTest = await fetch(`${TESTNET_API_URL}/getMe`, {
      method: "GET",
      headers: { "Crypto-Pay-API-Token": token },
      cache: "no-store",
    });
    const dataTest = await resTest.json();
    if (dataTest.ok && dataTest.result) {
      cachedNetworkBaseUrl = TESTNET_API_URL;
      cachedTokenForNetwork = token;

      return {
        success: true,
        isTestnet: true,
        app: dataTest.result,
      };
    }

    return {
      success: false,
      error:
        dataTest.error?.name ||
        dataTest.description ||
        "Geçersiz API Token. Token'ı @CryptoBot veya @CryptoTestnetBot üzerinden aldığınızdan emin olun.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "CryptoBot sunucularına ulaşılamadı",
    };
  }
}

/**
 * Kullanıcı için otomatik @CryptoBot faturası oluşturur.
 * Resmi dokümantasyona göre TRY (Türk Lirası) doğrudan desteklenmektedir.
 * TRY ile fatura oluşturulur; gerekirse USD fallback uygulanır.
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

  const baseUrl = await resolveApiBaseUrl(token);
  const settings = db.getSettings();
  const rate = settings.exchangeRateToTry || settings.lastTcmbRate || 49.2;
  const amountUsd = Number(Math.max(1.0, params.amountTry / rate).toFixed(2));

  const payloadStr = JSON.stringify({
    depositId: params.depositId,
    telegramId: params.telegramId,
    amountTry: params.amountTry,
    amountUsd,
  });

  const acceptedAssets = "USDT,TON,TRX,BTC,ETH,LTC,BNB,USDC";
  const desc = params.description || `AzFur SMS Bakiye Yükleme (${params.amountTry.toFixed(2)} ₺)`;
  const hiddenMsg = "AzFur SMS bakiyeniz başarıyla yüklendi! Numaralarınızı keyifle kullanabilirsiniz.";

  // 1. Önce resmi fiat "TRY" parametresiyle fatura oluşturmayı dene
  try {
    const tryPayload = {
      currency_type: "fiat",
      fiat: "TRY",
      amount: Number(params.amountTry).toFixed(2),
      accepted_assets: acceptedAssets,
      description: desc,
      hidden_message: hiddenMsg,
      payload: payloadStr,
      paid_btn_name: "openBot",
      paid_btn_url: "https://t.me/azfur_bot",
    };

    const res = await fetch(`${baseUrl}/createInvoice`, {
      method: "POST",
      headers: {
        "Crypto-Pay-API-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tryPayload),
      cache: "no-store",
    });

    const data = await res.json();
    if (data.ok && data.result) {
      return {
        success: true,
        invoice: data.result,
      };
    }
  } catch {}

  // 2. Eğer TRY kabul edilmezse veya hata dönerse USD fiat fallback ile oluştur
  try {
    const usdPayload = {
      currency_type: "fiat",
      fiat: "USD",
      amount: amountUsd.toFixed(2),
      accepted_assets: acceptedAssets,
      description: desc,
      hidden_message: hiddenMsg,
      payload: payloadStr,
      paid_btn_name: "openBot",
      paid_btn_url: "https://t.me/azfur_bot",
    };

    const res2 = await fetch(`${baseUrl}/createInvoice`, {
      method: "POST",
      headers: {
        "Crypto-Pay-API-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(usdPayload),
      cache: "no-store",
    });

    const data2 = await res2.json();
    if (data2.ok && data2.result) {
      return {
        success: true,
        invoice: data2.result,
      };
    }

    return {
      success: false,
      error: data2.error?.name || data2.description || "Fatura oluşturulamadı",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "CryptoBot API erişim hatası",
    };
  }
}

/**
 * Fatura durumunu getInvoices yöntemi ile sorgular
 */
export async function getCryptoBotInvoice(invoiceId: number | string): Promise<{
  success: boolean;
  invoice?: CryptoBotInvoice;
  error?: string;
}> {
  const token = getCryptoBotToken();
  if (!token) return { success: false, error: "CryptoBot Token bulunamadı" };

  const baseUrl = await resolveApiBaseUrl(token);

  try {
    const res = await fetch(`${baseUrl}/getInvoices?invoice_ids=${invoiceId}`, {
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
 * Faturayı siler (deleteInvoice)
 */
export async function deleteCryptoBotInvoice(invoiceId: number | string): Promise<boolean> {
  const token = getCryptoBotToken();
  if (!token) return false;
  const baseUrl = await resolveApiBaseUrl(token);

  try {
    const res = await fetch(`${baseUrl}/deleteInvoice`, {
      method: "POST",
      headers: {
        "Crypto-Pay-API-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invoice_id: Number(invoiceId) }),
      cache: "no-store",
    });
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  }
}

/**
 * Uygulamanın kripto bakiyelerini çeker (getBalance)
 */
export async function getCryptoBotBalance(): Promise<{
  success: boolean;
  balances?: CryptoBotBalanceItem[];
  error?: string;
}> {
  const token = getCryptoBotToken();
  if (!token) return { success: false, error: "Token bulunamadı" };
  const baseUrl = await resolveApiBaseUrl(token);

  try {
    const res = await fetch(`${baseUrl}/getBalance`, {
      method: "GET",
      headers: { "Crypto-Pay-API-Token": token },
      cache: "no-store",
    });
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      return { success: true, balances: data.result };
    }
    return { success: false, error: data.error?.name || "Bakiye alınamadı" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Canlı kur oranlarını çeker (getExchangeRates)
 */
export async function getCryptoBotExchangeRates(): Promise<{
  success: boolean;
  rates?: CryptoBotExchangeRateItem[];
  error?: string;
}> {
  const token = getCryptoBotToken();
  if (!token) return { success: false, error: "Token bulunamadı" };
  const baseUrl = await resolveApiBaseUrl(token);

  try {
    const res = await fetch(`${baseUrl}/getExchangeRates`, {
      method: "GET",
      headers: { "Crypto-Pay-API-Token": token },
      cache: "no-store",
    });
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      return { success: true, rates: data.result };
    }
    return { success: false, error: data.error?.name || "Kurlar alınamadı" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Webhook imzasını (HMAC SHA-256) resmi dokümantasyona göre doğrular
 * Dokümantasyon kuralı:
 * secret = sha256(token) (binary digest)
 * hmac = hmac_sha256(secret, rawBody).hex()
 * hmac === req.headers['crypto-pay-api-signature']
 */
export function verifyCryptoBotSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const token = getCryptoBotToken();
  if (!token || !signatureHeader) return false;

  try {
    const cleanSig = signatureHeader.trim();
    const secret = crypto.createHash("sha256").update(token).digest();
    const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return hmac.toLowerCase() === cleanSig.toLowerCase();
  } catch {
    return false;
  }
}
