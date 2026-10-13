"use client";

/** Admin API çağrısı: Telegram imzalı oturum başlığı lib/telegram-fetch.ts tarafından otomatik eklenir. */
export async function adminApi<T = any>(url: string, body?: unknown): Promise<T & { success: boolean; error?: string; message?: string }> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
  return json;
}

export const tryFmt = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(Number(n)) ? "—" : `₺${Number(n).toFixed(2)}`;

const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function fmtDate(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

export function fmtAgo(v: string | number | null | undefined): string {
  if (!v) return "—";
  const ms = Date.now() - new Date(v).getTime();
  if (!Number.isFinite(ms)) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} sa ${min % 60} dk`;
  return `${Math.floor(h / 24)} gün`;
}
