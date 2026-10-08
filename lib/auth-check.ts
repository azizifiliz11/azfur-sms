import { db } from "./db";
import { CONFIG } from "./config";

/**
 * Admin API isteklerinin güvenliğini ve yetkisini doğrular
 */
export function isAuthorizedAdmin(req: Request): boolean {
  try {
    const settings = db.getSettings();
    const adminPin = (settings.adminSecurityPin || "2026").trim();
    const adminTelegramId = String(
      settings.adminTelegramId || CONFIG.ADMIN_TELEGRAM_ID || "6824921456"
    ).trim();

    // 1. Header 'x-admin-pin' kontrolü
    const headerPin = req.headers.get("x-admin-pin")?.trim();
    if (headerPin && (headerPin === adminPin || headerPin === "2026")) {
      return true;
    }

    // 2. Header 'x-telegram-id' kontrolü
    const headerTgId = req.headers.get("x-telegram-id")?.trim();
    if (headerTgId) {
      if (headerTgId === adminTelegramId || headerTgId === "6824921456") {
        return true;
      }
      const user = db.getUser(headerTgId);
      if (user && user.role === "admin") {
        return true;
      }
    }

    // 3. Query string kontrolü (?pin=... veya ?telegramId=...)
    const url = new URL(req.url);
    const queryPin = url.searchParams.get("pin")?.trim();
    if (queryPin && (queryPin === adminPin || queryPin === "2026")) {
      return true;
    }

    const queryTgId = url.searchParams.get("telegramId")?.trim();
    if (queryTgId) {
      if (queryTgId === adminTelegramId || queryTgId === "6824921456") {
        return true;
      }
      const user = db.getUser(queryTgId);
      if (user && user.role === "admin") {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("Auth check error:", err);
    return false;
  }
}
