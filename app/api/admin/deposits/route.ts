import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    await db.syncFromCloud();
    const { depositId, status } = await req.json();

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
