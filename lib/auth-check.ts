import { db } from "./db";
import { getVerifiedTelegramUser } from "./request-auth";

export interface AdminAuthResult {
  authorized: boolean;
  status: number;
  error?: string;
  remainingAttempts?: number;
  retryAfter?: number;
  clientIp: string;
}

interface RateLimitRecord {
  failedAttempts: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

// In-memory rate limiting map for brute-force protection
const pinRateLimits = new Map<string, RateLimitRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 dakika
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 dakika kilit

/**
 * İstekten istemci IP adresini çıkartır
 */
export function getClientIp(req: Request): string {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    const cfIp = req.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();
  } catch {}
  return "127.0.0.1";
}

/**
 * Brute-force saldırılarına karşı korumalı Admin kimlik doğrulaması
 */
export function checkAdminAuthWithRateLimit(req: Request): AdminAuthResult {
  const ip = getClientIp(req);
  const now = Date.now();

  let record = pinRateLimits.get(ip);
  if (!record) {
    record = { failedAttempts: 0, firstAttemptAt: now, lockedUntil: 0 };
    pinRateLimits.set(ip, record);
  }

  // 1. IP şu anda kilitli mi? (Bruteforce kilidi kontrolü)
  if (record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    const minutesRemaining = Math.max(1, Math.ceil(retryAfter / 60));
    return {
      authorized: false,
      status: 429,
      error: `Çok fazla hatalı PIN denemesi yapıldı (Brute-force koruması). Sistem güvenliği için erişiminiz ${minutesRemaining} dakika kilitlenmiştir. Lütfen bekleyin.`,
      retryAfter,
      remainingAttempts: 0,
      clientIp: ip,
    };
  }

  // Kilit süresi dolmuşsa veya zaman penceresi aşılmışsa sıfırla
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    record.failedAttempts = 0;
    record.lockedUntil = 0;
    record.firstAttemptAt = now;
  } else if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    record.failedAttempts = 0;
    record.firstAttemptAt = now;
  }

  try {
    const settings = db.getSettings();
    const adminPin = (settings.adminSecurityPin || "").trim();
    const allowedPins = adminPin ? [adminPin] : [];

    const headerPin = req.headers.get("x-admin-pin")?.trim();

    let queryPin: string | null = null;
    try {
      queryPin = new URL(req.url).searchParams.get("pin")?.trim() || null;
    } catch {}

    const providedPin = headerPin || queryPin;

    let isAuthorized = false;

    // PIN Kontrolü
    if (providedPin && allowedPins.includes(providedPin)) {
      isAuthorized = true;
    }

    // Telegram kimliği: yalnızca Telegram'ın imzaladığı initData ile (x-telegram-id / ?telegramId gibi
    // istemcinin yazdığı düz değerler artık kabul edilmez; herkes bir yöneticinin ID'sini yazabilirdi)
    if (!isAuthorized) {
      const verified = getVerifiedTelegramUser(req);
      if (verified && db.isAdmin(verified.id)) {
        isAuthorized = true;
      }
    }

    if (isAuthorized) {
      // Başarılı giriş: Başarısız deneme sayısını sıfırla
      pinRateLimits.delete(ip);
      return {
        authorized: true,
        status: 200,
        clientIp: ip,
      };
    }

    // Yetkilendirme başarısız oldu -> Başarısız deneme sayısını artır
    record.failedAttempts += 1;

    // 5. hatalı denemede brute-force kilitlemesi uygula
    if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      const retryAfter = Math.ceil(LOCKOUT_DURATION_MS / 1000);
      return {
        authorized: false,
        status: 429,
        error: "Hatalı PIN deneme limiti aşıldı! Sistem güvenliği ve brute-force koruması nedeniyle IP adresiniz 15 dakika kilitlendi.",
        retryAfter,
        remainingAttempts: 0,
        clientIp: ip,
      };
    }

    const remainingAttempts = MAX_FAILED_ATTEMPTS - record.failedAttempts;
    return {
      authorized: false,
      status: 403,
      error: `Yetkisiz Erişim! Yönetici PIN kodu gereklidir. (Kalan deneme hakkı: ${remainingAttempts})`,
      remainingAttempts,
      clientIp: ip,
    };
  } catch (err: any) {
    console.error("Auth check error:", err);
    return {
      authorized: false,
      status: 500,
      error: "Yetkilendirme sırasında hata oluştu",
      clientIp: ip,
    };
  }
}

/**
 * Geriye dönük uyumluluk için boolean döndüren standart admin kontrolü
 */
export async function isAuthorizedAdmin(req: Request): Promise<boolean> {
  await db.syncFromCloud();
  return checkAdminAuthWithRateLimit(req).authorized;
}

export type StaffRole = "admin" | "support";

/**
 * Yönetici veya destek görevlisi (role: "support"). Destek görevlisi yalnızca destek taleplerine erişir;
 * kimlik Telegram'ın imzaladığı initData ile belirlenir.
 */
export async function getStaffRole(req: Request): Promise<StaffRole | null> {
  await db.syncFromCloud();
  // Önce imzalı kimlik: destek görevlisinin istekleri PIN kaba kuvvet sayacına yazılmasın
  const verified = getVerifiedTelegramUser(req);
  if (verified) {
    if (db.isAdmin(verified.id)) return "admin";
    if (db.getUser(verified.id)?.role === "support") return "support";
  }
  return checkAdminAuthWithRateLimit(req).authorized ? "admin" : null;
}
