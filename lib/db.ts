import fs from "fs";
import path from "path";
import { User, ActivationOrder, SystemSettings, DepositRequest } from "./types";
import { CONFIG } from "./config";

interface DatabaseSchema {
  settings: SystemSettings;
  users: Record<string, User>;
  activations: Record<string, ActivationOrder>;
  deposits: DepositRequest[];
}

const SEED_DB_PATH = path.join(process.cwd(), "data", "db.json");
const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "db.json")
  : SEED_DB_PATH;

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
  hiddenServices: [],
  hiddenCountries: [],
  serviceCustomMargins: {},
  bankInfo: {
    bankName: "Ziraat Bankası",
    accountHolder: "AzFur SMS",
    iban: "TR00 0000 0000 0000 0000 0000 00",
    descriptionNote: "Açıklama alanına Telegram ID'nizi yazmayı unutmayınız.",
  },
  cryptoSettings: {
    usdtTrc20Address: "",
    trxAddress: "",
    cryptoBotToken: "",
    autoVerifyEnabled: true,
  },
};

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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

async function saveToCloudKv(data: DatabaseSchema) {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    const raw = JSON.stringify(data);
    await fetch(`${KV_URL}/set/${KV_KEY}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([raw]),
    });
  } catch (err) {
    console.error("[Cloud KV Save Error]:", err);
  }
}

function loadDb(): DatabaseSchema {
  ensureDbDirectory();
  if (!fs.existsSync(DB_PATH)) {
    // Vercel ortamında seed dosyasından kopyala
    if (fs.existsSync(SEED_DB_PATH)) {
      try {
        const seedRaw = fs.readFileSync(SEED_DB_PATH, "utf8");
        fs.writeFileSync(DB_PATH, seedRaw, "utf8");
        return JSON.parse(seedRaw);
      } catch (e) {
        // devam et
      }
    }

    const initialData: DatabaseSchema = {
      settings: DEFAULT_SETTINGS,
      users: {
        // Yalnızca Admin hesabı
        [CONFIG.ADMIN_TELEGRAM_ID]: {
          telegramId: parseInt(CONFIG.ADMIN_TELEGRAM_ID) || 6824921456,
          username: "admin",
          firstName: "Sistem Yöneticisi",
          balance: 500.0,
          spent: 0,
          role: "admin",
          isBanned: false,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
      },
      activations: {},
      deposits: [],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), "utf8");
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
    if (!data.users) data.users = {};
    if (data.users["100001"]) {
      delete data.users["100001"];
    }
    if (!data.activations) data.activations = {};
    if (!data.deposits) data.deposits = [];
    return data;
  } catch (err) {
    console.error("Error reading db.json, returning empty defaults:", err);
    return {
      settings: DEFAULT_SETTINGS,
      users: {},
      activations: {},
      deposits: [],
    };
  }
}

function saveDb(data: DatabaseSchema) {
  ensureDbDirectory();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing db.json:", err);
  }
  if (KV_URL && KV_TOKEN) {
    saveToCloudKv(data).catch(() => {});
  }
}

export const db = {
  async syncFromCloud(): Promise<void> {
    if (!KV_URL || !KV_TOKEN) return;
    try {
      const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        cache: "no-store",
      });
      const json = await res.json();
      if (json && json.result) {
        const cloudData: DatabaseSchema =
          typeof json.result === "string" ? JSON.parse(json.result) : json.result;
        if (cloudData && (cloudData.users || cloudData.settings)) {
          const localData = loadDb();
          const merged: DatabaseSchema = {
            settings: { ...cloudData.settings, ...localData.settings },
            users: { ...cloudData.users, ...localData.users },
            activations: { ...cloudData.activations, ...localData.activations },
            deposits: Array.isArray(cloudData.deposits) ? cloudData.deposits : localData.deposits,
          };
          ensureDbDirectory();
          fs.writeFileSync(DB_PATH, JSON.stringify(merged, null, 2), "utf8");
        }
      }
    } catch (err) {
      console.error("[Cloud KV Sync Error]:", err);
    }
  },

  getSettings(): SystemSettings {
    const data = loadDb();
    return data.settings;
  },

  updateSettings(partial: Partial<SystemSettings>): SystemSettings {
    const data = loadDb();
    data.settings = { ...data.settings, ...partial };
    saveDb(data);
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

  getOrCreateUser(telegramId: number | string, defaults?: Partial<User>): User {
    const data = loadDb();
    const cleanId = String(telegramId).trim();
    const isAdmin =
      cleanId === String(data.settings.adminTelegramId).trim() ||
      cleanId === "6824921456";

    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    if (!foundKey || !data.users[foundKey]) {
      const newUser: User = {
        telegramId: Number(cleanId),
        username: defaults?.username || `user_${cleanId}`,
        firstName: defaults?.firstName || `Kullanıcı`,
        lastName: defaults?.lastName,
        balance: isAdmin ? 500.0 : (defaults?.balance ?? 0.0),
        spent: defaults?.spent || 0,
        role: isAdmin ? "admin" : (defaults?.role || "user"),
        isBanned: defaults?.isBanned || false,
        createdAt: defaults?.createdAt || new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      data.users[cleanId] = newUser;
      saveDb(data);
      return newUser;
    } else {
      const user = data.users[foundKey];
      user.lastActiveAt = new Date().toISOString();
      if (defaults?.username) user.username = defaults.username;
      if (defaults?.firstName) user.firstName = defaults.firstName;
      if (defaults?.lastName) user.lastName = defaults.lastName;
      if (defaults?.balance !== undefined) user.balance = defaults.balance;
      if (isAdmin && user.role !== "admin") {
        user.role = "admin";
      }
      saveDb(data);
      return user;
    }
  },

  resetStats(): { activationsReset: number; depositsReset: number } {
    const data = loadDb();
    const actCount = Object.keys(data.activations || {}).length;
    const depCount = (data.deposits || []).length;
    data.activations = {};
    data.deposits = [];
    for (const key of Object.keys(data.users)) {
      data.users[key].spent = 0;
    }
    saveDb(data);
    return { activationsReset: actCount, depositsReset: depCount };
  },

  updateUserBalance(
    telegramId: number | string,
    delta: number,
    userData?: Partial<User>
  ): User {
    const data = loadDb();
    const cleanId = String(telegramId).trim();

    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    let user = foundKey ? data.users[foundKey] : null;

    if (!user) {
      // Container'da henüz yoksa, istemciden gelen kullanıcı bilgisiyle oluştur (asla 404 dönme!)
      const initialBal =
        userData?.balance !== undefined && !isNaN(Number(userData.balance))
          ? Number(userData.balance)
          : 0;

      const isAdmin =
        cleanId === String(data.settings.adminTelegramId).trim() ||
        cleanId === "6824921456";

      user = {
        telegramId: Number(cleanId),
        username: userData?.username || `user_${cleanId}`,
        firstName: userData?.firstName || `Kullanıcı`,
        lastName: userData?.lastName,
        balance: initialBal,
        spent: userData?.spent || 0,
        role: (userData?.role as "admin" | "user") || (isAdmin ? "admin" : "user"),
        isBanned: userData?.isBanned || false,
        createdAt: userData?.createdAt || new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      data.users[cleanId] = user;
    }

    user.balance = Math.max(0, Number((user.balance + delta).toFixed(2)));
    if (delta < 0) {
      user.spent = Number(((user.spent || 0) + Math.abs(delta)).toFixed(2));
    }
    user.lastActiveAt = new Date().toISOString();
    saveDb(data);
    return user;
  },

  updateUserRole(
    telegramId: number | string,
    role: "admin" | "user",
    userData?: Partial<User>
  ): User {
    const data = loadDb();
    const cleanId = String(telegramId).trim();
    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    let user = foundKey ? data.users[foundKey] : null;
    if (!user) {
      user = this.getOrCreateUser(cleanId, { ...userData, role });
    } else {
      user.role = role;
      saveDb(data);
    }
    return user;
  },

  toggleUserBan(
    telegramId: number | string,
    isBanned: boolean,
    userData?: Partial<User>
  ): User {
    const data = loadDb();
    const cleanId = String(telegramId).trim();
    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );

    let user = foundKey ? data.users[foundKey] : null;
    if (!user) {
      user = this.getOrCreateUser(cleanId, { ...userData, isBanned });
    } else {
      user.isBanned = isBanned;
      saveDb(data);
    }
    return user;
  },

  deleteUser(telegramId: number | string): boolean {
    const data = loadDb();
    const cleanId = String(telegramId).trim();
    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );
    if (foundKey) {
      delete data.users[foundKey];
      saveDb(data);
    }
    return true;
  },

  mergeUsers(incomingUsers: User[]): void {
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
      saveDb(data);
    }
  },

  getAllUsers(): User[] {
    const data = loadDb();
    return Object.values(data.users);
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

  saveActivation(order: ActivationOrder) {
    const data = loadDb();
    data.activations[order.id] = order;
    saveDb(data);
  },

  updateActivation(id: string, updates: Partial<ActivationOrder>): ActivationOrder | null {
    const data = loadDb();
    if (!data.activations[id]) return null;
    data.activations[id] = { ...data.activations[id], ...updates };
    saveDb(data);
    return data.activations[id];
  },

  addDeposit(deposit: DepositRequest) {
    const data = loadDb();
    data.deposits.unshift(deposit);
    saveDb(data);
  },

  getDeposits(): DepositRequest[] {
    const data = loadDb();
    return data.deposits;
  },

  updateDepositStatus(id: string, status: "APPROVED" | "REJECTED"): DepositRequest | null {
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
      if (foundKey && data.users[foundKey]) {
        data.users[foundKey].balance = Number(
          (data.users[foundKey].balance + dep.amount).toFixed(2)
        );
      } else {
        this.getOrCreateUser(cleanId, {
          username: dep.username,
          balance: dep.amount,
        });
      }
    }
    saveDb(data);
    return dep;
  },

  hasUsedTxid(txid: string): boolean {
    const data = loadDb();
    const clean = txid.trim().toLowerCase();
    return (data.deposits || []).some(
      (d) => d.txid && d.txid.trim().toLowerCase() === clean && d.status === "APPROVED"
    );
  },
};
