import { NextRequest, NextResponse } from "next/server";
import { requireTelegramUser } from "@/lib/request-auth";
import { finishOrderAtProvider } from "@/lib/orders";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { activationId } = body;
    const auth = requireTelegramUser(req, body, body.telegramId);
    if (!auth.ok) return auth.response;

    if (!activationId) {
      return NextResponse.json({ success: false, error: "Aktivasyon ID gerekli" }, { status: 400 });
    }

    await db.syncFromCloud();
    const order = db.getActivation(activationId);
    if (!order || Number(order.telegramId) !== auth.id) {
      return NextResponse.json({ success: false, error: "Sipariş bulunamadı" }, { status: 404 });
    }
    if (order.status !== "RECEIVED" && order.status !== "WAIT_CODE") {
      return NextResponse.json({ success: false, error: "Bu sipariş tamamlanamaz." }, { status: 409 });
    }

    // Atomik geçiş: eşzamanlı iade/iptal ile çakışmasın
    const updatedOrder = await db.claimActivationStatus(activationId, ["RECEIVED", "WAIT_CODE"], "COMPLETED");
    if (!updatedOrder) {
      return NextResponse.json({ success: false, error: "Bu sipariş tamamlanamaz." }, { status: 409 });
    }
    // Hero-SMS: aktivasyon için status=6, kiralama için finishActivation
    await finishOrderAtProvider(updatedOrder);

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
