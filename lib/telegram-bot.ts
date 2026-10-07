import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { CONFIG } from "./config";
import { db } from "./db";

let botInstance: Bot | null = null;

export function getTelegramBot(): Bot | null {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) {
    return null;
  }
  if (!botInstance) {
    botInstance = new Bot(CONFIG.TELEGRAM_BOT_TOKEN);

    // /start Komutu
    botInstance.command("start", async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const user = db.getOrCreateUser(from.id, {
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
      });

      const rawUrl = (CONFIG.APP_URL || "").trim();
      const appUrl = rawUrl.startsWith("https://") ? rawUrl.replace(/\/$/, "") : "https://azfur-sms.vercel.app";
      const adminUrl = `${appUrl}/admin`;

      const isAdmin = user.role === "admin" || String(from.id) === String(CONFIG.ADMIN_TELEGRAM_ID) || String(from.id) === "6824921456";

      const keyboard = new InlineKeyboard()
        .webApp("🚀 SMS Onay Panelini Aç", appUrl)
        .row()
        .text("💳 Bakiye Sorgula", "check_balance")
        .text("🆘 Destek & Bilgi", "help_info");

      if (isAdmin) {
        keyboard.row().webApp("🛡️ Yönetici Paneli", adminUrl);
      }

      const safeName = (from.first_name || "Kullanıcı").replace(/[<>&]/g, "");

      const messageText =
        `👋 <b>Merhaba ${safeName}! AzFur Onay Botuna Hoş Geldiniz.</b>\n\n` +
        `⚡ WhatsApp, Telegram, OpenAI/ChatGPT, Google, Instagram ve yüzlerce servis için anında tek kullanımlık sanal SMS onay numaraları kiralayabilirsiniz.\n\n` +
        `💰 <b>Mevcut Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n` +
        `📱 <b>Telegram ID:</b> <code>${from.id}</code>\n\n` +
        `Aşağıdaki butonlara dokunarak doğrudan <b>Telegram Mini App</b> panelini veya yönetici ekranını açabilirsiniz 👇`;

      try {
        await ctx.reply(messageText, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      } catch (err: any) {
        console.error("Failed to send HTML start message, retrying plain text:", err);
        try {
          await ctx.reply(
            `Merhaba ${safeName}! AzFur Botuna hoş geldiniz.\nBakiyeniz: ${user.balance.toFixed(2)} ₺\nID: ${from.id}`,
            { reply_markup: keyboard }
          );
        } catch (e) {
          console.error("Plain start message also failed:", e);
        }
      }
    });

    // /admin Komutu - Doğrudan Yönetici Panelini Açar
    botInstance.command("admin", async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const rawUrl = (CONFIG.APP_URL || "").trim();
      const appUrl = rawUrl.startsWith("https://") ? rawUrl.replace(/\/$/, "") : "https://azfur-sms.vercel.app";
      const adminUrl = `${appUrl}/admin`;

      const keyboard = new InlineKeyboard().webApp("🛡️ Yönetici Panelini Aç", adminUrl);

      await ctx.reply(
        `👑 <b>AzFur Yönetici Paneli</b>\n\n` +
          `• Kullanıcıları banlama / engel kaldırma\n` +
          `• Admin yetkisi verme / alma\n` +
          `• Elle bakiye ekleme / düşme\n` +
          `• Canlı TCMB kur ve kâr marjı kontrolü\n\n` +
          `Aşağıdaki butona dokunarak paneli açabilirsiniz 👇`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    });

    // Callback queries
    botInstance.callbackQuery("check_balance", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const user = db.getUser(from.id);
      const balance = user ? user.balance.toFixed(2) : "0.00";
      await ctx.answerCallbackQuery();
      await ctx.reply(`💰 <b>Güncel Bakiyeniz:</b> <code>${balance} ₺</code>\n\nBakiye yüklemek ve numara kiralamak için Mini App panelini kullanabilirsiniz.`, {
        parse_mode: "HTML",
      });
    });

    botInstance.callbackQuery("help_info", async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `🆘 <b>AzFur SMS Destek & Bilgilendirme</b>\n\n` +
          `• <b>Hızlı Doğrulama:</b> SMS onay kodları ortalama 5-30 saniye içinde bot ekranınıza ve panelinize iletilir.\n` +
          `• <b>Ücretsiz İptal & İade:</b> SMS kodu gelmeyen tüm kiralamaları süre bitmeden iptal edebilir, bakiyenizi anında iade alabilirsiniz.\n` +
          `• <b>Bakiye Yükleme:</b> CryptoBot veya Havale / EFT ile Mini App içerisinden güvenle yükleme yapabilirsiniz.\n\n` +
          `⚡ Kesintisiz onay için Mini App butonunu kullanabilirsiniz.`,
        { parse_mode: "HTML" }
      );
    });

    // /bakiye komutu
    botInstance.command("bakiye", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const user = db.getUser(from.id);
      const balance = user ? user.balance.toFixed(2) : "0.00";
      await ctx.reply(`💰 <b>Mevcut Bakiyeniz:</b> <code>${balance} ₺</code>`, { parse_mode: "HTML" });
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
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<{ ok: boolean; error?: string }> {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: "Bot token tanımlı değil" };
  }

  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: text,
        parse_mode: parseMode,
      }),
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

