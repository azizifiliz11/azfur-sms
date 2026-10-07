import { NextRequest, NextResponse } from "next/server";
import { heroSms } from "@/lib/hero-sms";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");

    const provider = await heroSms.getBalance();
    const settings = db.getSettings();

    let userBalance = 0;
    let user = null;
    if (telegramId) {
      user = db.getUser(telegramId);
      userBalance = user ? user.balance : 0;
    }

    return NextResponse.json(
      {
        success: true,
        providerBalance: provider.balance,
        providerRaw: provider.raw,
        userBalance,
        currency: settings.currencySymbol,
        mockMode: settings.mockMode,
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
