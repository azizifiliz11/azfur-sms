import { db } from "./db";
import { heroSms } from "./hero-sms";
import type { ActivationOrder, User } from "./types";

export type CancelResult =
  | { ok: true; order: ActivationOrder; user: User }
  | { ok: false; status: number; error: string };

const CANCEL_BLOCKED_MESSAGES: Partial<Record<ActivationOrder["status"], string>> = {
  RECEIVED: "SMS kodu gelmiş siparişler iptal edilemez.",
  COMPLETED: "Bu sipariş tamamlanmış; iptal edilemez.",
  CANCELLED: "Bu sipariş zaten iptal edilmiş ve ücreti iade edilmiş.",
  TIMEOUT: "Bu siparişin süresi dolmuş ve ücreti zaten iade edilmiş.",
};

function providerCancelError(raw: string): string {
  if (/EARLY_CANCEL/i.test(raw)) {
    return "Numara alındıktan sonraki ilk 2 dakika içinde iptal edilemiyor. Lütfen biraz bekleyip tekrar deneyin.";
  }
  if (/STATUS_OK|FULL_SMS|BAD_STATUS/i.test(raw)) {
    return "Bu numaraya SMS kodu gelmiş görünüyor; iptal edilemez. Lütfen sayfayı yenileyin.";
  }
  return "Numara sağlayıcıda iptal edilemedi. Lütfen birkaç saniye sonra tekrar deneyin.";
}

/**
 * Kullanıcının kendi siparişini iptal eder ve ücretini iade eder.
 * - Yalnızca siparişin sahibi iptal edebilir; iade her zaman siparişin sahibine yapılır.
 * - Yalnızca kod beklenen (WAIT_CODE) siparişler iptal edilebilir.
 * - Durum atomik olarak kilitlenir: çift tıklama / eşzamanlı istekte iade yalnızca bir kez yapılır.
 * - Sağlayıcı iptali kabul etmezse (kod gelmiş, erken iptal) iade yapılmaz ve sipariş geri açılır.
 */
export async function cancelOrderWithRefund(orderId: string, requesterId: number): Promise<CancelResult> {
  await db.syncFromCloud(true);
  const order = db.getActivation(orderId);
  if (!order) return { ok: false, status: 404, error: "Sipariş bulunamadı." };
  if (Number(order.telegramId) !== Number(requesterId)) {
    return { ok: false, status: 403, error: "Bu sipariş size ait değil." };
  }
  if (order.status !== "WAIT_CODE") {
    return { ok: false, status: 409, error: CANCEL_BLOCKED_MESSAGES[order.status] || "Bu sipariş iptal edilemez." };
  }

  // Kilit: WAIT_CODE -> CANCELLED (yalnızca bir istek kazanır)
  const claimed = await db.claimActivationStatus(orderId, ["WAIT_CODE"], "CANCELLED");
  if (!claimed) {
    const latest = db.getActivation(orderId);
    return {
      ok: false,
      status: 409,
      error: (latest && CANCEL_BLOCKED_MESSAGES[latest.status]) || "Bu sipariş zaten işleniyor.",
    };
  }

  const provider = await heroSms.setStatus(orderId, 8);
  if (!provider.success) {
    // Sağlayıcı iptali kabul etmedi: iade yok, siparişi tekrar beklemeye al
    await db.claimActivationStatus(orderId, ["CANCELLED"], "WAIT_CODE");
    console.warn(`[Cancel] Sağlayıcı iptali reddetti (${orderId}): ${provider.raw}`);
    return { ok: false, status: 409, error: providerCancelError(provider.raw) };
  }

  const user = await db.incrementUserBalance(order.telegramId, order.chargedPrice);
  db.addLog({
    category: "ORDER",
    level: "INFO",
    action: "ORDER_REFUNDED",
    details: `${order.countryFlag} ${order.serviceName} (${order.phoneNumber}) siparişi iptal edildi, ${order.chargedPrice.toFixed(2)} ₺ bakiye iade edildi.`,
    telegramId: Number(order.telegramId),
    metadata: { orderId: order.id, phoneNumber: order.phoneNumber, refundAmount: order.chargedPrice },
  }).catch(() => {});

  return { ok: true, order: claimed, user };
}

/**
 * Süresi dolan veya sağlayıcı tarafından iptal edilen siparişin ücretini (bir kez) iade eder.
 * Durum zaten değiştirilmişse (başka bir yoklama iade ettiyse) null döner.
 */
export async function refundUnfulfilledOrder(
  order: ActivationOrder,
  to: "TIMEOUT" | "CANCELLED"
): Promise<ActivationOrder | null> {
  const claimed = await db.claimActivationStatus(order.id, ["WAIT_CODE"], to);
  if (!claimed) return null;
  if (to === "TIMEOUT") {
    await heroSms.setStatus(order.id, 8).catch(() => null);
  }
  await db.incrementUserBalance(order.telegramId, order.chargedPrice);
  return claimed;
}
