import { db } from "./db";
import { pricingEngine } from "./pricing";
import type { RentPriceMap } from "./hero-sms";
import type { Country } from "./types";

export const RENT_SERVICE_CODE = "full";
export const RENT_SERVICE_NAME = "Full rent (Tam kiralama)";

export interface RentDurationOffer {
  hours: number;
  label: string;
  stock: number;
  priceTry: number;
  costUsd: number;
}

export interface RentCountryOffer {
  countryId: number;
  countryName: string;
  countryEng: string;
  flag: string;
  durations: RentDurationOffer[];
}

export function rentDurationLabel(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "1 gün" : `${days} gün`;
  }
  return `${hours} saat`;
}

/** Maliyet (USD) → satış fiyatı (TL). Genel motorla aynı yuvarlama: 0.10 ₺ yukarı, en az 3 ₺. */
export function computeRentPrice(costUsd: number, marginPercent: number, fixedFee: number, rate: number): number {
  const price = costUsd * rate * (1 + marginPercent / 100) + fixedFee;
  return Number(Math.max(3.0, Math.ceil(price * 10) / 10).toFixed(2));
}

export function getRentRate(): number {
  const s = db.getSettings();
  return s.exchangeRateToTry || s.lastTcmbRate || 49.2;
}

/** Kiralamada geçerli marj ve kaynağı: kiralamaya özel ayar → "full" servis marjı → genel marj */
export function getEffectiveRentMargin(): { marginPercent: number; fixedFee: number; source: "rent" | "service" | "global" } {
  const s = db.getSettings();
  const rp = s.rentPricing;
  if (rp && Number.isFinite(Number(rp.marginPercent))) {
    return { marginPercent: Number(rp.marginPercent), fixedFee: Number(rp.fixedFee) || 0, source: "rent" };
  }
  const svc = s.serviceCustomMargins?.[RENT_SERVICE_CODE];
  if (svc && (svc.marginPercent !== undefined || svc.fixedFee !== undefined)) {
    return {
      marginPercent: svc.marginPercent !== undefined ? Number(svc.marginPercent) : s.globalMarginPercent,
      fixedFee: svc.fixedFee !== undefined ? Number(svc.fixedFee) : s.globalFixedFee,
      source: "service",
    };
  }
  return { marginPercent: s.globalMarginPercent, fixedFee: s.globalFixedFee, source: "global" };
}

/**
 * Kiralama satış fiyatı. Admin panelindeki "Full rent kâr marjı" ayarı varsa o, yoksa genel marj uygulanır.
 * Ülke+servis manuel kuralları (sabit TL fiyat) süreden bağımsız olduğu için kullanılmaz.
 */
export function rentPriceTry(costUsd: number): number {
  const s = db.getSettings();
  if (s.rentPricing && Number.isFinite(Number(s.rentPricing.marginPercent))) {
    const m = getEffectiveRentMargin();
    return computeRentPrice(costUsd, m.marginPercent, m.fixedFee, getRentRate());
  }
  return pricingEngine.calculatePrice(costUsd, RENT_SERVICE_CODE).finalPriceTry;
}

/** Sağlayıcı fiyat haritasını, admin gizleme ayarlarına uyarak ülke/süre tekliflerine çevirir. */
export function getRentOffers(prices: RentPriceMap, countries: Country[]): RentCountryOffer[] {
  const settings = db.getSettings();
  if (settings.hiddenServices?.includes(RENT_SERVICE_CODE)) return [];
  const hiddenCountries = new Set((settings.hiddenCountries || []).map(Number));
  const hiddenPairs = new Set(settings.hiddenServiceCountryPairs || []);
  const byId = new Map(countries.map((c) => [Number(c.id), c]));

  const offers: RentCountryOffer[] = [];
  for (const [cid, durs] of Object.entries(prices || {})) {
    const countryId = Number(cid);
    if (!Number.isFinite(countryId) || hiddenCountries.has(countryId)) continue;
    if (hiddenPairs.has(`${RENT_SERVICE_CODE}:${countryId}`)) continue;
    const durations: RentDurationOffer[] = [];
    for (const [h, v] of Object.entries(durs || {})) {
      const hours = Number(h);
      const cost = Number(v?.price);
      const stock = Number(v?.count) || 0;
      if (!Number.isFinite(hours) || hours <= 0 || !(cost > 0) || stock <= 0) continue;
      durations.push({ hours, label: rentDurationLabel(hours), stock, priceTry: rentPriceTry(cost), costUsd: cost });
    }
    if (durations.length === 0) continue;
    durations.sort((a, b) => a.hours - b.hours);
    const c = byId.get(countryId);
    offers.push({
      countryId,
      countryName: c?.nameTr || c?.eng || `Ülke ${countryId}`,
      countryEng: c?.eng || "",
      flag: c?.flag || "🌐",
      durations,
    });
  }
  // Stoğu bol ve ucuz olan önde
  offers.sort((a, b) => b.durations[0].stock - a.durations[0].stock);
  return offers;
}
