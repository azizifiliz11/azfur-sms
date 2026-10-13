"use client";

import React from "react";
import { CalendarClock, RotateCcw } from "lucide-react";
import { Card } from "../tremor/Card";
import { haptic } from "@/lib/haptic";
import { adminApi } from "./api";

interface Duration {
  hours: number;
  label: string;
  stock: number;
  priceTry: number;
  costUsd: number;
}

interface Offer {
  countryId: number;
  countryName: string;
  flag: string;
  durations: Duration[];
}

interface PreviewResponse {
  rentPricing: { marginPercent: number; fixedFee: number; updatedAt?: string } | null;
  effective: { marginPercent: number; fixedFee: number; source: "rent" | "service" | "global" };
  global: { marginPercent: number; fixedFee: number };
  rate: number;
  offers: Offer[];
}

const SOURCE_LABEL: Record<PreviewResponse["effective"]["source"], string> = {
  rent: "Full rent'e özel marj",
  service: "\"full\" servis marjı",
  global: "Genel kâr marjı",
};

/** Sunucudaki lib/rent.ts computeRentPrice ile aynı yuvarlama (önizleme için) */
function computePrice(costUsd: number, margin: number, fee: number, rate: number) {
  const price = costUsd * rate * (1 + margin / 100) + fee;
  return Math.max(3, Math.ceil(price * 10) / 10);
}

/**
 * Full rent (süreli numara kiralama) kâr marjı. Kiralama maliyetleri SMS aktivasyonlarından çok yüksek
 * olduğu için genel marjdan ayrı ayarlanır; değişiklik kaydedilince Mini App fiyatları hemen güncellenir.
 */
export function RentPricingCard() {
  const [data, setData] = React.useState<PreviewResponse | null>(null);
  const [margin, setMargin] = React.useState<string>("");
  const [fee, setFee] = React.useState<string>("0");
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<{ text: string; error?: boolean } | null>(null);

  const apply = (d: PreviewResponse) => {
    setData(d);
    setMargin(String(d.effective.marginPercent));
    setFee(String(d.effective.fixedFee));
  };

  React.useEffect(() => {
    adminApi<PreviewResponse>("/api/admin/settings", { action: "rent_pricing_preview" }).then((d) => {
      if (d.success) apply(d);
      else setToast({ text: d.error || "Kiralama fiyatları yüklenemedi.", error: true });
    });
  }, []);

  const flash = (text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 3500);
  };

  const save = async (reset = false) => {
    if (!reset && (margin.trim() === "" || !Number.isFinite(Number(margin)))) {
      flash("Geçerli bir marj girin.", true);
      return;
    }
    setBusy(true);
    haptic.impact("medium");
    const d = await adminApi<PreviewResponse>("/api/admin/settings", {
      action: "save_rent_pricing",
      reset,
      marginPercent: Number(margin),
      fixedFee: Number(fee || 0),
    });
    setBusy(false);
    if (d.success) {
      haptic.success();
      apply(d);
      flash(reset ? "Özel marj kaldırıldı; kiralamada genel marj geçerli." : "Full rent kâr marjı kaydedildi.");
    } else {
      haptic.error();
      flash(d.error || "Kaydedilemedi.", true);
    }
  };

  const m = Number(margin);
  const f = Number(fee || 0);
  const valid = Number.isFinite(m) && Number.isFinite(f);
  const dirty =
    data !== null && valid && (m !== data.effective.marginPercent || f !== data.effective.fixedFee);

  const rows = (data?.offers || []).flatMap((o) =>
    o.durations.map((d) => {
      const cost = d.costUsd * (data?.rate || 0);
      const price = valid ? computePrice(d.costUsd, m, f, data?.rate || 0) : d.priceTry;
      return { key: `${o.countryId}-${d.hours}`, flag: o.flag, country: o.countryName, label: d.label, stock: d.stock, cost, price };
    })
  );

  return (
    <Card className="p-4 space-y-4 border-brand/30">
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-brand" />
            <span>Full rent Kâr Marjı</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Süreli numara kiralama fiyatları genel marjdan ayrı hesaplanır.
          </p>
        </div>
        {data && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground shrink-0">
            {SOURCE_LABEL[data.effective.source]}
          </span>
        )}
      </div>

      {!data ? (
        <p className="text-xs text-muted-foreground">Yükleniyor...</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-foreground/80 font-medium">Kiralama Kâr Marjı:</span>
              <span className="font-mono font-semibold text-brand">%{valid ? m : "—"}</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="300"
                step="5"
                value={Number.isFinite(m) ? Math.min(m, 300) : 0}
                onChange={(e) => setMargin(e.target.value)}
                className="w-full accent-brand h-2 bg-muted rounded-lg cursor-pointer"
              />
              <input
                type="number"
                min="0"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                className="w-20 bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono text-foreground text-center"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-foreground/80 font-medium">Sabit Ek Ücret (₺):</span>
              <span className="font-mono font-semibold text-brand">₺{valid ? f.toFixed(2) : "—"}</span>
            </div>
            <input
              type="number"
              min="0"
              step="5"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Genel marj: %{data.global.marginPercent} + ₺{Number(data.global.fixedFee).toFixed(2)} · Kur: ₺{data.rate.toFixed(4)}
          </p>

          {/* Canlı önizleme */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 bg-muted/50 text-[10px] font-medium text-muted-foreground">
              <span>Ülke · Süre</span>
              <span className="text-right">Maliyet</span>
              <span className="text-right">Satış</span>
              <span className="text-right">Kâr</span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-border">
              {rows.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">Şu anda kiralık numara yok.</p>}
              {rows.map((r) => (
                <div key={r.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 text-[11px] items-center">
                  <span className="truncate text-foreground/90">
                    {r.flag} {r.country} · {r.label} <span className="text-muted-foreground">({r.stock})</span>
                  </span>
                  <span className="text-right font-mono text-muted-foreground">₺{r.cost.toFixed(0)}</span>
                  <span className="text-right font-mono font-semibold text-foreground">₺{r.price.toFixed(2)}</span>
                  <span className={`text-right font-mono ${r.price - r.cost >= 0 ? "text-brand" : "text-rose-400"}`}>
                    ₺{(r.price - r.cost).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {toast && (
            <p className={`text-[11px] ${toast.error ? "text-rose-400" : "text-brand"}`}>{toast.text}</p>
          )}

          <div className="flex gap-2">
            {data.rentPricing && (
              <button
                type="button"
                onClick={() => save(true)}
                disabled={busy}
                className="h-10 px-3 rounded-xl border border-border text-xs font-medium text-foreground/80 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Genel marja dön
              </button>
            )}
            <button
              type="button"
              onClick={() => save(false)}
              disabled={busy || !valid || (!dirty && data.effective.source === "rent")}
              className="h-10 flex-1 rounded-xl bg-foreground text-background font-semibold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {busy ? "Kaydediliyor..." : "Full rent Marjını Kaydet"}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
