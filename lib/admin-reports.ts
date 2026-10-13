import { db, getSqlClient } from "./db";
import { heroSms } from "./hero-sms";
import { getApironeConfig } from "./apirone";
import { APIRONE_PAYMENT_OPTIONS } from "./crypto-currencies";

/** Kayıtlı kur (₺/USD) */
function rate(): number {
  const s = db.getSettings();
  return Number(s.exchangeRateToTry || s.lastTcmbRate || 49.2);
}

const SUCCESS = ["RECEIVED", "COMPLETED"];
const REFUNDED = ["CANCELLED", "TIMEOUT"];

// ---------------------------------------------------------------------------
// Dönemsel özet (günlük rapor ve genel bakış)
// ---------------------------------------------------------------------------
export async function buildPeriodSummary(hours: number) {
  const empty = { orders: 0, succeeded: 0, refunded: 0, revenue: 0, profit: 0, deposits: 0, depositCount: 0, newUsers: 0, totalUserBalance: 0 };
  const sql = getSqlClient();
  if (!sql) return empty;
  const sinceMs = Date.now() - hours * 3600 * 1000;
  const since = new Date(sinceMs);
  const [ord, dep, usr, bal] = (await Promise.all([
    sql`SELECT status, COUNT(*) AS c, COALESCE(SUM(charged_price), 0) AS revenue, COALESCE(SUM(original_cost), 0) AS cost
        FROM activations WHERE created_at >= ${sinceMs} GROUP BY status`,
    sql`SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS total FROM deposits
        WHERE status = 'APPROVED' AND COALESCE(approved_at, created_at) >= ${since}`,
    sql`SELECT COUNT(*) AS c FROM users WHERE created_at >= ${since}`,
    sql`SELECT COALESCE(SUM(balance), 0) AS total FROM users`,
  ])) as any[];
  const r = rate();
  const out = { ...empty };
  for (const row of ord) {
    const c = Number(row.c) || 0;
    out.orders += c;
    if (SUCCESS.includes(row.status)) {
      out.succeeded += c;
      out.revenue += Number(row.revenue) || 0;
      out.profit += (Number(row.revenue) || 0) - (Number(row.cost) || 0) * r;
    } else if (REFUNDED.includes(row.status)) {
      out.refunded += c;
    }
  }
  out.deposits = Number(dep[0]?.total) || 0;
  out.depositCount = Number(dep[0]?.c) || 0;
  out.newUsers = Number(usr[0]?.c) || 0;
  out.totalUserBalance = Number(bal[0]?.total) || 0;
  return out;
}

// ---------------------------------------------------------------------------
// Kasa mutabakatı
// ---------------------------------------------------------------------------
export async function getReconciliation() {
  const sql = getSqlClient();
  const r = rate();
  const [balRows, pendingRows, hero, apirone] = await Promise.all([
    sql ? sql`SELECT COALESCE(SUM(balance), 0) AS total, COUNT(*) FILTER (WHERE balance > 0) AS holders FROM users` : Promise.resolve([] as any[]),
    sql ? sql`SELECT COALESCE(SUM(charged_price), 0) AS total, COUNT(*) AS c FROM activations WHERE status = 'WAIT_CODE'` : Promise.resolve([] as any[]),
    heroSms.getBalance(),
    getApironeBalances(),
  ]) as [any[], any[], { balance: number; raw: string }, Awaited<ReturnType<typeof getApironeBalances>>];

  const totalUserBalance = Number(balRows[0]?.total) || 0;
  const holders = Number(balRows[0]?.holders) || 0;
  const pendingOrdersTry = Number(pendingRows[0]?.total) || 0;
  const pendingOrders = Number(pendingRows[0]?.c) || 0;
  const heroOk = hero.raw.startsWith("ACCESS_BALANCE:");
  const heroUsd = heroOk ? hero.balance : null;
  const heroTry = heroUsd !== null ? heroUsd * r : null;

  const warnings: string[] = [];
  if (!heroOk) warnings.push(`Hero-SMS bakiyesi okunamadı (${hero.raw.slice(0, 80)}).`);
  if (heroTry !== null && heroTry < totalUserBalance * 0.5) {
    warnings.push(
      `Sağlayıcı kasası (≈₺${heroTry.toFixed(2)}) kullanıcı bakiyelerinin (₺${totalUserBalance.toFixed(2)}) yarısından az. Kullanıcılar bakiyelerini harcamaya kalkarsa kasa yetmeyebilir.`
    );
  }
  if (heroUsd !== null && heroUsd < (Number((db.getSettings() as any).alertSettings?.providerBalanceMin) || 5)) {
    warnings.push(`Sağlayıcı kasası düşük: $${heroUsd.toFixed(2)}. Numara satışı durabilir.`);
  }

  return {
    exchangeRate: r,
    totalUserBalance,
    holders,
    pendingOrdersTry,
    pendingOrders,
    heroUsd,
    heroTry,
    apirone,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

async function getApironeBalances(): Promise<{ ok: boolean; items: { currency: string; label: string; available: number; total: number }[]; error?: string }> {
  try {
    const { account } = getApironeConfig();
    if (!account) return { ok: false, items: [], error: "Apirone hesabı tanımlı değil" };
    const res = await fetch(`https://apirone.com/api/v2/accounts/${encodeURIComponent(account)}/balance`, { cache: "no-store" });
    if (!res.ok) return { ok: false, items: [], error: `Apirone yanıtı: HTTP ${res.status}` };
    const data = await res.json();
    const list: any[] = Array.isArray(data?.balance) ? data.balance : [];
    const items = list
      .map((b) => {
        const opt = APIRONE_PAYMENT_OPTIONS.find((o: any) => o.currency === b.currency);
        const factor = opt?.unitsFactor ?? 1;
        return {
          currency: String(b.currency),
          label: opt ? `${opt.coin} (${opt.networkLabel})` : String(b.currency).toUpperCase(),
          available: (Number(b.available) || 0) * factor,
          total: (Number(b.total) || 0) * factor,
        };
      })
      .filter((b) => b.total > 0 || b.available > 0);
    return { ok: true, items };
  } catch (err: any) {
    return { ok: false, items: [], error: err.message || "Apirone bakiyesi okunamadı" };
  }
}

// ---------------------------------------------------------------------------
// Kâr ve başarı analizi (servis × ülke)
// ---------------------------------------------------------------------------
export async function getProfitAnalysis(days = 30) {
  const sql = getSqlClient();
  if (!sql) return { days, rows: [], totals: null };
  const sinceMs = Date.now() - days * 24 * 3600 * 1000;
  const rows = (await sql`
    SELECT service_code, MAX(service_name) AS service_name, country_id, MAX(country_name) AS country_name,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status IN ('RECEIVED', 'COMPLETED')) AS succeeded,
           COUNT(*) FILTER (WHERE status IN ('CANCELLED', 'TIMEOUT')) AS refunded,
           COUNT(*) FILTER (WHERE status = 'WAIT_CODE') AS waiting,
           COALESCE(SUM(charged_price) FILTER (WHERE status IN ('RECEIVED', 'COMPLETED')), 0) AS revenue,
           COALESCE(SUM(original_cost) FILTER (WHERE status IN ('RECEIVED', 'COMPLETED')), 0) AS cost_usd
    FROM activations
    WHERE created_at >= ${sinceMs}
    GROUP BY service_code, country_id
    ORDER BY total DESC
    LIMIT 300
  `) as any[];

  const r = rate();
  const hidden = new Set<string>(((db.getSettings() as any).hiddenServiceCountryPairs as string[]) || []);
  const mapped = rows.map((row) => {
    const total = Number(row.total) || 0;
    const succeeded = Number(row.succeeded) || 0;
    const refunded = Number(row.refunded) || 0;
    const finished = succeeded + refunded;
    const revenue = Number(row.revenue) || 0;
    const cost = (Number(row.cost_usd) || 0) * r;
    const key = `${row.service_code}:${row.country_id}`;
    return {
      key,
      serviceCode: row.service_code,
      serviceName: row.service_name || row.service_code,
      countryId: Number(row.country_id),
      countryName: row.country_name || `Ülke ${row.country_id}`,
      total,
      succeeded,
      refunded,
      waiting: Number(row.waiting) || 0,
      revenue,
      cost,
      profit: revenue - cost,
      successRate: finished > 0 ? Math.round((succeeded / finished) * 100) : null,
      hidden: hidden.has(key),
    };
  });
  const totals = mapped.reduce(
    (acc, m) => ({
      total: acc.total + m.total,
      succeeded: acc.succeeded + m.succeeded,
      refunded: acc.refunded + m.refunded,
      revenue: acc.revenue + m.revenue,
      cost: acc.cost + m.cost,
      profit: acc.profit + m.profit,
    }),
    { total: 0, succeeded: 0, refunded: 0, revenue: 0, cost: 0, profit: 0 }
  );
  return { days, rows: mapped, totals };
}

// ---------------------------------------------------------------------------
// Kullanıcı bakiye hareketleri (tek zaman çizelgesi)
// ---------------------------------------------------------------------------
export interface LedgerEntry {
  at: string;
  type: "deposit" | "deposit_pending" | "deposit_rejected" | "order" | "refund" | "coupon" | "admin";
  amount: number; // + bakiyeye ekleme, − düşüm, 0 bilgi
  title: string;
  detail: string;
}

export async function getUserLedger(telegramId: number): Promise<LedgerEntry[]> {
  const sql = getSqlClient();
  if (!sql) return [];
  const id = BigInt(telegramId);
  const [deps, acts, logs] = (await Promise.all([
    sql`SELECT * FROM deposits WHERE telegram_id = ${id} ORDER BY created_at DESC LIMIT 200`,
    sql`SELECT * FROM activations WHERE telegram_id = ${id} ORDER BY created_at DESC LIMIT 300`,
    sql`SELECT * FROM logs WHERE action IN ('COUPON_REDEEMED', 'BALANCE_MANUAL_ADJUST')
          AND (metadata->>'telegramId') = ${String(telegramId)} ORDER BY timestamp DESC LIMIT 200`,
  ])) as any[];

  const entries: LedgerEntry[] = [];
  for (const d of deps) {
    const amount = parseFloat(d.amount) || 0;
    const status = d.status || "PENDING";
    entries.push({
      at: new Date(d.approved_at || d.created_at).toISOString(),
      type: status === "APPROVED" ? "deposit" : status === "REJECTED" ? "deposit_rejected" : "deposit_pending",
      amount: status === "APPROVED" ? amount : 0,
      title: status === "APPROVED" ? "Bakiye yükleme" : status === "REJECTED" ? "Yükleme reddedildi" : "Yükleme bekliyor",
      detail: `${d.method || ""} • ₺${amount.toFixed(2)}${d.tx_id ? ` • ${String(d.tx_id).slice(0, 18)}` : ""}`,
    });
  }
  for (const a of acts) {
    const price = parseFloat(a.charged_price) || 0;
    const at = new Date(Number(a.created_at) || Date.now()).toISOString();
    const label = `${a.service_name || a.service_code} • ${a.country_name || ""} • ${a.phone_number || ""}`;
    entries.push({ at, type: "order", amount: -price, title: "Numara satın alma", detail: label });
    if (REFUNDED.includes(a.status)) {
      entries.push({
        at: new Date((Number(a.created_at) || Date.now()) + 1).toISOString(),
        type: "refund",
        amount: price,
        title: a.status === "TIMEOUT" ? "İade (süre doldu)" : "İade (iptal)",
        detail: label,
      });
    }
  }
  for (const l of logs) {
    const meta = typeof l.metadata === "string" ? JSON.parse(l.metadata) : l.metadata || {};
    if (l.action === "COUPON_REDEEMED") {
      entries.push({
        at: new Date(l.timestamp).toISOString(),
        type: "coupon",
        amount: Number(meta.bonus) || 0,
        title: Number(meta.bonus) ? "Kupon bakiyesi" : "İndirim kuponu tanımlandı",
        detail: `Kod: ${meta.code || ""}`,
      });
    } else {
      const delta = meta.delta !== undefined ? Number(meta.delta) : null;
      entries.push({
        at: new Date(l.timestamp).toISOString(),
        type: "admin",
        amount: delta ?? 0,
        title: delta !== null ? "Yönetici düzeltmesi" : `Yönetici bakiyeyi ₺${Number(meta.newBalance || 0).toFixed(2)} yaptı`,
        detail: meta.reason ? `Gerekçe: ${meta.reason}` : "",
      });
    }
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------------------
// Gelişmiş kullanıcı arama: ID, kullanıcı adı/isim, telefon numarası, TXID
// ---------------------------------------------------------------------------
export async function searchUserIds(q: string): Promise<number[]> {
  const query = q.trim();
  if (!query) return [];
  const ids = new Set<number>();
  const lower = query.toLowerCase().replace(/^@/, "");

  for (const u of db.getAllUsers()) {
    if (
      String(u.telegramId) === query ||
      (u.username && u.username.toLowerCase().includes(lower)) ||
      [u.firstName, u.lastName].filter(Boolean).join(" ").toLowerCase().includes(lower)
    ) {
      ids.add(Number(u.telegramId));
    }
  }

  const sql = getSqlClient();
  if (sql) {
    const digits = query.replace(/[^0-9]/g, "");
    const tasks: Promise<any[]>[] = [];
    if (digits.length >= 6) {
      tasks.push(sql`SELECT DISTINCT telegram_id FROM activations WHERE regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"} LIMIT 50` as any);
    }
    if (/^[a-f0-9]{16,}$/i.test(query)) {
      tasks.push(sql`SELECT DISTINCT telegram_id FROM deposits WHERE LOWER(tx_id) LIKE ${"%" + lower + "%"} OR LOWER(id) LIKE ${"%" + lower + "%"} LIMIT 50` as any);
    }
    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "fulfilled") for (const row of r.value) ids.add(Number(row.telegram_id));
    }
  }
  return [...ids].slice(0, 100);
}
