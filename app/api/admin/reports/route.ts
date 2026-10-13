import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedAdmin } from "@/lib/auth-check";
import { buildPeriodSummary, getProfitAnalysis, getReconciliation, getUserLedger } from "@/lib/admin-reports";
import { listAdminAudit } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

/**
 * GET /api/admin/reports?type=...
 *  reconciliation — kasa mutabakatı (kullanıcı bakiyeleri / Hero-SMS / Apirone)
 *  profit&days=30 — servis × ülke kâr ve başarı oranı
 *  ledger&telegramId= — kullanıcı bakiye hareketleri
 *  audit&limit=&targetId= — yönetici işlem kaydı
 *  summary&hours=24 — dönem özeti
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz erişim" }, { status: 403 });
    }
    await db.syncFromCloud();
    const p = req.nextUrl.searchParams;
    const type = p.get("type") || "reconciliation";
    const headers = { "Cache-Control": "no-store" };

    if (type === "reconciliation") {
      return NextResponse.json({ success: true, data: await getReconciliation() }, { headers });
    }
    if (type === "profit") {
      const days = Math.min(Math.max(Number(p.get("days")) || 30, 1), 365);
      return NextResponse.json({ success: true, data: await getProfitAnalysis(days) }, { headers });
    }
    if (type === "ledger") {
      const id = Number(p.get("telegramId"));
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ success: false, error: "Geçersiz Telegram ID" }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: await getUserLedger(id) }, { headers });
    }
    if (type === "audit") {
      const targetId = Number(p.get("targetId")) || undefined;
      const limit = Number(p.get("limit")) || 100;
      return NextResponse.json({ success: true, data: await listAdminAudit({ limit, targetId }) }, { headers });
    }
    if (type === "summary") {
      const hours = Math.min(Math.max(Number(p.get("hours")) || 24, 1), 24 * 90);
      return NextResponse.json({ success: true, data: await buildPeriodSummary(hours) }, { headers });
    }
    return NextResponse.json({ success: false, error: "Geçersiz rapor türü" }, { status: 400 });
  } catch (err: any) {
    console.error("Admin reports error:", err);
    return NextResponse.json({ success: false, error: err.message || "Rapor hazırlanamadı" }, { status: 500 });
  }
}
