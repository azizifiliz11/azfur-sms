import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tcmb } from "@/lib/tcmb";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/**
 * Otomatik TCMB Kur Güncelleme Cron Servisi
 * Vercel Crons, harici cron servisleri veya sunucu zamanlayıcıları tarafından çağrılabilir.
 */
export async function GET(req: NextRequest) {
  try {
    const force = ["1", "true"].includes(req.nextUrl.searchParams.get("force") || "");
    await db.syncFromCloud(true);
    
    // Zamanı gelmişse otomatik veritabanı yedeğini de al
    await db.checkAndRunAutoBackup().catch((e) => console.error("Cron rate auto backup error:", e));

    const settings = db.getSettings();

    if (settings.useTcmbAutoRate === false) {
      return NextResponse.json({
        success: true,
        message: "Otomatik TCMB kur güncellemesi devre dışı (Manuel Kur Kullanımı Aktif).",
        rate: settings.exchangeRateToTry,
        isTcmbAuto: false,
      });
    }

    // Admin panelindeki güncelleme aralığı dolduysa canlı kuru çek ve kalıcı olarak kaydet
    // (?force=1 aralığı yok sayar)
    const live = await tcmb.getLiveRate(force);
    if (live.skipped) {
      return NextResponse.json({
        success: true,
        message: `Kur güncel; ayarlanan aralık (${settings.tcmbUpdateIntervalMinutes || 30} dk) henüz dolmadı.`,
        rate: live.rate,
        source: live.source,
        timestamp: live.timestamp,
        skipped: true,
      });
    }
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
