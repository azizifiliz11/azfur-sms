import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Ticket, TicketMessage } from "@/lib/types";
import { sendTelegramDirectMessage } from "@/lib/telegram-bot";
import { CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const telegramId = req.nextUrl.searchParams.get("telegramId");

    if (!telegramId) {
      return NextResponse.json(
        { success: false, error: "telegramId parametresi gereklidir" },
        { status: 400 }
      );
    }

    const tickets = db.getUserTickets(telegramId);
    const settings = db.getSettings();

    return NextResponse.json({
      success: true,
      tickets,
      supportTelegramUsername: settings.supportTelegramUsername || "",
      supportTelegramUsernames: settings.supportTelegramUsernames || [],
    });
  } catch (err: any) {
    console.error("Tickets GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await db.syncFromCloud();
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { telegramId, subject, category, message, userFirstName, username } = body;

      if (!telegramId || !subject?.trim() || !message?.trim()) {
        return NextResponse.json(
          { success: false, error: "Konu ve mesaj alanları zorunludur" },
          { status: 400 }
        );
      }

      const ticketId = `TCK-${Date.now().toString(36).toUpperCase()}`;
      const now = new Date().toISOString();

      const ticket: Ticket = {
        id: ticketId,
        telegramId: Number(telegramId),
        username: username || "",
        userFirstName: userFirstName || "Kullanıcı",
        subject: subject.trim(),
        category: category || "GENERAL",
        status: "OPEN",
        messages: [
          {
            id: `msg_${Date.now()}`,
            sender: "user",
            senderName: userFirstName || "Kullanıcı",
            senderId: Number(telegramId),
            text: message.trim(),
            createdAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      const created = await db.createTicket(ticket);

      // Yöneticilere anlık Telegram bildirimi gönder
      const adminIds = db.getAdminTelegramIds();
      const safeName = (userFirstName || "Kullanıcı").replace(/[<>&]/g, "");
      const safeSubject = subject.replace(/[<>&]/g, "");
      const safeMsg = message.replace(/[<>&]/g, "");

      adminIds.forEach((adminId) => {
        sendTelegramDirectMessage(
          adminId,
          `🎫 <b>YENİ DESTEK TALEBİ GELDİ!</b>\n\n` +
            `📌 <b>Talep No:</b> <code>#${ticketId}</code>\n` +
            `👤 <b>Kullanıcı:</b> ${safeName} (@${username || "yok"})\n` +
            `🆔 <b>Telegram ID:</b> <code>${telegramId}</code>\n` +
            `📂 <b>Kategori:</b> ${ticket.category}\n` +
            `📝 <b>Konu:</b> ${safeSubject}\n\n` +
            `💬 <b>Mesaj:</b>\n${safeMsg}\n\n` +
            `<i>Yönetici panelinden 'Destek Talepleri' sekmesine girerek yanıtlayabilirsiniz.</i>`
        ).catch(() => {});
      });

      return NextResponse.json({
        success: true,
        message: "Destek talebiniz başarıyla oluşturuldu.",
        ticket: created,
      });
    }

    if (action === "reply") {
      const { ticketId, telegramId, message, userFirstName } = body;

      if (!ticketId || !message?.trim()) {
        return NextResponse.json(
          { success: false, error: "ticketId ve message gereklidir" },
          { status: 400 }
        );
      }

      const ticket = db.getTicket(ticketId);
      if (!ticket) {
        return NextResponse.json(
          { success: false, error: "Destek talebi bulunamadı" },
          { status: 404 }
        );
      }

      const now = new Date().toISOString();
      const newMsg: TicketMessage = {
        id: `msg_${Date.now()}`,
        sender: "user",
        senderName: userFirstName || ticket.userFirstName || "Kullanıcı",
        senderId: Number(telegramId || ticket.telegramId),
        text: message.trim(),
        createdAt: now,
      };

      const updated = await db.addTicketReply(ticketId, newMsg, "OPEN");

      // Yöneticilere yanıt bildirimi gönder
      const adminIds = db.getAdminTelegramIds();
      adminIds.forEach((adminId) => {
        sendTelegramDirectMessage(
          adminId,
          `💬 <b>DESTEK TALEBİNE YENİ YANIT!</b>\n\n` +
            `📌 <b>Talep No:</b> <code>#${ticketId}</code>\n` +
            `👤 <b>Kullanıcı:</b> ${ticket.userFirstName || "Kullanıcı"}\n` +
            `📝 <b>Konu:</b> ${ticket.subject}\n\n` +
            `💬 <b>Mesaj:</b>\n${message.trim()}`
        ).catch(() => {});
      });

      return NextResponse.json({
        success: true,
        message: "Yanıtınız iletildi.",
        ticket: updated,
      });
    }

    if (action === "close") {
      const { ticketId } = body;
      if (!ticketId) {
        return NextResponse.json(
          { success: false, error: "ticketId gereklidir" },
          { status: 400 }
        );
      }

      const updated = await db.updateTicketStatus(ticketId, "CLOSED");
      return NextResponse.json({
        success: true,
        message: "Destek talebi kapatıldı.",
        ticket: updated,
      });
    }

    return NextResponse.json({ success: false, error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    console.error("Tickets POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
