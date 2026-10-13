import type { SystemSettings } from "./types";

/**
 * Admin paneline gizli anahtarlar açık metin gönderilmez; yalnızca son 4 karakteri görünür.
 * Panel maskeli değeri geri gönderirse (alan değiştirilmediyse) sunucu kayıtlı gerçek değeri kullanır.
 */
export const SECRET_MASK_PREFIX = "••••";

export function maskSecret(value: string | undefined | null): string {
  const v = (value || "").trim();
  if (!v) return "";
  return `${SECRET_MASK_PREFIX}${v.slice(-4)}`;
}

export function isMasked(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(SECRET_MASK_PREFIX);
}

/** Maskeliyse kayıtlı değeri, değilse gönderilen değeri döndürür. */
export function unmask(value: unknown, stored: string | undefined | null): any {
  return isMasked(value) ? stored || "" : value;
}

export function maskSettings(settings: SystemSettings): SystemSettings {
  const cs = settings.cryptoSettings;
  return {
    ...settings,
    heroSmsApiKey: maskSecret(settings.heroSmsApiKey),
    adminSecurityPin: maskSecret(settings.adminSecurityPin),
    cryptoSettings: cs
      ? {
          ...cs,
          apironeTransferKey: maskSecret(cs.apironeTransferKey),
          oxapayApiKey: maskSecret(cs.oxapayApiKey),
          cryptoBotToken: maskSecret((cs as any).cryptoBotToken),
        }
      : cs,
  } as SystemSettings;
}

/** İstek gövdesindeki maskeli gizli alanları kayıtlı gerçek değerlerle değiştirir (yerinde). */
export function unmaskSettingsBody(body: any, stored: SystemSettings): void {
  if (!body || typeof body !== "object") return;
  const cs = stored.cryptoSettings || ({} as any);
  if ("heroSmsApiKey" in body) body.heroSmsApiKey = unmask(body.heroSmsApiKey, stored.heroSmsApiKey);
  if ("adminSecurityPin" in body) body.adminSecurityPin = unmask(body.adminSecurityPin, stored.adminSecurityPin);
  if ("transferKey" in body) body.transferKey = unmask(body.transferKey, cs.apironeTransferKey);
  if ("key" in body) body.key = unmask(body.key, cs.oxapayApiKey);
  if (body.cryptoSettings && typeof body.cryptoSettings === "object") {
    const c = body.cryptoSettings;
    if ("apironeTransferKey" in c) c.apironeTransferKey = unmask(c.apironeTransferKey, cs.apironeTransferKey);
    if ("oxapayApiKey" in c) c.oxapayApiKey = unmask(c.oxapayApiKey, cs.oxapayApiKey);
    if ("cryptoBotToken" in c) c.cryptoBotToken = unmask(c.cryptoBotToken, cs.cryptoBotToken);
  }
}
