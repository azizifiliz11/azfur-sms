import { NextRequest, NextResponse } from "next/server";
import { heroSms } from "@/lib/hero-sms";
import { db } from "@/lib/db";
import { sendTelegramSmsNotification } from "@/lib/telegram-bot";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Aktivasyon ID gerekli" }, { status: 400 });
    }

    await db.syncFromCloud();
    const order = db.getActivation(id);
    if (!order) {
      return NextResponse.json({ success: false, error: "Sipariş bulunamadı" }, { status: 404 });
    }

    // Süre dolmuş mu?
    if (Date.now() > order.expiresAt && order.status === "WAIT_CODE") {
      // Otomatik süre dolumu ve iade
      await db.updateUserBalance(order.telegramId, order.chargedPrice);
      const updated = await db.updateActivation(id, { status: "TIMEOUT" });
      await heroSms.setStatus(id, 8);
      return NextResponse.json({ success: true, order: updated, message: "Süre doldu, ücret iade edildi" });
    }

    // Zaten kod alınmış veya iptal edilmişse doğrudan döndür
    if (order.status === "RECEIVED" || order.status === "CANCELLED" || order.status === "COMPLETED") {
      return NextResponse.json({ success: true, order });
    }

    // Hero-SMS'ten güncel durumu sorgula
    const statusResult = await heroSms.getStatus(id);

    if (statusResult.status === "RECEIVED" && statusResult.code) {
      const code = statusResult.code;
      const updated = await db.updateActivation(id, {
        status: "RECEIVED",
        smsCode: code,
      });

      // Telegram Botuna Anlık Bildirim Gönder (Kullanıcı mini appi kapatsa dahi bildirim alsın)
      if (updated && !updated.notifiedBot) {
        // Profil ayarlarından "SMS gelince bot mesajı" kapatılmışsa gönderme
        const prefs = await db.getUserPreferences(updated.telegramId);
        if (prefs.notifySms) {
          await sendTelegramSmsNotification(
            updated.telegramId,
            updated.serviceName,
            updated.phoneNumber,
            code
          );
        }
        await db.updateActivation(id, { notifiedBot: true });
      }

      return NextResponse.json({
        success: true,
        order: { ...updated, smsCode: code, notifiedBot: true },
        message: "SMS kodu başarıyla yakalandı",
      });
    }

    if (statusResult.status === "CANCELLED") {
      await db.updateUserBalance(order.telegramId, order.chargedPrice);
      const updated = await db.updateActivation(id, { status: "CANCELLED" });
      return NextResponse.json({ success: true, order: updated, message: "Aktivasyon iptal edildi" });
    }

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error("Status polling error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
