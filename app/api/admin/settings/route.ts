import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { heroSms } from "@/lib/hero-sms";
import { tcmb } from "@/lib/tcmb";
import { CONFIG } from "@/lib/config";
import { isAuthorizedAdmin } from "@/lib/auth-check";

export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    const [allCountries, allServices, tcmbRateInfo] = await Promise.all([
      heroSms.getCountries(),
      heroSms.getServicesList(),
      tcmb.getLiveRate(false),
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
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    const body = await req.json();

    // Özel işlem: TCMB canlı kurunu anında yeniden çek
    if (body.action === "refresh_tcmb") {
      const live = await tcmb.getLiveRate(true);
      await db.addLog({
        category: "ADMIN",
        level: "INFO",
        action: "TCMB_MANUAL_REFRESH",
        details: `Yönetici TCMB canlı kurunu manuel güncelledi. Yeni Kur: ₺${live.rate.toFixed(4)} (${live.source})`,
        metadata: { rate: live.rate, source: live.source },
      }).catch(() => {});
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
          await db.addLog({
            category: "ADMIN",
            level: "SUCCESS",
            action: "HERO_SMS_KEY_TESTED",
            details: `Hero-SMS API anahtarı doğrulandı. Sağlayıcı bakiyesi: ${balance} ₽`,
            metadata: { balance },
          }).catch(() => {});
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
        // Test başarılı olunca silinmemesi için hemen DB'ye kaydet
        if (testAcc) {
          const curSettings = db.getSettings();
          await db.updateSettings({
            cryptoSettings: {
              ...(curSettings.cryptoSettings || {}),
              apironeAccount: testAcc,
              ...(testKey ? { apironeTransferKey: testKey } : {}),
            },
          });
        }
        await db.addLog({
          category: "CRYPTO",
          level: "SUCCESS",
          action: "APIRONE_ACCOUNT_TESTED",
          details: `Apirone hesabı (${testAcc}) başarıyla test edildi ve kaydedildi.`,
          metadata: { account: testAcc },
        }).catch(() => {});

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
        await db.addLog({
          category: "CRYPTO",
          level: "SUCCESS",
          action: "APIRONE_ACCOUNT_CREATED",
          details: `Yeni Apirone hesabı oluşturuldu (ID: ${result.account}).`,
          metadata: { account: result.account },
        }).catch(() => {});

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
      if (res.success && acc && key) {
        // Bilgilerin silinmesini önlemek için veritabanına ve buluta hemen kalıcı olarak kaydet
        const curSettings = db.getSettings();
        await db.updateSettings({
          cryptoSettings: {
            ...(curSettings.cryptoSettings || {}),
            apironeAccount: acc,
            apironeTransferKey: key,
            usdtTrc20Address: dest,
          },
        });

        await db.addLog({
          category: "CRYPTO",
          level: "SUCCESS",
          action: "APIRONE_FORWARDING_ENABLED",
          details: `Apirone otomatik yönlendirme (Forwarding) ${dest} adresine bağlandı (Hesap: ${acc}).`,
          metadata: { account: acc, destinationAddress: dest, currency: curr },
        }).catch(() => {});
      }
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

    // İşlem tipine göre detaylı log kaydı oluştur
    if (body.cryptoSettings) {
      await db.addLog({
        category: "CRYPTO",
        level: "INFO",
        action: "CRYPTO_SETTINGS_UPDATED",
        details: `Kripto cüzdan ve Apirone ayarları kaydedildi (Apirone ID: ${body.cryptoSettings.apironeAccount || "Yok"}).`,
        metadata: {
          usdtTrc20Address: body.cryptoSettings.usdtTrc20Address,
          trxAddress: body.cryptoSettings.trxAddress,
          apironeAccount: body.cryptoSettings.apironeAccount,
        },
      }).catch(() => {});
    } else if (body.bankInfo) {
      await db.addLog({
        category: "BANK",
        level: "INFO",
        action: "BANK_INFO_UPDATED",
        details: `Banka havale/EFT bilgileri güncellendi (${body.bankInfo.bankName || "Banka"}).`,
        metadata: body.bankInfo,
      }).catch(() => {});
    } else if (body.globalMarginPercent !== undefined || body.exchangeRateToTry !== undefined) {
      await db.addLog({
        category: "PRICING",
        level: "INFO",
        action: "PRICING_SETTINGS_UPDATED",
        details: `Kâr marjı (%${body.globalMarginPercent ?? updated.globalMarginPercent}), sabit ücret (₺${body.globalFixedFee ?? updated.globalFixedFee}) ve kur ayarları kaydedildi.`,
        metadata: {
          marginPercent: body.globalMarginPercent,
          fixedFee: body.globalFixedFee,
          rateToTry: body.exchangeRateToTry,
          mockMode: body.mockMode,
          useTcmbAutoRate: body.useTcmbAutoRate,
        },
      }).catch(() => {});
    } else {
      await db.addLog({
        category: "ADMIN",
        level: "INFO",
        action: "SYSTEM_SETTINGS_UPDATED",
        details: "Sistem genel ayarları güncellendi.",
      }).catch(() => {});
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
