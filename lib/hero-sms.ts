import { CONFIG } from "./config";
import { Country, ServiceItem, PriceStockItem } from "./types";
import { db } from "./db";

// In-memory cache for countries and services to keep API calls blazing fast
let cachedCountries: Country[] | null = null;
let countriesCacheTime = 0;

let cachedServices: ServiceItem[] | null = null;
let servicesCacheTime = 0;

let cachedPrices: Record<string, Record<string, PriceStockItem>> | null = null;
let pricesCacheTime = 0;

// Flag and prefix helper
const COUNTRY_METADATA: Record<number, { flag: string; phonePrefix: string; priority: number }> = {
  0: { flag: "🇷🇺", phonePrefix: "7", priority: 80 },
  1: { flag: "🇺🇦", phonePrefix: "380", priority: 70 },
  2: { flag: "🇰🇿", phonePrefix: "77", priority: 75 },
  3: { flag: "🇨🇳", phonePrefix: "86", priority: 50 },
  4: { flag: "🇵🇭", phonePrefix: "63", priority: 60 },
  5: { flag: "🇲🇲", phonePrefix: "95", priority: 40 },
  6: { flag: "🇮🇩", phonePrefix: "62", priority: 85 },
  7: { flag: "🇲🇾", phonePrefix: "60", priority: 70 },
  10: { flag: "🇻🇳", phonePrefix: "84", priority: 75 },
  12: { flag: "🇺🇸", phonePrefix: "1", priority: 95 },
  13: { flag: "🇮🇱", phonePrefix: "972", priority: 50 },
  14: { flag: "🇭🇰", phonePrefix: "852", priority: 65 },
  15: { flag: "🇵🇱", phonePrefix: "48", priority: 70 },
  16: { flag: "🇬🇧", phonePrefix: "44", priority: 95 },
  22: { flag: "🇮🇳", phonePrefix: "91", priority: 80 },
  36: { flag: "🇨🇦", phonePrefix: "1", priority: 85 },
  43: { flag: "🇩🇪", phonePrefix: "49", priority: 90 },
  50: { flag: "🇧🇷", phonePrefix: "55", priority: 80 },
  53: { flag: "🇳🇱", phonePrefix: "31", priority: 85 },
  62: { flag: "🇹🇷", phonePrefix: "90", priority: 100 }, // Türkiye highest priority
  73: { flag: "🇧🇷", phonePrefix: "55", priority: 75 },
  78: { flag: "🇫🇷", phonePrefix: "33", priority: 90 },
  187: { flag: "🇺🇸", phonePrefix: "1", priority: 90 },
};

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

export const heroSms = {
  /**
   * Hero-SMS hesap bakiyesini çeker
   */
  async getBalance(): Promise<{ balance: number; raw: string }> {
    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getBalance&api_key=${CONFIG.HERO_SMS_API_KEY}`;
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

    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getCountries&api_key=${CONFIG.HERO_SMS_API_KEY}`;
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      const data = await res.json();
      
      const list: Country[] = [];
      for (const key of Object.keys(data)) {
        const item = data[key];
        const id = Number(item.id || key);
        const meta = COUNTRY_METADATA[id] || { flag: "🌐", phonePrefix: "", priority: 10 };
        list.push({
          id,
          eng: item.eng || `Country ${id}`,
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
      // Fallback essential countries
      return [
        { id: 62, eng: "Turkey", flag: "🇹🇷", priority: 100 },
        { id: 12, eng: "USA", flag: "🇺🇸", priority: 95 },
        { id: 16, eng: "United Kingdom", flag: "🇬🇧", priority: 95 },
        { id: 43, eng: "Germany", flag: "🇩🇪", priority: 90 },
        { id: 53, eng: "Netherlands", flag: "🇳🇱", priority: 85 },
        { id: 6, eng: "Indonesia", flag: "🇮🇩", priority: 85 },
        { id: 50, eng: "Brazil", flag: "🇧🇷", priority: 80 },
        { id: 2, eng: "Kazakhstan", flag: "🇰🇿", priority: 75 },
        { id: 1, eng: "Ukraine", flag: "🇺🇦", priority: 70 },
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

    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getServicesList&api_key=${CONFIG.HERO_SMS_API_KEY}`;
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
    // Cache for 30 seconds for live stock performance
    if (cachedPrices && now - pricesCacheTime < 30000 && !countryId) {
      return cachedPrices;
    }

    let url = `${CONFIG.HERO_SMS_BASE_URL}?action=getPrices&api_key=${CONFIG.HERO_SMS_API_KEY}`;
    if (countryId !== undefined) {
      url += `&country=${countryId}`;
    }

    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!countryId) {
        cachedPrices = data;
        pricesCacheTime = now;
      }
      return data;
    } catch (err) {
      console.error("Hero-SMS getPrices error:", err);
      return cachedPrices || {};
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

    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getNumber&service=${service}&country=${country}&api_key=${CONFIG.HERO_SMS_API_KEY}`;
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

      // If user has NO_BALANCE in Hero-SMS and wants smooth demo, let's check
      if (text.includes("NO_BALANCE") || text.includes("NO_NUMBERS")) {
        // Return clear error or fallback if mock mode requested
        return {
          success: false,
          error: text,
        };
      }

      return {
        success: false,
        error: text || "Bilinmeyen API cevabı",
      };
    } catch (err: any) {
      console.error("Hero-SMS getNumber error:", err);
      return { success: false, error: err.message || "Bağlantı hatası" };
    }
  },

  /**
   * SMS Durumunu Sorgula (action=getStatus)
   */
  async getStatus(activationId: string): Promise<{ status: "WAIT_CODE" | "RECEIVED" | "CANCELLED" | "COMPLETED"; code?: string; raw: string }> {
    // If this is a mock activation
    if (activationId.startsWith("mock_")) {
      return this.simulateGetStatus(activationId);
    }

    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getStatus&id=${activationId}&api_key=${CONFIG.HERO_SMS_API_KEY}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();

      // STATUS_WAIT_CODE, STATUS_WAIT_RETRY
      if (text.startsWith("STATUS_WAIT_")) {
        return { status: "WAIT_CODE", raw: text };
      }

      // STATUS_OK:123456
      if (text.startsWith("STATUS_OK:")) {
        const code = text.replace("STATUS_OK:", "").trim();
        return { status: "RECEIVED", code, raw: text };
      }

      // STATUS_CANCEL
      if (text.includes("STATUS_CANCEL")) {
        return { status: "CANCELLED", raw: text };
      }

      return { status: "WAIT_CODE", raw: text };
    } catch (err: any) {
      console.error("Hero-SMS getStatus error:", err);
      return { status: "WAIT_CODE", raw: err.message || "Error" };
    }
  },

  /**
   * Aktivasyon İptal Et (status=8) veya Tamamla (status=6)
   */
  async setStatus(activationId: string, status: 6 | 8): Promise<{ success: boolean; raw: string }> {
    if (activationId.startsWith("mock_")) {
      return { success: true, raw: status === 8 ? "ACCESS_CANCEL" : "ACCESS_ACTIVATION" };
    }

    const url = `${CONFIG.HERO_SMS_BASE_URL}?action=setStatus&status=${status}&id=${activationId}&api_key=${CONFIG.HERO_SMS_API_KEY}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      return {
        success: text.includes("ACCESS_") || text.includes("STATUS_"),
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
