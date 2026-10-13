import { NextRequest, NextResponse } from "next/server";
import { requireTelegramUser } from "@/lib/request-auth";
import { heroSms, heroErrorMessage } from "@/lib/hero-sms";
import { pricingEngine } from "@/lib/pricing";
import { db } from "@/lib/db";
import { ActivationOrder } from "@/lib/types";
import { checkApiRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceCode, countryId } = body;
    const auth = requireTelegramUser(req, body, body.telegramId);
    if (!auth.ok) return auth.response;
    const telegramId = auth.id;

    const rateCheck = checkApiRateLimit(req, `order_${telegramId || "anon"}`, 4, 10);
    if (!rateCheck.allowed) {
      return NextResponse.json({ success: false, error: rateCheck.error }, { status: 429 });
    }

    if (!serviceCode || countryId === undefined || !telegramId) {
      return NextResponse.json(
        { success: false, error: "Eksik parametreler (serviceCode, countryId, telegramId)" },
        { status: 400 }
      );
    }

    await db.syncFromCloud();
    // 1. Kullanıcıyı ve bakiyesini kontrol et
    const user = await db.getOrCreateUser(telegramId);

    const settings = db.getSettings();
    if (settings.maintenanceMode && !db.isAdmin(telegramId) && user.role !== "admin") {
      const friendlyMsg = settings.maintenanceMessage?.trim() ||
        "Sistemimiz şu anda planlı bakım çalışmasındadır. Numara almak veya işlemleriniz için lütfen yöneticilerimizle iletişime geçiniz.";
      return NextResponse.json(
        { success: false, error: friendlyMsg },
        { status: 503 }
      );
    }

    if (user.isBanned) {
      return NextResponse.json(
        { success: false, error: "Hesabınız sistem yöneticisi tarafından askıya alınmıştır (banlı). Numara kiralayamazsınız." },
        { status: 403 }
      );
    }

    // Satışa kapatılmış servis/ülke (admin) — katalogda görünmese de doğrudan istekle alınamasın
    if (
      settings.hiddenServices?.includes(serviceCode) ||
      settings.hiddenCountries?.includes(Number(countryId)) ||
      (settings.hiddenServiceCountryPairs || []).includes(`${serviceCode}:${Number(countryId)}`)
    ) {
      return NextResponse.json(
        { success: false, error: "Bu servis bu ülke için şu anda satışta değil. Lütfen başka bir seçenek deneyin." },
        { status: 400 }
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
    if (!priceStock || !(Number(priceStock.cost) > 0)) {
      return NextResponse.json(
        { success: false, error: "Bu servis bu ülkede sağlayıcı tarafından satılmıyor. Lütfen başka bir ülke seçin." },
        { status: 400 }
      );
    }
    const originalCost = Number(priceStock.cost);

    // 3. Kâr marjlı satış fiyatını hesapla
    const baseCalc = pricingEngine.calculatePrice(originalCost, serviceCode, undefined, Number(countryId));
    let finalPriceTry = baseCalc.finalPriceTry;
    let appliedDiscount: { code: string; type: string; value: number; discountAmount: number; originalPrice: number } | null = null;

    // Kullanıcının tanımlı aktif promosyon / indirim kuponu var mı? (atomik sahiplenme: tek kullanım)
    const claimedDiscount = user.activeDiscount ? await db.claimActiveDiscount(telegramId) : null;
    if (claimedDiscount) {
      const discount = claimedDiscount;
      let discountAmount = 0;
      if (discount.type === "DISCOUNT_PERCENT") {
        discountAmount = (finalPriceTry * Number(discount.value)) / 100;
      } else if (discount.type === "DISCOUNT_FIXED") {
        discountAmount = Number(discount.value);
      }

      const discountedPrice = Math.max(1.0, Number((finalPriceTry - discountAmount).toFixed(2)));
      appliedDiscount = {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        originalPrice: finalPriceTry,
        discountAmount: Number((finalPriceTry - discountedPrice).toFixed(2)),
      };
      finalPriceTry = discountedPrice;
    }

    // 4. Kullanıcı bakiyesi yeterli mi? Yeterliyse ücret numara alınmadan ÖNCE atomik olarak düşülür;
    // böylece eşzamanlı iki sipariş tek kişilik bakiyeyle iki numara alamaz.
    const debited = await db.tryDebitBalance(telegramId, finalPriceTry);
    if (!debited) {
      if (claimedDiscount) await db.updateUser(telegramId, { activeDiscount: claimedDiscount });
      const currentBalance = db.getUser(telegramId)?.balance ?? user.balance;
      return NextResponse.json(
        {
          success: false,
          error: `Yetersiz bakiye! Bu işlem için ${finalPriceTry.toFixed(2)} ₺ gereklidir. Mevcut bakiyeniz: ${currentBalance.toFixed(2)} ₺. Lütfen bakiye yükleyin.`,
          requiredAmount: finalPriceTry,
          currentBalance,
        },
        { status: 400 }
      );
    }

    // 5. Hero-SMS üzerinden numara al
    const numberResult = await heroSms.getNumber(serviceCode, Number(countryId));

    if (!numberResult.success || !numberResult.id || !numberResult.number) {
      // Numara alınamadı: düşülen ücreti ve kullanılan indirimi geri ver
      await db.revertDebit(telegramId, finalPriceTry);
      if (claimedDiscount) await db.updateUser(telegramId, { activeDiscount: claimedDiscount });
      return NextResponse.json(
        {
          success: false,
          error: heroErrorMessage(numberResult.error),
          rawError: numberResult.error,
        },
        { status: 400 }
      );
    }

    // 6. Ücret 4. adımda atomik olarak düşüldü; indirim de sahiplenilirken tüketildi

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
      appliedDiscount,
      remainingBalance: debited.balance.toFixed(2),
    });
  } catch (err: any) {
    console.error("Order API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
