"use client";

/**
 * Uygulamanın kendi /api/ isteklerine Telegram'ın imzaladığı oturum verisini (initData) ekler.
 * Sunucu, kullanıcı kimliğini istemcinin gönderdiği telegramId yerine bu imzadan doğrular
 * (lib/request-auth.ts). Modül yüklendiği anda bir kez kurulur; bileşen efektlerinden önce çalışır.
 */
export const INIT_DATA_HEADER = "x-telegram-init-data";

export function getTelegramInitData(): string {
  try {
    return (window as any).Telegram?.WebApp?.initData || "";
  } catch {
    return "";
  }
}

function isOwnApiRequest(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

if (typeof window !== "undefined" && !(window as any).__azfurAuthFetch) {
  (window as any).__azfurAuthFetch = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const initData = getTelegramInitData();
    if (!initData || !isOwnApiRequest(input)) return originalFetch(input, init);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has(INIT_DATA_HEADER)) headers.set(INIT_DATA_HEADER, initData);
    return originalFetch(input, { ...init, headers });
  };
}
