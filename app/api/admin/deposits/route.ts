import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await db.syncFromCloud();
    const deposits = db.getDeposits();
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
    await db.syncFromCloud();
    const { depositId, status } = await req.json();

    if (!depositId || !status || (status !== "APPROVED" && status !== "REJECTED")) {
      return NextResponse.json({ success: false, error: "Geçersiz parametreler" }, { status: 400 });
    }

    const updated = db.updateDepositStatus(depositId, status);
    if (!updated) {
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
