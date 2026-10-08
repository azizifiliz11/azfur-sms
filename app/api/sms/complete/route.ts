import { NextRequest, NextResponse } from "next/server";
import { heroSms } from "@/lib/hero-sms";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { activationId } = await req.json();

    if (!activationId) {
      return NextResponse.json({ success: false, error: "Aktivasyon ID gerekli" }, { status: 400 });
    }

    await db.syncFromCloud();
    const order = db.getActivation(activationId);
    if (!order) {
      return NextResponse.json({ success: false, error: "Sipariş bulunamadı" }, { status: 404 });
    }

    // Hero-SMS status=6 (tamamla)
    await heroSms.setStatus(activationId, 6);

    const updatedOrder = await db.updateActivation(activationId, {
      status: "COMPLETED",
    });

    return NextResponse.json({
      success: true,
      message: "Aktivasyon başarıyla tamamlandı",
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error("Complete API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
