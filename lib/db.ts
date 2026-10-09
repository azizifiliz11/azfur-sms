import fs from "fs";
import path from "path";
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
import { CONFIG } from "./config";

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

const SEED_DB_PATH = path.join(process.cwd(), "data", "db.json");
const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "db.json")
  : SEED_DB_PATH;

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoBackupEnabled: true,
  autoBackupIntervalHours: 6,
  maxBackupsCount: 20,
  lastAutoBackupTime: new Date().toISOString(),
  deletedBackupIds: [],
};

const DEFAULT_SETTINGS: SystemSettings = {
  globalMarginPercent: 35, // %35 kar
  globalFixedFee: 5.0, // +5 TL sabit
  exchangeRateToTry: 49.20, // USD to TRY
  useTcmbAutoRate: true, // TCMB'den otomatik kur
  lastTcmbRate: 49.20,
  lastTcmbFetchTime: new Date().toISOString(),
  currencySymbol: "₺",
  mockMode: false, // Default to live API
  adminTelegramId: CONFIG.ADMIN_TELEGRAM_ID,
  adminSecurityPin: "2026",
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

async function saveToCloudKv(data: DatabaseSchema): Promise<void> {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    const raw = JSON.stringify(data);
    await fetch(KV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", KV_KEY, raw]),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[Cloud KV Save Error]:", err);
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
    // Vercel ortamında seed dosyasından kopyala
    if (fs.existsSync(SEED_DB_PATH)) {
      try {
        const seedRaw = fs.readFileSync(SEED_DB_PATH, "utf8");
        fs.writeFileSync(DB_PATH, seedRaw, "utf8");
        memoryDb = JSON.parse(seedRaw);
        return memoryDb!;
      } catch (e) {
        // devam et
      }
    }

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
      data.settings.heroSmsApiKey = process.env.HERO_SMS_API_KEY || "e1006858662edcAd8d348c9f07dfe8c5";
    }
    if (!data.settings.adminSecurityPin) {
      data.settings.adminSecurityPin = "2026";
    }
    if (!data.users) data.users = {};
    if (data.users["100001"]) {
      delete data.users["100001"];
    }
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
    if (DB_PATH !== SEED_DB_PATH && fs.existsSync(path.dirname(SEED_DB_PATH))) {
      try {
        fs.writeFileSync(SEED_DB_PATH, JSON.stringify(data, null, 2), "utf8");
      } catch {}
    }
  } catch (err) {
    console.error("Error writing db.json:", err);
  }
  // Çoklu konteyner ve kalıcı bulut senkronizasyonu için Upstash KV'ye yaz (AWAIT EDİLİR - Vercel donmasını önler)
  if (syncToCloud) {
    try {
      await saveToCloudKv(data);
    } catch (e) {
      console.error("Error saving to cloud KV:", e);
    }
  }
}

export const db = {
  async syncFromCloud(force: boolean = false): Promise<DatabaseSchema> {
    const now = Date.now();
    // 15 saniye içinde önbellekte varsa ve force değilse hemen bellekten dön (0ms ağ gecikmesi)
    if (!force && memoryDb && now - lastCloudSyncTime < CLOUD_SYNC_TTL_MS) {
      return memoryDb;
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

          memoryDb = cloudData;
          lastCloudSyncTime = now;

          // Yerel belleğe ve diske de yaz
          try {
            ensureDbDirectory();
            fs.writeFileSync(DB_PATH, JSON.stringify(cloudData, null, 2), "utf8");
            if (DB_PATH !== SEED_DB_PATH && fs.existsSync(path.dirname(SEED_DB_PATH))) {
              try {
                fs.writeFileSync(SEED_DB_PATH, JSON.stringify(cloudData, null, 2), "utf8");
              } catch {}
            }
          } catch {}

          return cloudData;
        }
      }
    } catch (err) {
      console.error("[Cloud KV Sync Error]:", err);
    }
    return loadDb();
  },

  getSettings(): SystemSettings {
    const data = loadDb();
    return data.settings;
  },

  async updateSettings(partial: Partial<SystemSettings>): Promise<SystemSettings> {
    const data = loadDb();

    // Nested ayar objelerini derin birleştir (Deep Merge) - Apirone ve cüzdan bilgilerinin silinmesini kesinlikle önler
    const mergedCrypto = partial.cryptoSettings
      ? { ...(data.settings.cryptoSettings || DEFAULT_SETTINGS.cryptoSettings), ...partial.cryptoSettings }
      : data.settings.cryptoSettings;

    const mergedBank = partial.bankInfo
      ? { ...(data.settings.bankInfo || DEFAULT_SETTINGS.bankInfo), ...partial.bankInfo }
      : data.settings.bankInfo;

    const mergedBackup = partial.backupSettings
      ? { ...(data.settings.backupSettings || DEFAULT_SETTINGS.backupSettings), ...partial.backupSettings }
      : data.settings.backupSettings;

    const mergedVip = partial.vipSettings
      ? { ...(data.settings.vipSettings || DEFAULT_SETTINGS.vipSettings), ...partial.vipSettings }
      : data.settings.vipSettings;

    data.settings = {
      ...data.settings,
      ...partial,
      ...(mergedCrypto ? { cryptoSettings: mergedCrypto } : {}),
      ...(mergedBank ? { bankInfo: mergedBank } : {}),
      ...(mergedBackup ? { backupSettings: mergedBackup } : {}),
      ...(mergedVip ? { vipSettings: mergedVip } : {}),
    };
    await saveDb(data);
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
      // Bellek ve diski anında güncelle, buluta yazma kuyruğuna sokma (sıfır gecikme)
      await saveDb(data, false);
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
  },

  async updateActivation(id: string, updates: Partial<ActivationOrder>): Promise<ActivationOrder | null> {
    const data = loadDb();
    if (!data.activations[id]) return null;
    data.activations[id] = { ...data.activations[id], ...updates };
    await saveDb(data);
    return data.activations[id];
  },

  async addDeposit(deposit: DepositRequest): Promise<void> {
    const data = loadDb();
    data.deposits.unshift(deposit);
    await saveDb(data);

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
    return ticket;
  },

  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket | null> {
    const data = loadDb();
    if (!data.tickets || !data.tickets[ticketId]) return null;
    const ticket = data.tickets[ticketId];
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    await saveDb(data);
    return ticket;
  },

  async deleteTicket(ticketId: string): Promise<boolean> {
    const data = loadDb();
    if (!data.tickets || !data.tickets[ticketId]) return false;
    delete data.tickets[ticketId];
    await saveDb(data);
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
    return coupon;
  },

  async deleteCoupon(id: string): Promise<boolean> {
    const data = loadDb();
    if (!data.coupons || !data.coupons[id]) return false;
    delete data.coupons[id];
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

    // Eğer otomatik yedekse son otomatik yedekleme zamanını güncelle
    if (type === "AUTO") {
      if (!data.settings.backupSettings) {
        data.settings.backupSettings = {
          autoBackupEnabled: true,
          autoBackupIntervalHours: 6,
          maxBackupsCount: 20,
          lastAutoBackupTime: now,
        };
      } else {
        data.settings.backupSettings.lastAutoBackupTime = now;
      }
    }

    await saveDb(data);

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

    // Silme işlemini logla
    this.addLog({
      category: "SYSTEM",
      level: "WARN",
      action: "BACKUP_DELETED",
      details: `Sistem yedeği silindi (ID: ${backupId}).`,
    }).catch(() => {});

    return true;
  },

  async checkAndRunAutoBackup(): Promise<SystemBackup | null> {
    const data = loadDb();
    const bs = data.settings.backupSettings;
    if (!bs || !bs.autoBackupEnabled) {
      return null;
    }

    const intervalHours = bs.autoBackupIntervalHours || 6;
    const intervalMs = intervalHours * 3600 * 1000;
    const lastTime = bs.lastAutoBackupTime ? new Date(bs.lastAutoBackupTime).getTime() : 0;
    const now = Date.now();

    if (now - lastTime >= intervalMs) {
      return await this.createBackup("AUTO");
    }
    return null;
  },

  async restoreBackup(backupPayload: any): Promise<{ success: boolean; message: string; details: any }> {
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
    const data = loadDb();
    if (!data.settings.backupSettings) {
      data.settings.backupSettings = {
        autoBackupEnabled: true,
        autoBackupIntervalHours: 6,
        maxBackupsCount: 20,
        lastAutoBackupTime: new Date().toISOString(),
      };
    }
    data.settings.backupSettings = {
      ...data.settings.backupSettings,
      ...updates,
    };
    await saveDb(data);
    return data.settings.backupSettings;
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
