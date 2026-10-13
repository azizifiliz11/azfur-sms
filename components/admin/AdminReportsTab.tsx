"use client";

import React from "react";
import { RefreshCw, Scale, TrendingUp, BellRing, AlertTriangle, Loader2, EyeOff, Eye, CalendarClock } from "lucide-react";
import { Card } from "../tremor/Card";
import { Badge } from "../tremor/Badge";
import { HaloSwitch } from "@/components/ui/halo-switch";
import { ServiceIcon } from "../ServiceIcon";
import { haptic } from "@/lib/haptic";
import { adminApi, fmtDate, tryFmt } from "./api";

interface Reconciliation {
  exchangeRate: number;
  totalUserBalance: number;
  holders: number;
  pendingOrdersTry: number;
  pendingOrders: number;
  heroUsd: number | null;
  heroTry: number | null;
  apirone: { ok: boolean; items: { currency: string; label: string; available: number; total: number }[]; error?: string };
  warnings: string[];
  generatedAt: string;
}

interface Summary {
  orders: number;
  succeeded: number;
  refunded: number;
  revenue: number;
  profit: number;
  deposits: number;
  depositCount: number;
  newUsers: number;
  totalUserBalance: number;
}

interface ProfitRow {
  key: string;
  serviceCode?: string;
  serviceName: string;
  countryName: string;
  total: number;
  succeeded: number;
  refunded: number;
  waiting: number;
  revenue: number;
  cost: number;
  profit: number;
  successRate: number | null;
  hidden: boolean;
}

interface AlertSettings {
  enabled: boolean;
  providerBalanceMin: number;
  refundsPerHour: number;
  largeDepositTry: number;
  couponFailsPer10Min: number;
  dailyReportEnabled: boolean;
  dailyReportHour: number;
}

const DEFAULT_ALERTS: AlertSettings = {
  enabled: true,
  providerBalanceMin: 5,
  refundsPerHour: 5,
  largeDepositTry: 2000,
  couponFailsPer10Min: 5,
  dailyReportEnabled: true,
  dailyReportHour: 9,
};

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "brand" | "warn" }) {
  return (
    <div className="border-b border-r border-border px-2 py-2.5 text-center">
      <span className={`block font-mono text-sm font-medium ${tone === "brand" ? "text-brand" : tone === "warn" ? "text-amber-400" : "text-foreground"}`}>
        {value}
      </span>
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      {sub && <span className="block text-[10px] text-muted-foreground/80">{sub}</span>}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      {action}
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-xl border border-border bg-muted px-3 text-xs text-foreground focus:border-brand focus:outline-none";

export function AdminReportsTab() {
  const [recon, setRecon] = React.useState<Reconciliation | null>(null);
  const [reconLoading, setReconLoading] = React.useState(false);
  const [summaryHours, setSummaryHours] = React.useState(24);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [profitDays, setProfitDays] = React.useState(30);
  const [profit, setProfit] = React.useState<{ rows: ProfitRow[]; totals: any } | null>(null);
  const [profitLoading, setProfitLoading] = React.useState(false);
  const [onlyProblems, setOnlyProblems] = React.useState(false);
  const [alerts, setAlerts] = React.useState<AlertSettings>(DEFAULT_ALERTS);
  const [savingAlerts, setSavingAlerts] = React.useState(false);
  const [toast, setToast] = React.useState<{ text: string; error?: boolean } | null>(null);

  const flash = (text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 4000);
  };

  const loadRecon = React.useCallback(async () => {
    setReconLoading(true);
    const d = await adminApi<{ data: Reconciliation }>("/api/admin/reports?type=reconciliation");
    setReconLoading(false);
    if (d.success) setRecon(d.data);
    else flash(d.error || "Mutabakat alınamadı", true);
  }, []);

  const loadSummary = React.useCallback(async (hours: number) => {
    const d = await adminApi<{ data: Summary }>(`/api/admin/reports?type=summary&hours=${hours}`);
    if (d.success) setSummary(d.data);
  }, []);

  const loadProfit = React.useCallback(async (days: number) => {
    setProfitLoading(true);
    const d = await adminApi<{ data: { rows: ProfitRow[]; totals: any } }>(`/api/admin/reports?type=profit&days=${days}`);
    setProfitLoading(false);
    if (d.success) setProfit(d.data);
  }, []);

  React.useEffect(() => {
    loadRecon();
    adminApi<{ settings: any }>("/api/admin/settings").then((d) => {
      if (d.success && d.settings?.alertSettings) setAlerts({ ...DEFAULT_ALERTS, ...d.settings.alertSettings });
    });
  }, [loadRecon]);
  React.useEffect(() => {
    loadSummary(summaryHours);
  }, [summaryHours, loadSummary]);
  React.useEffect(() => {
    loadProfit(profitDays);
  }, [profitDays, loadProfit]);

  const togglePair = async (row: ProfitRow) => {
    const hide = !row.hidden;
    if (hide && !confirm(`${row.serviceName} · ${row.countryName} satışa kapatılsın mı? Kullanıcılar bu kombinasyonu göremez.`)) return;
    haptic.impact("light");
    const d = await adminApi("/api/admin/settings", { action: "toggle_pair", pair: row.key, hidden: hide });
    if (d.success) {
      setProfit((p) => (p ? { ...p, rows: p.rows.map((r) => (r.key === row.key ? { ...r, hidden: hide } : r)) } : p));
      flash(d.message || "Güncellendi");
    } else flash(d.error || "Güncellenemedi", true);
  };

  const saveAlerts = async () => {
    setSavingAlerts(true);
    const d = await adminApi<{ alertSettings: AlertSettings }>("/api/admin/settings", { action: "save_alert_settings", alertSettings: alerts });
    setSavingAlerts(false);
    if (d.success) {
      setAlerts({ ...DEFAULT_ALERTS, ...d.alertSettings });
      flash(d.message || "Kaydedildi");
    } else flash(d.error || "Kaydedilemedi", true);
  };

  const rows = (profit?.rows || []).filter((r) =>
    onlyProblems ? r.successRate !== null && r.successRate < 60 && r.succeeded + r.refunded >= 3 : true
  );

  return (
    <div className="space-y-3">
      {toast && (
        <div className={`rounded-2xl border px-3.5 py-2.5 text-xs ${toast.error ? "border-rose-500/40 bg-rose-500/10 text-rose-400" : "border-brand/40 bg-brand/10 text-brand"}`}>
          {toast.text}
        </div>
      )}

      {/* Kasa mutabakatı */}
      <Card className="p-3.5 space-y-3">
        <SectionTitle
          icon={Scale}
          title="Kasa mutabakatı"
          action={
            <button type="button" onClick={loadRecon} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted" aria-label="Yenile">
              <RefreshCw className={`h-4 w-4 ${reconLoading ? "animate-spin" : ""}`} />
            </button>
          }
        />
        {!recon ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Hesaplanıyor...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 border-l border-t border-border">
              <Stat label="kullanıcı bakiyeleri (borç)" value={tryFmt(recon.totalUserBalance)} sub={`${recon.holders} kullanıcıda`} />
              <Stat
                label="Hero-SMS kasası"
                value={recon.heroUsd === null ? "okunamadı" : `$${recon.heroUsd.toFixed(2)}`}
                sub={recon.heroTry === null ? undefined : `≈ ${tryFmt(recon.heroTry)}`}
                tone={recon.heroTry !== null && recon.heroTry < recon.totalUserBalance * 0.5 ? "warn" : "brand"}
              />
              <Stat label="kod bekleyen siparişler" value={tryFmt(recon.pendingOrdersTry)} sub={`${recon.pendingOrders} adet (iade olabilir)`} />
              <Stat label="kur" value={`₺${recon.exchangeRate.toFixed(4)}`} sub={fmtDate(recon.generatedAt)} />
            </div>
            <div className="rounded-2xl border border-border px-3 py-2.5">
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Apirone (kripto) bakiyesi</p>
              {!recon.apirone.ok ? (
                <p className="text-[11px] text-muted-foreground">{recon.apirone.error || "Okunamadı"}</p>
              ) : recon.apirone.items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Bakiye yok (ödemeler yönlendirmeyle cüzdanınıza aktarılmış olabilir).</p>
              ) : (
                <ul className="space-y-1">
                  {recon.apirone.items.map((b) => (
                    <li key={b.currency} className="flex justify-between text-xs">
                      <span className="text-foreground">{b.label}</span>
                      <span className="font-mono text-foreground">
                        {b.available.toFixed(6)} <span className="text-muted-foreground">/ {b.total.toFixed(6)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {recon.warnings.length > 0 && (
              <ul className="space-y-1.5">
                {recon.warnings.map((w, i) => (
                  <li key={i} className="flex gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      {/* Dönem özeti */}
      <Card className="p-3.5 space-y-3">
        <SectionTitle icon={CalendarClock} title="Dönem özeti" />
        <div className="flex gap-1.5">
          {[
            { h: 24, l: "24 saat" },
            { h: 24 * 7, l: "7 gün" },
            { h: 24 * 30, l: "30 gün" },
          ].map((o) => (
            <button
              key={o.h}
              type="button"
              onClick={() => setSummaryHours(o.h)}
              className={`h-8 rounded-full px-3 text-xs font-medium ${summaryHours === o.h ? "bg-foreground text-background" : "border border-border text-muted-foreground"}`}
            >
              {o.l}
            </button>
          ))}
        </div>
        {summary && (
          <div className="grid grid-cols-3 border-l border-t border-border">
            <Stat label="sipariş" value={String(summary.orders)} sub={`${summary.succeeded} başarılı · ${summary.refunded} iade`} />
            <Stat label="ciro" value={tryFmt(summary.revenue)} />
            <Stat label="tahmini net kâr" value={tryFmt(summary.profit)} tone="brand" />
            <Stat label="onaylı yükleme" value={tryFmt(summary.deposits)} sub={`${summary.depositCount} adet`} />
            <Stat label="yeni kullanıcı" value={String(summary.newUsers)} />
            <Stat label="toplam bakiye" value={tryFmt(summary.totalUserBalance)} />
          </div>
        )}
      </Card>

      {/* Kâr ve başarı analizi */}
      <Card className="p-3.5 space-y-3">
        <SectionTitle icon={TrendingUp} title="Servis × ülke: kâr ve kod gelme oranı" />
        <div className="flex flex-wrap items-center gap-1.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setProfitDays(d)}
              className={`h-8 rounded-full px-3 text-xs font-medium ${profitDays === d ? "bg-foreground text-background" : "border border-border text-muted-foreground"}`}
            >
              {d} gün
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            Yalnızca sorunlu
            <HaloSwitch size="sm" checked={onlyProblems} onCheckedChange={setOnlyProblems} aria-label="Yalnızca sorunlu" />
          </label>
        </div>
        {profit?.totals && (
          <p className="text-[11px] text-muted-foreground">
            Toplam {profit.totals.total} sipariş · ciro {tryFmt(profit.totals.revenue)} · maliyet {tryFmt(profit.totals.cost)} ·{" "}
            <span className="text-brand">kâr {tryFmt(profit.totals.profit)}</span>
          </p>
        )}
        {profitLoading && !profit ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Hesaplanıyor...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Bu dönemde veri yok.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {rows.map((r) => {
              const low = r.successRate !== null && r.successRate < 60 && r.succeeded + r.refunded >= 3;
              return (
                <li key={r.key} className={`px-3 py-2.5 ${r.hidden ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                        <ServiceIcon code={r.serviceCode} name={r.serviceName} size="xs" />
                        <span className="truncate">
                          {r.serviceName} <span className="text-muted-foreground">· {r.countryName}</span>
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.total} sipariş · {r.succeeded} başarılı · {r.refunded} iade{r.waiting ? ` · ${r.waiting} bekliyor` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge color={r.successRate === null ? "zinc" : low ? "rose" : "emerald"} size="sm">
                        {r.successRate === null ? "—" : `%${r.successRate} kod`}
                      </Badge>
                      <span className={`font-mono text-[11px] ${r.profit >= 0 ? "text-brand" : "text-rose-400"}`}>{tryFmt(r.profit)}</span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      ciro {tryFmt(r.revenue)} · maliyet {tryFmt(r.cost)}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePair(r)}
                      className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium ${
                        r.hidden ? "border border-brand/40 text-brand" : "border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {r.hidden ? "Satışa aç" : "Satışa kapat"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Kod gelme oranı = kodu gelen / (kodu gelen + iade). Maliyet güncel kurla hesaplanır. Kapatılan kombinasyon Mini App ve botta görünmez,
          doğrudan sipariş de verilemez.
        </p>
      </Card>

      {/* Uyarılar ve günlük rapor */}
      <Card className="p-3.5 space-y-3">
        <SectionTitle icon={BellRing} title="Otomatik uyarılar ve günlük rapor" />
        <label className="flex items-center justify-between gap-3 text-xs text-foreground">
          Uyarılar açık (yöneticilere bot mesajı)
          <HaloSwitch checked={alerts.enabled} onCheckedChange={(v) => setAlerts({ ...alerts, enabled: v })} aria-label="Uyarılar" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[11px] text-muted-foreground">
            Sağlayıcı kasası altına inerse ($)
            <input type="number" min={0} value={alerts.providerBalanceMin} onChange={(e) => setAlerts({ ...alerts, providerBalanceMin: Number(e.target.value) })} className={inputCls} />
          </label>
          <label className="space-y-1 text-[11px] text-muted-foreground">
            1 saatte iade sayısı (kullanıcı)
            <input type="number" min={0} value={alerts.refundsPerHour} onChange={(e) => setAlerts({ ...alerts, refundsPerHour: Number(e.target.value) })} className={inputCls} />
          </label>
          <label className="space-y-1 text-[11px] text-muted-foreground">
            Büyük yükleme eşiği (₺)
            <input type="number" min={0} value={alerts.largeDepositTry} onChange={(e) => setAlerts({ ...alerts, largeDepositTry: Number(e.target.value) })} className={inputCls} />
          </label>
          <label className="space-y-1 text-[11px] text-muted-foreground">
            10 dk'da başarısız kupon
            <input type="number" min={0} value={alerts.couponFailsPer10Min} onChange={(e) => setAlerts({ ...alerts, couponFailsPer10Min: Number(e.target.value) })} className={inputCls} />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2.5">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <HaloSwitch size="sm" checked={alerts.dailyReportEnabled} onCheckedChange={(v) => setAlerts({ ...alerts, dailyReportEnabled: v })} aria-label="Günlük rapor" />
            Günlük özet gönder
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Saat (TR)
            <input
              type="number"
              min={0}
              max={23}
              value={alerts.dailyReportHour}
              onChange={(e) => setAlerts({ ...alerts, dailyReportHour: Number(e.target.value) })}
              className="h-8 w-16 rounded-xl border border-border bg-muted px-2 text-center text-xs text-foreground"
            />
          </label>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Uyarı tekrarları sınırlıdır (kasa: 6 saatte bir, kullanıcı başı iade: 6 saatte bir). Kontroller zamanlanmış bakımda yapılır; saatlik olarak kesin
          çalışır, uygulamada trafik varken birkaç dakikada bir.
        </p>
        <button
          type="button"
          onClick={saveAlerts}
          disabled={savingAlerts}
          className="h-9 w-full rounded-full bg-foreground text-xs font-medium text-background disabled:opacity-60"
        >
          {savingAlerts ? "Kaydediliyor..." : "Uyarı ayarlarını kaydet"}
        </button>
      </Card>
    </div>
  );
}
