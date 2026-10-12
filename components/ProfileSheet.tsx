"use client";

import React from "react";
import { X, UserRound, Wallet, Smartphone, Loader2, RefreshCw, CalendarDays, Sparkles, Inbox } from "lucide-react";
import { haptic } from "@/lib/haptic";
import { Badge } from "./tremor/Badge";
import { CopyButton } from "@/components/ui/copy-button";
import { RollingNumber } from "@/components/ui/rolling-number";
import { DirectionAwareTabs } from "@/components/ui/direction-aware-tabs";

type Tab = "account" | "deposits" | "orders";

interface ProfileData {
  profile: {
    telegramId: number;
    firstName: string;
    lastName: string;
    username: string;
    createdAt: string;
    balance: number;
    spent: number;
    totalDeposited: number;
    orderCount: number;
    isVip: boolean;
    vipDiscountPercent: number;
  };
  deposits: Array<{ id: string; amount: number; method: string; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string }>;
  orders: Array<{
    id: string;
    serviceName: string;
    countryName: string;
    countryFlag: string;
    phoneNumber: string;
    chargedPrice: number;
    status: "WAIT_CODE" | "RECEIVED" | "CANCELLED" | "COMPLETED" | "TIMEOUT";
    smsCode: string | null;
    createdAt: number;
  }>;
}

interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initData: string;
}

const METHOD_LABELS: Record<string, string> = {
  Crypto: "Kripto (Otomatik)",
  USDT_TRC20: "USDT (TRC-20)",
  TRX: "TRX (Tron)",
  CryptoBot: "CryptoBot",
  "Havale/EFT": "Havale / EFT",
};

const DEPOSIT_STATUS: Record<string, { label: string; color: "emerald" | "amber" | "rose" }> = {
  APPROVED: { label: "Onaylandı", color: "emerald" },
  PENDING: { label: "Beklemede", color: "amber" },
  REJECTED: { label: "Reddedildi", color: "rose" },
};

const ORDER_STATUS: Record<string, { label: string; color: "emerald" | "amber" | "rose" | "zinc" }> = {
  COMPLETED: { label: "Tamamlandı", color: "emerald" },
  RECEIVED: { label: "Kod alındı", color: "emerald" },
  WAIT_CODE: { label: "Kod bekleniyor", color: "amber" },
  CANCELLED: { label: "İptal · iade", color: "zinc" },
  TIMEOUT: { label: "Süre doldu", color: "rose" },
};

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dayFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(value: string | number, withTime = true) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return (withTime ? dateFmt : dayFmt).format(d);
}

const money = (n: number) => n.toFixed(2);

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border px-4 py-10 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export function ProfileSheet({ isOpen, onClose, initData }: ProfileSheetProps) {
  const [tab, setTab] = React.useState<Tab>("account");
  const [data, setData] = React.useState<ProfileData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Profil yüklenemedi");
      setData(json);
    } catch (e: any) {
      setError(e.message || "Profil yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [initData]);

  React.useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const p = data?.profile;
  const fullName = p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || "Kullanıcı" : "";
  const initials = (p?.firstName || p?.username || "AZ").slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-background ring-1 ring-foreground/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] flex flex-col max-h-[92vh] space-y-4">
        {/* Başlık */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <h3 className="text-base font-medium tracking-tight text-foreground">Profilim</h3>
              <p className="text-[11px] text-muted-foreground">Hesap, bakiye ve işlem geçmişi</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                haptic.impact("light");
                load();
              }}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              aria-label="Yenile"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                haptic.impact("light");
                onClose();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <DirectionAwareTabs
          value={tab}
          onValueChange={(id) => {
            haptic.selection();
            setTab(id);
          }}
          tabs={[
            { id: "account", label: <><Wallet className="h-3.5 w-3.5" />Hesap</> },
            { id: "deposits", label: <><RefreshCw className="h-3.5 w-3.5" />Yüklemeler</> },
            { id: "orders", label: <><Smartphone className="h-3.5 w-3.5" />Numaralar</> },
          ]}
          tabClassName="px-1.5"
        />

        <div className="-mx-1 flex-1 overflow-y-auto px-1 pb-1">
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Profil yükleniyor...
            </div>
          ) : error && !data ? (
            <div className="space-y-3 py-10 text-center">
              <p className="text-xs text-rose-400">{error}</p>
              <button
                type="button"
                onClick={load}
                className="inline-flex h-9 items-center justify-center rounded-full border border-border px-4 text-xs font-medium text-foreground hover:bg-muted"
              >
                Tekrar dene
              </button>
            </div>
          ) : p ? (
            <>
              {tab === "account" && (
                <div className="space-y-3">
                  {/* Hesap kartı */}
                  <section className="rounded-3xl bg-background/70 p-4 ring-1 ring-foreground/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground ring-1 ring-foreground/10">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="truncate text-lg font-normal tracking-tight text-foreground">{fullName}</h4>
                          {p.isVip && (
                            <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-sm bg-secondary px-1.5 text-[10px] font-medium text-foreground dark:text-background">
                              <Sparkles className="h-3 w-3" /> VIP{p.vipDiscountPercent ? ` %${p.vipDiscountPercent}` : ""}
                            </span>
                          )}
                        </div>
                        {p.username && !p.username.startsWith("user_") && (
                          <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                        <span className="text-xs text-muted-foreground">Telegram ID</span>
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-foreground">{p.telegramId}</span>
                          <CopyButton value={String(p.telegramId)} className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground" />
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" /> Üyelik tarihi
                        </span>
                        <span className="text-xs text-foreground">{formatDate(p.createdAt, false)}</span>
                      </div>
                    </div>
                  </section>

                  {/* Bakiye özeti */}
                  <section className="rounded-3xl bg-background/70 p-4 ring-1 ring-foreground/10">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" /> Mevcut bakiye
                    </span>
                    <div className="mt-1 text-4xl font-normal leading-none tracking-tighter text-foreground">
                      ₺<RollingNumber value={p.balance} precision={2} format={money} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 border-l border-t border-border text-center">
                      <div className="border-b border-r border-border px-1 py-2.5">
                        <span className="block font-mono text-[13px] font-medium text-foreground">₺{money(p.totalDeposited)}</span>
                        <span className="block text-[10px] text-muted-foreground">toplam yükleme</span>
                      </div>
                      <div className="border-b border-r border-border px-1 py-2.5">
                        <span className="block font-mono text-[13px] font-medium text-foreground">₺{money(p.spent)}</span>
                        <span className="block text-[10px] text-muted-foreground">toplam harcama</span>
                      </div>
                      <div className="border-b border-r border-border px-1 py-2.5">
                        <span className="block font-mono text-[13px] font-medium text-foreground">{p.orderCount}</span>
                        <span className="block text-[10px] text-muted-foreground">numara</span>
                      </div>
                    </div>
                    <p className="mt-2.5 text-[10px] leading-relaxed text-muted-foreground">
                      Toplam yükleme, onaylanan ödemelerinizi kapsar; hediye bakiye kuponları dahil değildir.
                    </p>
                  </section>
                </div>
              )}

              {tab === "deposits" &&
                (data.deposits.length === 0 ? (
                  <EmptyState icon={Inbox} text="Henüz bakiye yükleme işleminiz yok." />
                ) : (
                  <ul className="divide-y divide-border rounded-3xl ring-1 ring-foreground/10">
                    {data.deposits.map((d) => {
                      const st = DEPOSIT_STATUS[d.status] || DEPOSIT_STATUS.PENDING;
                      return (
                        <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{METHOD_LABELS[d.method] || d.method}</p>
                            <p className="text-[11px] text-muted-foreground">{formatDate(d.createdAt)}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span
                              className={`font-mono text-sm font-medium ${
                                d.status === "APPROVED" ? "text-brand" : d.status === "REJECTED" ? "text-muted-foreground line-through" : "text-foreground"
                              }`}
                            >
                              +₺{money(d.amount)}
                            </span>
                            <Badge color={st.color} size="sm">{st.label}</Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ))}

              {tab === "orders" &&
                (data.orders.length === 0 ? (
                  <EmptyState icon={Smartphone} text="Henüz numara kiralamadınız." />
                ) : (
                  <ul className="space-y-2.5">
                    {data.orders.map((o) => {
                      const st = ORDER_STATUS[o.status] || ORDER_STATUS.WAIT_CODE;
                      return (
                        <li key={o.id} className="rounded-3xl p-3.5 ring-1 ring-foreground/10">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="text-lg leading-none">{o.countryFlag || "🌐"}</span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{o.serviceName}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {o.countryName} · {formatDate(o.createdAt)}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="font-mono text-xs text-foreground">₺{money(o.chargedPrice)}</span>
                              <Badge color={st.color} size="sm">{st.label}</Badge>
                            </div>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-2xl border border-border px-3 py-1.5">
                            <span className="truncate font-mono text-[13px] text-foreground">{o.phoneNumber || "—"}</span>
                            {o.phoneNumber && (
                              <CopyButton value={o.phoneNumber} className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground" />
                            )}
                          </div>

                          {o.smsCode && (
                            <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-brand/40 bg-brand/10 px-3 py-1.5">
                              <span className="text-[11px] text-brand">SMS kodu</span>
                              <span className="flex items-center gap-1">
                                <span className="font-mono text-base font-medium tracking-wider text-brand">{o.smsCode}</span>
                                <CopyButton value={o.smsCode} className="h-7 w-7 text-brand hover:bg-brand/15" />
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
