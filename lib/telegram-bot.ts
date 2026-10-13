import { Bot, InlineKeyboard, InputFile } from "grammy";
import { after } from "next/server";
import fs from "fs";
import path from "path";
import { CONFIG } from "./config";
import { APP_BUILD_VERSION } from "./app-version";
import { db } from "./db";
import { heroSms, heroErrorMessage } from "./hero-sms";
import {
  cancelOrderWithRefund,
  EARLY_CANCEL_MS,
  finishOrderAtProvider,
  isRentOrder,
  RENT_FREE_CANCEL_MS,
  syncOrderWithProvider,
} from "./orders";
import { pricingEngine } from "./pricing";
import { ActivationOrder, SystemSettings, User } from "./types";
import { rateLimiter } from "./rate-limit";

let botInstance: Bot | null = null;
const pendingRestoreMap = new Map<number, any>();

/**
 * İşi HTTP cevabı Telegram'a döndükten SONRA çalıştırır (Vercel waitUntil).
 * İstek kapsamı dışında çağrılırsa (script, polling vb.) arka planda hemen başlatır.
 */
export function runAfterResponse(task: () => Promise<unknown> | unknown): void {
  const safeTask = async () => {
    try {
      await task();
    } catch (e) {
      console.error("runAfterResponse task error:", e);
    }
  };
  try {
    after(safeTask);
  } catch {
    void safeTask();
  }
}

// Karşılama bannerının Telegram file_id önbelleği.
// URL ile gönderimde Telegram görseli her seferinde sunucumuzdan indirir (yavaş);
// file_id ile gönderimde görsel Telegram'ın kendi CDN'inden anında iletilir.
// Format: "<APP_BUILD_VERSION>::<file_id>" — sürüm değişince (yeni banner) otomatik yenilenir.
let bannerFileIdMemo: string | null = null;
function getCachedBannerFileId(settings: SystemSettings = db.getSettings()): string | null {
  const raw = bannerFileIdMemo || settings.bannerFileId || "";
  const [version, fileId] = raw.split("::");
  return version === APP_BUILD_VERSION && fileId ? fileId : null;
}
function rememberBannerFileId(fileId: string | undefined): void {
  if (!fileId) return;
  const value = `${APP_BUILD_VERSION}::${fileId}`;
  if (bannerFileIdMemo === value) return;
  bannerFileIdMemo = value;
  if (db.getSettings().bannerFileId !== value) {
    runAfterResponse(() => db.updateSettings({ bannerFileId: value }));
  }
}
function forgetBannerFileId(): void {
  bannerFileIdMemo = null;
}

// Sohbet menü butonu sıfırlaması her /start'ta değil, süreç başına sohbet başına bir kez yapılır
const menuButtonResetChats = new Set<number>();

/**
 * /start ve /menu karşılamasını webhook HTTP yanıtının İÇİNDE gönderilecek Bot API çağrısı olarak hazırlar.
 * Telegram bu çağrıyı doğrudan yürütür: ayrı bir sendPhoto/sendMessage API turu beklenmez.
 * Ban, bakım modu, hız sınırı veya banner file_id'si henüz yoksa null döner (normal grammY yolu).
 */
export function buildWelcomeWebhookReply(params: {
  message: any;
  user: User | null;
  activeCount: number;
  settings: SystemSettings;
  isAdmin: boolean;
}): Record<string, unknown> | null {
  const { message, settings, isAdmin } = params;
  const from = message?.from;
  const chatId = message?.chat?.id;
  if (!from?.id || !chatId) return null;

  if (!isAdmin) {
    if (params.user?.isBanned || settings.maintenanceMode) return null;
    if (!rateLimiter.check(`tg_msg_${from.id}`, 5, 4).allowed) return null;
  }

  const user: User = params.user || {
    telegramId: Number(from.id),
    username: (from.username || "").replace(/^@/, "").trim(),
    firstName: (from.first_name || "").trim() || "Telegram Kullanıcısı",
    balance: 0,
    spent: 0,
    role: isAdmin ? "admin" : "user",
    isBanned: false,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  const { appUrl, adminUrl } = getAppUrls();
  const text = buildMainMenuText(user, from.first_name, params.activeCount);
  const reply_markup = buildMainMenuKeyboard(isAdmin || user.role === "admin", appUrl, adminUrl);

  if (settings.useBannerPhoto !== false) {
    const fileId = getCachedBannerFileId(settings);
    if (!fileId) return null; // İlk gönderimde file_id öğrenilmeli: normal yol
    return { method: "sendPhoto", chat_id: chatId, photo: fileId, caption: text, parse_mode: "HTML", reply_markup };
  }
  return { method: "sendMessage", chat_id: chatId, text, parse_mode: "HTML", reply_markup };
}

/** Hızlı karşılamanın kalıcı yan etkileri (kullanıcı kaydı, menü butonu); yanıttan SONRA çalışır. */
export async function runWelcomeSideEffects(message: any): Promise<void> {
  const from = message?.from;
  if (!from?.id) return;
  const profile = { username: from.username, firstName: from.first_name, lastName: from.last_name };
  if (db.getUser(from.id)) {
    await db.touchUserActive(from.id, profile);
  } else {
    await db.getOrCreateUser(from.id, profile);
  }
  if (message.chat?.type === "private" && !menuButtonResetChats.has(from.id) && CONFIG.TELEGRAM_BOT_TOKEN) {
    menuButtonResetChats.add(from.id);
    await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: from.id, menu_button: { type: "default" } }),
    }).catch(() => {});
  }
}

// Popüler Servis Tanımları
const POPULAR_SERVICES = [
  { code: "wa", name: "WhatsApp", icon: "🟢" },
  { code: "tg", name: "Telegram", icon: "✈️" },
  { code: "dr", name: "OpenAI / ChatGPT", icon: "🤖" },
  { code: "ig", name: "Instagram", icon: "📸" },
  { code: "go", name: "Google / Gmail", icon: "🔴" },
  { code: "lf", name: "TikTok", icon: "🎵" },
  { code: "tw", name: "Twitter / X", icon: "🐦" },
  { code: "ds", name: "Discord", icon: "💬" },
];

// Popüler Ülke Tanımları
const POPULAR_COUNTRIES = [
  { id: 62, name: "Türkiye", flag: "🇹🇷" },
  { id: 187, name: "ABD", flag: "🇺🇸" },
  { id: 16, name: "İngiltere", flag: "🇬🇧" },
  { id: 43, name: "Almanya", flag: "🇩🇪" },
  { id: 0, name: "Rusya", flag: "🇷🇺" },
  { id: 48, name: "Hollanda", flag: "🇳🇱" },
  { id: 73, name: "Brezilya", flag: "🇧🇷" },
  { id: 6, name: "Endonezya", flag: "🇮🇩" },
  { id: 2, name: "Kazakistan", flag: "🇰🇿" },
];

function getAppUrls() {
  const rawUrl = (CONFIG.APP_URL || "").trim();
  const baseUrl = rawUrl.startsWith("https://")
    ? rawUrl.replace(/\/$/, "")
    : "https://azfur-sms.vercel.app";
  const vTag = APP_BUILD_VERSION;
  return {
    appUrl: `${baseUrl}?v=${vTag}`,
    adminUrl: `${baseUrl}/admin?v=${vTag}`,
    bannerUrl: `${baseUrl}/azfur-banner.jpg?v=${vTag}`,
  };
}

export function getAdminUsernamesList(): string[] {
  const settings = db.getSettings();
  const list = new Set<string>();

  // 1. Settings'te tanımlı destek / yönetici kullanıcı adları (Admin panelinde eklenenler)
  const rawSupport = Array.isArray(settings.supportTelegramUsernames)
    ? settings.supportTelegramUsernames
    : settings.supportTelegramUsername
    ? [settings.supportTelegramUsername]
    : [];
  rawSupport.forEach((u) => {
    const clean = String(u).replace(/^@/, "").trim();
    if (clean) list.add(clean);
  });

  // 2. Veritabanındaki admin Telegram ID'leri ile eşleşen kullanıcıların kullanıcı adları
  const adminIds = db.getAdminTelegramIds();
  for (const id of adminIds) {
    const user = db.getUser(id);
    if (user?.username) {
      const clean = user.username.replace(/^@/, "").trim();
      if (clean) list.add(clean);
    }
  }

  // 3. Veritabanında role === 'admin' veya db.isAdmin olan tüm kullanıcılar
  const allUsers = db.getAllUsers();
  for (const u of allUsers) {
    if (u && (u.role === "admin" || db.isAdmin(u.telegramId))) {
      if (u.username) {
        const clean = u.username.replace(/^@/, "").trim();
        if (clean) list.add(clean);
      }
    }
  }

  return Array.from(list);
}

// ==========================================
// ANİMASYONLU GÖRSEL VE STİCKER MOTORU
// ==========================================
async function sendAnimatedVisual(ctx: any, _fallbackDice?: string) {
  try {
    const settings = db.getSettings();
    if (settings.customStickerFileId && settings.customStickerFileId.trim()) {
      await ctx.replyWithSticker(settings.customStickerFileId.trim());
    }
  } catch (e) {}
}

function buildMainMenuText(user: User, firstName: string, activeCount: number): string {
  const safeName = (firstName || "Kullanıcı").replace(/[<>&]/g, "");
  const vipLine = user.isVip
    ? `⭐ <b>Üyelik Durumu:</b> <b>VIP Üye (%${user.vipDiscountPercent || 15} Özel İndirim)</b>\n`
    : `💎 <b>Üyelik:</b> Standart Üye\n`;

  return (
    `⚡ ━━━━━━━━━━━━━━━━━━━━ ⚡\n` +
    `       💠 <b>AZFUR SMS ONAY</b> 💠\n` +
    `✨ <i>Sanal Numara & Hızlı SMS Servisi</i> ✨\n` +
    `⚡ ━━━━━━━━━━━━━━━━━━━━ ⚡\n\n` +
    `👋 <b>Hoş Geldiniz, ${safeName}!</b>\n\n` +
    vipLine +
    `💰 <b>Mevcut Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n` +
    `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
    `📦 <b>Bekleyen Aktif Onay:</b> <code>${activeCount} adet</code>\n\n` +
    `🔥 <i>WhatsApp, Telegram, ChatGPT ve yüzlerce servis için tek dokunuşla sanal numara kiralayın.</i>\n\n` +
    `👇 <b>Hemen işlem yapmak için aşağıdaki butonları kullanın:</b>`
  );
}

function buildMainMenuKeyboard(isAdmin: boolean, appUrl: string, adminUrl: string): InlineKeyboard {
  const kb = new InlineKeyboard()
    .webApp("🚀 Web Mini App'i Aç", appUrl)
    .row()
    .text("🛒 Numara Satın Al", "btn_buy_menu")
    .text("📜 Numaralarım", "btn_my_orders")
    .row()
    .text("💳 Bakiye Yükle", "btn_deposit_menu")
    .text("🎁 Kupon Kullan", "btn_coupon_info")
    .row()
    .text("👤 Profilim & Bakiye", "btn_my_profile")
    .text("🆘 Yardım & Destek", "btn_help_info");

  if (isAdmin) {
    kb.row()
      .text("👑 Yönetici Menüsü", "btn_admin_menu")
      .webApp("🛡️ Web Admin Paneli", adminUrl);
  }

  return kb;
}

// Bot mesajlarında servis adının önündeki emoji. ServiceItem.icon bir simge anahtarıdır ("whatsapp", "other"),
// doğrudan yazılınca mesajda "other Instagram" gibi görünüyordu.
const SERVICE_EMOJI: Record<string, string> = {
  wa: "💬", tg: "✈️", dr: "🤖", go: "🔍", ig: "📸", ds: "🎮", fb: "📘", lf: "🎵", tw: "🐦",
  wb: "💚", vi: "💜", mm: "🪟", mb: "📧", am: "📦", full: "📅",
};
function serviceEmoji(code: string | undefined): string {
  return SERVICE_EMOJI[String(code || "")] || "📱";
}

async function editOrReply(ctx: any, text: string, keyboard: InlineKeyboard) {
  try {
    if (ctx.callbackQuery?.message?.photo) {
      // Fotoğraflı bir mesajdan (örneğin ödeme QR kodu) menülere dönerken
      // QR kodunun her menünün tepesinde kalmasını engellemek için eski fotoğraflı mesajı sil ve temiz metin gönder
      try {
        await ctx.deleteMessage();
      } catch {}
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      return;
    } else if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      return;
    }
  } catch (err: any) {
    // İçerik aynıysa (aynı butona tekrar basıldı) yeni mesaj atma; aksi halde yeni mesaj olarak gönder
    if (String(err?.description || err?.message || "").includes("message is not modified")) return;
  }

  try {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (e) {
    console.error("editOrReply fallback error:", e);
  }
}

export async function fetchTelegramUserInfo(
  telegramId: number | string
): Promise<{ firstName?: string; lastName?: string; username?: string } | null> {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/getChat?chat_id=${telegramId}`
    );
    const data = await res.json();
    if (data.ok && data.result) {
      return {
        firstName: data.result.first_name || undefined,
        lastName: data.result.last_name || undefined,
        username: data.result.username ? data.result.username.replace(/^@/, "").trim() : undefined,
      };
    }
  } catch (err) {
    // getChat may fail if user never contacted bot or blocked
  }
  return null;
}

let cachedBotInfo: any = null;

export function getTelegramBot(): Bot | null {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) {
    return null;
  }
  if (!botInstance) {
    const settings = db.getSettings();
    const botInfo = cachedBotInfo || settings.botInfo;
    botInstance = new Bot(CONFIG.TELEGRAM_BOT_TOKEN, {
      ...(botInfo ? { botInfo } : {}),
    });

    // ==========================================
    // 0.0. BUTON CEVABI (answerCallbackQuery) TEK SEFERLİK
    // ==========================================
    // Telegram bir buton tıklamasına yalnızca BİR KEZ cevap verilmesine izin verir. Önceden her tıklama
    // hemen boş cevaplanıyordu; sonradan gösterilmek istenen uyarılar ("ilk 2 dakika iptal edilemez",
    // "henüz kod gelmedi" ...) sessizce düşüyor ve buton tepki vermiyor gibi görünüyordu. Artık ilk
    // cevap kazanır; işleyici cevap vermediyse işlem bitince boş cevapla yükleniyor çemberi kapatılır.
    botInstance.use(async (ctx, next) => {
      if (!ctx.callbackQuery) return next();
      let answered = false;
      const answer = ctx.answerCallbackQuery.bind(ctx);
      ctx.answerCallbackQuery = ((...args: Parameters<typeof answer>) => {
        if (answered) return Promise.resolve(true);
        answered = true;
        return answer(...args);
      }) as typeof ctx.answerCallbackQuery;
      try {
        await next();
      } finally {
        if (!answered) await ctx.answerCallbackQuery().catch(() => {});
      }
    });

    // ==========================================
    // 0. GLOBAL KULLANICI PROFİL SENKRONİZASYON MİDDLEWARE (SIFIR GECİKME - NON-BLOCKING)
    // ==========================================
    botInstance.use(async (ctx, next) => {
      const from = ctx.from;
      if (from && from.id) {
        const command = ctx.message?.text?.trim().split(/\s/, 1)[0] || "";
        const isWelcomeCommand = /^\/(?:start|menu)(?:@\w+)?$/i.test(command);
        // Kullanıcı aktifliğini arka planda non-blocking güncelle (kullanıcıyı 1 milisaniye bile bekletmez)
        // /start and /menu persist their profile after the menu has been sent,
        // so a synchronous local snapshot write cannot delay the first reply.
        if (!isWelcomeCommand) {
          db.touchUserActive(from.id, {
            username: from.username,
            firstName: from.first_name,
            lastName: from.last_name,
          }).catch(() => {});
        }
      }
      await next();
    });

    // ==========================================
    // 0.1. BANLI KULLANICI ENGELLEME MİDDLEWARE
    // ==========================================
    botInstance.use(async (ctx, next) => {
      const from = ctx.from;
      if (!from || !from.id) return next();

      // Adminler asla ban kontrolüne takılmaz
      if (db.isAdmin(from.id)) {
        return next();
      }

      const user = db.getUser(from.id);
      if (user && user.isBanned) {
        const adminUsernames = getAdminUsernamesList();
        const adminsText = adminUsernames.length > 0
          ? adminUsernames.map((u) => `• <b>@${u}</b>`).join("\n")
          : "Henüz bir destek yöneticisi tanımlanmamış.";

        const text =
          `🚫 <b>HESABINIZ ENGELLENDİ (BANLANDINIZ)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Sistem kuralları veya yönetici kararı doğrultusunda AzFur SMS botuna erişiminiz durdurulmuştur.\n\n` +
          `Banınızın kaldırılması veya bilgi almak için aşağıdaki yöneticilerle iletişime geçebilirsiniz:\n\n` +
          `👑 <b>Yöneticiler:</b>\n` +
          `${adminsText}`;

        const kb = new InlineKeyboard();
        for (const u of adminUsernames) {
          kb.url(`💬 Yöneticiye Yaz (@${u})`, `https://t.me/${u}`).row();
        }

        if (ctx.callbackQuery) {
          try {
            await ctx.answerCallbackQuery({
              text: "🚫 Hesabınız engellendi! Bota erişemezsiniz.",
              show_alert: true,
            });
          } catch (e) {}
          try {
            await ctx.editMessageText(text, {
              parse_mode: "HTML",
              reply_markup: kb,
            });
          } catch (e) {}
        } else {
          try {
            await ctx.reply(text, {
              parse_mode: "HTML",
              reply_markup: kb,
            });
          } catch (e) {}
        }
        return; // Bota erişim kesinlikle engellenir
      }

      await next();
    });

    // ==========================================
    // 0.2. TELEGRAM BOT & BUTON RATE LIMIT MİDDLEWARE
    // ==========================================
    botInstance.use(async (ctx, next) => {
      const from = ctx.from;
      if (!from || !from.id) return next();

      // Adminler rate limit kontrolünden muaftır
      if (db.isAdmin(from.id)) {
        return next();
      }

      const isCallback = Boolean(ctx.callbackQuery);
      const actionType = isCallback ? "button" : "msg";
      // Butonlar: 3 saniyede max 4 tıklama | Mesajlar: 4 saniyede max 5 istek
      const maxReqs = isCallback ? 4 : 5;
      const windowSec = isCallback ? 3 : 4;

      const check = rateLimiter.check(`tg_${actionType}_${from.id}`, maxReqs, windowSec);
      if (!check.allowed) {
        if (isCallback) {
          try {
            await ctx.answerCallbackQuery({
              text: `⚠️ Çok hızlı basıyorsunuz! Lütfen ${check.retryAfterSeconds} saniye bekleyin.`,
              show_alert: false,
            });
          } catch (e) {}
        } else {
          try {
            await ctx.reply(
              `⚠️ <b>Çok hızlı işlem yapıyorsunuz!</b>\nLütfen <code>${check.retryAfterSeconds}</code> saniye bekleyip tekrar deneyin.`,
              { parse_mode: "HTML" }
            );
          } catch (e) {}
        }
        return;
      }

      await next();
    });

    // ==========================================
    // 0.3. SİSTEM BAKIM MODU (MAINTENANCE MODE) KONTROLÜ
    // ==========================================
    botInstance.use(async (ctx, next) => {
      const from = ctx.from;
      if (!from || !from.id) return next();

      // Adminler bakım modundan muaftır, sisteme her zaman tam ve sınırsız erişebilir
      if (db.isAdmin(from.id)) {
        return next();
      }

      // Kullanıcı "Durumu Tekrar Kontrol Et" butonuna bastıysa (anında buluttan kontrol et ve karşıla)
      if (ctx.callbackQuery && ctx.callbackQuery.data === "btn_check_maintenance") {
        await db.syncFromCloud(true);
        const freshSettings = db.getSettings();

        if (freshSettings.maintenanceMode) {
          try {
            await ctx.answerCallbackQuery({
              text: "🛠️ Bakım çalışması halen devam ediyor. Numara almak için yöneticilerimizle iletişime geçebilirsiniz.",
              show_alert: true,
            });
          } catch (e) {}

          const adminUsernames = getAdminUsernamesList();
          const adminsText = adminUsernames.length > 0
            ? adminUsernames.map((u) => `• <b>@${u}</b>`).join("\n")
            : "Yöneticilerimizle doğrudan iletişime geçebilirsiniz.";
          const customMsg = freshSettings.maintenanceMessage?.trim();
          const text =
            customMsg ||
            (
              `🛠️ <b>KISA BİR MOLA! SİSTEMİMİZ BAKIMDADIR</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Değerli Kullanıcımız,\n\n` +
              `Sizlere daha kaliteli, hızlı ve kesintisiz hizmet sunabilmek amacıyla sistemimizde kısa süreli bir <b>altyapı bakım ve güncelleme çalışması</b> yapmaktayız. ✨\n\n` +
              `⏳ <b>Bu süreçte botumuz ve web uygulamamız geçici olarak otomatik işlemlere kapalıdır.</b>\n\n` +
              `📞 <b>Numara almak, bakiye yüklemek veya bilgi almak için lütfen yöneticilerimizle doğrudan iletişime geçiniz:</b>\n\n` +
              `👑 <b>Yöneticilerimiz:</b>\n` +
              `${adminsText}\n\n` +
              `Anlayışınız ve sabrınız için teşekkür ederiz! ❤️`
            );

          const kb = new InlineKeyboard();
          for (const u of adminUsernames) {
            kb.url(`💬 Yöneticiye Yaz (@${u})`, `https://t.me/${u}`).row();
          }
          kb.text("🔄 Durumu Tekrar Kontrol Et", "btn_check_maintenance");

          try {
            await ctx.editMessageText(text, {
              parse_mode: "HTML",
              reply_markup: kb,
            });
          } catch (e) {}
          return;
        } else {
          // Bakım modu sonlandırılmış! Anında ana menüyü aç
          try {
            await ctx.answerCallbackQuery({
              text: "🎉 Bakım tamamlandı! Sistem yeniden açıldı.",
              show_alert: false,
            });
          } catch (e) {}

          const { appUrl, adminUrl } = getAppUrls();
          const user =
            db.getUser(from.id) ||
            (await db.getOrCreateUser(from.id, {
              username: from.username,
              firstName: from.first_name,
              lastName: from.last_name,
            }));
          const isAdmin = db.isAdmin(from.id) || user.role === "admin";
          const activeOrders = db.getActiveOrders(from.id);
          const messageText = buildMainMenuText(user, from.first_name, activeOrders.length);
          const keyboard = buildMainMenuKeyboard(isAdmin, appUrl, adminUrl);

          await editOrReply(ctx, messageText, keyboard);
          return;
        }
      }

      const settings = db.getSettings();
      if (settings.maintenanceMode) {
        const adminUsernames = getAdminUsernamesList();
        const adminsText = adminUsernames.length > 0
          ? adminUsernames.map((u) => `• <b>@${u}</b>`).join("\n")
          : "Yöneticilerimizle doğrudan iletişime geçebilirsiniz.";

        const customMsg = settings.maintenanceMessage?.trim();
        const text =
          customMsg ||
          (
            `🛠️ <b>KISA BİR MOLA! SİSTEMİMİZ BAKIMDADIR</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Değerli Kullanıcımız,\n\n` +
            `Sizlere daha kaliteli, hızlı ve kesintisiz hizmet sunabilmek amacıyla sistemimizde kısa süreli bir <b>altyapı bakım ve güncelleme çalışması</b> yapmaktayız. ✨\n\n` +
            `⏳ <b>Bu süreçte botumuz ve web uygulamamız geçici olarak otomatik işlemlere kapalıdır.</b>\n\n` +
            `📞 <b>Numara almak, bakiye yüklemek veya bilgi almak için lütfen yöneticilerimizle doğrudan iletişime geçiniz:</b>\n\n` +
            `👑 <b>Yöneticilerimiz:</b>\n` +
            `${adminsText}\n\n` +
            `Anlayışınız ve sabrınız için teşekkür ederiz! ❤️`
          );

        const kb = new InlineKeyboard();
        for (const u of adminUsernames) {
          kb.url(`💬 Yöneticiye Yaz (@${u})`, `https://t.me/${u}`).row();
        }
        kb.text("🔄 Durumu Tekrar Kontrol Et", "btn_check_maintenance");

        if (ctx.callbackQuery) {
          try {
            await ctx.answerCallbackQuery({
              text: "🛠️ Sistemimiz şu anda bakımdadır.",
              show_alert: true,
            });
          } catch (e) {}
          try {
            await ctx.editMessageText(text, {
              parse_mode: "HTML",
              reply_markup: kb,
            });
          } catch (e) {}
        } else {
          try {
            await ctx.reply(text, {
              parse_mode: "HTML",
              reply_markup: kb,
            });
          } catch (e) {}
        }
        return; // Normal kullanıcı için akışı burada durdur
      }

      await next();
    });

    // ==========================================
    // 1. /start VE /menu KOMUTLARI (ŞİMŞEK HIZINDA KARŞILAMA)
    // ==========================================
    const sendWelcome = async (ctx: any) => {
      const from = ctx.from;
      if (!from) return;

      const profile = {
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
      };

      // Mevcut kullanıcı: bellekten anında. Yeni kullanıcı: menü için geçici kayıt,
      // kalıcı kayıt (disk + SQL) cevap gönderildikten SONRA yapılır.
      const existingUser = db.getUser(from.id);
      const user: User = existingUser || {
        telegramId: Number(from.id),
        username: (from.username || "").replace(/^@/, "").trim(),
        firstName: (from.first_name || "").trim() || "Telegram Kullanıcısı",
        lastName: from.last_name ? from.last_name.trim() : undefined,
        balance: 0,
        spent: 0,
        role: db.isAdmin(from.id) ? "admin" : "user",
        isBanned: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };

      const { appUrl, adminUrl, bannerUrl } = getAppUrls();
      const isAdmin = db.isAdmin(from.id) || user.role === "admin";

      const activeOrders = db.getActiveOrders(from.id);
      const messageText = buildMainMenuText(user, from.first_name, activeOrders.length);
      const keyboard = buildMainMenuKeyboard(isAdmin, appUrl, adminUrl);
      const usePhoto = db.getSettings().useBannerPhoto !== false;

      let sent = false;
      if (usePhoto) {
        const cachedFileId = getCachedBannerFileId();
        const photoSources = cachedFileId ? [cachedFileId, bannerUrl] : [bannerUrl];
        for (const photo of photoSources) {
          try {
            const msg = await ctx.replyWithPhoto(photo, {
              caption: messageText,
              parse_mode: "HTML",
              reply_markup: keyboard,
            });
            const sizes = msg?.photo;
            rememberBannerFileId(Array.isArray(sizes) && sizes.length ? sizes[sizes.length - 1].file_id : undefined);
            sent = true;
            break;
          } catch (photoErr: any) {
            if (photo === cachedFileId) forgetBannerFileId();
            console.warn("sendWelcome banner photo gönderilemedi:", photoErr?.message || photoErr);
          }
        }
      }

      if (!sent) {
        await ctx.reply(messageText, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      }

      // Cevap gönderildi — kalıcı işlemler kullanıcıyı bekletmeden arka planda
      runAfterResponse(async () => {
        if (existingUser) {
          await db.touchUserActive(from.id, profile);
        } else {
          await db.getOrCreateUser(from.id, profile);
        }
      });

      if (ctx.chat?.type === "private" && !menuButtonResetChats.has(from.id)) {
        menuButtonResetChats.add(from.id);
        // BotFather'da belirlenen menü butonu adını ve ayarını kullanmak için
        // sohbete özel "AzFur" zorlamasını kaldırıp BotFather varsayılanına sıfırlıyoruz.
        runAfterResponse(() =>
          ctx.api.setChatMenuButton({ chat_id: from.id, menu_button: { type: "default" } }).catch(() => {})
        );
      }
    };

    botInstance.command("start", sendWelcome);
    botInstance.command("menu", sendWelcome);

    // /admin Komutu (GÜVENLİK DOĞRULAMASI İLE KORUMALI)
    botInstance.command("admin", async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      await db.syncFromCloud();
      const user = db.getUser(from.id);
      const isAdmin = db.isAdmin(from.id) || user?.role === "admin";

      if (!isAdmin) {
        // Admin dışında hiçbir kullanıcıya kesinlikle tepki verme, sessizce yok say
        return;
      }

      const { adminUrl } = getAppUrls();
      const kb = new InlineKeyboard()
        .webApp("🛡️ Yönetici Panelini Aç", adminUrl)
        .row()
        .text("📊 Hızlı İstatistikler", "btn_admin_menu")
        .text("📦 Yedekleme & Geri Yükleme", "adm_bkp_menu")
        .row()
        .text("🔙 Ana Menü", "btn_main_menu");

      await ctx.reply(
        `👑 <b>AzFur Yönetici Paneli</b>\n\n` +
          `• Canlı TCMB kuru ve kâr marjı yönetimi\n` +
          `• Kullanıcı bakiyeleri ve yetkilendirme\n` +
          `• Kupon & Promosyon yönetimi\n` +
          `• Banlama ve güvenlik ayarları\n` +
          `• Toplu duyuru ve push bildirimleri\n\n` +
          `Aşağıdaki butonlara tıklayarak işlem yapabilirsiniz 👇`,
        {
          parse_mode: "HTML",
          reply_markup: kb,
        }
      );
    });

    // /bakim veya /maintenance Komutu (Yalnızca Admin)
    botInstance.command(["bakim", "maintenance"], async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      await db.syncFromCloud();
      const isAdmin = db.isAdmin(from.id);
      if (!isAdmin) return;

      const current = db.getSettings();
      const newMode = !current.maintenanceMode;
      await db.updateSettings({ maintenanceMode: newMode });

      db.addLog({
        category: "ADMIN",
        level: newMode ? "WARN" : "SUCCESS",
        action: newMode ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED",
        details: `Yönetici ${from.first_name || ""} (@${from.username || from.id}) /bakim komutuyla bakım modunu ${newMode ? "AÇTI" : "KAPATTI"}.`,
        telegramId: from.id,
        username: from.username,
      }).catch(() => {});

      const kb = new InlineKeyboard().text(
        newMode ? "🟢 Bakım Modunu Kapat" : "🔴 Sistemi Bakıma Al",
        "adm_toggle_maintenance"
      );

      await ctx.reply(
        newMode
          ? `🛠️ <b>SİSTEM BAKIMA ALINDI!</b>\n━━━━━━━━━━━━━━━━━━━━\nNormal kullanıcıların bot ve Mini App üzerinden numara alımı durduruldu.\n\nYöneticiler tüm özellikleri kullanmaya ve test etmeye devam edebilir.\n\nKapatmak için tekrar <code>/bakim</code> yazabilir veya butona tıklayabilirsiniz.`
          : `🟢 <b>BAKIM MODU KAPATILDI!</b>\n━━━━━━━━━━━━━━━━━━━━\nSistem tüm kullanıcılar için yeniden aktif ve kullanıma açıldı.`,
        {
          parse_mode: "HTML",
          reply_markup: kb,
        }
      );
    });

    // /kupon Komutu
    botInstance.command("kupon", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      await sendAnimatedVisual(ctx, "🎯");

      const rawText = ctx.message?.text || "";
      const parts = rawText.trim().split(/\s+/);
      const codeInput = parts[1];

      if (!codeInput) {
        await ctx.reply(
          `🎁 <b>Kupon Kodu Kullanımı</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Promosyon veya hediye kuponunuzu kullanmak için komutun yanına kodunuzu yazın:\n\n` +
          `👉 <code>/kupon KODUNUZ</code>\n\n` +
          `<i>Örnek Kullanım: <code>/kupon HOSGELDIN</code></i>`,
          {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard()
              .text("💳 Bakiye Yükle", "btn_deposit_menu")
              .text("🔙 Ana Menü", "btn_main_menu"),
          }
        );
        return;
      }

      await db.syncFromCloud();
      const redeemRes = await db.redeemCoupon(codeInput, from.id);

      if (!redeemRes.success) {
        await ctx.reply(
          `${redeemRes.message}`,
          {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard().text("🔙 Ana Menü", "btn_main_menu"),
          }
        );
        return;
      }

      const kb = new InlineKeyboard()
        .text("🛒 Hemen Numara Al", "btn_buy_menu")
        .row()
        .text("💳 Bakiyem & Profil", "btn_my_profile")
        .text("🔙 Ana Menü", "btn_main_menu");

      await ctx.reply(redeemRes.message, {
        parse_mode: "HTML",
        reply_markup: kb,
      });
    });

    // /bakiye Komutu
    botInstance.command("bakiye", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      await sendAnimatedVisual(ctx, "🎰");
      await db.syncFromCloud(true);

      const user =
        db.getUser(from.id) ||
        (await db.getOrCreateUser(from.id, {
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
        }));
      const kb = new InlineKeyboard()
        .text("💳 Bakiye Yükle", "btn_deposit_menu")
        .text("🛒 Numara Al", "btn_buy_menu")
        .row()
        .text("🔙 Ana Menü", "btn_main_menu");

      await ctx.reply(
        `💰 <b>Mevcut Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n` +
          `💸 <b>Toplam Harcanan:</b> <code>${user.spent.toFixed(2)} ₺</code>`,
        { parse_mode: "HTML", reply_markup: kb }
      );
    });

    // /yardim Komutu
    botInstance.command("yardim", async (ctx) => {
      await sendAnimatedVisual(ctx, "🎯");

      const { appUrl } = getAppUrls();
      const settings = db.getSettings();
      const rawList = settings.supportTelegramUsernames !== undefined
        ? settings.supportTelegramUsernames
        : (settings.supportTelegramUsername ? [settings.supportTelegramUsername] : []);
      const supportUsernames = rawList.map((u) => u.replace(/^@/, "").trim()).filter(Boolean);

      const supportAdminsText = supportUsernames.length > 0
        ? supportUsernames.map((u) => `👑 <b>Yetkili:</b> @${u}`).join("\n")
        : `💬 <i>Canlı destek için lütfen Mini App üzerinden destek talebi açınız.</i>`;

      const kb = new InlineKeyboard();
      for (const u of supportUsernames) {
        kb.url(`💬 Yöneticiye Yaz (@${u})`, `https://t.me/${u}`).row();
      }
      kb.webApp("🎫 Mini App Destek Talebi Aç", appUrl)
        .row()
        .text("🛒 Numara Satın Al", "btn_buy_menu")
        .text("💳 Bakiye Yükle", "btn_deposit_menu")
        .row()
        .text("🔙 Ana Menü", "btn_main_menu");

      await ctx.reply(
        `🆘 <b>AzFur SMS Destek & Bilgi</b>\n\n` +
          `${supportAdminsText}\n` +
          `💬 <i>Her türlü bakiye, sipariş ve teknik konuda yöneticilerimizle doğrudan görüşebilirsiniz.</i>\n\n` +
          `• <b>Hızlı Doğrulama:</b> SMS kodları 5-30 saniye içinde bot ekranınıza iletilir.\n` +
          `• <b>%100 İade Garantisi:</b> SMS kodu gelmeyen kiralamaları ücretsiz iptal edebilir, bakiyenizi anında iade alabilirsiniz.\n` +
          `• <b>7/24 Bakiye:</b> Otomatik Kripto (QR Kod) ve TRON ağı ile 7/24 anında bakiye yükleyebilirsiniz.`,
        { parse_mode: "HTML", reply_markup: kb }
      );
    });

    // ==========================================
    // 1.5. YÖNETİCİ HAREKETLİ STİCKER YAKALAYICI
    // ==========================================
    botInstance.on("message:sticker", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const user = db.getUser(from.id);
      const isAdmin = db.isAdmin(from.id) || user?.role === "admin";

      if (!isAdmin) return;

      const sticker = ctx.message.sticker;
      if (sticker) {
        const fileId = sticker.file_id;
        const setName = sticker.set_name;
        const isAnimated = Boolean(sticker.is_animated || sticker.is_video);

        await db.syncFromCloud();
        await db.updateSettings({
          customStickerFileId: fileId,
        });

        // Gönderilen sticker'ı canlı önizleme olarak hemen geri oynat
        try {
          await ctx.replyWithSticker(fileId);
        } catch (e) {}

        await ctx.reply(
          `✨ <b>Yeni Hareketli Görsel / Sticker Başarıyla Tanımlandı!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📁 <b>Paket Adı:</b> <code>${setName || "Özel / Bireysel"}</code>\n` +
          `🎬 <b>Tür:</b> ${isAnimated ? "Canlı Animasyonlu (.tgs / .webm) 🚀" : "Sticker"}\n` +
          `🔑 <b>File ID:</b> <code>${fileId}</code>\n\n` +
          `✅ <i>Bot artık /start, /bakiye, /yardim ve sipariş durumlarında bu animasyonu canlı oynatacaktır! Dilediğiniz zaman bota başka bir sticker atarak değiştirebilirsiniz.</i>`,
          { parse_mode: "HTML" }
        );
      }
    });

    // /teststicker Komutu
    botInstance.command("teststicker", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const user = db.getUser(from.id);
      const isAdmin = db.isAdmin(from.id) || user?.role === "admin";
      if (!isAdmin) return;

      await db.syncFromCloud();
      const settings = db.getSettings();

      if (settings.customStickerFileId && settings.customStickerFileId.trim()) {
        try {
          await ctx.replyWithSticker(settings.customStickerFileId.trim());
          await ctx.reply(
            `✅ <b>Kayıtlı Hareketli Sticker Test Edildi!</b>\n` +
            `🔑 <b>File ID:</b> <code>${settings.customStickerFileId}</code>\n\n` +
            `💡 <i>Kaldırmak için: <code>/removesticker</code></i>`,
            { parse_mode: "HTML" }
          );
          return;
        } catch (err: any) {
          await ctx.reply(`⚠️ Sticker gönderilirken hata: ${err?.message || "Bilinmeyen hata"}`);
          return;
        }
      }

      await ctx.reply(
        `ℹ️ <b>Kayıtlı Çıkartma Yok (Temiz Mod)</b>\n\n` +
        `Bot başlangıcında ve menülerde hiçbir çıkartma gönderilmiyor.\n\n` +
        `💡 <i>İleride bir çıkartma eklemek isterseniz, bu sohbete dilediğiniz bir hareketli sticker (.tgs / .webm) göndermeniz yeterlidir.</i>`,
        { parse_mode: "HTML" }
      );
    });

    // /setpack Komutu
    botInstance.command("setpack", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const user = db.getUser(from.id);
      const isAdmin = db.isAdmin(from.id) || user?.role === "admin";
      if (!isAdmin) return;

      const rawText = (ctx.match || "").trim();
      if (!rawText) {
        await ctx.reply(
          `ℹ️ <b>Kullanım:</b> <code>/setpack paket_adi</code> veya <code>/setpack https://t.me/addstickers/paket_adi</code>\n\n` +
          `Veya bota doğrudan dilediğiniz herhangi bir hareketli sticker'ı bu sohbete gönderebilirsiniz!`,
          { parse_mode: "HTML" }
        );
        return;
      }

      let packName = rawText;
      if (packName.includes("addstickers/")) {
        packName = packName.split("addstickers/")[1]?.split("/")[0]?.split("?")[0] || packName;
      } else if (packName.includes("addemoji/")) {
        await ctx.reply(
          `⚠️ <b>Bu bir Custom Emoji paketidir!</b>\n\n` +
          `Telegram Bot kuralları gereği botlar custom emoji paketlerini mesaj çıkartması olarak gönderemez.\n` +
          `Lütfen bir <b>Sticker Paketi</b> (<code>t.me/addstickers/...</code>) adı girin veya bota dilediğiniz hareketli sticker'ı doğrudan sohbette gönderin!`,
          { parse_mode: "HTML" }
        );
        return;
      }

      try {
        const set = await ctx.api.getStickerSet(packName);
        if (set && set.stickers && set.stickers.length > 0) {
          const anim = set.stickers.find((st: any) => st.is_animated || st.is_video) || set.stickers[0];
          if (anim && anim.file_id) {
            await db.syncFromCloud();
            await db.updateSettings({ customStickerFileId: anim.file_id });
            await ctx.replyWithSticker(anim.file_id);
            await ctx.reply(
              `✅ <b>'${set.title || packName}' Paketi Başarıyla Tanımlandı!</b>`,
              { parse_mode: "HTML" }
            );
            return;
          }
        }
      } catch (e) {}

      await ctx.reply(
        `❌ <b>'${packName}' paketi bulunamadı veya Telegram Bot API tarafından erişilemedi.</b>\n\n` +
        `💡 <i>İpucu: En garantili yöntem, bota istediğiniz paketten bir çıkartmayı doğrudan bu sohbete göndermektir.</i>`,
        { parse_mode: "HTML" }
      );
    });

    // /removesticker Komutu
    botInstance.command("removesticker", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const user = db.getUser(from.id);
      const isAdmin = db.isAdmin(from.id) || user?.role === "admin";
      if (!isAdmin) return;

      await db.syncFromCloud();
      await db.updateSettings({ customStickerFileId: "" });
      await ctx.reply(
        `🗑️ <b>Tüm çıkartmalar başarıyla kaldırıldı!</b>\n\n` +
        `Artık bot başlangıcında veya menülerde hiçbir çıkartma (dog sticker vb.) kesinlikle gösterilmeyecektir.`,
        { parse_mode: "HTML" }
      );
    });

    // ==========================================
    // 1.6. YÖNETİCİ METİN VE LİNK YAKALAYICI
    // ==========================================
    botInstance.on("message:text", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const user = db.getUser(from.id);
      const isAdmin = db.isAdmin(from.id) || user?.role === "admin";

      const text = (ctx.message.text || "").trim();

      if (!isAdmin) {
        // Kullanıcı doğrudan bir kupon kodu yazdıysa (örn: HOSGELDIN, AZFUR20)
        const potentialCoupon = text.toUpperCase().replace(/^#/, "").trim();
        if (potentialCoupon.length >= 3 && potentialCoupon.length <= 30 && !potentialCoupon.includes(" ") && !potentialCoupon.startsWith("/")) {
          const coupon = db.getCoupon(potentialCoupon);
          if (coupon && coupon.isActive) {
            await db.syncFromCloud();
            const redeemRes = await db.redeemCoupon(potentialCoupon, from.id);
            const kb = new InlineKeyboard()
              .text("🛒 Hemen Numara Al", "btn_buy_menu")
              .row()
              .text("💳 Bakiyem & Profil", "btn_my_profile")
              .text("🔙 Ana Menü", "btn_main_menu");

            await ctx.reply(redeemRes.message, { parse_mode: "HTML", reply_markup: kb });
            return;
          }
        }
        return;
      }

      // Sticker paketi linki gönderildiyse
      if (text.includes("t.me/addstickers/")) {
        const packName = text.split("addstickers/")[1]?.split("/")[0]?.split("?")[0] || "";
        if (packName) {
          try {
            const set = await ctx.api.getStickerSet(packName);
            if (set && set.stickers && set.stickers.length > 0) {
              const anim = set.stickers.find((st: any) => st.is_animated || st.is_video) || set.stickers[0];
              if (anim && anim.file_id) {
                await db.syncFromCloud();
                await db.updateSettings({ customStickerFileId: anim.file_id });
                await ctx.replyWithSticker(anim.file_id);
                await ctx.reply(
                  `✅ <b>'${set.title || packName}' Paketi Başarıyla Tanımlandı!</b>`,
                  { parse_mode: "HTML" }
                );
                return;
              }
            }
          } catch (e) {}
        }
      }

      // Emoji paketi linki gönderildiyse
      if (text.includes("t.me/addemoji/")) {
        await ctx.reply(
          `ℹ️ <b>Gönderdiğiniz link bir 'Özel Emoji Paketi'dir.</b>\n\n` +
          `📌 <b>Telegram Kuralı:</b> Telegram botları emoji paketlerini (<code>t.me/addemoji/...</code>) bağımsız çıkartma olarak gönderemez (bunun için Telegram Fragment üzerinden 5.000 TON değerinde kullanıcı adı gereklidir).\n\n` +
          `🚀 <b>Çözüm:</b>\n` +
          `1. Bota doğrudan beğendiğiniz herhangi bir <b>hareketli sticker</b> atabilirsiniz (bot anında yakalar).\n` +
          `2. Veya bir <b>çıkartma paketi linki</b> (<code>t.me/addstickers/...</code>) atabilirsiniz.\n` +
          `3. Çıkartmayı tamamen kaldırmak için <code>/removesticker</code> yazabilirsiniz.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Eğer mesajda custom emoji var ama sticker değilse
      const hasCustomEmoji = ctx.message.entities?.some((e) => e.type === "custom_emoji");
      if (hasCustomEmoji) {
        await ctx.reply(
          `💡 <i>Attığınız mesaj bir Custom Emoji içeriyor. Botun bunu animasyon olarak oynatabilmesi için lütfen bu emojiyi değil, bir <b>çıkartma (sticker)</b> gönderiniz.</i>`,
          { parse_mode: "HTML" }
        );
      }
    });

    // ==========================================
    // 2. CALLBACK QUERY DİSPATCHER (BUTON TIKLAMALARI)
    // ==========================================
    botInstance.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data;
      const from = ctx.from;
      if (!from) return;

      // Buton cevabı (uyarı/bildirim) işleyicilerde verilir; verilmezse 0.0 middleware'i boş cevaplar.

      // 2. Kullanıcıyı bellekten hemen getir (0ms)
      const user =
        db.getUser(from.id) ||
        (await db.getOrCreateUser(from.id, {
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
        }));

      const { appUrl, adminUrl } = getAppUrls();
      const isAdmin = db.isAdmin(from.id) || user.role === "admin";

      // --- ANA MENÜYE DÖNÜŞ ---
      if (data === "btn_main_menu" || data === "btn_refresh_menu") {
        if (ctx.callbackQuery?.message?.photo) {
          try {
            const activeOrders = db.getActiveOrders(from.id);
            const messageText = buildMainMenuText(user, from.first_name, activeOrders.length);
            const keyboard = buildMainMenuKeyboard(isAdmin, appUrl, adminUrl);
            await ctx.editMessageCaption({
              caption: messageText,
              parse_mode: "HTML",
              reply_markup: keyboard,
            });
            return;
          } catch (editErr: any) {
            if (String(editErr?.message || "").includes("message is not modified")) {
              return;
            }
          }
        }

        try {
          await ctx.deleteMessage();
        } catch {}
        await sendWelcome(ctx);
        return;
      }

      // --- BAKIM DURUMU KONTROL BUTONU ---
      if (data === "btn_check_maintenance") {
        await db.syncFromCloud(true);
        const settings = db.getSettings();
        if (settings.maintenanceMode && !isAdmin) {
          try {
            await ctx.answerCallbackQuery({
              text: "🛠️ Bakım çalışması halen devam ediyor.",
              show_alert: true,
            });
          } catch (e) {}
          return;
        }

        try {
          await ctx.answerCallbackQuery({ text: "✅ Sistem aktif!" });
        } catch (e) {}
        try {
          await ctx.deleteMessage();
        } catch {}
        await sendWelcome(ctx);
        return;
      }

      // --- NUMARA SATIN ALMA MENÜSÜ ---
      if (data === "btn_buy_menu") {
        const text =
          `🛒 <b>NUMARA SATIN ALMA - SERVİS SEÇİMİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>Kullanılabilir Bakiye:</b> <code>${user.balance.toFixed(2)} ₺</code>\n\n` +
          `Lütfen SMS onayı almak istediğiniz servisi seçin:\n` +
          `<i>(Seçtiğiniz servise ait ülke ve fiyat listesi gösterilecektir)</i>`;

        const kb = new InlineKeyboard();
        for (let i = 0; i < POPULAR_SERVICES.length; i += 2) {
          const s1 = POPULAR_SERVICES[i];
          const s2 = POPULAR_SERVICES[i + 1];
          if (s2) {
            kb.text(`${serviceEmoji(s1.code)} ${s1.name}`, `svc_sel:${s1.code}`).text(
              `${serviceEmoji(s2.code)} ${s2.name}`,
              `svc_sel:${s2.code}`
            ).row();
          } else {
            kb.text(`${serviceEmoji(s1.code)} ${s1.name}`, `svc_sel:${s1.code}`).row();
          }
        }

        kb.text("🌐 Diğer Servisler (Tümü)", "svc_all_info").row();
        kb.text("🔙 Ana Menüye Dön", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- DİĞER SERVİSLER BİLGİSİ ---
      if (data === "svc_all_info") {
        const text =
          `🌐 <b>YÜZLERCE FARKLI SERVİS</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Steam, Netflix, Yahoo, Uber, Tinder, Airbnb, Microsoft, Amazon ve 500'den fazla servisin tamamına erişmek için <b>Web Mini App</b> panelini kullanabilirsiniz!`;

        const kb = new InlineKeyboard()
          .webApp("🚀 Web Mini App'i Aç", appUrl)
          .row()
          .text("🔙 Servis Listesi", "btn_buy_menu")
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- SERVİS SEÇİLDİ -> ÜLKE LİSTESİ VE FİYATLAR ---
      if (data.startsWith("svc_sel:")) {
        const serviceCode = data.split(":")[1];
        const serviceObj =
          POPULAR_SERVICES.find((s) => s.code === serviceCode) || {
            code: serviceCode,
            name: serviceCode.toUpperCase(),
            icon: "📱",
          };

        const text =
          `🌍 <b>${serviceEmoji(serviceObj.code)} ${serviceObj.name} İÇİN ÜLKE SEÇİN</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n\n` +
          `Numara almak istediğiniz ülkeyi seçin 👇`;

        const kb = new InlineKeyboard();

        const formatBtn = (c: { flag: string; name: string }, p: number) => {
          const withDec = `${c.flag} ${c.name} ${p.toFixed(1)}₺`;
          if (withDec.length <= 15) return withDec;
          return `${c.flag} ${c.name} ${Math.round(p)}₺`;
        };

        // Popüler ülkelerin fiyatlarını çek
        try {
          const prices = await heroSms.getPrices();
          for (let i = 0; i < POPULAR_COUNTRIES.length; i += 2) {
            const c1 = POPULAR_COUNTRIES[i];
            const c2 = POPULAR_COUNTRIES[i + 1];

            const cost1 = prices[String(c1.id)]?.[serviceCode]?.cost || 0.15;
            const p1 = pricingEngine.calculatePrice(cost1, serviceCode, undefined, c1.id, user).finalPriceTry;

            if (c2) {
              const cost2 = prices[String(c2.id)]?.[serviceCode]?.cost || 0.15;
              const p2 = pricingEngine.calculatePrice(cost2, serviceCode, undefined, c2.id, user).finalPriceTry;
              kb.text(formatBtn(c1, p1), `buy_confirm:${serviceCode}:${c1.id}`).text(
                formatBtn(c2, p2),
                `buy_confirm:${serviceCode}:${c2.id}`
              ).row();
            } else {
              kb.text(`${c1.flag} ${c1.name} • ${p1.toFixed(1)}₺`, `buy_confirm:${serviceCode}:${c1.id}`).row();
            }
          }
        } catch (e) {
          // Fallback standart fiyat gösterimi
          for (let i = 0; i < POPULAR_COUNTRIES.length; i += 2) {
            const c1 = POPULAR_COUNTRIES[i];
            const c2 = POPULAR_COUNTRIES[i + 1];
            if (c2) {
              kb.text(`${c1.flag} ${c1.name}`, `buy_confirm:${serviceCode}:${c1.id}`).text(
                `${c2.flag} ${c2.name}`,
                `buy_confirm:${serviceCode}:${c2.id}`
              ).row();
            } else {
              kb.text(`${c1.flag} ${c1.name}`, `buy_confirm:${serviceCode}:${c1.id}`).row();
            }
          }
        }

        kb.text("🔙 Servis Listesi", "btn_buy_menu").text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- SİPARİŞ ONAY KARTI ---
      if (data.startsWith("buy_confirm:")) {
        const parts = data.split(":");
        const serviceCode = parts[1];
        const countryId = Number(parts[2]);

        const serviceObj =
          POPULAR_SERVICES.find((s) => s.code === serviceCode) || {
            code: serviceCode,
            name: serviceCode.toUpperCase(),
            icon: "📱",
          };
        const countryObj =
          POPULAR_COUNTRIES.find((c) => c.id === countryId) || {
            id: countryId,
            name: `Ülke ${countryId}`,
            flag: "🌐",
          };

        const saleSettings = db.getSettings();
        if (
          saleSettings.hiddenServices?.includes(serviceCode) ||
          saleSettings.hiddenCountries?.includes(countryId) ||
          (saleSettings.hiddenServiceCountryPairs || []).includes(`${serviceCode}:${countryId}`)
        ) {
          await editOrReply(
            ctx,
            `⚠️ Bu servis bu ülke için şu anda satışta değil. Lütfen başka bir ülke seçin.`,
            new InlineKeyboard().text("🔙 Başka Ülke Seç", `svc_sel:${serviceCode}`).row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        const prices = await heroSms.getPrices(countryId);
        const providerPrice = prices[String(countryId)]?.[serviceCode];
        if (!providerPrice || !(Number(providerPrice.cost) > 0)) {
          await editOrReply(
            ctx,
            `⚠️ Bu servis bu ülkede sağlayıcı tarafından satılmıyor. Lütfen başka bir ülke seçin.`,
            new InlineKeyboard().text("🔙 Başka Ülke Seç", `svc_sel:${serviceCode}`).row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }
        const originalCost = Number(providerPrice.cost);
        const calcRes = pricingEngine.calculatePrice(originalCost, serviceCode, undefined, countryId, user);
        const finalPriceTry = calcRes.finalPriceTry;

        const priceDisplay = calcRes.isVipDiscountApplied && calcRes.originalPriceBeforeVip
          ? `<s>${calcRes.originalPriceBeforeVip.toFixed(2)} ₺</s> ➡️ <b>${finalPriceTry.toFixed(2)} ₺</b> (⭐ VIP %${calcRes.vipDiscountPercent} İndirim)`
          : `<code>${finalPriceTry.toFixed(2)} ₺</code>`;

        const text =
          `🛒 <b>NUMARA SATIN ALMA ONAYI</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📱 <b>Servis:</b> ${serviceEmoji(serviceObj.code)} ${serviceObj.name}\n` +
          `🌍 <b>Ülke:</b> ${countryObj.flag} ${countryObj.name}\n` +
          `💵 <b>Numara Tutarı:</b> ${priceDisplay}\n` +
          `💳 <b>Mevcut Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n` +
          `⏱️ <b>Kullanım Süresi:</b> 15 Dakika (Tek Kullanımlık)\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `❓ <b>Bu numarayı satın almak istiyor musunuz?</b>\n\n` +
          `<i>💡 15 dakika içinde SMS kodu gelmezse iptal edebilir, bakiyenizi anında %100 kesintisiz iade alabilirsiniz.</i>`;

        const kb = new InlineKeyboard()
          .text(`✅ Evet, Satın Al (${finalPriceTry.toFixed(2)} ₺)`, `buy_exec:${serviceCode}:${countryId}`)
          .row()
          .text("❌ Hayır, İptal Et", `buy_cancel:${serviceCode}`)
          .row()
          .text("🔙 Başka Ülke Seç", `svc_sel:${serviceCode}`)
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- SİPARİŞİ İPTAL ET ---
      if (data.startsWith("buy_cancel:")) {
        const serviceCode = data.split(":")[1];
        await editOrReply(
          ctx,
          `❌ <b>Satın Alma İptal Edildi</b>\n\nBakiyenizden herhangi bir ücret düşülmedi. İstediğiniz zaman farklı bir servis veya ülke seçebilirsiniz.`,
          new InlineKeyboard()
            .text("🔄 Başka Ülke Seç", `svc_sel:${serviceCode}`)
            .row()
            .text("🛒 Farklı Servis Seç", "btn_buy_menu")
            .text("🔙 Ana Menü", "btn_main_menu")
        );
        return;
      }

      // --- NUMARAYI KİRALA (SATIN AL) ---
      if (data.startsWith("buy_exec:")) {
        const parts = data.split(":");
        const serviceCode = parts[1];
        const countryId = Number(parts[2]);

        if (user.isBanned) {
          await editOrReply(
            ctx,
            `🚫 <b>Hesabınız Engellendi!</b>\nHesabınız askıya alındığı için numara kiralayamazsınız.`,
            new InlineKeyboard().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        const serviceObj =
          POPULAR_SERVICES.find((s) => s.code === serviceCode) || {
            code: serviceCode,
            name: serviceCode.toUpperCase(),
            icon: "📱",
          };
        const countryObj =
          POPULAR_COUNTRIES.find((c) => c.id === countryId) || {
            id: countryId,
            name: `Ülke ${countryId}`,
            flag: "🌐",
          };

        const prices = await heroSms.getPrices(countryId);
        const providerPrice = prices[String(countryId)]?.[serviceCode];
        if (!providerPrice || !(Number(providerPrice.cost) > 0)) {
          await editOrReply(
            ctx,
            `⚠️ Bu servis bu ülkede sağlayıcı tarafından satılmıyor. Lütfen başka bir ülke seçin.`,
            new InlineKeyboard().text("🔙 Başka Ülke Seç", `svc_sel:${serviceCode}`).row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }
        const originalCost = Number(providerPrice.cost);
        const calcRes = pricingEngine.calculatePrice(originalCost, serviceCode, undefined, countryId, user);
        const finalPriceTry = calcRes.finalPriceTry;

        if (user.balance < finalPriceTry) {
          await editOrReply(
            ctx,
            `⚠️ <b>Yetersiz Bakiye!</b>\nMevcut bakiyeniz: <code>${user.balance.toFixed(2)} ₺</code>\nGereken: <code>${finalPriceTry.toFixed(2)} ₺</code>`,
            new InlineKeyboard().text("💳 Bakiye Yükle", "btn_deposit_menu").row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        // Ücret numara alınmadan ÖNCE atomik düşülür (eşzamanlı satın almalarla eksi bakiye olmaz)
        const debited = await db.tryDebitBalance(from.id, finalPriceTry);
        if (!debited) {
          const currentBalance = db.getUser(from.id)?.balance ?? user.balance;
          await editOrReply(
            ctx,
            `⚠️ <b>Yetersiz Bakiye!</b>\nMevcut bakiyeniz: <code>${currentBalance.toFixed(2)} ₺</code>\nGereken: <code>${finalPriceTry.toFixed(2)} ₺</code>`,
            new InlineKeyboard().text("💳 Bakiye Yükle", "btn_deposit_menu").row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        // Hero-SMS API'den numara çek
        const numberResult = await heroSms.getNumber(serviceCode, countryId);

        if (!numberResult.success || !numberResult.id || !numberResult.number) {
          // Numara alınamadı: düşülen ücreti geri ver
          await db.revertDebit(from.id, finalPriceTry);
          const errMsg = heroErrorMessage(numberResult.error);

          await editOrReply(
            ctx,
            `❌ <b>Sipariş Başarısız!</b>\n\n${errMsg}`,
            new InlineKeyboard().text("🔙 Başka Ülke Seç", `svc_sel:${serviceCode}`).row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        // Bakiye yukarıda atomik olarak düşüldü

        // Siparişi kaydet
        const now = Date.now();
        const formattedPhone = numberResult.number.startsWith("+")
          ? numberResult.number
          : `+${numberResult.number}`;

        const order: ActivationOrder = {
          id: numberResult.id,
          telegramId: Number(from.id),
          serviceCode,
          serviceName: serviceObj.name,
          countryId,
          countryName: countryObj.name,
          countryFlag: countryObj.flag,
          phoneNumber: formattedPhone,
          originalCost,
          chargedPrice: finalPriceTry,
          status: "WAIT_CODE",
          smsCode: null,
          smsText: null,
          createdAt: now,
          expiresAt: now + 15 * 60 * 1000,
          notifiedBot: false,
        };

        await db.saveActivation(order);

        // Sistem log kaydı oluştur
        db.addLog({
          category: "ORDER",
          level: "SUCCESS",
          action: "ORDER_CREATED",
          details: `${order.countryFlag} ${order.serviceName} (${order.phoneNumber}) numarası ${order.chargedPrice.toFixed(2)} ₺ karşılığında satın alındı.`,
          telegramId: Number(from.id),
          username: from.username,
          metadata: { orderId: order.id, phoneNumber: order.phoneNumber, price: order.chargedPrice },
        }).catch(() => {});

        await sendAnimatedVisual(ctx, "🎯");

        const text =
          `🎉 <b>NUMARANIZ BAŞARIYLA ALINDI!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📱 <b>Servis:</b> ${serviceEmoji(serviceObj.code)} ${serviceObj.name}\n` +
          `🌍 <b>Ülke:</b> ${countryObj.flag} ${countryObj.name}\n` +
          `📞 <b>Telefon Numarası:</b>\n<code>${formattedPhone}</code>\n` +
          `<i>(Kopyalamak için numaranın üzerine dokunun)</i>\n\n` +
          `⏳ <b>Durum:</b> SMS Kodu Bekleniyor...\n` +
          `⏱️ <b>Bekleme Süresi:</b> 15 Dakika\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💡 <i>İlgili uygulamaya gidip bu numarayı girin. SMS kodu geldiğinde bot otomatik olarak bildirim gönderecektir. Kod gelmezse (numara alındıktan 2 dakika sonra) iptal edip ücretinizi anında geri alabilirsiniz.</i>`;

        const kb = new InlineKeyboard()
          .text("🔄 Kodu Kontrol Et", `order_chk:${order.id}`)
          .row()
          .text("❌ İptal Et & İade Al", `order_cnc:${order.id}`)
          .row()
          .text("📜 Numaralarım", "btn_my_orders")
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- KODU KONTROL ET ---
      if (data.startsWith("order_chk:")) {
        const orderId = data.split(":")[1];
        const order = db.getActivation(orderId);

        if (!order) {
          await editOrReply(
            ctx,
            `❌ Sipariş bulunamadı.`,
            new InlineKeyboard().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        if (Number(order.telegramId) !== Number(from.id)) {
          try { await ctx.answerCallbackQuery({ text: "Bu sipariş size ait değil.", show_alert: true }); } catch (e) {}
          return;
        }

        // Sağlayıcıyla eşitle: kod teslimi / süre dolumu ve sağlayıcı iptali iadesi tek seferlik (lib/orders.ts)
        const { order: synced, event } = await syncOrderWithProvider(orderId, { notify: false });
        const statusResult = { status: synced?.status, code: synced?.smsCode || undefined };

        if (statusResult.status === "RECEIVED" && statusResult.code) {
          if (event === "code_received") await sendAnimatedVisual(ctx, "🎰");

          const text =
            `🔔 <b>SMS KODUNUZ GELDİ!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📱 <b>Servis:</b> ${order.serviceName}\n` +
            `📞 <b>Numara:</b> <code>${order.phoneNumber}</code>\n\n` +
            `🔑 <b>SMS Onay Kodu:</b>\n` +
            `👉 <code>${statusResult.code}</code> 👈\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <i>Kodu kopyalayıp servise yapıştırabilirsiniz. İşleminiz bittiğinde 'Tamamla' butonuna basabilirsiniz.</i>`;

          const kb = new InlineKeyboard()
            .text("✅ Siparişi Tamamla", `order_fin:${order.id}`)
            .row()
            .text("🛒 Yeni Numara Al", "btn_buy_menu")
            .text("🔙 Ana Menü", "btn_main_menu");

          await editOrReply(ctx, text, kb);
          return;
        } else if (statusResult.status === "CANCELLED" || statusResult.status === "TIMEOUT") {
          // Önceden burada iade YAPILMADAN kapatılıyordu; artık eşitleme ücreti bir kez iade ediyor
          const refundNote =
            event === "refunded_timeout" || event === "refunded_cancelled"
              ? `💰 <b>${order.chargedPrice.toFixed(2)} ₺</b> bakiyenize iade edildi.`
              : `💰 Bu siparişin ücreti bakiyenize iade edilmiştir.`;
          await editOrReply(
            ctx,
            `↩️ <b>Kod gelmedi, sipariş kapatıldı.</b>\n\n${refundNote}\n\n<i>Farklı bir ülke veya servisle tekrar deneyebilirsiniz.</i>`,
            new InlineKeyboard().text("🛒 Yeni Numara Al", "btn_buy_menu").row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        } else if (statusResult.status === "COMPLETED") {
          await editOrReply(
            ctx,
            `✅ Bu sipariş tamamlanmış.`,
            new InlineKeyboard().text("🛒 Yeni Numara Al", "btn_buy_menu").row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        } else {
          // Kod henüz gelmedi
          try {
            await ctx.answerCallbackQuery({
              text: "⏳ Henüz SMS kodu gelmedi. Lütfen uygulamadan SMS gönderildiğinden emin olun ve biraz bekleyin...",
              show_alert: true,
            });
          } catch (e) {}
          return;
        }
      }

      // --- SİPARİŞİ İPTAL ET VE İADE AL ---
      if (data.startsWith("order_cnc:")) {
        const orderId = data.split(":")[1];

        // Sahiplik, durum kontrolü, atomik kilit ve tek seferlik iade lib/orders.ts içinde
        // (sipariş başka bir sunucu örneğinde oluşmuş olabilir; orada SQL'den eşitlenir)
        const cancelResult = await cancelOrderWithRefund(orderId, Number(from.id));
        if (!cancelResult.ok) {
          try {
            await ctx.answerCallbackQuery({ text: cancelResult.error, show_alert: true });
          } catch (e) {}
          return;
        }
        const order = cancelResult.order;
        const updatedUser = cancelResult.user;

        const text =
          `✅ <b>NUMARA BAŞARIYLA İPTAL EDİLDİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>İade Edilen Tutar:</b> <code>+${order.chargedPrice.toFixed(2)} ₺</code>\n` +
          `💳 <b>Yeni Bakiyeniz:</b> <code>${updatedUser.balance.toFixed(2)} ₺</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `<i>Ücretiniz kesintisiz olarak hesabınıza iade edilmiştir. Farklı bir ülke veya servis deneyebilirsiniz.</i>`;

        const kb = new InlineKeyboard()
          .text("🛒 Başka Numara Al", "btn_buy_menu")
          .row()
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- SİPARİŞİ TAMAMLA ---
      if (data.startsWith("order_fin:")) {
        const orderId = data.split(":")[1];
        const finOrder = db.getActivation(orderId);
        if (!finOrder || Number(finOrder.telegramId) !== Number(from.id)) {
          try { await ctx.answerCallbackQuery({ text: "Sipariş bulunamadı.", show_alert: true }); } catch (e) {}
          return;
        }
        // Kodu gelmemiş SMS siparişi tamamlanırsa ücret iade edilmeden kapanır: önce iptal/iade önerilir
        if (finOrder.status === "WAIT_CODE" && !isRentOrder(finOrder)) {
          try {
            await ctx.answerCallbackQuery({
              text: "Bu numaraya henüz SMS kodu gelmedi. Kod gelmeden tamamlarsanız ücret iade edilmez; kod gelmeyecekse 'İptal Et & İade Al' butonunu kullanın.",
              show_alert: true,
            });
          } catch (e) {}
          return;
        }
        // Yalnızca kodu gelmiş (veya süren kiralık) sipariş tamamlanır; iade edilmiş sipariş tamamlanamaz
        const finished = await db.claimActivationStatus(orderId, ["RECEIVED", "WAIT_CODE"], "COMPLETED");
        if (!finished) {
          try { await ctx.answerCallbackQuery({ text: "Bu sipariş tamamlanamaz (iptal edilmiş veya zaten tamamlanmış).", show_alert: true }); } catch (e) {}
          return;
        }
        await finishOrderAtProvider(finished);

        const text =
          `🎉 <b>SİPARİŞİNİZ TAMAMLANDI!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Bizi tercih ettiğiniz için teşekkür ederiz. Yeni bir SMS onayı için dilediğiniz zaman numara alabilirsiniz.`;

        const kb = new InlineKeyboard()
          .text("🛒 Yeni Numara Al", "btn_buy_menu")
          .row()
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- AKTİF VE GEÇMİŞ NUMARALARIM ---
      if (data === "btn_my_orders") {
        const orders = db.getUserActivations(from.id);
        const activeOrders = orders.filter((o) => o.status === "WAIT_CODE" || o.status === "RECEIVED");

        if (activeOrders.length === 0) {
          const recent = orders.slice(0, 3);
          let historyText = "";
          if (recent.length > 0) {
            historyText =
              `\n\n📜 <b>Son Tamamlanan Siparişleriniz:</b>\n` +
              recent
                .map(
                  (r) =>
                    `• ${r.countryFlag} ${r.serviceName}: <code>${r.phoneNumber}</code> (${
                      r.status === "COMPLETED"
                        ? "✅ Tamamlandı"
                        : r.status === "CANCELLED"
                        ? "❌ İptal Edildi"
                        : r.status
                    })`
                )
                .join("\n");
          }

          const text =
            `📜 <b>NUMARALARIM</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Şu anda bekleyen aktif bir SMS onayınız bulunmamaktadır.` +
            historyText;

          const kb = new InlineKeyboard()
            .text("🛒 Hemen Numara Al", "btn_buy_menu")
            .row()
            .text("🔙 Ana Menü", "btn_main_menu");

          await editOrReply(ctx, text, kb);
          return;
        }

        // Aktif numaralar var
        const text =
          `📜 <b>AKTİF NUMARALARINIZ (${activeOrders.length})</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `İşlem yapmak istediğiniz numarayı seçin:`;

        const kb = new InlineKeyboard();
        for (const o of activeOrders) {
          const statusIcon = o.status === "RECEIVED" ? "🔔 KOD GELDİ" : "⏳ Bekliyor";
          kb.text(`${o.countryFlag} ${o.serviceName} • ${statusIcon}`, `order_view:${o.id}`).row();
        }
        kb.text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- TEKİL SİPARİŞ DETAYI ---
      if (data.startsWith("order_view:")) {
        const orderId = data.split(":")[1];
        const order = db.getActivation(orderId);
        if (!order) {
          await editOrReply(ctx, `❌ Sipariş bulunamadı.`, new InlineKeyboard().text("🔙 Ana Menü", "btn_main_menu"));
          return;
        }

        if (Number(order.telegramId) !== Number(from.id)) {
          try { await ctx.answerCallbackQuery({ text: "Bu sipariş size ait değil.", show_alert: true }); } catch (e) {}
          return;
        }

        const rent = isRentOrder(order);
        const waiting = order.status === "WAIT_CODE";
        const now = Date.now();
        const earlyLeftMs = !rent && waiting ? order.createdAt + EARLY_CANCEL_MS - now : 0;
        const canCancel = waiting && (!rent || now - order.createdAt < RENT_FREE_CANCEL_MS);
        const canFinish = order.status === "RECEIVED" || (rent && waiting);
        const statusLabel: Record<string, string> = {
          WAIT_CODE: "⏳ Kod Bekleniyor",
          RECEIVED: "🔔 Kod Geldi",
          COMPLETED: "✅ Tamamlandı",
          CANCELLED: "↩️ İptal Edildi (iade yapıldı)",
          TIMEOUT: "⌛ Süre Doldu (iade yapıldı)",
        };
        let cancelHint = "";
        if (earlyLeftMs > 0) {
          const sec = Math.ceil(earlyLeftMs / 1000);
          const left = sec >= 60 ? `${Math.floor(sec / 60)} dk ${sec % 60} sn` : `${sec} sn`;
          cancelHint = `\nℹ️ <i>Numara alındıktan sonraki ilk 2 dakika iptal edilemez. İptal ${left} sonra açılır.</i>`;
        }

        const text =
          `📱 <b>SİPARİŞ DETAYI</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📞 <b>Numara:</b> <code>${order.phoneNumber}</code>\n` +
          `🌐 <b>Servis:</b> ${order.countryFlag} ${order.serviceName} (${order.countryName})\n` +
          `💰 <b>Tutar:</b> <code>${order.chargedPrice.toFixed(2)} ₺</code>\n` +
          `🔑 <b>SMS Kodu:</b> ${order.smsCode ? `<code>${order.smsCode}</code>` : "<i>(Henüz gelmedi)</i>"}\n` +
          `📌 <b>Durum:</b> ${statusLabel[order.status] || order.status}\n` +
          `━━━━━━━━━━━━━━━━━━━━` +
          cancelHint;

        const kb = new InlineKeyboard();
        if (waiting || order.status === "RECEIVED") kb.text("🔄 Kodu Kontrol Et", `order_chk:${order.id}`).row();
        if (canCancel) kb.text("❌ İptal Et & İade Al", `order_cnc:${order.id}`);
        if (canFinish) kb.text("✅ Tamamla", `order_fin:${order.id}`);
        if (canCancel || canFinish) kb.row();
        kb.text("📜 Numaralarım", "btn_my_orders").text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- BAKİYE YÜKLEME MENÜSÜ ---
      if (data === "btn_deposit_menu") {
        await sendAnimatedVisual(ctx, "🎰");
        const text =
          `💳 <b>BAKİYE YÜKLEME YÖNTEMLERİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>Mevcut Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n\n` +
          `Lütfen ödeme yapmak istediğiniz yöntemi seçiniz:`;

        const kb = new InlineKeyboard()
          .text("⚡ Kripto ile Öde (Otomatik)", "btn_dep_cbot")
          .row()
          .text("💎 TRON Cüzdanı (USDT TRC-20 / TRX)", "btn_dep_crypto")
          .row()
          .text("🎁 Kupon / Hediye Kodu Kullan", "btn_coupon_info")
          .row()
          .webApp("🚀 Mini App İle Yükle", appUrl)
          .row()
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- OTOMATİK KRİPTO MENÜSÜ & TUTAR SEÇİMİ ---
      if (data === "btn_dep_cbot" || data === "btn_dep_auto") {
        const { getApironeConfig } = await import("./apirone");
        const apironeCfg = getApironeConfig();

        if (!apironeCfg.account) {
          await editOrReply(
            ctx,
            `⚠️ <b>OTOMATİK KRİPTO ÖDEME SİSTEMİ HENÜZ AKTİF DEĞİL</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `Yönetici henüz kendi Apirone Account ID ve Transfer Key bilgilerini sisteme tanımlamamıştır.\n\n` +
              `Lütfen yöneticiyle iletişime geçiniz veya diğer ödeme yöntemlerini kullanınız.`,
            new InlineKeyboard()
              .text("💳 Diğer Ödeme Yolları", "btn_deposit_menu")
              .row()
              .text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        const { APIRONE_PAYMENT_COINS } = await import("./crypto-currencies");
        const text =
          `⚡ <b>KRİPTO İLE ÖDE (OTOMATİK)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Önce ödemeyi hangi kripto para birimiyle yapmak istediğinizi seçin.\n\n` +
          `💰 <b>Mevcut Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n\n` +
          `1. Kripto para birimini seçin 👇`;

        const kb = new InlineKeyboard();
        for (let i = 0; i < APIRONE_PAYMENT_COINS.length; i += 2) {
          kb.text(`🪙 ${APIRONE_PAYMENT_COINS[i]}`, `oxa_coin:${APIRONE_PAYMENT_COINS[i]}`);
          const nextCoin = APIRONE_PAYMENT_COINS[i + 1];
          if (nextCoin) kb.text(`🪙 ${nextCoin}`, `oxa_coin:${nextCoin}`);
          kb.row();
        }
        kb.text("🔙 Ödeme Menüsü", "btn_deposit_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- OTOMATİK KRİPTO: COIN SEÇİMİNDEN SONRA AĞI SOR ---
      if (data.startsWith("oxa_coin:")) {
        const coin = data.split(":")[1]?.toUpperCase() || "";
        const { getApironePaymentOptionsForCoin } = await import("./crypto-currencies");
        const options = getApironePaymentOptionsForCoin(coin);
        if (options.length === 0) {
          await editOrReply(ctx, "❌ Desteklenmeyen kripto para birimi.", new InlineKeyboard().text("🔙 Yeniden Seç", "btn_dep_cbot"));
          return;
        }

        const kb = new InlineKeyboard();
        for (const option of options) {
          kb.text(`🌐 ${option.networkLabel}`, `oxa_network:${coin}:${option.networkKey}`).row();
        }
        kb.text("🔙 Kripto Para Seçimine Dön", "btn_dep_cbot");

        await editOrReply(
          ctx,
          `⚡ <b>KRİPTO İLE ÖDE (OTOMATİK)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
            `🪙 Seçilen para: <b>${coin}</b>\n\n` +
            `2. Gönderim yapacağınız ağı seçin 👇`,
          kb
        );
        return;
      }

      // --- OTOMATİK KRİPTO: AĞ SEÇİMİNDEN SONRA TUTARI SOR ---
      if (data.startsWith("oxa_network:")) {
        const [, coin = "", network = ""] = data.split(":");
        const { getApironePaymentOption } = await import("./crypto-currencies");
        const option = getApironePaymentOption(coin, network);
        if (!option) {
          await editOrReply(ctx, "❌ Desteklenmeyen ağ seçimi.", new InlineKeyboard().text("🔙 Yeniden Seç", "btn_dep_cbot"));
          return;
        }

        const kb = new InlineKeyboard()
          .text("₺50", `oxa_pay:50:${coin}:${network}`)
          .text("₺100", `oxa_pay:100:${coin}:${network}`)
          .text("₺250", `oxa_pay:250:${coin}:${network}`)
          .row()
          .text("₺500", `oxa_pay:500:${coin}:${network}`)
          .text("₺1000", `oxa_pay:1000:${coin}:${network}`)
          .row()
          .webApp("✍️ Özel Tutarla Yükle (Mini App)", appUrl)
          .row()
          .text("🔙 Ağ Seçimine Dön", `oxa_coin:${coin}`);

        await editOrReply(
          ctx,
          `⚡ <b>KRİPTO İLE ÖDE (OTOMATİK)</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
            `🪙 <b>Kripto para:</b> ${coin}\n` +
            `🌐 <b>Ağ:</b> ${option.networkLabel}\n\n` +
            `3. Yüklemek istediğiniz tutarı seçin 👇`,
          kb
        );
        return;
      }

      // --- OTOMATİK KRİPTO ADRESİ & QR KOD OLUŞTURMA ---
      // --- OTOMATİK KRİPTO ADRESİ & QR KOD OLUŞTURMA (APIRONE) ---
      if (data.startsWith("oxa_pay:") || data.startsWith("cbot_pay:") || data.startsWith("apr_pay:")) {
        const parts = data.split(":");
        const amt = parseFloat(parts[1]) || 100;
        if (amt < 10) {
          await editOrReply(
            ctx,
            "❌ <b>Geçersiz Tutar</b>\n\nMinimum bakiye yükleme tutarı 10 ₺'dir.",
            new InlineKeyboard().text("🔙 Kripto Para Seç", "btn_dep_cbot")
          );
          return;
        }
        const payCurrency = (parts[2] || "USDT").toUpperCase();
        const network = (parts[3] || (payCurrency === "USDT" ? "TRC20" : "TRON")).toUpperCase();
        const { getApironePaymentOption } = await import("./crypto-currencies");
        const selectedPaymentOption = getApironePaymentOption(payCurrency, network);
        if (!selectedPaymentOption) {
          await editOrReply(
            ctx,
            "❌ Seçilen kripto para ve ağ desteklenmiyor. Lütfen yeniden seçim yapın.",
            new InlineKeyboard().text("🔙 Kripto Para Seç", "btn_dep_cbot")
          );
          return;
        }
        const depositId = `dep_apr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        await db.syncFromCloud(true);
        const { createApironeInvoice } = await import("./apirone");
        const payResult = await createApironeInvoice({
          telegramId: Number(from.id),
          username: from.username && !from.username.startsWith("user_") ? from.username : "",
          amountTry: amt,
          payCurrency,
          network,
          orderId: depositId,
        });

        const invoiceId = payResult.invoiceId || payResult.trackId;

        if (!payResult.success || !payResult.address || !invoiceId) {
          await editOrReply(
            ctx,
            `❌ <b>Ödeme Adresi Oluşturulamadı</b>\n\n${payResult.error || "Kripto servisine bağlanılamadı."}`,
            new InlineKeyboard().text("🔙 Geri Dön", "btn_dep_cbot")
          );
          return;
        }

        // Pending deposit kaydı oluştur
        await db.createDeposit({
          id: depositId,
          telegramId: Number(from.id),
          username: from.username && !from.username.startsWith("user_") ? from.username : "",
          amount: amt,
          method: "Crypto",
          status: "PENDING",
          referenceCode: `APR-${invoiceId}`,
          txid: String(invoiceId),
          createdAt: new Date().toISOString(),
        });

        const caption =
          `⚡ <b>KRİPTO İLE ÖDE (OTOMATİK - APIRONE)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>Yüklenecek Bakiye:</b> <code>${amt.toFixed(2)} ₺</code>\n` +
          `🪙 <b>Yatırılacak Tutar:</b> <code>${payResult.payAmount} ${payResult.payCurrency}</code>\n` +
          `🌐 <b>Ağ:</b> <code>${payResult.network}</code>\n\n` +
          `📋 <b>Özel Ödeme Adresi (Kopyalamak için dokunun):</b>\n` +
          `<code>${payResult.address}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⏳ <b>Geçerlilik Süresi:</b> 60 Dakika\n` +
          `ℹ️ Herhangi bir borsadan (Binance, Paribu, BtcTurk vb.) veya cüzdanınızdan (TrustWallet, TronLink) bu adrese transfer yaptığınızda, ağ onayının ardından bakiyeniz <b>otomatik olarak</b> hesabınıza yüklenecektir.\n` +
          `💡 <i>Borsa çekim küsuratlarında 10 ₺'ye kadar olan küçük eksiklikler sistemimizce tolere edilir; 10 ₺ altı ödemeler kabul edilmez.</i>`;

        const kb = new InlineKeyboard()
          .text("🔄 Ödemeyi Kontrol Et", `oxa_chk:${invoiceId}:${amt}`)
          .row();

        if (payResult.invoiceUrl) {
          kb.url("🌐 Fatura Sayfasını Aç", payResult.invoiceUrl).row();
        }

        kb.text("🔙 Ödeme Menüsü", "btn_deposit_menu");

        // QR kod fotoğrafı göndermeyi dene, hata olursa metin olarak göster
        try {
          if (payResult.qrCodeUrl) {
            await ctx.replyWithPhoto(payResult.qrCodeUrl, {
              caption,
              parse_mode: "HTML",
              reply_markup: kb,
            });
            return;
          }
        } catch {
          // Görsel gönderilemezse editOrReply ile devam et
        }

        await editOrReply(ctx, caption, kb);
        return;
      }

      // --- OTOMATİK KRİPTO ÖDEME DURUM KONTROLÜ ---
      if (data.startsWith("oxa_chk:") || data.startsWith("cbot_chk:") || data.startsWith("apr_chk:")) {
        const parts = data.split(":");
        const trackId = parts[1];
        const amt = parseFloat(parts[2]) || 0;

        const { getPaymentInformation, evaluateCryptoTolerance } = await import("./oxapay");
        const payInfo = await getPaymentInformation(trackId);

        const deposits = db.getDeposits();
        const dep = deposits.find(
          (d) =>
            d.referenceCode === `APR-${trackId}` ||
            d.referenceCode === `OXA-${trackId}` ||
            d.txid === String(trackId)
        );
        const depositAmountTry = dep?.amount || amt;
        const tolerance = evaluateCryptoTolerance(payInfo, depositAmountTry);

        if (payInfo.success && (payInfo.status === "paid" || tolerance.isAccepted)) {
          // updateDepositStatus bakiyeyi tek seferlik yükler (ikinci kez eklenmez)
          if (dep && dep.status !== "APPROVED") {
            await db.updateDepositStatus(dep.id, "APPROVED");
          }

          const updatedUser = db.getUser(from.id);
          const toleranceNote = tolerance.deficitTry > 0
            ? `\nℹ️ <i>Küçük yuvarlama farkı toleransı (${tolerance.deficitTry.toFixed(2)} ₺ eksik) onaylandı ve bakiyeniz tam olarak yüklendi.</i>\n`
            : "";

          await editOrReply(
            ctx,
            `🎉 <b>ÖDEMENİZ ONAYLANDI!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 <b>Yüklenen Tutar:</b> <code>+${depositAmountTry.toFixed(2)} ₺</code>\n` +
            `💳 <b>Yeni Bakiyeniz:</b> <code>${(updatedUser?.balance || 0).toFixed(2)} ₺</code>\n` +
            toleranceNote +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `<i>Bakiyeniz hesabınıza aktarılmıştır. Keyifli alışverişler dileriz!</i>`,
            new InlineKeyboard().text("🛒 Hemen Numara Al", "btn_buy_menu").row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        if (payInfo.status === "paying") {
          try {
            await ctx.answerCallbackQuery({
              text: "⚡ İşleminiz blokzincirinde tespit edildi! Ağ onayı bekleniyor, lütfen biraz bekleyiniz.",
              show_alert: true,
            });
          } catch (e) {}
          return;
        }

        if (payInfo.status === "underpaid") {
          const deficitStr = tolerance.deficitTry > 0 ? `${tolerance.deficitTry.toFixed(2)} ₺` : "eksik";
          try {
            await ctx.answerCallbackQuery({
              text: `⚠️ Eksik tutar tespit edildi (${deficitStr} eksik)!\nKabul edilebilir maksimum eksiklik toleransı 10 ₺'dir. Lütfen kalan tutarı da adrese gönderiniz.`,
              show_alert: true,
            });
          } catch (e) {}
          return;
        }

        try {
          await ctx.answerCallbackQuery({
            text: "⏳ Ödeme henüz blokzincirinde tespit edilmedi. Transfer yaptıktan 1-2 dakika sonra tekrar kontrol ediniz.",
            show_alert: true,
          });
        } catch (e) {}
        return;
      }

      // --- KRİPTO BİLGİLERİ ---
      if (data === "btn_dep_crypto") {
        const settings = db.getSettings();
        const crypto = settings.cryptoSettings;
        const address = (crypto?.usdtTrc20Address || crypto?.trxAddress || "").trim();

        if (!address || address === "TR7NHqJEKQxGTCi8q8ZY4pL8otSzgjLj6t") {
          await editOrReply(
            ctx,
            `⚠️ <b>TRON CÜZDAN ADRESİ HENÜZ TANIMLANMADI</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `Yönetici henüz kişisel TRON (USDT / TRX) cüzdan adresini kaydetmemiştir.\n\n` +
              `Lütfen yöneticiyle iletişime geçiniz veya diğer ödeme yöntemlerini kullanınız.`,
            new InlineKeyboard()
              .text("💳 Diğer Ödeme Yolları", "btn_deposit_menu")
              .row()
              .text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        const text =
          `💎 <b>KRİPTO PARA İLE BAKİYE YÜKLE</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 <b>Ağ:</b> TRON (TRC-20)\n` +
          `🪙 <b>Kabul Edilen:</b> USDT (TRC-20) veya TRX\n\n` +
          `📍 <b>Cüzdan Adresi (Kopyalamak için dokunun):</b>\n` +
          `<code>${address}</code>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚡ <i>Ödemenizi gönderdikten sonra Mini App içerisinden TxID girerek otomatik veya yöneticimize ileterek anında bakiyenize ekletebilirsiniz.</i>`;

        const kb = new InlineKeyboard()
          .webApp("⚡ Mini App'te Otomatik Doğrula", appUrl)
          .row()
          .text("💳 Diğer Ödeme Yolları", "btn_deposit_menu")
          .row()
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- PROFİLİM ---
      if (data === "btn_my_profile") {
        const activations = db.getUserActivations(from.id);
        const vipStatusText = user.isVip
          ? `⭐ <b>VIP Üye (%${user.vipDiscountPercent || 15} Özel İndirim)</b>`
          : `🟢 Standart Üye`;

        const vipPerks = user.isVip
          ? `\n🌟 <b>VIP Ayrıcalığınız:</b> Tüm sanal numara alımlarında <b>%${user.vipDiscountPercent || 15}</b> indirimli fiyat uygulanmaktadır.`
          : `\n💡 <i>VIP üye olmak ve tüm numaralarda indirim kazanmak için yöneticimizle iletişime geçin veya tek seferde 500 ₺ yükleyin!</i>`;

        const text =
          `👤 <b>KULLANICI PROFİLİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Telegram ID:</b> <code>${from.id}</code>\n` +
          `👤 <b>Kullanıcı Adı:</b> @${from.username || "Yok"}\n` +
          `✨ <b>İsim:</b> ${(from.first_name || "").replace(/[<>&]/g, "")}\n` +
          `💎 <b>Üyelik Durumu:</b> ${vipStatusText}\n` +
          `💰 <b>Kullanılabilir Bakiye:</b> <code>${user.balance.toFixed(2)} ₺</code>\n` +
          `💸 <b>Toplam Harcama:</b> <code>${user.spent.toFixed(2)} ₺</code>\n` +
          `📦 <b>Toplam Sipariş:</b> <code>${activations.length} adet</code>\n` +
          `🛡️ <b>Hesap Statüsü:</b> ${user.isBanned ? "🔴 Yasaklı (Banlı)" : user.role === "admin" ? "👑 Yönetici" : "🟢 Aktif"}\n` +
          `━━━━━━━━━━━━━━━━━━━━` +
          vipPerks;

        const kb = new InlineKeyboard()
          .text("💳 Bakiye Yükle", "btn_deposit_menu")
          .text("🛒 Numara Satın Al", "btn_buy_menu")
          .row()
          .text("📜 Siparişlerim", "btn_my_orders")
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- YARDIM VE DESTEK ---
      if (data === "btn_help_info") {
        await sendAnimatedVisual(ctx, "🎯");

        const settings = db.getSettings();
        const rawList = settings.supportTelegramUsernames !== undefined
          ? settings.supportTelegramUsernames
          : (settings.supportTelegramUsername ? [settings.supportTelegramUsername] : []);
        const supportUsernames = rawList.map((u) => u.replace(/^@/, "").trim()).filter(Boolean);

        const supportAdminsText = supportUsernames.length > 0
          ? supportUsernames.map((u) => `👑 <b>Canlı Destek:</b> @${u}`).join("\n")
          : `💬 <i>Canlı destek için lütfen Mini App üzerinden bilet açınız.</i>`;

        const text =
          `🆘 <b>AZFUR SMS DESTEK MERKEZİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `${supportAdminsText}\n` +
          `💬 <i>Tüm bakiye, numara veya teknik konular için doğrudan yöneticilerimizle iletişime geçebilirsiniz.</i>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `❓ <b>Numara nasıl alınır?</b>\n` +
          `'Numara Satın Al' butonuna dokunun, servisinizi ve ülkenizi seçin. Numaranız 1 saniye içinde üretilir.\n\n` +
          `⏳ <b>SMS kodu ne zaman gelir?</b>\n` +
          `Ortalama 5-30 saniye içinde bot ekranınıza iletilir ve anlık bildirim alırsınız.\n\n` +
          `💰 <b>Kod gelmezse ne olur?</b>\n` +
          `'İptal Et & İade Al' butonuna bastığınız anda paranız %100 eksiksiz bakiyenize geri döner.\n\n` +
          `⚡ <b>7/24 Kesintisiz Hizmet:</b> Otomatik sistemimiz günün her saati aktiftir.`;

        const kb = new InlineKeyboard();
        for (const u of supportUsernames) {
          kb.url(`💬 Yöneticiye Yaz (@${u})`, `https://t.me/${u}`).row();
        }
        kb.webApp("🎫 Mini App Destek Talebi Aç", appUrl)
          .row()
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }


      // --- YÖNETİCİ MENÜSÜ ---
      if (data === "btn_admin_menu") {
        if (!isAdmin) {
          try { await ctx.answerCallbackQuery(); } catch (e) {}
          return;
        }

        db.addLog({
          category: "ADMIN",
          level: "INFO",
          action: "BOT_ADMIN_MENU_OPENED",
          details: `Yönetici ${from.first_name || ""} (@${from.username || from.id}) bot üzerinden Yönetici Kontrol Paneline giriş yaptı.`,
          telegramId: from.id,
          username: from.username,
        }).catch(() => {});

        const allUsers = db.getAllUsers();
        const allActivations = db.getAllActivations();
        const settings = db.getSettings();
        const providerBalance = await heroSms.getBalance();

        const totalUserBalance = allUsers.reduce((sum, u) => sum + (u.balance || 0), 0);
        const totalUserSpent = allUsers.reduce((sum, u) => sum + (u.spent || 0), 0);

        const text =
          `👑 <b>YÖNETİCİ KONTROL PANELİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🛠️ <b>Bakım Durumu:</b> ${settings.maintenanceMode ? "🔴 AKTİF (Kullanıcılara Kapalı)" : "🟢 KAPALI (Sistem Açık)"}\n` +
          `👥 <b>Kayıtlı Kullanıcı:</b> <code>${allUsers.length} kişi</code>\n` +
          `💳 <b>Kullanıcı Bakiyeleri Toplamı:</b> <code>${totalUserBalance.toFixed(2)} ₺</code>\n` +
          `💸 <b>Toplam Gerçekleşen Ciro:</b> <code>${totalUserSpent.toFixed(2)} ₺</code>\n` +
          `📦 <b>Toplam Sipariş Adedi:</b> <code>${allActivations.length} adet</code>\n` +
          `🌐 <b>Hero-SMS Sağlayıcı Bakiyesi:</b> <code>${providerBalance.balance.toFixed(2)} USD</code>\n` +
          `💱 <b>Aktif USD Kuru:</b> <code>${(settings.lastTcmbRate || settings.exchangeRateToTry || 49.2).toFixed(2)} ₺</code>\n` +
          `📈 <b>Global Kâr Marjı:</b> <code>%${settings.globalMarginPercent} + ${settings.globalFixedFee}₺</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━`;

        const kb = new InlineKeyboard()
          .webApp("🛡️ Detaylı Web Admin Paneli", adminUrl)
          .row()
          .text(
            settings.maintenanceMode ? "🟢 Bakım Modunu KAPAT" : "🔴 Sistemi BAKIMA AL",
            "adm_toggle_maintenance"
          )
          .row()
          .text("📦 Yedekleme & Geri Yükleme", "adm_bkp_menu")
          .row()
          .text("🔄 Bilgileri Yenile", "btn_admin_menu")
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- BAKIM MODUNU DEĞİŞTİRME BUTONU ---
      if (data === "adm_toggle_maintenance") {
        if (!isAdmin) {
          try { await ctx.answerCallbackQuery(); } catch (e) {}
          return;
        }

        const currentSettings = db.getSettings();
        const newMode = !currentSettings.maintenanceMode;
        await db.updateSettings({ maintenanceMode: newMode });

        db.addLog({
          category: "ADMIN",
          level: newMode ? "WARN" : "SUCCESS",
          action: newMode ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED",
          details: `Yönetici ${from.first_name || ""} (@${from.username || from.id}) bot üzerinden bakım modunu ${newMode ? "AÇTI" : "KAPATTI"}.`,
          telegramId: from.id,
          username: from.username,
        }).catch(() => {});

        try {
          await ctx.answerCallbackQuery({
            text: newMode
              ? "🛠️ Bakım modu AÇILDI! Normal kullanıcılar sisteme erişemez."
              : "🟢 Bakım modu KAPATILDI! Sistem tüm kullanıcılara açıldı.",
            show_alert: true,
          });
        } catch (e) {}

        const allUsers = db.getAllUsers();
        const allActivations = db.getAllActivations();
        const updatedSettings = db.getSettings();
        const providerBalance = await heroSms.getBalance();

        const totalUserBalance = allUsers.reduce((sum, u) => sum + (u.balance || 0), 0);
        const totalUserSpent = allUsers.reduce((sum, u) => sum + (u.spent || 0), 0);

        const text =
          `👑 <b>YÖNETİCİ KONTROL PANELİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🛠️ <b>Bakım Durumu:</b> ${updatedSettings.maintenanceMode ? "🔴 AKTİF (Kullanıcılara Kapalı)" : "🟢 KAPALI (Sistem Açık)"}\n` +
          `👥 <b>Kayıtlı Kullanıcı:</b> <code>${allUsers.length} kişi</code>\n` +
          `💳 <b>Kullanıcı Bakiyeleri Toplamı:</b> <code>${totalUserBalance.toFixed(2)} ₺</code>\n` +
          `💸 <b>Toplam Gerçekleşen Ciro:</b> <code>${totalUserSpent.toFixed(2)} ₺</code>\n` +
          `📦 <b>Toplam Sipariş Adedi:</b> <code>${allActivations.length} adet</code>\n` +
          `🌐 <b>Hero-SMS Sağlayıcı Bakiyesi:</b> <code>${providerBalance.balance.toFixed(2)} USD</code>\n` +
          `💱 <b>Aktif USD Kuru:</b> <code>${(updatedSettings.lastTcmbRate || updatedSettings.exchangeRateToTry || 49.2).toFixed(2)} ₺</code>\n` +
          `📈 <b>Global Kâr Marjı:</b> <code>%${updatedSettings.globalMarginPercent} + ${updatedSettings.globalFixedFee}₺</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━`;

        const kb = new InlineKeyboard()
          .webApp("🛡️ Detaylı Web Admin Paneli", adminUrl)
          .row()
          .text(
            updatedSettings.maintenanceMode ? "🟢 Bakım Modunu KAPAT" : "🔴 Sistemi BAKIMA AL",
            "adm_toggle_maintenance"
          )
          .row()
          .text("📦 Yedekleme & Geri Yükleme", "adm_bkp_menu")
          .row()
          .text("🔄 Bilgileri Yenile", "btn_admin_menu")
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- YÖNETİCİ YEDEKLEME MENÜSÜ ---
      if (data === "adm_bkp_menu") {
        if (!isAdmin) {
          try { await ctx.answerCallbackQuery(); } catch (e) {}
          return;
        }

        await db.syncFromCloud();
        await db.checkAndRunAutoBackup().catch(() => {});
        const backups = db.getBackups();
        const settings = db.getSettings();
        const bs = settings.backupSettings || {
          autoBackupEnabled: true,
          autoBackupIntervalHours: 6,
          maxBackupsCount: 20,
        };

        const lastBackupStr =
          bs.lastBackupAt ||
          bs.lastBackupTime ||
          bs.lastAutoBackupTime ||
          backups[0]?.createdAt ||
          backups[0]?.timestamp ||
          null;
        const lastBackupFormatted = lastBackupStr
          ? new Date(lastBackupStr).toLocaleString("tr-TR")
          : "Henüz yedek alınmadı";

        const text =
          `📦 <b>SİSTEM YEDEKLEME & GERİ YÜKLEME</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🤖 <b>Otomatik Yedekleme:</b> ${bs.autoBackupEnabled ? "🟢 Aktif" : "🔴 Kapalı"}\n` +
          `⏱️ <b>Yedekleme Sıklığı:</b> <code>Her ${bs.autoBackupIntervalHours || 6} Saatte Bir</code>\n` +
          `🗄️ <b>Kayıtlı Yedek Sayısı:</b> <code>${backups.length} Adet</code> (Maks: ${bs.maxBackupsCount || 20})\n` +
          `🕒 <b>Son Yedekleme:</b> <code>${lastBackupFormatted}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👇 <i>Aşağıdaki butonlarla tek dokunuşla anında yedek alabilir, veritabanını indirebilir veya sistemi önceki bir yedeğe döndürebilirsiniz:</i>`;

        const kb = new InlineKeyboard()
          .text("💾 Şimdi Manuel Yedek Al", "adm_bkp_create")
          .row()
          .text("📥 Canlı SQL Veritabanını İndir (.sql)", "adm_bkp_dl_live")
          .row()
          .text(`📋 Kayıtlı Yedekler (${backups.length})`, "adm_bkp_list")
          .row()
          .text("⚙️ Otomatik Yedek Ayarları", "adm_bkp_settings")
          .row()
          .text("👑 Yönetici Menüsü", "btn_admin_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- ŞİMDİ MANUEL YEDEK AL (ANINDA .SQL DOSYASI GÖNDERİR) ---
      if (data === "adm_bkp_create") {
        if (!isAdmin) return;
        try {
          await ctx.answerCallbackQuery({ text: "⏳ Sistem yedeği oluşturuluyor..." });
        } catch (e) {}

        const backup = await db.createBackup("MANUAL", `Telegram Bot Yedeği (${from.first_name || "Admin"})`);
        const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const fileName = `azfur_yedek_${backup.id}_${dateStr}.sql`;
        const sqlContent = await db.generateSqlDump(backup.data);
        const sqlBuffer = Buffer.from(sqlContent, "utf8");

        await ctx.replyWithDocument(new InputFile(sqlBuffer, fileName), {
          caption:
            `✅ <b>SİSTEM YEDEĞİ BAŞARIYLA OLUŞTURULDU!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🏷️ <b>Etiket:</b> ${backup.label}\n` +
            `🕒 <b>Tarih:</b> ${new Date(backup.timestamp).toLocaleString("tr-TR")}\n` +
            `👥 <b>Kullanıcı Sayısı:</b> ${backup.stats?.usersCount} kişi\n` +
            `💰 <b>Toplam Bakiye:</b> ${backup.stats?.totalUserBalance?.toFixed(2)} ₺\n` +
            `📦 <b>Toplam Sipariş:</b> ${backup.stats?.activationsCount} adet\n` +
            `📁 <b>Dosya Boyutu:</b> ${(Buffer.byteLength(sqlContent, "utf8") / 1024).toFixed(1)} KB\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💾 <i>PostgreSQL SQL formatındaki yedek dosyanız yukarıda hazır! İndirip cihazınızda saklayabilirsiniz.</i>`,
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard()
            .text("📦 Yedekleme Menüsü", "adm_bkp_menu")
            .row()
            .text("🔙 Ana Menü", "btn_main_menu"),
        });
        return;
      }

      // --- CANLI VERİTABANINI İNDİR (.SQL OLARAK DOĞRUDAN SOHBETE ATAR) ---
      if (data === "adm_bkp_dl_live") {
        if (!isAdmin) return;
        try {
          await ctx.answerCallbackQuery({ text: "📥 Canlı SQL veritabanı hazırlanıyor..." });
        } catch (e) {}

        db.addLog({
          category: "SYSTEM",
          level: "WARN",
          action: "BOT_LIVE_DB_DOWNLOADED",
          details: `Yönetici ${from.first_name || ""} (@${from.username || from.id}) bot üzerinden canlı PostgreSQL veritabanını (.sql) indirdi.`,
          telegramId: from.id,
          username: from.username,
        }).catch(() => {});

        await db.syncFromCloud();
        const liveSnapshot = db.getFullDatabaseSnapshot();
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `azfur_canli_veritabani_${dateStr}.sql`;
        const sqlContent = await db.generateSqlDump();
        const sqlBuffer = Buffer.from(sqlContent, "utf8");

        const usersCount = Object.keys(liveSnapshot.users || {}).length;
        const activationsCount = Object.keys(liveSnapshot.activations || {}).length;

        await ctx.replyWithDocument(new InputFile(sqlBuffer, fileName), {
          caption:
            `📥 <b>CANLI POSTGRESQL VERİTABANI YEDEĞİ</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🕒 <b>Tarih:</b> ${new Date().toLocaleString("tr-TR")}\n` +
            `👥 <b>Kayıtlı Kullanıcı:</b> ${usersCount} kişi\n` +
            `📦 <b>Siparişler:</b> ${activationsCount} adet\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💾 <i>Mevcut tüm ayarlar ve veritabanı içeriği PostgreSQL .sql formatında eklenmiştir.</i>`,
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard()
            .text("📦 Yedekleme Menüsü", "adm_bkp_menu")
            .row()
            .text("🔙 Ana Menü", "btn_main_menu"),
        });
        return;
      }

      // --- KAYITLI YEDEKLER LİSTESİ ---
      if (data === "adm_bkp_list") {
        if (!isAdmin) return;
        await db.syncFromCloud();
        const backups = db.getBackups();

        if (backups.length === 0) {
          await editOrReply(
            ctx,
            `📋 <b>KAYITLI YEDEK BULUNAMADI</b>\n\nHenüz sistemde kayıtlı bir snapshot bulunmuyor. Hemen bir yedek alabilirsiniz:`,
            new InlineKeyboard()
              .text("💾 Şimdi Yedek Al", "adm_bkp_create")
              .row()
              .text("🔙 Yedekleme Menüsü", "adm_bkp_menu")
          );
          return;
        }

        const recent = backups.slice(0, 5);
        let listText = `📋 <b>KAYITLI SİSTEM YEDEKLERİ (${backups.length})</b>\n━━━━━━━━━━━━━━━━━━━━\n`;

        const kb = new InlineKeyboard();
        recent.forEach((b, idx) => {
          const typeIcon = b.type === "AUTO" ? "🤖" : b.type === "PRE_RESTORE" ? "🛡️" : "👤";
          const dateShort = new Date(b.timestamp).toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          listText += `${idx + 1}. ${typeIcon} <b>${b.label}</b>\n   🕒 ${dateShort} • ${(b.sizeBytes / 1024).toFixed(1)} KB • 👥 ${b.stats?.usersCount || 0} Kullanıcı\n\n`;

          kb.text(`📥 ${idx + 1}. İndir`, `adm_bkp_dl:${b.id}`)
            .text(`🔄 Geri Yükle`, `adm_bkp_rst_ask:${b.id}`)
            .text(`🗑️ Sil`, `adm_bkp_del:${b.id}`)
            .row();
        });

        kb.text("🔙 Yedekleme Menüsü", "adm_bkp_menu");

        await editOrReply(ctx, listText, kb);
        return;
      }

      // --- TEKİL YEDEĞİ İNDİR (TELEGRAM DOSYASI OLARAK) ---
      if (data.startsWith("adm_bkp_dl:")) {
        if (!isAdmin) return;
        const bId = data.split(":")[1];
        const backup = db.getBackupById(bId);
        if (!backup) {
          try {
            await ctx.answerCallbackQuery({ text: "❌ Yedek bulunamadı!", show_alert: true });
          } catch (e) {}
          return;
        }

        try {
          await ctx.answerCallbackQuery({ text: "📥 Dosya gönderiliyor..." });
        } catch (e) {}

        const rawDate = backup.createdAt || backup.timestamp;
        const d = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : new Date();
        const dateStr = d.toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const fileName = `azfur_yedek_${backup.id}_${dateStr}.sql`;
        const sqlContent = await db.generateSqlDump(backup.data);
        const sqlBuffer = Buffer.from(sqlContent, "utf8");

        await ctx.replyWithDocument(new InputFile(sqlBuffer, fileName), {
          caption:
            `📦 <b>${backup.label}</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🕒 <b>Tarih:</b> ${d.toLocaleString("tr-TR")}\n` +
            `👥 <b>Kullanıcı Sayısı:</b> ${backup.stats?.usersCount || 0} kişi\n` +
            `📁 <b>Boyut:</b> ${(Buffer.byteLength(sqlContent, "utf8") / 1024).toFixed(1)} KB\n` +
            `💾 <i>PostgreSQL (.sql) formatında sistem snapshot yedeği.</i>`,
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard()
            .text("📋 Yedek Listesi", "adm_bkp_list")
            .text("🔙 Yedekleme Menüsü", "adm_bkp_menu"),
        });
        return;
      }

      // --- YEDEĞİ SİL ---
      if (data.startsWith("adm_bkp_del:")) {
        if (!isAdmin) return;
        const bId = data.split(":")[1];
        await db.deleteBackup(bId);
        try {
          await ctx.answerCallbackQuery({ text: "🗑️ Yedek kalıcı olarak silindi!", show_alert: true });
        } catch (e) {}

        // Listeyi yenile
        const backups = db.getBackups();
        if (backups.length === 0) {
          await editOrReply(
            ctx,
            `📋 <b>KAYITLI YEDEK KALMADI</b>\n\nTüm yedekler silindi. Hemen yeni bir yedek alabilirsiniz:`,
            new InlineKeyboard()
              .text("💾 Şimdi Yedek Al", "adm_bkp_create")
              .row()
              .text("🔙 Yedekleme Menüsü", "adm_bkp_menu")
          );
          return;
        }

        const recent = backups.slice(0, 5);
        let listText = `📋 <b>KAYITLI SİSTEM YEDEKLERİ (${backups.length})</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
        const kb = new InlineKeyboard();
        recent.forEach((b, idx) => {
          const typeIcon = b.type === "AUTO" ? "🤖" : b.type === "PRE_RESTORE" ? "🛡️" : "👤";
          const dateShort = new Date(b.timestamp).toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          listText += `${idx + 1}. ${typeIcon} <b>${b.label}</b>\n   🕒 ${dateShort} • ${(b.sizeBytes / 1024).toFixed(1)} KB • 👥 ${b.stats?.usersCount || 0} Kullanıcı\n\n`;
          kb.text(`📥 ${idx + 1}. İndir`, `adm_bkp_dl:${b.id}`)
            .text(`🔄 Geri Yükle`, `adm_bkp_rst_ask:${b.id}`)
            .text(`🗑️ Sil`, `adm_bkp_del:${b.id}`)
            .row();
        });
        kb.text("🔙 Yedekleme Menüsü", "adm_bkp_menu");
        await editOrReply(ctx, listText, kb);
        return;
      }

      // --- GERİ YÜKLEME SORUSU ---
      if (data.startsWith("adm_bkp_rst_ask:")) {
        if (!isAdmin) return;
        const bId = data.split(":")[1];
        const backup = db.getBackupById(bId);
        if (!backup) {
          try {
            await ctx.answerCallbackQuery({ text: "Yedek bulunamadı!", show_alert: true });
          } catch (e) {}
          return;
        }

        const text =
          `⚠️ <b>GERİ YÜKLEME ONAYI</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Bu işlem mevcut veritabanını aşağıdaki yedeğin durumuna geri döndürecektir:\n\n` +
          `🏷️ <b>Hedef Yedek:</b> ${backup.label}\n` +
          `🕒 <b>Yedek Tarihi:</b> ${new Date(backup.timestamp).toLocaleString("tr-TR")}\n` +
          `👥 <b>Kullanıcı Sayısı:</b> ${backup.stats?.usersCount || 0}\n` +
          `💰 <b>Bakiye Toplamı:</b> ${backup.stats?.totalUserBalance || 0} ₺\n\n` +
          `🛡️ <i>İşlem öncesinde mevcut durumun otomatik güvenlik yedeği (PRE_RESTORE) alınacaktır. Asla veri kaybı yaşanmaz.</i>\n\n` +
          `Geri yüklemeyi onaylıyor musunuz?`;

        const kb = new InlineKeyboard()
          .text("✅ Evet, Geri Yükle", `adm_bkp_rst_do:${backup.id}`)
          .row()
          .text("❌ Vazgeç", "adm_bkp_list");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- GERİ YÜKLEME İCRA ET ---
      if (data.startsWith("adm_bkp_rst_do:")) {
        if (!isAdmin) return;
        const bId = data.split(":")[1];
        const backup = db.getBackupById(bId);
        if (!backup || !backup.data) {
          try {
            await ctx.answerCallbackQuery({ text: "Yedek bulunamadı veya hasarlı!", show_alert: true });
          } catch (e) {}
          return;
        }

        try {
          await ctx.answerCallbackQuery({ text: "🔄 Geri yükleme yapılıyor..." });
        } catch (e) {}

        const result = await db.restoreBackup(backup.data);

        const text =
          `🎉 <b>SİSTEM BAŞARIYLA GERİ YÜKLENDİ!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `✅ ${result.message}\n\n` +
          `👥 <b>Aktif Kullanıcı:</b> ${result.details?.usersCount || 0}\n` +
          `📦 <b>Siparişler:</b> ${result.details?.activationsCount || 0}\n` +
          `💳 <b>Bakiye Talepleri:</b> ${result.details?.depositsCount || 0}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🛡️ <i>Mevcut durumun güvenlik yedeği (PRE_RESTORE) başarıyla kaydedildi.</i>`;

        const kb = new InlineKeyboard()
          .text("📦 Yedekleme Menüsü", "adm_bkp_menu")
          .row()
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- OTOMATİK YEDEK AYARLARI ---
      if (data === "adm_bkp_settings") {
        if (!isAdmin) return;
        const settings = db.getSettings();
        const bs = settings.backupSettings || {
          autoBackupEnabled: true,
          autoBackupIntervalHours: 6,
          maxBackupsCount: 20,
        };

        const text =
          `⚙️ <b>OTOMATİK YEDEKLEME AYARLARI</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Otomatik Yedekleme: ${bs.autoBackupEnabled ? "🟢 AÇIK" : "🔴 KAPALI"}\n` +
          `Mevcut Periyot: <code>Her ${bs.autoBackupIntervalHours || 6} Saatte Bir</code>\n` +
          `Maksimum Yedek: <code>${bs.maxBackupsCount || 20} Adet</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Aşağıdaki butonlarla ayarları anında değiştirebilirsiniz:`;

        const kb = new InlineKeyboard()
          .text(bs.autoBackupEnabled ? "🔴 Otomatiği Kapat" : "🟢 Otomatiği Aç", "adm_bkp_toggle_auto")
          .row()
          .text("⏱️ 1 Saat", "adm_bkp_set_int:1")
          .text("⏱️ 3 Saat", "adm_bkp_set_int:3")
          .text("⏱️ 6 Saat ⭐", "adm_bkp_set_int:6")
          .row()
          .text("⏱️ 12 Saat", "adm_bkp_set_int:12")
          .text("⏱️ 24 Saat", "adm_bkp_set_int:24")
          .row()
          .text("🔙 Yedekleme Menüsü", "adm_bkp_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      if (data === "adm_bkp_toggle_auto") {
        if (!isAdmin) return;
        const settings = db.getSettings();
        const cur = settings.backupSettings?.autoBackupEnabled ?? true;
        await db.updateBackupSettings({ autoBackupEnabled: !cur });
        try {
          await ctx.answerCallbackQuery({
            text: !cur ? "🟢 Otomatik yedekleme açıldı" : "🔴 Otomatik yedekleme kapatıldı",
          });
        } catch (e) {}

        const updatedBs = db.getSettings().backupSettings || {
          autoBackupEnabled: !cur,
          autoBackupIntervalHours: 6,
          maxBackupsCount: 20,
        };
        const text =
          `⚙️ <b>OTOMATİK YEDEKLEME AYARLARI</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Otomatik Yedekleme: ${updatedBs.autoBackupEnabled ? "🟢 AÇIK" : "🔴 KAPALI"}\n` +
          `Mevcut Periyot: <code>Her ${updatedBs.autoBackupIntervalHours || 6} Saatte Bir</code>\n` +
          `Maksimum Yedek: <code>${updatedBs.maxBackupsCount || 20} Adet</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Aşağıdaki butonlarla ayarları anında değiştirebilirsiniz:`;

        const kb = new InlineKeyboard()
          .text(updatedBs.autoBackupEnabled ? "🔴 Otomatiği Kapat" : "🟢 Otomatiği Aç", "adm_bkp_toggle_auto")
          .row()
          .text("⏱️ 1 Saat", "adm_bkp_set_int:1")
          .text("⏱️ 3 Saat", "adm_bkp_set_int:3")
          .text("⏱️ 6 Saat ⭐", "adm_bkp_set_int:6")
          .row()
          .text("⏱️ 12 Saat", "adm_bkp_set_int:12")
          .text("⏱️ 24 Saat", "adm_bkp_set_int:24")
          .row()
          .text("🔙 Yedekleme Menüsü", "adm_bkp_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      if (data.startsWith("adm_bkp_set_int:")) {
        if (!isAdmin) return;
        const h = parseInt(data.split(":")[1]) || 6;
        await db.updateBackupSettings({ autoBackupIntervalHours: h });
        try {
          await ctx.answerCallbackQuery({
            text: `⏱️ Yedekleme aralığı her ${h} saat olarak ayarlandı!`,
          });
        } catch (e) {}

        const updatedBs = db.getSettings().backupSettings;
        const text =
          `⚙️ <b>OTOMATİK YEDEKLEME AYARLARI</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Otomatik Yedekleme: ${updatedBs?.autoBackupEnabled ? "🟢 AÇIK" : "🔴 KAPALI"}\n` +
          `Mevcut Periyot: <code>Her ${h} Saatte Bir</code>\n` +
          `Maksimum Yedek: <code>${updatedBs?.maxBackupsCount || 20} Adet</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Aşağıdaki butonlarla ayarları anında değiştirebilirsiniz:`;

        const kb = new InlineKeyboard()
          .text(updatedBs?.autoBackupEnabled ? "🔴 Otomatiği Kapat" : "🟢 Otomatiği Aç", "adm_bkp_toggle_auto")
          .row()
          .text(h === 1 ? "✅ 1 Saat" : "⏱️ 1 Saat", "adm_bkp_set_int:1")
          .text(h === 3 ? "✅ 3 Saat" : "⏱️ 3 Saat", "adm_bkp_set_int:3")
          .text(h === 6 ? "✅ 6 Saat ⭐" : "⏱️ 6 Saat ⭐", "adm_bkp_set_int:6")
          .row()
          .text(h === 12 ? "✅ 12 Saat" : "⏱️ 12 Saat", "adm_bkp_set_int:12")
          .text(h === 24 ? "✅ 24 Saat" : "⏱️ 24 Saat", "adm_bkp_set_int:24")
          .row()
          .text("🔙 Yedekleme Menüsü", "adm_bkp_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- YÜKLENEN DOSYADAN GERİ YÜKLEME ---
      if (data === "adm_bkp_restore_uploaded") {
        if (!isAdmin) return;
        const pending = pendingRestoreMap.get(from.id);
        if (!pending) {
          try {
            await ctx.answerCallbackQuery({ text: "❌ Bekleyen yedek dosyası bulunamadı!", show_alert: true });
          } catch (e) {}
          return;
        }

        try {
          await ctx.answerCallbackQuery({ text: "🔄 Dosyadan geri yükleme yapılıyor..." });
        } catch (e) {}

        const result = await db.restoreBackup(pending);
        pendingRestoreMap.delete(from.id);

        const text =
          `🎉 <b>YEDEK DOSYASI BAŞARIYLA GERİ YÜKLENDİ!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `✅ ${result.message}\n\n` +
          `👥 <b>Kullanıcı Sayısı:</b> ${result.details?.usersCount || 0}\n` +
          `📦 <b>Sipariş Sayısı:</b> ${result.details?.activationsCount || 0}\n` +
          `💳 <b>Yükleme Sayısı:</b> ${result.details?.depositsCount || 0}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🛡️ <i>Mevcut durumun güvenlik yedeği (PRE_RESTORE) başarıyla kaydedilmiştir.</i>`;

        const kb = new InlineKeyboard()
          .text("📦 Yedekleme Menüsü", "adm_bkp_menu")
          .row()
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- KUPON VE PROMOSYON MENÜSÜ ---
      if (data === "btn_coupon_info") {
        const text =
          `🎁 <b>KUPON & PROMOSYON KULLANIMI</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Elinizde AzFur hediye bakiye veya indirim kuponunuz varsa, bota doğrudan şu komutla iletebilirsiniz:\n\n` +
          `👉 <code>/kupon KODUNUZ</code>\n\n` +
          `<i>Örnek Kullanım:</i>\n` +
          `<code>/kupon HOSGELDIN</code>\n` +
          `<code>/kupon AZFUR20</code>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💡 <i>Kupon tanımlandığında bakiyeniz anında yüklenir veya bir sonraki numara kiralama işleminizde indirim otomatik olarak uygulanır!</i>`;

        const kb = new InlineKeyboard()
          .webApp("🚀 Mini App'te Tanımla", appUrl)
          .row()
          .text("🛒 Numara Satın Al", "btn_buy_menu")
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // Tanımsız callback
      await editOrReply(ctx, `Bilinmeyen komut.`, new InlineKeyboard().text("🔙 Ana Menü", "btn_main_menu"));
    });

    // ==========================================
    // ADMİN YEDEK DOSYASI YÜKLEME DİNLEYİCİSİ (.JSON)
    // ==========================================
    botInstance.on("message:document", async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const isAdmin = db.isAdmin(from.id);
      if (!isAdmin) return;

      const doc = ctx.message?.document;
      if (!doc || !doc.file_name?.toLowerCase().endsWith(".json")) return;

      try {
        const file = await ctx.getFile();
        const fileUrl = `https://api.telegram.org/file/bot${CONFIG.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const res = await fetch(fileUrl);
        const content = await res.text();
        const parsed = JSON.parse(content);

        let dbData = parsed;
        if (
          parsed.data &&
          typeof parsed.data === "object" &&
          (parsed.data.users || parsed.data.settings)
        ) {
          dbData = parsed.data;
        }

        if (!dbData.users) {
          await ctx.reply("❌ Gönderilen .json dosyası geçerli bir AzFur yedek veritabanı formatı değil.");
          return;
        }

        pendingRestoreMap.set(from.id, dbData);

        const usersCount = Object.keys(dbData.users).length;
        const kb = new InlineKeyboard()
          .text("✅ Evet, Bu Yedeği Geri Yükle", "adm_bkp_restore_uploaded")
          .row()
          .text("❌ İptal", "btn_main_menu");

        await ctx.reply(
          `📥 <b>YEDEK DOSYASI ALINDI!</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📄 <b>Dosya Adı:</b> <code>${doc.file_name}</code>\n` +
            `👥 <b>Kullanıcı Sayısı:</b> ${usersCount} kişi\n` +
            `📁 <b>Dosya Boyutu:</b> ${((doc.file_size || 0) / 1024).toFixed(1)} KB\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `⚠️ <b>DİKKAT:</b> Bu dosyayı sisteme geri yüklemek istiyor musunuz?\n\n` +
            `<i>(İşlem öncesinde mevcut veritabanının otomatik güvenlik yedeği alınacaktır)</i>`,
          { parse_mode: "HTML", reply_markup: kb }
        );
      } catch (err: any) {
        await ctx.reply(`❌ Dosya okunamadı: ${err.message || "Geçersiz JSON"}`);
      }
    });
  }

  return botInstance;
}

/**
 * Kullanıcıya SMS kodu geldiğinde Telegram'dan anlık push mesajı gönderir
 */
export async function sendTelegramSmsNotification(
  telegramId: number,
  serviceName: string,
  phoneNumber: string,
  smsCode: string
): Promise<boolean> {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) {
    console.log(`[BOT MOCK NOTIFICATION] To: ${telegramId} | Service: ${serviceName} | Phone: ${phoneNumber} | Code: ${smsCode}`);
    return true;
  }

  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const text =
      `🔔 *SMS KODUNUZ GELDİ!*\n\n` +
      `✅ *Servis:* ${serviceName}\n` +
      `📱 *Numara:* \`${phoneNumber}\`\n` +
      `🔑 *SMS Kodu:* \`${smsCode}\`\n\n` +
      `_💡 Kodu kopyalamak için üzerine dokunmanız yeterlidir._`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: text,
        parse_mode: "Markdown",
      }),
    });

    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error("sendTelegramSmsNotification failed:", err);
    return false;
  }
}

/**
 * Admin Panelinden doğrudan veya toplu duyuru mesajı gönderme fonksiyonu
 */
export async function sendTelegramDirectMessage(
  telegramId: number | string,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
  replyMarkup?: any
): Promise<{ ok: boolean; error?: string }> {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: "Bot token tanımlı değil" };
  }

  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload: any = {
      chat_id: telegramId,
      text: text,
      parse_mode: parseMode,
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.ok) {
      return { ok: true };
    } else {
      return { ok: false, error: data.description || "Gönderilemedi" };
    }
  } catch (err: any) {
    return { ok: false, error: err.message || "Bağlantı hatası" };
  }
}
