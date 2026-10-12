import crypto from "crypto";

export interface VerifiedTelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

/**
 * Telegram Mini App `initData` imzasını doğrular.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * İstemcinin gönderdiği telegramId'ye güvenmek yerine, Telegram'ın bot token'ı ile imzaladığı
 * veriden kullanıcıyı çıkarır. Böylece başkasının numara/ödeme geçmişi istenemez.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60
): VerifiedTelegramUser | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  try {
    const user = JSON.parse(params.get("user") || "null");
    if (!user || !Number.isFinite(Number(user.id))) return null;
    return { ...user, id: Number(user.id) };
  } catch {
    return null;
  }
}
