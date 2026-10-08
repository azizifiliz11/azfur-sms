import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TicketMessage } from "@/lib/types";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    await db.syncFromCloud();
    const tickets = db.getAllTickets();
    const openCount = tickets.filter((t) => t.status === "OPEN").length;
    const answeredCount = tickets.filter((t) => t.status === "ANSWERED").length;
    const closedCount = tickets.filter((t) => t.status === "CLOSED").length;

    return NextResponse.json({
      success: true,
      tickets,
      counts: {
        total: tickets.length,
        open: openCount,
        answered: answeredCount,
        closed: closedCount,
      },
    });
  } catch (err: any) {
    console.error("Admin tickets GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const body = await req.json();
    const { action, ticketId } = body;

    if (!ticketId) {
      return NextResponse.json(
        { success: false, error: "ticketId gereklidir" },
        { status: 400 }
      );
    }

    const ticket = db.getTicket(ticketId);
    if (!ticket && action !== "delete") {
      return NextResponse.json(
        { success: false, error: "Destek talebi bulunamadı" },
        { status: 404 }
      );
    }

    // 1. Yönetici Yanıtı Gönderme
    if (action === "reply") {
      const { message, adminName } = body;
      if (!message?.trim()) {
        return NextResponse.json(
          { success: false, error: "Yanıt mesajı boş olamaz" },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const newMsg: TicketMessage = {
        id: `msg_${Date.now()}`,
        sender: "admin",
        senderName: adminName || "Yönetici Destek",
        senderId: "admin",
        text: message.trim(),
        createdAt: now,
      };

      const updated = await db.addTicketReply(ticketId, newMsg, "ANSWERED");

      // Kullanıcının Telegram hesabına anlık bildirim mesajı gönder
      if (ticket?.telegramId) {
        const safeSubject = (ticket.subject || "").replace(/[<>&]/g, "");
        const safeMsg = message.trim().replace(/[<>&]/g, "");

        sendTelegramDirectMessage(
          ticket.telegramId,
          `🔔 <b>DESTEK TALEBİNİZ YANITLANDI!</b>\n\n` +
            `🎫 <b>Talep No:</b> <code>#${ticketId}</code>\n` +
            `📌 <b>Konu:</b> ${safeSubject}\n\n` +
            `💬 <b>Yetkili Yanıtı:</b>\n` +
            `<blockquote>${safeMsg}</blockquote>\n\n` +
            `<i>Mini App destek menüsünden talebinize göz atabilir ve görüşmeye devam edebilirsiniz.</i>`
        ).catch((e) => {
          console.error("Failed to notify user about ticket reply:", e);
        });
      }

      return NextResponse.json({
        success: true,
        message: "Yanıt başarıyla gönderildi ve kullanıcı bilgilendirildi.",
        ticket: updated,
      });
    }

    // 2. Durum Değiştirme (Aç / Kapat)
    if (action === "status") {
      const { status } = body;
      if (!status || !["OPEN", "ANSWERED", "CLOSED"].includes(status)) {
        return NextResponse.json(
          { success: false, error: "Geçersiz durum değeri" },
          { status: 400 }
        );
      }

      const updated = await db.updateTicketStatus(ticketId, status);
      return NextResponse.json({
        success: true,
        message: status === "CLOSED" ? "Destek talebi kapatıldı." : "Destek talebi yeniden açıldı.",
        ticket: updated,
      });
    }

    // 3. Destek Talebini Kalıcı Olarak Silme
    if (action === "delete") {
      const deleted = await db.deleteTicket(ticketId);
      return NextResponse.json({
        success: true,
        message: deleted ? "Destek talebi başarıyla silindi." : "Talep silinemedi.",
      });
    }

    return NextResponse.json({ success: false, error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    console.error("Admin tickets POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
