"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Loader2, Inbox, ShieldCheck, AlertCircle } from "lucide-react";
import { haptic } from "@/lib/haptic";
import { Card } from "./tremor/Card";

interface RentDuration {
  hours: number;
  label: string;
  stock: number;
  priceTry: number;
}

interface RentOffer {
  countryId: number;
  countryName: string;
  flag: string;
  durations: RentDuration[];
}

interface FullRentCardProps {
  userBalance: number;
  telegramId: number;
  onOrderSuccess: (order: any) => void;
  onOpenDeposit: () => void;
}

function FlagImage({ flag, name }: { flag: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const indicators = Array.from(flag || "")
    .map((ch) => ch.codePointAt(0) || 0)
    .filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff);
  const code =
    indicators.length === 2 ? indicators.map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65)).join("").toLowerCase() : "";
  return (
    <span className="inline-flex h-4 w-5 shrink-0 items-center justify-center" title={name} aria-hidden="true">
      {code && !failed ? (
        <img
          src={`https://flagcdn.com/w40/${code}.png`}
          width={40}
          height={30}
          loading="lazy"
          decoding="async"
          alt=""
          className="h-full w-full rounded-[3px] object-cover shadow-sm"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="leading-none">{flag || "🌐"}</span>
      )}
    </span>
  );
}

/**
 * Süreli numara kiralama (Hero-SMS "Full rent"): numara seçilen süre boyunca kullanıcıya ayrılır ve
 * her servisten gelen tüm SMS'ler alınır. Kiralama yapılabilen ülke yoksa kart hiç görünmez.
 */
export function FullRentCard({ userBalance, telegramId, onOrderSuccess, onOpenDeposit }: FullRentCardProps) {
  const [offers, setOffers] = useState<RentOffer[]>([]);
  const [totalStock, setTotalStock] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [countryId, setCountryId] = useState<number | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOffers = async () => {
    try {
      const res = await fetch("/api/sms/rent/options", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setOffers(data.offers || []);
        setTotalStock(Number(data.totalStock) || 0);
      }
    } catch {
      // kart gizli kalır
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const offer = useMemo(() => offers.find((o) => o.countryId === countryId) || null, [offers, countryId]);
  const duration = useMemo(() => offer?.durations.find((d) => d.hours === hours) || null, [offer, hours]);
  const minPrice = useMemo(
    () => offers.reduce((min, o) => Math.min(min, ...o.durations.map((d) => d.priceTry)), Infinity),
    [offers]
  );

  if (!loaded || offers.length === 0) return null;

  const pickCountry = (id: number) => {
    haptic.selection();
    setCountryId(id);
    const o = offers.find((x) => x.countryId === id);
    setHours(o?.durations[0]?.hours ?? null);
    setConfirming(false);
    setError(null);
  };

  const handleBuy = async () => {
    if (!offer || !duration) return;
    if (userBalance < duration.priceTry) {
      haptic.error();
      setError(`Yetersiz bakiye. Bu kiralama ₺${duration.priceTry.toFixed(2)}, bakiyeniz ₺${userBalance.toFixed(2)}.`);
      return;
    }
    if (!confirming) {
      haptic.impact("medium");
      setConfirming(true);
      return;
    }
    setOrdering(true);
    setError(null);
    haptic.impact("heavy");
    try {
      const res = await fetch("/api/sms/rent/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryId: offer.countryId, hours: duration.hours, telegramId }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        haptic.success();
        setConfirming(false);
        setOpen(false);
        onOrderSuccess(data.order);
        loadOffers();
      } else {
        haptic.error();
        setError(data.error || "Numara kiralanamadı.");
        setConfirming(false);
        loadOffers();
      }
    } catch {
      haptic.error();
      setError("Bağlantı hatası oluştu, lütfen tekrar deneyin.");
      setConfirming(false);
    } finally {
      setOrdering(false);
    }
  };

  return (
    <Card className="p-3.5 space-y-3">
      <button
        type="button"
        onClick={() => {
          haptic.impact("light");
          setOpen((v) => !v);
          if (!countryId && offers[0]) pickCountry(offers[0].countryId);
        }}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand shrink-0">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Numara Kiralama (Full rent)</div>
            <div className="text-[11px] text-muted-foreground truncate">
              Tüm servislerden SMS · {offers.length} ülke · {totalStock} numara
              {Number.isFinite(minPrice) ? ` · ₺${minPrice.toFixed(2)}'den` : ""}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Numara seçtiğiniz süre boyunca yalnızca size ayrılır; WhatsApp, Telegram, banka vb. her servisten gelen tüm SMS'ler
            burada listelenir.
          </p>

          {/* Ülke seçimi */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {offers.map((o) => {
              const selected = o.countryId === countryId;
              return (
                <button
                  key={o.countryId}
                  type="button"
                  onClick={() => pickCountry(o.countryId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${
                    selected
                      ? "bg-foreground text-background shadow-md"
                      : "bg-card border border-border text-foreground/80 hover:border-foreground/15"
                  }`}
                >
                  <FlagImage flag={o.flag} name={o.countryName} />
                  <span>{o.countryName}</span>
                </button>
              );
            })}
          </div>

          {/* Süre seçimi */}
          {offer && (
            <div className="grid grid-cols-2 gap-2">
              {offer.durations.map((d) => {
                const selected = d.hours === hours;
                return (
                  <button
                    key={d.hours}
                    type="button"
                    onClick={() => {
                      haptic.selection();
                      setHours(d.hours);
                      setConfirming(false);
                      setError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selected ? "border-brand/60 bg-brand/10" : "border-border bg-card/60 hover:border-foreground/15"
                    }`}
                  >
                    <div className="text-xs font-semibold text-foreground">{d.label}</div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-brand">₺{d.priceTry.toFixed(2)}</span>
                      <span className="text-[10px] text-muted-foreground">{d.stock} adet</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-[11px] text-brand flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Hiç SMS gelmediyse ilk 20 dakika içinde iptal edip ücretin tamamını geri alabilirsiniz. Sonrasında kiralama süre
              sonuna kadar devam eder ve iade yapılmaz.
            </span>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              {duration && userBalance < duration.priceTry && (
                <button
                  type="button"
                  onClick={onOpenDeposit}
                  className="px-2 py-1 rounded-lg bg-foreground text-background font-semibold shrink-0"
                >
                  Bakiye Yükle
                </button>
              )}
            </div>
          )}

          {duration && offer && (
            <div className="flex gap-2">
              {confirming && (
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={ordering}
                  className="h-10 px-4 rounded-full border border-border text-xs font-medium text-foreground/80 disabled:opacity-50"
                >
                  Vazgeç
                </button>
              )}
              <button
                type="button"
                onClick={handleBuy}
                disabled={ordering}
                className="h-10 flex-1 rounded-full bg-foreground text-background text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-60"
              >
                {ordering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Kiralanıyor...
                  </>
                ) : confirming ? (
                  <>Onaylıyorum · ₺{duration.priceTry.toFixed(2)} öde</>
                ) : (
                  <>
                    <Inbox className="w-3.5 h-3.5" /> {offer.countryName} · {duration.label} kirala · ₺{duration.priceTry.toFixed(2)}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
