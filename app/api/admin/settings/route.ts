import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { heroSms } from "@/lib/hero-sms";
import { tcmb } from "@/lib/tcmb";

export async function GET() {
  try {
    await db.syncFromCloud();
    const settings = db.getSettings();
    const [allCountries, allServices, tcmbRateInfo] = await Promise.all([
      heroSms.getCountries(),
      heroSms.getServicesList(),
      tcmb.getLiveRate(),
    ]);

    return NextResponse.json({
      success: true,
      settings,
      tcmbRateInfo,
      allCountries,
      allServices,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const body = await req.json();

    // Özel işlem: TCMB canlı kurunu anında yeniden çek
    if (body.action === "refresh_tcmb") {
      const live = await tcmb.getLiveRate(true);
      return NextResponse.json({
        success: true,
        message: `TCMB Kuru başarıyla güncellendi: ₺${live.rate.toFixed(4)}`,
        tcmbRateInfo: live,
        settings: db.getSettings(),
      });
    }

    const updated = db.updateSettings(body);

    return NextResponse.json({
      success: true,
      message: "Kâr marjı ve sistem ayarları başarıyla güncellendi",
      settings: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
