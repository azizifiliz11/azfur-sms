import { NextRequest, NextResponse } from "next/server";
import { heroSms } from "@/lib/hero-sms";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { activationId, telegramId } = await req.json();

    if (!activationId || !telegramId) {
      return NextResponse.json({ success: false, error: "Eksik parametreler" }, { status: 400 });
    }

    const order = db.getActivation(activationId);
    if (!order) {
      return NextResponse.json({ success: false, error: "Sipariş bulunamadı" }, { status: 404 });
    }

    if (order.status === "CANCELLED" || order.status === "COMPLETED") {
      return NextResponse.json({ success: false, error: `Bu sipariş zaten ${order.status}` }, { status: 400 });
    }

    // Hero-SMS status=8 (iptal ve iade) çağır
    await heroSms.setStatus(activationId, 8);

    // Kullanıcıya ücreti geri iade et
    const updatedUser = db.updateUserBalance(telegramId, order.chargedPrice);

    // Durumu güncelle
    const updatedOrder = db.updateActivation(activationId, {
      status: "CANCELLED",
    });

    return NextResponse.json({
      success: true,
      message: "Numara iptal edildi ve ücret bakiyenize eksiksiz iade edildi.",
      order: updatedOrder,
      newBalance: updatedUser?.balance || 0,
    });
  } catch (err: any) {
    console.error("Cancel API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
