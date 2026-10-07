import { NextRequest, NextResponse } from "next/server";
import { pricingEngine } from "@/lib/pricing";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const countryIdParam = searchParams.get("country");
    const countryId = countryIdParam !== null ? parseInt(countryIdParam, 10) : undefined;

    const data = await pricingEngine.getCatalog(countryId);

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error("Catalog API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
