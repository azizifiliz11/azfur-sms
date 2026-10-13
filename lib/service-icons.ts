import manifest from "./service-icons.json";

/**
 * Servis simgeleri Hero-SMS'in kendi CDN'indeki görsellerdir ({kod}0.webp). Bilinenler
 * scripts/fetch-service-icons.mjs ile public/services/{kod}.webp olarak projeye indirilir;
 * Hero-SMS'te de simgesi olmayan servisler, sitedeki gibi baş harf rozetiyle gösterilir.
 */
const HERO_SMS_ICON_CDN = "https://cdn.hero-sms.com/assets/img/service";

const AVAILABLE = new Set<string>(manifest.available);
const MISSING = new Set<string>(manifest.missing);

/**
 * Bir servis için denenecek simge adresleri (sırayla). Boş dizi: simge yok, baş harf gösterilmeli.
 * Manifestte olmayan (sonradan eklenmiş) servisler doğrudan Hero-SMS CDN'inden denenir.
 */
export function serviceIconSources(code: string | undefined | null): string[] {
  const c = String(code || "").trim().toLowerCase();
  if (!c || !/^[a-z0-9_]+$/.test(c)) return [];
  if (AVAILABLE.has(c)) return [`/services/${c}.webp`, `${HERO_SMS_ICON_CDN}/${c}0.webp`];
  if (MISSING.has(c)) return [];
  return [`${HERO_SMS_ICON_CDN}/${c}0.webp`];
}

/** Simgesi olmayan servis için rozet harfi (Hero-SMS'teki gibi adın ilk harfi). */
export function serviceInitial(name: string | undefined | null, code?: string | null): string {
  const source = String(name || code || "?");
  const match = source.match(/[\p{L}\p{N}]/u);
  return (match ? match[0] : "?").toLocaleUpperCase("tr-TR");
}
