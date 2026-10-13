import { NextRequest, NextResponse } from "next/server";
import { withAdminAudit } from "@/lib/admin-audit";
import { db } from "@/lib/db";
import { isAuthorizedAdmin } from "@/lib/auth-check";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    // deposits tablosunda kullanıcı adı tutulmuyor (SQL'den yeniden okununca boş kalıyordu):
    // her talebi güncel kullanıcı kaydıyla zenginleştir
    const deposits = db.getDeposits().map((d) => {
      const u = db.getUser(d.telegramId);
      const username = (u?.username || d.username || "").replace(/^@/, "");
      return {
        ...d,
        username: username.startsWith("user_") ? "" : username,
        userFullName: [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim(),
      };
    });
    return NextResponse.json(
      { success: true, deposits },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    const body = await req.json();
    const { depositId, status } = body;

    // Bekleyen otomatik kripto ödemesini sağlayıcıdan (Apirone/OxaPay) şimdi kontrol et
    if (body.action === "check_provider") {
      const dep = db.getDeposits().find((d) => d.id === depositId);
      if (!dep) return NextResponse.json({ success: false, error: "Talep bulunamadı" }, { status: 404 });
      body.telegramId = dep.telegramId;
      if (dep.status !== "PENDING") {
        return NextResponse.json({ success: false, error: "Bu talep artık beklemede değil." }, { status: 409 });
      }
      const { confirmCryptoDeposit, isAutoCryptoDeposit } = await import("@/lib/deposit-confirm");
      if (!isAutoCryptoDeposit(dep)) {
        return NextResponse.json({ success: false, error: "Bu talep otomatik kripto ödemesi değil; elle onaylayın." }, { status: 400 });
      }
      const { approved, payInfo } = await confirmCryptoDeposit(dep);
      return NextResponse.json({
        success: true,
        approved: Boolean(approved),
        providerStatus: payInfo?.status || "unknown",
        message: approved
          ? `Ödeme sağlayıcıda doğrulandı, ₺${dep.amount.toFixed(2)} yüklendi.`
          : `Sağlayıcı durumu: ${payInfo?.status || "bilinmiyor"} — henüz ödenmemiş.`,
      });
    }

    if (!depositId || !status || (status !== "APPROVED" && status !== "REJECTED")) {
      return NextResponse.json({ success: false, error: "Geçersiz parametreler" }, { status: 400 });
    }

    const updated = await db.updateDepositStatus(depositId, status);
    if (!updated) {
      const existing = db.getDeposits().find((d) => d.id === depositId);
      if (existing?.status === "APPROVED") {
        return NextResponse.json({ success: false, error: "Bu talep zaten onaylanmış; bakiye daha önce yüklendi." }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: "Talep bulunamadı" }, { status: 404 });
    }

    const updatedUser = db.getUser(updated.telegramId);

    return NextResponse.json(
      {
        success: true,
        message: status === "APPROVED" ? "Bakiye onaylandı ve hesaba eklendi." : "Talep reddedildi.",
        deposit: updated,
        user: updatedUser,
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

// Başarılı yönetici işlemleri silinemez işlem kaydına (admin_audit) yazılır
export const POST = withAdminAudit("deposits", handlePOST);
