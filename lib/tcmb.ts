import { db } from "./db";

let cachedRate: number | null = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 dakika önbellek

export const tcmb = {
  /**
   * TCMB (Türkiye Cumhuriyet Merkez Bankası) resmi günlük bülteninden güncel USD/TRY kurunu çeker.
   * Eğer TCMB yanıt vermezse veya hafta sonu/yurtdışı bulut sunucusu (Vercel) IP engeli varsa
   * uluslararası canlı kur API'lerine kesintisiz fallback yapar.
   */
  async getLiveRate(forceRefresh = false): Promise<{ rate: number; source: "TCMB" | "FALLBACK_API" | "CACHED"; timestamp: string }> {
    const now = Date.now();
    const settings = db.getSettings();

    // Veritabanındaki son başarılı çekilme zamanını kontrol et
    const lastDbFetchMs = settings.lastTcmbFetchTime ? new Date(settings.lastTcmbFetchTime).getTime() : 0;
    const isDbFresh = !isNaN(lastDbFetchMs) && lastDbFetchMs > 0 && (now - lastDbFetchMs < CACHE_DURATION_MS);

    // Eğer zorunlu yenileme istenmediyse ve son 30 dk içinde çekilmişse önbellekten dön
    if (!forceRefresh && isDbFresh && (cachedRate || settings.lastTcmbRate)) {
      const activeRate = cachedRate || settings.lastTcmbRate || settings.exchangeRateToTry || 49.20;
      return {
        rate: activeRate,
        source: "CACHED",
        timestamp: new Date(lastDbFetchMs || lastCacheTime).toLocaleTimeString("tr-TR"),
      };
    }

    let newRate: number | null = null;
    let rateSource: "TCMB" | "FALLBACK_API" | "CACHED" = "TCMB";

    // 1. TCMB Resmi XML Servisi (Hızlı 4s zaman aşımı korumalı)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
          Accept: "application/xml, text/xml, */*",
        },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        const usdMatch = text.match(/<Currency[^>]+Kod="USD"[^>]*>[\s\S]*?<ForexSelling>([0-9.]+)<\/ForexSelling>/i);
        if (usdMatch && usdMatch[1]) {
          const val = parseFloat(usdMatch[1]);
          if (!isNaN(val) && val > 20) {
            newRate = Number(val.toFixed(4));
            rateSource = "TCMB";
          }
        }
      }
    } catch (err) {
      console.warn("TCMB XML servisi yanıt vermedi, yedek kur API'sine geçiliyor:", err);
    }

    // 2. Yedek Uluslararası Kur Servisi 1: open.er-api.com
    if (!newRate) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const fallbackRes = await fetch("https://open.er-api.com/v6/latest/USD", {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          const tryRate = data.rates?.TRY;
          if (tryRate && typeof tryRate === "number" && tryRate > 20) {
            newRate = Number(tryRate.toFixed(4));
            rateSource = "FALLBACK_API";
          }
        }
      } catch (e) {
        console.warn("Yedek kur API 1 hatası:", e);
      }
    }

    // 3. Yedek Uluslararası Kur Servisi 2: api.exchangerate-api.com
    if (!newRate) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const fb2Res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (fb2Res.ok) {
          const data = await fb2Res.json();
          const tryRate = data.rates?.TRY;
          if (tryRate && typeof tryRate === "number" && tryRate > 20) {
            newRate = Number(tryRate.toFixed(4));
            rateSource = "FALLBACK_API";
          }
        }
      } catch (e) {
        console.warn("Yedek kur API 2 hatası:", e);
      }
    }

    const finalRate = newRate || settings.lastTcmbRate || settings.exchangeRateToTry || 49.20;
    cachedRate = finalRate;
    lastCacheTime = now;

    // Ayarları SADECE yeni bir kur dış API'den başarıyla çekildiyse ve mevcuttan farklıysa kaydet
    if (newRate && newRate !== settings.lastTcmbRate) {
      const shouldUpdateActiveExchangeRate = settings.useTcmbAutoRate !== false;
      const updatePayload: Record<string, any> = {
        lastTcmbRate: finalRate,
        lastTcmbFetchTime: new Date().toISOString(),
      };
      if (shouldUpdateActiveExchangeRate) {
        updatePayload.exchangeRateToTry = finalRate;
      }
      await db.updateSettings(updatePayload);
    }

    return {
      rate: finalRate,
      source: newRate ? rateSource : "CACHED",
      timestamp: new Date().toLocaleTimeString("tr-TR"),
    };
  },
};
