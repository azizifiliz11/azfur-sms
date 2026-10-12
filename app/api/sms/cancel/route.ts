import { NextRequest, NextResponse } from "next/server";
import { requireTelegramUser } from "@/lib/request-auth";
import { cancelOrderWithRefund } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * POST /api/sms/cancel
 * Kod beklenen siparişi iptal eder; ücret siparişin sahibine bir kez iade edilir (lib/orders.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { activationId } = body;
    const auth = requireTelegramUser(req, body, body.telegramId);
    if (!auth.ok) return auth.response;

    if (!activationId) {
      return NextResponse.json({ success: false, error: "Eksik parametreler" }, { status: 400 });
    }

    const result = await cancelOrderWithRefund(String(activationId), auth.id);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: "Numara iptal edildi ve ücret bakiyenize eksiksiz iade edildi.",
      order: result.order,
      newBalance: result.user?.balance || 0,
    });
  } catch (err: any) {
    console.error("Cancel API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
