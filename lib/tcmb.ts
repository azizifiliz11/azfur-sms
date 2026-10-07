import { db } from "./db";

let cachedRate: number | null = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 dakika önbellek

export const tcmb = {
  /**
   * TCMB (Türkiye Cumhuriyet Merkez Bankası) resmi günlük bülteninden güncel USD/TRY kurunu çeker
   */
  async getLiveRate(forceRefresh = false): Promise<{ rate: number; source: "TCMB" | "FALLBACK_API" | "CACHED"; timestamp: string }> {
    const now = Date.now();
    if (!forceRefresh && cachedRate && now - lastCacheTime < CACHE_DURATION_MS) {
      return {
        rate: cachedRate,
        source: "CACHED",
        timestamp: new Date(lastCacheTime).toLocaleTimeString("tr-TR"),
      };
    }

    // 1. TCMB Resmi XML Servisi
    try {
      const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "application/xml, text/xml, */*",
        },
        cache: "no-store",
      });

      if (res.ok) {
        const text = await res.text();
        // USD bloğunu bul
        const usdMatch = text.match(/<Currency[^>]+Kod="USD"[^>]*>[\s\S]*?<ForexSelling>([0-9.]+)<\/ForexSelling>/i);
        if (usdMatch && usdMatch[1]) {
          const val = parseFloat(usdMatch[1]);
          if (!isNaN(val) && val > 20) {
            const rounded = Number(val.toFixed(4));
            cachedRate = rounded;
            lastCacheTime = now;

            // Veritabanı ayarlarını güncelle
            db.updateSettings({
              lastTcmbRate: rounded,
              lastTcmbFetchTime: new Date().toISOString(),
              exchangeRateToTry: rounded,
            });

            return {
              rate: rounded,
              source: "TCMB",
              timestamp: new Date().toLocaleTimeString("tr-TR"),
            };
          }
        }
      }
    } catch (err) {
      console.warn("TCMB XML fetch warning, trying fallback:", err);
    }

    // 2. Yedek Uluslararası Kur Servisi (TCMB hafta sonu / ağ hatası olduğunda kesintisiz çalışması için)
    try {
      const fallbackRes = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        const tryRate = data.rates?.TRY;
        if (tryRate && typeof tryRate === "number") {
          const rounded = Number(tryRate.toFixed(4));
          cachedRate = rounded;
          lastCacheTime = now;

          db.updateSettings({
            lastTcmbRate: rounded,
            lastTcmbFetchTime: new Date().toISOString(),
            exchangeRateToTry: rounded,
          });

          return {
            rate: rounded,
            source: "FALLBACK_API",
            timestamp: new Date().toLocaleTimeString("tr-TR"),
          };
        }
      }
    } catch (e) {
      console.warn("Fallback rate API error:", e);
    }

    // 3. Son bilinen veritabanı kuru veya varsayılan kur
    const settings = db.getSettings();
    const fallbackRate = settings.lastTcmbRate || settings.exchangeRateToTry || 49.20;
    cachedRate = fallbackRate;
    return {
      rate: fallbackRate,
      source: "CACHED",
      timestamp: new Date().toLocaleTimeString("tr-TR"),
    };
  },
};
