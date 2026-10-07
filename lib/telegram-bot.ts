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

      const appUrl = (CONFIG.APP_URL || "").trim();
      const isValidHttps = appUrl.startsWith("https://");

      const keyboard = new InlineKeyboard();
      if (isValidHttps) {
        keyboard.webApp("🚀 SMS Onay Panelini Aç", appUrl).row();
      }
      keyboard
        .text("💳 Bakiye Sorgula", "check_balance")
        .text("🆘 Destek & Bilgi", "help_info");

      const safeName = (from.first_name || "Kullanıcı").replace(/[<>&]/g, "");

      const messageText =
        `👋 <b>Merhaba ${safeName}! AzFur Onay Botuna Hoş Geldiniz.</b>\n\n` +
        `⚡ WhatsApp, Telegram, OpenAI/ChatGPT, Google, Instagram ve yüzlerce servis için anında tek kullanımlık sanal SMS onay numaraları kiralayabilirsiniz.\n\n` +
        `💰 <b>Mevcut Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n` +
        `📱 <b>Telegram ID:</b> <code>${from.id}</code>\n\n` +
        (isValidHttps
          ? `Aşağıdaki butona dokunarak doğrudan <b>Telegram Mini App</b> panelini açabilirsiniz 👇`
          : `⚡ SMS onay işlemlerinizi menüdeki butonları kullanarak yönetebilirsiniz.`);

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

    // Callback queries
    botInstance.callbackQuery("check_balance", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const user = db.getUser(from.id);
      const balance = user ? user.balance.toFixed(2) : "0.00";
      await ctx.answerCallbackQuery();
      await ctx.reply(`💰 <b>Güncel Bakiyeniz:</b> <code>${balance} ₺</code>\n\nBakiye yüklemek için Mini App panelini kullanabilirsiniz.`, {
        parse_mode: "HTML",
      });
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
