import { NextRequest, NextResponse } from "next/server";
import { requireTelegramUser } from "@/lib/request-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // Önceden telegramId verilmezse TÜM kullanıcıların aktif numaraları ve kodları dönüyordu
    const auth = requireTelegramUser(req, undefined, searchParams.get("telegramId"));
    if (!auth.ok) return auth.response;

    // Sipariş başka bir sunucusuz örnekte oluşturulmuş olabilir: bellek eşitlenmeden okunursa
    // yeni numara listede bir görünüp bir kaybolur.
    if (!(await db.refreshUserActivationsFromSql(auth.id))) {
      await db.syncFromCloud();
    }
    const orders = db.getActiveOrders(auth.id);

    return NextResponse.json(
      {
        success: true,
        orders,
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
