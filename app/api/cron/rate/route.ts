import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tcmb } from "@/lib/tcmb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Otomatik TCMB Kur Güncelleme Cron Servisi
 * Vercel Crons, harici cron servisleri veya sunucu zamanlayıcıları tarafından çağrılabilir.
 */
export async function GET(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const settings = db.getSettings();

    if (settings.useTcmbAutoRate === false) {
      return NextResponse.json({
        success: true,
        message: "Otomatik TCMB kur güncellemesi devre dışı (Manuel Kur Kullanımı Aktif).",
        rate: settings.exchangeRateToTry,
        isTcmbAuto: false,
      });
    }

    // Canlı kuru çek ve DB/Cloud KV'ye kalıcı olarak kaydet
    const live = await tcmb.getLiveRate(true);
    if (live.source === "CACHED") {
      return NextResponse.json({
        success: false,
        message: "Canlı kur servislerine ulaşılamadı; kayıtlı son kur korunuyor.",
        tcmbRateInfo: live,
        rate: live.rate,
        source: live.source,
        timestamp: live.timestamp,
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `TCMB Kuru başarıyla güncellendi: ₺${live.rate.toFixed(4)}`,
      tcmbRateInfo: live,
      rate: live.rate,
      source: live.source,
      timestamp: live.timestamp,
    });
  } catch (err: any) {
    console.error("Cron rate update error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
