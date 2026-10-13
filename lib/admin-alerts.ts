import { db, getSqlClient } from "./db";
import { heroSms } from "./hero-sms";
import type { DepositRequest } from "./types";

/**
 * Yöneticilere bot üzerinden otomatik uyarılar ve günlük özet.
 * Eşikler admin panelindeki ayarlardan (alertSettings) okunur; aynı uyarı farklı sunucusuz
 * örneklerden tekrar tekrar gitmesin diye son gönderim zamanı veritabanında tutulur.
 */
export interface AlertSettings {
  enabled: boolean;
  providerBalanceMin: number; // Sağlayıcı (Hero-SMS) kasası bu değerin (USD) altına inerse
  refundsPerHour: number; // Bir kullanıcı 1 saatte bu kadar iptal/iade alırsa
  largeDepositTry: number; // Bu tutar (₺) ve üzeri tek yükleme
  couponFailsPer10Min: number; // Bir kullanıcının 10 dakikada başarısız kupon denemesi
  dailyReportEnabled: boolean;
  dailyReportHour: number; // Türkiye saatiyle 0-23
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: true,
  providerBalanceMin: 5,
  refundsPerHour: 5,
  largeDepositTry: 2000,
  couponFailsPer10Min: 5,
  dailyReportEnabled: true,
  dailyReportHour: 9,
};

export function getAlertSettings(): AlertSettings {
  return { ...DEFAULT_ALERT_SETTINGS, ...((db.getSettings() as any).alertSettings || {}) };
}

const memoryAlertState = new Map<string, number>();
let tableReady: Promise<void> | null = null;

/** Bu anahtar için son gönderimden bu yana `intervalMs` geçtiyse true döner ve zamanı atomik olarak işaretler. */
async function claimAlert(key: string, intervalMs: number): Promise<boolean> {
  const sql = getSqlClient();
  if (!sql) {
    const last = memoryAlertState.get(key) || 0;
    if (Date.now() - last < intervalMs) return false;
    memoryAlertState.set(key, Date.now());
    return true;
  }
  try {
    if (!tableReady) {
      tableReady = (async () => {
        await sql`CREATE TABLE IF NOT EXISTS admin_alert_state (key TEXT PRIMARY KEY, last_sent TIMESTAMPTZ NOT NULL)`;
      })().catch((e) => {
        tableReady = null;
        throw e;
      });
    }
    await tableReady;
    const seconds = Math.floor(intervalMs / 1000);
    const rows = (await sql`
      INSERT INTO admin_alert_state (key, last_sent) VALUES (${key}, NOW())
      ON CONFLICT (key) DO UPDATE SET last_sent = NOW()
      WHERE admin_alert_state.last_sent < NOW() - make_interval(secs => ${seconds})
      RETURNING key
    `) as any[];
    return rows.length > 0;
  } catch (err) {
    console.error("[AdminAlerts] Durum okunamadı:", err);
    return false;
  }
}

export async function sendAdminAlert(text: string): Promise<void> {
  const { sendTelegramDirectMessage } = await import("./telegram-bot");
  const ids = db.getAdminTelegramIds();
  await Promise.allSettled(ids.map((id) => sendTelegramDirectMessage(id, text, "HTML")));
}

const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, "");
function userLabel(telegramId: number): string {
  const u = db.getUser(telegramId);
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
  return `${esc(name || "Kullanıcı")}${u?.username ? ` (@${esc(u.username)})` : ""} — <code>${telegramId}</code>`;
}

/** Sağlayıcı kasası eşiğin altındaysa uyar (en fazla 6 saatte bir). */
export async function checkProviderBalanceAlert(): Promise<void> {
  const cfg = getAlertSettings();
  if (!cfg.enabled || db.getSettings().mockMode) return;
  const { balance, raw } = await heroSms.getBalance();
  // Ağ/anahtar hatasında bakiye 0 döner: yalnızca geçerli yanıtta uyar (yanlış alarm olmasın)
  if (!raw.startsWith("ACCESS_BALANCE:") || balance >= cfg.providerBalanceMin) return;
  if (!(await claimAlert("provider-balance-low", 6 * 3600 * 1000))) return;
  await sendAdminAlert(
    `⚠️ <b>SAĞLAYICI KASASI DÜŞÜK</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `Hero-SMS bakiyesi: <code>$${balance.toFixed(2)}</code> (eşik: $${cfg.providerBalanceMin})\n\n` +
      `Kasa biterse kullanıcılar numara alamaz. Lütfen Hero-SMS hesabına bakiye yükleyin.`
  );
}

/** Bir kullanıcı kısa sürede çok iptal/iade aldıysa uyar (kullanıcı başına 6 saatte bir). */
export async function checkRefundBurst(telegramId: number): Promise<void> {
  const cfg = getAlertSettings();
  if (!cfg.enabled || cfg.refundsPerHour <= 0) return;
  const sql = getSqlClient();
  if (!sql) return;
  try {
    const since = Date.now() - 3600 * 1000;
    const rows = (await sql`
      SELECT COUNT(*) AS count FROM activations
      WHERE telegram_id = ${BigInt(telegramId)} AND status IN ('CANCELLED', 'TIMEOUT') AND created_at >= ${since}
    `) as any[];
    const count = Number(rows[0]?.count) || 0;
    if (count < cfg.refundsPerHour) return;
    if (!(await claimAlert(`refund-burst-${telegramId}`, 6 * 3600 * 1000))) return;
    await sendAdminAlert(
      `🚩 <b>ŞÜPHELİ İŞLEM: ÇOK SAYIDA İADE</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 ${userLabel(telegramId)}\n` +
        `↩️ Son 1 saatte <b>${count}</b> iptal/iade (eşik: ${cfg.refundsPerHour}).\n\n` +
        `<i>Admin paneli → Siparişler sekmesinden inceleyebilirsiniz.</i>`
    );
  } catch (err) {
    console.error("[AdminAlerts] İade kontrolü hatası:", err);
  }
}

/** Büyük tutarlı yükleme onaylandığında uyar. */
export async function checkLargeDeposit(dep: DepositRequest): Promise<void> {
  const cfg = getAlertSettings();
  if (!cfg.enabled || cfg.largeDepositTry <= 0 || dep.amount < cfg.largeDepositTry) return;
  if (!(await claimAlert(`large-deposit-${dep.id}`, 365 * 24 * 3600 * 1000))) return;
  await sendAdminAlert(
    `💰 <b>BÜYÜK YÜKLEME ONAYLANDI</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 ${userLabel(dep.telegramId)}\n` +
      `Tutar: <code>₺${dep.amount.toFixed(2)}</code> (${esc(dep.method)}) — eşik: ₺${cfg.largeDepositTry}`
  );
}

// Başarısız kupon denemeleri: örnek belleğinde kayan pencere (uyarı tekrarı veritabanıyla engellenir)
const couponFails = new Map<number, number[]>();
export async function recordCouponFailure(telegramId: number, code: string): Promise<void> {
  const cfg = getAlertSettings();
  if (!cfg.enabled || cfg.couponFailsPer10Min <= 0) return;
  const now = Date.now();
  const list = (couponFails.get(telegramId) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  couponFails.set(telegramId, list);
  if (list.length < cfg.couponFailsPer10Min) return;
  if (!(await claimAlert(`coupon-fails-${telegramId}`, 3600 * 1000))) return;
  await sendAdminAlert(
    `🚩 <b>ŞÜPHELİ İŞLEM: KUPON DENEMESİ</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 ${userLabel(telegramId)}\n` +
      `10 dakikada <b>${list.length}</b> başarısız kupon denemesi (son denenen: <code>${esc(code).slice(0, 30)}</code>).`
  );
}

function istanbulParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** Günlük özet: Türkiye saatiyle belirlenen saatte, günde bir kez. */
export async function maybeSendDailyReport(): Promise<void> {
  const cfg = getAlertSettings();
  if (!cfg.dailyReportEnabled) return;
  const { day, hour } = istanbulParts();
  if (hour < cfg.dailyReportHour) return;
  if (!(await claimAlert(`daily-report-${day}`, 20 * 3600 * 1000))) return;
  const { buildPeriodSummary } = await import("./admin-reports");
  const s = await buildPeriodSummary(24);
  await sendAdminAlert(
    `📊 <b>GÜNLÜK ÖZET</b> (${day}, son 24 saat)\n━━━━━━━━━━━━━━━━━━━━\n` +
      `🛒 Sipariş: <b>${s.orders}</b> (başarılı ${s.succeeded}, iade ${s.refunded})\n` +
      `💵 Ciro: <code>₺${s.revenue.toFixed(2)}</code>\n` +
      `📈 Tahmini net kâr: <code>₺${s.profit.toFixed(2)}</code>\n` +
      `💳 Onaylanan yükleme: <code>₺${s.deposits.toFixed(2)}</code> (${s.depositCount} adet)\n` +
      `👥 Yeni kullanıcı: <b>${s.newUsers}</b>\n` +
      `🏦 Kullanıcı bakiyeleri toplamı: <code>₺${s.totalUserBalance.toFixed(2)}</code>`
  );
}

/** Zamanlanmış bakımda (trafik + saatlik cron) çağrılır. */
export async function runAdminAlertChecks(): Promise<void> {
  await Promise.allSettled([checkProviderBalanceAlert(), maybeSendDailyReport()]);
}
