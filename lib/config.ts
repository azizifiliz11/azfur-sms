function resolveAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.startsWith("https://")) {
    const normalizedUrl = envUrl.replace(/\/$/, "");
    const hostname = new URL(normalizedUrl).hostname.toLowerCase();
    const temporaryHost =
      hostname.endsWith(".loca.lt") ||
      hostname.endsWith(".trycloudflare.com") ||
      hostname.endsWith(".ngrok-free.app") ||
      hostname.endsWith(".ngrok.io");

    // A public bot must never send users to a developer tunnel that can go offline.
    if (!(process.env.NODE_ENV === "production" && temporaryHost)) {
      return normalizedUrl;
    }
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Canlı Vercel adresi
  return "https://azfur-sms.vercel.app";
}

export const CONFIG = {
  HERO_SMS_API_KEY: process.env.HERO_SMS_API_KEY || "e1006858662edcAd8d348c9f07dfe8c5",
  HERO_SMS_BASE_URL: process.env.HERO_SMS_BASE_URL || "https://hero-sms.com/stubs/handler_api.php",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID || "8614398114",
  APP_URL: resolveAppUrl(),
};
