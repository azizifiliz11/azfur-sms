import { NextResponse } from "next/server";
import { heroSms } from "@/lib/hero-sms";
import { db } from "@/lib/db";
import { getRentOffers } from "@/lib/rent";

export const dynamic = "force-dynamic";

/**
 * GET /api/sms/rent/options
 * Süreli numara kiralama (Full rent) yapılabilen ülkeler, süreler, stoklar ve kâr marjlı TL fiyatlar.
 */
export async function GET() {
  try {
    await db.syncFromCloud();
    const [countries, prices] = await Promise.all([heroSms.getCountries(), heroSms.getRentPrices("full")]);
    const offers = getRentOffers(prices, countries);
    const totalStock = offers.reduce((sum, o) => sum + o.durations.reduce((s, d) => s + d.stock, 0), 0);
    return NextResponse.json({ success: true, offers, totalStock });
  } catch (err: any) {
    console.error("Rent options error:", err);
    return NextResponse.json({ success: false, error: err.message, offers: [] }, { status: 500 });
  }
}
