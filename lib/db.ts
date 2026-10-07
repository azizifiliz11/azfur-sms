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
}

export const db = {
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
    return data.users[String(telegramId)] || null;
  },

  getOrCreateUser(telegramId: number | string, defaults?: Partial<User>): User {
    const data = loadDb();
    const key = String(telegramId);
    const isAdmin = String(telegramId) === String(data.settings.adminTelegramId) || String(telegramId) === "6824921456";

    if (!data.users[key]) {
      data.users[key] = {
        telegramId: Number(telegramId),
        username: defaults?.username || `user_${telegramId}`,
        firstName: defaults?.firstName || `Kullanıcı`,
        lastName: defaults?.lastName,
        balance: isAdmin ? 500.0 : 0.0, // Yeni kullanıcılar 0.00 TL bakiye ile başlar
        spent: 0,
        role: isAdmin ? "admin" : "user",
        isBanned: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      saveDb(data);
    } else {
      data.users[key].lastActiveAt = new Date().toISOString();
      if (defaults?.username) data.users[key].username = defaults.username;
      if (defaults?.firstName) data.users[key].firstName = defaults.firstName;
      if (isAdmin && data.users[key].role !== "admin") {
        data.users[key].role = "admin";
      }
      saveDb(data);
    }
    return data.users[key];
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

  updateUserBalance(telegramId: number | string, delta: number): User | null {
    const data = loadDb();
    const key = String(telegramId);
    if (!data.users[key]) return null;

    data.users[key].balance = Math.max(0, Number((data.users[key].balance + delta).toFixed(2)));
    if (delta < 0) {
      data.users[key].spent = Number(((data.users[key].spent || 0) + Math.abs(delta)).toFixed(2));
    }
    saveDb(data);
    return data.users[key];
  },

  updateUserRole(telegramId: number | string, role: "admin" | "user"): User | null {
    const data = loadDb();
    const key = String(telegramId);
    if (!data.users[key]) return null;
    data.users[key].role = role;
    saveDb(data);
    return data.users[key];
  },

  toggleUserBan(telegramId: number | string, isBanned: boolean): User | null {
    const data = loadDb();
    const key = String(telegramId);
    if (!data.users[key]) return null;
    data.users[key].isBanned = isBanned;
    saveDb(data);
    return data.users[key];
  },

  deleteUser(telegramId: number | string): boolean {
    const data = loadDb();
    const key = String(telegramId);
    if (data.users[key]) {
      delete data.users[key];
      saveDb(data);
      return true;
    }
    return false;
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
      const user = data.users[String(dep.telegramId)];
      if (user) {
        user.balance = Number((user.balance + dep.amount).toFixed(2));
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
