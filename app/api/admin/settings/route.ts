import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { heroSms } from "@/lib/hero-sms";
import { tcmb } from "@/lib/tcmb";
import { CONFIG } from "@/lib/config";

export async function GET() {
  try {
    await db.syncFromCloud();
    const settings = db.getSettings();
    const [allCountries, allServices, tcmbRateInfo] = await Promise.all([
      heroSms.getCountries(),
      heroSms.getServicesList(),
      tcmb.getLiveRate(),
    ]);

    return NextResponse.json({
      success: true,
      settings,
      tcmbRateInfo,
      allCountries,
      allServices,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const body = await req.json();

    // Özel işlem: TCMB canlı kurunu anında yeniden çek
    if (body.action === "refresh_tcmb") {
      const live = await tcmb.getLiveRate(true);
      return NextResponse.json({
        success: true,
        message: `TCMB Kuru başarıyla güncellendi: ₺${live.rate.toFixed(4)}`,
        tcmbRateInfo: live,
        settings: db.getSettings(),
      });
    }

    // Özel işlem: Hero-SMS API Anahtarını Test Et
    if (body.action === "test_hero_key") {
      const testKey = (body.heroSmsApiKey || db.getSettings().heroSmsApiKey || CONFIG.HERO_SMS_API_KEY || "").trim();
      if (!testKey) {
        return NextResponse.json({
          success: false,
          error: "Test edilecek bir Hero-SMS API anahtarı bulunamadı.",
        });
      }
      const url = `${CONFIG.HERO_SMS_BASE_URL}?action=getBalance&api_key=${testKey}`;
      try {
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();
        if (text.startsWith("ACCESS_BALANCE:")) {
          const balance = parseFloat(text.replace("ACCESS_BALANCE:", "").trim());
          return NextResponse.json({
            success: true,
            balance: isNaN(balance) ? 0 : balance,
            message: `Bağlantı Başarılı! Sağlayıcı Bakiyesi: ${balance} ₽`,
          });
        }
        if (text === "BAD_KEY") {
          return NextResponse.json({
            success: false,
            error: "Geçersiz API Anahtarı (BAD_KEY). Lütfen anahtarınızı kontrol edin.",
          });
        }
        return NextResponse.json({
          success: false,
          error: `Sağlayıcı Yanıtı: ${text}`,
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          error: `Bağlantı hatası: ${err.message}`,
        });
      }
    }

    // Özel işlem: @CryptoBot API Token Test Et
    if (body.action === "test_cryptobot_token") {
      const { testCryptoBotToken } = await import("@/lib/cryptobot");
      const testToken = (body.token || db.getSettings().cryptoSettings?.cryptoBotToken || "").trim();
      const testRes = await testCryptoBotToken(testToken);
      if (testRes.success && testRes.app) {
        const netLabel = testRes.isTestnet ? "Testnet (@CryptoTestnetBot)" : "Mainnet (@CryptoBot)";
        let balStr = "";
        if (testRes.balances && testRes.balances.length > 0) {
          balStr = " • Bakiye: " + testRes.balances.map((b) => `${b.available} ${b.currency_code}`).join(", ");
        }

        return NextResponse.json({
          success: true,
          message: `Bağlantı Başarılı! [${netLabel}] Uygulama: ${testRes.app.name} (@${testRes.app.payment_processing_bot_username})${balStr}`,
          app: testRes.app,
          isTestnet: testRes.isTestnet,
          balances: testRes.balances,
        });
      }
      return NextResponse.json({
        success: false,
        error: testRes.error || "CryptoBot API Token doğrulanamadı.",
      });
    }

    const updated = await db.updateSettings(body);
    if (body.heroSmsApiKey !== undefined) {
      heroSms.clearCache();
    }

    return NextResponse.json({
      success: true,
      message: "Kâr marjı ve sistem ayarları başarıyla güncellendi",
      settings: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
