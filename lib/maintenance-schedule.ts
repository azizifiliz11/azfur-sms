import { db } from "./db";

/**
 * Zamanlanmış bakım: yönetici başlangıç/bitiş zamanı belirler; sistem bakım modunu bu aralıkta
 * kendiliğinden açar ve kapatır. Zamanlanmış bakım (trafik, en fazla 2 dk'da bir) ve saatlik cron'da
 * kontrol edilir; bu yüzden açılış/kapanış birkaç dakika gecikebilir.
 */
export interface MaintenanceSchedule {
  startAt: string;
  endAt: string;
  message?: string;
  /** Bakım modunu bu plan açtıysa true (bitişte yalnızca o zaman otomatik kapatılır) */
  enabledBySchedule?: boolean;
}

export async function applyMaintenanceSchedule(): Promise<void> {
  const settings = db.getSettings();
  const plan = settings.maintenanceSchedule;
  if (!plan) return;
  const now = Date.now();
  const start = new Date(plan.startAt).getTime();
  const end = new Date(plan.endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    await db.updateSettings({ maintenanceSchedule: null });
    return;
  }

  if (now >= start && now < end && !settings.maintenanceMode) {
    await db.updateSettings({
      maintenanceMode: true,
      maintenanceMessage: plan.message?.trim() || settings.maintenanceMessage || "",
      maintenanceSchedule: { ...plan, enabledBySchedule: true },
    });
    console.log("[MaintenanceSchedule] Planlı bakım başladı.");
    return;
  }

  if (now >= end) {
    if (plan.enabledBySchedule && settings.maintenanceMode) {
      await db.updateSettings({ maintenanceMode: false, maintenanceSchedule: null });
      console.log("[MaintenanceSchedule] Planlı bakım bitti, sistem açıldı.");
    } else {
      await db.updateSettings({ maintenanceSchedule: null });
    }
  }
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
});

/** Bakım planını kullanıcılara duyurur (duyuruları kapatanlar hariç). Arka planda çalıştırılmalı. */
export async function announceMaintenance(plan: MaintenanceSchedule): Promise<{ sent: number; skipped: number }> {
  const { sendTelegramDirectMessage } = await import("./telegram-bot");
  const optOut = await db.getAnnouncementOptOutIds();
  const text =
    `🛠️ <b>PLANLI BAKIM DUYURUSU</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
    `Sistemimiz <b>${dateFmt.format(new Date(plan.startAt))}</b> ile <b>${dateFmt.format(new Date(plan.endAt))}</b> ` +
    `arasında kısa bir bakım çalışması nedeniyle geçici olarak kapalı olacaktır.\n\n` +
    (plan.message?.trim() ? `${plan.message.trim().replace(/[<>&]/g, "")}\n\n` : "") +
    `<i>Aktif numaralarınızı bu saatten önce kullanmanızı öneririz. Anlayışınız için teşekkür ederiz.</i>`;
  let sent = 0;
  let skipped = 0;
  for (const u of db.getAllUsers()) {
    if (!u.telegramId || u.isBanned) continue;
    if (optOut.has(Number(u.telegramId))) {
      skipped++;
      continue;
    }
    const res = await sendTelegramDirectMessage(u.telegramId, text, "HTML").catch(() => ({ ok: false }));
    if ((res as any)?.ok) sent++;
  }
  return { sent, skipped };
}
