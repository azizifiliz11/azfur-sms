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

      const appUrl = CONFIG.APP_URL;

      const keyboard = new InlineKeyboard()
        .webApp("🚀 SMS Onay Panelini Aç", appUrl)
        .row()
        .text("💳 Bakiye Sorgula", "check_balance")
        .text("🆘 Destek & Bilgi", "help_info");

      await ctx.reply(
        `👋 *Merhaba ${from.first_name}! AzFur Onay Botuna Hoş Geldiniz.*\n\n` +
          `⚡ WhatsApp, Telegram, OpenAI/ChatGPT, Google, Instagram ve yüzlerce servis için anında tek kullanımlık sanal SMS onay numaraları kiralayabilirsiniz.\n\n` +
          `💰 *Mevcut Bakiyeniz:* \`${user.balance.toFixed(2)} ₺\`\n` +
          `📱 *Telegram ID:* \`${from.id}\`\n\n` +
          `Aşağıdaki butona dokunarak doğrudan *Telegram Mini App* panelini açabilirsiniz 👇`,
        {
          parse_mode: "Markdown",
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
      await ctx.reply(`💰 *Güncel Bakiyeniz:* \`${balance} ₺\`\n\nBakiye yüklemek için Mini App panelini açıp "➕ Bakiye Yükle" bölümünü kullanabilirsiniz.`, {
        parse_mode: "Markdown",
      });
    });

    botInstance.callbackQuery("help_info", async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.reply(
        `ℹ️ *AzFur Destek ve Bilgilendirme*\n\n` +
          `• Numaralarımız tek kullanımlıktır ve 15 dakika geçerlidir.\n` +
          `• SMS gelmezse "İptal Et & İade Al" butonuna basarak bakiyenizi anında kuruşu kuruşuna geri alabilirsiniz.\n` +
          `• SMS kodu düştüğünde hem Mini App ekranında hem de bu sohbette anlık bildirim alırsınız.\n\n` +
          `Teknik destek için yöneticimizle iletişime geçebilirsiniz.`,
        {
          parse_mode: "Markdown",
        }
      );
    });

    // /bakiye komutu
    botInstance.command("bakiye", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const user = db.getUser(from.id);
      const balance = user ? user.balance.toFixed(2) : "0.00";
      await ctx.reply(`💰 *Mevcut Bakiyeniz:* \`${balance} ₺\``, { parse_mode: "Markdown" });
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
