import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkApiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Telegram ID gereklidir." }, { status: 400 });
    }

    await db.syncFromCloud();
    const user = db.getUser(telegramId);

    return NextResponse.json({
      success: true,
      activeDiscount: user?.activeDiscount || null,
      balance: user?.balance || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, telegramId } = body;

    const rateCheck = checkApiRateLimit(req, `coupon_${telegramId || "anon"}`, 5, 10);
    if (!rateCheck.allowed) {
      return NextResponse.json({ success: false, error: rateCheck.error }, { status: 429 });
    }

    await db.syncFromCloud();

    if (!code || !telegramId) {
      return NextResponse.json(
        { success: false, error: "Kupon kodu ve Telegram ID gereklidir." },
        { status: 400 }
      );
    }

    const result = await db.redeemCoupon(code, Number(telegramId));

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    const updatedUser = db.getUser(telegramId);

    return NextResponse.json({
      success: true,
      message: result.message,
      coupon: result.coupon,
      addedBalance: result.addedBalance,
      newBalance: updatedUser?.balance || 0,
      activeDiscount: updatedUser?.activeDiscount || null,
    });
  } catch (err: any) {
    console.error("User coupon error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
