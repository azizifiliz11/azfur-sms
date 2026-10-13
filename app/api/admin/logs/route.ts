import { NextRequest, NextResponse } from "next/server";
import { withAdminAudit } from "@/lib/admin-audit";
import { db } from "@/lib/db";
import { isAuthorizedAdmin } from "@/lib/auth-check";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." },
        { status: 403 }
      );
    }

    await db.syncFromCloud();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const level = searchParams.get("level") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 200;

    const logs = db.getLogs({ category, level, search, limit });

    return NextResponse.json(
      {
        success: true,
        logs,
        total: logs.length,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json(
        { success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." },
        { status: 403 }
      );
    }

    await db.syncFromCloud();
    const result = await db.clearLogs();

    await db.addLog({
      category: "ADMIN",
      level: "WARN",
      action: "LOGS_CLEARED",
      details: `${result.count} adet geçmiş sistem log kaydı yönetici tarafından temizlendi.`,
    });

    return NextResponse.json({
      success: true,
      message: "Tüm sistem logları başarıyla temizlendi.",
      clearedCount: result.count,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Başarılı yönetici işlemleri silinemez işlem kaydına (admin_audit) yazılır
export const DELETE = withAdminAudit("logs", handleDELETE);
