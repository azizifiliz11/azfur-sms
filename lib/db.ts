import fs from "fs";
import path from "path";
import { User, ActivationOrder, SystemSettings, DepositRequest, Ticket, TicketMessage, TicketStatus, Coupon } from "./types";
import { CONFIG } from "./config";

interface DatabaseSchema {
  settings: SystemSettings;
  users: Record<string, User>;
  activations: Record<string, ActivationOrder>;
  deposits: DepositRequest[];
  tickets: Record<string, Ticket>;
  coupons?: Record<string, Coupon>;
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
    oxapayApiKey: "",
    cryptoBotToken: "",
    autoVerifyEnabled: true,
  },
  supportTelegramUsername: "",
  supportTelegramUsernames: [],
  customStickerFileId: "",
  heroSmsApiKey: "",
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
      tickets: {},
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
    if (data.settings.supportTelegramUsername === undefined) data.settings.supportTelegramUsername = "";
    if (data.settings.supportTelegramUsernames === undefined || !Array.isArray(data.settings.supportTelegramUsernames)) {
      data.settings.supportTelegramUsernames = data.settings.supportTelegramUsername
        ? [data.settings.supportTelegramUsername]
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
    return data;
  } catch (err) {
    console.error("Error reading db.json, returning empty defaults:", err);
    return {
      settings: DEFAULT_SETTINGS,
      users: {},
      activations: {},
      deposits: [],
      tickets: {},
      coupons: {},
    };
  }
}

async function saveDb(data: DatabaseSchema): Promise<void> {
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
}

export const db = {
  async syncFromCloud(): Promise<DatabaseSchema> {
    return loadDb();
  },

  getSettings(): SystemSettings {
    const data = loadDb();
    return data.settings;
  },

  async updateSettings(partial: Partial<SystemSettings>): Promise<SystemSettings> {
    const data = loadDb();
    data.settings = { ...data.settings, ...partial };
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

  async syncTelegramUserProfile(
    telegramId: number | string,
    profile: { username?: string; firstName?: string; lastName?: string }
  ): Promise<User> {
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
        balance: isAdmin ? 500.0 : 0.0,
        spent: 0,
        role: isAdmin ? "admin" : "user",
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

      if (isAdmin && user.role !== "admin") {
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
    const isAdmin =
      cleanId === String(data.settings.adminTelegramId).trim() ||
      cleanId === "6824921456";

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
        balance: isAdmin ? 500.0 : (defaults?.balance ?? 0.0),
        spent: defaults?.spent || 0,
        role: isAdmin ? "admin" : (defaults?.role || "user"),
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

      if (defaults?.balance !== undefined) user.balance = defaults.balance;
      if (isAdmin && user.role !== "admin") {
        user.role = "admin";
      }
      await saveDb(data);
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
    const data = loadDb();
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

      const isAdmin =
        cleanId === String(data.settings.adminTelegramId).trim() ||
        cleanId === "6824921456";

      const cleanUsername = userData?.username
        ? userData.username.replace(/^@/, "").trim()
        : "";
      const cleanFirst = userData?.firstName?.trim() || "";

      user = {
        telegramId: Number(cleanId),
        username: cleanUsername,
        firstName: cleanFirst || `Telegram Kullanıcısı`,
        lastName: userData?.lastName?.trim(),
        balance: initialBal,
        spent: userData?.spent || 0,
        role: (userData?.role as "admin" | "user") || (isAdmin ? "admin" : "user"),
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
    }

    user.balance = Math.max(0, Number((user.balance + delta).toFixed(2)));
    if (delta < 0) {
      user.spent = Number(((user.spent || 0) + Math.abs(delta)).toFixed(2));
    }
    user.lastActiveAt = new Date().toISOString();
    await saveDb(data);
    return user;
  },

  async updateUserRole(
    telegramId: number | string,
    role: "admin" | "user",
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
      user = await this.getOrCreateUser(cleanId, { ...userData, role });
    } else {
      user.role = role;
      await saveDb(data);
    }
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
    let foundKey = Object.keys(data.users).find(
      (k) =>
        String(k).trim() === cleanId ||
        String(data.users[k]?.telegramId).trim() === cleanId
    );
    if (foundKey) {
      delete data.users[foundKey];
      await saveDb(data);
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
      if (foundKey && data.users[foundKey]) {
        data.users[foundKey].balance = Number(
          (data.users[foundKey].balance + dep.amount).toFixed(2)
        );
      } else {
        await this.getOrCreateUser(cleanId, {
          username: dep.username,
          balance: dep.amount,
        });
      }
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

    // Kullanıcıyı al veya oluştur
    let user = this.getUser(telegramId);
    if (!user) {
      user = await this.getOrCreateUser(telegramId);
    }

    // Kuponu kullanıldı olarak kaydet
    coupon.usedCount = (coupon.usedCount || 0) + 1;
    coupon.usedByUserIds.push(telegramId);

    // 1. HEDİYE BAKİYE KUPONU (BALANCE)
    if (coupon.type === "BALANCE") {
      const bonus = Number(coupon.value) || 0;
      await this.updateUserBalance(telegramId, bonus);
      const updatedUser = this.getUser(telegramId);
      await saveDb(data);

      return {
        success: true,
        message: `🎉 <b>Tebrikler!</b> <code>${coupon.code}</code> kuponu başarıyla kullanıldı ve hesabınıza <b>+₺${bonus.toFixed(2)}</b> hediye bakiye yüklendi!`,
        coupon,
        addedBalance: bonus,
        newBalance: updatedUser?.balance || 0,
      };
    }

    // 2. İNDİRİM KUPONU (DISCOUNT_PERCENT veya DISCOUNT_FIXED)
    if (coupon.type === "DISCOUNT_PERCENT" || coupon.type === "DISCOUNT_FIXED") {
      await this.updateUser(telegramId, {
        activeDiscount: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
        },
      });
      await saveDb(data);

      const label =
        coupon.type === "DISCOUNT_PERCENT"
          ? `%${coupon.value}`
          : `₺${coupon.value.toFixed(2)}`;

      return {
        success: true,
        message: `🎉 <b>Tebrikler!</b> <code>${coupon.code}</code> kuponu başarıyla tanımlandı!\n\nBir sonraki numara kiralama işleminizde <b>${label}</b> indirim otomatik olarak uygulanacaktır.`,
        coupon,
      };
    }

    await saveDb(data);
    return { success: true, message: `Kupon başarıyla uygulandı!`, coupon };
  },
};
