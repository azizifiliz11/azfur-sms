import crypto from "crypto";
import { CONFIG } from "./config";
import { db } from "./db";

export const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

/**
 * Telegram webhook gizli anahtarı. Bot token'ından türetilir (ayrı ortam değişkeni gerekmez);
 * token değişirse anahtar da değişir. Telegram her güncellemede bunu başlıkta gönderir.
 */
export function getWebhookSecret(): string {
  return crypto
    .createHmac("sha256", CONFIG.TELEGRAM_BOT_TOKEN || "no-token")
    .update("azfur-webhook-secret-v1")
    .digest("hex");
}

export function isValidWebhookSecret(header: string | null): boolean {
  if (!header) return false;
  const expected = Buffer.from(getWebhookSecret());
  const given = Buffer.from(header);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function getWebhookUrl(): string {
  return `${CONFIG.APP_URL.replace(/\/+$/, "")}/api/bot/webhook`;
}

let lastRegisterAttempt = 0;

/**
 * Webhook'u gizli anahtarla Telegram'a kaydeder. Başarılı olunca anahtarsız güncellemeler reddedilir.
 * Örnek başına en fazla dakikada bir denenir.
 */
export async function registerWebhookWithSecret(options: { url?: string; dropPending?: boolean } = {}) {
  const token = CONFIG.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "Bot token tanımlı değil" };
  const params = new URLSearchParams({
    url: options.url || getWebhookUrl(),
    secret_token: getWebhookSecret(),
    max_connections: "100",
    drop_pending_updates: options.dropPending ? "true" : "false",
  });
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({ ok: false }));
  if (data.ok) {
    await db.updateSettings({ webhookSecretActive: true });
  }
  return data;
}

export async function registerWebhookWithSecretThrottled() {
  const now = Date.now();
  if (now - lastRegisterAttempt < 60_000) return;
  lastRegisterAttempt = now;
  try {
    const result = await registerWebhookWithSecret();
    console.log("[Webhook] Gizli anahtarlı kayıt:", result.ok ? "başarılı" : result.description);
  } catch (err) {
    console.error("[Webhook] Gizli anahtarlı kayıt hatası:", err);
  }
}
