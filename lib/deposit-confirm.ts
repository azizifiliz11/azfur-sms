import { db } from "./db";
import { getPaymentInformation, evaluateCryptoTolerance } from "./oxapay";
import { sendTelegramDirectMessage } from "./telegram-bot";
import type { DepositRequest } from "./types";

/** Kripto ödeme kaydından sağlayıcı fatura/takip numarasını çıkarır (APR-xxx / OXA-xxx). */
export function getDepositTrackId(dep: DepositRequest): string | null {
  const match = String(dep.referenceCode || "").match(/^(?:APR|OXA)-(.+)$/);
  return match ? match[1] : dep.txid || null;
}

export function isAutoCryptoDeposit(dep: DepositRequest): boolean {
  return /^(?:APR|OXA)-/.test(String(dep.referenceCode || ""));
}

/**
 * Ödeme durumunu ödeme sağlayıcısının API'sinden doğrular; ödendiyse bakiyeyi bir kez yükler
 * ve kullanıcıya Telegram bildirimi gönderir. Webhook gövdesindeki durum bilgisine güvenilmez.
 * Ödeme zaten onaylanmışsa (başka bir istek yükledi) tekrar yükleme veya bildirim yapılmaz.
 */
export async function confirmCryptoDeposit(dep: DepositRequest, trackIdOverride?: string) {
  const trackId = trackIdOverride || getDepositTrackId(dep);
  if (!trackId) return { approved: null, payInfo: null, tolerance: null };

  const payInfo = await getPaymentInformation(trackId);
  const tolerance = evaluateCryptoTolerance(payInfo, dep.amount);
  const isPaid = payInfo.success && (payInfo.status === "paid" || tolerance.isAccepted);
  if (!isPaid || dep.status === "APPROVED") return { approved: null, payInfo, tolerance };

  const approved = await db.updateDepositStatus(dep.id, "APPROVED");
  if (approved) {
    const user = db.getUser(approved.telegramId);
    const toleranceNote =
      tolerance.deficitTry > 0
        ? `\nℹ️ <i>Küçük yuvarlama farkı toleransı (${tolerance.deficitTry.toFixed(2)} ₺ eksik) onaylandı.</i>\n`
        : "";
    await sendTelegramDirectMessage(
      approved.telegramId,
      `🎉 <b>TEBRİKLER! ÖDEMENİZ ONAYLANDI</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 <b>Yüklenen Tutar:</b> <code>₺${approved.amount.toFixed(2)}</code>\n` +
        `💳 <b>Yeni Bakiyeniz:</b> <code>₺${(user?.balance ?? approved.amount).toFixed(2)}</code>\n` +
        toleranceNote +
        `🆔 <b>İşlem No:</b> <code>#${trackId}</code>\n` +
        `⚡ Bakiyeniz hesabınıza otomatik olarak yüklenmiştir. Keyifli kullanımlar dileriz!`
    ).catch((err) => console.error("[DepositConfirm] Bildirim gönderilemedi:", err));
    const { checkLargeDeposit } = await import("./admin-alerts");
    await checkLargeDeposit(approved).catch(() => {});
  }
  return { approved, payInfo, tolerance };
}

/**
 * Bekleyen otomatik kripto ödemelerini sağlayıcıdan kontrol eder.
 * Webhook hiç gelmese veya kullanıcı yükleme penceresini kapatsa bile ödeme yüklenir.
 * Zamanlanmış bakımda (trafik + saatlik cron) çağrılır.
 */
export async function reconcilePendingCryptoDeposits(maxAgeHours = 6, limit = 15): Promise<number> {
  await db.syncFromCloud();
  const cutoff = Date.now() - maxAgeHours * 3600 * 1000;
  const pending = db
    .getDeposits()
    .filter((d) => d.status === "PENDING" && isAutoCryptoDeposit(d) && new Date(d.createdAt).getTime() >= cutoff)
    .slice(0, limit);

  let approvedCount = 0;
  for (const dep of pending) {
    try {
      const { approved } = await confirmCryptoDeposit(dep);
      if (approved) approvedCount++;
    } catch (err) {
      console.error(`[DepositConfirm] ${dep.id} kontrol edilemedi:`, err);
    }
  }
  if (approvedCount > 0) console.log(`[DepositConfirm] ${approvedCount} bekleyen ödeme otomatik onaylandı.`);
  return approvedCount;
}
