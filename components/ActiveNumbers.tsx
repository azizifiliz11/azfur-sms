"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, XCircle, CheckCircle2, Clock, Smartphone, BellRing } from "lucide-react";
import { ActivationOrder } from "@/lib/types";
import { haptic } from "@/lib/haptic";
import { Card } from "./tremor/Card";
import { Badge } from "./tremor/Badge";

interface ActiveNumbersProps {
  orders: ActivationOrder[];
  onOrderUpdated: () => void;
  telegramId: number;
}

export function ActiveNumbers({ orders, onOrderUpdated, telegramId }: ActiveNumbersProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Per-second timer update
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll status for active orders every 3.5 seconds
  useEffect(() => {
    const waitingOrders = orders.filter((o) => o.status === "WAIT_CODE");
    if (waitingOrders.length === 0) return;

    const interval = setInterval(async () => {
      let anyChanged = false;

      for (const order of waitingOrders) {
        try {
          const res = await fetch(`/api/sms/status?id=${order.id}`);
          const data = await res.json();
          if (data.success && data.order?.status === "RECEIVED") {
            haptic.success();
            anyChanged = true;
          }
        } catch (e) {
          // ignore
        }
      }

      if (anyChanged) {
        onOrderUpdated();
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [orders, onOrderUpdated]);

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    haptic.success();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    haptic.success();
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Numarayı iptal etmek ve ödediğiniz tutarı bakiyenize iade almak istiyor musunuz?")) {
      return;
    }

    setCancellingId(id);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/sms/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationId: id, telegramId }),
      });
      const data = await res.json();
      if (data.success) {
        haptic.success();
        onOrderUpdated();
      } else {
        alert(data.error || "İptal edilemedi");
      }
    } catch (e) {
      alert("Hata oluştu");
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
      alert("Hata oluştu");
    } finally {
      setCompletingId(null);
    }
  };

  const formatRemaining = (expiresAt: number) => {
    const remainingMs = Math.max(0, expiresAt - now);
    const totalSec = Math.floor(remainingMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!orders || orders.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Aktif Numaralarınız ({orders.length})</span>
        </h3>
        <span className="text-[11px] text-zinc-400">Canlı Takip</span>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const isReceived = order.status === "RECEIVED" && Boolean(order.smsCode);
          const isCancelled = order.status === "CANCELLED";
          const isCompleted = order.status === "COMPLETED";
          const remainingText = formatRemaining(order.expiresAt);

          return (
            <Card
              key={order.id}
              className={`p-4 border transition-all ${
                isReceived
                  ? "border-emerald-500/60 bg-gradient-to-b from-[#0f1715] to-[#0c0e15] shadow-emerald-950/20 shadow-xl"
                  : "border-white/10"
              }`}
            >
              {/* Header: Service, Country, Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{order.countryFlag || "🌐"}</span>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                      {order.serviceName}
                    </h4>
                    <span className="text-[11px] text-zinc-400">{order.countryName}</span>
                  </div>
                </div>

                <div>
                  {isReceived ? (
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
              <div className="mt-3.5 flex items-center justify-between bg-zinc-900/90 border border-white/10 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-zinc-400" />
                  <span className="font-mono text-base font-bold text-white tracking-wide">
                    {order.phoneNumber}
                  </span>
                </div>

                <button
                  onClick={() => handleCopyPhone(order.id, order.phoneNumber)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition-colors"
                >
                  {copiedId === order.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Kopyalandı</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopyala</span>
                    </>
                  )}
                </button>
              </div>

              {/* SMS Code Box */}
              <div className="mt-3">
                {isReceived ? (
                  <div
                    onClick={() => handleCopyCode(order.id, order.smsCode!)}
                    className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/50 flex items-center justify-between cursor-pointer hover:bg-emerald-500/20 active:scale-[0.99] transition-all"
                  >
                    <div>
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <BellRing className="w-3.5 h-3.5" /> Gelen SMS Doğrulama Kodu:
                      </span>
                      <div className="font-mono text-2xl font-black text-emerald-300 tracking-wider mt-0.5">
                        {order.smsCode}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold shadow-md shadow-emerald-500/20">
                      {copiedCodeId === order.id ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Kopyalandı!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-dashed border-white/10 flex items-center justify-center gap-2 text-xs text-zinc-400 animate-soft-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span>SMS kodu bekleniyor, geldiğinde buraya düşecektir...</span>
                  </div>
                )}
              </div>

              {/* Footer: Countdown & Actions */}
              <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono font-semibold text-zinc-300">{remainingText}</span>
                  <span className="text-[11px]">kaldı</span>
                </div>

                <div className="flex items-center gap-2">
                  {!isReceived && !isCancelled && !isCompleted && (
                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={cancellingId === order.id}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs active:scale-95 transition-all"
                    >
                      {cancellingId === order.id ? "İptal Ediliyor..." : "İptal Et & İade Al"}
                    </button>
                  )}

                  {isReceived && !isCompleted && (
                    <button
                      onClick={() => handleComplete(order.id)}
                      disabled={completingId === order.id}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
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
