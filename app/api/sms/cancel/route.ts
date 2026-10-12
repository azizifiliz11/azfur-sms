import { NextRequest, NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";
import { verifyTelegramInitData } from "@/lib/telegram-auth";
import { cancelOrderWithRefund } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * POST /api/sms/cancel
 * Kod beklenen siparişi iptal eder; ücret siparişin sahibine bir kez iade edilir (lib/orders.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const { activationId, telegramId, initData } = await req.json();

    if (!activationId || !telegramId) {
      return NextResponse.json({ success: false, error: "Eksik parametreler" }, { status: 400 });
    }

    // Mini App Telegram imzalı oturum bilgisini gönderir; varsa kimlik onunla doğrulanır
    let requesterId = Number(telegramId);
    if (initData) {
      const verified = verifyTelegramInitData(String(initData), CONFIG.TELEGRAM_BOT_TOKEN);
      if (!verified || verified.id !== requesterId) {
        return NextResponse.json(
          { success: false, error: "Oturum doğrulanamadı. Lütfen Mini App'i yeniden açın." },
          { status: 401 }
        );
      }
      requesterId = verified.id;
    }

    const result = await cancelOrderWithRefund(String(activationId), requesterId);
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
