import crypto from "crypto";
import { db } from "./db";

export interface OxaPayWhiteLabelResult {
  success: boolean;
  trackId?: number | string;
  address?: string;
  payAmount?: number;
  payCurrency?: string;
  network?: string;
  qrCodeUrl?: string;
  expiredAt?: number;
  amountTry?: number;
  amountUsd?: number;
  error?: string;
}

export interface OxaPayPaymentInfo {
  success: boolean;
  status: "waiting" | "paying" | "paid" | "underpaid" | "expired" | "unknown";
  trackId?: number | string;
  address?: string;
  amount?: number;
  payAmount?: number;
  payCurrency?: string;
  network?: string;
  txId?: string;
  raw?: any;
  error?: string;
}

/**
 * Aktif OxaPay Merchant API Key'ini döner (DB veya Ortam Değişkeni)
 */
export function getOxapayApiKey(): string {
  try {
    const settings = db.getSettings();
    const key =
      settings.cryptoSettings?.oxapayApiKey ||
      process.env.OXAPAY_API_KEY ||
      process.env.OXAPAY_MERCHANT_KEY ||
      "";
    return key.trim();
  } catch {
    return (process.env.OXAPAY_API_KEY || "").trim();
  }
}

/**
 * OxaPay Merchant API Key'in geçerliliğini test eder
 */
export async function testOxapayApiKey(keyInput?: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const key = (keyInput || getOxapayApiKey()).trim();
  if (!key) {
    return { success: false, error: "OxaPay Merchant API Key girilmedi." };
  }

  try {
    // GET /v1/payment/1 ile test et
    const res = await fetch("https://api.oxapay.com/v1/payment/1", {
      method: "GET",
      headers: {
        merchant_api_key: key,
      },
      cache: "no-store",
    });

    const bodyText = await res.text();
    let bodyJson: any = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      // JSON değilse
    }

    // Eğer API anahtarı geçersizse OxaPay 401 veya 403 ile invalid key mesajı döner
    if (res.status === 401 || res.status === 403) {
      const msg = bodyJson?.message || bodyText || "Geçersiz API Anahtarı";
      return {
        success: false,
        error: `OxaPay API Anahtarı Doğrulanamadı: ${msg}`,
      };
    }

    // 404 dönmesi ("Payment not found"), anahtarın kabul edildiği ve çalıştığı anlamına gelir
    return {
      success: true,
      message: "OxaPay Merchant API bağlantısı başarılı ve anahtar geçerli!",
    };
  } catch (err: any) {
    return {
      success: false,
      error: `OxaPay sunucusuna bağlanılamadı: ${err.message || err}`,
    };
  }
}

/**
 * Kullanıcı için bot/miniapp içinden ayrılmadan gösterilecek
 * tek kullanımlık kripto cüzdan adresi ve QR kod üretir.
 */
export async function createWhiteLabelPayment(params: {
  amountTry: number;
  telegramId: number;
  username?: string;
  payCurrency?: string; // USDT, TRX, TON, LTC, BTC (Varsayılan: USDT)
  network?: string; // TRC20, TON vb.
  orderId?: string;
}): Promise<OxaPayWhiteLabelResult> {
  // Apirone önceliği: Eğer Apirone hesabı varsa veya OxaPay API anahtarı yoksa doğrudan Apirone kullan
  const { db } = await import("./db");
  await db.syncFromCloud(true);
  const { getApironeConfig, createApironeInvoice } = await import("./apirone");
  const apironeCfg = getApironeConfig();

  const apiKey = getOxapayApiKey();
  if (apironeCfg.account || !apiKey) {
    const apResult = await createApironeInvoice({
      amountTry: params.amountTry,
      telegramId: params.telegramId,
      username: params.username,
      payCurrency: params.payCurrency,
      network: params.network,
      orderId: params.orderId,
    });

    return {
      success: apResult.success,
      trackId: apResult.invoiceId,
      address: apResult.address,
      payAmount: apResult.payAmount,
      payCurrency: apResult.payCurrency,
      network: apResult.network,
      qrCodeUrl: apResult.qrCodeUrl,
      expiredAt: apResult.expiredAt,
      amountTry: apResult.amountTry,
      amountUsd: apResult.amountUsd,
      error: apResult.error,
    };
  }

  if (!apiKey) {
    return {
      success: false,
      error: "Sistemde aktif bir kripto API anahtarı yapılandırılmamış. Lütfen yöneticiyle iletişime geçiniz.",
    };
  }

  const settings = db.getSettings();
  const rate = settings.exchangeRateToTry || settings.lastTcmbRate || 49.2;
  const amountUsd = Number(Math.max(0.2, params.amountTry / rate).toFixed(2));

  const orderId =
    params.orderId || `DEP-${params.telegramId}-${Date.now().toString().slice(-6)}`;
  const payCurrency = (params.payCurrency || "USDT").toUpperCase();
  const network =
    params.network ||
    (payCurrency === "USDT" ? "TRC20" : payCurrency === "TRX" ? "TRON" : undefined);

  // Webhook callback URL
  const appUrl =
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://azfursms.com";
  const callbackUrl = `${appUrl.replace(/\/+$/, "")}/api/user/deposit/crypto-webhook`;

  const payload: any = {
    amount: amountUsd,
    currency: "USD",
    pay_currency: payCurrency,
    lifetime: 60, // 60 dakika geçerli
    order_id: orderId,
    callback_url: callbackUrl,
    description: `AzFur SMS Bakiye Yukleme #${params.telegramId}`,
  };

  if (network) {
    payload.network = network;
  }

  try {
    const res = await fetch("https://api.oxapay.com/v1/payment/white-label", {
      method: "POST",
      headers: {
        merchant_api_key: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const resJson = await res.json();

    if (!res.ok && resJson.status !== 200 && resJson.result !== 100) {
      return {
        success: false,
        error:
          resJson.message ||
          resJson.error?.message ||
          `Kripto ödeme adresi oluşturulamadı (Kod: ${res.status})`,
      };
    }

    const data = resJson.data || resJson;
    const trackId = data.track_id || data.trackId || resJson.track_id || resJson.trackId;
    const address = data.address || resJson.address;

    if (!address) {
      return {
        success: false,
        error: resJson.message || "Cüzdan adresi alınamadı. Lütfen tekrar deneyiniz.",
      };
    }

    const payAmount = Number(
      data.pay_amount ?? data.amount ?? resJson.pay_amount ?? amountUsd
    );
    const expiredAt = data.expired_at || resJson.expired_at;

    // Yüksek kaliteli, anında yüklenen QR kod URL'i
    const qrCodeUrl =
      data.qr_code && typeof data.qr_code === "string" && data.qr_code.startsWith("http")
        ? data.qr_code
        : `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
            address
          )}`;

    return {
      success: true,
      trackId,
      address,
      payAmount,
      payCurrency,
      network: data.network || network || "TRC20",
      qrCodeUrl,
      expiredAt,
      amountTry: params.amountTry,
      amountUsd,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Kripto servisi bağlantı hatası: ${err.message || err}`,
    };
  }
}

/**
 * Ödemenin güncel durumunu sorgular (GET /v1/payment/{track_id})
 */
export async function getPaymentInformation(
  trackId: number | string
): Promise<OxaPayPaymentInfo> {
  const strId = String(trackId).trim();
  const { getApironeInvoiceInfo } = await import("./apirone");

  // Eğer ID harf içeriyorsa veya Apirone invoice formatındaysa Apirone'dan sorgula
  if (/[a-zA-Z]/.test(strId) || !getOxapayApiKey()) {
    const apInfo = await getApironeInvoiceInfo(strId);
    if (apInfo.success) {
      return {
        success: true,
        status: apInfo.status,
        trackId: apInfo.invoiceId,
        address: apInfo.address,
        amount: apInfo.amount,
        raw: apInfo.raw,
      };
    }
  }

  const apiKey = getOxapayApiKey();
  if (!apiKey) {
    const apFallback = await getApironeInvoiceInfo(strId);
    if (apFallback.success) {
      return {
        success: true,
        status: apFallback.status,
        trackId: apFallback.invoiceId,
        address: apFallback.address,
        amount: apFallback.amount,
        raw: apFallback.raw,
      };
    }
    return {
      success: false,
      status: "unknown",
      error: "Kripto API anahtarı bulunamadı",
    };
  }

  try {
    const res = await fetch(`https://api.oxapay.com/v1/payment/${trackId}`, {
      method: "GET",
      headers: {
        merchant_api_key: apiKey,
      },
      cache: "no-store",
    });

    const resJson = await res.json();
    const data = resJson.data || resJson;

    const rawStatus = String(data.status || "").toLowerCase();
    let status: OxaPayPaymentInfo["status"] = "waiting";

    if (rawStatus === "paid" || rawStatus === "complete" || rawStatus === "completed") {
      status = "paid";
    } else if (rawStatus === "paying" || rawStatus === "confirming") {
      status = "paying";
    } else if (rawStatus === "underpaid") {
      status = "underpaid";
    } else if (rawStatus === "expired" || rawStatus === "canceled") {
      status = "expired";
    }

    return {
      success: true,
      status,
      trackId,
      address: data.address,
      amount: data.amount,
      payAmount: data.pay_amount,
      payCurrency: data.pay_currency,
      network: data.network,
      txId: data.tx_id || data.txId,
      raw: data,
    };
  } catch (err: any) {
    return {
      success: false,
      status: "unknown",
      error: err.message || "Ödeme durumu kontrol edilemedi",
    };
  }
}

/**
 * OxaPay Webhook HMAC-SHA512 imza doğrulaması
 */
export function verifyOxapayWebhook(
  rawBody: string,
  hmacHeader?: string | null
): boolean {
  if (!hmacHeader) return false;
  const apiKey = getOxapayApiKey();
  if (!apiKey) return false;

  try {
    const computed = crypto
      .createHmac("sha512", apiKey)
      .update(rawBody)
      .digest("hex");

    const headerClean = hmacHeader.trim().toLowerCase();
    const computedClean = computed.toLowerCase();

    if (headerClean.length !== computedClean.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(computedClean),
      Buffer.from(headerClean)
    );
  } catch {
    return false;
  }
}
