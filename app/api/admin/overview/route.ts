import { NextResponse } from "next/server";
import { heroSms } from "@/lib/hero-sms";
import { db } from "@/lib/db";
import { isAuthorizedAdmin } from "@/lib/auth-check";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    const [providerBalance, users, activations, settings] = await Promise.all([
      heroSms.getBalance(),
      Promise.resolve(db.getAllUsers()),
      Promise.resolve(db.getAllActivations()),
      Promise.resolve(db.getSettings()),
    ]);

    // Toplam sipariş, ciro ve kâr hesaplamaları
    let totalRevenue = 0;
    let totalOriginalCost = 0;
    let successfulCount = 0;
    let cancelledCount = 0;
    let waitingCount = 0;

    const serviceCounts: Record<string, { name: string; count: number; revenue: number }> = {};

    activations.forEach((order) => {
      if (order.status === "COMPLETED" || order.status === "RECEIVED") {
        successfulCount++;
        totalRevenue += order.chargedPrice;
        totalOriginalCost += order.originalCost * (settings.exchangeRateToTry || 49.2);
      } else if (order.status === "CANCELLED" || order.status === "TIMEOUT") {
        cancelledCount++;
      } else {
        waitingCount++;
      }

      if (!serviceCounts[order.serviceCode]) {
        serviceCounts[order.serviceCode] = {
          name: order.serviceName,
          count: 0,
          revenue: 0,
        };
      }
      serviceCounts[order.serviceCode].count++;
      if (order.status === "COMPLETED" || order.status === "RECEIVED") {
        serviceCounts[order.serviceCode].revenue += order.chargedPrice;
      }
    });

    const totalProfit = Math.max(0, totalRevenue - totalOriginalCost);
    const totalFinished = successfulCount + cancelledCount;
    const successRate = totalFinished > 0 ? Math.round((successfulCount / totalFinished) * 100) : 0;

    // Gerçek en çok kullanılan servisler (sahte mock veri yok)
    const chartServices = Object.values(serviceCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Son 7 Günlük Gerçek Trend
    const now = new Date();
    const days = ["Pzr", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    const revenueTrend = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const dayName = days[d.getDay()];

      let dayRev = 0;
      let dayCost = 0;

      activations.forEach((o) => {
        if (o.createdAt >= dayStart && o.createdAt < dayEnd && (o.status === "COMPLETED" || o.status === "RECEIVED")) {
          dayRev += o.chargedPrice;
          dayCost += o.originalCost * (settings.exchangeRateToTry || 49.2);
        }
      });

      revenueTrend.push({
        date: dayName,
        Ciro: Number(dayRev.toFixed(2)),
        NetKar: Number(Math.max(0, dayRev - dayCost).toFixed(2)),
      });
    }

    return NextResponse.json({
      success: true,
      provider: {
        balance: providerBalance.balance,
        raw: providerBalance.raw,
        currency: "USD / RUB",
      },
      stats: {
        totalUsers: users.length,
        totalActivations: activations.length,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalProfit: Number(totalProfit.toFixed(2)),
        successRate,
        successfulCount,
        cancelledCount,
        waitingCount,
        currencySymbol: settings.currencySymbol,
        mockMode: settings.mockMode,
      },
      chartServices,
      revenueTrend,
    });
  } catch (err: any) {
    console.error("Admin overview error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    const body = await req.json();
    if (body.action === "reset_stats") {
      const res = await db.resetStats();
      return NextResponse.json({
        success: true,
        message: "Tüm sipariş ve ciro istatistikleri başarıyla sıfırlandı.",
        data: res,
      });
    }
    return NextResponse.json({ success: false, error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
