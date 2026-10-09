import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { heroSms } from "@/lib/hero-sms";
import { tcmb } from "@/lib/tcmb";
import { CONFIG } from "@/lib/config";
import { isAuthorizedAdmin } from "@/lib/auth-check";

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    const [allCountries, allServices, tcmbRateInfo] = await Promise.all([
      heroSms.getCountries(),
      heroSms.getServicesList(),
      tcmb.getLiveRate(),
    ]);
    const settings = db.getSettings();

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
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
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

    // Özel işlem: Apirone Hesabını Test Et
    if (body.action === "test_apirone_account") {
      const { testApironeConnection } = await import("@/lib/apirone");
      const testAcc = (body.account || db.getSettings().cryptoSettings?.apironeAccount || "").trim();
      const testKey = (body.transferKey || db.getSettings().cryptoSettings?.apironeTransferKey || "").trim();
      const testRes = await testApironeConnection(testAcc, testKey);
      if (testRes.success) {
        return NextResponse.json({
          success: true,
          message: testRes.message || "Apirone bağlantısı başarılı ve hesap aktif!",
          accountInfo: testRes.accountInfo,
        });
      }
      return NextResponse.json({
        success: false,
        error: testRes.error || "Apirone hesabı doğrulanamadı.",
      });
    }

    // Özel işlem: Tek Tıkla Otomatik Apirone Hesabı Oluştur
    if (body.action === "create_apirone_account") {
      const { createApironeAccount } = await import("@/lib/apirone");
      const result = await createApironeAccount();
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: result.message || "Apirone hesabı başarıyla oluşturuldu!",
          account: result.account,
          transferKey: result.transferKey,
          settings: db.getSettings(),
        });
      }
      return NextResponse.json({
        success: false,
        error: result.error || "Apirone hesabı oluşturulamadı.",
      });
    }

    // Özel işlem: Apirone Otomatik Yönlendirme (Kişisel Cüzdana Aktarma) Ayarla
    if (body.action === "set_apirone_forwarding") {
      const { setApironeForwarding, getApironeConfig } = await import("@/lib/apirone");
      const cfg = getApironeConfig();
      const acc = (body.account || cfg.account).trim();
      const key = (body.transferKey || cfg.transferKey).trim();
      const dest = (body.destinationAddress || "").trim();
      const curr = (body.currency || "usdt@trx").trim();

      const res = await setApironeForwarding(acc, key, curr, dest);
      return NextResponse.json(res);
    }

    // Özel işlem: OxaPay API Anahtarı Test Et (Geriye Dönük Uyumluluk)
    if (body.action === "test_oxapay_key") {
      const { testOxapayApiKey } = await import("@/lib/oxapay");
      const testKey = (body.key || db.getSettings().cryptoSettings?.oxapayApiKey || "").trim();
      const testRes = await testOxapayApiKey(testKey);
      if (testRes.success) {
        return NextResponse.json({
          success: true,
          message: testRes.message || "OxaPay Merchant API bağlantısı başarılı!",
        });
      }
      return NextResponse.json({
        success: false,
        error: testRes.error || "OxaPay API Anahtarı doğrulanamadı.",
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
