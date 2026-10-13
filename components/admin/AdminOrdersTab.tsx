"use client";

import React from "react";
import { Search, RefreshCw, RotateCcw, Undo2, Loader2, Smartphone } from "lucide-react";
import { Card } from "../tremor/Card";
import { Badge } from "../tremor/Badge";
import { CopyButton } from "@/components/ui/copy-button";
import { ServiceIcon } from "../ServiceIcon";
import { haptic } from "@/lib/haptic";
import { appConfirm, appPrompt } from "@/lib/app-dialog";
import { adminApi, fmtDate, tryFmt } from "./api";

type Filter = "waiting" | "received" | "completed" | "refunded" | "all";

interface AdminOrder {
  id: string;
  telegramId: number;
  username: string;
  userFullName: string;
  serviceCode?: string;
  serviceName: string;
  countryName: string;
  countryFlag: string;
  phoneNumber: string;
  chargedPrice: number;
  status: "WAIT_CODE" | "RECEIVED" | "COMPLETED" | "CANCELLED" | "TIMEOUT";
  smsCode: string | null;
  createdAt: number;
  expiresAt: number;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "waiting", label: "Kod bekleyen" },
  { id: "received", label: "Kod alındı" },
  { id: "completed", label: "Tamamlanan" },
  { id: "refunded", label: "İade edilen" },
  { id: "all", label: "Hepsi" },
];

const STATUS: Record<AdminOrder["status"], { label: string; color: "amber" | "emerald" | "zinc" | "rose" }> = {
  WAIT_CODE: { label: "Kod bekleniyor", color: "amber" },
  RECEIVED: { label: "Kod alındı", color: "emerald" },
  COMPLETED: { label: "Tamamlandı", color: "zinc" },
  CANCELLED: { label: "İptal · iade", color: "rose" },
  TIMEOUT: { label: "Süre doldu · iade", color: "rose" },
};

export function AdminOrdersTab() {
  const [filter, setFilter] = React.useState<Filter>("waiting");
  const [query, setQuery] = React.useState("");
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ text: string; error?: boolean } | null>(null);

  const load = React.useCallback(async (f: Filter = filter, q: string = query) => {
    setLoading(true);
    const data = await adminApi<{ orders: AdminOrder[] }>(`/api/admin/orders?filter=${f}&q=${encodeURIComponent(q)}&limit=150`);
    setLoading(false);
    if (data.success) setOrders(data.orders || []);
    else setToast({ text: data.error || "Siparişler yüklenemedi", error: true });
  }, [filter, query]);

  React.useEffect(() => {
    load(filter, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const act = async (order: AdminOrder, action: "sync" | "cancel_refund" | "manual_refund") => {
    let reason = "";
    if (action === "cancel_refund" && !await appConfirm(`${order.phoneNumber} numaralı sipariş sağlayıcıda iptal edilip ₺${order.chargedPrice.toFixed(2)} iade edilsin mi?`)) return;
    if (action === "manual_refund") {
      const r = await appPrompt(`Kodu gelmiş siparişe ₺${order.chargedPrice.toFixed(2)} elle iade edilecek. Kullanıcıya gidecek açıklama (isteğe bağlı):`, "");
      if (r === null) return;
      reason = r;
    }
    haptic.impact("medium");
    setBusyId(order.id);
    const data = await adminApi("/api/admin/orders", { action, orderId: order.id, reason });
    setBusyId(null);
    setToast({ text: data.success ? data.message || "Tamam" : data.error || "İşlem başarısız", error: !data.success });
    if (data.success) load();
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-3">
      <Card className="p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Smartphone className="h-4 w-4" /> Siparişler
          </h3>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted"
            aria-label="Yenile"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                haptic.selection();
                setFilter(f.id);
              }}
              className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${
                filter === f.id ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(filter, query);
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Numara, Telegram ID, sipariş no veya servis"
              className="h-9 w-full rounded-full border border-border bg-muted pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-brand focus:outline-none"
            />
          </div>
          <button type="submit" className="h-9 rounded-full bg-foreground px-4 text-xs font-medium text-background">
            Ara
          </button>
        </form>
      </Card>

      {toast && (
        <div className={`rounded-2xl border px-3.5 py-2.5 text-xs ${toast.error ? "border-rose-500/40 bg-rose-500/10 text-rose-400" : "border-brand/40 bg-brand/10 text-brand"}`}>
          {toast.text}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-6 text-center text-xs text-muted-foreground">Bu filtrede sipariş yok.</Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const st = STATUS[o.status] || STATUS.WAIT_CODE;
            const busy = busyId === o.id;
            return (
              <Card key={o.id} className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
                      <ServiceIcon code={o.serviceCode} name={o.serviceName} size="sm" />
                      <span className="truncate">
                        {o.countryFlag} {o.serviceName} <span className="text-muted-foreground">· {o.countryName}</span>
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {o.userFullName || "Kullanıcı"}
                      {o.username ? ` (@${o.username})` : ""} · ID <span className="font-mono">{o.telegramId}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground/80">
                      {fmtDate(o.createdAt)} · #{o.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-xs text-foreground">{tryFmt(o.chargedPrice)}</span>
                    <Badge color={st.color} size="sm">{st.label}</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-2xl border border-border px-3 py-1.5">
                  <span className="truncate font-mono text-[13px] text-foreground">{o.phoneNumber || "—"}</span>
                  {o.smsCode ? (
                    <span className="flex items-center gap-1 font-mono text-sm text-brand">
                      {o.smsCode}
                      <CopyButton value={o.smsCode} className="h-7 w-7 text-brand hover:bg-brand/15" />
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">kod yok</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(o.status === "WAIT_CODE" || o.status === "RECEIVED") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(o, "sync")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Sağlayıcıdan kontrol et
                    </button>
                  )}
                  {o.status === "WAIT_CODE" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(o, "cancel_refund")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose-500/40 px-3 text-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> İptal & iade
                    </button>
                  )}
                  {(o.status === "RECEIVED" || o.status === "COMPLETED") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(o, "manual_refund")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber-500/40 px-3 text-xs text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Elle iade
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
