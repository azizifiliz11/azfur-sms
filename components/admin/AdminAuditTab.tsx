"use client";

import React from "react";
import { ShieldCheck, RefreshCw, Loader2, Search } from "lucide-react";
import { Card } from "../tremor/Card";
import { Badge } from "../tremor/Badge";
import { adminApi, fmtDate } from "./api";

interface AuditEntry {
  id: string;
  at: string;
  actorId: number | null;
  actorLabel: string;
  area: string;
  action: string;
  targetId: number | null;
  details: string;
}

const AREA_LABELS: Record<string, string> = {
  users: "Kullanıcı", deposits: "Ödeme", settings: "Ayarlar", coupons: "Kupon", broadcast: "Duyuru",
  backups: "Yedek", tickets: "Destek", orders: "Sipariş", logs: "Loglar", overview: "Genel",
};

/** Yönetici işlem kaydı: silinemez, yalnızca eklenir (lib/admin-audit.ts). */
export function AdminAuditTab() {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [targetId, setTargetId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (target = targetId) => {
    setLoading(true);
    setError(null);
    const t = target.trim();
    const d = await adminApi<{ data: AuditEntry[] }>(`/api/admin/reports?type=audit&limit=200${t ? `&targetId=${encodeURIComponent(t)}` : ""}`);
    setLoading(false);
    if (d.success) setEntries(d.data || []);
    else setError(d.error || "Kayıt okunamadı");
  }, [targetId]);

  React.useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <Card className="p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4" /> Yönetici işlem kaydı
          </h3>
          <button type="button" onClick={() => load()} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted" aria-label="Yenile">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Hangi yöneticinin ne zaman ne yaptığı (bakiye değişikliği, ödeme onayı, ayar, kupon, duyuru, yedek, sipariş iadesi…). Bu kayıt sistem
          loglarından ayrıdır ve panelden silinemez. Gizli anahtarlar kayda girmez.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="Etkilenen kullanıcının Telegram ID'si (isteğe bağlı)"
              className="h-9 w-full rounded-full border border-border bg-muted pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-brand focus:outline-none"
            />
          </div>
          <button type="submit" className="h-9 rounded-full bg-foreground px-4 text-xs font-medium text-background">
            Filtrele
          </button>
        </form>
      </Card>

      {error && <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-400">{error}</div>}

      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
        </div>
      ) : entries.length === 0 ? (
        <Card className="p-6 text-center text-xs text-muted-foreground">Kayıt yok.</Card>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-3xl p-3 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{e.actorLabel}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtDate(e.at)}
                    {e.targetId ? ` · hedef ID ${e.targetId}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge color="zinc" size="sm">{AREA_LABELS[e.area] || e.area}</Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">{e.action}</span>
                </div>
              </div>
              <p className="mt-1.5 break-words font-mono text-[10px] leading-relaxed text-muted-foreground">{e.details}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
