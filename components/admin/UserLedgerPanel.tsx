"use client";

import React from "react";
import { Loader2, History } from "lucide-react";
import { adminApi, fmtDate } from "./api";

interface LedgerEntry {
  at: string;
  type: "deposit" | "deposit_pending" | "deposit_rejected" | "order" | "refund" | "coupon" | "admin";
  amount: number;
  title: string;
  detail: string;
}

const TYPE_DOT: Record<LedgerEntry["type"], string> = {
  deposit: "bg-brand",
  deposit_pending: "bg-amber-400",
  deposit_rejected: "bg-muted-foreground",
  order: "bg-foreground/60",
  refund: "bg-brand",
  coupon: "bg-brand",
  admin: "bg-amber-400",
};

/** Kullanıcının tüm bakiye hareketleri tek zaman çizelgesinde (yükleme, harcama, iade, kupon, yönetici düzeltmesi). */
export function UserLedgerPanel({ telegramId }: { telegramId: number }) {
  const [entries, setEntries] = React.useState<LedgerEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    adminApi<{ data: LedgerEntry[] }>(`/api/admin/reports?type=ledger&telegramId=${telegramId}`).then((d) => {
      if (cancelled) return;
      if (d.success) setEntries(d.data || []);
      else setError(d.error || "Hareketler okunamadı");
    });
    return () => {
      cancelled = true;
    };
  }, [telegramId]);

  const totals = (entries || []).reduce(
    (acc, e) => {
      if (e.amount > 0) acc.in += e.amount;
      else acc.out += -e.amount;
      return acc;
    },
    { in: 0, out: 0 }
  );

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <History className="h-3.5 w-3.5" /> Bakiye hareketleri
      </h4>
      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : !entries ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Yükleniyor...
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Hareket yok.</p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Giren <span className="font-mono text-brand">+₺{totals.in.toFixed(2)}</span> · Çıkan{" "}
            <span className="font-mono text-foreground">−₺{totals.out.toFixed(2)}</span> · Fark{" "}
            <span className="font-mono text-foreground">₺{(totals.in - totals.out).toFixed(2)}</span>
          </p>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-2xl border border-border">
            {entries.map((e, i) => (
              <li key={i} className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="flex min-w-0 gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[e.type]}`} />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-foreground">{e.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{e.detail}</p>
                    <p className="text-[10px] text-muted-foreground/80">{fmtDate(e.at)}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 font-mono text-xs ${e.amount > 0 ? "text-brand" : e.amount < 0 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {e.amount > 0 ? "+" : e.amount < 0 ? "−" : ""}₺{Math.abs(e.amount).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground">
            Siparişler ve ödemeler tüm geçmişi kapsar; kupon ve yönetici düzeltmeleri bu sürümden itibaren kayda girer.
          </p>
        </>
      )}
    </div>
  );
}
