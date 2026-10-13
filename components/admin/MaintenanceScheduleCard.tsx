"use client";

import React from "react";
import { CalendarClock, X } from "lucide-react";
import { Card } from "../tremor/Card";
import { HaloSwitch } from "@/components/ui/halo-switch";
import { haptic } from "@/lib/haptic";
import { appConfirm } from "@/lib/app-dialog";
import { adminApi, fmtDate } from "./api";

interface Plan {
  startAt: string;
  endAt: string;
  message?: string;
  enabledBySchedule?: boolean;
}

/** Datetime-local giriş değeri (yöneticinin cihaz saati) */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Planlı bakım: başlangıç/bitişte bakım modu kendiliğinden açılıp kapanır; isteğe bağlı kullanıcı duyurusu. */
export function MaintenanceScheduleCard() {
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [startAt, setStartAt] = React.useState(() => toLocalInput(new Date(Date.now() + 3600 * 1000)));
  const [endAt, setEndAt] = React.useState(() => toLocalInput(new Date(Date.now() + 2 * 3600 * 1000)));
  const [message, setMessage] = React.useState("");
  const [announce, setAnnounce] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<{ text: string; error?: boolean } | null>(null);

  const load = React.useCallback(async () => {
    const d = await adminApi<{ settings: any }>("/api/admin/settings");
    if (d.success) setPlan(d.settings?.maintenanceSchedule || null);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const flash = (text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 4500);
  };

  const save = async () => {
    haptic.impact("medium");
    setBusy(true);
    const d = await adminApi<{ settings: any }>("/api/admin/settings", {
      action: "schedule_maintenance",
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      message,
      announce,
    });
    setBusy(false);
    if (d.success) {
      setPlan(d.settings?.maintenanceSchedule || null);
      flash(d.message || "Planlandı");
    } else flash(d.error || "Planlanamadı", true);
  };

  const cancel = async () => {
    if (!await appConfirm("Bakım planı iptal edilsin mi?")) return;
    setBusy(true);
    const d = await adminApi("/api/admin/settings", { action: "cancel_maintenance_schedule" });
    setBusy(false);
    if (d.success) {
      setPlan(null);
      flash(d.message || "İptal edildi");
    } else flash(d.error || "İptal edilemedi", true);
  };

  return (
    <Card className="p-3.5 space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <CalendarClock className="h-4 w-4" /> Planlı bakım
      </h3>

      {plan ? (
        <div className="flex items-start justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
          <div className="text-xs text-foreground">
            <p>
              <span className="text-muted-foreground">Başlangıç:</span> {fmtDate(plan.startAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Bitiş:</span> {fmtDate(plan.endAt)}
            </p>
            {plan.enabledBySchedule && <p className="mt-1 text-[11px] text-amber-400">Bakım şu an bu plan nedeniyle açık.</p>}
          </div>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs text-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" /> İptal
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Planlanmış bakım yok.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[11px] text-muted-foreground">
          Başlangıç
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-muted px-2 text-xs text-foreground"
          />
        </label>
        <label className="space-y-1 text-[11px] text-muted-foreground">
          Bitiş
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-muted px-2 text-xs text-foreground"
          />
        </label>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder="Bakım mesajı (isteğe bağlı; bakım ekranında ve duyuruda gösterilir)"
        className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-brand focus:outline-none"
      />
      <label className="flex items-center justify-between gap-3 text-xs text-foreground">
        Kullanıcılara şimdi duyuru gönder
        <HaloSwitch checked={announce} onCheckedChange={setAnnounce} aria-label="Duyuru gönder" />
      </label>
      {toast && (
        <div className={`rounded-2xl border px-3 py-2 text-xs ${toast.error ? "border-rose-500/40 bg-rose-500/10 text-rose-400" : "border-brand/40 bg-brand/10 text-brand"}`}>
          {toast.text}
        </div>
      )}
      <button type="button" onClick={save} disabled={busy} className="h-9 w-full rounded-full bg-foreground text-xs font-medium text-background disabled:opacity-60">
        {busy ? "Kaydediliyor..." : plan ? "Planı güncelle" : "Bakımı planla"}
      </button>
      <p className="text-[10px] text-muted-foreground">
        Bakım modu belirtilen saatlerde kendiliğinden açılıp kapanır (birkaç dakika gecikebilir). Duyurular, duyuruları kapatan kullanıcılara gitmez.
      </p>
    </Card>
  );
}
