import { CONFIG } from "./config";
import { Country, ServiceItem, PriceStockItem } from "./types";
import { db } from "./db";
import { getCountryMeta } from "./country-flags";

// In-memory cache for countries and services to keep API calls blazing fast
let cachedCountries: Country[] | null = null;
let countriesCacheTime = 0;

let cachedServices: ServiceItem[] | null = null;
let servicesCacheTime = 0;

let cachedPrices: Record<string, Record<string, PriceStockItem>> | null = null;
let pricesCacheTime = 0;
let cachedCountryPrices: Record<number, { data: Record<string, Record<string, PriceStockItem>>; time: number }> = {};
let cachedRentPrices: Record<string, { data: RentPriceMap; time: number }> = {};
let cachedServicePrices: Record<string, { data: Record<string, Record<string, PriceStockItem>>; time: number }> = {};

/** serviceCountRent yanıtı: { ülkeId: { saat: { count, price, retail_price } } } (fiyat USD) */
export type RentPriceMap = Record<string, Record<string, { count: number; price: number; retail_price?: number }>>;

export interface RentSms {
  id: string;
  from: string;
  code: string | null;
  text: string | null;
  date: string;
  type: string;
}

/** Kiralama (rent) API'si JSON döner; hatalar {"title":"NO_NUMBERS","details":...} biçimindedir. */
async function heroJson(url: string): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  const isError = !res.ok || (json && typeof json === "object" && !Array.isArray(json) && "title" in json && !("data" in json));
  return { ok: !isError, status: res.status, json, text };
}

// Country metadata is loaded comprehensively from ./country-flags.ts

// Common service icons & categorizations
const SERVICE_ICONS: Record<string, { icon: string; category: string; priority: number }> = {
  wa: { icon: "whatsapp", category: "Mesajlaşma", priority: 100 },
  tg: { icon: "telegram", category: "Mesajlaşma", priority: 99 },
  dr: { icon: "openai", category: "Yapay Zeka", priority: 95 },
  go: { icon: "google", category: "E-Posta & Arama", priority: 90 },
  ig: { icon: "instagram", category: "Sosyal Medya", priority: 85 },
  ds: { icon: "discord", category: "Oyun & Topluluk", priority: 80 },
  fb: { icon: "facebook", category: "Sosyal Medya", priority: 75 },
  lf: { icon: "tiktok", category: "Sosyal Medya", priority: 75 },
  tw: { icon: "twitter", category: "Sosyal Medya", priority: 70 },
  wb: { icon: "wechat", category: "Mesajlaşma", priority: 65 },
  vi: { icon: "viber", category: "Mesajlaşma", priority: 60 },
  mm: { icon: "microsoft", category: "İş & Yazılım", priority: 60 },
  ot: { icon: "other", category: "Diğer Servisler", priority: 50 },
};

function getHeroApiKey(): string {
  try {
    const settings = db.getSettings();
    if (settings.heroSmsApiKey !== undefined && settings.heroSmsApiKey.trim() !== "") {
      return settings.heroSmsApiKey.trim();
    }
  } catch (e) {}
  return (CONFIG.HERO_SMS_API_KEY || "").trim();
}

/**
 * Hero-SMS hataları düz metin (NO_NUMBERS) veya JSON ({"title":"NO_BALANCE","details":...}) olarak döner.
 * Her iki biçimi de tek bir hata koduna çevirir.
 */
function parseHeroError(text: string): string {
  const trimmed = (text || "").trim();
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed);
      if (j?.title) return String(j.title);
    } catch {}
  }
  return trimmed || "UNKNOWN";
}

const HERO_ERROR_MESSAGES: Record<string, string> = {
  NO_NUMBERS: "Bu ülke ve servis için şu anda uygun numara stoku tükenmiş. Lütfen başka bir ülke deneyin.",
  BAD_DURATION: "Seçilen kiralama süresi bu ülkede sunulmuyor. Lütfen listeyi yenileyip başka bir süre seçin.",
  FREE_CANCELLATION_EXPIRED: "Ücretsiz iptal süresi (ilk 20 dakika) doldu; kiralama iptal edilemez.",
  OTP_RECEIVED: "Bu numaraya SMS geldiği için kiralama iptal edilemez.",
  NEW_OTP_RECEIVED: "Bu numaraya yeni SMS geldi; kiralama iptal edilemez.",
  ACTIVATION_NOT_ACTIVE: "Bu kiralama sağlayıcıda artık aktif değil.",
  NO_BALANCE: "Sağlayıcı havuzunda geçici bakiye yetersizliği var. Lütfen yöneticiye bildirin veya biraz sonra tekrar deneyin.",
  CHANNELS_LIMIT: "Sağlayıcıda aynı anda açılabilecek numara sınırına ulaşıldı. Lütfen birkaç dakika sonra tekrar deneyin.",
  SERVICE_NOT_AVAILABLE: "Bu servis şu anda bu ülkede satışta değil. Lütfen başka bir ülke veya servis seçin.",
  BANNED: "Sağlayıcı bu ülke/servis için geçici olarak satışı durdurdu. Lütfen başka bir seçenek deneyin.",
  WRONG_MAX_PRICE: "Numara fiyatı değişti. Lütfen listeyi yenileyip tekrar deneyin.",
  BAD_KEY: "Numara sağlayıcısına bağlanılamadı (API anahtarı). Lütfen yöneticiye bildirin.",
};

/** Kullanıcıya gösterilecek Türkçe hata metni. */
export function heroErrorMessage(code: string | undefined): string {
  const key = parseHeroError(code || "");
  return HERO_ERROR_MESSAGES[key] || `Numara kiralanamadı (${key}). Lütfen tekrar deneyin.`;
}

export const heroSms = {
  getApiKey(): string {
    return getHeroApiKey();
  },

  clearCache(): void {
    cachedCountries = null;
    countriesCacheTime = 0;
    cachedServices = null;
    servicesCacheTime = 0;
    cachedPrices = null;
    pricesCacheTime = 0;
    cachedCountryPrices = {};
    cachedRentPrices = {};
    cachedServicePrices = {};
  },

  /**
   * Numara kiralama (Full rent vb.) fiyat ve stokları (action=serviceCountRent, USD).
   * Tek istekte tüm ülkeler döner; 60 sn önbelleklenir.
   */
  async getRentPrices(service = "full"): Promise<RentPriceMap> {
    const now = Date.now();
    const cached = cachedRentPrices[service];
    if (cached && now - cached.time < 60000) return cached.data;
    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=serviceCountRent&service=${encodeURIComponent(service)}&currency=840&api_key=${apiKey}`;
    try {
      const r = await heroJson(url);
      const data: RentPriceMap = r.ok && r.json && typeof r.json === "object" && !Array.isArray(r.json) ? r.json : {};
      cachedRentPrices[service] = { data, time: now };
      return data;
    } catch (err) {
      console.error("Hero-SMS serviceCountRent error:", err);
      return cached?.data || {};
    }
  },

  /**
   * Numara kirala (action=getRentNumber). duration saat cinsindendir (24, 72, 168, 4320...).
   * Yanıt: { activationId, phoneNumber, activationCost, activationEndTime, ... }
   */
  async getRentNumber(
    service: string,
    country: number,
    hours: number
  ): Promise<{ success: boolean; id?: string; number?: string; cost?: number; endsAt?: number; error?: string }> {
    const settings = db.getSettings();
    if (settings.mockMode) {
      const sim = this.simulateGetNumber(service, country);
      return { success: true, id: sim.id.replace("mock_", "mock_rent_"), number: sim.number, endsAt: Date.now() + hours * 3600000 };
    }
    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getRentNumber&service=${encodeURIComponent(service)}&country=${country}&duration=${hours}&currency=840&api_key=${apiKey}`;
    try {
      const r = await heroJson(url);
      const j = r.json;
      if (r.ok && j && j.activationId && j.phoneNumber) {
        const end = j.activationEndTime ? Date.parse(j.activationEndTime) : NaN;
        return {
          success: true,
          id: String(j.activationId),
          number: String(j.phoneNumber),
          cost: Number(j.activationCost) || undefined,
          endsAt: Number.isFinite(end) ? end : undefined,
        };
      }
      return { success: false, error: parseHeroError(r.text) };
    } catch (err: any) {
      console.error("Hero-SMS getRentNumber error:", err);
      return { success: false, error: err.message || "Bağlantı hatası" };
    }
  },

  /**
   * Kiralanan numaraya gelen tüm SMS'ler (action=getAllSms).
   * notActive: sağlayıcıda kiralama bitti/iptal edildi (ACTIVATION_NOT_ACTIVE).
   * unknown: yanıt alınamadı; karar verilmemeli.
   */
  async getAllSms(activationId: string): Promise<{ items: RentSms[]; notActive?: boolean; unknown?: boolean; raw?: string }> {
    if (activationId.startsWith("mock_")) {
      const existing = db.getActivation(activationId);
      const elapsed = existing ? (Date.now() - existing.createdAt) / 1000 : 0;
      if (elapsed < 12) return { items: [] };
      const code = existing?.smsCode && existing.smsCode !== "SMS" ? existing.smsCode : `${Math.floor(100000 + Math.random() * 900000)}`;
      return {
        items: [{ id: "mock1", from: "Test", code, text: `Your code is ${code}`, date: new Date().toISOString(), type: "sms" }],
      };
    }
    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getAllSms&id=${encodeURIComponent(activationId)}&size=50&page=1&api_key=${apiKey}`;
    try {
      const r = await heroJson(url);
      if (r.ok && Array.isArray(r.json?.data)) {
        const items: RentSms[] = r.json.data.map((m: any) => ({
          id: String(m.id ?? ""),
          from: String(m.phoneFrom ?? ""),
          code: m.code != null && String(m.code).trim() ? String(m.code).trim() : null,
          text: m.text != null && String(m.text).trim() ? String(m.text) : null,
          date: String(m.date ?? ""),
          type: String(m.type ?? "sms"),
        }));
        // En yeni SMS başta
        items.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
        return { items, raw: r.text };
      }
      const code = parseHeroError(r.text);
      if (code === "ACTIVATION_NOT_ACTIVE") return { items: [], notActive: true, raw: r.text };
      return { items: [], unknown: true, raw: r.text };
    } catch (err: any) {
      console.error("Hero-SMS getAllSms error:", err);
      return { items: [], unknown: true, raw: err.message };
    }
  },

  /** Kiralamayı iptal et (action=cancelActivation, başarı: HTTP 204). Kural: SMS gelmediyse ve ilk 20 dk içinde. */
  async cancelActivation(activationId: string): Promise<{ success: boolean; error?: string; raw: string }> {
    if (activationId.startsWith("mock_")) return { success: true, raw: "" };
    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=cancelActivation&id=${encodeURIComponent(activationId)}&api_key=${apiKey}`;
    try {
      const r = await heroJson(url);
      if (r.ok && (r.status === 204 || r.status === 200)) return { success: true, raw: r.text };
      return { success: false, error: parseHeroError(r.text), raw: r.text };
    } catch (err: any) {
      console.error("Hero-SMS cancelActivation error:", err);
      return { success: false, error: "NETWORK", raw: err.message };
    }
  },

  /** Kiralamayı sağlayıcıda sonlandır (action=finishActivation, başarı: HTTP 204). */
  async finishActivation(activationId: string): Promise<{ success: boolean; raw: string }> {
    if (activationId.startsWith("mock_")) return { success: true, raw: "" };
    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=finishActivation&id=${encodeURIComponent(activationId)}&api_key=${apiKey}`;
    try {
      const r = await heroJson(url);
      return { success: r.ok, raw: r.text };
    } catch (err: any) {
      return { success: false, raw: err.message };
    }
  },

  /**
   * Hero-SMS hesap bakiyesini çeker
   */
  async getBalance(): Promise<{ balance: number; raw: string }> {
    const apiKey = getHeroApiKey();
    if (!apiKey) {
      return { balance: 0, raw: "NO_API_KEY" };
    }
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getBalance&api_key=${apiKey}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      // Format: ACCESS_BALANCE:0.00
      if (text.startsWith("ACCESS_BALANCE:")) {
        const val = parseFloat(text.replace("ACCESS_BALANCE:", "").trim());
        return { balance: isNaN(val) ? 0 : val, raw: text };
      }
      return { balance: 0, raw: text };
    } catch (err: any) {
      console.error("Hero-SMS getBalance error:", err);
      return { balance: 0, raw: err.message || "Network Error" };
    }
  },

  /**
   * Ülke listesini çeker ve bayrak / öncelik bilgileriyle zenginleştirir
   */
  async getCountries(): Promise<Country[]> {
    const now = Date.now();
    if (cachedCountries && now - countriesCacheTime < 3600000) {
      return cachedCountries;
    }

    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getCountries&api_key=${apiKey}`;
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      const data = await res.json();
      
      const list: Country[] = [];
      for (const key of Object.keys(data)) {
        const item = data[key];
        const id = Number(item.id || key);
        const meta = getCountryMeta(id, item.eng);
        list.push({
          id,
          eng: item.eng || `Country ${id}`,
          nameTr: meta.nameTr || item.eng || `Country ${id}`,
          rus: item.rus,
          chn: item.chn,
          visible: item.visible !== undefined ? item.visible : 1,
          flag: meta.flag,
          priority: meta.priority,
        });
      }

      // Sort by priority (Turkey, USA, etc. at the top)
      list.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      cachedCountries = list;
      countriesCacheTime = now;
      return list;
    } catch (err) {
      console.error("Hero-SMS getCountries error:", err);
      // Fallback essential countries with 100% accurate flags and Turkish names
      return [
        { id: 62, eng: "Turkey", nameTr: "Türkiye", flag: "🇹🇷", priority: 100 },
        { id: 187, eng: "USA", nameTr: "ABD", flag: "🇺🇸", priority: 95 },
        { id: 16, eng: "United Kingdom", nameTr: "İngiltere", flag: "🇬🇧", priority: 95 },
        { id: 43, eng: "Germany", nameTr: "Almanya", flag: "🇩🇪", priority: 90 },
        { id: 0, eng: "Russia", nameTr: "Rusya", flag: "🇷🇺", priority: 85 },
        { id: 48, eng: "Netherlands", nameTr: "Hollanda", flag: "🇳🇱", priority: 85 },
        { id: 6, eng: "Indonesia", nameTr: "Endonezya", flag: "🇮🇩", priority: 85 },
        { id: 73, eng: "Brazil", nameTr: "Brezilya", flag: "🇧🇷", priority: 80 },
        { id: 2, eng: "Kazakhstan", nameTr: "Kazakistan", flag: "🇰🇿", priority: 75 },
        { id: 1, eng: "Ukraine", nameTr: "Ukrayna", flag: "🇺🇦", priority: 70 },
      ];
    }
  },

  /**
   * Servis listesini çeker
   */
  async getServicesList(): Promise<ServiceItem[]> {
    const now = Date.now();
    if (cachedServices && now - servicesCacheTime < 3600000) {
      return cachedServices;
    }

    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getServicesList&api_key=${apiKey}`;
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      const data = await res.json();
      
      const rawServices: any[] = data.services || [];
      const list: ServiceItem[] = rawServices.map((s) => {
        const meta = SERVICE_ICONS[s.code] || { icon: "other", category: "Genel", priority: 10 };
        return {
          code: s.code,
          name: s.name,
          category: meta.category,
          icon: meta.icon,
        };
      });

      cachedServices = list;
      servicesCacheTime = now;
      return list;
    } catch (err) {
      console.error("Hero-SMS getServicesList error:", err);
      return [
        { code: "wa", name: "WhatsApp", category: "Mesajlaşma", icon: "whatsapp" },
        { code: "tg", name: "Telegram", category: "Mesajlaşma", icon: "telegram" },
        { code: "dr", name: "OpenAI / ChatGPT", category: "Yapay Zeka", icon: "openai" },
        { code: "go", name: "Google / Gmail", category: "E-Posta & Arama", icon: "google" },
        { code: "ig", name: "Instagram / Threads", category: "Sosyal Medya", icon: "instagram" },
        { code: "ds", name: "Discord", category: "Oyun & Topluluk", icon: "discord" },
        { code: "fb", name: "Facebook", category: "Sosyal Medya", icon: "facebook" },
        { code: "lf", name: "TikTok", category: "Sosyal Medya", icon: "tiktok" },
        { code: "tw", name: "Twitter / X", category: "Sosyal Medya", icon: "twitter" },
        { code: "ot", name: "Diğer Servisler", category: "Genel", icon: "other" },
      ];
    }
  },

  /**
   * Canlı fiyatları ve stok adetlerini çeker
   */
  async getPrices(countryId?: number): Promise<Record<string, Record<string, PriceStockItem>>> {
    const now = Date.now();
    // 30 saniye boyunca önbellekten anında sun (sıfır gecikme)
    if (countryId !== undefined) {
      const cached = cachedCountryPrices[countryId];
      if (cached && now - cached.time < 30000) {
        return cached.data;
      }
    } else if (cachedPrices && now - pricesCacheTime < 30000) {
      return cachedPrices;
    }

    const apiKey = getHeroApiKey();
    let url = `${CONFIG.HERO_SMS_BASE_URL}?action=getPrices&api_key=${apiKey}`;
    if (countryId !== undefined) {
      url += `&country=${countryId}`;
    }

    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (countryId !== undefined) {
        cachedCountryPrices[countryId] = { data, time: now };
      } else {
        cachedPrices = data;
        pricesCacheTime = now;
      }
      return data;
    } catch (err) {
      console.error("Hero-SMS getPrices error:", err);
      if (countryId !== undefined && cachedCountryPrices[countryId]) {
        return cachedCountryPrices[countryId].data;
      }
      return cachedPrices || {};
    }
  },

  /**
   * Tek servisin tüm ülkelerdeki fiyat ve stokları (action=getPrices&service=..., USD).
   * Yanıt getPrices ile aynı biçimdedir: { ülkeId: { servis: { cost, count, physicalCount } } }. 30 sn önbellek.
   */
  async getServicePrices(service: string): Promise<Record<string, Record<string, PriceStockItem>>> {
    const now = Date.now();
    const cached = cachedServicePrices[service];
    if (cached && now - cached.time < 30000) return cached.data;
    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getPrices&service=${encodeURIComponent(service)}&api_key=${apiKey}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      const map = data && typeof data === "object" && !Array.isArray(data) ? data : {};
      cachedServicePrices[service] = { data: map, time: now };
      return map;
    } catch (err) {
      console.error("Hero-SMS getPrices(service) error:", err);
      return cached?.data || {};
    }
  },

  /**
   * Numara Kiralama (action=getNumber)
   */
  async getNumber(service: string, country: number): Promise<{ success: boolean; id?: string; number?: string; error?: string }> {
    const settings = db.getSettings();

    // Check if Mock Mode is enabled
    if (settings.mockMode) {
      return this.simulateGetNumber(service, country);
    }

    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getNumber&service=${service}&country=${country}&api_key=${apiKey}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      
      // Expected success format: ACCESS_NUMBER:12345678:79123456789
      if (text.startsWith("ACCESS_NUMBER:")) {
        const parts = text.split(":");
        return {
          success: true,
          id: parts[1],
          number: parts[2],
        };
      }

      // Hata: düz metin (NO_NUMBERS) veya JSON ({"title":"NO_BALANCE"}) → tek koda çevir
      return {
        success: false,
        error: parseHeroError(text),
      };
    } catch (err: any) {
      console.error("Hero-SMS getNumber error:", err);
      return { success: false, error: err.message || "Bağlantı hatası" };
    }
  },

  /**
   * SMS Durumunu Sorgula (action=getStatus)
   */
  async getStatus(activationId: string): Promise<{
    status: "WAIT_CODE" | "RECEIVED" | "CANCELLED" | "COMPLETED";
    code?: string;
    raw: string;
    /** Yanıt tanınmadı (hata/ağ sorunu): durum bilinmiyor, karar verilmemeli */
    unknown?: boolean;
  }> {
    // If this is a mock activation
    if (activationId.startsWith("mock_")) {
      return this.simulateGetStatus(activationId);
    }

    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getStatus&id=${activationId}&api_key=${apiKey}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();

      // STATUS_OK:123456 — kod geldi
      if (text.startsWith("STATUS_OK:")) {
        const code = text.replace("STATUS_OK:", "").trim();
        return { status: "RECEIVED", code, raw: text };
      }

      // STATUS_WAIT_RETRY:123456 — bir kod geldi, yeni kod bekleniyor (gelen kod geçerli)
      if (text.startsWith("STATUS_WAIT_RETRY:")) {
        const code = text.replace("STATUS_WAIT_RETRY:", "").trim();
        if (code) return { status: "RECEIVED", code, raw: text };
        return { status: "WAIT_CODE", raw: text };
      }

      // STATUS_WAIT_CODE, STATUS_WAIT_RESEND — henüz kod yok
      if (text.startsWith("STATUS_WAIT")) {
        return { status: "WAIT_CODE", raw: text };
      }

      // STATUS_CANCEL — sağlayıcıda iptal edildi (ücret bize iade edildi)
      if (text.includes("STATUS_CANCEL")) {
        return { status: "CANCELLED", raw: text };
      }

      // Hata veya tanınmayan yanıt (BAD_KEY, NO_ACTIVATION, JSON hata...): durum bilinmiyor
      return { status: "WAIT_CODE", raw: text, unknown: true };
    } catch (err: any) {
      console.error("Hero-SMS getStatus error:", err);
      return { status: "WAIT_CODE", raw: err.message || "Error", unknown: true };
    }
  },

  /**
   * Aktivasyon İptal Et (status=8) veya Tamamla (status=6)
   */
  /** status: 3 = SMS'i tekrar iste, 6 = tamamla, 8 = iptal et (ücret iadesi) */
  async setStatus(activationId: string, status: 3 | 6 | 8): Promise<{ success: boolean; raw: string }> {
    if (activationId.startsWith("mock_")) {
      return { success: true, raw: status === 8 ? "ACCESS_CANCEL" : "ACCESS_ACTIVATION" };
    }

    const apiKey = getHeroApiKey();
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=setStatus&status=${status}&id=${activationId}&api_key=${apiKey}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      // Belgeye göre başarı yanıtları: 8 → ACCESS_CANCEL, 6 → ACCESS_ACTIVATION, 3 → ACCESS_RETRY_GET
      const expected = status === 8 ? "ACCESS_CANCEL" : status === 6 ? "ACCESS_ACTIVATION" : "ACCESS_RETRY_GET";
      return {
        success: text.trim().startsWith(expected),
        raw: text,
      };
    } catch (err: any) {
      console.error("Hero-SMS setStatus error:", err);
      return { success: false, raw: err.message };
    }
  },

  /**
   * Mock / Simülasyon Metotları (Sağlayıcı bakiyesi 0 iken veya test aşamasında kusursuz deneme imkanı)
   */
  simulateGetNumber(service: string, country: number): { success: boolean; id: string; number: string } {
    const mockId = `mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const prefixes: Record<number, string> = {
      62: "+9053",
      12: "+1202",
      16: "+4479",
      43: "+4915",
      53: "+3162",
      6: "+6281",
      50: "+5511",
      2: "+7705",
      1: "+3809",
    };
    const prefix = prefixes[country] || "+9054";
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
    const mockNumber = `${prefix}${randomSuffix}`;

    return {
      success: true,
      id: mockId,
      number: mockNumber,
    };
  },

  simulateGetStatus(activationId: string): { status: "WAIT_CODE" | "RECEIVED" | "CANCELLED" | "COMPLETED"; code?: string; raw: string } {
    const existing = db.getActivation(activationId);
    if (!existing) {
      return { status: "WAIT_CODE", raw: "STATUS_WAIT_CODE" };
    }

    if (existing.status === "RECEIVED" && existing.smsCode) {
      return { status: "RECEIVED", code: existing.smsCode, raw: `STATUS_OK:${existing.smsCode}` };
    }

    if (existing.status === "CANCELLED") {
      return { status: "CANCELLED", raw: "STATUS_CANCEL" };
    }

    // If 12 seconds have passed since creation in mock mode, generate realistic OTP code
    const elapsedSeconds = (Date.now() - existing.createdAt) / 1000;
    if (elapsedSeconds >= 12) {
      const otp = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
      return { status: "RECEIVED", code: otp, raw: `STATUS_OK:${otp}` };
    }

    return { status: "WAIT_CODE", raw: "STATUS_WAIT_CODE" };
  },
};
