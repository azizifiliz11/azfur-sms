import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const deposits = db.getDeposits();
    return NextResponse.json({ success: true, deposits });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { depositId, status } = await req.json();

    if (!depositId || !status || (status !== "APPROVED" && status !== "REJECTED")) {
      return NextResponse.json({ success: false, error: "Geçersiz parametreler" }, { status: 400 });
    }

    const updated = db.updateDepositStatus(depositId, status);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Talep bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: status === "APPROVED" ? "Bakiye onaylandı ve hesaba eklendi." : "Talep reddedildi.",
      deposit: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
