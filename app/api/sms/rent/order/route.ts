import { NextRequest, NextResponse } from "next/server";
import { requireTelegramUser } from "@/lib/request-auth";
import { heroSms, heroErrorMessage } from "@/lib/hero-sms";
import { db } from "@/lib/db";
import { ActivationOrder } from "@/lib/types";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { getRentOffers, RENT_SERVICE_CODE, RENT_SERVICE_NAME, rentDurationLabel } from "@/lib/rent";

export const dynamic = "force-dynamic";

/**
 * POST /api/sms/rent/order { countryId, hours }
 * Süreli numara kiralar (Full rent). Ücret numara alınmadan önce atomik olarak düşülür; sağlayıcı numara
 * veremezse geri verilir. Kiralama süresince gelen tüm SMS'ler siparişe düşer (lib/orders.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const countryId = Number(body.countryId);
    const hours = Number(body.hours);
    const auth = requireTelegramUser(req, body, body.telegramId);
    if (!auth.ok) return auth.response;
    const telegramId = auth.id;

    const rateCheck = checkApiRateLimit(req, `rent_order_${telegramId}`, 3, 10);
    if (!rateCheck.allowed) {
      return NextResponse.json({ success: false, error: rateCheck.error }, { status: 429 });
    }
    if (!Number.isFinite(countryId) || !Number.isFinite(hours) || hours <= 0) {
      return NextResponse.json({ success: false, error: "Eksik parametreler (countryId, hours)" }, { status: 400 });
    }

    await db.syncFromCloud();
    const user = await db.getOrCreateUser(telegramId);
    const settings = db.getSettings();
    if (settings.maintenanceMode && !db.isAdmin(telegramId) && user.role !== "admin") {
      const friendlyMsg =
        settings.maintenanceMessage?.trim() ||
        "Sistemimiz şu anda planlı bakım çalışmasındadır. Numara almak veya işlemleriniz için lütfen yöneticilerimizle iletişime geçiniz.";
      return NextResponse.json({ success: false, error: friendlyMsg }, { status: 503 });
    }
    if (user.isBanned) {
      return NextResponse.json(
        { success: false, error: "Hesabınız sistem yöneticisi tarafından askıya alınmıştır (banlı). Numara kiralayamazsınız." },
        { status: 403 }
      );
    }

    // Güncel teklif: gizleme ayarları, stok ve fiyat sunucuda yeniden hesaplanır (istemcinin fiyatına güvenilmez)
    const [countries, prices] = await Promise.all([heroSms.getCountries(), heroSms.getRentPrices(RENT_SERVICE_CODE)]);
    const offer = getRentOffers(prices, countries).find((o) => o.countryId === countryId);
    const duration = offer?.durations.find((d) => d.hours === hours);
    if (!offer || !duration) {
      return NextResponse.json(
        { success: false, error: "Bu ülke ve süre için şu anda kiralık numara yok. Lütfen listeyi yenileyip başka bir seçenek deneyin." },
        { status: 400 }
      );
    }
    const price = duration.priceTry;

    const debited = await db.tryDebitBalance(telegramId, price);
    if (!debited) {
      const currentBalance = db.getUser(telegramId)?.balance ?? user.balance;
      return NextResponse.json(
        {
          success: false,
          error: `Yetersiz bakiye! Bu kiralama için ${price.toFixed(2)} ₺ gereklidir. Mevcut bakiyeniz: ${currentBalance.toFixed(2)} ₺. Lütfen bakiye yükleyin.`,
          requiredAmount: price,
          currentBalance,
        },
        { status: 400 }
      );
    }

    const rent = await heroSms.getRentNumber(RENT_SERVICE_CODE, countryId, hours);
    if (!rent.success || !rent.id || !rent.number) {
      await db.revertDebit(telegramId, price);
      return NextResponse.json(
        { success: false, error: heroErrorMessage(rent.error), rawError: rent.error },
        { status: 400 }
      );
    }

    const now = Date.now();
    const order: ActivationOrder = {
      id: rent.id,
      telegramId: Number(telegramId),
      serviceCode: RENT_SERVICE_CODE,
      serviceName: RENT_SERVICE_NAME,
      countryId,
      countryName: offer.countryEng || offer.countryName,
      countryFlag: offer.flag,
      phoneNumber: rent.number.startsWith("+") ? rent.number : `+${rent.number}`,
      originalCost: rent.cost || duration.costUsd,
      chargedPrice: price,
      status: "WAIT_CODE",
      smsCode: null,
      smsText: null,
      createdAt: now,
      expiresAt: rent.endsAt && rent.endsAt > now ? rent.endsAt : now + hours * 3600 * 1000,
      notifiedBot: false,
      kind: "rent",
      rentHours: hours,
    };
    await db.saveActivation(order);

    db.addLog({
      category: "ORDER",
      level: "INFO",
      action: "RENT_ORDER_CREATED",
      details: `${offer.flag} ${offer.countryName} numarası ${rentDurationLabel(hours)} kiralandı (${order.phoneNumber}), ${price.toFixed(2)} ₺.`,
      telegramId: Number(telegramId),
      metadata: { orderId: order.id, hours, costUsd: order.originalCost, quotedCostUsd: duration.costUsd },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Numara başarıyla kiralandı",
      order,
      remainingBalance: debited.balance.toFixed(2),
    });
  } catch (err: any) {
    console.error("Rent order API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
