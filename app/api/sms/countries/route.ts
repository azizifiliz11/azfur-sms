import { NextRequest, NextResponse } from "next/server";
import { pricingEngine } from "@/lib/pricing";

/**
 * GET /api/sms/countries?service=<kod>
 * Seçili servisin tüm ülkelerdeki satış fiyatı, stok ve kalite skoru (ülke seçiminde anlık sıralama).
 */
export async function GET(req: NextRequest) {
  try {
    const service = (new URL(req.url).searchParams.get("service") || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{1,16}$/.test(service)) {
      return NextResponse.json({ success: false, error: "Geçersiz servis" }, { status: 400 });
    }

    const data = await pricingEngine.getCountryOffers(service);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error("Country offers API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
