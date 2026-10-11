import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import {
  User,
  ActivationOrder,
  SystemSettings,
  DepositRequest,
  Ticket,
  TicketMessage,
  TicketStatus,
  Coupon,
  SystemBackup,
  BackupSettings,
  SystemLog,
  LogCategory,
  LogLevel,
} from "./types";

export interface DatabaseSchema {
  settings: SystemSettings;
  users: Record<string, User>;
  activations: Record<string, ActivationOrder>;
  deposits: DepositRequest[];
  tickets: Record<string, Ticket>;
  coupons?: Record<string, Coupon>;
  backups?: SystemBackup[];
  logs?: SystemLog[];
}

const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "db.json")
  : path.join(process.cwd(), "data", "db.json");

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoBackupEnabled: true,
  autoBackupIntervalHours: 6,
  maxBackupsCount: 20,
  lastAutoBackupTime: undefined,
  lastBackupAt: undefined,
  lastBackupTime: undefined,
  deletedBackupIds: [],
};

const DEFAULT_SETTINGS: SystemSettings = {
  globalMarginPercent: 35, // %35 kar
  globalFixedFee: 5.0, // +5 TL sabit
  exchangeRateToTry: 49.20, // USD to TRY
  useTcmbAutoRate: true, // TCMB'den otomatik kur
  tcmbUpdateIntervalMinutes: 30,
  lastTcmbRate: 49.20,
  lastTcmbFetchTime: "",
  lastTcmbAttemptTime: "",
  currencySymbol: "₺",
  mockMode: false, // Default to live API
  adminTelegramId: "",
  adminTelegramIds: [],
  adminSecurityPin: "",
  hiddenServices: [],
  hiddenCountries: [],
  serviceCustomMargins: {},
  customPriceRules: {},
  bankInfo: {
    bankName: "Ziraat Bankası",
    accountHolder: "AzFur SMS",
    iban: "TR00 0000 0000 0000 0000 0000 00",
    descriptionNote: "Açıklama alanına Telegram ID'nizi yazmayı unutmayınız.",
  },
  cryptoSettings: {
    usdtTrc20Address: "",
    trxAddress: "",
    apironeAccount: "",
    apironeTransferKey: "",
    callbackUrl: "",
    oxapayApiKey: "",
    cryptoBotToken: "",
    autoVerifyEnabled: true,
  },
  supportTelegramUsername: "",
  supportTelegramUsernames: [],
  customStickerFileId: "",
  heroSmsApiKey: "",
  backupSettings: DEFAULT_BACKUP_SETTINGS,
  useBannerPhoto: true,
  vipSettings: {
    defaultDiscountPercent: 15,
    autoVipOnDepositAmount: 500,
    enabled: true,
  },
  maintenanceMode: false,
  maintenanceMessage: "",
};

const DEFAULT_KV_URL = "https://communal-bengal-212625.upstash.io";
const DEFAULT_KV_TOKEN = "gQAAAAAAAz6RAAIgcDE4YjExNzIzNGIzODI0YmNiYWNhNWE3NWU1ZWU5YWU2MA";

const KV_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.STORAGE_REST_API_URL ||
  process.env.STORAGE_URL ||
  process.env.UPSTASH_REDIS_URL ||
  DEFAULT_KV_URL;

const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.STORAGE_REST_API_TOKEN ||
  process.env.STORAGE_TOKEN ||
  process.env.UPSTASH_REDIS_TOKEN ||
  DEFAULT_KV_TOKEN;

const KV_KEY = "azfur_sms_db_v1";
const KV_APIRONE_KEY = "azfur_sms_apirone_creds";

const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "postgresql://neondb_owner:npg_F3ZvuyiU5abt@ep-dry-feather-bacqjppv-pooler.c-8.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

let sqlClient: ReturnType<typeof neon> | null = null;
function getSql() {
  if (!sqlClient && POSTGRES_URL) {
    try {
      sqlClient = neon(POSTGRES_URL);
    } catch (e) {
      console.error("[Postgres Init Error]:", e);
    }
  }
  return sqlClient;
}

async function saveUserToSql(u: User): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    const tgId = BigInt(u.telegramId);
    await sql`
      INSERT INTO users (
        telegram_id, username, first_name, last_name, balance, spent,
        role, is_banned, is_vip, vip_since, vip_expires_at, vip_discount_percent,
        vip_note, active_discount, created_at, last_active_at
      )
      VALUES (
        ${tgId},
        ${u.username || ""},
        ${u.firstName || ""},
        ${u.lastName || ""},
        ${Number(u.balance) || 0},
        ${Number(u.spent) || 0},
        ${u.role || "user"},
        ${Boolean(u.isBanned)},
        ${Boolean(u.isVip)},
        ${u.vipSince ? new Date(u.vipSince) : null},
        ${u.vipExpiresAt ? new Date(u.vipExpiresAt) : null},
        ${u.vipDiscountPercent || null},
        ${u.vipNote || null},
        ${u.activeDiscount ? JSON.stringify(u.activeDiscount) : null},
        ${u.createdAt ? new Date(u.createdAt) : new Date()},
        ${u.lastActiveAt ? new Date(u.lastActiveAt) : new Date()}
      )
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        balance = EXCLUDED.balance,
        spent = EXCLUDED.spent,
        role = EXCLUDED.role,
        is_banned = EXCLUDED.is_banned,
        is_vip = EXCLUDED.is_vip,
        vip_since = EXCLUDED.vip_since,
        vip_expires_at = EXCLUDED.vip_expires_at,
        vip_discount_percent = EXCLUDED.vip_discount_percent,
        vip_note = EXCLUDED.vip_note,
        active_discount = EXCLUDED.active_discount,
        last_active_at = EXCLUDED.last_active_at;
    `;
  } catch (err) {
    console.error("[PostgreSQL saveUser Error]:", err);
  }
}

async function saveSettingsToSql(settings: SystemSettings): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    await sql`
      INSERT INTO system_settings (id, data, updated_at)
      VALUES (1, ${JSON.stringify(settings)}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW();
    `;
    return true;
  } catch (err) {
    console.error("[PostgreSQL saveSettings Error]:", err);
    return false;
  }
}

async function saveActivationToSql(a: ActivationOrder): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`
      INSERT INTO activations (
        id, telegram_id, service_code, service_name, country_id,
        country_name, country_flag, phone_number, original_cost, charged_price,
        status, sms_code, sms_text, created_at, expires_at, notified_bot
      )
      VALUES (
        ${a.id},
        ${BigInt(a.telegramId)},
        ${a.serviceCode || ""},
        ${a.serviceName || ""},
        ${Number(a.countryId) || 0},
        ${a.countryName || ""},
        ${a.countryFlag || ""},
        ${a.phoneNumber || ""},
        ${Number(a.originalCost) || 0},
        ${Number(a.chargedPrice) || 0},
        ${a.status || "WAIT_CODE"},
        ${a.smsCode || null},
        ${a.smsText || null},
        ${a.createdAt || Date.now()},
        ${a.expiresAt || Date.now() + 15 * 60 * 1000},
        ${Boolean(a.notifiedBot)}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        sms_code = EXCLUDED.sms_code,
        sms_text = EXCLUDED.sms_text,
        notified_bot = EXCLUDED.notified_bot;
    `;
  } catch (err) {
    console.error("[PostgreSQL saveActivation Error]:", err);
  }
}

async function saveDepositToSql(d: DepositRequest): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    const anyD = d as any;
    await sql`
      INSERT INTO deposits (
        id, telegram_id, amount, method, status, receipt_url,
        tx_id, invoice_id, currency, crypto_amount, created_at, approved_at
      )
      VALUES (
        ${d.id},
        ${BigInt(d.telegramId)},
        ${Number(d.amount) || 0},
        ${d.method || "BANK"},
        ${d.status || "PENDING"},
        ${anyD.receiptUrl || null},
        ${d.txid || anyD.txId || null},
        ${anyD.invoiceId || null},
        ${anyD.currency || "TRY"},
        ${anyD.cryptoAmount ? Number(anyD.cryptoAmount) : null},
        ${d.createdAt ? new Date(d.createdAt) : new Date()},
        ${anyD.approvedAt ? new Date(anyD.approvedAt) : null}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        approved_at = EXCLUDED.approved_at,
        tx_id = COALESCE(EXCLUDED.tx_id, deposits.tx_id);
    `;
  } catch (err) {
    console.error("[PostgreSQL saveDeposit Error]:", err);
  }
}

async function saveTicketToSql(t: Ticket): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`
      INSERT INTO tickets (
        id, telegram_id, subject, status, messages, created_at, updated_at
      )
      VALUES (
        ${t.id},
        ${BigInt(t.telegramId)},
        ${t.subject || "Destek Talebi"},
        ${t.status || "OPEN"},
        ${JSON.stringify(t.messages || [])},
        ${t.createdAt ? new Date(t.createdAt) : new Date()},
        ${t.updatedAt ? new Date(t.updatedAt) : new Date()}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        messages = EXCLUDED.messages,
        updated_at = NOW();
    `;
  } catch (err) {
    console.error("[PostgreSQL saveTicket Error]:", err);
  }
}

async function saveCouponToSql(c: Coupon): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    const anyC = c as any;
    await sql`
      INSERT INTO coupons (
        code, type, value, usage_limit, used_count, used_by, expires_at, created_at
      )
      VALUES (
        ${c.code},
        ${c.type || "BALANCE"},
        ${Number(c.value) || 0},
        ${Number(c.maxUses || anyC.usageLimit) || 1},
        ${Number(c.usedCount) || 0},
        ${JSON.stringify(c.usedByUserIds || anyC.usedBy || [])},
        ${c.expiresAt ? new Date(c.expiresAt) : null},
        ${c.createdAt ? new Date(c.createdAt) : new Date()}
      )
      ON CONFLICT (code) DO UPDATE SET
        used_count = EXCLUDED.used_count,
        used_by = EXCLUDED.used_by;
    `;
  } catch (err) {
    console.error("[PostgreSQL saveCoupon Error]:", err);
  }
}

async function saveLogToSql(log: SystemLog): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`
      INSERT INTO logs (
        id, timestamp, category, level, action, details, metadata
      )
      VALUES (
        ${log.id},
        ${log.timestamp ? new Date(log.timestamp) : new Date()},
        ${log.category},
        ${log.level},
        ${log.action},
        ${log.details || null},
        ${log.metadata ? JSON.stringify(log.metadata) : null}
      )
      ON CONFLICT (id) DO NOTHING;
    `;
  } catch (err) {
    // ignore
  }
}

async function saveBackupToSql(b: SystemBackup): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`
      INSERT INTO backups (id, timestamp, note, data)
      VALUES (
        ${b.id},
        ${b.timestamp ? new Date(b.timestamp) : new Date()},
        ${b.label || null},
        ${JSON.stringify(b)}
      )
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        note = EXCLUDED.note,
        data = EXCLUDED.data;
    `;
  } catch (err) {
    console.error("[PostgreSQL saveBackup Error]:", err);
  }
}

async function syncFromSql(): Promise<DatabaseSchema | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const [settingsRows, usersRows, activationsRows, depositsRows, ticketsRows, couponsRows, logsRows, backupsRows] = (await Promise.all([
      sql`SELECT data FROM system_settings WHERE id = 1`,
      sql`SELECT * FROM users`,
      sql`SELECT * FROM activations ORDER BY created_at DESC LIMIT 1000`,
      sql`SELECT * FROM deposits ORDER BY created_at DESC LIMIT 500`,
      sql`SELECT * FROM tickets ORDER BY updated_at DESC LIMIT 200`,
      sql`SELECT * FROM coupons`,
      sql`SELECT * FROM logs ORDER BY timestamp DESC LIMIT 300`,
      sql`SELECT * FROM backups ORDER BY timestamp DESC LIMIT 30`,
    ])) as any[];

    let parsedSettings = DEFAULT_SETTINGS;
    if (settingsRows.length > 0 && settingsRows[0].data) {
      parsedSettings = {
        ...DEFAULT_SETTINGS,
        ...settingsRows[0].data,
        cryptoSettings: {
          ...DEFAULT_SETTINGS.cryptoSettings,
          ...(settingsRows[0].data.cryptoSettings || {}),
        },
      };
    }

    const parsedUsers: Record<string, User> = {};
    for (const r of usersRows) {
      const tgIdStr = String(r.telegram_id);
      parsedUsers[tgIdStr] = {
        telegramId: Number(r.telegram_id),
        username: r.username || "",
        firstName: r.first_name || "",
        lastName: r.last_name || "",
        balance: parseFloat(r.balance) || 0,
        spent: parseFloat(r.spent) || 0,
        role: r.role || "user",
        isBanned: Boolean(r.is_banned),
        isVip: Boolean(r.is_vip),
        vipSince: r.vip_since ? new Date(r.vip_since).toISOString() : undefined,
        vipExpiresAt: r.vip_expires_at ? new Date(r.vip_expires_at).toISOString() : null,
        vipDiscountPercent: r.vip_discount_percent ? Number(r.vip_discount_percent) : undefined,
        vipNote: r.vip_note || undefined,
        activeDiscount: r.active_discount ? (typeof r.active_discount === "string" ? JSON.parse(r.active_discount) : r.active_discount) : undefined,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        lastActiveAt: r.last_active_at ? new Date(r.last_active_at).toISOString() : new Date().toISOString(),
      };
    }

    const parsedActivations: Record<string, ActivationOrder> = {};
    for (const a of activationsRows) {
      parsedActivations[a.id] = {
        id: a.id,
        telegramId: Number(a.telegram_id),
        serviceCode: a.service_code,
        serviceName: a.service_name || "",
        countryId: Number(a.country_id),
        countryName: a.country_name || "",
        countryFlag: a.country_flag || "",
        phoneNumber: a.phone_number || "",
        originalCost: parseFloat(a.original_cost) || 0,
        chargedPrice: parseFloat(a.charged_price) || 0,
        status: a.status,
        smsCode: a.sms_code || null,
        smsText: a.sms_text || null,
        createdAt: Number(a.created_at) || Date.now(),
        expiresAt: Number(a.expires_at) || Date.now(),
        notifiedBot: Boolean(a.notified_bot),
      };
    }

    const parsedDeposits: DepositRequest[] = depositsRows.map((d: any) => ({
      id: d.id,
      telegramId: Number(d.telegram_id),
      username: d.username || "",
      amount: parseFloat(d.amount) || 0,
      method: d.method || "Havale/EFT",
      status: d.status || "PENDING",
      referenceCode: d.reference_code || d.id,
      txid: d.tx_id || undefined,
      createdAt: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString(),
    }));

    const parsedTickets: Record<string, Ticket> = {};
    for (const t of ticketsRows) {
      parsedTickets[t.id] = {
        id: t.id,
        telegramId: Number(t.telegram_id),
        username: t.username || undefined,
        userFirstName: t.user_first_name || undefined,
        subject: t.subject || "Destek Talebi",
        category: (t.category as any) || "GENERAL",
        status: t.status || "OPEN",
        messages: Array.isArray(t.messages) ? t.messages : (typeof t.messages === "string" ? JSON.parse(t.messages) : []),
        createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
        updatedAt: t.updated_at ? new Date(t.updated_at).toISOString() : new Date().toISOString(),
      };
    }

    const parsedCoupons: Record<string, Coupon> = {};
    for (const c of couponsRows) {
      parsedCoupons[c.code] = {
        id: c.id || `cp_${c.code}`,
        code: c.code,
        type: c.type || "BALANCE",
        value: parseFloat(c.value) || 0,
        description: c.description || undefined,
        minOrderAmount: c.min_order_amount ? parseFloat(c.min_order_amount) : undefined,
        maxUses: c.usage_limit || 1,
        usedCount: c.used_count || 0,
        usedByUserIds: Array.isArray(c.used_by) ? c.used_by : (typeof c.used_by === "string" ? JSON.parse(c.used_by) : []),
        isActive: c.is_active !== undefined ? Boolean(c.is_active) : true,
        expiresAt: c.expires_at ? new Date(c.expires_at).toISOString() : undefined,
        createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
      };
    }

    const parsedLogs: SystemLog[] = logsRows.map((l: any) => ({
      id: l.id,
      timestamp: l.timestamp ? new Date(l.timestamp).toISOString() : new Date().toISOString(),
      category: l.category,
      level: l.level,
      action: l.action,
      details: l.details || "",
      metadata: l.metadata ? (typeof l.metadata === "string" ? JSON.parse(l.metadata) : l.metadata) : undefined,
    }));

    const parsedBackups: SystemBackup[] = backupsRows.map((b: any) => {
      if (b.data && typeof b.data === "object") {
        return b.data;
      } else if (typeof b.data === "string") {
        try {
          return JSON.parse(b.data);
        } catch {}
      }
      return {
        id: b.id,
        timestamp: b.timestamp ? new Date(b.timestamp).toISOString() : new Date().toISOString(),
        createdAt: b.timestamp ? new Date(b.timestamp).toISOString() : new Date().toISOString(),
        label: b.note || "Yedek",
        type: "MANUAL",
        sizeBytes: 0,
        stats: {
          usersCount: 0,
          activationsCount: 0,
          ordersCount: 0,
          depositsCount: 0,
          ticketsCount: 0,
          couponsCount: 0,
          totalUserBalance: 0,
          totalBalance: 0,
          sizeKb: 0,
        },
      };
    });

    const sqlData: DatabaseSchema = {
      settings: parsedSettings,
      users: parsedUsers,
      activations: parsedActivations,
      deposits: parsedDeposits,
      tickets: parsedTickets,
      coupons: parsedCoupons,
      backups: parsedBackups.length > 0 ? parsedBackups : (memoryDb?.backups || []),
      logs: parsedLogs.length > 0 ? parsedLogs : (memoryDb?.logs || []),
    };

    return sqlData;
  } catch (err) {
    console.error("[PostgreSQL syncFromSql Error]:", err);
    return null;
  }
}

function ensureDbDirectory() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // ignore
    }
  }
}

async function saveApironeToDedicatedKv(creds: {
  apironeAccount?: string;
  apironeTransferKey?: string;
  usdtTrc20Address?: string;
  trxAddress?: string;
}): Promise<void> {
  if (!KV_URL || !KV_TOKEN) return;
  const acc = (creds.apironeAccount || "").trim();
  if (!acc) return;
  try {
    const raw = JSON.stringify({
      apironeAccount: acc,
      apironeTransferKey: (creds.apironeTransferKey || "").trim(),
      usdtTrc20Address: (creds.usdtTrc20Address || "").trim(),
      trxAddress: (creds.trxAddress || "").trim(),
      updatedAt: new Date().toISOString(),
    });
    await fetch(KV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", KV_APIRONE_KEY, raw]),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[Apirone Dedicated KV Save Error]:", e);
  }
}

async function getApironeFromDedicatedKv(): Promise<{
  apironeAccount?: string;
  apironeTransferKey?: string;
  usdtTrc20Address?: string;
  trxAddress?: string;
} | null> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(KV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["GET", KV_APIRONE_KEY]),
      cache: "no-store",
    });
    const json = await res.json();
    if (json && json.result && typeof json.result === "string") {
      const parsed = JSON.parse(json.result);
      if (parsed && typeof parsed === "object" && parsed.apironeAccount) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function saveToCloudKv(data: DatabaseSchema): Promise<boolean> {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const raw = JSON.stringify(data);
    const res = await fetch(KV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", KV_KEY, raw]),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[Cloud KV Save Error]: HTTP ${res.status}`);
      return false;
    }
    const json = await res.json().catch(() => null);
    if (json?.error) {
      console.error("[Cloud KV Save Error]: KV rejected the write");
      return false;
    }

    // Apirone hesabı varsa ayrık korumalı anahtara da mutlaka yaz
    const apAcc = (data.settings?.cryptoSettings?.apironeAccount || "").trim();
    if (apAcc) {
      await saveApironeToDedicatedKv({
        apironeAccount: apAcc,
        apironeTransferKey: (data.settings?.cryptoSettings?.apironeTransferKey || "").trim(),
        usdtTrc20Address: (data.settings?.cryptoSettings?.usdtTrc20Address || "").trim(),
        trxAddress: (data.settings?.cryptoSettings?.trxAddress || "").trim(),
      }).catch(() => {});
    }
    return true;
  } catch (err) {
    console.error("[Cloud KV Save Error]:", err);
    return false;
  }
}

let memoryDb: DatabaseSchema | null = null;
let lastCloudSyncTime = 0;
const CLOUD_SYNC_TTL_MS = 2000; // 2 saniye içinde tekrarlanan sync istekleri belleğe anında cevap verir

function loadDb(): DatabaseSchema {
  if (memoryDb) {
    return memoryDb;
  }
  ensureDbDirectory();
  if (!fs.existsSync(DB_PATH)) {
    const initialData: DatabaseSchema = {
      settings: DEFAULT_SETTINGS,
      users: {},
      activations: {},
      deposits: [],
      tickets: {},
      coupons: {},
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), "utf8");
    memoryDb = initialData;
    return initialData;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const data = JSON.parse(raw);
    if (!data.settings) data.settings = DEFAULT_SETTINGS;
    if (data.settings.useTcmbAutoRate === undefined) data.settings.useTcmbAutoRate = true;
    if (!Number.isInteger(data.settings.tcmbUpdateIntervalMinutes)) {
      data.settings.tcmbUpdateIntervalMinutes = DEFAULT_SETTINGS.tcmbUpdateIntervalMinutes;
    }
    if (!data.settings.lastTcmbRate) data.settings.lastTcmbRate = 49.20;
    if (!data.settings.bankInfo) data.settings.bankInfo = DEFAULT_SETTINGS.bankInfo;
    if (!data.settings.cryptoSettings) data.settings.cryptoSettings = DEFAULT_SETTINGS.cryptoSettings;
    if (data.settings.supportTelegramUsername === undefined) data.settings.supportTelegramUsername = "";
    if (data.settings.supportTelegramUsernames === undefined || !Array.isArray(data.settings.supportTelegramUsernames)) {
      data.settings.supportTelegramUsernames = data.settings.supportTelegramUsername
        ? [data.settings.supportTelegramUsername]
        : [];
    }
    if (!data.settings.adminTelegramIds || !Array.isArray(data.settings.adminTelegramIds)) {
      data.settings.adminTelegramIds = data.settings.adminTelegramId
        ? [String(data.settings.adminTelegramId).trim()]
        : [];
    }
    if (data.settings.heroSmsApiKey === undefined) {
      data.settings.heroSmsApiKey = process.env.HERO_SMS_API_KEY || "";
    }
    if (!data.users) data.users = {};
    if (!data.activations) data.activations = {};
    if (!data.deposits) data.deposits = [];
    if (!data.tickets) data.tickets = {};
    if (!data.coupons) data.coupons = {};
    if (!data.backups || !Array.isArray(data.backups)) data.backups = [];
    if (!data.logs || !Array.isArray(data.logs)) data.logs = [];
    if (!data.settings.backupSettings) {
      data.settings.backupSettings = DEFAULT_SETTINGS.backupSettings;
    }
    if (!data.settings.vipSettings) {
      data.settings.vipSettings = DEFAULT_SETTINGS.vipSettings;
    }

    // Silinen kullanıcılar asla geri gelmesin
    if (Array.isArray(data.settings?.deletedTelegramIds)) {
      for (const delId of data.settings.deletedTelegramIds) {
        delete data.users[delId];
        if (Array.isArray(data.settings.adminTelegramIds)) {
          data.settings.adminTelegramIds = data.settings.adminTelegramIds.filter(
            (id: string) => String(id).trim() !== String(delId).trim()
          );
        }
      }
    }

    // Silinen yedekler asla geri gelmesin
    const deletedBackupList = data.settings?.backupSettings?.deletedBackupIds;
    if (Array.isArray(deletedBackupList) && deletedBackupList.length > 0 && Array.isArray(data.backups)) {
      const deletedBackupSet = new Set(deletedBackupList);
      data.backups = data.backups.filter((b: any) => !deletedBackupSet.has(b.id));
    }

    memoryDb = data;
    return data;
  } catch (err) {
    console.error("Error reading db.json, returning empty defaults:", err);
    const fallback: DatabaseSchema = {
      settings: DEFAULT_SETTINGS,
      users: {},
      activations: {},
      deposits: [],
      tickets: {},
      coupons: {},
    };
    memoryDb = fallback;
    return fallback;
  }
}

async function saveDb(data: DatabaseSchema, syncToCloud: boolean = true): Promise<void> {
  memoryDb = data; // Anında belleği güncelle
  lastCloudSyncTime = Date.now(); // Senkronizasyon zamanını hemen güncelle ki anında gelen istekler belleği ezmesin
  ensureDbDirectory();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing db.json:", err);
  }
  // Çoklu konteyner ve kalıcı bulut senkronizasyonu için Upstash KV ve PostgreSQL'e yaz (AWAIT EDİLİR - Vercel donmasını önler)
  if (syncToCloud) {
    try {
      await Promise.allSettled([
        saveToCloudKv(data),
        saveSettingsToSql(data.settings),
      ]);
    } catch (e) {
      console.error("Error saving to cloud KV / PostgreSQL:", e);
    }
  }
}

// ==========================================
// SQL VERİTABANI DIŞA AKTARMA (SQL DUMP HELPERS)
// ==========================================

function escSqlStr(val: any): string {
  if (val === null || val === undefined) return "NULL";
  const str = String(val).replace(/\0/g, "");
  return `'${str.replace(/'/g, "''")}'`;
}

function escSqlNum(val: any, fallback = 0): string {
  if (val === null || val === undefined || isNaN(Number(val))) return String(fallback);
  return String(Number(val));
}

function escSqlBigInt(val: any): string {
  if (val === null || val === undefined) return "0";
  const cleaned = String(val).replace(/[^0-9-]/g, "");
  return cleaned || "0";
}

function escSqlBool(val: any): string {
  return val ? "TRUE" : "FALSE";
}

function escSqlDate(val: any): string {
  if (!val) return "NULL";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "NULL";
    return `'${d.toISOString()}'::timestamptz`;
  } catch {
    return "NULL";
  }
}

function escSqlJson(val: any): string {
  if (val === null || val === undefined) return "NULL";
  try {
    const str = typeof val === "string" ? val : JSON.stringify(val);
    return `'${str.replace(/\0/g, "").replace(/'/g, "''")}'::jsonb`;
  } catch {
    return "NULL";
  }
}

let isAutoBackupRunning = false;
let lastAutoBackupCheckTime = 0;

export const db = {
  async syncFromCloud(force: boolean = false): Promise<DatabaseSchema> {
    const now = Date.now();
    // 2 saniye içinde önbellekte varsa ve force değilse hemen bellekten dön (0ms ağ gecikmesi)
    if (!force && memoryDb && now - lastCloudSyncTime < CLOUD_SYNC_TTL_MS) {
      this.triggerAutoBackupIfNeeded().catch(() => {});
      return memoryDb;
    }

    // 1. Önce PostgreSQL'den oku (Birincil SQL Veritabanı)
    try {
      const sqlData = await syncFromSql();
      if (sqlData) {
        // Kara listedeki silinmiş kullanıcıları temizle
        if (Array.isArray(sqlData.settings.deletedTelegramIds)) {
          for (const delId of sqlData.settings.deletedTelegramIds) {
            delete sqlData.users[delId];
            if (Array.isArray(sqlData.settings.adminTelegramIds)) {
              sqlData.settings.adminTelegramIds = sqlData.settings.adminTelegramIds.filter(
                (id: string) => String(id).trim() !== String(delId).trim()
              );
            }
          }
        }

        // Apirone hesabı koruması
        if (!sqlData.settings.cryptoSettings) {
          sqlData.settings.cryptoSettings = { ...DEFAULT_SETTINGS.cryptoSettings };
        }
        const crypto = sqlData.settings.cryptoSettings;

        if (
          memoryDb?.settings?.cryptoSettings?.apironeAccount &&
          !crypto.apironeAccount
        ) {
          crypto.apironeAccount = memoryDb.settings.cryptoSettings.apironeAccount;
          crypto.apironeTransferKey = memoryDb.settings.cryptoSettings.apironeTransferKey || "";
        }
        if (!crypto.apironeAccount) {
          try {
            const dedicated = await getApironeFromDedicatedKv();
            if (dedicated && dedicated.apironeAccount) {
              crypto.apironeAccount = dedicated.apironeAccount;
              if (dedicated.apironeTransferKey) crypto.apironeTransferKey = dedicated.apironeTransferKey;
              if (dedicated.usdtTrc20Address && !crypto.usdtTrc20Address) crypto.usdtTrc20Address = dedicated.usdtTrc20Address;
              if (dedicated.trxAddress && !crypto.trxAddress) crypto.trxAddress = dedicated.trxAddress;
              saveSettingsToSql(sqlData.settings).catch(() => {});
            }
          } catch {}
        }

        memoryDb = sqlData;
        lastCloudSyncTime = now;

        // Yerel belleğe ve diske de yaz
        try {
          ensureDbDirectory();
          fs.writeFileSync(DB_PATH, JSON.stringify(sqlData, null, 2), "utf8");
        } catch {}

        return sqlData;
      }
    } catch (sqlErr) {
      console.error("[Neon PostgreSQL Sync Error]:", sqlErr);
    }

    if (!KV_URL || !KV_TOKEN) return loadDb();
    try {
      const res = await fetch(KV_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["GET", KV_KEY]),
        cache: "no-store",
      });
      const json = await res.json();
      if (json && json.result && typeof json.result === "string") {
        const cloudData: DatabaseSchema = JSON.parse(json.result);
        if (cloudData && typeof cloudData === "object" && cloudData.users && cloudData.settings) {
          // Kara listedeki silinmiş kullanıcıları temizle
          if (Array.isArray(cloudData.settings.deletedTelegramIds)) {
            for (const delId of cloudData.settings.deletedTelegramIds) {
              delete cloudData.users[delId];
              if (Array.isArray(cloudData.settings.adminTelegramIds)) {
                cloudData.settings.adminTelegramIds = cloudData.settings.adminTelegramIds.filter(
                  (id: string) => String(id).trim() !== String(delId).trim()
                );
              }
            }
          }

          // Silinen yedeklerin kara listesini yükle ve her iki taraftan da kesinlikle temizle
          const deletedBackupIds = new Set([
            ...(cloudData.settings?.backupSettings?.deletedBackupIds || []),
            ...(memoryDb?.settings?.backupSettings?.deletedBackupIds || []),
          ]);

          if (deletedBackupIds.size > 0) {
            if (!cloudData.settings.backupSettings) {
              cloudData.settings.backupSettings = { ...DEFAULT_BACKUP_SETTINGS };
            }
            cloudData.settings.backupSettings.deletedBackupIds = Array.from(deletedBackupIds);

            if (Array.isArray(cloudData.backups)) {
              cloudData.backups = cloudData.backups.filter((b) => !deletedBackupIds.has(b.id));
            }
            if (Array.isArray(memoryDb?.backups)) {
              memoryDb.backups = memoryDb.backups.filter((b) => !deletedBackupIds.has(b.id));
            }
          }

          // Backups koruması: Yalnızca SİLİNMEMİŞ yeni yedekleri buluta ekle
          if (Array.isArray(memoryDb?.backups) && memoryDb.backups.length > 0) {
            const validMemoryBackups = memoryDb.backups.filter((b) => !deletedBackupIds.has(b.id));
            if (!Array.isArray(cloudData.backups) || cloudData.backups.length === 0) {
              cloudData.backups = validMemoryBackups;
              saveToCloudKv(cloudData).catch(() => {});
            } else {
              const cloudIds = new Set(cloudData.backups.map((b) => b.id));
              let hasNew = false;
              for (const mb of validMemoryBackups) {
                if (!cloudIds.has(mb.id)) {
                  cloudData.backups.unshift(mb);
                  hasNew = true;
                }
              }
              if (hasNew) {
                saveToCloudKv(cloudData).catch(() => {});
              }
            }
          }

          const mergedCloudSettings: SystemSettings = {
            ...DEFAULT_SETTINGS,
            ...cloudData.settings,
            cryptoSettings: {
              ...(DEFAULT_SETTINGS.cryptoSettings || {}),
              ...(cloudData.settings.cryptoSettings || {}),
            },
            backupSettings: {
              ...DEFAULT_BACKUP_SETTINGS,
              ...(cloudData.settings.backupSettings || {}),
            },
            vipSettings: {
              defaultDiscountPercent: 15,
              enabled: true,
              ...(DEFAULT_SETTINGS.vipSettings || {}),
              ...(cloudData.settings.vipSettings || {}),
            },
          };
          cloudData.settings = mergedCloudSettings;
          const cloudCryptoSettings = mergedCloudSettings.cryptoSettings!;

          // 1. Eğer memoryDb'de kayıtlı bir Apirone hesabı varsa ve bulutta boşsa, asla silinmesin
          if (
            memoryDb?.settings?.cryptoSettings?.apironeAccount &&
            !cloudCryptoSettings.apironeAccount
          ) {
            cloudCryptoSettings.apironeAccount = memoryDb.settings.cryptoSettings.apironeAccount;
            if (memoryDb.settings.cryptoSettings.apironeTransferKey) {
              cloudCryptoSettings.apironeTransferKey = memoryDb.settings.cryptoSettings.apironeTransferKey;
            }
          }

          // 2. Eğer buluttaki ana DB'de Apirone hesabı boşsa, ayrık korumalı KV anahtarından otomatik kurtar
          if (!cloudCryptoSettings.apironeAccount) {
            try {
              const dedicated = await getApironeFromDedicatedKv();
              if (dedicated && dedicated.apironeAccount) {
                cloudCryptoSettings.apironeAccount = dedicated.apironeAccount;
                if (dedicated.apironeTransferKey) {
                  cloudCryptoSettings.apironeTransferKey = dedicated.apironeTransferKey;
                }
                if (dedicated.usdtTrc20Address && !cloudCryptoSettings.usdtTrc20Address) {
                  cloudCryptoSettings.usdtTrc20Address = dedicated.usdtTrc20Address;
                }
                if (dedicated.trxAddress && !cloudCryptoSettings.trxAddress) {
                  cloudCryptoSettings.trxAddress = dedicated.trxAddress;
                }
              }
            } catch (e) {}
          }

          memoryDb = cloudData;
          lastCloudSyncTime = now;

          // Yerel belleğe ve diske de yaz
          try {
            ensureDbDirectory();
            fs.writeFileSync(DB_PATH, JSON.stringify(cloudData, null, 2), "utf8");
          } catch {}

          this.triggerAutoBackupIfNeeded().catch(() => {});
          return cloudData;
        }
      }
    } catch (err) {
      console.error("[Cloud KV Sync Error]:", err);
    }
    this.triggerAutoBackupIfNeeded().catch(() => {});
    return loadDb();
  },

  getSettings(): SystemSettings {
    const data = loadDb();
    if (!data.settings.backupSettings) {
      data.settings.backupSettings = { ...DEFAULT_BACKUP_SETTINGS };
    }
    if (!data.settings.backupSettings.lastBackupAt) {
      const latest =
        data.settings.backupSettings.lastAutoBackupTime ||
        data.backups?.[0]?.createdAt ||
        data.backups?.[0]?.timestamp;
      if (latest) {
        data.settings.backupSettings.lastBackupAt = latest;
        data.settings.backupSettings.lastBackupTime = latest;
      }
    }
    return data.settings;
  },

  async updateSettings(partial: Partial<SystemSettings>): Promise<SystemSettings> {
    const data = await this.syncFromCloud(true);

    const currentCrypto = {
      ...(DEFAULT_SETTINGS.cryptoSettings || {}),
      ...(data.settings.cryptoSettings || {}),
    };

    let mergedCrypto = currentCrypto;
    if (partial.cryptoSettings) {
      const p = partial.cryptoSettings;
      mergedCrypto = {
        ...currentCrypto,
        ...p,
        // Yalnızca YENİ VE DOLU bir değer verilmişse güncelle, boş string mevcut hesabı asla silmesin!
        apironeAccount:
          p.apironeAccount !== undefined && p.apironeAccount.trim() !== ""
            ? p.apironeAccount.trim()
            : (currentCrypto.apironeAccount || "").trim(),
        apironeTransferKey:
          p.apironeTransferKey !== undefined && p.apironeTransferKey.trim() !== ""
            ? p.apironeTransferKey.trim()
            : (currentCrypto.apironeTransferKey || "").trim(),
        usdtTrc20Address:
          p.usdtTrc20Address !== undefined && p.usdtTrc20Address.trim() !== ""
            ? p.usdtTrc20Address.trim()
            : (currentCrypto.usdtTrc20Address || "").trim(),
        trxAddress:
          p.trxAddress !== undefined && p.trxAddress.trim() !== ""
            ? p.trxAddress.trim()
            : (currentCrypto.trxAddress || "").trim(),
      };
    }

    const mergedBank = partial.bankInfo
      ? { ...(data.settings.bankInfo || DEFAULT_SETTINGS.bankInfo), ...partial.bankInfo }
      : data.settings.bankInfo;

    const mergedBackup = partial.backupSettings
      ? { ...(data.settings.backupSettings || DEFAULT_SETTINGS.backupSettings), ...partial.backupSettings }
      : data.settings.backupSettings;

    const mergedVip = partial.vipSettings
      ? { ...(data.settings.vipSettings || DEFAULT_SETTINGS.vipSettings), ...partial.vipSettings }
      : data.settings.vipSettings;

    const previousSettings = data.settings;
    data.settings = {
      ...data.settings,
      ...partial,
      cryptoSettings: mergedCrypto,
      ...(mergedBank ? { bankInfo: mergedBank } : {}),
      ...(mergedBackup ? { backupSettings: mergedBackup } : {}),
      ...(mergedVip ? { vipSettings: mergedVip } : {}),
    };

    // Ayrık korumalı KV anahtarına da anında yaz
    if (mergedCrypto.apironeAccount) {
      await saveApironeToDedicatedKv({
        apironeAccount: mergedCrypto.apironeAccount,
        apironeTransferKey: mergedCrypto.apironeTransferKey,
        usdtTrc20Address: mergedCrypto.usdtTrc20Address,
        trxAddress: mergedCrypto.trxAddress,
      }).catch(() => {});
    }

    const [sqlSaved, kvSaved] = await Promise.all([
      saveSettingsToSql(data.settings),
      saveToCloudKv(data),
    ]);
    if (!sqlSaved && !kvSaved) {
      data.settings = previousSettings;
      throw new Error("Ayarlar kalıcı veritabanına kaydedilemedi. Veritabanı bağlantısını kontrol edin.");
    }
    await saveDb(data, false);
    return data.settings;
  },

  getUser(telegramId: number | string): User | null {
    const data = loadDb();
    const cleanId = String(telegramId).trim();
    if (data.users[cleanId]) return data.users[cleanId];
    return (
      Object.values(data.users).find(
        (u) => String(u.telegramId).trim() === cleanId
      ) || null
    );
  },

  isAdmin(telegramId: number | string): boolean {
    if (!telegramId) return false;
    const cleanId = String(telegramId).trim();
    if (!cleanId) return false;
    const data = loadDb();

    // Silinen kullanıcı asla admin olamaz
    if (Array.isArray(data.settings.deletedTelegramIds) && data.settings.deletedTelegramIds.includes(cleanId)) {
      return false;
    }

    // 1. Settings adminTelegramIds listesinde var mı?
    if (Array.isArray(data.settings.adminTelegramIds) && data.settings.adminTelegramIds.map(String).includes(cleanId)) {
      return true;
    }

    // 2. Settings tekil adminTelegramId ile eşleşiyor mu?
    if (data.settings.adminTelegramId && String(data.settings.adminTelegramId).trim() === cleanId) {
      return true;
    }

    // 3. Kullanıcı kaydında role === 'admin' mi?
    const user = this.getUser(cleanId);
    if (user && user.role === "admin") {
      return true;
    }

    return false;
  },

  getAdminTelegramIds(): string[] {
    const data = loadDb();
    const ids = new Set<string>();
    if (data.settings.adminTelegramId) {
      ids.add(String(data.settings.adminTelegramId).trim());
    }
    if (Array.isArray(data.settings.adminTelegramIds)) {
      data.settings.adminTelegramIds.forEach((id) => {
        if (id) ids.add(String(id).trim());
      });
    }
    Object.values(data.users).forEach((u) => {
      if (u && u.role === "admin" && u.telegramId) {
        ids.add(String(u.telegramId).trim());
      }
    });
    return Array.from(ids).filter(Boolean);
  },

  async touchUserActive(
    telegramId: number | string,
    profile?: { username?: string; firstName?: string; lastName?: string }
  ): Promise<void> {
    if (!telegramId) return;
    const data = loadDb();
    const cleanId = String(telegramId).trim();

    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    const nowIso = new Date().toISOString();

    if (foundKey && data.users[foundKey]) {
      const user = data.users[foundKey];
      user.lastActiveAt = nowIso;
      if (profile?.username) user.username = profile.username.replace(/^@/, "").trim();
      if (profile?.firstName) user.firstName = profile.firstName.trim();
      if (profile?.lastName !== undefined) user.lastName = profile.lastName ? profile.lastName.trim() : undefined;
      // Bellek ve diski anında güncelle
      await saveDb(data, false);
      saveUserToSql(user).catch(() => {});
    } else if (profile?.firstName) {
      await this.getOrCreateUser(cleanId, {
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        lastActiveAt: nowIso,
      });
    }
  },

  async syncTelegramUserProfile(
    telegramId: number | string,
    profile: { username?: string; firstName?: string; lastName?: string }
  ): Promise<User> {
    const data = loadDb();
    const cleanId = String(telegramId).trim();
    const isAdminUser = this.isAdmin(cleanId);

    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    const cleanUsername = profile.username
      ? profile.username.replace(/^@/, "").trim()
      : "";
    const cleanFirst = profile.firstName ? profile.firstName.trim() : "";
    const cleanLast = profile.lastName ? profile.lastName.trim() : undefined;

    let user: User;

    if (!foundKey || !data.users[foundKey]) {
      user = {
        telegramId: Number(cleanId),
        username: cleanUsername,
        firstName: cleanFirst || `Telegram Kullanıcısı`,
        lastName: cleanLast,
        balance: 0.0,
        spent: 0,
        role: isAdminUser ? "admin" : "user",
        isBanned: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      data.users[cleanId] = user;
    } else {
      user = data.users[foundKey];
      user.lastActiveAt = new Date().toISOString();

      if (cleanUsername) {
        user.username = cleanUsername;
      } else if (user.username && user.username.startsWith("user_")) {
        user.username = "";
      }

      if (cleanFirst) {
        user.firstName = cleanFirst;
      }

      if (cleanLast !== undefined) {
        user.lastName = cleanLast;
      }

      if (isAdminUser && user.role !== "admin") {
        user.role = "admin";
      }
    }

    await saveDb(data);
    await saveUserToSql(user);
    return user;
  },

  async saveUser(user: User): Promise<void> {
    const data = loadDb();
    const cleanId = String(user.telegramId).trim();
    if (user.username && user.username.startsWith("user_")) {
      user.username = "";
    }
    data.users[cleanId] = user;
    await saveDb(data);
    await saveUserToSql(user);
  },

  async getOrCreateUser(telegramId: number | string, defaults?: Partial<User>): Promise<User> {
    const data = loadDb();
    const cleanId = String(telegramId).trim();
    const isAdminUser = this.isAdmin(cleanId);

    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    const cleanUsername = defaults?.username
      ? defaults.username.replace(/^@/, "").trim()
      : "";
    const cleanFirst = defaults?.firstName ? defaults.firstName.trim() : "";
    const cleanLast = defaults?.lastName ? defaults.lastName.trim() : undefined;

    if (!foundKey || !data.users[foundKey]) {
      const newUser: User = {
        telegramId: Number(cleanId),
        username: cleanUsername,
        firstName: cleanFirst || `Telegram Kullanıcısı`,
        lastName: cleanLast,
        balance: defaults?.balance ?? 0.0,
        spent: defaults?.spent || 0,
        role: (defaults?.role as "admin" | "user") || (isAdminUser ? "admin" : "user"),
        isBanned: defaults?.isBanned || false,
        createdAt: defaults?.createdAt || new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      data.users[cleanId] = newUser;
      await saveDb(data);
      await saveUserToSql(newUser);
      return newUser;
    } else {
      const user = data.users[foundKey];
      user.lastActiveAt = new Date().toISOString();
      let changed = false;

      if (cleanUsername && user.username !== cleanUsername) {
        user.username = cleanUsername;
        changed = true;
      } else if (user.username && user.username.startsWith("user_")) {
        user.username = "";
        changed = true;
      }

      if (cleanFirst && user.firstName !== cleanFirst) {
        user.firstName = cleanFirst;
        changed = true;
      }

      if (cleanLast !== undefined && user.lastName !== cleanLast) {
        user.lastName = cleanLast;
        changed = true;
      }

      if (isAdminUser && user.role !== "admin") {
        user.role = "admin";
        changed = true;
      }
      if (changed) {
        await saveDb(data);
        await saveUserToSql(user);
      }
      return user;
    }
  },

  async resetStats(): Promise<{ activationsReset: number; depositsReset: number }> {
    const data = loadDb();
    const actCount = Object.keys(data.activations || {}).length;
    const depCount = (data.deposits || []).length;
    data.activations = {};
    data.deposits = [];
    for (const key of Object.keys(data.users)) {
      data.users[key].spent = 0;
    }
    await saveDb(data);

    const sql = getSql();
    if (sql) {
      try {
        await Promise.allSettled([
          sql`DELETE FROM activations`,
          sql`DELETE FROM deposits`,
          sql`UPDATE users SET spent = 0`,
        ]);
      } catch (e) {
        console.error("[PostgreSQL resetStats Error]:", e);
      }
    }

    return { activationsReset: actCount, depositsReset: depCount };
  },

  async updateUserBalance(
    telegramId: number | string,
    delta: number,
    userData?: Partial<User>
  ): Promise<User> {
    const data = await this.syncFromCloud(true);
    const cleanId = String(telegramId).trim();

    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    let user = foundKey ? data.users[foundKey] : null;

    if (!user) {
      const initialBal =
        userData?.balance !== undefined && !isNaN(Number(userData.balance))
          ? Number(userData.balance)
          : 0;

      const isAdminUser = this.isAdmin(cleanId);

      const cleanUsername = userData?.username
        ? userData.username.replace(/^@/, "").trim()
        : "";
      const cleanFirst = userData?.firstName?.trim() || "";

      user = {
        telegramId: Number(cleanId),
        username: cleanUsername,
        firstName: cleanFirst || `Telegram Kullanıcısı`,
        lastName: userData?.lastName?.trim(),
        balance: Math.max(0, Number((initialBal + delta).toFixed(2))),
        spent: userData?.spent || 0,
        role: (userData?.role as "admin" | "user") || (isAdminUser ? "admin" : "user"),
        isBanned: userData?.isBanned || false,
        createdAt: userData?.createdAt || new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      data.users[cleanId] = user;
    } else {
      if (user.username && user.username.startsWith("user_")) {
        user.username = "";
      }
      if (userData?.username) {
        user.username = userData.username.replace(/^@/, "").trim();
      }
      if (userData?.firstName) {
        user.firstName = userData.firstName.trim();
      }
      if (userData?.lastName) {
        user.lastName = userData.lastName.trim();
      }
      user.balance = Math.max(0, Number((user.balance + delta).toFixed(2)));
    }

    if (delta < 0) {
      user.spent = Number(((user.spent || 0) + Math.abs(delta)).toFixed(2));
    }
    user.lastActiveAt = new Date().toISOString();
    await saveDb(data, true);
    await saveUserToSql(user);
    return user;
  },

  async setUserBalance(
    telegramId: number | string,
    newBalance: number,
    userData?: Partial<User>
  ): Promise<User> {
    const data = await this.syncFromCloud(true);
    const cleanId = String(telegramId).trim();

    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    let user = foundKey ? data.users[foundKey] : null;

    if (!user) {
      const isAdminUser = this.isAdmin(cleanId);
      const cleanUsername = userData?.username
        ? userData.username.replace(/^@/, "").trim()
        : "";
      const cleanFirst = userData?.firstName?.trim() || "";

      user = {
        telegramId: Number(cleanId),
        username: cleanUsername,
        firstName: cleanFirst || `Telegram Kullanıcısı`,
        lastName: userData?.lastName?.trim(),
        balance: Math.max(0, Number(newBalance.toFixed(2))),
        spent: userData?.spent || 0,
        role: (userData?.role as "admin" | "user") || (isAdminUser ? "admin" : "user"),
        isBanned: userData?.isBanned || false,
        createdAt: userData?.createdAt || new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      data.users[cleanId] = user;
    } else {
      if (user.username && user.username.startsWith("user_")) {
        user.username = "";
      }
      if (userData?.username) {
        user.username = userData.username.replace(/^@/, "").trim();
      }
      if (userData?.firstName) {
        user.firstName = userData.firstName.trim();
      }
      if (userData?.lastName) {
        user.lastName = userData.lastName.trim();
      }
      user.balance = Math.max(0, Number(newBalance.toFixed(2)));
    }

    user.lastActiveAt = new Date().toISOString();
    await saveDb(data, true);
    await saveUserToSql(user);
    return user;
  },

  async updateUserRole(
    telegramId: number | string,
    role: "admin" | "user",
    userData?: Partial<User>
  ): Promise<User> {
    const data = loadDb();
    const cleanId = String(telegramId).trim();

    if (!data.settings.adminTelegramIds || !Array.isArray(data.settings.adminTelegramIds)) {
      data.settings.adminTelegramIds = data.settings.adminTelegramId
        ? [String(data.settings.adminTelegramId).trim()]
        : [];
    }

    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    let user = foundKey ? data.users[foundKey] : null;
    if (!user) {
      user = await this.getOrCreateUser(cleanId, { ...userData, role });
    } else {
      user.role = role;
    }

    if (role === "admin") {
      if (!data.settings.adminTelegramIds.includes(cleanId)) {
        data.settings.adminTelegramIds.push(cleanId);
      }
      if (!data.settings.adminTelegramId) {
        data.settings.adminTelegramId = cleanId;
      }
      if (Array.isArray(data.settings.deletedTelegramIds)) {
        data.settings.deletedTelegramIds = data.settings.deletedTelegramIds.filter(
          (id) => String(id).trim() !== cleanId
        );
      }
    } else {
      data.settings.adminTelegramIds = data.settings.adminTelegramIds.filter(
        (id) => String(id).trim() !== cleanId
      );
      if (String(data.settings.adminTelegramId).trim() === cleanId) {
        data.settings.adminTelegramId = data.settings.adminTelegramIds[0] || "";
      }
    }

    await saveDb(data);
    await saveUserToSql(user);
    return user;
  },

  async toggleUserBan(
    telegramId: number | string,
    isBanned: boolean,
    userData?: Partial<User>
  ): Promise<User> {
    const data = loadDb();
    const cleanId = String(telegramId).trim();
    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    let user = foundKey ? data.users[foundKey] : null;
    if (!user) {
      user = await this.getOrCreateUser(cleanId, { ...userData, isBanned });
    } else {
      user.isBanned = isBanned;
      await saveDb(data);
      await saveUserToSql(user);
    }
    return user;
  },

  async updateUser(
    telegramId: number | string,
    updates: Partial<User>
  ): Promise<User | null> {
    const data = loadDb();
    const cleanId = String(telegramId).trim();
    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );
    if (!foundKey || !data.users[foundKey]) return null;
    data.users[foundKey] = { ...data.users[foundKey], ...updates };
    await saveDb(data);
    await saveUserToSql(data.users[foundKey]);
    return data.users[foundKey];
  },

  async createDeposit(deposit: DepositRequest): Promise<void> {
    return this.addDeposit(deposit);
  },

  async deleteUser(telegramId: number | string): Promise<boolean> {
    const data = loadDb();
    const cleanId = String(telegramId).trim();

    // 1. users tablosundan tamamen kaldır
    const foundKeys = Object.keys(data.users).filter(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );
    for (const k of foundKeys) {
      delete data.users[k];
    }

    // 2. adminTelegramIds listesinden temizle
    if (Array.isArray(data.settings.adminTelegramIds)) {
      data.settings.adminTelegramIds = data.settings.adminTelegramIds.filter(
        (id) => String(id).trim() !== cleanId
      );
    }

    // 3. Tekil adminTelegramId eğer bu kullanıcı ise sıradaki admine devret veya boşalt
    if (String(data.settings.adminTelegramId).trim() === cleanId) {
      data.settings.adminTelegramId = data.settings.adminTelegramIds?.[0] || "";
    }

    // 4. Silinen kullanıcılar listesine ekle (asla geri dirilmez)
    if (!Array.isArray(data.settings.deletedTelegramIds)) {
      data.settings.deletedTelegramIds = [];
    }
    if (!data.settings.deletedTelegramIds.includes(cleanId)) {
      data.settings.deletedTelegramIds.push(cleanId);
    }

    await saveDb(data);

    const sql = getSql();
    if (sql) {
      try {
        await sql`DELETE FROM users WHERE telegram_id = ${BigInt(cleanId)}`;
      } catch (e) {
        console.error("[PostgreSQL deleteUser Error]:", e);
      }
    }

    return true;
  },

  async mergeUsers(incomingUsers: User[]): Promise<void> {
    const data = loadDb();
    let changed = false;
    for (const u of incomingUsers) {
      if (!u || !u.telegramId) continue;
      const key = String(u.telegramId).trim();
      if (!data.users[key]) {
        data.users[key] = {
          ...u,
          telegramId: Number(u.telegramId),
        };
        changed = true;
      } else {
        const existing = data.users[key];
        if (u.username && existing.username !== u.username) {
          existing.username = u.username;
          changed = true;
        }
        if (u.firstName && existing.firstName !== u.firstName) {
          existing.firstName = u.firstName;
          changed = true;
        }
      }
    }
    if (changed) {
      await saveDb(data);
    }
  },

  getAllUsers(): User[] {
    const data = loadDb();
    return Object.values(data.users).map((u) => {
      if (u.username && u.username.startsWith("user_")) {
        return { ...u, username: "" };
      }
      return u;
    });
  },

  getActivation(id: string): ActivationOrder | null {
    const data = loadDb();
    return data.activations[id] || null;
  },

  getUserActivations(telegramId: number | string): ActivationOrder[] {
    const data = loadDb();
    const key = Number(telegramId);
    return Object.values(data.activations)
      .filter((a) => a.telegramId === key)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  getActiveOrders(telegramId?: number | string): ActivationOrder[] {
    const data = loadDb();
    const all = Object.values(data.activations).filter((a) => a.status === "WAIT_CODE" || a.status === "RECEIVED");
    if (telegramId) {
      const key = Number(telegramId);
      return all.filter((a) => a.telegramId === key).sort((a, b) => b.createdAt - a.createdAt);
    }
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },

  getAllActivations(): ActivationOrder[] {
    const data = loadDb();
    return Object.values(data.activations).sort((a, b) => b.createdAt - a.createdAt);
  },

  async saveActivation(order: ActivationOrder): Promise<void> {
    const data = loadDb();
    data.activations[order.id] = order;
    await saveDb(data);
    await saveActivationToSql(order);
  },

  async updateActivation(id: string, updates: Partial<ActivationOrder>): Promise<ActivationOrder | null> {
    const data = loadDb();
    if (!data.activations[id]) return null;
    data.activations[id] = { ...data.activations[id], ...updates };
    await saveDb(data);
    await saveActivationToSql(data.activations[id]);
    return data.activations[id];
  },

  async addDeposit(deposit: DepositRequest): Promise<void> {
    const data = loadDb();
    data.deposits.unshift(deposit);
    await saveDb(data);
    await saveDepositToSql(deposit);

    this.addLog({
      category: "DEPOSIT",
      level: "INFO",
      action: "DEPOSIT_CREATED",
      details: `${deposit.amount} ₺ tutarında ${deposit.method} ödeme talebi oluşturuldu (${deposit.referenceCode || deposit.id}).`,
      telegramId: Number(deposit.telegramId),
      username: deposit.username,
      metadata: { depositId: deposit.id, method: deposit.method, amount: deposit.amount },
    }).catch(() => {});
  },

  getDeposits(): DepositRequest[] {
    const data = loadDb();
    return data.deposits;
  },

  async updateDepositStatus(id: string, status: "APPROVED" | "REJECTED"): Promise<DepositRequest | null> {
    const data = loadDb();
    const dep = data.deposits.find((d) => d.id === id);
    if (!dep) return null;
    dep.status = status;

    if (status === "APPROVED") {
      const cleanId = String(dep.telegramId).trim();
      let foundKey = Object.keys(data.users).find(
        (k) =>
          String(k).trim() === cleanId ||
          String(data.users[k]?.telegramId).trim() === cleanId
      );

      let targetUser: User;
      if (foundKey && data.users[foundKey]) {
        targetUser = data.users[foundKey];
        targetUser.balance = Number(
          (targetUser.balance + dep.amount).toFixed(2)
        );
      } else {
        targetUser = await this.getOrCreateUser(cleanId, {
          username: dep.username,
          balance: dep.amount,
        });
      }

      // Otomatik VIP Yükseltme Kontrolü (Bakiye yükleme tutarı VIP eşiğini geçerse)
      const vipCfg = data.settings.vipSettings;
      if (
        vipCfg?.enabled &&
        vipCfg?.autoVipOnDepositAmount &&
        dep.amount >= vipCfg.autoVipOnDepositAmount &&
        !targetUser.isVip
      ) {
        targetUser.isVip = true;
        targetUser.vipSince = new Date().toISOString();
        targetUser.vipDiscountPercent = vipCfg.defaultDiscountPercent || 15;
        this.addLog({
          category: "USER",
          level: "SUCCESS",
          action: "AUTO_VIP_UPGRADE",
          details: `Kullanıcı ${dep.amount} ₺ yükleme yaparak otomatik VIP statüsüne yükseltildi (İndirim: %${targetUser.vipDiscountPercent}).`,
          telegramId: Number(cleanId),
          username: targetUser.username,
        }).catch(() => {});
      }

      this.addLog({
        category: "DEPOSIT",
        level: "SUCCESS",
        action: "DEPOSIT_APPROVED",
        details: `${dep.amount} ₺ tutarındaki ${dep.method} ödemesi onaylandı. Yeni bakiye: ${targetUser.balance} ₺`,
        telegramId: Number(cleanId),
        username: dep.username,
        metadata: { depositId: dep.id, method: dep.method, amount: dep.amount },
      }).catch(() => {});
    } else {
      this.addLog({
        category: "DEPOSIT",
        level: "WARN",
        action: "DEPOSIT_REJECTED",
        details: `${dep.amount} ₺ tutarındaki ${dep.method} ödeme talebi reddedildi.`,
        telegramId: Number(dep.telegramId),
        username: dep.username,
        metadata: { depositId: dep.id, method: dep.method, amount: dep.amount },
      }).catch(() => {});
    }

    await saveDb(data);
    await saveDepositToSql(dep);
    if (status === "APPROVED") {
      const cleanId = String(dep.telegramId).trim();
      const updatedUser = this.getUser(cleanId);
      if (updatedUser) {
        await saveUserToSql(updatedUser);
      }
    }
    return dep;
  },

  hasUsedTxid(txid: string): boolean {
    const data = loadDb();
    const clean = txid.trim().toLowerCase();
    return (data.deposits || []).some(
      (d) => d.txid && d.txid.trim().toLowerCase() === clean && d.status === "APPROVED"
    );
  },

  getAllTickets(): Ticket[] {
    const data = loadDb();
    return Object.values(data.tickets || {}).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  getUserTickets(telegramId: number | string): Ticket[] {
    const data = loadDb();
    const id = Number(telegramId);
    return Object.values(data.tickets || {})
      .filter((t) => t.telegramId === id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  getTicket(id: string): Ticket | null {
    const data = loadDb();
    return (data.tickets && data.tickets[id]) || null;
  },

  async createTicket(ticket: Ticket): Promise<Ticket> {
    const data = loadDb();
    if (!data.tickets) data.tickets = {};
    data.tickets[ticket.id] = ticket;
    await saveDb(data);
    await saveTicketToSql(ticket);
    return ticket;
  },

  async addTicketReply(
    ticketId: string,
    message: TicketMessage,
    newStatus?: TicketStatus
  ): Promise<Ticket | null> {
    const data = loadDb();
    if (!data.tickets || !data.tickets[ticketId]) return null;
    const ticket = data.tickets[ticketId];
    ticket.messages.push(message);
    ticket.updatedAt = message.createdAt;
    if (newStatus) {
      ticket.status = newStatus;
    }
    await saveDb(data);
    await saveTicketToSql(ticket);
    return ticket;
  },

  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket | null> {
    const data = loadDb();
    if (!data.tickets || !data.tickets[ticketId]) return null;
    const ticket = data.tickets[ticketId];
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    await saveDb(data);
    await saveTicketToSql(ticket);
    return ticket;
  },

  async deleteTicket(ticketId: string): Promise<boolean> {
    const data = loadDb();
    if (!data.tickets || !data.tickets[ticketId]) return false;
    delete data.tickets[ticketId];
    await saveDb(data);
    const sql = getSql();
    if (sql) {
      try {
        await sql`DELETE FROM tickets WHERE id = ${ticketId}`;
      } catch (e) {}
    }
    return true;
  },

  // ==========================================
  // KAMPANYA VE KUPON KODU METOTLARI
  // ==========================================
  getCoupons(): Coupon[] {
    const data = loadDb();
    if (!data.coupons) return [];
    return Object.values(data.coupons).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getCoupon(code: string): Coupon | null {
    const data = loadDb();
    if (!data.coupons) return null;
    const cleanCode = (code || "").trim().toUpperCase();
    const found = Object.values(data.coupons).find(
      (c) => c.code.trim().toUpperCase() === cleanCode
    );
    return found || null;
  },

  async saveCoupon(coupon: Coupon): Promise<Coupon> {
    const data = loadDb();
    if (!data.coupons) data.coupons = {};
    coupon.code = coupon.code.trim().toUpperCase();
    data.coupons[coupon.id] = coupon;
    await saveDb(data);
    await saveCouponToSql(coupon);
    return coupon;
  },

  async deleteCoupon(identifier: string): Promise<boolean> {
    const data = loadDb();
    if (!data.coupons) return false;

    const cleanIdentifier = String(identifier || "").trim();
    const normalizedIdentifier = cleanIdentifier.toUpperCase();
    const couponEntries = Object.entries(data.coupons);
    const target = couponEntries.find(([key, coupon]) =>
      key === cleanIdentifier ||
      coupon.id === cleanIdentifier ||
      String(coupon.code || "").trim().toUpperCase() === normalizedIdentifier
    );
    if (!target) return false;

    const [, targetCoupon] = target;
    const cleanCode = String(targetCoupon.code || cleanIdentifier).trim().toUpperCase();
    const sql = getSql();
    if (sql) {
      // SQL'den yüklenen kuponlar kod ile anahtarlanabilir; UI ise id gönderir.
      // Kalıcı silme için her zaman kupon kodunu kullan ve SQL hatasını gizleme.
      await sql`DELETE FROM coupons WHERE UPPER(TRIM(code)) = ${cleanCode}`;
    }

    // Eski yerel kayıtlar id, yenileri ise kupon kodu anahtarıyla tutulmuş olabilir.
    // Aynı kupona ait olası farklı anahtarları da temizle.
    for (const [key, coupon] of couponEntries) {
      if (
        key === cleanIdentifier ||
        coupon.id === targetCoupon.id ||
        String(coupon.code || "").trim().toUpperCase() === cleanCode
      ) {
        delete data.coupons[key];
      }
    }
    await saveDb(data);
    return true;
  },

  async redeemCoupon(
    codeInput: string,
    telegramId: number
  ): Promise<{
    success: boolean;
    message: string;
    coupon?: Coupon;
    addedBalance?: number;
    newBalance?: number;
    activeDiscount?: any;
  }> {
    const data = loadDb();
    if (!data.coupons) data.coupons = {};

    const cleanCode = (codeInput || "").trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: "Lütfen bir kupon kodu giriniz." };
    }

    const coupon = Object.values(data.coupons).find(
      (c) => c.code.trim().toUpperCase() === cleanCode
    );

    if (!coupon) {
      return {
        success: false,
        message: "❌ Geçersiz kupon kodu. Lütfen kontrol edip tekrar deneyiniz.",
      };
    }

    if (!coupon.isActive) {
      return { success: false, message: "⚠️ Bu kupon şu anda aktif değildir." };
    }

    // Tarih kontrolü
    if (coupon.expiresAt) {
      const expTime = new Date(coupon.expiresAt).getTime();
      if (!isNaN(expTime) && expTime < Date.now()) {
        return { success: false, message: "⏳ Bu kuponun geçerlilik süresi dolmuştur." };
      }
    }

    // Maksimum kullanım kontrolü
    if (coupon.maxUses && coupon.maxUses > 0) {
      if (coupon.usedCount >= coupon.maxUses) {
        return {
          success: false,
          message: "🚫 Bu kuponun toplam kullanım limiti (kotası) dolmuştur.",
        };
      }
    }

    // Kullanıcı bazlı tekil kullanım kontrolü
    if (!coupon.usedByUserIds) coupon.usedByUserIds = [];
    if (coupon.usedByUserIds.includes(telegramId)) {
      return {
        success: false,
        message: "ℹ️ Bu kuponu daha önce kullandınız. Her kupon tek kullanımlıktır.",
      };
    }

    // Kullanıcıyı data üzerinde doğrudan bul veya oluştur (çift saveDb ezmesini önler)
    const cleanId = String(telegramId).trim();
    let foundKey = Object.keys(data.users).find(
      (k) => String(k).trim() === cleanId || String(data.users[k]?.telegramId).trim() === cleanId
    );
    let user = foundKey ? data.users[foundKey] : null;

    if (!user) {
      user = {
        telegramId: Number(cleanId),
        username: "",
        firstName: "Telegram Kullanıcısı",
        balance: 0,
        spent: 0,
        role: this.isAdmin(cleanId) ? "admin" : "user",
        isBanned: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      data.users[cleanId] = user;
    }

    // Kuponu kullanıldı olarak kaydet
    coupon.usedCount = (coupon.usedCount || 0) + 1;
    coupon.usedByUserIds.push(Number(cleanId));

    // 1. HEDİYE BAKİYE KUPONU (BALANCE)
    if (coupon.type === "BALANCE") {
      const bonus = Number(coupon.value) || 0;
      user.balance = Math.max(0, Number(((user.balance || 0) + bonus).toFixed(2)));
      user.lastActiveAt = new Date().toISOString();
      await saveDb(data);
      await Promise.allSettled([
        saveCouponToSql(coupon),
        saveUserToSql(user),
      ]);

      this.addLog({
        category: "COUPON",
        level: "SUCCESS",
        action: "COUPON_REDEEMED",
        details: `${user.username ? `@${user.username}` : cleanId} kullanıcısı '${coupon.code}' kuponunu kullandı. Hesaba +${bonus.toFixed(2)} ₺ eklendi (Yeni bakiye: ${user.balance.toFixed(2)} ₺).`,
        telegramId: Number(cleanId),
        username: user.username,
        metadata: { code: coupon.code, bonus, newBalance: user.balance },
      }).catch(() => {});

      return {
        success: true,
        message: `🎉 <b>Tebrikler!</b> <code>${coupon.code}</code> kuponu başarıyla kullanıldı ve hesabınıza <b>+₺${bonus.toFixed(2)}</b> hediye bakiye yüklendi!`,
        coupon,
        addedBalance: bonus,
        newBalance: user.balance,
      };
    }

    // 2. İNDİRİM KUPONU (DISCOUNT_PERCENT veya DISCOUNT_FIXED)
    if (coupon.type === "DISCOUNT_PERCENT" || coupon.type === "DISCOUNT_FIXED") {
      user.activeDiscount = {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      };
      user.lastActiveAt = new Date().toISOString();
      await saveDb(data);
      await Promise.allSettled([
        saveCouponToSql(coupon),
        saveUserToSql(user),
      ]);

      this.addLog({
        category: "COUPON",
        level: "SUCCESS",
        action: "COUPON_REDEEMED",
        details: `${user.username ? `@${user.username}` : cleanId} kullanıcısı '${coupon.code}' indirim kuponunu tanımladı (${coupon.type === "DISCOUNT_PERCENT" ? `%${coupon.value}` : `₺${coupon.value}`}).`,
        telegramId: Number(cleanId),
        username: user.username,
        metadata: { code: coupon.code, discount: user.activeDiscount },
      }).catch(() => {});

      const label =
        coupon.type === "DISCOUNT_PERCENT"
          ? `%${coupon.value}`
          : `₺${coupon.value.toFixed(2)}`;

      return {
        success: true,
        message: `🎉 <b>Tebrikler!</b> <code>${coupon.code}</code> kuponu başarıyla tanımlandı!\n\nBir sonraki numara kiralama işleminizde <b>${label}</b> indirim otomatik olarak uygulanacaktır.`,
        coupon,
        activeDiscount: user.activeDiscount,
      };
    }

    await saveDb(data);
    await Promise.allSettled([
      saveCouponToSql(coupon),
      saveUserToSql(user),
    ]);
    return { success: true, message: `Kupon başarıyla uygulandı!`, coupon };
  },

  // ==========================================
  // YEDEKLEME VE GERİ YÜKLEME SİSTEMİ (BACKUP & RESTORE)
  // ==========================================

  getFullDatabaseSnapshot(): DatabaseSchema {
    const data = loadDb();
    return {
      settings: JSON.parse(JSON.stringify(data.settings)),
      users: JSON.parse(JSON.stringify(data.users)),
      activations: JSON.parse(JSON.stringify(data.activations || {})),
      deposits: JSON.parse(JSON.stringify(data.deposits || [])),
      tickets: JSON.parse(JSON.stringify(data.tickets || {})),
      coupons: JSON.parse(JSON.stringify(data.coupons || {})),
    };
  },

  async generateSqlDump(customSnapshot?: DatabaseSchema | any): Promise<string> {
    const data = loadDb();
    const snapshot: DatabaseSchema = customSnapshot || {
      settings: JSON.parse(JSON.stringify(data.settings)),
      users: JSON.parse(JSON.stringify(data.users)),
      activations: JSON.parse(JSON.stringify(data.activations || {})),
      deposits: JSON.parse(JSON.stringify(data.deposits || [])),
      tickets: JSON.parse(JSON.stringify(data.tickets || {})),
      coupons: JSON.parse(JSON.stringify(data.coupons || {})),
    };

    const usersList: User[] = Object.values(snapshot.users || {});
    const activationsList: ActivationOrder[] = Object.values(snapshot.activations || {});
    const depositsList: DepositRequest[] = Array.isArray(snapshot.deposits)
      ? snapshot.deposits
      : Object.values(snapshot.deposits || {});
    const ticketsList: Ticket[] = Object.values(snapshot.tickets || {});
    const couponsList: Coupon[] = Object.values(snapshot.coupons || {});
    const logsList: SystemLog[] = Array.isArray(customSnapshot?.logs)
      ? customSnapshot.logs
      : Array.isArray(data.logs)
      ? data.logs
      : [];
    const backupsList: any[] = Array.isArray(customSnapshot?.backups)
      ? customSnapshot.backups
      : Array.isArray(data.backups)
      ? data.backups.map((b) => ({
          id: b.id,
          timestamp: b.timestamp,
          label: b.label,
          type: b.type,
          sizeBytes: b.sizeBytes,
          stats: b.stats,
        }))
      : [];

    const nowIso = new Date().toISOString();
    const lines: string[] = [];

    lines.push(
      `-- ============================================================`,
      `-- AzFur SMS Onay - PostgreSQL Veritabanı Yedeği (.sql)`,
      `-- Yedekleme Zamanı: ${nowIso}`,
      `-- Veritabanı Motoru: Neon Serverless PostgreSQL`,
      `-- Toplam Kullanıcı: ${usersList.length} | Sipariş: ${activationsList.length} | Bakiye Talebi: ${depositsList.length}`,
      `-- ============================================================`,
      ``,
      `SET statement_timeout = 0;`,
      `SET client_encoding = 'UTF8';`,
      `SET standard_conforming_strings = on;`,
      ``,
      `-- 1. Tablo Tanımları (DDL - Şema)`,
      `CREATE TABLE IF NOT EXISTS system_settings (`,
      `  id INT PRIMARY KEY DEFAULT 1,`,
      `  data JSONB NOT NULL,`,
      `  updated_at TIMESTAMPTZ DEFAULT NOW()`,
      `);`,
      ``,
      `CREATE TABLE IF NOT EXISTS users (`,
      `  telegram_id BIGINT PRIMARY KEY,`,
      `  username TEXT,`,
      `  first_name TEXT,`,
      `  last_name TEXT,`,
      `  balance NUMERIC(14, 4) DEFAULT 0,`,
      `  spent NUMERIC(14, 4) DEFAULT 0,`,
      `  role TEXT DEFAULT 'user',`,
      `  is_banned BOOLEAN DEFAULT false,`,
      `  is_vip BOOLEAN DEFAULT false,`,
      `  vip_since TIMESTAMPTZ,`,
      `  vip_expires_at TIMESTAMPTZ,`,
      `  vip_discount_percent INT,`,
      `  vip_note TEXT,`,
      `  active_discount JSONB,`,
      `  created_at TIMESTAMPTZ DEFAULT NOW(),`,
      `  last_active_at TIMESTAMPTZ DEFAULT NOW()`,
      `);`,
      ``,
      `CREATE TABLE IF NOT EXISTS activations (`,
      `  id TEXT PRIMARY KEY,`,
      `  telegram_id BIGINT NOT NULL,`,
      `  service_code TEXT NOT NULL,`,
      `  service_name TEXT,`,
      `  country_id INT NOT NULL,`,
      `  country_name TEXT,`,
      `  country_flag TEXT,`,
      `  phone_number TEXT,`,
      `  original_cost NUMERIC(12, 4) DEFAULT 0,`,
      `  charged_price NUMERIC(12, 4) DEFAULT 0,`,
      `  status TEXT NOT NULL DEFAULT 'WAIT_CODE',`,
      `  sms_code TEXT,`,
      `  sms_text TEXT,`,
      `  created_at BIGINT,`,
      `  expires_at BIGINT,`,
      `  notified_bot BOOLEAN DEFAULT false`,
      `);`,
      ``,
      `CREATE TABLE IF NOT EXISTS deposits (`,
      `  id TEXT PRIMARY KEY,`,
      `  telegram_id BIGINT NOT NULL,`,
      `  amount NUMERIC(14, 4) NOT NULL,`,
      `  method TEXT NOT NULL,`,
      `  status TEXT NOT NULL DEFAULT 'PENDING',`,
      `  receipt_url TEXT,`,
      `  tx_id TEXT,`,
      `  invoice_id TEXT,`,
      `  currency TEXT,`,
      `  crypto_amount NUMERIC(18, 8),`,
      `  created_at TIMESTAMPTZ DEFAULT NOW(),`,
      `  approved_at TIMESTAMPTZ`,
      `);`,
      ``,
      `CREATE TABLE IF NOT EXISTS tickets (`,
      `  id TEXT PRIMARY KEY,`,
      `  telegram_id BIGINT NOT NULL,`,
      `  subject TEXT NOT NULL,`,
      `  status TEXT NOT NULL DEFAULT 'OPEN',`,
      `  messages JSONB DEFAULT '[]'::jsonb,`,
      `  created_at TIMESTAMPTZ DEFAULT NOW(),`,
      `  updated_at TIMESTAMPTZ DEFAULT NOW()`,
      `);`,
      ``,
      `CREATE TABLE IF NOT EXISTS coupons (`,
      `  code TEXT PRIMARY KEY,`,
      `  type TEXT NOT NULL,`,
      `  value NUMERIC(12, 4) NOT NULL,`,
      `  usage_limit INT DEFAULT 1,`,
      `  used_count INT DEFAULT 0,`,
      `  used_by JSONB DEFAULT '[]'::jsonb,`,
      `  expires_at TIMESTAMPTZ,`,
      `  created_at TIMESTAMPTZ DEFAULT NOW()`,
      `);`,
      ``,
      `CREATE TABLE IF NOT EXISTS logs (`,
      `  id TEXT PRIMARY KEY,`,
      `  timestamp TIMESTAMPTZ DEFAULT NOW(),`,
      `  category TEXT NOT NULL,`,
      `  level TEXT NOT NULL,`,
      `  action TEXT NOT NULL,`,
      `  details TEXT,`,
      `  metadata JSONB`,
      `);`,
      ``,
      `CREATE TABLE IF NOT EXISTS backups (`,
      `  id TEXT PRIMARY KEY,`,
      `  timestamp TIMESTAMPTZ DEFAULT NOW(),`,
      `  note TEXT,`,
      `  data JSONB NOT NULL`,
      `);`,
      ``
    );

    // 2. system_settings
    lines.push(`-- 2. Sistem Ayarları`);
    lines.push(
      `INSERT INTO system_settings (id, data, updated_at) VALUES (1, ${escSqlJson(
        snapshot.settings
      )}, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();`,
      ``
    );

    // 3. users
    lines.push(`-- 3. Kullanıcılar (${usersList.length} kayıt)`);
    for (const u of usersList) {
      lines.push(
        `INSERT INTO users (telegram_id, username, first_name, last_name, balance, spent, role, is_banned, is_vip, vip_since, vip_expires_at, vip_discount_percent, vip_note, active_discount, created_at, last_active_at) ` +
        `VALUES (${escSqlBigInt(u.telegramId)}, ${escSqlStr(u.username)}, ${escSqlStr(u.firstName)}, ${escSqlStr(u.lastName)}, ${escSqlNum(u.balance)}, ${escSqlNum(u.spent)}, ${escSqlStr(u.role || 'user')}, ${escSqlBool(u.isBanned)}, ${escSqlBool(u.isVip)}, ${escSqlDate(u.vipSince)}, ${escSqlDate(u.vipExpiresAt)}, ${u.vipDiscountPercent ? Number(u.vipDiscountPercent) : 'NULL'}, ${escSqlStr(u.vipNote)}, ${u.activeDiscount ? escSqlJson(u.activeDiscount) : 'NULL'}, ${escSqlDate(u.createdAt)}, ${escSqlDate(u.lastActiveAt)}) ` +
        `ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, balance = EXCLUDED.balance, spent = EXCLUDED.spent, role = EXCLUDED.role, is_banned = EXCLUDED.is_banned, is_vip = EXCLUDED.is_vip, vip_since = EXCLUDED.vip_since, vip_expires_at = EXCLUDED.vip_expires_at, vip_discount_percent = EXCLUDED.vip_discount_percent, vip_note = EXCLUDED.vip_note, active_discount = EXCLUDED.active_discount, last_active_at = EXCLUDED.last_active_at;`
      );
    }
    lines.push(``);

    // 4. activations
    lines.push(`-- 4. Siparişler ve Aktivasyonlar (${activationsList.length} kayıt)`);
    for (const a of activationsList) {
      lines.push(
        `INSERT INTO activations (id, telegram_id, service_code, service_name, country_id, country_name, country_flag, phone_number, original_cost, charged_price, status, sms_code, sms_text, created_at, expires_at, notified_bot) ` +
        `VALUES (${escSqlStr(a.id)}, ${escSqlBigInt(a.telegramId)}, ${escSqlStr(a.serviceCode)}, ${escSqlStr(a.serviceName)}, ${escSqlNum(a.countryId)}, ${escSqlStr(a.countryName)}, ${escSqlStr(a.countryFlag)}, ${escSqlStr(a.phoneNumber)}, ${escSqlNum(a.originalCost)}, ${escSqlNum(a.chargedPrice)}, ${escSqlStr(a.status || 'WAIT_CODE')}, ${escSqlStr(a.smsCode)}, ${escSqlStr(a.smsText)}, ${escSqlNum(a.createdAt)}, ${escSqlNum(a.expiresAt)}, ${escSqlBool(a.notifiedBot)}) ` +
        `ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, sms_code = EXCLUDED.sms_code, sms_text = EXCLUDED.sms_text, notified_bot = EXCLUDED.notified_bot;`
      );
    }
    lines.push(``);

    // 5. deposits
    lines.push(`-- 5. Bakiye Yükleme Talepleri (${depositsList.length} kayıt)`);
    for (const d of depositsList) {
      const anyD = d as any;
      lines.push(
        `INSERT INTO deposits (id, telegram_id, amount, method, status, receipt_url, tx_id, invoice_id, currency, crypto_amount, created_at, approved_at) ` +
        `VALUES (${escSqlStr(d.id)}, ${escSqlBigInt(d.telegramId)}, ${escSqlNum(d.amount)}, ${escSqlStr(d.method)}, ${escSqlStr(d.status)}, ${escSqlStr(anyD.receiptUrl)}, ${escSqlStr(d.txid || anyD.txId)}, ${escSqlStr(anyD.invoiceId)}, ${escSqlStr(anyD.currency || 'TRY')}, ${escSqlNum(anyD.cryptoAmount)}, ${escSqlDate(d.createdAt)}, ${escSqlDate(anyD.approvedAt)}) ` +
        `ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, approved_at = EXCLUDED.approved_at, tx_id = COALESCE(EXCLUDED.tx_id, deposits.tx_id);`
      );
    }
    lines.push(``);

    // 6. tickets
    lines.push(`-- 6. Destek Talepleri (${ticketsList.length} kayıt)`);
    for (const t of ticketsList) {
      lines.push(
        `INSERT INTO tickets (id, telegram_id, subject, status, messages, created_at, updated_at) ` +
        `VALUES (${escSqlStr(t.id)}, ${escSqlBigInt(t.telegramId)}, ${escSqlStr(t.subject)}, ${escSqlStr(t.status)}, ${escSqlJson(t.messages || [])}, ${escSqlDate(t.createdAt)}, ${escSqlDate((t as any).updatedAt)}) ` +
        `ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, messages = EXCLUDED.messages, updated_at = NOW();`
      );
    }
    lines.push(``);

    // 7. coupons
    lines.push(`-- 7. İndirim ve Bakiye Kuponları (${couponsList.length} kayıt)`);
    for (const c of couponsList) {
      const anyC = c as any;
      lines.push(
        `INSERT INTO coupons (code, type, value, usage_limit, used_count, used_by, expires_at, created_at) ` +
        `VALUES (${escSqlStr(c.code)}, ${escSqlStr(c.type || 'BALANCE')}, ${escSqlNum(c.value)}, ${escSqlNum(c.maxUses || anyC.usageLimit || 1)}, ${escSqlNum(c.usedCount || 0)}, ${escSqlJson(c.usedByUserIds || anyC.usedBy || [])}, ${escSqlDate(c.expiresAt)}, ${escSqlDate(c.createdAt)}) ` +
        `ON CONFLICT (code) DO UPDATE SET used_count = EXCLUDED.used_count, used_by = EXCLUDED.used_by;`
      );
    }
    lines.push(``);

    // 8. logs
    lines.push(`-- 8. Sistem Logları (${logsList.length} kayıt)`);
    for (const l of logsList) {
      lines.push(
        `INSERT INTO logs (id, timestamp, category, level, action, details, metadata) ` +
        `VALUES (${escSqlStr(l.id)}, ${escSqlDate(l.timestamp)}, ${escSqlStr(l.category)}, ${escSqlStr(l.level)}, ${escSqlStr(l.action)}, ${escSqlStr(l.details)}, ${l.metadata ? escSqlJson(l.metadata) : 'NULL'}) ` +
        `ON CONFLICT (id) DO NOTHING;`
      );
    }
    lines.push(``);

    // 9. backups
    lines.push(`-- 9. Sistem Yedekleme Kayıtları (${backupsList.length} kayıt)`);
    for (const b of backupsList) {
      lines.push(
        `INSERT INTO backups (id, timestamp, note, data) ` +
        `VALUES (${escSqlStr(b.id)}, ${escSqlDate(b.timestamp || b.createdAt)}, ${escSqlStr(b.label || (b as any).note)}, ${escSqlJson(b)}) ` +
        `ON CONFLICT (id) DO UPDATE SET timestamp = EXCLUDED.timestamp, note = EXCLUDED.note, data = EXCLUDED.data;`
      );
    }
    lines.push(``);

    // 10. Embedded JSON Metadata for seamless Mini App Restore
    lines.push(
      `-- ============================================================`,
      `-- AZFUR_SNAPSHOT_JSON_BEGIN`,
      `-- ${JSON.stringify(snapshot)}`,
      `-- AZFUR_SNAPSHOT_JSON_END`,
      `-- ============================================================`
    );

    return lines.join("\n");
  },

  async createBackup(
    type: "AUTO" | "MANUAL" | "PRE_RESTORE" = "MANUAL",
    label?: string
  ): Promise<SystemBackup> {
    const data = loadDb();
    const now = new Date().toISOString();
    const backupId = `bk_${Date.now()}`;

    // Temiz anlık görüntü klonu (kendi içinde yedek listesini döngüsel içermesin)
    const snapshotData: DatabaseSchema = {
      settings: JSON.parse(JSON.stringify(data.settings)),
      users: JSON.parse(JSON.stringify(data.users)),
      activations: JSON.parse(JSON.stringify(data.activations || {})),
      deposits: JSON.parse(JSON.stringify(data.deposits || [])),
      tickets: JSON.parse(JSON.stringify(data.tickets || {})),
      coupons: JSON.parse(JSON.stringify(data.coupons || {})),
    };

    const usersCount = Object.keys(snapshotData.users).length;
    const activationsCount = Object.keys(snapshotData.activations).length;
    const depositsCount = (snapshotData.deposits || []).length;
    const ticketsCount = Object.keys(snapshotData.tickets).length;
    const couponsCount = Object.keys(snapshotData.coupons || {}).length;
    const totalUserBalance = Object.values(snapshotData.users).reduce(
      (sum, u) => sum + (Number(u.balance) || 0),
      0
    );

    const serialized = JSON.stringify(snapshotData);
    const sizeBytes = Buffer.byteLength(serialized, "utf8");

    const defaultLabel =
      type === "AUTO"
        ? "Otomatik Zamanlanmış Sistem Yedeği"
        : type === "PRE_RESTORE"
        ? "Geri Yükleme Öncesi Güvenlik Yedeği"
        : "Manuel Yönetici Yedeği";

    const backupRecord: SystemBackup = {
      id: backupId,
      timestamp: now,
      createdAt: now,
      type,
      label: label || defaultLabel,
      sizeBytes,
      stats: {
        usersCount,
        activationsCount,
        ordersCount: activationsCount,
        depositsCount,
        ticketsCount,
        couponsCount,
        totalUserBalance: Number(totalUserBalance.toFixed(2)),
        totalBalance: Number(totalUserBalance.toFixed(2)),
        sizeKb: Number((sizeBytes / 1024).toFixed(1)),
      },
      data: snapshotData,
    };

    if (!data.backups || !Array.isArray(data.backups)) {
      data.backups = [];
    }

    // Yeni yedeği en başa ekle
    data.backups.unshift(backupRecord);

    // Maksimum saklama sayısını uygula (varsayılan 20)
    const maxCount = data.settings.backupSettings?.maxBackupsCount || 20;
    if (data.backups.length > maxCount) {
      data.backups = data.backups.slice(0, maxCount);
    }

    // Yedekleme zamanını hem lastBackupAt hem de gerekiyorsa lastAutoBackupTime olarak kaydet
    if (!data.settings.backupSettings) {
      data.settings.backupSettings = {
        autoBackupEnabled: true,
        autoBackupIntervalHours: 6,
        maxBackupsCount: 20,
        lastBackupAt: now,
        lastBackupTime: now,
        ...(type === "AUTO" ? { lastAutoBackupTime: now } : {}),
      };
    } else {
      data.settings.backupSettings.lastBackupAt = now;
      data.settings.backupSettings.lastBackupTime = now;
      if (type === "AUTO") {
        data.settings.backupSettings.lastAutoBackupTime = now;
      }
    }

    await saveDb(data);
    await saveBackupToSql(backupRecord);

    this.addLog({
      category: "SYSTEM",
      level: "INFO",
      action: "BACKUP_CREATED",
      details: `${defaultLabel} oluşturuldu (ID: ${backupId}, Boyut: ${(sizeBytes / 1024).toFixed(1)} KB, Kullanıcı: ${usersCount}).`,
      metadata: { backupId, type, sizeBytes, usersCount, activationsCount },
    }).catch(() => {});

    return backupRecord;
  },

  getBackups(): SystemBackup[] {
    const data = loadDb();
    if (!data.backups || !Array.isArray(data.backups)) {
      return [];
    }
    // Liste ekranında çok büyük veri dönmesin diye data alanını hariç tutarak özet listeyi döndür
    return data.backups.map((b) => {
      const ts = b.timestamp || b.createdAt || new Date().toISOString();
      const sz = b.sizeBytes || 0;
      return {
        id: b.id,
        timestamp: ts,
        createdAt: ts,
        type: b.type,
        label: b.label,
        sizeBytes: sz,
        stats: {
          usersCount: b.stats?.usersCount || 0,
          activationsCount: b.stats?.activationsCount || (b.stats as any)?.ordersCount || 0,
          ordersCount: b.stats?.activationsCount || (b.stats as any)?.ordersCount || 0,
          depositsCount: b.stats?.depositsCount || 0,
          ticketsCount: b.stats?.ticketsCount || 0,
          couponsCount: b.stats?.couponsCount || 0,
          totalUserBalance: b.stats?.totalUserBalance || (b.stats as any)?.totalBalance || 0,
          totalBalance: b.stats?.totalUserBalance || (b.stats as any)?.totalBalance || 0,
          sizeKb: (b.stats as any)?.sizeKb || Number((sz / 1024).toFixed(1)),
        },
      };
    });
  },

  getBackupById(backupId: string): SystemBackup | null {
    const data = loadDb();
    if (!data.backups || !Array.isArray(data.backups)) {
      return null;
    }
    const b = data.backups.find((item) => item.id === backupId);
    if (!b) return null;
    const ts = b.timestamp || b.createdAt || new Date().toISOString();
    return {
      ...b,
      timestamp: ts,
      createdAt: ts,
    };
  },

  async deleteBackup(backupId: string): Promise<boolean> {
    const data = loadDb();
    if (!data.settings.backupSettings) {
      data.settings.backupSettings = { ...DEFAULT_BACKUP_SETTINGS };
    }
    const bs = data.settings.backupSettings;
    if (!Array.isArray(bs.deletedBackupIds)) {
      bs.deletedBackupIds = [];
    }
    if (!bs.deletedBackupIds.includes(backupId)) {
      bs.deletedBackupIds.push(backupId);
    }
    // Maksimum 500 adet tut
    if (bs.deletedBackupIds.length > 500) {
      bs.deletedBackupIds = bs.deletedBackupIds.slice(-500);
    }

    if (!data.backups || !Array.isArray(data.backups)) {
      data.backups = [];
    }
    data.backups = data.backups.filter((b) => b.id !== backupId);

    if (memoryDb) {
      if (Array.isArray(memoryDb.backups)) {
        memoryDb.backups = memoryDb.backups.filter((b) => b.id !== backupId);
      }
      if (memoryDb.settings?.backupSettings) {
        memoryDb.settings.backupSettings.deletedBackupIds = bs.deletedBackupIds;
      }
    }

    await saveDb(data, true);
    const sql = getSql();
    if (sql) {
      try {
        await sql`DELETE FROM backups WHERE id = ${backupId}`;
      } catch (e) {}
    }

    // Silme işlemini logla
    this.addLog({
      category: "SYSTEM",
      level: "WARN",
      action: "BACKUP_DELETED",
      details: `Sistem yedeği silindi (ID: ${backupId}).`,
    }).catch(() => {});

    return true;
  },

  async checkAndRunAutoBackup(force: boolean = false): Promise<SystemBackup | null> {
    if (isAutoBackupRunning) {
      return null;
    }

    const data = loadDb();
    const bs = data.settings?.backupSettings;
    if (!force && (!bs || !bs.autoBackupEnabled)) {
      return null;
    }

    const intervalHours = bs?.autoBackupIntervalHours || 6;
    const intervalMs = intervalHours * 3600 * 1000;

    const lastTimeStr =
      bs?.lastAutoBackupTime ||
      bs?.lastBackupAt ||
      bs?.lastBackupTime ||
      data.backups?.[0]?.createdAt ||
      data.backups?.[0]?.timestamp;
    const lastTime = lastTimeStr ? new Date(lastTimeStr).getTime() : 0;
    const now = Date.now();

    if (force || now - lastTime >= intervalMs) {
      try {
        isAutoBackupRunning = true;
        // Güncel veritabanı durumunu senkronize et
        await this.syncFromCloud();
        const backup = await this.createBackup("AUTO");
        console.log(`[AutoBackup] Otomatik sistem yedeği başarıyla oluşturuldu: ${backup.id} (${(backup.sizeBytes / 1024).toFixed(1)} KB)`);
        return backup;
      } catch (err) {
        console.error("[AutoBackup] Otomatik yedek alma hatası:", err);
        return null;
      } finally {
        isAutoBackupRunning = false;
      }
    }
    return null;
  },

  async triggerAutoBackupIfNeeded(): Promise<void> {
    const now = Date.now();
    // En fazla 5 dakikada bir tetikleme kontrolü yap (0ms performans etkisi)
    if (now - lastAutoBackupCheckTime < 5 * 60 * 1000) {
      return;
    }
    lastAutoBackupCheckTime = now;

    if (isAutoBackupRunning) return;

    try {
      await this.checkAndRunAutoBackup();
    } catch (err) {
      console.error("[AutoBackup Trigger Error]:", err);
    }
  },

  async restoreBackup(backupPayload: any): Promise<{ success: boolean; message: string; details: any }> {
    if (typeof backupPayload === "string") {
      const match = backupPayload.match(/-- AZFUR_SNAPSHOT_JSON_BEGIN\s*\n-- ([\s\S]*?)\s*\n-- AZFUR_SNAPSHOT_JSON_END/);
      if (match && match[1]) {
        try {
          backupPayload = JSON.parse(match[1]);
        } catch {
          throw new Error("SQL dosyasındaki yedek metadataları okunamadı.");
        }
      } else {
        try {
          backupPayload = JSON.parse(backupPayload);
        } catch {
          throw new Error("Geçersiz dosya formatı! Lütfen geçerli bir .sql veya .json AzFur yedeği yükleyin.");
        }
      }
    }

    if (!backupPayload || typeof backupPayload !== "object") {
      throw new Error("Geçersiz yedek dosyası formatı!");
    }

    // Yedek nesnesi doğrudan data içerebilir veya kök seviyede veritabanı olabilir
    const targetData: DatabaseSchema =
      backupPayload.data && typeof backupPayload.data === "object"
        ? backupPayload.data
        : backupPayload;

    if (!targetData.users || typeof targetData.users !== "object") {
      throw new Error("Yedek dosyasında 'users' (kullanıcılar) tablosu bulunamadı!");
    }
    if (!targetData.settings || typeof targetData.settings !== "object") {
      throw new Error("Yedek dosyasında 'settings' (sistem ayarları) bulunamadı!");
    }

    // 1. Önce mevcut durumu güvenlik yedeği olarak al (Asla veri kaybı yaşanmasın)
    await this.createBackup("PRE_RESTORE", "Geri Yükleme Öncesi Güvenlik Yedeği");

    const currentData = loadDb();
    const existingBackups = currentData.backups || [];

    // 2. Verileri geri yüklenen içerikle güncelle
    currentData.settings = { ...currentData.settings, ...targetData.settings };
    currentData.users = { ...targetData.users };
    currentData.activations = targetData.activations || {};
    currentData.deposits = targetData.deposits || [];
    currentData.tickets = targetData.tickets || {};
    currentData.coupons = targetData.coupons || {};
    // Mevcut yedekler geçmişini koru
    currentData.backups = existingBackups;

    await saveDb(currentData);

    const stats = {
      usersCount: Object.keys(currentData.users).length,
      activationsCount: Object.keys(currentData.activations).length,
      depositsCount: currentData.deposits.length,
      couponsCount: Object.keys(currentData.coupons).length,
    };

    this.addLog({
      category: "SYSTEM",
      level: "WARN",
      action: "BACKUP_RESTORED",
      details: `Sistem yedeği geri yüklendi! (${stats.usersCount} kullanıcı, ${stats.activationsCount} sipariş yüklendi).`,
      metadata: stats,
    }).catch(() => {});

    return {
      success: true,
      message: "Yedek başarıyla geri yüklendi! Tüm kullanıcılar, bakiyeler ve ayarlar güncellendi.",
      details: stats,
    };
  },

  async updateBackupSettings(updates: Partial<BackupSettings>): Promise<BackupSettings> {
    const data = await this.syncFromCloud(true);
    const current = data.settings.backupSettings || DEFAULT_BACKUP_SETTINGS;
    const updated = { ...current, ...updates };
    await this.updateSettings({ backupSettings: updated });
    return this.getSettings().backupSettings || updated;
  },

  // ==========================================
  // SİSTEM LOGLARI (AUDIT & ACTIVITY LOGS)
  // ==========================================
  async addLog(entry: Omit<SystemLog, "id" | "timestamp">): Promise<SystemLog> {
    const data = loadDb();
    if (!data.logs || !Array.isArray(data.logs)) {
      data.logs = [];
    }
    const logItem: SystemLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    data.logs.unshift(logItem);
    // En fazla 1000 adet log tut (şişmeyi önle)
    if (data.logs.length > 1000) {
      data.logs = data.logs.slice(0, 1000);
    }
    // Arka planda kaydet (UI/API akışını bloklama)
    saveDb(data).catch(() => {});
    saveLogToSql(logItem).catch(() => {});
    return logItem;
  },

  getLogs(filter?: {
    category?: string;
    level?: string;
    limit?: number;
    search?: string;
  }): SystemLog[] {
    const data = loadDb();
    let list = Array.isArray(data.logs) ? [...data.logs] : [];

    if (filter?.category && filter.category !== "ALL") {
      const cat = filter.category.toUpperCase();
      list = list.filter((l) => l.category === cat);
    }

    if (filter?.level && filter.level !== "ALL") {
      const lvl = filter.level.toUpperCase();
      list = list.filter((l) => l.level === lvl);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          (l.username && l.username.toLowerCase().includes(q)) ||
          (l.telegramId && String(l.telegramId).includes(q))
      );
    }

    const limit = filter?.limit && filter.limit > 0 ? filter.limit : 150;
    return list.slice(0, limit);
  },

  async clearLogs(): Promise<{ count: number }> {
    const data = loadDb();
    const count = (data.logs || []).length;
    data.logs = [];
    await saveDb(data);
    const sql = getSql();
    if (sql) {
      try {
        await sql`DELETE FROM logs`;
      } catch (e) {}
    }
    return { count };
  },

  // ==========================================
  // VIP ÜYELİK YÖNETİMİ
  // ==========================================
  async updateUserVip(
    telegramId: number | string,
    isVip: boolean,
    options?: {
      discountPercent?: number;
      expiresAt?: string | null;
      note?: string;
      userData?: Partial<User>;
    }
  ): Promise<User> {
    const data = loadDb();
    const cleanId = String(telegramId).trim();

    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    let user = foundKey ? data.users[foundKey] : null;
    if (!user) {
      user = await this.getOrCreateUser(cleanId, options?.userData);
    }

    const defaultDiscount = data.settings.vipSettings?.defaultDiscountPercent || 15;
    user.isVip = isVip;
    user.vipSince = isVip ? (user.vipSince || new Date().toISOString()) : undefined;
    user.vipDiscountPercent = isVip
      ? (options?.discountPercent !== undefined ? options.discountPercent : defaultDiscount)
      : undefined;
    user.vipExpiresAt = isVip ? (options?.expiresAt || null) : null;
    if (options?.note !== undefined) {
      user.vipNote = options.note;
    }

    await saveDb(data);
    await saveUserToSql(user);

    // Otomatik log kaydı
    this.addLog({
      category: "USER",
      level: isVip ? "SUCCESS" : "INFO",
      action: isVip ? "VIP_GRANTED" : "VIP_REVOKED",
      details: isVip
        ? `${user.firstName} (@${user.username || cleanId}) kullanıcısına VIP üyelik verildi (İndirim: %${user.vipDiscountPercent}).`
        : `${user.firstName} (@${user.username || cleanId}) kullanıcısının VIP üyeliği kaldırıldı.`,
      telegramId: Number(cleanId),
      username: user.username,
    }).catch(() => {});

    return user;
  },
};

// Arka plan periyodik kontrolcüsü (Node.js / LTS / Dev Server ortamları için)
if (typeof setInterval !== "undefined") {
  const g = global as any;
  if (!g.__azfurAutoBackupIntervalStarted) {
    g.__azfurAutoBackupIntervalStarted = true;
    setInterval(() => {
      db.triggerAutoBackupIfNeeded().catch((e) => {
        console.error("[AutoBackup Interval Error]:", e);
      });
    }, 15 * 60 * 1000); // 15 dakikada bir kontrol
  }
}
