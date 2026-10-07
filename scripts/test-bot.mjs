import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
let token = process.env.TELEGRAM_BOT_TOKEN;

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("TELEGRAM_BOT_TOKEN=")) {
      token = trimmed.replace("TELEGRAM_BOT_TOKEN=", "").trim();
    }
  }
}

if (!token) {
  console.error("❌ Hata: TELEGRAM_BOT_TOKEN bulunamadı. Lütfen .env.local dosyasını doldurun.");
  process.exit(1);
}

async function testBot() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok) {
      console.log("✅ Bot Token Geçerli!");
      console.log(`🤖 Bot Adı: ${data.result.first_name}`);
      console.log(`👤 Kullanıcı Adı: @${data.result.username}`);
      console.log(`🆔 Bot ID: ${data.result.id}`);
    } else {
      console.error("❌ Bot Token Geçersiz! Telegram cevabı:", data);
    }
  } catch (err) {
    console.error("❌ Telegram API'ye erişilemedi:", err.message);
  }
}

testBot();
