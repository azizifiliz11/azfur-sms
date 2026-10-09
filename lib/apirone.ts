import { db } from "./db";
import { getApironePaymentOption } from "./crypto-currencies";

export interface ApironeInvoiceResult {
  success: boolean;
  invoiceId?: string;
  trackId?: string; // Geriye dönük uyumluluk
  address?: string;
  payAmount?: string;
  payCurrency?: string;
  network?: string;
  qrCodeUrl?: string;
  invoiceUrl?: string;
  expiredAt?: number;
  amountTry?: number;
  amountUsd?: number;
  error?: string;
}

export interface ApironePaymentInfo {
  success: boolean;
  status: "waiting" | "paying" | "paid" | "underpaid" | "expired" | "unknown";
  rawStatus?: string;
  invoiceId?: string;
  trackId?: string; // Geriye dönük uyumluluk
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
 * Aktif Apirone hesap bilgilerini döner (DB veya Ortam Değişkeni)
 */
export function getApironeConfig(): { account: string; transferKey: string } {
  try {
    const settings = db.getSettings();
    const account = (
      settings.cryptoSettings?.apironeAccount ||
      process.env.APIRONE_ACCOUNT ||
      process.env.APIRONE_ACCOUNT_ID ||
      ""
    ).trim();
    const transferKey = (
      settings.cryptoSettings?.apironeTransferKey ||
      process.env.APIRONE_TRANSFER_KEY ||
      process.env.APIRONE_KEY ||
      ""
    ).trim();
    return { account, transferKey };
  } catch {
    return {
      account: (
        process.env.APIRONE_ACCOUNT ||
        process.env.APIRONE_ACCOUNT_ID ||
        ""
      ).trim(),
      transferKey: (
        process.env.APIRONE_TRANSFER_KEY ||
        process.env.APIRONE_KEY ||
        ""
      ).trim(),
    };
  }
}

/**
 * Apirone üzerinde tek tıkla otomatik Multi-Currency hesabı oluşturur (KYC / Belge gerekmez)
 */
export async function createApironeAccount(
  firstName: string = "AzFur",
  orgType: string = "Digital Service"
): Promise<{
  success: boolean;
  account?: string;
  transferKey?: string;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch("https://apirone.com/api/v2/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: {
          first_name: firstName,
          last_name: "Admin",
          org_type: orgType,
        },
      }),
      cache: "no-store",
    });

    const data = await res.json();
    if (res.ok && data.account && data["transfer-key"]) {
      // Veritabanına da otomatik kaydet
      const currentSettings = db.getSettings();
      const cryptoSettings = {
        ...(currentSettings.cryptoSettings || {}),
        apironeAccount: data.account,
        apironeTransferKey: data["transfer-key"],
        autoVerifyEnabled: true,
      };

      await db.updateSettings({ cryptoSettings });

      // Adminin kayıtlı USDT / TRX adresi varsa Apirone yönlendirmesini otomatik ayarla
      if (cryptoSettings.usdtTrc20Address) {
        await setApironeForwarding(
          data.account,
          data["transfer-key"],
          "usdt@trx",
          cryptoSettings.usdtTrc20Address
        ).catch(() => {});
      }

      return {
        success: true,
        account: data.account,
        transferKey: data["transfer-key"],
        message: "Apirone hesabı başarıyla oluşturuldu ve sisteme kaydedildi!",
      };
    }

    return {
      success: false,
      error: data.message || "Apirone hesabı oluşturulamadı.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Apirone bağlantı hatası: ${err.message || err}`,
    };
  }
}

/**
 * Apirone hesabının durumunu ve API erişimini test eder
 */
export async function testApironeConnection(
  accountInput?: string,
  transferKeyInput?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  accountInfo?: any;
}> {
  const config = getApironeConfig();
  const account = (accountInput || config.account).trim();
  const transferKey = (transferKeyInput || config.transferKey).trim();

  if (!account) {
    return {
      success: false,
      error: "Apirone Account ID (örn: apr-...) girilmedi.",
    };
  }

  try {
    const res = await fetch(`https://apirone.com/api/v2/accounts/${account}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Apirone hesabı doğrulanamadı (HTTP ${res.status}): ${errText}`,
      };
    }

    const data = await res.json();
    if (data && data.account) {
      return {
        success: true,
        message: "Apirone hesabı aktif ve bağlantı başarılı!",
        accountInfo: data,
      };
    }

    return {
      success: false,
      error: "Geçersiz Apirone hesap yanıtı.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Apirone sunucusuna bağlanılamadı: ${err.message || err}`,
    };
  }
}

/**
 * Gelen kripto paraların adminin kişisel cüzdan adresine otomatik aktarılmasını sağlar (Forwarding)
 */
export async function setApironeForwarding(
  accountInput: string,
  transferKeyInput: string,
  currency: string = "usdt@trx",
  destinationAddress: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const account = accountInput.trim();
  const transferKey = transferKeyInput.trim();
  const address = destinationAddress.trim();

  if (!account || !transferKey || !address) {
    return {
      success: false,
      error: "Hesap ID, transfer key ve hedef cüzdan adresi gereklidir.",
    };
  }

  if (address === "TR7NHqJEKQxGTCi8q8ZY4pL8otSzgjLj6t") {
    return {
      success: false,
      error: "Girilen adres (TR7NHq...) Tether akıllı kontrat adresidir. Lütfen kendi şahsi TRON cüzdan adresinizi giriniz.",
    };
  }

  try {
    const res = await fetch(`https://apirone.com/api/v2/accounts/${account}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency,
        "transfer-key": transferKey,
        destinations: [
          {
            address,
            amount: "100%",
          },
        ],
      }),
      cache: "no-store",
    });

    const data = await res.json();
    if (res.ok) {
      return {
        success: true,
        message: `${currency.toUpperCase()} otomatik yönlendirme adresi başarıyla kaydedildi!`,
      };
    }

    return {
      success: false,
      error: data.message || "Yönlendirme adresi ayarlanamadı.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Yönlendirme hatası: ${err.message || err}`,
    };
  }
}

/**
 * Kullanıcıya özel Apirone Ödeme Faturası (Invoice) ve Cüzdan Adresi üretir
 */
export async function createApironeInvoice(params: {
  amountTry: number;
  telegramId: number;
  username?: string;
  payCurrency?: string;
  network?: string;
  orderId?: string;
}): Promise<ApironeInvoiceResult> {
  const config = getApironeConfig();
  const account = config.account;

  // Kullanıcının kendi Account ID'si kullanılmalı, asla arkada otomatik hesap üretilmemeli
  if (!account) {
    return {
      success: false,
      error:
        "Apirone Account ID henüz tanımlanmamış. Lütfen Yönetici Paneli -> Kripto & Ayarlar bölümünden kendi Apirone Account ID ve Transfer Key bilginizi girip kaydedin.",
    };
  }

  try {
    const selectedCurrency = (params.payCurrency || "USDT").toUpperCase();
    const selectedNetwork = params.network || (selectedCurrency === "USDT" ? "TRC20" : undefined);
    const selectedOption = getApironePaymentOption(selectedCurrency, selectedNetwork);
    if (!selectedOption) {
      return {
        success: false,
        error: "Seçilen kripto para ve ağ Apirone tarafından desteklenmiyor.",
      };
    }

    const settings = db.getSettings();
    const rateToTry = Number(settings.exchangeRateToTry || 49.2);
    if (!Number.isFinite(rateToTry) || rateToTry <= 0) {
      return { success: false, error: "Güncel USD/TRY kuru alınamadı. Lütfen daha sonra tekrar deneyin." };
    }
    const amountUsd = Number((params.amountTry / rateToTry).toFixed(2));
    const tickerUrl = new URL("https://apirone.com/api/v2/ticker");
    tickerUrl.searchParams.set("currency", selectedOption.currency);
    tickerUrl.searchParams.set("fiat", "usd");
    const tickerRes = await fetch(tickerUrl, { cache: "no-store" });
    const tickerData = tickerRes.ok ? await tickerRes.json() : null;
    const usdRate = Number(tickerData?.usd ?? tickerData?.[selectedOption.currency]?.usd);
    if (!tickerRes.ok || !Number.isFinite(usdRate) || usdRate <= 0) {
      return {
        success: false,
        error: "Seçilen kripto para için Apirone kuru alınamadı. Lütfen tekrar deneyin.",
      };
    }

    const decimals = Math.max(0, Math.round(Math.log10(1 / selectedOption.unitsFactor)));
    const coinAmount = amountUsd / usdRate;
    if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
      return { success: false, error: "Ödeme tutarı seçilen kripto para için hesaplanamadı." };
    }
    const coinAmountText = coinAmount.toFixed(decimals);
    const calculatedMinorAmount = coinAmountText.replace(".", "").replace(/^0+(?=\d)/, "");
    if (!calculatedMinorAmount || /^0+$/.test(calculatedMinorAmount)) {
      return { success: false, error: "Yükleme tutarı seçilen kripto para için çok düşük." };
    }

    // Apirone fatura (invoice) oluştururken callback-url parametresini ZORUNLU KILMAZ.
    // Otomatik üretilen domainler (Vercel vb.) Apirone tarafından 400 veya 500 hatasıyla reddedilebilir.
    // Bu nedenle callback-url yalnızca yönetici panelinde AÇIKÇA geçerli bir Webhook URL tanımlanmışsa gönderilir.
    let candidateCallback: string | null = null;
    try {
      const explicitUrl = (settings.cryptoSettings?.callbackUrl || "").trim();
      if (explicitUrl && explicitUrl.startsWith("https://")) {
        candidateCallback = explicitUrl;
      }
    } catch {
      candidateCallback = null;
    }

    const orderId = params.orderId || `dep_${Date.now()}_${params.telegramId}`;

    const invoicePayload: any = {
      currency: selectedOption.currency,
      amount: calculatedMinorAmount,
      lifetime: 3600, // 1 Saat geçerli
      "user-data": {
        title: "Bakiye Yukleme - AzFur SMS",
        merchant: "AzFur SMS",
        price: `${coinAmountText} ${selectedCurrency}`,
        telegramId: String(params.telegramId),
        username: params.username || "",
        orderId,
      },
    };

    if (candidateCallback) {
      invoicePayload["callback-url"] = candidateCallback;
    }

    let res = await fetch(`https://apirone.com/api/v2/accounts/${account}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoicePayload),
      cache: "no-store",
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    // Otomatik İyileştirme (Self-Healing): Eğer Apirone herhangi bir hata dönerse
    // ve istekte callback-url varsa, callback-url'i ANINDA kaldırıp tekrar dene!
    if ((!res.ok || !data.invoice || !data.address) && invoicePayload["callback-url"]) {
      delete invoicePayload["callback-url"];
      try {
        const retryRes = await fetch(`https://apirone.com/api/v2/accounts/${account}/invoices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invoicePayload),
          cache: "no-store",
        });
        if (retryRes.ok) {
          res = retryRes;
          data = await retryRes.json();
        }
      } catch {}
    }

    if (!res.ok || !data.invoice || !data.address) {
      return {
        success: false,
        error: data.message || "Apirone ödeme adresi oluşturulamadı.",
      };
    }

    const invoiceId = data.invoice;
    const address = data.address;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(
      address
    )}`;

    return {
      success: true,
      invoiceId,
      trackId: invoiceId, // Geriye dönük uyumluluk
      address,
      payAmount: coinAmountText,
      payCurrency: selectedCurrency,
      network: selectedOption.networkLabel,
      qrCodeUrl,
      invoiceUrl: data["invoice-url"] || `https://apirone.com/invoice?id=${invoiceId}`,
      expiredAt: Math.floor(Date.now() / 1000) + 3600,
      amountTry: params.amountTry,
      amountUsd,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Apirone API hatası: ${err.message || err}`,
    };
  }
}

/**
 * Apirone Invoice durumunu kontrol eder
 */
export async function getApironeInvoiceInfo(invoiceId: string): Promise<ApironePaymentInfo> {
  const id = invoiceId.trim();
  if (!id) {
    return { success: false, status: "unknown", error: "Invoice ID belirtilmedi." };
  }

  try {
    const res = await fetch(`https://apirone.com/api/v2/invoices/${id}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        status: "unknown",
        error: `Fatura bilgisi alınamadı (HTTP ${res.status}): ${errText}`,
      };
    }

    const data = await res.json();
    const rawStatus = String(data.status || "").toLowerCase();

    // Durum eşleştirmesi
    let status: ApironePaymentInfo["status"] = "waiting";
    if (rawStatus === "paid" || rawStatus === "completed" || rawStatus === "overpaid") {
      status = "paid";
    } else if (rawStatus === "partpaid") {
      status = "underpaid";
    } else if (rawStatus === "expired") {
      status = "expired";
    } else if (rawStatus === "created") {
      status = "waiting";
    }

    return {
      success: true,
      status,
      rawStatus,
      invoiceId: id,
      trackId: id,
      address: data.address,
      amount: data.amount,
      raw: data,
    };
  } catch (err: any) {
    return {
      success: false,
      status: "unknown",
      error: `Apirone durum sorgulama hatası: ${err.message || err}`,
    };
  }
}
