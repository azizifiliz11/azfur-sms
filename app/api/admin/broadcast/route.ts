import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";
import { isAuthorizedAdmin } from "@/lib/auth-check";

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ success: false, error: "Yetkisiz Erişim! Yönetici PIN kodu gereklidir." }, { status: 403 });
    }
    const { target, telegramId, message } = await req.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: "Mesaj metni boş olamaz" }, { status: 400 });
    }

    const cleanMessage = message.trim();

    if (target === "user") {
      if (!telegramId) {
        return NextResponse.json({ success: false, error: "Kullanıcı seçilmedi" }, { status: 400 });
      }

      const res = await sendTelegramDirectMessage(telegramId, cleanMessage, "HTML");
      if (!res.ok) {
        return NextResponse.json({
          success: false,
          error: `Mesaj gönderilemedi: ${res.error || "Bilinmeyen hata"}`,
        }, { status: 400 });
      }

      await db.addLog({
        category: "ADMIN",
        level: "INFO",
        action: "BROADCAST_DIRECT_SENT",
        details: `${telegramId} ID'li kullanıcıya doğrudan mesaj gönderildi.`,
        telegramId: Number(telegramId),
        metadata: { messagePreview: cleanMessage.slice(0, 100) },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `${telegramId} ID'li kullanıcıya mesaj başarıyla iletildi.`,
        sentCount: 1,
      });
    }

    if (target === "all") {
      const users = db.getAllUsers();
      if (users.length === 0) {
        return NextResponse.json({ success: false, error: "Sistemde kayıtlı kullanıcı bulunamadı." }, { status: 400 });
      }

      let sentCount = 0;
      let failedCount = 0;

      for (const u of users) {
        if (!u.telegramId) continue;
        try {
          const res = await sendTelegramDirectMessage(u.telegramId, cleanMessage, "HTML");
          if (res.ok) {
            sentCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      await db.addLog({
        category: "ADMIN",
        level: "INFO",
        action: "BROADCAST_ALL_SENT",
        details: `Tüm kullanıcılara toplu duyuru gönderildi (${sentCount} başarılı, ${failedCount} başarısız).`,
        metadata: { sentCount, failedCount, totalUsers: users.length, messagePreview: cleanMessage.slice(0, 100) },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Duyuru tamamlandı: ${sentCount} kullanıcıya iletildi${failedCount > 0 ? `, ${failedCount} kullanıcıya iletilemedi` : ""}.`,
        sentCount,
        failedCount,
        totalUsers: users.length,
      });
    }

    return NextResponse.json({ success: false, error: "Geçersiz hedef seçimi" }, { status: 400 });
  } catch (err: any) {
    console.error("Admin broadcast error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
