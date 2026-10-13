import { NextRequest, NextResponse } from "next/server";
import { withAdminAudit } from "@/lib/admin-audit";
import { db } from "@/lib/db";
import { heroSms } from "@/lib/hero-sms";
import { tcmb } from "@/lib/tcmb";
import { CONFIG } from "@/lib/config";
import { isAuthorizedAdmin } from "@/lib/auth-check";
import { maskSettings, unmaskSettingsBody } from "@/lib/secret-mask";

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
    // Gizli anahtarlar panele maskeli gönderilir (yalnızca son 4 karakter)
    const settings = maskSettings(db.getSettings());

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

async function handlePOST(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    const body = await req.json();
    // Panel değiştirmediği gizli alanları maskeli geri gönderir: kayıtlı gerçek değerlerle değiştir
    unmaskSettingsBody(body, db.getSettings());

    // Özel işlem: TCMB canlı kurunu anında yeniden çek
    if (body.action === "refresh_tcmb") {
      const live = await tcmb.getLiveRate(true);
      if (live.source === "CACHED") {
        return NextResponse.json({
          success: false,
          error: "Canlı kur servislerine ulaşılamadı; kayıtlı son kur korunuyor.",
          tcmbRateInfo: live,
          settings: maskSettings(db.getSettings()),
        }, { status: 502 });
      }
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
        settings: maskSettings(db.getSettings()),
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
          settings: maskSettings(db.getSettings()),
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

    if (body.tcmbUpdateIntervalMinutes !== undefined) {
      const interval = Number(body.tcmbUpdateIntervalMinutes);
      if (!Number.isInteger(interval) || interval < 1 || interval > 1440) {
        return NextResponse.json({
          success: false,
          error: "Kur güncelleme aralığı 1 ile 1440 dakika arasında tam sayı olmalıdır.",
        }, { status: 400 });
      }
      body.tcmbUpdateIntervalMinutes = interval;
    }

    // --- Planlı bakım ---
    if (body.action === "schedule_maintenance") {
      const startAt = new Date(body.startAt);
      const endAt = new Date(body.endAt);
      if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) {
        return NextResponse.json({ success: false, error: "Geçerli bir başlangıç ve bitiş zamanı girin (bitiş başlangıçtan sonra olmalı)." }, { status: 400 });
      }
      if (endAt.getTime() < Date.now()) {
        return NextResponse.json({ success: false, error: "Bitiş zamanı geçmişte olamaz." }, { status: 400 });
      }
      const plan = {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        message: String(body.message || "").slice(0, 600),
      };
      await db.updateSettings({ maintenanceSchedule: plan });
      let announced = "";
      if (body.announce) {
        const { announceMaintenance } = await import("@/lib/maintenance-schedule");
        const { runInBackground } = await import("@/lib/background");
        runInBackground(() => announceMaintenance(plan), "maintenance-announce");
        announced = " Kullanıcılara duyuru gönderiliyor.";
      }
      return NextResponse.json({
        success: true,
        message: `Bakım planlandı.${announced}`,
        settings: maskSettings(db.getSettings()),
      });
    }
    if (body.action === "cancel_maintenance_schedule") {
      const plan = db.getSettings().maintenanceSchedule;
      const patch: any = { maintenanceSchedule: null };
      // Plan bakımı açtıysa iptalde sistemi de aç
      if (plan?.enabledBySchedule) patch.maintenanceMode = false;
      await db.updateSettings(patch);
      return NextResponse.json({ success: true, message: "Bakım planı iptal edildi.", settings: maskSettings(db.getSettings()) });
    }

    // --- Servis × ülke kombinasyonunu satışa kapat / aç ---
    if (body.action === "toggle_pair") {
      const pair = String(body.pair || "");
      if (!/^[a-z0-9_]+:\d+$/i.test(pair)) {
        return NextResponse.json({ success: false, error: "Geçersiz kombinasyon" }, { status: 400 });
      }
      const current = new Set(db.getSettings().hiddenServiceCountryPairs || []);
      if (body.hidden) current.add(pair);
      else current.delete(pair);
      await db.updateSettings({ hiddenServiceCountryPairs: [...current] });
      return NextResponse.json({
        success: true,
        message: body.hidden ? "Kombinasyon satışa kapatıldı." : "Kombinasyon yeniden satışa açıldı.",
        hiddenServiceCountryPairs: [...current],
      });
    }

    // --- Uyarı eşikleri ve günlük rapor ---
    if (body.action === "rent_pricing_preview" || body.action === "save_rent_pricing") {
      const rent = await import("@/lib/rent");
      if (body.action === "save_rent_pricing") {
        if (body.reset) {
          await db.updateSettings({ rentPricing: null });
        } else {
          const m = Number(body.marginPercent);
          const f = Number(body.fixedFee ?? 0);
          if (!Number.isFinite(m) || m < 0 || m > 2000 || !Number.isFinite(f) || f < 0 || f > 100000) {
            return NextResponse.json(
              { success: false, error: "Geçersiz değer: marj %0–2000, sabit ücret ₺0–100000 olmalı." },
              { status: 400 }
            );
          }
          await db.updateSettings({
            rentPricing: { marginPercent: m, fixedFee: Number(f.toFixed(2)), updatedAt: new Date().toISOString() },
          });
        }
        await db.addLog({
          category: "PRICING",
          level: "INFO",
          action: "RENT_PRICING_UPDATED",
          details: body.reset
            ? "Full rent kâr marjı kaldırıldı; kiralamada genel marj uygulanacak."
            : `Full rent kâr marjı: %${Number(body.marginPercent)} + ₺${Number(body.fixedFee ?? 0).toFixed(2)}`,
          metadata: { marginPercent: body.marginPercent, fixedFee: body.fixedFee, reset: Boolean(body.reset) },
        }).catch(() => {});
      }
      const [countries, prices] = await Promise.all([heroSms.getCountries(), heroSms.getRentPrices(rent.RENT_SERVICE_CODE)]);
      return NextResponse.json({
        success: true,
        message: body.action === "save_rent_pricing" ? "Full rent kâr marjı kaydedildi." : undefined,
        rentPricing: db.getSettings().rentPricing || null,
        effective: rent.getEffectiveRentMargin(),
        global: { marginPercent: db.getSettings().globalMarginPercent, fixedFee: db.getSettings().globalFixedFee },
        rate: rent.getRentRate(),
        offers: rent.getRentOffers(prices, countries),
      });
    }

    if (body.action === "save_alert_settings") {
      const { DEFAULT_ALERT_SETTINGS } = await import("@/lib/admin-alerts");
      const a = body.alertSettings || {};
      const num = (v: any, def: number, min: number, max: number) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
      };
      const alertSettings = {
        enabled: a.enabled !== false,
        providerBalanceMin: num(a.providerBalanceMin, DEFAULT_ALERT_SETTINGS.providerBalanceMin, 0, 100000),
        refundsPerHour: num(a.refundsPerHour, DEFAULT_ALERT_SETTINGS.refundsPerHour, 0, 1000),
        largeDepositTry: num(a.largeDepositTry, DEFAULT_ALERT_SETTINGS.largeDepositTry, 0, 10000000),
        couponFailsPer10Min: num(a.couponFailsPer10Min, DEFAULT_ALERT_SETTINGS.couponFailsPer10Min, 0, 1000),
        dailyReportEnabled: a.dailyReportEnabled !== false,
        dailyReportHour: Math.round(num(a.dailyReportHour, DEFAULT_ALERT_SETTINGS.dailyReportHour, 0, 23)),
      };
      await db.updateSettings({ alertSettings });
      return NextResponse.json({ success: true, message: "Uyarı ayarları kaydedildi.", alertSettings });
    }

        const updated = await db.updateSettings(body);
    if (body.heroSmsApiKey !== undefined) {
      heroSms.clearCache();
    }

    if (body.maintenanceMode !== undefined) {
      await db.addLog({
        category: "ADMIN",
        level: body.maintenanceMode ? "WARN" : "SUCCESS",
        action: body.maintenanceMode ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED",
        details: `Sistem Bakım Modu ${body.maintenanceMode ? "AÇILDI (Kullanıcılara Kapatıldı)" : "KAPATILDI (Sistem Açıldı)"}.`,
        metadata: { maintenanceMode: body.maintenanceMode, maintenanceMessage: body.maintenanceMessage },
      }).catch(() => {});
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
      settings: maskSettings(updated),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Başarılı yönetici işlemleri silinemez işlem kaydına (admin_audit) yazılır
export const POST = withAdminAudit("settings", handlePOST);
