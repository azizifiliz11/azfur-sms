/**
 * Yüksek Performanslı Bellek-İçi Kayan Pencere (Sliding Window) Rate Limiter
 * Mini App API ve Bot Güvenliği için Aşırı İstek Koruması Sağlar.
 */

interface RateLimitRecord {
  timestamps: number[];
}

class InMemoryRateLimiter {
  private storage: Map<string, RateLimitRecord> = new Map();
  private lastCleanup: number = Date.now();

  /**
   * İstek sınırını kontrol eder
   * @param key Telegram ID, IP veya eylem anahtarı (Örn: "order_7619776444" veya "ip_127.0.0.1")
   * @param maxRequests İzin verilen maksimum istek sayısı
   * @param windowSeconds Zaman penceresi (saniye cinsinden)
   * @returns { allowed: boolean, remaining: number, retryAfterSeconds: number }
   */
  check(key: string, maxRequests: number, windowSeconds: number): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const threshold = now - windowMs;

    // Bellek temizliği (10 dakikada bir eski kayıtları uçur)
    if (now - this.lastCleanup > 600000) {
      this.cleanup(threshold);
      this.lastCleanup = now;
    }

    let record = this.storage.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.storage.set(key, record);
    }

    // Pencere dışındaki eski zaman damgalarını filtrele
    record.timestamps = record.timestamps.filter((ts) => ts > threshold);

    if (record.timestamps.length >= maxRequests) {
      const oldestInWindow = record.timestamps[0];
      const retryAfterMs = Math.max(1000, oldestInWindow + windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: maxRequests - record.timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  private cleanup(threshold: number): void {
    for (const [key, record] of this.storage.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > threshold);
      if (record.timestamps.length === 0) {
        this.storage.delete(key);
      }
    }
  }
}

export const rateLimiter = new InMemoryRateLimiter();

/**
 * Next.js API Route Yardımcısı: İstek için rate limit doğrulaması yapar
 */
export function checkApiRateLimit(
  req: Request,
  actionKey: string,
  maxRequests: number = 20,
  windowSeconds: number = 10
): { allowed: boolean; retryAfterSeconds: number; error?: string } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "client";

  const key = `${actionKey}:${ip}`;
  const result = rateLimiter.check(key, maxRequests, windowSeconds);

  if (!result.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: result.retryAfterSeconds,
      error: `Çok fazla istek gönderdiniz! Lütfen ${result.retryAfterSeconds} saniye bekleyiniz.`,
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
