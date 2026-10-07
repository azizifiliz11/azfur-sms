import fs from "fs";
import path from "path";

// .env.local dosyasından değişkenleri oku
const envPath = path.resolve(process.cwd(), ".env.local");
let token = process.env.TELEGRAM_BOT_TOKEN;
let appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("TELEGRAM_BOT_TOKEN=")) {
      token = trimmed.replace("TELEGRAM_BOT_TOKEN=", "").trim();
    }
    if (trimmed.startsWith("NEXT_PUBLIC_APP_URL=")) {
      appUrl = trimmed.replace("NEXT_PUBLIC_APP_URL=", "").trim();
    }
  }
}

// Komut satırı argümanı varsa appUrl'i ez
if (process.argv[2]) {
  appUrl = process.argv[2].trim();
}

if (!token) {
  console.error("❌ Hata: TELEGRAM_BOT_TOKEN bulunamadı. Lütfen .env.local dosyasını kontrol edin.");
  process.exit(1);
}

if (!appUrl || appUrl.startsWith("http://localhost")) {
  console.error("❌ Hata: Canlı Webhook için geçerli bir HTTPS adresi gereklidir.");
  console.error("👉 Örnek kullanım: node scripts/set-webhook.mjs https://domaininiz.com");
  process.exit(1);
}

const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/bot/webhook`;

console.log(`🌐 Webhook ayarlanıyor...`);
console.log(`📌 Hedef URL: ${webhookUrl}`);

async function setWebhook() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const data = await res.json();
    if (data.ok) {
      console.log("✅ Webhook başarıyla Telegram'a kaydedildi!");
      console.log(data);
    } else {
      console.error("❌ Telegram API hatası:", data);
    }

    // Webhook bilgisini doğrula
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const infoData = await infoRes.json();
    console.log("\n📋 Güncel Webhook Durumu:");
    console.log(infoData.result);
  } catch (err) {
    console.error("❌ Bağlantı hatası:", err);
  }
}

setWebhook();
