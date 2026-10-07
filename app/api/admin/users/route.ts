import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const users = db.getAllUsers();
    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, telegramId } = body;

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Telegram ID gereklidir" }, { status: 400 });
    }

    // 1. Kullanıcı Silme
    if (action === "delete_user") {
      const deleted = db.deleteUser(telegramId);
      if (!deleted) {
        return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: "Kullanıcı başarıyla silindi" });
    }

    // 2. Ban / Engel Durumu Değiştirme
    if (action === "toggle_ban") {
      const { isBanned } = body;
      const updated = db.toggleUserBan(telegramId, isBanned);
      if (!updated) {
        return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: isBanned ? "Kullanıcı başarıyla engellendi (banlandı)" : "Kullanıcının engeli kaldırıldı",
        user: updated,
      });
    }

    // 3. Admin Rolü Verme / Kaldırma
    if (action === "toggle_role") {
      const { role } = body;
      const updated = db.updateUserRole(telegramId, role === "admin" ? "admin" : "user");
      if (!updated) {
        return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: role === "admin" ? "Kullanıcıya admin yetkisi verildi" : "Admin yetkisi kaldırıldı",
        user: updated,
      });
    }

    // 4. Manuel Bakiye Ekleme / Düşme
    const { delta, reason } = body;
    if (delta !== undefined) {
      const numDelta = parseFloat(delta);
      if (isNaN(numDelta)) {
        return NextResponse.json({ success: false, error: "Geçersiz tutar" }, { status: 400 });
      }

      const updatedUser = db.updateUserBalance(telegramId, numDelta);
      if (!updatedUser) {
        return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Bakiye güncellendi (${numDelta > 0 ? "+" : ""}${numDelta} ₺). Yeni bakiye: ${updatedUser.balance.toFixed(2)} ₺`,
        user: updatedUser,
        reason,
      });
    }

    return NextResponse.json({ success: false, error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
