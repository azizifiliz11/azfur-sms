import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuthWithRateLimit } from "@/lib/auth-check";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = checkAdminAuthWithRateLimit(req);
    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || "Yetkisiz Erişim! Yönetici PIN kodu gereklidir.",
          remainingAttempts: auth.remainingAttempts,
          retryAfter: auth.retryAfter,
        },
        {
          status: auth.status,
          headers: auth.retryAfter ? { "Retry-After": String(auth.retryAfter) } : undefined,
        }
      );
    }

    await db.syncFromCloud();

    // Otomatik yedekleme zamanı gelmişse arka planda oluştur
    await db.checkAndRunAutoBackup().catch(() => {});

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const backupId = searchParams.get("id");

    // 1. Belirli bir yedeği JSON dosyası olarak indir
    if (action === "download" && backupId) {
      const backup = db.getBackupById(backupId);
      if (!backup || !backup.data) {
        return NextResponse.json({ success: false, error: "Yedek bulunamadı" }, { status: 404 });
      }

      const cleanDate = backup.timestamp.replace(/[:.]/g, "-");
      const filename = `azfur_backup_${backup.id}_${cleanDate}.json`;

      return new NextResponse(JSON.stringify(backup.data, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // 2. Canlı veritabanını anında JSON dosyası olarak indir
    if (action === "download_current") {
      const snapshot = db.getFullDatabaseSnapshot();
      const cleanDate = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `azfur_live_backup_${cleanDate}.json`;

      return new NextResponse(JSON.stringify(snapshot, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // 3. Varsayılan: Yedek listesi ve yapılandırma
    const backups = db.getBackups();
    const settings = db.getSettings();

    return NextResponse.json(
      {
        success: true,
        backups,
        backupSettings: settings.backupSettings,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (err: any) {
    console.error("Backups GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = checkAdminAuthWithRateLimit(req);
    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || "Yetkisiz Erişim! Yönetici PIN kodu gereklidir.",
          remainingAttempts: auth.remainingAttempts,
          retryAfter: auth.retryAfter,
        },
        {
          status: auth.status,
          headers: auth.retryAfter ? { "Retry-After": String(auth.retryAfter) } : undefined,
        }
      );
    }

    await db.syncFromCloud();
    const body = await req.json();
    const { action } = body;

    // 1. Manuel Yedek Oluştur
    if (action === "create") {
      const backup = await db.createBackup("MANUAL", body.label);
      return NextResponse.json({
        success: true,
        message: "Sistem yedeği başarıyla oluşturuldu!",
        backup: {
          id: backup.id,
          timestamp: backup.timestamp,
          type: backup.type,
          label: backup.label,
          sizeBytes: backup.sizeBytes,
          stats: backup.stats,
        },
      });
    }

    // 2. Sistemdeki Mevcut Yedekten Geri Yükle
    if (action === "restore_id") {
      const { backupId } = body;
      if (!backupId) {
        return NextResponse.json({ success: false, error: "Yedek ID belirtilmedi" }, { status: 400 });
      }

      const backup = db.getBackupById(backupId);
      if (!backup || !backup.data) {
        return NextResponse.json({ success: false, error: "Yedek bulunamadı veya hasarlı" }, { status: 404 });
      }

      const res = await db.restoreBackup(backup.data);
      return NextResponse.json({
        success: true,
        message: res.message,
        details: res.details,
      });
    }

    // 3. Kullanıcının Yüklediği JSON Dosyasından Geri Yükle
    if (action === "restore_upload") {
      const { payload } = body;
      if (!payload) {
        return NextResponse.json({ success: false, error: "Geri yüklenecek dosya içeriği eksik" }, { status: 400 });
      }

      const res = await db.restoreBackup(payload);
      return NextResponse.json({
        success: true,
        message: res.message,
        details: res.details,
      });
    }

    // 4. Yedek Sil
    if (action === "delete") {
      const { backupId } = body;
      if (!backupId) {
        return NextResponse.json({ success: false, error: "Yedek ID belirtilmedi" }, { status: 400 });
      }

      const deleted = await db.deleteBackup(backupId);
      return NextResponse.json({
        success: deleted,
        message: deleted ? "Yedek başarıyla silindi." : "Yedek bulunamadı.",
      });
    }

    // 5. Otomatik Yedekleme Ayarlarını Güncelle
    if (action === "update_settings") {
      const { settings } = body;
      if (!settings) {
        return NextResponse.json({ success: false, error: "Ayar verisi eksik" }, { status: 400 });
      }

      const updated = await db.updateBackupSettings(settings);
      return NextResponse.json({
        success: true,
        message: "Otomatik yedekleme ayarları güncellendi.",
        backupSettings: updated,
      });
    }

    return NextResponse.json({ success: false, error: "Bilinmeyen işlem türü" }, { status: 400 });
  } catch (err: any) {
    console.error("Backups POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
