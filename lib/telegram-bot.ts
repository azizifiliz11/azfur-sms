import { Bot, InlineKeyboard } from "grammy";
import { CONFIG } from "./config";
import { db } from "./db";
import { heroSms } from "./hero-sms";
import { pricingEngine } from "./pricing";
import { ActivationOrder, User } from "./types";

let botInstance: Bot | null = null;

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
  { id: 12, name: "ABD", flag: "🇺🇸" },
  { id: 16, name: "İngiltere", flag: "🇬🇧" },
  { id: 43, name: "Almanya", flag: "🇩🇪" },
  { id: 0, name: "Rusya", flag: "🇷🇺" },
  { id: 53, name: "Hollanda", flag: "🇳🇱" },
  { id: 50, name: "Brezilya", flag: "🇧🇷" },
  { id: 6, name: "Endonezya", flag: "🇮🇩" },
  { id: 2, name: "Kazakistan", flag: "🇰🇿" },
];

function getAppUrls() {
  const rawUrl = (CONFIG.APP_URL || "").trim();
  const appUrl = rawUrl.startsWith("https://")
    ? rawUrl.replace(/\/$/, "")
    : "https://azfur-sms.vercel.app";
  return {
    appUrl,
    adminUrl: `${appUrl}/admin`,
    bannerUrl: `${appUrl}/azfur-banner.jpg`,
  };
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

  return (
    `⚡ ━━━━━━━━━━━━━━━━━━━━ ⚡\n` +
    `       💠 <b>AZFUR SMS ONAY</b> 💠\n` +
    `✨ <i>Sanal Numara & Hızlı SMS Servisi</i> ✨\n` +
    `⚡ ━━━━━━━━━━━━━━━━━━━━ ⚡\n\n` +
    `👋 <b>Hoş Geldiniz, ${safeName}!</b>\n\n` +
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
    .text("👤 Profilim & Bakiye", "btn_my_profile")
    .row()
    .text("🔄 Menüyü Yenile", "btn_refresh_menu")
    .text("🆘 Yardım & Destek", "btn_help_info");

  if (isAdmin) {
    kb.row()
      .text("👑 Yönetici Menüsü", "btn_admin_menu")
      .webApp("🛡️ Web Admin Paneli", adminUrl);
  }

  return kb;
}

async function editOrReply(ctx: any, text: string, keyboard: InlineKeyboard) {
  try {
    if (ctx.callbackQuery?.message?.photo) {
      await ctx.editMessageCaption({
        caption: text,
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
    // Mesaj düzenlenemezse veya içerik aynıysa yeni mesaj olarak at
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

export function getTelegramBot(): Bot | null {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) {
    return null;
  }
  if (!botInstance) {
    botInstance = new Bot(CONFIG.TELEGRAM_BOT_TOKEN);

    // ==========================================
    // 1. /start VE /menu KOMUTLARI
    // ==========================================
    const sendWelcome = async (ctx: any) => {
      const from = ctx.from;
      if (!from) return;

      await db.syncFromCloud();
      const user = await db.getOrCreateUser(from.id, {
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
      });

      const { appUrl, adminUrl, bannerUrl } = getAppUrls();
      const isAdmin =
        user.role === "admin" ||
        String(from.id) === String(CONFIG.ADMIN_TELEGRAM_ID) ||
        String(from.id) === "6824921456";

      const activeOrders = db.getActiveOrders(from.id);
      const messageText = buildMainMenuText(user, from.first_name, activeOrders.length);
      const keyboard = buildMainMenuKeyboard(isAdmin, appUrl, adminUrl);


      // Fotoğraflı şık karşılama kartı dene
      if (bannerUrl.startsWith("https://")) {
        try {
          await ctx.replyWithPhoto(bannerUrl, {
            caption: messageText,
            parse_mode: "HTML",
            reply_markup: keyboard,
          });
          return;
        } catch (photoErr) {
          // Banner gönderilemezse metin olarak gönder
        }
      }

      await ctx.reply(messageText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    };

    botInstance.command("start", sendWelcome);
    botInstance.command("menu", sendWelcome);

    // /admin Komutu
    botInstance.command("admin", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const { adminUrl } = getAppUrls();
      const kb = new InlineKeyboard()
        .webApp("🛡️ Yönetici Panelini Aç", adminUrl)
        .row()
        .text("📊 Hızlı İstatistikler", "btn_admin_menu")
        .text("🔙 Ana Menü", "btn_main_menu");

      await ctx.reply(
        `👑 <b>AzFur Yönetici Paneli</b>\n\n` +
          `• Canlı TCMB kuru ve kâr marjı yönetimi\n` +
          `• Kullanıcı bakiyeleri ve yetkilendirme\n` +
          `• Banlama ve güvenlik ayarları\n` +
          `• Toplu duyuru ve push bildirimleri\n\n` +
          `Aşağıdaki butonlara tıklayarak işlem yapabilirsiniz 👇`,
        {
          parse_mode: "HTML",
          reply_markup: kb,
        }
      );
    });

    // /bakiye Komutu
    botInstance.command("bakiye", async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      await sendAnimatedVisual(ctx, "🎰");

      await db.syncFromCloud();
      const user = await db.getOrCreateUser(from.id, {
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
      });
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
      const rawList = settings.supportTelegramUsernames && settings.supportTelegramUsernames.length > 0
        ? settings.supportTelegramUsernames
        : [settings.supportTelegramUsername || "azfursms_admin"];
      const supportUsernames = rawList.map((u) => u.replace(/^@/, "").trim()).filter(Boolean);

      const supportAdminsText = supportUsernames.map((u) => `👑 <b>Yetkili:</b> @${u}`).join("\n");

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
          `• <b>7/24 Bakiye:</b> Banka Havale/EFT ve Kripto ile kesintisiz yükleme yapabilirsiniz.`,
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
      const isAdmin =
        user?.role === "admin" ||
        String(from.id) === String(CONFIG.ADMIN_TELEGRAM_ID) ||
        String(from.id) === "6824921456";

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
      const isAdmin =
        user?.role === "admin" ||
        String(from.id) === String(CONFIG.ADMIN_TELEGRAM_ID) ||
        String(from.id) === "6824921456";
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
      const isAdmin =
        user?.role === "admin" ||
        String(from.id) === String(CONFIG.ADMIN_TELEGRAM_ID) ||
        String(from.id) === "6824921456";
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
      const isAdmin =
        user?.role === "admin" ||
        String(from.id) === String(CONFIG.ADMIN_TELEGRAM_ID) ||
        String(from.id) === "6824921456";
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
      const isAdmin =
        user?.role === "admin" ||
        String(from.id) === String(CONFIG.ADMIN_TELEGRAM_ID) ||
        String(from.id) === "6824921456";
      if (!isAdmin) return;

      const text = (ctx.message.text || "").trim();

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

      try {
        await ctx.answerCallbackQuery().catch(() => {});
      } catch (e) {}

      await db.syncFromCloud();
      const user = await db.getOrCreateUser(from.id, {
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
      });

      const { appUrl, adminUrl } = getAppUrls();
      const isAdmin =
        user.role === "admin" ||
        String(from.id) === String(CONFIG.ADMIN_TELEGRAM_ID) ||
        String(from.id) === "6824921456";

      // --- ANA MENÜYE DÖNÜŞ ---
      if (data === "btn_main_menu" || data === "btn_refresh_menu") {
        const activeOrders = db.getActiveOrders(from.id);
        const text = buildMainMenuText(user, from.first_name, activeOrders.length);
        const kb = buildMainMenuKeyboard(isAdmin, appUrl, adminUrl);
        await editOrReply(ctx, text, kb);
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
            kb.text(`${s1.icon} ${s1.name}`, `svc_sel:${s1.code}`).text(
              `${s2.icon} ${s2.name}`,
              `svc_sel:${s2.code}`
            ).row();
          } else {
            kb.text(`${s1.icon} ${s1.name}`, `svc_sel:${s1.code}`).row();
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
          `🌍 <b>${serviceObj.icon} ${serviceObj.name} İÇİN ÜLKE SEÇİN</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n\n` +
          `Numara almak istediğiniz ülkeyi seçin 👇`;

        const kb = new InlineKeyboard();

        // Popüler ülkelerin fiyatlarını çek
        try {
          const prices = await heroSms.getPrices();
          for (let i = 0; i < POPULAR_COUNTRIES.length; i += 2) {
            const c1 = POPULAR_COUNTRIES[i];
            const c2 = POPULAR_COUNTRIES[i + 1];

            const cost1 = prices[String(c1.id)]?.[serviceCode]?.cost || 0.15;
            const p1 = pricingEngine.calculatePrice(cost1, serviceCode).finalPriceTry;

            if (c2) {
              const cost2 = prices[String(c2.id)]?.[serviceCode]?.cost || 0.15;
              const p2 = pricingEngine.calculatePrice(cost2, serviceCode).finalPriceTry;
              kb.text(`${c1.flag} ${c1.name} • ${p1.toFixed(1)}₺`, `buy_confirm:${serviceCode}:${c1.id}`).text(
                `${c2.flag} ${c2.name} • ${p2.toFixed(1)}₺`,
                `buy_confirm:${serviceCode}:${c2.id}`
              ).row();
            } else {
              kb.text(`${c1.flag} ${c1.name} • ${p1.toFixed(1)}₺`, `buy_confirm:${serviceCode}:${c1.id}`).row();
            }
          }
        } catch (e) {
          // Fallback standart fiyat gösterimi
          for (const c of POPULAR_COUNTRIES.slice(0, 6)) {
            kb.text(`${c.flag} ${c.name} Seç`, `buy_confirm:${serviceCode}:${c.id}`).row();
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

        const prices = await heroSms.getPrices(countryId);
        const originalCost = prices[String(countryId)]?.[serviceCode]?.cost || 0.15;
        const { finalPriceTry } = pricingEngine.calculatePrice(originalCost, serviceCode);

        const hasEnoughBalance = user.balance >= finalPriceTry;

        const text =
          `🛒 <b>SİPARİŞ ONAYI</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📱 <b>Servis:</b> ${serviceObj.icon} ${serviceObj.name}\n` +
          `🌍 <b>Ülke:</b> ${countryObj.flag} ${countryObj.name}\n` +
          `💵 <b>Tutar:</b> <code>${finalPriceTry.toFixed(2)} ₺</code>\n` +
          `💳 <b>Mevcut Bakiyeniz:</b> <code>${user.balance.toFixed(2)} ₺</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          (hasEnoughBalance
            ? `<i>💡 Onayladığınızda numaranız anında verilecek ve SMS bekleme süresi başlayacaktır. SMS gelmezse %100 ücretsiz iptal edebilirsiniz.</i>`
            : `⚠️ <b>Yetersiz Bakiye!</b> Bu işlem için en az <code>${finalPriceTry.toFixed(2)} ₺</code> gereklidir. Lütfen bakiye yükleyin.`);

        const kb = new InlineKeyboard();
        if (hasEnoughBalance) {
          kb.text("✅ Onayla ve Numarayı Al", `buy_exec:${serviceCode}:${countryId}`).row();
        } else {
          kb.text("💳 Bakiye Yükle", "btn_deposit_menu").row();
        }
        kb.text("🔙 Geri Dön", `svc_sel:${serviceCode}`).text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
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
        const originalCost = prices[String(countryId)]?.[serviceCode]?.cost || 0.15;
        const { finalPriceTry } = pricingEngine.calculatePrice(originalCost, serviceCode);

        if (user.balance < finalPriceTry) {
          await editOrReply(
            ctx,
            `⚠️ <b>Yetersiz Bakiye!</b>\nMevcut bakiyeniz: <code>${user.balance.toFixed(2)} ₺</code>\nGereken: <code>${finalPriceTry.toFixed(2)} ₺</code>`,
            new InlineKeyboard().text("💳 Bakiye Yükle", "btn_deposit_menu").row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        // Hero-SMS API'den numara çek
        const numberResult = await heroSms.getNumber(serviceCode, countryId);

        if (!numberResult.success || !numberResult.id || !numberResult.number) {
          const errMsg =
            numberResult.error === "NO_NUMBERS"
              ? "Bu ülke ve servis için anlık stok tükenmiş. Lütfen başka bir ülke deneyiniz."
              : `Numara kiralanamadı: ${numberResult.error || "Hata oluştu"}`;

          await editOrReply(
            ctx,
            `❌ <b>Sipariş Başarısız!</b>\n\n${errMsg}`,
            new InlineKeyboard().text("🔙 Başka Ülke Seç", `svc_sel:${serviceCode}`).row().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        // Bakiye düş
        await db.updateUserBalance(from.id, -finalPriceTry);

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

        await sendAnimatedVisual(ctx, "🎯");

        const text =
          `🎉 <b>NUMARANIZ BAŞARIYLA ALINDI!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📱 <b>Servis:</b> ${serviceObj.icon} ${serviceObj.name}\n` +
          `🌍 <b>Ülke:</b> ${countryObj.flag} ${countryObj.name}\n` +
          `📞 <b>Telefon Numarası:</b>\n<code>${formattedPhone}</code>\n` +
          `<i>(Kopyalamak için numaranın üzerine dokunun)</i>\n\n` +
          `⏳ <b>Durum:</b> SMS Kodu Bekleniyor...\n` +
          `⏱️ <b>Bekleme Süresi:</b> 15 Dakika\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💡 <i>İlgili uygulamaya gidip bu numarayı girin. SMS kodu geldiğinde bot otomatik olarak bildirim gönderecektir. Kod gelmezse iptal edip ücretinizi anında geri alabilirsiniz.</i>`;

        const kb = new InlineKeyboard()
          .text("🔄 Kodu Kontrol Et", `order_chk:${order.id}`)
          .row()
          .text("❌ İptal Et & İade Al", `order_cnc:${order.id}`)
          .text("✅ Tamamla", `order_fin:${order.id}`)
          .row()
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

        const statusResult = await heroSms.getStatus(orderId);

        if (statusResult.status === "RECEIVED" && statusResult.code) {
          await db.updateActivation(orderId, {
            status: "RECEIVED",
            smsCode: statusResult.code,
          });

          await sendAnimatedVisual(ctx, "🎰");

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
        } else if (statusResult.status === "CANCELLED") {
          await db.updateActivation(orderId, { status: "CANCELLED" });
          await editOrReply(
            ctx,
            `⚠️ Bu sipariş sağlayıcı tarafından süre aşımı veya iptal sebebiyle kapatıldı.`,
            new InlineKeyboard().text("🔙 Ana Menü", "btn_main_menu")
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
        const order = db.getActivation(orderId);

        if (!order) {
          await editOrReply(
            ctx,
            `❌ Sipariş bulunamadı.`,
            new InlineKeyboard().text("🔙 Ana Menü", "btn_main_menu")
          );
          return;
        }

        if (order.status === "CANCELLED") {
          await ctx.answerCallbackQuery({ text: "Bu sipariş zaten iptal edilmiş.", show_alert: true });
          return;
        }

        // Hero-SMS status=8
        await heroSms.setStatus(orderId, 8);

        // Ücreti iade et
        const updatedUser = await db.updateUserBalance(from.id, order.chargedPrice);
        await db.updateActivation(orderId, { status: "CANCELLED" });

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
        await heroSms.setStatus(orderId, 6);
        await db.updateActivation(orderId, { status: "COMPLETED" });

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

        const text =
          `📱 <b>SİPARİŞ DETAYI</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📞 <b>Numara:</b> <code>${order.phoneNumber}</code>\n` +
          `🌐 <b>Servis:</b> ${order.countryFlag} ${order.serviceName} (${order.countryName})\n` +
          `💰 <b>Tutar:</b> <code>${order.chargedPrice.toFixed(2)} ₺</code>\n` +
          `🔑 <b>SMS Kodu:</b> ${order.smsCode ? `<code>${order.smsCode}</code>` : "<i>(Henüz gelmedi)</i>"}\n` +
          `⏳ <b>Durum:</b> ${order.status === "WAIT_CODE" ? "Kod Bekleniyor" : order.status}\n` +
          `━━━━━━━━━━━━━━━━━━━━`;

        const kb = new InlineKeyboard()
          .text("🔄 Kodu Kontrol Et", `order_chk:${order.id}`)
          .row()
          .text("❌ İptal Et & İade Al", `order_cnc:${order.id}`)
          .text("✅ Tamamla", `order_fin:${order.id}`)
          .row()
          .text("📜 Numaralarım", "btn_my_orders")
          .text("🔙 Ana Menü", "btn_main_menu");

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
          .text("🏦 Banka Havale / EFT / FAST", "btn_dep_bank")
          .row()
          .text("💎 Kripto (TRX / USDT TRC-20)", "btn_dep_crypto")
          .row()
          .webApp("🚀 Mini App İle Yükle", appUrl)
          .row()
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- BANKA BİLGİLERİ ---
      if (data === "btn_dep_bank") {
        const settings = db.getSettings();
        const bank = settings.bankInfo || {
          bankName: "Ziraat Bankası",
          accountHolder: "AzFur SMS",
          iban: "TR00 0000 0000 0000 0000 00",
          descriptionNote: "Açıklama alanına Telegram ID'nizi yazınız.",
        };

        const text =
          `🏦 <b>BANKA HAVALE / EFT / FAST BİLGİLERİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🏦 <b>Banka:</b> ${bank.bankName}\n` +
          `👤 <b>Alıcı:</b> ${bank.accountHolder}\n\n` +
          `💳 <b>IBAN (Kopyalamak için dokunun):</b>\n` +
          `<code>${bank.iban}</code>\n\n` +
          `📝 <b>AÇIKLAMA KODUNUZ (ÇOK ÖNEMLİ):</b>\n` +
          `<code>${from.id}</code>\n` +
          `<i>(Havale yaparken açıklama kısmına SADECE yukarıdaki Telegram ID'nizi yazınız)</i>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚡ <i>Ödemeniz hesaba geçtiğinde bakiyeniz yöneticimiz tarafından anında onaylanacaktır.</i>`;

        const kb = new InlineKeyboard()
          .text("💳 Diğer Ödeme Yolları", "btn_deposit_menu")
          .row()
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // --- KRİPTO BİLGİLERİ ---
      if (data === "btn_dep_crypto") {
        const settings = db.getSettings();
        const crypto = settings.cryptoSettings || {
          usdtTrc20Address: "TR7NHqJEKQxGTCi8q8ZY4pL8otSzgjLj6t",
          trxAddress: "TR7NHqJEKQxGTCi8q8ZY4pL8otSzgjLj6t",
        };

        const address = crypto.usdtTrc20Address || crypto.trxAddress || "TR7NHqJEKQxGTCi8q8ZY4pL8otSzgjLj6t";

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
        const text =
          `👤 <b>KULLANICI PROFİLİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Telegram ID:</b> <code>${from.id}</code>\n` +
          `👤 <b>Kullanıcı Adı:</b> @${from.username || "Yok"}\n` +
          `✨ <b>İsim:</b> ${(from.first_name || "").replace(/[<>&]/g, "")}\n` +
          `💰 <b>Kullanılabilir Bakiye:</b> <code>${user.balance.toFixed(2)} ₺</code>\n` +
          `💸 <b>Toplam Harcama:</b> <code>${user.spent.toFixed(2)} ₺</code>\n` +
          `📦 <b>Toplam Sipariş:</b> <code>${activations.length} adet</code>\n` +
          `🛡️ <b>Hesap Statüsü:</b> ${user.isBanned ? "🔴 Yasaklı (Banlı)" : user.role === "admin" ? "👑 Yönetici" : "🟢 Standart Üye"}\n` +
          `━━━━━━━━━━━━━━━━━━━━`;

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
        const rawList = settings.supportTelegramUsernames && settings.supportTelegramUsernames.length > 0
          ? settings.supportTelegramUsernames
          : [settings.supportTelegramUsername || "azfursms_admin"];
        const supportUsernames = rawList.map((u) => u.replace(/^@/, "").trim()).filter(Boolean);

        const supportAdminsText = supportUsernames.map((u) => `👑 <b>Canlı Destek:</b> @${u}`).join("\n");

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
          await editOrReply(ctx, `⛔ Bu alana sadece sistem yöneticileri erişebilir.`, new InlineKeyboard().text("🔙 Ana Menü", "btn_main_menu"));
          return;
        }

        const allUsers = db.getAllUsers();
        const allActivations = db.getAllActivations();
        const settings = db.getSettings();
        const providerBalance = await heroSms.getBalance();

        const totalUserBalance = allUsers.reduce((sum, u) => sum + (u.balance || 0), 0);
        const totalUserSpent = allUsers.reduce((sum, u) => sum + (u.spent || 0), 0);

        const text =
          `👑 <b>YÖNETİCİ KONTROL PANELİ</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
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
          .text("🔄 Bilgileri Yenile", "btn_admin_menu")
          .text("🔙 Ana Menü", "btn_main_menu");

        await editOrReply(ctx, text, kb);
        return;
      }

      // Tanımsız callback
      await editOrReply(ctx, `Bilinmeyen komut.`, new InlineKeyboard().text("🔙 Ana Menü", "btn_main_menu"));
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

