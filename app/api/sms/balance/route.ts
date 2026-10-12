import { NextRequest, NextResponse } from "next/server";
import { heroSms } from "@/lib/hero-sms";
import { db } from "@/lib/db";
import { isAuthorizedAdmin } from "@/lib/auth-check";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/sms/balance — sağlayıcı (Hero-SMS) kasa bakiyesi. Yalnızca yönetici.
 * Önceden herkese açıktı ve ?telegramId ile herhangi bir kullanıcının bakiyesini döndürüyordu.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdmin(req))) {
      return NextResponse.json({ success: false, error: "Yetkisiz erişim" }, { status: 403 });
    }

    const provider = await heroSms.getBalance();
    const settings = db.getSettings();

    return NextResponse.json(
      {
        success: true,
        providerBalance: provider.balance,
        providerRaw: provider.raw,
        currency: settings.currencySymbol,
        mockMode: settings.mockMode,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
