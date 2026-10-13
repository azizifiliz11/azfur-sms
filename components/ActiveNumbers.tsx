"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, XCircle, CheckCircle2, Clock, Smartphone, BellRing } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { ActivationOrder } from "@/lib/types";
import { haptic } from "@/lib/haptic";
import { appAlert, appConfirm } from "@/lib/app-dialog";
import { Card } from "./tremor/Card";
import { Badge } from "./tremor/Badge";
import { ServiceIcon } from "./ServiceIcon";

interface RentMessage {
  from: string;
  code: string | null;
  text: string | null;
  date: string;
}

/** Süreli numara kiralama (Full rent) siparişi */
function isRent(order: ActivationOrder): boolean {
  return order.kind === "rent" || order.serviceCode === "full" || String(order.id).startsWith("mock_rent_");
}

const RENT_FREE_CANCEL_MS = 20 * 60 * 1000;
/** Hero-SMS: SMS aktivasyonu numara alındıktan sonraki ilk 2 dakika iptal edilemez */
const EARLY_CANCEL_MS = 2 * 60 * 1000;

interface ActiveNumbersProps {
  orders: ActivationOrder[];
  onOrderUpdated: () => void;
  /** İptal sürerken sipariş listede tutulsun (sunucu kısa süre CANCELLED gösterebilir) */
  onCancelPending?: (id: string, pending: boolean) => void;
  telegramId: number;
}

export function ActiveNumbers({ orders, onOrderUpdated, onCancelPending, telegramId }: ActiveNumbersProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  // Kiralık numaraların gelen tüm SMS'leri (sipariş kimliğine göre)
  const [rentMessages, setRentMessages] = useState<Record<string, RentMessage[]>>({});

  // Per-second timer update
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Yoklamalar sipariş kimliklerine bağlıdır; liste her yenilendiğinde aralıklar sıfırlanmasın diye
  // güncel siparişler ve geri çağırma ref üzerinden okunur.
  const ordersRef = useRef(orders);
  const onOrderUpdatedRef = useRef(onOrderUpdated);
  useEffect(() => {
    ordersRef.current = orders;
    onOrderUpdatedRef.current = onOrderUpdated;
  }, [orders, onOrderUpdated]);

  const rentKey = orders
    .filter((o) => isRent(o) && (o.status === "WAIT_CODE" || o.status === "RECEIVED"))
    .map((o) => o.id)
    .join(",");
  const waitingKey = orders
    .filter((o) => o.status === "WAIT_CODE" && !isRent(o))
    .map((o) => o.id)
    .join(",");

  // Kiralık numaralar: süre boyunca yeni SMS gelebilir; tüm SMS'ler 8 sn'de bir yenilenir
  useEffect(() => {
    if (!rentKey) return;
    const ids = rentKey.split(",");
    let stopped = false;
    let busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      let anyChanged = false;
      for (const id of ids) {
        try {
          const res = await fetch(`/api/sms/status?id=${id}`);
          const data = await res.json();
          if (stopped || !data.success) continue;
          if (Array.isArray(data.rentMessages)) {
            setRentMessages((prev) => ({ ...prev, [id]: data.rentMessages }));
          }
          const order = ordersRef.current.find((o) => o.id === id);
          const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);
          if (order && (!same(data.order?.status, order.status) || !same(data.order?.smsText, order.smsText) || !same(data.order?.smsCode, order.smsCode))) {
            if (data.order?.status === "RECEIVED") haptic.success();
            anyChanged = true;
          }
        } catch (e) {
          // ignore
        }
      }
      busy = false;
      if (anyChanged && !stopped) onOrderUpdatedRef.current();
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [rentKey]);

  // Poll status for active orders every 3.5 seconds
  useEffect(() => {
    if (!waitingKey) return;
    const ids = waitingKey.split(",");
    let stopped = false;
    let busy = false;

    const interval = setInterval(async () => {
      if (busy) return;
      busy = true;
      let anyChanged = false;

      for (const id of ids) {
        try {
          const res = await fetch(`/api/sms/status?id=${id}`);
          const data = await res.json();
          if (data.success && data.order?.status === "RECEIVED") {
            haptic.success();
            anyChanged = true;
          } else if (data.success && data.order?.status && data.order.status !== "WAIT_CODE") {
            // Süre doldu / sağlayıcı iptal etti → ücret iade edildi: listeyi ve bakiyeyi yenile
            anyChanged = true;
          }
        } catch (e) {
          // ignore
        }
      }

      busy = false;
      if (anyChanged && !stopped) {
        onOrderUpdatedRef.current();
      }
    }, 3500);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [waitingKey]);

  const handleCancel = async (id: string, rent = false) => {
    const question = rent
      ? "Kiralamayı iptal etmek ve ödediğiniz tutarın tamamını bakiyenize iade almak istiyor musunuz? Numara elinizden çıkar."
      : "Numarayı iptal etmek ve ödediğiniz tutarı bakiyenize iade almak istiyor musunuz?";
    if (!(await appConfirm(question, { title: rent ? "Kiralamayı iptal et" : "Numarayı iptal et", confirmText: "İptal Et", cancelText: "Vazgeç", destructive: true }))) {
      return;
    }

    setCancellingId(id);
    onCancelPending?.(id, true);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/sms/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activationId: id,
          telegramId,
          // Telegram imzalı oturum: sunucu iptal isteğinin sipariş sahibinden geldiğini doğrular
          initData: (window as any).Telegram?.WebApp?.initData || "",
        }),
      });
      const data = await res.json();
      onCancelPending?.(id, false);
      if (data.success) {
        haptic.success();
        onOrderUpdated();
        appAlert(data.message || "Numara iptal edildi ve ücret bakiyenize iade edildi.", { tone: "success", title: "İptal edildi" });
      } else {
        appAlert(data.error || "İptal edilemedi", { tone: "warning", title: "İptal edilemedi" });
      }
    } catch (e) {
      onCancelPending?.(id, false);
      appAlert("Bağlantı hatası oluştu, lütfen tekrar deneyin.", { tone: "error" });
    } finally {
      setCancellingId(null);
    }
  };

  const handleComplete = async (id: string) => {
    setCompletingId(id);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/sms/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationId: id }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        onOrderUpdated();
      }
    } catch (e) {
      appAlert("Hata oluştu");
    } finally {
      setCompletingId(null);
    }
  };

  const formatRemaining = (expiresAt: number) => {
    const remainingMs = Math.max(0, expiresAt - now);
    const totalSec = Math.floor(remainingMs / 1000);
    if (totalSec >= 3600) {
      // Kiralık numaralar: gün/saat/dakika
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const min = Math.floor((totalSec % 3600) / 60);
      return d > 0 ? `${d}g ${h}sa ${min}dk` : `${h}sa ${min}dk`;
    }
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!orders || orders.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-brand" />
          <span>Aktif Numaralarınız ({orders.length})</span>
        </h3>
        <span className="text-[11px] text-muted-foreground">Canlı Takip</span>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const isReceived = order.status === "RECEIVED" && Boolean(order.smsCode);
          const isCancelled = order.status === "CANCELLED";
          const isCompleted = order.status === "COMPLETED";
          const remainingText = formatRemaining(order.expiresAt);
          const rent = isRent(order);
          const msgs = rentMessages[order.id] || [];
          const rentCancelLeftMs = rent ? Math.max(0, order.createdAt + RENT_FREE_CANCEL_MS - now) : 0;
          const canCancel = !isReceived && !isCancelled && !isCompleted && (!rent || rentCancelLeftMs > 0);
          const earlyCancelLeftMs = rent ? 0 : Math.max(0, order.createdAt + EARLY_CANCEL_MS - now);

          return (
            <Card
              key={order.id}
              className={`p-4 border transition-all ${
                isReceived
                  ? "border-brand/60 bg-gradient-to-b from-card to-card shadow-xl"
                  : "border-border"
              }`}
            >
              {/* Header: Service, Country, Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative shrink-0">
                    <ServiceIcon code={order.serviceCode} name={order.serviceName} size="lg" />
                    <span className="absolute -bottom-1.5 -right-1.5 text-sm leading-none">{order.countryFlag || "🌐"}</span>
                  </span>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      {order.serviceName}
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      {order.countryName}
                      {rent && order.rentHours ? ` · ${order.rentHours % 24 === 0 ? `${order.rentHours / 24} gün` : `${order.rentHours} saat`} kiralık` : rent ? " · kiralık" : ""}
                    </span>
                  </div>
                </div>

                <div>
                  {rent && (isReceived || order.status === "WAIT_CODE") ? (
                    <Badge color={isReceived ? "emerald" : "amber"} hasPing={!isReceived} size="sm">
                      {isReceived ? `Kiralık · ${Math.max(msgs.length, 1)} SMS` : "Kiralık · SMS bekleniyor"}
                    </Badge>
                  ) : isReceived ? (
                    <Badge color="emerald" hasPing={false} size="sm">
                      <Check className="w-3 h-3 mr-1" /> SMS Alındı
                    </Badge>
                  ) : isCancelled ? (
                    <Badge color="rose" size="sm">
                      İptal Edildi
                    </Badge>
                  ) : isCompleted ? (
                    <Badge color="blue" size="sm">
                      Tamamlandı
                    </Badge>
                  ) : (
                    <Badge color="amber" hasPing={true} size="sm">
                      SMS Bekleniyor
                    </Badge>
                  )}
                </div>
              </div>

              {/* Number Row */}
              <div className="mt-3.5 flex items-center justify-between bg-card/90 border border-border rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-base font-semibold text-foreground tracking-wide">
                    {order.phoneNumber}
                  </span>
                </div>

                <CopyButton
                  value={order.phoneNumber}
                  label="Kopyala"
                  className="h-8 px-3 bg-muted hover:bg-input text-xs text-foreground/80 font-medium data-[copied=true]:text-brand"
                />
              </div>

              {/* SMS Code Box */}
              <div className="mt-3">
                {rent && msgs.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                    {msgs.map((m, i) => (
                      <div
                        key={`${m.date}-${i}`}
                        className={`p-3 rounded-xl border ${i === 0 ? "bg-brand/15 border-brand/50" : "bg-card/60 border-border"}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <span className="truncate">{m.from || "Gönderen"}</span>
                          <span className="shrink-0 font-mono">
                            {m.date ? new Date(m.date).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        {m.code && (
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className={`font-mono font-semibold tracking-wider ${i === 0 ? "text-2xl text-brand" : "text-lg text-foreground"}`}>
                              {m.code}
                            </span>
                            <CopyButton
                              value={m.code}
                              label="Kopyala"
                              copiedLabel="Kopyalandı!"
                              className="h-8 px-3 bg-foreground text-background hover:bg-foreground/85 text-xs font-semibold"
                            />
                          </div>
                        )}
                        {m.text && <p className="mt-1 text-[11px] text-foreground/80 break-words">{m.text}</p>}
                      </div>
                    ))}
                  </div>
                ) : rent && isReceived ? (
                  <div className="p-3.5 rounded-xl bg-brand/15 border border-brand/50">
                    <span className="text-[11px] text-brand font-medium flex items-center gap-1">
                      <BellRing className="w-3.5 h-3.5" /> Son gelen SMS:
                    </span>
                    {order.smsCode && order.smsCode !== "SMS" && (
                      <div className="font-mono text-2xl font-semibold text-brand tracking-wider mt-0.5">{order.smsCode}</div>
                    )}
                    {order.smsText && <p className="mt-1 text-[11px] text-foreground/80 break-words">{order.smsText}</p>}
                  </div>
                ) : rent ? (
                  <div className="p-3 rounded-xl bg-card/60 border border-dashed border-border flex items-center justify-center gap-2 text-xs text-muted-foreground animate-soft-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
                    </span>
                    <span>Kiralama süresince gelen tüm SMS'ler burada listelenir...</span>
                  </div>
                ) : isReceived ? (
                  <div className="p-3.5 rounded-xl bg-brand/15 border border-brand/50 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-brand font-medium flex items-center gap-1">
                        <BellRing className="w-3.5 h-3.5" /> Gelen SMS Doğrulama Kodu:
                      </span>
                      <div className="font-mono text-2xl font-semibold text-brand tracking-wider mt-0.5">
                        {order.smsCode}
                      </div>
                    </div>

                    <CopyButton
                      value={order.smsCode!}
                      label="Kopyala"
                      copiedLabel="Kopyalandı!"
                      className="h-9 px-3.5 bg-foreground text-background hover:bg-foreground/85 text-xs font-semibold"
                    />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-card/60 border border-dashed border-border flex items-center justify-center gap-2 text-xs text-muted-foreground animate-soft-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
                    </span>
                    <span>SMS kodu bekleniyor, geldiğinde buraya düşecektir...</span>
                  </div>
                )}
              </div>

              {/* Footer: Countdown & Actions */}
              <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono font-medium text-foreground/80">{remainingText}</span>
                  <span className="text-[11px]">{rent ? "kiralama bitişine" : "kaldı"}</span>
                </div>

                <div className="flex items-center gap-2">
                  {canCancel && (
                    <button
                      onClick={() => handleCancel(order.id, rent)}
                      disabled={cancellingId === order.id || earlyCancelLeftMs > 0}
                      title={earlyCancelLeftMs > 0 ? "Numara alındıktan sonraki ilk 2 dakika iptal edilemez" : undefined}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-medium text-xs active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      {cancellingId === order.id
                        ? "İptal Ediliyor..."
                        : earlyCancelLeftMs > 0
                        ? `İptal ${formatRemaining(order.createdAt + EARLY_CANCEL_MS)} sonra`
                        : rent
                        ? `İptal & İade (${formatRemaining(order.createdAt + RENT_FREE_CANCEL_MS)})`
                        : "İptal Et & İade Al"}
                    </button>
                  )}

                  {isReceived && !isCompleted && !rent && (
                    <button
                      onClick={() => handleComplete(order.id)}
                      disabled={completingId === order.id}
                      className="px-3.5 py-1.5 rounded-lg bg-foreground hover:bg-foreground/85 text-background font-semibold text-xs shadow-md active:scale-95 transition-all"
                    >
                      {completingId === order.id ? "Tamamlanıyor..." : "Tamamla"}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
