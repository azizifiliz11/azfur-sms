import { NextRequest, NextResponse } from "next/server";
import { heroSms } from "@/lib/hero-sms";
import { pricingEngine } from "@/lib/pricing";
import { db } from "@/lib/db";
import { ActivationOrder } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceCode, countryId, telegramId } = body;

    if (!serviceCode || countryId === undefined || !telegramId) {
      return NextResponse.json(
        { success: false, error: "Eksik parametreler (serviceCode, countryId, telegramId)" },
        { status: 400 }
      );
    }

    await db.syncFromCloud();
    // 1. Kullanıcıyı ve bakiyesini kontrol et
    const user = await db.getOrCreateUser(telegramId);

    if (user.isBanned) {
      return NextResponse.json(
        { success: false, error: "Hesabınız sistem yöneticisi tarafından askıya alınmıştır (banlı). Numara kiralayamazsınız." },
        { status: 403 }
      );
    }

    // 2. Servis ve Ülke bilgilerini al
    const [countries, services, prices] = await Promise.all([
      heroSms.getCountries(),
      heroSms.getServicesList(),
      heroSms.getPrices(Number(countryId)),
    ]);

    const countryObj = countries.find((c) => c.id === Number(countryId));
    const serviceObj = services.find((s) => s.code === serviceCode);

    const priceStock = prices[String(countryId)]?.[serviceCode];
    const originalCost = priceStock?.cost || 0.15;

    // 3. Kâr marjlı satış fiyatını hesapla
    const { finalPriceTry } = pricingEngine.calculatePrice(originalCost, serviceCode);

    // 4. Kullanıcı bakiyesi yeterli mi?
    if (user.balance < finalPriceTry) {
      return NextResponse.json(
        {
          success: false,
          error: `Yetersiz bakiye! Bu işlem için ${finalPriceTry.toFixed(2)} ₺ gereklidir. Mevcut bakiyeniz: ${user.balance.toFixed(2)} ₺. Lütfen bakiye yükleyin.`,
          requiredAmount: finalPriceTry,
          currentBalance: user.balance,
        },
        { status: 400 }
      );
    }

    // 5. Hero-SMS üzerinden numara al
    const numberResult = await heroSms.getNumber(serviceCode, Number(countryId));

    if (!numberResult.success || !numberResult.id || !numberResult.number) {
      return NextResponse.json(
        {
          success: false,
          error:
            numberResult.error === "NO_BALANCE"
              ? "Sağlayıcı ana havuzunda geçici bakiye yetersizliği! Lütfen yöneticiye bildiriniz veya farklı bir ülke/servis deneyiniz."
              : numberResult.error === "NO_NUMBERS"
              ? "Bu ülke ve servis için şu anda uygun numara stoku tükenmiş. Lütfen başka bir ülke deneyin."
              : `Numara kiralanamadı: ${numberResult.error || "Bilinmeyen hata"}`,
          rawError: numberResult.error,
        },
        { status: 400 }
      );
    }

    // 6. Kullanıcının bakiyesinden ücreti düş
    await db.updateUserBalance(telegramId, -finalPriceTry);

    // 7. Aktivasyon siparişini kaydet
    const now = Date.now();
    const order: ActivationOrder = {
      id: numberResult.id,
      telegramId: Number(telegramId),
      serviceCode,
      serviceName: serviceObj?.name || serviceCode.toUpperCase(),
      countryId: Number(countryId),
      countryName: countryObj?.eng || `Country ${countryId}`,
      countryFlag: countryObj?.flag || "🌐",
      phoneNumber: numberResult.number.startsWith("+") ? numberResult.number : `+${numberResult.number}`,
      originalCost,
      chargedPrice: finalPriceTry,
      status: "WAIT_CODE",
      smsCode: null,
      smsText: null,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000, // 15 dakika
      notifiedBot: false,
    };

    await db.saveActivation(order);

    return NextResponse.json({
      success: true,
      message: "Numara başarıyla kiralandı",
      order,
      remainingBalance: (user.balance - finalPriceTry).toFixed(2),
    });
  } catch (err: any) {
    console.error("Order API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
