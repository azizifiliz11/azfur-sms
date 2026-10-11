import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/**
 * Otomatik & Harici Zamanlanmış Sistem Yedekleme Cron Servisi
 * Vercel Crons, harici cron servisleri (cron-job.org vb.) veya sistem pinglemesi tarafından çağrılabilir.
 * ?force=1 parametresi ile zorunlu anında yedek alınabilir.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const isForce = searchParams.get("force") === "1" || searchParams.get("force") === "true";

    await db.syncFromCloud(true);
    const backup = await db.checkAndRunAutoBackup(isForce);
    const settings = db.getSettings();
    const bs = settings.backupSettings;

    return NextResponse.json({
      success: true,
      backupCreated: Boolean(backup),
      backupId: backup?.id || null,
      backupType: backup?.type || null,
      sizeBytes: backup?.sizeBytes || null,
      stats: backup?.stats || null,
      backupSettings: bs,
      message: backup
        ? `Otomatik sistem yedeği başarıyla oluşturuldu (ID: ${backup.id}).`
        : `Yedekleme aralığı henüz dolmadı (Aralık: ${bs?.autoBackupIntervalHours || 6} saat, Son Yedek: ${bs?.lastBackupAt || "Henüz yok"}).`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Cron backup error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
