"use client";

import React, { useState } from "react";
import { X, Ticket, Gift, CheckCircle, AlertCircle, Loader2, Sparkles, Tag } from "lucide-react";
import { haptic } from "@/lib/haptic";

interface CouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId: number;
  onSuccess?: (couponResult?: any) => void;
  activeDiscount?: {
    code: string;
    type: "DISCOUNT_PERCENT" | "DISCOUNT_FIXED";
    value: number;
  } | null;
}

export function CouponModal({
  isOpen,
  onClose,
  telegramId,
  onSuccess,
  activeDiscount,
}: CouponModalProps) {
  const [couponCode, setCouponCode] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    title?: string;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = couponCode.trim().toUpperCase();
    if (!cleanCode) {
      setStatusMsg({
        type: "error",
        message: "Lütfen bir kupon veya hediye kodu giriniz.",
      });
      return;
    }

    setSubmitting(true);
    setStatusMsg(null);
    haptic.impact("medium");

    try {
      const res = await fetch("/api/user/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          telegramId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        haptic.success();
        let title = "Kupon Başarıyla Tanımlandı!";
        if (data.coupon?.type === "BALANCE" || data.addedBalance) {
          title = `🎉 +${data.addedBalance || data.coupon?.value} ₺ Bakiye Eklendi!`;
        } else if (data.coupon?.type === "DISCOUNT_PERCENT") {
          title = `🎉 %${data.coupon?.value} İndirim Aktif Edildi!`;
        } else if (data.coupon?.type === "DISCOUNT_FIXED") {
          title = `🎉 -${data.coupon?.value} ₺ İndirim Aktif Edildi!`;
        }

        setStatusMsg({
          type: "success",
          title,
          message: data.message || "İndirim avantajınız hesabınıza uygulandı.",
        });
        setCouponCode("");
        if (onSuccess) {
          onSuccess(data);
        }
      } else {
        haptic.error();
        setStatusMsg({
          type: "error",
          message: data.error || "Kupon uygulanamadı.",
        });
      }
    } catch {
      haptic.error();
      setStatusMsg({
        type: "error",
        message: "Bağlantı hatası oluştu, lütfen tekrar deneyiniz.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setStatusMsg(null);
    setCouponCode("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-background ring-1 ring-foreground/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] flex flex-col max-h-[92vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <span>Kupon & Promosyon Kodu</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Hediye & İndirim
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">Bakiye yükleyin veya SMS indiriminden yararlanın</p>
            </div>
          </div>
          <button
            onClick={() => {
              haptic.impact("light");
              handleModalClose();
            }}
            className="p-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aktif İndirim Rozeti (Eğer varsa) */}
        {activeDiscount && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-brand/15 via-brand/10 to-transparent border border-brand/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand/20 border border-brand/30 flex items-center justify-center text-brand">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-brand tracking-wider block">
                  Aktif İndiriminiz
                </span>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-mono">
                  <span>{activeDiscount.code}</span>
                  <span className="text-brand bg-brand/20 px-1.5 py-0.5 rounded text-[10px]">
                    {activeDiscount.type === "DISCOUNT_PERCENT"
                      ? `-%${activeDiscount.value}`
                      : `-${activeDiscount.value} ₺`}
                  </span>
                </span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground text-right">
              İlk siparişinizde otomatik düşer
            </span>
          </div>
        )}

        {/* Ana Kupon Formu */}
        <div className="p-4 rounded-2xl bg-card/60 border border-border space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">Promosyon Kodunuz mu Var?</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Kodu girerek anında hediye TL bakiye veya indirim tanımlayabilirsiniz.
              </p>
            </div>
          </div>

          <form onSubmit={handleApplyCoupon} className="space-y-3">
            <div className="relative">
              <Ticket className="w-4 h-4 text-muted-foreground/80 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setStatusMsg(null);
                }}
                placeholder="Örn: HOSGELDIN50 veya BAHAR20"
                className="w-full bg-background border border-border rounded-xl pl-10 pr-3.5 py-3 text-xs font-mono font-semibold uppercase tracking-wider text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-500"
                autoCapitalize="characters"
                autoCorrect="off"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !couponCode.trim()}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold text-xs rounded-full shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kupon Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Kuponu Uygula</span>
                </>
              )}
            </button>
          </form>

          {/* Sonuç Mesajı */}
          {statusMsg && (
            <div
              className={`p-3 rounded-xl border text-xs transition-all ${
                statusMsg.type === "success"
                  ? "bg-brand/10 border-brand/30 text-brand"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {statusMsg.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  {statusMsg.title && (
                    <div className="font-semibold text-foreground mb-0.5">{statusMsg.title}</div>
                  )}
                  <div className="text-[11px] leading-relaxed opacity-90">
                    {statusMsg.message}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bilgilendirme Kutusu */}
        <div className="p-3 rounded-xl bg-card/30 border border-border space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            💡 Kupon Bilgilendirmesi
          </span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            • <b>Bakiye Kuponları:</b> Tutar doğrudan hesabınıza hediye TL olarak yüklenir.
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            • <b>İndirim Kuponları:</b> SMS kiralama işleminde fiyattan otomatik olarak düşülür.
          </p>
        </div>
      </div>
    </div>
  );
}
