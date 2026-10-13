import { db } from "./db";
import { heroSms, heroErrorMessage, type RentSms } from "./hero-sms";
import type { ActivationOrder, User } from "./types";

/** Süreli numara kiralama (Full rent) siparişi mi? SQL'de tür sütunu olmadığından servis koduna da bakılır. */
export function isRentOrder(order: Pick<ActivationOrder, "kind" | "serviceCode" | "id"> | null | undefined): boolean {
  if (!order) return false;
  return order.kind === "rent" || order.serviceCode === "full" || String(order.id).startsWith("mock_rent_");
}

/** Hero-SMS kuralı: kiralama yalnızca hiç SMS gelmediyse ve ilk 20 dakika içinde iptal (iade) edilebilir. */
export const RENT_FREE_CANCEL_MS = 20 * 60 * 1000;

/** Hero-SMS kuralı: SMS aktivasyonu numara alındıktan sonraki ilk 2 dakika iptal edilemez (EARLY_CANCEL_DENIED). */
export const EARLY_CANCEL_MS = 2 * 60 * 1000;

/** Siparişi sağlayıcıda kapatır: SMS aktivasyonu için status=6, kiralama için finishActivation. */
export async function finishOrderAtProvider(order: ActivationOrder): Promise<void> {
  if (isRentOrder(order)) await heroSms.finishActivation(order.id).catch(() => null);
  else await heroSms.setStatus(order.id, 6).catch(() => null);
}

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
  const rent = isRentOrder(order);
  // Sağlayıcının reddedeceği erken iptal, sipariş kilitlenmeden reddedilir: aksi halde durum kısa süre
  // CANCELLED görünür ve Mini App'te numara listeden kaybolup geri gelir.
  const earlyLeftMs = order.createdAt + EARLY_CANCEL_MS - Date.now();
  if (!rent && earlyLeftMs > 0) {
    const sec = Math.ceil(earlyLeftMs / 1000);
    const left = sec >= 60 ? `${Math.floor(sec / 60)} dk ${sec % 60} sn` : `${sec} sn`;
    return {
      ok: false,
      status: 409,
      error: `Numara alındıktan sonraki ilk 2 dakika içinde iptal edilemiyor. ${left} sonra tekrar deneyebilirsiniz.`,
    };
  }
  if (rent && Date.now() - order.createdAt >= RENT_FREE_CANCEL_MS) {
    return {
      ok: false,
      status: 409,
      error: "Kiralık numaralar yalnızca ilk 20 dakika içinde ve hiç SMS gelmediyse iptal edilebilir. Kiralama süreniz devam ediyor.",
    };
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

  if (rent) {
    const pc = await heroSms.cancelActivation(orderId);
    if (!pc.success) {
      // Sağlayıcı zaten iptal ettiyse (ücret bize döndü) iade yapılır; aksi halde kiralama devam eder
      const st = pc.error === "ACTIVATION_NOT_ACTIVE" ? await heroSms.getStatus(orderId) : null;
      if (st?.status !== "CANCELLED") {
        await db.claimActivationStatus(orderId, ["CANCELLED"], "WAIT_CODE");
        console.warn(`[Cancel] Sağlayıcı kiralama iptalini reddetti (${orderId}): ${pc.raw}`);
        await syncOrderWithProvider(orderId).catch(() => null);
        const msg = /EARLY_CANCEL/i.test(pc.raw) ? providerCancelError(pc.raw) : heroErrorMessage(pc.error);
        return { ok: false, status: 409, error: msg };
      }
    }
  }

  const provider = rent ? { success: true, raw: "" } : await heroSms.setStatus(orderId, 8);
  if (!provider.success) {
    // Sağlayıcı iptali reddetti: gerçek durumu sor. Sağlayıcı zaten iptal ettiyse (ücret bize döndü)
    // iade yapılır; kod geldiyse kod kullanıcıya teslim edilir; aksi halde sipariş beklemeye döner.
    const st = await heroSms.getStatus(orderId);
    if (st.status !== "CANCELLED") {
      await db.claimActivationStatus(orderId, ["CANCELLED"], "WAIT_CODE");
      console.warn(`[Cancel] Sağlayıcı iptali reddetti (${orderId}): ${provider.raw} / durum: ${st.raw}`);
      if (st.status === "RECEIVED" && st.code) {
        await deliverCode(orderId, st.code, null);
        return { ok: false, status: 409, error: "Bu numaraya SMS kodu geldi; iptal edilemez. Kodunuz ekranda." };
      }
      return { ok: false, status: 409, error: providerCancelError(provider.raw) };
    }
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

  import("./admin-alerts").then((m) => m.checkRefundBurst(Number(order.telegramId))).catch(() => {});
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
    const provider = await heroSms.setStatus(order.id, 8).catch(() => ({ success: false, raw: "" }));
    if (!provider.success) {
      // Son anda kod gelmiş olabilir: kod varsa iade yerine kodu teslim et
      const st = await heroSms.getStatus(order.id);
      if (st.status === "RECEIVED" && st.code) {
        await db.claimActivationStatus(order.id, ["TIMEOUT"], "WAIT_CODE");
        await deliverCode(order.id, st.code, null);
        return null;
      }
    }
  }
  const user = await db.incrementUserBalance(order.telegramId, order.chargedPrice);
  db.addLog({
    category: "ORDER",
    level: "INFO",
    action: "ORDER_REFUNDED",
    details: `${order.serviceName} (${order.phoneNumber}) siparişinde kod gelmedi (${to === "TIMEOUT" ? "süre doldu" : "sağlayıcı iptal etti"}), ${order.chargedPrice.toFixed(2)} ₺ otomatik iade edildi.`,
    telegramId: Number(order.telegramId),
    metadata: { orderId: order.id, refundAmount: order.chargedPrice, reason: to },
  }).catch(() => {});
  notifyRefund(order, user?.balance).catch(() => {});
  import("./admin-alerts").then((m) => m.checkRefundBurst(Number(order.telegramId))).catch(() => {});
  return claimed;
}

async function notifyRefund(order: ActivationOrder, newBalance?: number) {
  const { sendTelegramDirectMessage } = await import("./telegram-bot");
  await sendTelegramDirectMessage(
    order.telegramId,
    `↩️ <b>KOD GELMEDİ — ÜCRETİNİZ İADE EDİLDİ</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 <b>Servis:</b> ${order.serviceName}\n` +
      `📞 <b>Numara:</b> <code>${order.phoneNumber}</code>\n` +
      `💰 <b>İade:</b> <code>+${order.chargedPrice.toFixed(2)} ₺</code>\n` +
      (newBalance !== undefined ? `💳 <b>Yeni Bakiyeniz:</b> <code>${newBalance.toFixed(2)} ₺</code>\n` : "") +
      `\n<i>Dilerseniz farklı bir ülke veya servisle tekrar deneyebilirsiniz.</i>`
  );
}

/**
 * Gelen kodu siparişe işler. WAIT_CODE → RECEIVED geçişi atomik olduğundan kullanıcıya bildirim
 * yalnızca bir kez gider (Mini App yoklaması, bot butonu, Hero-SMS webhook'u ve arka plan taraması
 * aynı anda gelse bile). Sonraki farklı kodlar (yeni SMS) sessizce güncellenir.
 */
export async function deliverCode(
  orderId: string,
  code: string,
  smsText: string | null,
  opts: { notify?: boolean } = {}
): Promise<ActivationOrder | null> {
  const claimed = await db.claimActivationStatus(orderId, ["WAIT_CODE"], "RECEIVED");
  if (claimed) {
    const updated = await db.updateActivation(orderId, {
      status: "RECEIVED",
      smsCode: code,
      smsText: smsText || claimed.smsText || null,
      notifiedBot: true,
    });
    const order = updated || claimed;
    const prefs = await db.getUserPreferences(order.telegramId);
    if (opts.notify !== false && prefs.notifySms) {
      const { sendTelegramSmsNotification } = await import("./telegram-bot");
      await sendTelegramSmsNotification(order.telegramId, order.serviceName, order.phoneNumber, code).catch(() => false);
    }
    return order;
  }
  const current = db.getActivation(orderId);
  if (current && current.status === "RECEIVED" && current.smsCode !== code) {
    return db.updateActivation(orderId, { smsCode: code, smsText: smsText || current.smsText || null });
  }
  return current;
}

export type OrderSyncEvent = "code_received" | "refunded_timeout" | "refunded_cancelled" | "none";

export interface RentMessage {
  from: string;
  code: string | null;
  text: string | null;
  date: string;
}

/** Telegram Markdown'ı bozmasın diye SMS metnini sadeleştirir */
function plainSmsPreview(text: string): string {
  return text.replace(/[`*_\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 160);
}

/**
 * Kiralık numara eşitlemesi: süre boyunca gelen tüm SMS'leri (getAllSms) okur, her yeni SMS'i bir kez
 * bildirir. Süre bitince sipariş iadesiz tamamlanır (kiralama süresi kullanılmıştır). Sağlayıcı kiralamayı
 * iptal ettiyse ve hiç SMS gelmediyse ücret bir kez iade edilir.
 */
async function syncRentOrder(
  order: ActivationOrder,
  opts: { notify?: boolean }
): Promise<{ order: ActivationOrder | null; event: OrderSyncEvent; messages: RentMessage[] }> {
  const orderId = order.id;
  const res = await heroSms.getAllSms(orderId);
  const messages: RentMessage[] = res.items
    .filter((m: RentSms) => m.code || m.text)
    .map((m: RentSms) => ({ from: m.from, code: m.code, text: m.text, date: m.date }));

  let event: OrderSyncEvent = "none";
  const latest = messages[0];
  if (latest) {
    const wasWaiting = order.status === "WAIT_CODE";
    const code = latest.code || "SMS";
    const claimed = await db.claimActivationSms(orderId, code, latest.text || null);
    if (claimed) {
      event = "code_received";
      const prefs = await db.getUserPreferences(order.telegramId);
      if (opts.notify !== false && prefs.notifySms) {
        const { sendTelegramSmsNotification } = await import("./telegram-bot");
        const shown = latest.code || plainSmsPreview(latest.text || "");
        await sendTelegramSmsNotification(order.telegramId, order.serviceName, order.phoneNumber, shown).catch(() => false);
      }
      if (wasWaiting) {
        db.addLog({
          category: "ORDER",
          level: "INFO",
          action: "RENT_SMS_RECEIVED",
          details: `${order.countryFlag} Kiralık numaraya (${order.phoneNumber}) ilk SMS geldi.`,
          telegramId: Number(order.telegramId),
          metadata: { orderId },
        }).catch(() => {});
      }
    }
  }

  if (res.notActive) {
    const current = db.getActivation(orderId) || order;
    if (current.status === "WAIT_CODE") {
      // Kiralama sağlayıcıda kapandı ve hiç SMS gelmedi: sağlayıcı iptal ettiyse ücret iade edilir
      const st = await heroSms.getStatus(orderId);
      if (st.status === "CANCELLED") {
        const refunded = await refundUnfulfilledOrder(current, "CANCELLED");
        return { order: refunded || db.getActivation(orderId), event: refunded ? "refunded_cancelled" : event, messages };
      }
    }
    if (Date.now() > current.expiresAt || current.status === "RECEIVED") {
      const done = await db.claimActivationStatus(orderId, ["WAIT_CODE", "RECEIVED"], "COMPLETED");
      return { order: done || db.getActivation(orderId), event, messages };
    }
  }

  // Süre doldu: kiralama tamamlanır (iade yok; numara süre boyunca kullanıcıya ayrılmıştı)
  const current = db.getActivation(orderId) || order;
  if (Date.now() > current.expiresAt && (current.status === "WAIT_CODE" || current.status === "RECEIVED")) {
    const done = await db.claimActivationStatus(orderId, ["WAIT_CODE", "RECEIVED"], "COMPLETED");
    if (done) await heroSms.finishActivation(orderId).catch(() => null);
    return { order: done || db.getActivation(orderId), event, messages };
  }

  return { order: db.getActivation(orderId), event, messages };
}

/**
 * Siparişi sağlayıcıdaki gerçek durumla eşitler: kod geldiyse teslim eder, sağlayıcı iptal ettiyse
 * veya süre dolduysa ücreti bir kez iade eder. Tüm yollar (Mini App, bot, webhook, arka plan) bunu kullanır.
 */
export async function syncOrderWithProvider(
  orderId: string,
  opts: { notify?: boolean } = {}
): Promise<{ order: ActivationOrder | null; event: OrderSyncEvent; messages?: RentMessage[] }> {
  const order = db.getActivation(orderId);
  if (!order) return { order: null, event: "none" };
  if (isRentOrder(order)) {
    if (order.status !== "WAIT_CODE" && order.status !== "RECEIVED") {
      // Kapanmış kiralama: geçmiş SMS'ler yine de gösterilebilsin
      const res = await heroSms.getAllSms(orderId).catch(() => ({ items: [] as RentSms[] }));
      return {
        order,
        event: "none",
        messages: res.items.filter((m) => m.code || m.text).map((m) => ({ from: m.from, code: m.code, text: m.text, date: m.date })),
      };
    }
    return syncRentOrder(order, opts);
  }
  if (order.status !== "WAIT_CODE" && order.status !== "RECEIVED") return { order, event: "none" };

  const st = await heroSms.getStatus(orderId);

  if (st.status === "RECEIVED" && st.code) {
    const wasWaiting = order.status === "WAIT_CODE";
    const updated = await deliverCode(orderId, st.code, null, opts);
    return { order: updated, event: wasWaiting && updated?.status === "RECEIVED" ? "code_received" : "none" };
  }

  if (order.status === "WAIT_CODE") {
    if (st.status === "CANCELLED") {
      const refunded = await refundUnfulfilledOrder(order, "CANCELLED");
      return { order: refunded || db.getActivation(orderId), event: refunded ? "refunded_cancelled" : "none" };
    }
    if (Date.now() > order.expiresAt) {
      const refunded = await refundUnfulfilledOrder(order, "TIMEOUT");
      return { order: refunded || db.getActivation(orderId), event: refunded ? "refunded_timeout" : "none" };
    }
  }

  // Kodu gelmiş ve süresi dolmuş sipariş: otomatik tamamla (aktif listeden düşsün)
  if (order.status === "RECEIVED" && Date.now() > order.expiresAt) {
    const done = await db.claimActivationStatus(orderId, ["RECEIVED"], "COMPLETED");
    if (done) await heroSms.setStatus(orderId, 6).catch(() => null);
    return { order: done || db.getActivation(orderId), event: "none" };
  }

  return { order: db.getActivation(orderId), event: "none" };
}

/**
 * Arka plan taraması: kod bekleyen tüm siparişleri sağlayıcıdan kontrol eder. Kullanıcı Mini App'i
 * kapatsa veya bot butonuna basmasa bile kod bildirimi gider ve süresi dolanlar iade edilir.
 */
export async function reconcileActiveOrders(limit = 30): Promise<number> {
  await db.syncFromCloud();
  const waiting = db
    .getActiveOrders()
    // Kiralık numaralar süre boyunca yeni SMS alabildiğinden kod gelmiş olsalar da taranır
    .filter((o) => o.status === "WAIT_CODE" || Date.now() > o.expiresAt || isRentOrder(o))
    .sort((a, b) => a.expiresAt - b.expiresAt)
    .slice(0, limit);
  let changed = 0;
  for (let i = 0; i < waiting.length; i += 5) {
    const batch = waiting.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map((o) => syncOrderWithProvider(o.id)));
    changed += results.filter((r) => r.status === "fulfilled" && r.value.event !== "none").length;
  }
  if (changed > 0) console.log(`[OrderReconcile] ${changed} sipariş güncellendi (kod/iade).`);
  return changed;
}
